"use client"

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useEffect, useState } from "react"
import { Bus, Car, Footprints } from "lucide-react"

// 自訂標記 Icon
const createNumberedIcon = (number: number, color = "#0f172a") => {
    return L.divIcon({
        className: "custom-marker",
        html: `<div style="background-color: ${color}; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 12px;">${number}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    })
}

// 自動縮放地圖以涵蓋所有點
function FitBounds({ markers }: { markers: any[] }) {
    const map = useMap()
    useEffect(() => {
        if (markers.length > 0) {
            const group = new L.FeatureGroup(markers.map((m) => L.marker([m.lat, m.lng])))
            map.fitBounds(group.getBounds().pad(0.15))
        }
    }, [markers, map])
    return null
}

// 路線規劃 Hook
function useRoute(markersKey: string, markers: any[], mode: string) {
    const [route, setRoute] = useState<[number, number][]>([])
    const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (markers.length < 2) {
            setRoute([])
            setRouteInfo(null)
            return
        }

        const fetchRoute = async () => {
            setLoading(true)
            try {
                // 建立座標字串 (OSRM 格式: lng,lat;lng,lat;...)
                const coords = markers.map(m => `${m.lng},${m.lat}`).join(';')

                // OSRM profile: foot (步行), car (開車), bike (腳踏車)
                const profile = mode === 'walk' ? 'foot' : mode === 'drive' ? 'car' : 'foot'

                const res = await fetch(
                    `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`
                )
                const data = await res.json()

                if (data.routes && data.routes.length > 0) {
                    const geometry = data.routes[0].geometry.coordinates
                    // GeoJSON 座標是 [lng, lat]，需要轉換為 [lat, lng]
                    setRoute(geometry.map((c: number[]) => [c[1], c[0]] as [number, number]))

                    // 計算時間和距離
                    const distanceKm = (data.routes[0].distance / 1000).toFixed(1)
                    const durationMin = Math.round(data.routes[0].duration / 60)
                    setRouteInfo({
                        distance: `${distanceKm} km`,
                        duration: durationMin < 60 ? `${durationMin} 分鐘` : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
                    })
                }
            } catch (e) {
                console.error("Route fetch error:", e)
            } finally {
                setLoading(false)
            }
        }

        fetchRoute()
    }, [markersKey, mode]) // 使用穩定的 markersKey 而非 markers 陣列

    return { route, routeInfo, loading }
}

// 路線顏色對照
const routeColors = {
    walk: "#22c55e",    // 綠色 - 步行
    drive: "#3b82f6",   // 藍色 - 開車
    transit: "#f59e0b", // 橘色 - 大眾運輸
}

interface DayMapProps {
    activities: any[]
}

export default function DayMap({ activities }: DayMapProps) {
    const [mode, setMode] = useState<'walk' | 'drive' | 'transit'>('walk')

    // 過濾出有座標的地點
    const markers = activities
        .filter(a => a.lat && a.lng)
        .map((a, index) => ({
            ...a,
            number: index + 1
        }))

    // 建立穩定的 key 避免 useEffect 無限觸發
    const markersKey = markers.map(m => `${m.lat},${m.lng}`).join('|')

    const { route, routeInfo, loading } = useRoute(markersKey, markers, mode)

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

    const center = [markers[0].lat, markers[0].lng] as [number, number]

    return (
        <div className="space-y-2">
            {/* 交通模式選擇器 */}
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

                {/* 路線資訊 */}
                {routeInfo && (
                    <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-500">📏 {routeInfo.distance}</span>
                        <span className="text-slate-500">⏱️ {routeInfo.duration}</span>
                        {loading && <span className="text-amber-500 animate-pulse">載入中...</span>}
                    </div>
                )}
            </div>

            {/* 地圖容器 */}
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm h-72 w-full z-0 relative">
                <MapContainer center={center} zoom={13} scrollWheelZoom={true} className="h-full w-full">
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    />

                    {/* 路線繪製 */}
                    {route.length > 0 && (
                        <Polyline
                            positions={route}
                            pathOptions={{
                                color: routeColors[mode],
                                weight: 5,
                                opacity: 0.8,
                                dashArray: mode === 'transit' ? '10, 10' : undefined,
                            }}
                        />
                    )}

                    {/* 標記點 */}
                    {markers.map((m, idx) => {
                        const isFirst = idx === 0
                        const isLast = idx === markers.length - 1
                        const color = isFirst ? "#22c55e" : isLast ? "#ef4444" : "#0f172a"

                        return (
                            <Marker key={m.id || m.place} position={[m.lat, m.lng]} icon={createNumberedIcon(m.number, color)}>
                                <Popup>
                                    <div className="min-w-[150px]">
                                        <div className="font-bold text-sm">{m.number}. {m.place}</div>
                                        {m.time && <div className="text-xs text-slate-500 mt-1">🕐 {m.time}</div>}
                                        {m.desc && <div className="text-xs text-slate-600 mt-1">{m.desc}</div>}
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block mt-2 text-xs text-blue-500 hover:underline"
                                        >
                                            📍 在 Google Maps 開啟導航
                                        </a>
                                    </div>
                                </Popup>
                            </Marker>
                        )
                    })}

                    <FitBounds markers={markers} />
                </MapContainer>
            </div>

            {/* 圖例 */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> 起點</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-800"></span> 途經</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> 終點</span>
            </div>
        </div>
    )
}
