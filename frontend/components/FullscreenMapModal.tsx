"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Map, { MapRef, Marker, Source, Layer, NavigationControl, AttributionControl } from "react-map-gl/maplibre"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Satellite, Map as MapIcon, Search, X, Loader2, MapPin, Clock } from "lucide-react"
import "maplibre-gl/dist/maplibre-gl.css"
import { Input } from "@/components/ui/input"
import { MAP_STYLES, MAP_LOCALIZATION } from "@/lib/constants"
import { geocodeApi } from "@/lib/api"
import POIDetailDrawer, { POIBasicData } from "@/components/POIDetailDrawer"
import { useLocalGeocode } from "@/hooks/useLocalGeocode"
import { useCityBias } from "@/hooks/useCityBias"

// ViewState 類型
interface ViewState {
    longitude: number
    latitude: number
    zoom: number
}

// 搜尋結果類型
interface SearchResult {
    lat: number
    lng: number
    name: string
    address?: string
    type?: string
    source?: string
}

// 活動類型
interface Activity {
    id?: string
    time?: string
    place?: string
    lat?: number
    lng?: number
    category?: string
}

interface FullscreenMapModalProps {
    isOpen: boolean
    onClose: () => void
    initialViewState: ViewState
    activities: Activity[]
    onAddPOI?: (poi: POIBasicData, time: string, notes?: string) => void
    tripTitle?: string  // 🆕 行程標題（用於智能搜尋）
}

// 搜尋歷史 Hook
const HISTORY_KEY = "map_search_history"
function useSearchHistory() {
    const [history, setHistory] = useState<SearchResult[]>(() => {
        if (typeof window === 'undefined') return []
        try {
            const stored = localStorage.getItem(HISTORY_KEY)
            return stored ? JSON.parse(stored) : []
        } catch { return [] }
    })

    const addToHistory = useCallback((item: SearchResult) => {
        setHistory(prev => {
            const updated = [item, ...prev.filter(h => h.name !== item.name)].slice(0, 5)
            localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
            return updated
        })
    }, [])

    return { history, addToHistory }
}

export default function FullscreenMapModal({
    isOpen,
    onClose,
    initialViewState,
    activities,
    onAddPOI,
    tripTitle  // 🆕 行程標題
}: FullscreenMapModalProps) {
    const mapRef = useRef<MapRef>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)  // 🆕 P5: 取消前一個請求
    const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard')
    const [mapLoaded, setMapLoaded] = useState(false)

    // 搜尋狀態
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<SearchResult[]>([])
    const [isTyping, setIsTyping] = useState(false)     // 🆕 輸入中（debounce 期間）
    const [isSearching, setIsSearching] = useState(false) // 搜尋中（API 調用中）
    const [showSearch, setShowSearch] = useState(false)
    const { history, addToHistory } = useSearchHistory()

    // POI Drawer 狀態
    const [poiDrawerOpen, setPoiDrawerOpen] = useState(false)
    const [selectedPOI, setSelectedPOI] = useState<POIBasicData | null>(null)

    // 標記點
    const markers = activities.filter(a => a.lat && a.lng) as (Activity & { lat: number; lng: number })[]

    // 🆕 輸入變更處理（立即回饋）
    const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setQuery(value)
        if (value.length >= 2) {
            setIsTyping(true)  // 立即顯示「準備中」
        } else {
            setIsTyping(false)
            setResults([])
        }
    }

    // 🏕️ Local Geocode Hook (L1 本地秒回)
    const { search: localSearch, isLoaded: localDataLoaded } = useLocalGeocode()

    // 🏙️ City Bias Hook (智能 Location Bias)
    const { findNearestCity } = useCityBias()

    // Debounced 搜尋 (L1 本地 + L2 API)
    useEffect(() => {
        if (query.length < 2) {
            setResults([])
            setIsTyping(false)
            return
        }

        const currentQuery = query  // 🆕 快照防止競態
        let l1Success = false       // 🆕 追蹤 L1 是否已成功

        // 🏕️ L1: 本地即時搜尋 (毫秒級)
        if (localDataLoaded) {
            const localResults = localSearch(currentQuery, 5)
            if (localResults.length > 0) {
                const mapped = localResults
                    .filter(r => r.lat && r.lng)
                    .map(r => ({
                        name: r.display,
                        lat: r.lat!,
                        lng: r.lng!,
                        address: r.country || '',
                        type: r.type,
                        source: 'local' as const
                    }))
                if (mapped.length > 0) {
                    setResults(mapped)
                    setIsTyping(false)
                    l1Success = true  // 🆕 標記 L1 成功
                    console.log(`🏕️ L1 本地秒回: ${mapped.length} 筆結果`)
                    // 🆕 不再 return，讓 L2 仍可補充結果
                }
            }
        }

        // 🌐 L2: API 搜尋 (300ms debounce)
        const timer = setTimeout(async () => {
            // 🆕 如果 L1 已找到結果，跳過 L2 避免覆蓋
            if (l1Success) {
                console.log(`🏕️ L1 已命中，跳過 L2 API`)
                return
            }

            // 🆕 P5: 取消前一個尚未完成的請求
            abortControllerRef.current?.abort()
            abortControllerRef.current = new AbortController()
            const signal = abortControllerRef.current.signal

            setIsTyping(false)
            setIsSearching(true)
            try {
                // 🏙️ 智能 Location Bias: 根據地圖中心找最近城市
                const nearestCity = findNearestCity(initialViewState.latitude, initialViewState.longitude)
                const currentZoom = mapRef.current?.getZoom() ?? initialViewState.zoom ?? 12  // 🆕 P1: 取得地圖縮放

                const data = await geocodeApi.search({
                    query: currentQuery,
                    limit: 5,
                    tripTitle,
                    lat: nearestCity?.lat ?? initialViewState.latitude,
                    lng: nearestCity?.lng ?? initialViewState.longitude,
                    country: nearestCity?.country,
                    region: nearestCity?.region,
                    zoom: currentZoom,  // 🆕 P1: 傳遞縮放層級
                    signal  // 🆕 P5: 傳遞 AbortSignal
                })
                if (currentQuery === query && !signal.aborted) {
                    setResults(data.results || [])
                }
            } catch (e) {
                // 🆕 P5: 忽略 AbortError (正常取消行為)
                if (e instanceof Error && e.name === 'AbortError') {
                    console.log(`🚫 L2 請求已取消: ${currentQuery}`)
                    return
                }
                if (currentQuery === query) {
                    setResults([])
                }
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => {
            clearTimeout(timer)
            abortControllerRef.current?.abort()  // 🆕 cleanup 時也取消
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, tripTitle, initialViewState.latitude, initialViewState.longitude, localDataLoaded, localSearch])

    // Esc 鍵退出
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (showSearch) {
                    setShowSearch(false)
                } else {
                    onClose()
                }
            }
        }
        window.addEventListener("keydown", handleEsc)
        return () => window.removeEventListener("keydown", handleEsc)
    }, [onClose, showSearch])

    // 自動 focus 搜尋框
    useEffect(() => {
        if (showSearch && inputRef.current) {
            inputRef.current.focus()
        }
    }, [showSearch])

    // 飛到指定位置
    const flyTo = useCallback((result: SearchResult) => {
        addToHistory(result)
        setQuery(result.name)
        setShowSearch(false)
        mapRef.current?.flyTo({
            center: [result.lng, result.lat],
            zoom: 16,
            duration: 1500
        })

        // 建立 POI 並開啟 Drawer
        setSelectedPOI({
            name: result.name,
            type: result.type || "place",
            lat: result.lat,
            lng: result.lng,
            address: result.address
        })
        setPoiDrawerOpen(true)
    }, [addToHistory])

    // 地圖載入
    const handleMapLoad = useCallback(() => {
        setMapLoaded(true)
        const map = mapRef.current?.getMap()
        if (!map) return

        if (!map.getSource('satellite')) {
            map.addSource('satellite', {
                type: 'raster',
                tiles: [MAP_STYLES.SATELLITE],
                tileSize: 256
            })
        }
        if (!map.getLayer('satellite-layer')) {
            map.addLayer({
                id: 'satellite-layer',
                type: 'raster',
                source: 'satellite',
                layout: { visibility: 'none' }
            }, map.getStyle()?.layers?.[0]?.id)
        }

        // 🌍 全球中文化：所有標籤優先顯示繁體中文
        const allLayers = map.getStyle()?.layers || []
        let chineseLayerCount = 0
        allLayers.forEach(layer => {
            if (layer.type === 'symbol' && 'layout' in layer && layer.layout?.['text-field']) {
                try {
                    map.setLayoutProperty(layer.id, 'text-field', MAP_LOCALIZATION.CHINESE_LABEL_EXPRESSION)
                    chineseLayerCount++
                } catch { /* 部分圖層可能不支援 */ }
            }
        })
        console.log(`🌍 全螢幕地圖: 已將 ${chineseLayerCount} 個標籤圖層中文化`)
    }, [])

    // 切換衛星模式
    const toggleMapMode = useCallback(() => {
        const map = mapRef.current?.getMap()
        if (!map || !mapLoaded) return

        const newMode = mapMode === 'standard' ? 'satellite' : 'standard'
        setMapMode(newMode)
        map.setLayoutProperty('satellite-layer', 'visibility', newMode === 'satellite' ? 'visible' : 'none')
    }, [mapMode, mapLoaded])

    // POI 點擊
    const handleMapClick = useCallback((e: maplibregl.MapLayerMouseEvent) => {
        const map = mapRef.current?.getMap()
        if (!map) return

        const features = map.queryRenderedFeatures(e.point, {
            layers: map.getStyle()?.layers?.filter(l => l.id.includes('poi') || l.id.includes('label')).map(l => l.id) || []
        })

        if (features.length > 0) {
            const feature = features[0]
            const props = feature.properties || {}
            const coords = feature.geometry.type === 'Point'
                ? (feature.geometry as GeoJSON.Point).coordinates
                : [e.lngLat.lng, e.lngLat.lat]

            // 🌍 中文名稱優先級
            const getName = () => {
                for (const key of MAP_LOCALIZATION.CHINESE_NAME_KEYS) {
                    if (props[key]) return props[key]
                }
                return '未知地點'
            }

            setSelectedPOI({
                name: getName(),
                type: props.class || props.subclass || 'place',
                lat: coords[1] as number,
                lng: coords[0] as number,
                address: props.address
            })
            setPoiDrawerOpen(true)
        }
    }, [])

    if (!isOpen) return null

    const showHistory = query.length === 0 && history.length > 0
    // 🆕 統一「搜尋完成」狀態：不在輸入、不在搜尋、query 長度足夠
    const searchDone = query.length >= 2 && !isTyping && !isSearching
    const showResults = searchDone && results.length > 0
    const showNoResults = searchDone && results.length === 0

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[9999] bg-black"
            >
                {/* 🗺️ 全螢幕地圖 */}
                <Map
                    ref={mapRef}
                    initialViewState={initialViewState}
                    style={{ width: "100%", height: "100%" }}
                    mapStyle={MAP_STYLES.VECTOR}
                    onLoad={handleMapLoad}
                    onClick={handleMapClick}
                    attributionControl={false}
                    minZoom={3}
                    maxZoom={20}
                >
                    <NavigationControl position="top-right" showCompass={false} />
                    <AttributionControl position="bottom-right" compact />

                    {/* 路線 */}
                    {markers.length >= 2 && (
                        <Source
                            id="route-line"
                            type="geojson"
                            data={{
                                type: "Feature",
                                properties: {},
                                geometry: {
                                    type: "LineString",
                                    coordinates: markers.map(m => [m.lng, m.lat])
                                }
                            }}
                        >
                            <Layer
                                id="route"
                                type="line"
                                paint={{
                                    "line-color": "#6366f1",
                                    "line-width": 4,
                                    "line-opacity": 0.8
                                }}
                            />
                        </Source>
                    )}

                    {/* 標記點 */}
                    {markers.map((m, i) => (
                        <Marker key={i} longitude={m.lng} latitude={m.lat}>
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-lg border-2 border-white">
                                {i + 1}
                            </div>
                        </Marker>
                    ))}
                </Map>

                {/* 🔙 返回按鈕 (左上角，簡化) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 left-4 z-20 h-12 w-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors"
                    style={{ top: "max(16px, env(safe-area-inset-top))" }}
                >
                    <ArrowLeft className="w-6 h-6 text-slate-700" />
                </button>

                {/* 🛰️ 衛星切換 (右下角) */}
                <button
                    onClick={toggleMapMode}
                    className="absolute bottom-24 right-4 z-20 h-12 w-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                    {mapMode === 'satellite' ? <MapIcon className="w-5 h-5" /> : <Satellite className="w-5 h-5" />}
                </button>

                {/* 🔍 搜尋按鈕 (底部固定) */}
                {!showSearch && (
                    <button
                        onClick={() => setShowSearch(true)}
                        className="absolute bottom-6 left-4 right-4 z-20 h-14 bg-white rounded-full shadow-xl flex items-center px-5 gap-3 hover:bg-slate-50 transition-colors"
                        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
                    >
                        <Search className="w-5 h-5 text-slate-400" />
                        <span className="text-slate-500">搜尋地點或問 AI...</span>
                    </button>
                )}

                {/* 🔍 搜尋 Sheet (底部展開) */}
                <AnimatePresence>
                    {showSearch && (
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-2xl"
                            style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
                        >
                            {/* 拖曳指示條 */}
                            <div className="flex justify-center py-3">
                                <div className="w-10 h-1 bg-slate-300 rounded-full" />
                            </div>

                            {/* 搜尋輸入 */}
                            <div className="px-4 pb-2">
                                <div className="relative">
                                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                                    <Input
                                        ref={inputRef}
                                        value={query}
                                        onChange={handleQueryChange}
                                        placeholder="搜尋地點，或問 AI..."
                                        className="h-12 pl-12 pr-10 rounded-xl border-slate-200 text-base"
                                    />
                                    {query && (
                                        <button
                                            onClick={() => {
                                                setQuery("")
                                                setIsTyping(false)
                                                setResults([])
                                            }}
                                            className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 結果列表 */}
                            <div className="max-h-72 overflow-y-auto">
                                {/* 歷史紀錄 */}
                                {showHistory && (
                                    <>
                                        <div className="px-4 py-2 text-xs font-medium text-slate-400 uppercase">最近搜尋</div>
                                        {history.map((h, i) => (
                                            <button
                                                key={i}
                                                onClick={() => flyTo(h)}
                                                className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3"
                                            >
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                <span>{h.name}</span>
                                            </button>
                                        ))}
                                    </>
                                )}

                                {/* 🆕 輸入中（debounce 期間）- 淡色提示 */}
                                {isTyping && !isSearching && (
                                    <div className="px-4 py-4 flex items-center gap-2 text-slate-400 transition-opacity duration-200">
                                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-pulse" />
                                        <span className="text-sm">等待輸入完成...</span>
                                    </div>
                                )}

                                {/* 搜尋中（API 調用中）- 明顯 Loading */}
                                {isSearching && (
                                    <div className="px-4 py-6 flex items-center justify-center gap-2 text-indigo-500 transition-opacity duration-200">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>搜尋中...</span>
                                    </div>
                                )}

                                {/* 搜尋結果 */}
                                {showResults && results.map((r, i) => (
                                    <button
                                        key={i}
                                        onClick={() => flyTo(r)}
                                        className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-start gap-3"
                                    >
                                        <MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                                        <div className="min-w-0">
                                            <div className="font-medium truncate">{r.name}</div>
                                            {r.address && (
                                                <div className="text-xs text-slate-500 truncate">{r.address}</div>
                                            )}
                                        </div>
                                    </button>
                                ))}

                                {/* 🆕 無結果提示 */}
                                {showNoResults && (
                                    <div className="px-4 py-4 text-center text-slate-500 text-sm">
                                        找不到「{query}」的結果
                                    </div>
                                )}

                                {/* AI 語意搜尋選項 - 暫時隱藏，保留程式碼供未來開發 */}
                                {/* {showAIOption && (
                                    <button
                                        onClick={handleAISearch}
                                        disabled={aiSearching}
                                        className="w-full px-4 py-3 text-left hover:bg-purple-50 flex items-center gap-3 border-t"
                                    >
                                        {aiSearching ? (
                                            <>
                                                <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                                                <span className="text-purple-600">🧠 AI 正在分析位置...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-5 h-5 text-purple-500" />
                                                <span>
                                                    <span className="font-medium text-purple-600">✨ 使用 AI 搜尋</span>
                                                    <span className="text-slate-500 ml-1">「{query}」</span>
                                                </span>
                                            </>
                                        )}
                                    </button>
                                )} */}
                            </div>

                            {/* 關閉按鈕 */}
                            <div className="px-4 pt-2">
                                <button
                                    onClick={() => setShowSearch(false)}
                                    className="w-full py-3 text-slate-500 text-sm font-medium"
                                >
                                    取消
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 📍 POI Detail Drawer */}
                <POIDetailDrawer
                    isOpen={poiDrawerOpen}
                    onClose={() => setPoiDrawerOpen(false)}
                    poi={selectedPOI}
                    suggestedTime="12:00"
                    onAddToItinerary={(poi, time, aiSummary) => {
                        if (onAddPOI) {
                            const notes = aiSummary
                                ? `${aiSummary.summary}\n必點: ${aiSummary.must_try?.join(', ') || ''}`
                                : undefined
                            onAddPOI(poi, time, notes)
                        }
                    }}
                />
            </motion.div>
        </AnimatePresence>
    )
}
