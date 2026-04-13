"use client"

// TODO: MLT (MapLibre Tile) upgrade path
// When OpenFreeMap/Protomaps releases MLT tiles:
// 1. Change source encoding: { type: "vector", encoding: "mlt", url: "..." }
// 2. Expected: 6x smaller tiles, 2-3x faster render
// See: https://maplibre.org/news/2026-01-23-mlt-release/

import { useEffect, useState, useRef, useCallback } from "react"
import Map, { Marker, Popup, Source, Layer, NavigationControl, AttributionControl } from "react-map-gl/maplibre"
import type { MapRef, LngLatBoundsLike, MapLayerMouseEvent } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { Bus, Car, Footprints, Satellite, Map as MapIcon, Search, X, Loader2, MapPin, Clock, Crosshair, Trash } from "lucide-react"
import { MAP_STYLES, MAP_LOCALIZATION } from "@/lib/constants"
import { Input } from "@/components/ui/input"
import { geocodeApi } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import POIDetailDrawer, { POIBasicData } from "@/components/POIDetailDrawer"
import { useLocalGeocode } from "@/hooks/useLocalGeocode"
import { useCityBias } from "@/hooks/useCityBias"
import { cn } from "@/lib/utils"
import { debugLog, debugWarn } from "@/lib/debug"
import { useLanguage } from "@/lib/LanguageContext"
import { SearchResult } from "@/lib/itinerary-types"
import { getDistanceKm } from "@/lib/location-utils"

// Activity 類型定義
interface Activity {
    id?: string
    lat?: number
    lng?: number
    place?: string
    time?: string
    time_slot?: string
    desc?: string
    category?: string
    memo?: string
    notes?: string
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
    memo?: string
    notes?: string
}

// 路線顏色對照
const routeColors = {
    walk: "#22c55e",    // 綠色 - 步行
    drive: "#3b82f6",   // 藍色 - 開車
    transit: "#f59e0b", // 橘色 - 大眾運輸
}

// API 基礎路徑
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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
    const { t } = useLanguage()
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
                debugWarn("⚠️ [Route Debug] 少於 2 個有效座標，跳過路線計算")
                setRoute(null)
                setRouteInfo(null)
                setLoading(false)
                return
            }

            // 🆕 檢測跨區域路線 (跨國/跨海) - 緯度差超過 5 度視為跨區域
            const lats = validStops.map(s => s.lat)
            const latSpan = Math.max(...lats) - Math.min(...lats)

            if (latSpan > 5) {
                debugWarn("⚠️ [Route Debug] 跨區域路線 (緯度差:", latSpan.toFixed(2), "度)，使用直線連接")
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
                    distance: t('map_cross_region'),
                    duration: t('map_includes_flight'),
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
    const { t } = useLanguage()
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
    const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isMoveDetectedRef = useRef(false)

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
                    toast.error(t('map_geolocation_denied'))
                } else {
                    toast.error(t('map_geolocation_failed') + error.message)
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
                    debugLog(`🏕️ L1 本地秒回: ${mapped.length} 筆結果`)
                    // 🆕 不再 return，讓 L2 仍可補充結果
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
                    const rawResults = data.results || []

                    setResults(prev => {
                        const combined = [...prev]
                        for (const r of rawResults) {
                            const isDup = combined.some(existing =>
                                // 🆕 優先用 osm_id 精準去重，無 osm_id 才用 50m 座標
                                (r.osm_id && existing.osm_id && String(r.osm_id) === String(existing.osm_id)) ||
                                (getDistanceKm(existing.lat ?? 0, existing.lng ?? 0, r.lat ?? 0, r.lng ?? 0) < 0.05)
                            )
                            if (!isDup) combined.push(r)
                        }

                        // 🆕 加入距離計算與排序 (優先以用戶位置排序，若無則按地圖中心)
                        const center = mapRef.current?.getCenter()
                        const targetLat = userLocation?.lat ?? center?.lat ?? dailyLoc?.lat ?? 0
                        const targetLng = userLocation?.lng ?? center?.lng ?? dailyLoc?.lng ?? 0

                        const withDistance = combined.map(r => ({
                            ...r,
                            _distKm: getDistanceKm(targetLat, targetLng, r.lat, r.lng)
                        }))

                        return withDistance.sort((a, b) => (a._distKm ?? 999) - (b._distKm ?? 999))
                    })
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
        debugLog("✈️ FlyTo triggered:", result)
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

    // 🆕 2026 Sequential Index Lock + Geometric Identity Clustering
    // 算法描述：
    // 1. 遍歷活動計算順序數字 (displayCounter)
    // 2. 使用 ε-Logic (精度 0.0001, 約 11公尺) 進行地理群聚
    const allMarkers: MarkerData[] = []
    let displayCounter = 0

    activities.forEach((a) => {
        const isHeader = a.category === 'header' || (a.time || "00:00") === '00:00' || a.time_slot === '00:00'
        if (!isHeader) {
            displayCounter++
            if (typeof a.lat === 'number' && typeof a.lng === 'number') {
                allMarkers.push({
                    ...a,
                    lat: a.lat,
                    lng: a.lng,
                    number: displayCounter
                })
            }
        }
    })

    // 🧠 ε-Clustering: 將極近距離的點歸類至同一個 Cluster
    const groupedMarkers: { [key: string]: MarkerData[] } = {}
    allMarkers.forEach(m => {
        // 使用 4 位小數位作為 Key (~11m 精度)
        const clusterKey = `${m.lat.toFixed(4)},${m.lng.toFixed(4)}`
        if (!groupedMarkers[clusterKey]) groupedMarkers[clusterKey] = []
        groupedMarkers[clusterKey].push(m)
    })

    // 將分群結果轉回陣列供渲染
    const clusters = Object.values(groupedMarkers)

    // 用於圖資管線的 Markers (維持原本邏輯，確保路線不斷裂)
    const markers = allMarkers

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
        debugLog(`🌍 已將 ${chineseLayerCount} 個標籤圖層中文化`)

        // 🆕 POI Hover 游標優化 (移至 onLoad)
        const updateCursor = () => {
            const currentMap = mapRef.current?.getMap()
            if (!currentMap) return
            const poiLayers = currentMap.getStyle()?.layers
                ?.filter(l => l.id.includes('poi') || l.id.includes('label'))
                .map(l => l.id) || []

            poiLayers.forEach(layerId => {
                currentMap.on('mouseenter', layerId, () => {
                    currentMap.getCanvas().style.cursor = 'pointer'
                })
                currentMap.on('mouseleave', layerId, () => {
                    currentMap.getCanvas().style.cursor = ''
                })
            })
        }
        updateCursor()
    }, [])

    // 🆕 2026 Logic: 統一地圖點擊處理 (Base Map POIs)
    const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
        const map = mapRef.current?.getMap()
        if (!map) return

        // 查詢點擊位置的 POI (使用 5px 緩衝區增加命中率)
        const bbox: [[number, number], [number, number]] = [
            [e.point.x - 5, e.point.y - 5],
            [e.point.x + 5, e.point.y + 5]
        ]

        const features = map.queryRenderedFeatures(bbox, {
            layers: map.getStyle()?.layers
                ?.filter(l => l.type === 'symbol' && l.layout?.['text-field'])
                .map(l => l.id) || []
        })

        if (features && features.length > 0) {
            const feature = features[0]
            const props = feature.properties || {}
            const coords = feature.geometry.type === 'Point'
                ? (feature.geometry as GeoJSON.Point).coordinates
                : [e.lngLat.lng, e.lngLat.lat]

            const getName = () => {
                for (const key of MAP_LOCALIZATION.CHINESE_NAME_KEYS) {
                    if (props[key]) return props[key]
                }
                return props.name || t('map_location_point')
            }

            const poiData: POIBasicData = {
                name: getName(),
                type: props.class || props.subclass || props.type || 'place',
                lat: coords[1],
                lng: coords[0],
                address: props.address || props.addr_street || props['addr:full'],
                phone: props.phone || props['contact:phone'],
                website: props.website || props['contact:website'],
                opening_hours: props.opening_hours
            }

            // 🆕 設置標記點（紅色大頭針）- 達成點選即出現大頭針需求
            setSearchResultMarker({ lat: poiData.lat, lng: poiData.lng, name: poiData.name })

            setSelectedPOI(poiData)
            setPoiDrawerOpen(true)
        }
    }, [t])

    // 🆕 2026 Logic: 處理地圖長按 (任意取點)
    const handleMapLongPress = useCallback((e: MapLayerMouseEvent) => {
        const { lng, lat } = e.lngLat

        const poiData: POIBasicData = {
            name: t('map_location_point'),
            type: 'place',
            lat: lat,
            lng: lng,
        }

        debugLog("📍 Long press at:", { lat, lng })

        // 設置標記點（紅色大頭針）
        setSearchResultMarker({ lat, lng, name: poiData.name })

        setSelectedPOI(poiData)
        setPoiDrawerOpen(true)
    }, [t])

    // 🆕 跨設備長按偵測 (手機/平板/電腦)
    const handlePointerStart = useCallback((e: MapLayerMouseEvent) => {
        // 僅限單指觸控或滑鼠左鍵
        const isTouchEvent = 'touches' in e.originalEvent
        if (isTouchEvent && (e.originalEvent as unknown as TouchEvent).touches?.length > 1) return

        const { x, y } = e.point
        touchStartPosRef.current = { x, y }
        isMoveDetectedRef.current = false

        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)

        longPressTimerRef.current = setTimeout(() => {
            handleMapLongPress(e)
            longPressTimerRef.current = null
        }, 500)
    }, [handleMapLongPress])

    const handlePointerMove = useCallback((e: MapLayerMouseEvent) => {
        if (!touchStartPosRef.current) return

        const { x, y } = e.point
        const dist = Math.sqrt(
            Math.pow(x - touchStartPosRef.current.x, 2) +
            Math.pow(y - touchStartPosRef.current.y, 2)
        )

        // 🆕 2026 修復：若移動超過 5 像素，判定為平移並鎖定狀態，取消長按計時
        if (dist > 5) {
            isMoveDetectedRef.current = true
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current)
                longPressTimerRef.current = null
            }
        }
    }, [])

    const handlePointerEnd = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
        }
        touchStartPosRef.current = null
    }, [])

    // 🆕 2026 修復：監聽地圖原生移動事件，一旦開始平移則鎖定狀態並取消計時
    const handleMapMoveStart = useCallback(() => {
        isMoveDetectedRef.current = true
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
        }
    }, [])

    // 🆕 卸載時清理定時器
    useEffect(() => {
        return () => {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
        }
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
                        {t('map_walk')}
                    </button>
                    <button
                        onClick={() => setMode('drive')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'drive' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Car className="w-3.5 h-3.5" />
                        {t('map_drive')}
                    </button>
                    <button
                        onClick={() => setMode('transit')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'transit' ? 'bg-white shadow text-amber-600' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Bus className="w-3.5 h-3.5" />
                        {t('map_transit')}
                    </button>
                </div>

                {/* 🆕 底圖切換按鈕 */}
                <div className="flex items-center gap-2">
                    {routeInfo && (
                        <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-500">📏 {routeInfo.distance}</span>
                            <span className="text-slate-500">⏱️ {routeInfo.duration}</span>
                            {loading && <span className="text-amber-500 animate-pulse">{t('map_loading')}</span>}
                        </div>
                    )}
                    <button
                        onClick={() => setMapMode(m => m === 'standard' ? 'satellite' : 'standard')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${mapMode === 'satellite'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                            }`}
                        title={mapMode === 'satellite' ? t('map_switch_standard') : t('map_switch_satellite')}
                    >
                        {mapMode === 'satellite' ? (
                            <><MapIcon className="w-3.5 h-3.5" /> {t('map_standard')}</>
                        ) : (
                            <><Satellite className="w-3.5 h-3.5" /> {t('map_satellite')}</>
                        )}
                    </button>
                </div>
            </div>

            {/* 地圖容器 - 全裝置統一加大 h-[480px]，防止捲動干擾 + 消除震動 */}
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm h-[480px] w-full z-0 relative overscroll-none">
                {/* 🔍 搜尋按鈕 (左下角) */}
                <button
                    onClick={() => setIsSearchOpen(true)}
                    className="absolute bottom-2 left-2 z-10 bg-white/90 backdrop-blur-md rounded-lg p-3 shadow-md hover:bg-white transition-all"
                    title={t('map_search')}
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
                                title={isSearchMinimized ? t('map_expand_search') : t('map_collapse_search')}
                            >
                                <div className="w-12 h-1.5 bg-slate-300 rounded-full group-hover:bg-slate-400 transition-colors" />
                                <span className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                                    {isSearchMinimized ? t('map_expand') : t('map_collapse')}
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
                                        placeholder={t('map_search_placeholder')}
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
                                    {t('cancel')}
                                </button>
                            </div>

                            {/* 結果列表 (可滾動，防止連鎖捲動) */}
                            {!isSearchMinimized && (
                                <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y">
                                    {/* 歷史 */}
                                    {query.length === 0 && history.length > 0 && (
                                        <>
                                            <div className="px-4 py-2 text-xs font-medium text-slate-400 uppercase bg-slate-50/50 flex justify-between items-center">
                                                <span>{t('map_recent_search')}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (confirm(t('map_clear_confirm'))) {
                                                            clearHistory()
                                                        }
                                                    }}
                                                    className="flex items-center gap-1 hover:text-red-500 transition-colors"
                                                    title={t('map_clear')}
                                                >
                                                    <Trash className="w-3 h-3" />
                                                    <span>{t('map_clear')}</span>
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
                                            <span className="text-sm">{t('map_enter_query')}</span>
                                        </div>
                                    )}

                                    {/* 搜尋中（API 調用中）- Loading */}
                                    {isSearching && (
                                        <div className="px-4 py-6 flex items-center justify-center gap-2 text-indigo-500">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-sm">{t('map_searching')}</span>
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

                                                {/* 無結果提示 */}
                                                {searchDone && noResults && (
                                                    <div className="px-4 py-4 text-center text-slate-500 text-sm">
                                                        {t('map_no_results', { query })}
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
                    onMoveStart={handleMapMoveStart}
                    onMouseDown={handlePointerStart}
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerEnd}
                    onClick={(e) => {
                        // 防止點擊 UI 時觸發地圖點擊
                        if ((e.originalEvent.target as HTMLElement).closest('button')) return
                        handleMapClick(e)
                    }}
                    onContextMenu={(e) => {
                        // 🆕 2026 修復：僅在非觸控移動時允許觸發長按邏輯
                        e.originalEvent.preventDefault()
                        if (!isMoveDetectedRef.current) {
                            handleMapLongPress(e)
                        }
                    }}
                    attributionControl={false}
                    minZoom={3}
                    maxZoom={20}
                >
                    {/* 📍 自定義定位按鈕 (取代有 bug 的 GeolocateControl) */}
                    <button
                        onClick={handleLocateMe}
                        disabled={isLocating}
                        className="absolute top-28 right-2 z-10 p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 disabled:opacity-50 transition-all"
                        title={t('map_my_location')}
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

                    {/* 🆕 2026 Stacked Deck Rendering Engine */}
                    {clusters.map((cluster, cIdx) => {
                        const isCluster = cluster.length > 1
                        const m = cluster[0] // 主標記
                        const isFirst = allMarkers.findIndex(am => am.id === m.id) === 0
                        const isLast = allMarkers.findIndex(am => am.id === m.id) === allMarkers.length - 1
                        const color = isCluster ? "#6366f1" : (isFirst ? "#22c55e" : isLast ? "#ef4444" : "#0f172a")

                        return (
                            <Marker
                                key={`cluster-${cIdx}-${m.id || cIdx}`}
                                longitude={m.lng}
                                latitude={m.lat}
                                anchor="bottom"
                                onClick={(e) => {
                                    e.originalEvent.stopPropagation()
                                    if (isCluster) {
                                        setSelectedPOI({
                                            name: t('map_cluster', { count: String(cluster.length) }),
                                            type: "cluster",
                                            lat: m.lat,
                                            lng: m.lng,
                                            address: cluster.map(item => `[${item.number}] ${item.place}`).join(' | '),
                                            // @ts-expect-error: Custom property for Clustering
                                            clusterItems: cluster
                                        })
                                        setPoiDrawerOpen(true)
                                    } else {
                                        setPopupInfo(m)
                                    }
                                }}
                            >
                                <div className="flex flex-col items-center group cursor-pointer relative">
                                    <AnimatePresence>
                                        {m.place && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5, scale: 0.9 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                className="mb-1.5 px-2 py-0.5 bg-white/85 dark:bg-slate-900/90 backdrop-blur-md border border-white/60 dark:border-slate-800 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.1)] pointer-events-none z-20"
                                            >
                                                <span className="text-[10px] font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap block max-w-[120px] truncate">
                                                    {m.place} {isCluster && <span className="text-indigo-500 ml-1">(+{cluster.length - 1})</span>}
                                                </span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* 📍 IDENTITY PIN(S) */}
                                    <div className="relative h-7 w-7 flex items-center justify-center">
                                        {/* 🎨 [BACK] Stack Layers Visual Effect */}
                                        {isCluster && (
                                            <>
                                                <div className="absolute top-[-3px] left-[3px] w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-slate-800 opacity-60 scale-95" />
                                                <div className="absolute top-[-1.5px] left-[1.5px] w-6 h-6 rounded-full bg-slate-400 dark:bg-slate-600 border-2 border-white dark:border-slate-800 opacity-80" />
                                            </>
                                        )}

                                        {/* 📍 [FRONT] Main Numeric Identity Pin */}
                                        <div
                                            className={cn(
                                                "relative z-10 transition-all duration-300",
                                                "group-hover:scale-125 group-hover:-translate-y-1 active:scale-95 shadow-xl",
                                                isCluster ? "ring-2 ring-indigo-500/30 rounded-full" : ""
                                            )}
                                            style={{
                                                backgroundColor: color,
                                                color: "white",
                                                width: 26,
                                                height: 26,
                                                borderRadius: "50%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: "black",
                                                border: "2.5px solid white",
                                                boxShadow: isCluster ? "0 4px 15px rgba(99, 102, 241, 0.4)" : "0 4px 12px rgba(0,0,0,0.25)",
                                                fontSize: 11,
                                            }}
                                        >
                                            {isCluster ? `${m.number}..` : m.number}
                                            {/* Pin Pointer */}
                                            <div
                                                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0"
                                                style={{
                                                    borderLeft: '4px solid transparent',
                                                    borderRight: '4px solid transparent',
                                                    borderTop: `6px solid ${color}`,
                                                }}
                                            />
                                        </div>
                                    </div>
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
                                    📍 {t('map_open_gmaps_nav')}
                                </a>

                                {/* 🆕 2026 Bridge: See More (Open Detail Drawer) */}
                                <button
                                    onClick={() => {
                                        const marker = popupInfo
                                        setSelectedPOI({
                                            name: marker.place || t('map_current_point'),
                                            type: marker.category || 'sightseeing',
                                            lat: marker.lat,
                                            lng: marker.lng,
                                            address: marker.desc || marker.memo,
                                            number: marker.number
                                        })
                                        setPoiDrawerOpen(true)
                                        setPopupInfo(null) // 關閉 Popup
                                    }}
                                    className="w-full mt-3 py-2 px-3 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-100 transition-colors border border-indigo-100/50"
                                >
                                    <span>✨ {t('map_view_more')}</span>
                                </button>
                            </div>
                        </Popup>
                    )}
                </Map>

                {/* 🆕 POI Detail Drawer (Moved INSIDE container for Local Containment) */}
                <POIDetailDrawer
                    isOpen={poiDrawerOpen}
                    onClose={() => {
                        setPoiDrawerOpen(false)
                        setSearchResultMarker(null)
                    }}
                    poi={selectedPOI}
                    isInternal={true}
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
                        if (onAddPOI) {
                            const notes = aiSummary
                                ? `${aiSummary.summary}\n必點: ${aiSummary.must_try?.join(', ') || ''}`
                                : undefined
                            onAddPOI(poi, time, notes)
                        }
                        setSearchResultMarker(null)
                    }}
                    onSelectClusterItem={(item) => {
                        // 🧠 點擊群聚項目：聚焦地圖並顯示單點細節
                        mapRef.current?.flyTo({
                            center: [item.lng, item.lat],
                            zoom: 17,
                            duration: 1200
                        })

                        setSelectedPOI({
                            name: item.place,
                            type: item.category || 'sightseeing',
                            lat: item.lat,
                            lng: item.lng,
                            address: item.desc || item.notes,
                            number: item.number
                        })
                        // 注意：這裡不關閉 Drawer，而是切換它進入單點顯示模式 (POIDetailDrawer 內部會自動切換，因為 poi.type 不再是 'cluster')
                    }}
                />
            </div>
        </div >
    )
}
