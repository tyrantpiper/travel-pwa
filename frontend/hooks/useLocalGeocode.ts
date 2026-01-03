"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'

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
    type: 'landmark' | 'brand'
    score: number
}

/**
 * 繁簡日漢字標準化 (與後端 CHAR_EQUIVALENTS 同步)
 */
const CHAR_EQUIVALENTS: Record<string, string> = {
    "澀": "渋", "齋": "斎", "顏": "顔", "廣": "広",
    "國": "国", "學": "学", "體": "体", "關": "関",
    "龍": "竜", "鋪": "舗", "橋": "橋", "邊": "辺",
    "寫": "写", "聲": "声", "藝": "芸", "實": "実",
    "總": "総", "萬": "万", "號": "号", "樓": "楼",
    "劍": "剣", "點": "点", "站": "駅",
    "涩": "渋", "国": "国", "学": "学",
}

/**
 * 標準化文字用於模糊比較
 */
function normalizeForFuzzy(text: string): string {
    if (!text) return ""
    let normalized = text.toLowerCase().trim()
    for (const [char, equiv] of Object.entries(CHAR_EQUIVALENTS)) {
        normalized = normalized.replace(new RegExp(char, 'g'), equiv)
    }
    return normalized
}

/**
 * 簡易模糊匹配分數 (0-100)
 */
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
    const [isLoading, setIsLoading] = useState(true)
    const [isLoaded, setIsLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // 載入資料
    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true)

                // 載入主要資料 + 國家分離資料
                const [landmarksRes, brandsRes, jpStationsRes, jpLandmarksRes, jpHotelsRes, jpRestaurantsRes, krStationsRes, krLandmarksRes] = await Promise.all([
                    fetch('/data/landmarks.json'),
                    fetch('/data/brands.json'),
                    fetch('/data/countries/jp/stations.json').catch(() => null),
                    fetch('/data/countries/jp/landmarks.json').catch(() => null),
                    fetch('/data/countries/jp/hotels.json').catch(() => null),
                    fetch('/data/countries/jp/restaurants.json').catch(() => null),
                    fetch('/data/countries/kr/stations.json').catch(() => null),
                    fetch('/data/countries/kr/landmarks.json').catch(() => null)
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

                setLandmarks(filteredLandmarks)
                setBrands(filteredBrands)
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

    // 建立搜尋索引 (優化效能)
    const searchIndex = useMemo(() => {
        const index: Array<{
            key: string
            aliases: string[]
            data: LandmarkEntry | BrandEntry
            type: 'landmark' | 'brand'
        }> = []

        // 索引景點
        for (const [key, entry] of Object.entries(landmarks)) {
            index.push({
                key,
                aliases: [key, ...entry.aliases, entry.search, entry.display],
                data: entry,
                type: 'landmark'
            })
        }

        // 索引品牌 (nested object structure: category -> brand name -> brand entry)
        for (const [, categoryBrands] of Object.entries(brands)) {
            if (typeof categoryBrands !== 'object' || categoryBrands === null) continue
            for (const [brandName, brand] of Object.entries(categoryBrands)) {
                if (typeof brand !== 'object' || !brand.search_term) continue
                index.push({
                    key: brand.search_term,
                    aliases: [brandName, brand.search_term, ...(brand.aliases || [])],
                    data: brand,
                    type: 'brand'
                })
            }
        }

        return index
    }, [landmarks, brands])

    // 搜尋函數
    const search = useCallback((query: string, limit = 5): LocalSearchResult[] => {
        if (!query || query.length < 1 || !isLoaded) return []

        const results: LocalSearchResult[] = []

        for (const item of searchIndex) {
            let bestScore = 0

            // 檢查所有別名
            for (const alias of item.aliases) {
                const score = fuzzyScore(query, alias)
                if (score > bestScore) bestScore = score
            }

            if (bestScore > 50) {
                if (item.type === 'landmark') {
                    const landmark = item.data as LandmarkEntry
                    results.push({
                        name: item.key,
                        display: landmark.display,
                        lat: landmark.lat,
                        lng: landmark.lng,
                        country: landmark.country,
                        type: 'landmark',
                        score: bestScore
                    })
                } else {
                    const brand = item.data as BrandEntry
                    results.push({
                        name: brand.search_term,
                        display: brand.search_term,
                        type: 'brand',
                        score: bestScore
                    })
                }
            }
        }

        // 按分數排序，截取前 N 個
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
    }, [searchIndex, isLoaded])

    return {
        search,
        isLoading,
        isLoaded,
        error,
        landmarkCount: Object.keys(landmarks).length,
        brandCount: Object.values(brands).flat().length
    }
}
