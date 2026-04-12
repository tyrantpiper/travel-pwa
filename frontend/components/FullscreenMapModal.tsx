"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Map, { MapRef, Marker, Source, Layer, NavigationControl, AttributionControl } from "react-map-gl/maplibre"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Satellite, Map as MapIcon, Search, X, Loader2, MapPin, Clock, Crosshair } from "lucide-react"
import { toast } from "sonner"
import "maplibre-gl/dist/maplibre-gl.css"
import { Input } from "@/components/ui/input"
import { MAP_STYLES, MAP_LOCALIZATION } from "@/lib/constants"
import { geocodeApi } from "@/lib/api"
import POIDetailDrawer, { POIBasicData } from "@/components/POIDetailDrawer"
import { useLocalGeocode } from "@/hooks/useLocalGeocode"
import { useCityBias } from "@/hooks/useCityBias"
import { debugLog } from "@/lib/debug"
import { useLanguage } from "@/lib/LanguageContext"
import { SearchResult } from "@/lib/itinerary-types"
import { getDistanceKm } from "@/lib/location-utils"

// ViewState 類型
interface ViewState {
    longitude: number
    latitude: number
    zoom: number
}

// 🆕 P6: 二次排序 (Re-ranking)
function rerankResults(
    results: SearchResult[],
    query: string,
    centerLat: number,
    centerLng: number
): SearchResult[] {

    const queryLower = query.toLowerCase()

    return results
        .map(r => {
            const dist = getDistanceKm(centerLat, centerLng, r.lat, r.lng)
            const nameMatch = r.name.toLowerCase().includes(queryLower) ? 50 : 0
            const exactMatch = r.name.toLowerCase() === queryLower ? 100 : 0
            // 分數 = 完全匹配 + 部分匹配 + 距離分 (越近分越高)
            const reScore = exactMatch + nameMatch + Math.max(0, 100 - dist)
            return { ...r, reScore }
        })
        .sort((a, b) => (b.reScore ?? 0) - (a.reScore ?? 0))
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ reScore: _reScore, ...r }) => r)  // 移除 reScore 欄位
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
    const { t } = useLanguage()
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

    // 📍 紅色大頭針狀態 (搜尋結果或手動點選)
    const [searchResultMarker, setSearchResultMarker] = useState<{ lat: number; lng: number; name: string } | null>(null)

    // POI Drawer 狀態
    const [poiDrawerOpen, setPoiDrawerOpen] = useState(false)
    const [selectedPOI, setSelectedPOI] = useState<POIBasicData | null>(null)
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [isLocating, setIsLocating] = useState(false)

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
                    debugLog(`🏕️ L1 本地秒回: ${mapped.length} 筆結果`)
                    // 🆕 不再 return，讓 L2 仍可補充結果
                }
            }
        }

        // 🆕 API 搜尋 (300ms debounce)
        const timer = setTimeout(async () => {

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
                    // 🆕 P6: 二次排序並合併 (優先顯示精確匹配 + 距離近的結果，去重 50m)
                    const reranked = rerankResults(
                        data.results || [],
                        currentQuery,
                        initialViewState.latitude,
                        initialViewState.longitude
                    )
                    setResults(prev => {
                        const combined = [...prev]
                        for (const r of reranked) {
                            const isDup = combined.some(existing =>
                                // 🆕 優先用 osm_id 精準去重，無 osm_id 才用 50m 座標
                                (r.osm_id && existing.osm_id && String(r.osm_id) === String(existing.osm_id)) ||
                                (getDistanceKm(existing.lat ?? 0, existing.lng ?? 0, r.lat ?? 0, r.lng ?? 0) < 0.05)
                            )
                            if (!isDup) combined.push(r)
                        }

                        // 🆕 Step B: 加入距離計算與排序 (優先以用戶位置排序，若無則按地圖中心)
                        const withDistance = combined.map(r => ({
                            ...r,
                            _distKm: userLocation
                                ? getDistanceKm(userLocation.lat, userLocation.lng, r.lat, r.lng)
                                : null
                        }))

                        const sorted = userLocation
                            ? [...withDistance].sort((a, b) => (a._distKm ?? 999) - (b._distKm ?? 999))
                            : [...withDistance].sort((a, b) =>
                                getDistanceKm(initialViewState.latitude, initialViewState.longitude, a.lat, a.lng) -
                                getDistanceKm(initialViewState.latitude, initialViewState.longitude, b.lat, b.lng)
                            )

                        return sorted
                    })
                    debugLog(`🔄 P6 Merged ${reranked.length} results (Deduped)`)
                }
            } catch (e) {
                // 🆕 P5: 忽略 AbortError (正常取消行為)
                if (e instanceof Error && e.name === 'AbortError') {
                    debugLog(`🚫 L2 請求已取消: ${currentQuery}`)
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

        // 🆕 設置標記點（紅色大頭針）
        setSearchResultMarker({ lat: result.lat, lng: result.lng, name: result.name })

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

    // 📍 定位功能
    const handleLocateMe = useCallback(() => {
        if (!("geolocation" in navigator)) {
            toast.error(t('map_geolocation_unsupported'))
            return
        }
        setIsLocating(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords
                setUserLocation({ lat: latitude, lng: longitude })
                setIsLocating(false)

                // 飛到用戶位置
                mapRef.current?.flyTo({
                    center: [longitude, latitude],
                    zoom: 15,
                    duration: 1000
                })
            },
            (error) => {
                setIsLocating(false)
                console.error("Geolocation error:", error)
                if (error.code === error.PERMISSION_DENIED) {
                    toast.error(t('map_geolocation_denied'))
                } else {
                    toast.error(t('map_geolocation_failed') + error.message)
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
    }, [t])

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
        debugLog(`🌍 全螢幕地圖: 已將 ${chineseLayerCount} 個標籤圖層中文化`)
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
                return t('map_location_point')
            }

            const poiData: POIBasicData = {
                name: getName(),
                type: props.class || props.subclass || 'place',
                lat: coords[1] as number,
                lng: coords[0] as number,
                address: props.address
            }

            // 🆕 設置標記點（紅色大頭針）
            setSearchResultMarker({ lat: poiData.lat, lng: poiData.lng, name: poiData.name })

            setSelectedPOI(poiData)
            setPoiDrawerOpen(true)
        }
    }, [t])

    // 🆕 2026 Logic: 處理地圖長按 (任意取點)
    const handleMapLongPress = useCallback((e: maplibregl.MapLayerMouseEvent) => {
        const { lng, lat } = e.lngLat

        const poiData: POIBasicData = {
            name: t('map_location_point'),
            type: 'place',
            lat: lat,
            lng: lng,
        }

        // 設置標記點（紅色大頭針）
        setSearchResultMarker({ lat, lng, name: poiData.name })

        setSelectedPOI(poiData)
        setPoiDrawerOpen(true)
    }, [t])

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
                    mapStyle={mapMode === 'satellite' ? MAP_STYLES.SATELLITE : MAP_STYLES.VECTOR}
                    onLoad={handleMapLoad}
                    onClick={handleMapClick}
                    onContextMenu={(e) => {
                        // 🆕 2026 Logic: 長按/右鍵 取點
                        e.originalEvent.preventDefault()
                        handleMapLongPress(e)
                    }}
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
                        <Marker key={`marker-${i}`} longitude={m.lng} latitude={m.lat}>
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-lg border-2 border-white">
                                {i + 1}
                            </div>
                        </Marker>
                    ))}

                    {/* 📍 用戶位置藍點標記 */}
                    {userLocation && (
                        <Marker
                            longitude={userLocation.lng}
                            latitude={userLocation.lat}
                            anchor="center"
                        >
                            <div className="relative">
                                <div className="absolute -inset-3 bg-blue-400/30 rounded-full animate-ping" />
                                <div className="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg" />
                            </div>
                        </Marker>
                    )}

                    {/* 🆕 搜尋結果標記（紅色大頭針） */}
                    {searchResultMarker && (
                        <Marker
                            key="search-pin"
                            longitude={searchResultMarker.lng}
                            latitude={searchResultMarker.lat}
                            anchor="bottom"
                        >
                            <div className="relative animate-bounce" style={{ animationDuration: '0.6s', animationIterationCount: 3 }}>
                                {/* 陰影 */}
                                <div
                                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/30 rounded-full blur-sm"
                                />
                                {/* 大頭針 */}
                                <div className="relative">
                                    {/* 針體 */}
                                    <div
                                        className="w-8 h-8 bg-red-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center"
                                        style={{
                                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.5), 0 2px 4px rgba(0,0,0,0.2)'
                                        }}
                                    >
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                    </div>
                                    {/* 針尖 */}
                                    <div
                                        className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
                                        style={{
                                            borderLeft: '6px solid transparent',
                                            borderRight: '6px solid transparent',
                                            borderTop: '10px solid #ef4444',
                                            top: '26px'
                                        }}
                                    />
                                </div>
                            </div>
                        </Marker>
                    )}
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

                {/* 📍 定位按鈕 */}
                <button
                    onClick={handleLocateMe}
                    disabled={isLocating}
                    className="absolute bottom-40 right-4 z-20 h-12 w-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
                    title={t('map_my_location') || "定位我的位置"}
                >
                    {isLocating ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    ) : (
                        <Crosshair className="w-5 h-5 text-blue-500" />
                    )}
                </button>

                {/* 🔍 搜尋按鈕 (底部固定) */}
                {!showSearch && (
                    <button
                        onClick={() => setShowSearch(true)}
                        className="absolute bottom-6 left-4 right-4 z-20 h-14 bg-white rounded-full shadow-xl flex items-center px-5 gap-3 hover:bg-slate-50 transition-colors"
                        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
                    >
                        <Search className="w-5 h-5 text-slate-400" />
                        <span className="text-slate-500">{t('map_search_ai')}</span>
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
                                        placeholder={t('map_search_ai')}
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
                                        <div className="px-4 py-2 text-xs font-medium text-slate-400 uppercase">{t('map_recent_search')}</div>
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
                                        <span className="text-sm">{t('map_enter_query')}</span>
                                    </div>
                                )}

                                {/* 搜尋中（API 調用中）- 明顯 Loading */}
                                {isSearching && (
                                    <div className="px-4 py-6 flex items-center justify-center gap-2 text-indigo-500 transition-opacity duration-200">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>{t('map_searching')}</span>
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
                                            <div className="font-medium truncate">
                                                {r.name}
                                                {r.cross_country && (
                                                    <span className="text-[10px] text-amber-500 ml-1 font-medium">🌍</span>
                                                )}
                                            </div>
                                            {r.address && (
                                                <div className="text-xs text-slate-500 truncate">{r.address}</div>
                                            )}
                                            {(r.city || r.country) && (
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    {[r.city, r.country].filter(Boolean).join(" · ")}
                                                </p>
                                            )}
                                            {r._distKm != null && (
                                                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded-md font-medium">
                                                        📍 {r._distKm.toFixed(1)} km
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}

                                {/* 🆕 無結果提示 */}
                                {showNoResults && (
                                    <div className="px-4 py-4 text-center text-slate-500 text-sm">
                                        {t('map_no_results', { query })}
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
                                    {t('cancel')}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 📍 POI Detail Drawer */}
                <POIDetailDrawer
                    isOpen={poiDrawerOpen}
                    onClose={() => {
                        setPoiDrawerOpen(false)
                        setSearchResultMarker(null)
                    }}
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
