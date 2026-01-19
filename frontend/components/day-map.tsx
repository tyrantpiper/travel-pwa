"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Map, { Marker, Popup, Source, Layer, NavigationControl, AttributionControl } from "react-map-gl/maplibre"
import type { MapRef, LngLatBoundsLike } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { Bus, Car, Footprints, Satellite, Map as MapIcon, Search, X, Loader2, MapPin, Clock, Crosshair, Trash } from "lucide-react"
import { MAP_STYLES, MAP_LOCALIZATION } from "@/lib/constants"
import { Input } from "@/components/ui/input"
import { geocodeApi } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import POIDetailDrawer, { POIBasicData } from "@/components/POIDetailDrawer"
import { useLocalGeocode } from "@/hooks/useLocalGeocode"
import { useCityBias } from "@/hooks/useCityBias"

// Activity 類型定義
interface Activity {
    id?: string
    lat?: number
    lng?: number
    place?: string
    time?: string
    desc?: string
    category?: string
}

// Marker 必須有座標
interface MarkerData {
    id?: string
    lat: number
    lng: number
    place?: string
    time?: string
    desc?: string
    category?: string
    number: number
}

// 路線顏色對照
const routeColors = {
    walk: "#22c55e",    // 綠色 - 步行
    drive: "#3b82f6",   // 藍色 - 開車
    transit: "#f59e0b", // 橘色 - 大眾運輸
}

// API 基礎路徑
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// 搜尋結果類型
interface SearchResult {
    lat: number
    lng: number
    name: string
    address?: string
    type?: string
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

    // 🆕 清除歷史記錄
    const clearHistory = useCallback(() => {
        setHistory([])
        localStorage.removeItem(HISTORY_KEY)
    }, [])

    return { history, addToHistory, clearHistory }
}

// 路線規劃 Hook (使用後端 /api/route 代理)
function useRoute(markersKey: string, markers: MarkerData[], mode: string, optimize: boolean = false) {
    const [route, setRoute] = useState<GeoJSON.Feature | null>(null)
    const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; source?: string } | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (markers.length < 2) {
            setRoute(null)
            setRouteInfo(null)
            return
        }

        const fetchRoute = async () => {
            setLoading(true)

            // 取得有效 markers
            const stopsPayload = markers.map(m => ({ lat: m.lat, lng: m.lng, name: m.place }))

            // 驗證座標有效性
            const validStops = stopsPayload.filter(s =>
                s.lat && s.lng &&
                typeof s.lat === 'number' && typeof s.lng === 'number' &&
                s.lat !== 0 && s.lng !== 0
            )

            if (validStops.length < 2) {
                console.warn("⚠️ [Route Debug] 少於 2 個有效座標，跳過路線計算")
                setRoute(null)
                setRouteInfo(null)
                setLoading(false)
                return
            }

            // 🆕 檢測跨區域路線 (跨國/跨海) - 緯度差超過 5 度視為跨區域
            const lats = validStops.map(s => s.lat)
            const latSpan = Math.max(...lats) - Math.min(...lats)

            if (latSpan > 5) {
                console.warn("⚠️ [Route Debug] 跨區域路線 (緯度差:", latSpan.toFixed(2), "度)，使用直線連接")
                // 🆕 繪製直線連接所有點 (虛線表示非步行路線)
                const straightLineRoute: GeoJSON.Feature = {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "LineString",
                        coordinates: validStops.map(s => [s.lng, s.lat])
                    }
                }
                setRoute(straightLineRoute)
                setRouteInfo({
                    distance: "跨區域",
                    duration: "含航班",
                    source: "straight-line"
                })
                setLoading(false)
                return
            }

            try {
                const res = await fetch(`${API_BASE}/api/route`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        stops: validStops,  // 只傳送有效座標
                        mode,
                        optimize
                    })
                })

                if (!res.ok) {
                    const errorText = await res.text()
                    console.error("❌ [Route Debug] API Error:", res.status, errorText)
                    throw new Error(`Route API failed: ${res.status}`)
                }

                const data = await res.json()

                if (data.route) {
                    setRoute(data.route)
                    setRouteInfo({
                        distance: data.distance,
                        duration: data.duration,
                        source: data.source
                    })
                }
            } catch (e) {
                console.error("❌ [Route Debug] Fetch error:", e)
                // 故障安全：清除路線但不崩潰
                setRoute(null)
                setRouteInfo(null)
            } finally {
                setLoading(false)
            }
        }

        fetchRoute()
        // Note: Only use markersKey (stable string) as dependency, NOT markers array (recreated every render)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [markersKey, mode, optimize])

    return { route, routeInfo, loading }
}

interface DayMapProps {
    activities: Activity[]
    onAddPOI?: (poi: POIBasicData, time: string, notes?: string) => void
    dailyLoc?: { lat: number; lng: number; name?: string }  // 🆕 當日預設中心點
    tripTitle?: string  // 🆕 行程標題（用於智能搜尋）
}

export default function DayMap({ activities, onAddPOI, dailyLoc, tripTitle }: DayMapProps) {
    const mapRef = useRef<MapRef>(null)
    const [mode, setMode] = useState<'walk' | 'drive' | 'transit'>('walk')
    const [popupInfo, setPopupInfo] = useState<MarkerData | null>(null)
    const [mapLoaded, setMapLoaded] = useState(false)

    // 🆕 Terra-Cognita: 底圖模式 (標準/衛星)
    const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard')

    // 🆕 POI Detail Drawer 狀態
    // 🆕 POI Detail Drawer 狀態
    const [poiDrawerOpen, setPoiDrawerOpen] = useState(false)
    const [selectedPOI, setSelectedPOI] = useState<POIBasicData | null>(null)

    // 🔍 搜尋狀態
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [isSearchMinimized, setIsSearchMinimized] = useState(false)  // 🆕 最小化狀態
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<SearchResult[]>([])
    const [isTyping, setIsTyping] = useState(false)     // 🆕 輸入中（debounce 期間）
    const [isSearching, setIsSearching] = useState(false)
    const { history, addToHistory, clearHistory } = useSearchHistory()
    const inputRef = useRef<HTMLInputElement>(null)

    // 🆕 輸入變更處理（立即回饋）
    const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setQuery(value)
        if (value.length >= 2) {
            setIsTyping(true)
        } else {
            setIsTyping(false)
            setResults([])
        }
    }

    // 📍 自定義定位功能 (取代有 bug 的 GeolocateControl)
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [isLocating, setIsLocating] = useState(false)

    // 🆕 搜尋結果標記（紅色大頭針）
    const [searchResultMarker, setSearchResultMarker] = useState<{ lat: number; lng: number; name: string } | null>(null)


    const handleLocateMe = () => {
        if (!("geolocation" in navigator)) {
            alert("您的瀏覽器不支援定位功能")
            return
        }
        setIsLocating(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords
                setUserLocation({ lat: latitude, lng: longitude })
                setIsLocating(false)
                // 飛到用戶位置
                if (mapRef.current) {
                    mapRef.current.flyTo({
                        center: [longitude, latitude],
                        zoom: 15,
                        duration: 2000
                    })
                }
            },
            (error) => {
                setIsLocating(false)
                console.error("Geolocation error:", error)
                if (error.code === error.PERMISSION_DENIED) {
                    alert("定位權限被拒絕，請允許瀏覽器獲取您的位置")
                } else {
                    alert("無法獲取位置: " + error.message)
                }
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
        )
    }


    // 🏕️ Local Geocode Hook (L1 本地秒回)
    const { search: localSearch, isLoaded: localDataLoaded } = useLocalGeocode()

    // 🏙️ City Bias Hook (智能 Location Bias)
    const { findNearestCity } = useCityBias()

    // Debounced 搜尋 (L1 本地 + L2 API)
    useEffect(() => {
        if (!isSearchOpen || query.length < 2) {
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
                    .filter(r => r.lat && r.lng)  // 只取有座標的
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
                    console.log(`🏕️ L1 本地秒回: ${mapped.length} 筆結果`)
                    return  // 本地命中，不繼續 API
                }
            }
        }

        // 🌐 L2: API 搜尋 (300ms debounce)
        const timer = setTimeout(async () => {
            setIsTyping(false)    // debounce 結束
            setIsSearching(true)
            setResults([])  // Anti-flicker: clear old results before new search
            try {
                const center = mapRef.current?.getCenter()

                // 🏙️ 智能 Location Bias: 根據地圖中心找最近城市
                const nearestCity = center ? findNearestCity(center.lat, center.lng) : null

                const data = await geocodeApi.search({
                    query: currentQuery,
                    limit: 5,
                    tripTitle,
                    lat: nearestCity?.lat ?? center?.lat,
                    lng: nearestCity?.lng ?? center?.lng,
                    country: nearestCity?.country,
                    region: nearestCity?.region
                })
                // 🆕 只在 query 仍然匹配時更新
                if (currentQuery === query) {
                    setResults(data.results || [])
                }
            } catch {
                if (currentQuery === query) {
                    setResults([])
                }
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, isSearchOpen, tripTitle, localDataLoaded, localSearch])

    // 自動 focus
    useEffect(() => {
        if (isSearchOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [isSearchOpen])

    // 飛到指定位置
    const flyTo = useCallback((result: SearchResult) => {
        console.log("✈️ FlyTo triggered:", result)
        addToHistory(result)
        setQuery(result.name)
        setIsSearchOpen(false)

        if (!mapRef.current) {
            console.error("❌ Map ref is null")
            return
        }

        const lng = Number(result.lng)
        const lat = Number(result.lat)

        if (isNaN(lng) || isNaN(lat)) {
            console.error("❌ Invalid coordinates:", result)
            return
        }

        mapRef.current.flyTo({
            center: [lng, lat],
            zoom: 16,
            duration: 1500
        })

        // 🆕 設置搜尋結果標記（紅色大頭針）
        setSearchResultMarker({ lat, lng, name: result.name })

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

    // 過濾出有座標的地點
    const markers = activities
        .filter((a): a is Activity & { lat: number; lng: number } =>
            typeof a.lat === 'number' && typeof a.lng === 'number'
        )
        .map((a, index) => ({
            ...a,
            number: index + 1
        })) as MarkerData[]

    const markersKey = markers.map(m => `${m.lat},${m.lng}`).join('|')
    const { route, routeInfo, loading } = useRoute(markersKey, markers, mode)

    // 🆕 Terra-Cognita: 切換圖層可見性
    const updateLayerVisibility = useCallback((isSatellite: boolean) => {
        const map = mapRef.current?.getMap()
        if (!map || !map.isStyleLoaded()) return

        const layers = map.getStyle()?.layers || []

        layers.forEach(layer => {
            const layerId = layer.id.toLowerCase()

            // 衛星模式：隱藏背景類圖層
            if (MAP_STYLES.LAYERS_HIDE_ON_SATELLITE.some(hide => layerId.includes(hide))) {
                map.setLayoutProperty(layer.id, 'visibility', isSatellite ? 'none' : 'visible')
            }

            // 衛星模式：調整道路透明度
            if (MAP_STYLES.LAYERS_TRANSPARENT_ON_SATELLITE.some(road => layerId.includes(road))) {
                if (layer.type === 'line') {
                    try {
                        map.setPaintProperty(
                            layer.id,
                            'line-opacity',
                            isSatellite ? MAP_STYLES.ROAD_OPACITY_ON_SATELLITE : 1
                        )
                    } catch {
                        // 某些圖層可能不支援此屬性
                    }
                }
            }
        })

        // 切換衛星圖層可見性
        if (map.getLayer('satellite-layer')) {
            map.setLayoutProperty('satellite-layer', 'visibility', isSatellite ? 'visible' : 'none')
        }
    }, [])

    // 模式切換時更新圖層
    useEffect(() => {
        if (mapLoaded) {
            updateLayerVisibility(mapMode === 'satellite')
        }
    }, [mapMode, mapLoaded, updateLayerVisibility])

    // 自動縮放到所有點 (只在初次載入時執行)
    const hasInitialized = useRef(false)

    const fitBounds = useCallback(() => {
        if (markers.length === 0 || !mapRef.current || !mapLoaded) return
        if (hasInitialized.current) return  // 🆕 只執行一次

        hasInitialized.current = true

        if (markers.length === 1) {
            mapRef.current.flyTo({
                center: [markers[0].lng, markers[0].lat],
                zoom: 15
            })
            return
        }

        const lngs = markers.map(m => m.lng)
        const lats = markers.map(m => m.lat)
        const bounds: LngLatBoundsLike = [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)]
        ]

        mapRef.current.fitBounds(bounds, { padding: 60, duration: 500 })
    }, [markers, mapLoaded])

    useEffect(() => {
        const timer = setTimeout(fitBounds, 100)
        return () => clearTimeout(timer)
    }, [fitBounds])

    // 🆕 地圖載入後添加衛星圖層
    const handleMapLoad = useCallback(() => {
        setMapLoaded(true)

        const map = mapRef.current?.getMap()
        if (!map) return

        // 🆕 處理缺失的圖標（靜默替換為空圖片，避免 console 錯誤）
        map.on('styleimagemissing', (e) => {
            const id = e.id
            // 建立 1x1 透明圖片作為 fallback
            if (!map.hasImage(id)) {
                map.addImage(id, { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 0]) })
            }
        })

        // 添加 Esri 衛星 Source
        if (!map.getSource('satellite')) {
            map.addSource('satellite', {
                type: 'raster',
                tiles: [MAP_STYLES.SATELLITE],
                tileSize: 256,
                attribution: '© Esri'
            })
        }

        // 添加衛星圖層 (最底層，預設隱藏)
        if (!map.getLayer('satellite-layer')) {
            const firstLayerId = map.getStyle()?.layers?.[0]?.id
            map.addLayer({
                id: 'satellite-layer',
                type: 'raster',
                source: 'satellite',
                layout: { visibility: 'none' },
                paint: { 'raster-opacity': 1 }
            }, firstLayerId)
        }

        // 🆕 3D 建築層 (OpenMapTiles Schema)
        if (!map.getLayer('3d-buildings')) {
            // 找出文字標籤層的 ID (確保 3D 建築插在文字下面)
            const layers = map.getStyle()?.layers || []
            const labelLayerId = layers.find(
                (layer) => layer.type === 'symbol' && 'layout' in layer && layer.layout?.['text-field']
            )?.id

            map.addLayer({
                id: '3d-buildings',
                source: 'openmaptiles',
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: MAP_STYLES.BUILDING_3D.MIN_ZOOM,
                paint: {
                    'fill-extrusion-color': MAP_STYLES.BUILDING_3D.COLOR,
                    // 🆕 Terra-Cognita v3: PLOD Rendering (Progressive Level of Detail)
                    // Fix: Expected value to be of type number, but found null instead.
                    'fill-extrusion-height': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        MAP_STYLES.BUILDING_3D.MIN_ZOOM, 0,
                        MAP_STYLES.BUILDING_3D.MIN_ZOOM + 0.5, ['coalesce', ['get', 'render_height'], 0]
                    ],
                    'fill-extrusion-base': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        MAP_STYLES.BUILDING_3D.MIN_ZOOM, 0,
                        MAP_STYLES.BUILDING_3D.MIN_ZOOM + 0.5, ['coalesce', ['get', 'render_min_height'], 0]
                    ],
                    'fill-extrusion-opacity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        MAP_STYLES.BUILDING_3D.MIN_ZOOM, 0,
                        MAP_STYLES.BUILDING_3D.MIN_ZOOM + 0.5, MAP_STYLES.BUILDING_3D.OPACITY
                    ]
                }
            }, labelLayerId)
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
        console.log(`🌍 已將 ${chineseLayerCount} 個標籤圖層中文化`)

        // 🆕 POI 點擊事件 (Progressive Intelligence Layer 1)
        map.on('click', (e) => {
            // 查詢點擊位置的 POI 圖層
            const features = map.queryRenderedFeatures(e.point, {
                layers: map.getStyle()?.layers
                    ?.filter(l => l.id.includes('poi') || l.id.includes('label'))
                    .map(l => l.id) || []
            })

            if (features.length > 0) {
                const feature = features[0]
                const props = feature.properties || {}
                const coords = feature.geometry.type === 'Point'
                    ? (feature.geometry as GeoJSON.Point).coordinates
                    : [e.lngLat.lng, e.lngLat.lat]

                // 構建 POI 基礎資料
                // 🌍 中文名稱優先級
                const getName = () => {
                    for (const key of MAP_LOCALIZATION.CHINESE_NAME_KEYS) {
                        if (props[key]) return props[key]
                    }
                    return '未知地點'
                }

                const poiData: POIBasicData = {
                    name: getName(),
                    type: props.class || props.subclass || props.type || 'place',
                    lat: coords[1] as number,
                    lng: coords[0] as number,
                    address: props.address || props.addr_street,
                    phone: props.phone,
                    website: props.website,
                    opening_hours: props.opening_hours
                }

                setSelectedPOI(poiData)
                setPoiDrawerOpen(true)
            }
        })

        // 🆕 POI Hover 游標優化
        const poiLayers = map.getStyle()?.layers
            ?.filter(l => l.id.includes('poi') || l.id.includes('label'))
            .map(l => l.id) || []

        poiLayers.forEach(layerId => {
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer'
            })
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = ''
            })
        })
    }, [])

    // 🆕 即使沒有活動也顯示地圖 (優先順序: 活動 -> 當日地點 -> 台灣全景)
    const center = markers.length > 0
        ? { longitude: markers[0].lng, latitude: markers[0].lat }
        : dailyLoc
            ? { longitude: dailyLoc.lng, latitude: dailyLoc.lat }
            : { longitude: 120.9, latitude: 23.5 }  // 台灣中心點

    // 預設縮放等級：有活動時 zoom 13，無活動時 zoom 7 (顯示全台灣)
    const defaultZoom = markers.length > 0 || dailyLoc ? 13 : 7

    return (
        <div className="space-y-2">
            {/* 交通模式選擇器 + 底圖切換 */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                    <button
                        onClick={() => setMode('walk')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'walk' ? 'bg-white shadow text-green-600' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Footprints className="w-3.5 h-3.5" />
                        步行
                    </button>
                    <button
                        onClick={() => setMode('drive')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'drive' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Car className="w-3.5 h-3.5" />
                        開車
                    </button>
                    <button
                        onClick={() => setMode('transit')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'transit' ? 'bg-white shadow text-amber-600' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Bus className="w-3.5 h-3.5" />
                        大眾運輸
                    </button>
                </div>

                {/* 🆕 底圖切換按鈕 */}
                <div className="flex items-center gap-2">
                    {routeInfo && (
                        <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-500">📏 {routeInfo.distance}</span>
                            <span className="text-slate-500">⏱️ {routeInfo.duration}</span>
                            {loading && <span className="text-amber-500 animate-pulse">載入中...</span>}
                        </div>
                    )}
                    <button
                        onClick={() => setMapMode(m => m === 'standard' ? 'satellite' : 'standard')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${mapMode === 'satellite'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                            }`}
                        title={mapMode === 'satellite' ? '切換到標準地圖' : '切換到衛星圖'}
                    >
                        {mapMode === 'satellite' ? (
                            <><MapIcon className="w-3.5 h-3.5" /> 標準</>
                        ) : (
                            <><Satellite className="w-3.5 h-3.5" /> 衛星</>
                        )}
                    </button>
                </div>
            </div>

            {/* 地圖容器 - 全裝置統一加大 h-[480px]，防止捲動干擾 + 消除震動 */}
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm h-[480px] w-full z-0 relative touch-none overscroll-none">
                {/* 🔍 搜尋按鈕 (左下角) */}
                <button
                    onClick={() => setIsSearchOpen(true)}
                    className="absolute bottom-2 left-2 z-10 bg-white/90 backdrop-blur-md rounded-lg p-3 shadow-md hover:bg-white transition-all"
                    title="搜尋地點"
                >
                    <Search className="w-5 h-5 text-slate-600" />
                </button>

                {/* 🔍 搜尋 Overlay (底部展開) */}
                <AnimatePresence>
                    {isSearchOpen && (
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="absolute inset-x-0 bottom-0 z-20 bg-white rounded-t-2xl shadow-2xl flex flex-col"
                            style={{ height: isSearchMinimized ? "auto" : "85%" }}
                        >
                            {/* 🆕 拖曳手把 + 最小化切換 */}
                            <button
                                onClick={() => setIsSearchMinimized(!isSearchMinimized)}
                                className="w-full py-3 flex justify-center items-center gap-2 hover:bg-slate-100 transition-colors cursor-pointer group"
                                title={isSearchMinimized ? "展開搜尋結果" : "收起搜尋結果"}
                            >
                                <div className="w-12 h-1.5 bg-slate-300 rounded-full group-hover:bg-slate-400 transition-colors" />
                                <span className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                                    {isSearchMinimized ? "▲ 展開" : "▼ 收起"}
                                </span>
                            </button>
                            {/* 搜尋輸入區 */}
                            <div className="p-4 border-b shrink-0 flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <Input
                                        ref={inputRef}
                                        value={query}
                                        onChange={handleQueryChange}
                                        placeholder="搜尋地點..."
                                        className="h-9 pl-9 pr-8 text-base shadow-none border-slate-200 focus-visible:ring-1"
                                        onFocus={() => setIsSearchMinimized(false)}
                                    />
                                    {query && (
                                        <button
                                            onClick={() => {
                                                setQuery("")
                                                setIsTyping(false)
                                                setResults([])
                                            }}
                                            className="absolute right-2 top-2.5 text-slate-400"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={() => { setIsSearchOpen(false); setIsSearchMinimized(false); }}
                                    className="px-2 text-sm text-slate-500 font-medium"
                                >
                                    取消
                                </button>
                            </div>

                            {/* 結果列表 (可滾動，防止連鎖捲動) */}
                            {!isSearchMinimized && (
                                <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y">
                                    {/* 歷史 */}
                                    {query.length === 0 && history.length > 0 && (
                                        <>
                                            <div className="px-4 py-2 text-xs font-medium text-slate-400 uppercase bg-slate-50/50 flex justify-between items-center">
                                                <span>最近搜尋</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (confirm("確定要清除所有搜尋紀錄嗎？")) {
                                                            clearHistory()
                                                        }
                                                    }}
                                                    className="flex items-center gap-1 hover:text-red-500 transition-colors"
                                                    title="清除紀錄"
                                                >
                                                    <Trash className="w-3 h-3" />
                                                    <span>清除</span>
                                                </button>
                                            </div>
                                            {history.map((h, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => flyTo(h)}
                                                    className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50"
                                                >
                                                    <Clock className="w-4 h-4 text-slate-400" />
                                                    <span className="text-sm line-clamp-1">{h.name}</span>
                                                </button>
                                            ))}
                                        </>
                                    )}

                                    {/* 🆕 輸入中（debounce 期間）- 淡色提示 */}
                                    {isTyping && !isSearching && (
                                        <div className="px-4 py-4 flex items-center gap-2 text-slate-400">
                                            <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-pulse" />
                                            <span className="text-sm">等待輸入完成...</span>
                                        </div>
                                    )}

                                    {/* 搜尋中（API 調用中）- Loading */}
                                    {isSearching && (
                                        <div className="px-4 py-6 flex items-center justify-center gap-2 text-indigo-500">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-sm">搜尋中...</span>
                                        </div>
                                    )}

                                    {/* 🆕 統一搜尋完成狀態 */}
                                    {(() => {
                                        const searchDone = query.length >= 2 && !isTyping && !isSearching
                                        const hasResults = results.length > 0
                                        const noResults = results.length === 0

                                        return (
                                            <>
                                                {/* 結果 */}
                                                {searchDone && hasResults && results.map((r, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => flyTo(r)}
                                                        className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-start gap-3 border-b border-slate-50"
                                                    >
                                                        <MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-medium truncate">{r.name}</div>
                                                            {r.address && <div className="text-xs text-slate-500 truncate">{r.address}</div>}
                                                        </div>
                                                    </button>
                                                ))}

                                                {/* 無結果提示 */}
                                                {searchDone && noResults && (
                                                    <div className="px-4 py-4 text-center text-slate-500 text-sm">
                                                        找不到「{query}」的結果
                                                    </div>
                                                )}

                                                {/* AI 選項 - 暫時隱藏，保留程式碼供未來開發 */}
                                                {/* {searchDone && (
                                                    <button
                                                        onClick={handleAISearch}
                                                        disabled={aiSearching}
                                                        className="w-full px-4 py-4 text-left hover:bg-purple-50 flex items-center gap-3 text-sm border-t border-slate-100"
                                                    >
                                                        {aiSearching ? (
                                                            <>
                                                                <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                                                                <span className="text-purple-600">正在詢問 AI...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles className="w-4 h-4 text-purple-500" />
                                                                <span className="text-purple-600 font-medium">✨ 使用 AI 搜尋「{query}」</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )} */}
                                            </>
                                        )
                                    })()}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
                <Map
                    ref={mapRef}
                    reuseMaps={true}
                    initialViewState={{
                        longitude: center.longitude,
                        latitude: center.latitude,
                        zoom: defaultZoom
                    }}
                    style={{ width: "100%", height: "100%" }}
                    mapStyle={MAP_STYLES.VECTOR}
                    onLoad={handleMapLoad}
                    attributionControl={false}
                    minZoom={3}
                    maxZoom={20}
                >
                    {/* 📍 自定義定位按鈕 (取代有 bug 的 GeolocateControl) */}
                    <button
                        onClick={handleLocateMe}
                        disabled={isLocating}
                        className="absolute top-28 right-2 z-10 p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 disabled:opacity-50 transition-all"
                        title="定位我的位置"
                    >
                        {isLocating ? (
                            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        ) : (
                            <Crosshair className="w-5 h-5 text-gray-600" />
                        )}
                    </button>
                    <NavigationControl position="top-right" showCompass={true} />
                    <AttributionControl
                        customAttribution="© OpenStreetMap · © OpenFreeMap · © Esri"
                        position="bottom-right"
                        compact={true}
                    />

                    {/* 📍 用戶位置藍點標記 */}
                    {userLocation && (
                        <Marker
                            longitude={userLocation.lng}
                            latitude={userLocation.lat}
                            anchor="center"
                        >
                            <div className="relative">
                                {/* 外層脈動圓 */}
                                <div className="absolute -inset-3 bg-blue-400/30 rounded-full animate-ping" />
                                {/* 藍點 */}
                                <div className="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg" />
                            </div>
                        </Marker>
                    )}

                    {/* 路線繪製 */}
                    {route && (
                        <Source id="route" type="geojson" data={route}>
                            <Layer
                                id="route-line"
                                type="line"
                                paint={{
                                    "line-color": routeInfo?.source === 'straight-line' ? '#94a3b8' : routeColors[mode],
                                    "line-width": routeInfo?.source === 'straight-line' ? 3 : 5,
                                    "line-opacity": routeInfo?.source === 'straight-line' ? 0.6 : 0.8,
                                    "line-dasharray": routeInfo?.source === 'straight-line' || mode === 'transit' ? [2, 2] : [1, 0]
                                }}
                            />
                        </Source>
                    )}

                    {/* 標記點 */}
                    {markers.map((m, idx) => {
                        const isFirst = idx === 0
                        const isLast = idx === markers.length - 1
                        const color = isFirst ? "#22c55e" : isLast ? "#ef4444" : "#0f172a"

                        return (
                            <Marker
                                key={m.id || `marker-${idx}`}
                                longitude={m.lng}
                                latitude={m.lat}
                                anchor="center"
                                onClick={(e) => {
                                    e.originalEvent.stopPropagation()
                                    setPopupInfo(m)
                                }}
                            >
                                <div
                                    style={{
                                        backgroundColor: color,
                                        color: "white",
                                        width: 28,
                                        height: 28,
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontWeight: "bold",
                                        border: "3px solid white",
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                                        fontSize: 12,
                                        cursor: "pointer"
                                    }}
                                >
                                    {m.number}
                                </div>
                            </Marker>
                        )
                    })}

                    {/* 🆕 搜尋結果標記（紅色大頭針） */}
                    {searchResultMarker && (
                        <Marker
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


                    {/* 彈出視窗 */}
                    {popupInfo && (
                        <Popup
                            longitude={popupInfo.lng}
                            latitude={popupInfo.lat}
                            anchor="bottom"
                            onClose={() => setPopupInfo(null)}
                            closeOnClick={false}
                        >
                            <div className="min-w-[150px] p-1">
                                <div className="font-bold text-sm">{popupInfo.number}. {popupInfo.place}</div>
                                {popupInfo.time && <div className="text-xs text-slate-500 mt-1">🕐 {popupInfo.time}</div>}
                                {popupInfo.desc && <div className="text-xs text-slate-600 mt-1">{popupInfo.desc}</div>}
                                <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${popupInfo.lat},${popupInfo.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block mt-2 text-xs text-blue-500 hover:underline"
                                >
                                    📍 在 Google Maps 開啟導航
                                </a>
                            </div>
                        </Popup>
                    )}
                </Map>
            </div>

            {/* 圖例 */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> 起點</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-800"></span> 途經</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> 終點</span>
                {mapMode === 'satellite' && <span className="flex items-center gap-1">🛰️ 衛星模式</span>}
            </div>



            {/* 🆕 POI Detail Drawer (Progressive Intelligence) */}
            <POIDetailDrawer
                isOpen={poiDrawerOpen}
                onClose={() => setPoiDrawerOpen(false)}
                poi={selectedPOI}
                suggestedTime={(() => {
                    // 智慧時間計算：最後活動 +1.5 小時
                    if (activities.length > 0) {
                        const lastActivity = activities[activities.length - 1]
                        if (lastActivity.time) {
                            const [h, m] = lastActivity.time.split(":").map(Number)
                            const totalMinutes = h * 60 + m + 90
                            const newH = Math.min(23, Math.floor(totalMinutes / 60))
                            const newM = totalMinutes % 60
                            return `${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}`
                        }
                    }
                    return "10:00"
                })()}
                onAddToItinerary={(poi, time, aiSummary) => {
                    // 調用父層 callback
                    if (onAddPOI) {
                        const notes = aiSummary
                            ? `${aiSummary.summary}\n必點: ${aiSummary.must_try?.join(', ') || ''}`
                            : undefined
                        onAddPOI(poi, time, notes)
                    } else {
                        console.log('📍 Add to itinerary:', poi, time)
                        if (aiSummary) {
                            console.log('🧠 AI Summary:', aiSummary)
                        }
                    }
                    // 🆕 清除搜尋標記
                    setSearchResultMarker(null)
                }}
            />
        </div>
    )
}
