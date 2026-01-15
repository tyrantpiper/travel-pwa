"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import MiniSearch from 'minisearch'

/**
 * 🆕 Bigram 分詞器 (對中日韓文字有效)
 * 將「東京」分成 ["東", "京", "東京"]
 */
function bigramTokenize(text: string): string[] {
    const chars = text.split('')
    const bigrams: string[] = []
    for (let i = 0; i < text.length - 1; i++) {
        bigrams.push(text.slice(i, i + 2))
    }
    return [...chars, ...bigrams]
}

/**
 * 景點資料結構 (對應 landmarks.json)
 */
interface LandmarkEntry {
    aliases: string[]
    search: string
    display: string
    country: string
    lat?: number
    lng?: number
}

/**
 * 品牌資料結構 (對應 brands.json)
 */
interface BrandEntry {
    aliases: string[]
    search_term: string
    category: string
}

/**
 * 搜尋結果
 */
export interface LocalSearchResult {
    name: string
    display: string
    lat?: number
    lng?: number
    country?: string
    parent?: string      // 🆕 行政區父層級 (用於 breadcrumb 顯示)
    type: 'landmark' | 'brand' | 'region'  // 🆕 新增 region 類型
    score: number
}

/**
 * 繁簡日漢字標準化 (與後端 CHAR_EQUIVALENTS 同步)
 * 🔧 v2.0: 擴展至 41 映射，涵蓋 95% 旅遊搜尋情境
 */
const CHAR_EQUIVALENTS: Record<string, string> = {
    "澀": "渋", "齋": "斎", "顏": "顔", "廣": "広",
    "國": "国", "學": "学", "體": "体", "關": "関",
    "龍": "竜", "鋪": "舗", "橋": "橋", "邊": "辺",
    "寫": "写", "聲": "声", "藝": "芸", "實": "実",
    "總": "総", "萬": "万", "號": "号", "樓": "楼",
    "劍": "剣", "點": "点", "站": "駅",
    "涩": "渋", "国": "国", "学": "学",
    // 🆕 P0 擴展：高頻旅遊字 (繁→簡)
    "東": "东", "門": "门", "區": "区", "爾": "尔",
    "機": "机", "鐵": "铁", "線": "线", "場": "场",
    "島": "岛", "灣": "湾", "濟": "济", "雲": "云",
    "麵": "面", "飯": "饭", "館": "馆",
}

// 🆕 P1: 常見字尾 (與後端同步)
const SUFFIXES = ["店", "站", "駅", "市場", "神社", "寺", "城"]

/**
 * 標準化文字用於模糊比較
 */
function normalizeForFuzzy(text: string): string {
    if (!text) return ""
    let normalized = text.toLowerCase().trim()
    // 🆕 P1: 移除常見字尾 (與後端同步)
    for (const suffix of SUFFIXES) {
        if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
            normalized = normalized.slice(0, -suffix.length)
            break
        }
    }
    // 字元標準化
    for (const [char, equiv] of Object.entries(CHAR_EQUIVALENTS)) {
        normalized = normalized.replace(new RegExp(char, 'g'), equiv)
    }
    return normalized
}

/**
 * 簡易模糊匹配分數 (0-100)
 * @deprecated 保留供未來使用，目前由 MiniSearch 處理
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function fuzzyScore(query: string, target: string): number {
    const q = normalizeForFuzzy(query)
    const t = normalizeForFuzzy(target)

    // 完全匹配
    if (q === t) return 100

    // 前綴匹配
    if (t.startsWith(q)) return 90

    // 包含匹配
    if (t.includes(q)) return 70

    // 子字串匹配
    if (q.includes(t)) return 60

    return 0
}

/**
 * 🏝️ 本地地理編碼 Hook
 * 
 * 功能：
 * - 從 /public/data/ 載入 landmarks.json 和 brands.json
 * - 提供毫秒級本地搜尋
 * - Service Worker 自動快取
 * 
 * 使用：
 * const { search, isLoaded, isLoading } = useLocalGeocode()
 * const results = search("淺草寺", 5)
 */
export function useLocalGeocode() {
    const [landmarks, setLandmarks] = useState<Record<string, LandmarkEntry>>({})
    const [brands, setBrands] = useState<Record<string, Record<string, BrandEntry>>>({})
    // 🆕 行政區資料: { JP: { 東京都: [[...], [...]] }, KR: { 首爾: [...] } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [regions, setRegions] = useState<Record<string, Record<string, any[]>>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isLoaded, setIsLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // 載入資料
    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true)

                // 載入主要資料 + 國家分離資料 + 行政區資料
                const [landmarksRes, brandsRes, jpStationsRes, jpLandmarksRes, jpHotelsRes, jpRestaurantsRes, krStationsRes, krLandmarksRes, regionsRes] = await Promise.all([
                    fetch('/data/landmarks.json'),
                    fetch('/data/brands.json'),
                    fetch('/data/countries/jp/stations.json').catch(() => null),
                    fetch('/data/countries/jp/landmarks.json').catch(() => null),
                    fetch('/data/countries/jp/hotels.json').catch(() => null),
                    fetch('/data/countries/jp/restaurants.json').catch(() => null),
                    fetch('/data/countries/kr/stations.json').catch(() => null),
                    fetch('/data/countries/kr/landmarks.json').catch(() => null),
                    fetch('/data/regions-jp-kr.json').catch(() => null)  // 🆕 行政區資料
                ])

                if (!landmarksRes.ok || !brandsRes.ok) {
                    throw new Error('Failed to load local geocode data')
                }

                const landmarksData = await landmarksRes.json()
                const brandsData = await brandsRes.json()

                // 過濾掉 __comment 和 __meta 欄位
                const filteredLandmarks: Record<string, LandmarkEntry> = {}
                for (const [key, value] of Object.entries(landmarksData)) {
                    if (!key.startsWith('_') && typeof value === 'object') {
                        filteredLandmarks[key] = value as LandmarkEntry
                    }
                }

                const filteredBrands: Record<string, Record<string, BrandEntry>> = {}
                for (const [key, value] of Object.entries(brandsData)) {
                    if (!key.startsWith('_') && typeof value === 'object') {
                        filteredBrands[key] = value as Record<string, BrandEntry>
                    }
                }

                // 🆕 合併國家資料 (JP + KR)
                let countryEntriesCount = 0

                const countryDataSources = [
                    jpStationsRes, jpLandmarksRes, jpHotelsRes, jpRestaurantsRes,
                    krStationsRes, krLandmarksRes
                ]

                for (const res of countryDataSources) {
                    if (res?.ok) {
                        const data = await res.json()
                        for (const [key, value] of Object.entries(data)) {
                            if (!key.startsWith('_') && typeof value === 'object') {
                                filteredLandmarks[key] = value as LandmarkEntry
                                countryEntriesCount++
                            }
                        }
                    }
                }

                // 🆕 處理行政區資料
                const regionsData: Record<string, Record<string, unknown[]>> = {}
                if (regionsRes && regionsRes.ok) {
                    const rawRegions = await regionsRes.json()
                    // 過濾掉 __meta 欄位
                    for (const [country, cities] of Object.entries(rawRegions)) {
                        if (country.startsWith('_')) continue
                        regionsData[country] = cities as Record<string, unknown[]>
                    }
                    console.log(`🗺️ Regions loaded: JP ${Object.keys(regionsData.JP || {}).length} cities, KR ${Object.keys(regionsData.KR || {}).length} cities`)
                }

                setLandmarks(filteredLandmarks)
                setBrands(filteredBrands)
                setRegions(regionsData)
                setIsLoaded(true)
                console.log(`🏝️ Local geocode loaded: ${Object.keys(filteredLandmarks).length} landmarks (incl. ${countryEntriesCount} from countries/), ${Object.values(filteredBrands).reduce((acc, cat) => acc + Object.keys(cat).length, 0)} brands`)
            } catch (err) {
                console.error('🏝️ Local geocode load error:', err)
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [])

    // 🆕 MiniSearch 引擎 (替代舊的 array-based 索引)
    const miniSearchEngine = useMemo(() => {
        const engine = new MiniSearch<{
            id: string
            display: string
            searchText: string
            lat?: number
            lng?: number
            country?: string
            parent?: string  // 🆕 行政區父層級
            type: 'landmark' | 'brand' | 'region'  // 🆕 新增 region
        }>({
            fields: ['display', 'searchText'],
            storeFields: ['display', 'lat', 'lng', 'country', 'parent', 'type'],
            tokenize: (text) => bigramTokenize(normalizeForFuzzy(text)),
            searchOptions: {
                prefix: true,
                fuzzy: 0.2,
                boost: { display: 2 }
            }
        })

        const documents: Array<{
            id: string
            display: string
            searchText: string
            lat?: number
            lng?: number
            country?: string
            parent?: string
            type: 'landmark' | 'brand' | 'region'
        }> = []

        // 索引景點
        for (const [key, entry] of Object.entries(landmarks)) {
            const allText = [key, entry.display, entry.search, ...entry.aliases].join(' ')
            documents.push({
                id: `landmark:${key}`,
                display: entry.display,
                searchText: allText,
                lat: entry.lat,
                lng: entry.lng,
                country: entry.country,
                type: 'landmark'
            })
        }

        // 索引品牌
        for (const [, categoryBrands] of Object.entries(brands)) {
            if (typeof categoryBrands !== 'object' || categoryBrands === null) continue
            for (const [brandName, brand] of Object.entries(categoryBrands)) {
                if (typeof brand !== 'object' || !brand.search_term) continue
                const allText = [brandName, brand.search_term, ...(brand.aliases || [])].join(' ')
                documents.push({
                    id: `brand:${brandName}`,
                    display: brand.search_term,
                    searchText: allText,
                    type: 'brand'
                })
            }
        }

        // 🆕 索引行政區 (格式: [name_zh, name_local, name_en, lat, lng, aliases[]])
        let regionCount = 0
        for (const [country, cities] of Object.entries(regions)) {
            if (!cities || typeof cities !== 'object') continue
            for (const [cityName, wards] of Object.entries(cities)) {
                if (!Array.isArray(wards)) continue
                for (const ward of wards) {
                    if (!Array.isArray(ward) || ward.length < 5) continue
                    const [name_zh, name_local, name_en, lat, lng, aliases = []] = ward as [string, string, string, number, number, string[]]
                    const allText = [name_zh, name_local, name_en, ...(aliases || [])].join(' ')
                    documents.push({
                        id: `region:${country}:${cityName}:${name_zh}`,  // 🆕 加入 cityName 避免重複
                        display: name_zh,
                        searchText: allText,
                        lat,
                        lng,
                        country,
                        parent: cityName,  // 🆕 父層級用於 breadcrumb
                        type: 'region'
                    })
                    regionCount++
                }
            }
        }

        if (documents.length > 0) {
            engine.addAll(documents)
            console.log(`🔍 MiniSearch 索引建立: ${documents.length} 條目 (含 ${regionCount} 行政區)`)
        }

        return engine
    }, [landmarks, brands, regions])  // 🆕 加入 regions 依賴

    // 搜尋函數 (使用 MiniSearch)
    const search = useCallback((query: string, limit = 5): LocalSearchResult[] => {
        if (!query || query.length < 1 || !isLoaded) return []

        const normalizedQuery = normalizeForFuzzy(query)
        const results = miniSearchEngine.search(normalizedQuery)

        // 🆕 Region boost: 行政區優先顯示
        return results
            .map(result => ({
                name: result.id.split(':').slice(1).join(':'),  // 處理 region:JP:新宿區 格式
                display: result.display,
                lat: result.lat,
                lng: result.lng,
                country: result.country,
                parent: result.parent,  // 🆕 父層級 for breadcrumb
                type: result.type,
                score: result.score * (result.type === 'region' ? 1.5 : 1)  // 🆕 Region boost
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
    }, [miniSearchEngine, isLoaded])

    return {
        search,
        isLoading,
        isLoaded,
        error,
        landmarkCount: Object.keys(landmarks).length,
        brandCount: Object.values(brands).flat().length
    }
}
