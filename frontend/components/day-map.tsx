"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Map, { Marker, Popup, Source, Layer, NavigationControl, AttributionControl } from "react-map-gl/maplibre"
import type { MapRef, LngLatBoundsLike } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { Bus, Car, Footprints, Satellite, Map as MapIcon } from "lucide-react"
import { MAP_STYLES } from "@/lib/constants"

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
    }, [markersKey, mode, optimize])

    return { route, routeInfo, loading }
}

interface DayMapProps {
    activities: Activity[]
}

export default function DayMap({ activities }: DayMapProps) {
    const mapRef = useRef<MapRef>(null)
    const [mode, setMode] = useState<'walk' | 'drive' | 'transit'>('walk')
    const [popupInfo, setPopupInfo] = useState<MarkerData | null>(null)
    const [mapLoaded, setMapLoaded] = useState(false)

    // 🆕 Terra-Cognita: 底圖模式 (標準/衛星)
    const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard')

    // 🆕 Zoom 等級顯示
    const [zoomLevel, setZoomLevel] = useState(13)

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
                    } catch (_e) {
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
                    'fill-extrusion-height': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15, 0,
                        15.05, ['get', 'render_height']
                    ],
                    'fill-extrusion-base': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15, 0,
                        15.05, ['get', 'render_min_height']
                    ],
                    'fill-extrusion-opacity': MAP_STYLES.BUILDING_3D.OPACITY
                }
            }, labelLayerId)
        }
    }, [])

    if (markers.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 h-48 w-full flex flex-col items-center justify-center text-slate-400">
                <div className="text-3xl mb-2">🗺️</div>
                <div className="text-sm font-bold">暫無地圖資料</div>
                <div className="text-xs mt-1">活動需要座標才能顯示路線圖</div>
                <div className="text-[10px] mt-2 text-slate-300">提示：編輯活動並搜尋地點以獲取座標</div>
            </div>
        )
    }

    const center = { longitude: markers[0].lng, latitude: markers[0].lat }

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

            {/* 地圖容器 */}
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm h-72 w-full z-0 relative">
                <Map
                    ref={mapRef}
                    initialViewState={{
                        longitude: center.longitude,
                        latitude: center.latitude,
                        zoom: 13
                    }}
                    style={{ width: "100%", height: "100%" }}
                    mapStyle={MAP_STYLES.VECTOR}
                    onLoad={handleMapLoad}
                    onZoom={(e) => setZoomLevel(Math.round(e.viewState.zoom * 10) / 10)}
                    attributionControl={false}
                >
                    <NavigationControl position="top-right" />
                    <AttributionControl
                        customAttribution="© OpenStreetMap · © OpenFreeMap · © Esri"
                        position="bottom-right"
                        compact={true}
                    />

                    {/* 🆕 Zoom 顯示器 */}
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-mono px-1.5 py-0.5 rounded z-10">
                        Z: {zoomLevel.toFixed(1)} {zoomLevel >= 15 && '🏢'}
                    </div>

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
        </div>
    )
}
