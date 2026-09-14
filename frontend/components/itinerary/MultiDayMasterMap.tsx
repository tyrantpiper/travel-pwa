"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import Map, { MapRef, Marker, Source, Layer, NavigationControl, AttributionControl } from "react-map-gl/maplibre"
import { Satellite, Map as MapIcon, Route, Compass, ArrowRight } from "lucide-react"
import "maplibre-gl/dist/maplibre-gl.css"
import { setWorkerUrl } from "maplibre-gl"

if (typeof window !== "undefined") {
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")
}

import { Trip, Activity } from "@/lib/itinerary-types"
import { MAP_STYLES } from "@/lib/constants"
import { useLanguage } from "@/lib/LanguageContext"
import POIDetailDrawer, { POIBasicData } from "@/components/POIDetailDrawer"
import {
    buildMultiDayFeatureCollection,
    computeSafeMultiDayBounds,
    getDayColor
} from "@/lib/geo-multi-day"

interface MultiDayMasterMapProps {
    trip?: Trip
    onSelectDay?: (day: number) => void
    onScrollToDay?: (day: number) => void
}

function MultiDayMasterMapComponent({ trip, onSelectDay, onScrollToDay }: MultiDayMasterMapProps) {
    const { lang } = useLanguage()
    const zh = lang === 'zh'

    const [activeDay, setActiveDay] = useState<number>(0) // 0 = ALL (全天高亮)
    const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard')

    // POI 抽屜狀態
    const [selectedPOI, setSelectedPOI] = useState<POIBasicData | null>(null)
    const [poiDrawerOpen, setPoiDrawerOpen] = useState<boolean>(false)

    // 兩階段道路 Polyline 快取 (DayNum ➔ Coordinates)
    const [roadRoutesByDay, setRoadRoutesByDay] = useState<Record<number, [number, number][]>>({})

    const mapRef = useRef<MapRef>(null)

    // 1. 構建全行程 GeoJSON
    const { featureCollection, validPoints } = useMemo(() => {
        return buildMultiDayFeatureCollection(trip, roadRoutesByDay)
    }, [trip, roadRoutesByDay])

    // 2. 計算安全外接邊界
    const bounds = useMemo(() => {
        return computeSafeMultiDayBounds(validPoints)
    }, [validPoints])

    // 3. 初始中心點
    const initialCenter = useMemo(() => {
        if (validPoints.length > 0) {
            return { longitude: validPoints[0].lng, latitude: validPoints[0].lat, zoom: 12 }
        }
        return { longitude: 121.5654, latitude: 25.0339, zoom: 11 }
    }, [validPoints])

    // 4. 天數標籤清單
    const dayTabs = useMemo(() => {
        if (!trip || !trip.days) return [0]
        const availableDays = trip.days.map(d => d.day).sort((a, b) => a - b)
        return [0, ...availableDays]
    }, [trip])

    // 5. 兩階段漸進式路網請求 (背景非同步載入)
    useEffect(() => {
        if (!trip || !trip.days || trip.days.length === 0) return

        let isMounted = true
        const fetchRoadRoutes = async () => {
            for (const dayPlan of trip.days) {
                const dayNum = dayPlan.day
                const acts: Activity[] = dayPlan.activities || (dayPlan as { items?: Activity[] }).items || []
                const validDayStops = acts
                    .filter((a: Activity) => a.category !== 'header' && !isNaN(Number(a.lat)) && !isNaN(Number(a.lng)) && Number(a.lat) !== 0)
                    .map((a: Activity) => ({
                        lat: Number(a.lat),
                        lng: Number(a.lng),
                        name: a.place || a.place_name || undefined
                    }))

                if (validDayStops.length < 2) continue

                try {
                    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8008"
                    const controller = new AbortController()
                    const timeoutId = setTimeout(() => controller.abort(), 10000)

                    const res = await fetch(`${API_BASE}/api/route`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            stops: validDayStops,
                            mode: "walk",
                            optimize: false
                        }),
                        signal: controller.signal
                    })
                    clearTimeout(timeoutId)

                    if (res.ok) {
                        const data = await res.json()
                        if (data.route && data.route.geometry && data.route.geometry.coordinates && isMounted) {
                            setRoadRoutesByDay(prev => ({
                                ...prev,
                                [dayNum]: data.route.geometry.coordinates
                            }))
                        }
                    }
                } catch {
                    // 容錯靜默降級，維持第一階段幾何線
                }
            }
        }

        fetchRoadRoutes()
        return () => { isMounted = false }
    }, [trip])

    // 6. 安全縮放聚焦 (Fit Bounds)
    const fitMapToBounds = useCallback((targetMap: MapRef | null) => {
        if (!targetMap || validPoints.length === 0) return
        try {
            targetMap.fitBounds(bounds, {
                padding: { top: 60, bottom: 60, left: 50, right: 50 },
                duration: 900,
                maxZoom: 16
            })
        } catch {
            // 防禦性捕獲
        }
    }, [bounds, validPoints.length])

    // 7. 切換天數篩選
    const handleSelectDayFilter = (dayNum: number) => {
        setActiveDay(dayNum)
        const targetMap = mapRef.current
        if (!targetMap) return

        if (dayNum === 0) {
            fitMapToBounds(targetMap)
        } else {
            const dayPoints = validPoints.filter(p => p.day === dayNum)
            if (dayPoints.length > 0) {
                const dayBounds = computeSafeMultiDayBounds(dayPoints)
                targetMap.fitBounds(dayBounds, {
                    padding: { top: 60, bottom: 60, left: 40, right: 40 },
                    duration: 800,
                    maxZoom: 16
                })
            }
        }
    }

    return (
        <>
            <div className="my-6 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm will-change-transform transform-gpu">
                {/* 頂部操作列 */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <Route className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {zh ? "全行程多天軌跡" : "Full-Trip Route Mesh"}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800 shrink-0">
                                    {validPoints.length} {zh ? "個景點" : "Spots"}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                {zh ? "各天彩帶分色 · 支援自由縮放與漫遊" : "Multi-Day Routes · Zoom & Pan freely"}
                            </p>
                        </div>
                    </div>

                    {/* 右側操作按鈕群 (僅保留全景置中與底圖切換，空間極致寬裕) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* 視野全景置中 */}
                        <button
                            type="button"
                            onClick={() => fitMapToBounds(mapRef.current)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all active:scale-95 cursor-pointer"
                            title={zh ? "全景置中聚焦" : "Fit All Bounds"}
                            aria-label="Fit Bounds"
                        >
                            <Compass className="w-4 h-4 text-indigo-500" />
                        </button>

                        {/* 衛星/向量底圖切換 */}
                        <button
                            type="button"
                            onClick={() => setMapMode(prev => prev === 'standard' ? 'satellite' : 'standard')}
                            className={`p-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
                                mapMode === 'satellite'
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                            }`}
                            title={mapMode === 'satellite' ? "切換至向量地圖" : "切換至衛星影像"}
                            aria-label="Toggle Map Style"
                        >
                            {mapMode === 'satellite' ? <MapIcon className="w-4 h-4" /> : <Satellite className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* 天數切換膠囊橫向導航列 (支援 iOS Swift 風格 Tap-to-Focus / Tap-again-to-Drill-down) */}
                <div className="px-3 py-2 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    {dayTabs.map(dayNum => {
                        const isSelected = activeDay === dayNum
                        const isDay = dayNum !== 0
                        const dayColor = getDayColor(dayNum)
                        return (
                            <button
                                key={dayNum}
                                type="button"
                                onClick={() => {
                                    if (isSelected && isDay) {
                                        // 再次點選已選中天數：平滑滾動至該天卡片
                                        if (onScrollToDay) {
                                            onScrollToDay(dayNum)
                                        } else if (onSelectDay) {
                                            onSelectDay(dayNum)
                                        }
                                    } else {
                                        // 首次點選：地圖聚焦該天軌跡
                                        handleSelectDayFilter(dayNum)
                                    }
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                                    isSelected
                                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                }`}
                                aria-label={
                                    isSelected && isDay
                                        ? (zh ? `再次點擊跳轉至 Day ${dayNum} 卡片` : `Tap again to view Day ${dayNum}`)
                                        : (zh ? `切換至 Day ${dayNum}` : `Select Day ${dayNum}`)
                                }
                                title={
                                    isSelected && isDay
                                        ? (zh ? `再次點擊跳轉至 Day ${dayNum} 卡片` : `Tap again to view Day ${dayNum}`)
                                        : undefined
                                }
                            >
                                {isDay && (
                                    <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: dayColor }}
                                    />
                                )}
                                <span>{dayNum === 0 ? (zh ? "全部 (ALL)" : "ALL") : `Day ${dayNum}`}</span>
                                {isSelected && isDay && (
                                    <ArrowRight className="w-3 h-3 text-indigo-400 dark:text-indigo-600 shrink-0" />
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* 地圖主容器：自適應螢幕高度 (h-[52vh] min-h-95 max-h-145)，支援平移縮放 */}
                <div className="relative w-full h-[52vh] min-h-95 max-h-145 bg-slate-100 dark:bg-slate-800 overflow-hidden isolate transform-gpu will-change-transform">
                    <Map
                        ref={mapRef}
                        initialViewState={initialCenter}
                        mapStyle={MAP_STYLES.VECTOR}
                        onLoad={() => {
                            fitMapToBounds(mapRef.current)
                        }}
                        dragPan={true}
                        scrollZoom={true}
                        doubleClickZoom={true}
                        attributionControl={false}
                        style={{ width: "100%", height: "100%" }}
                    >
                        {/* 衛星影像 Source & Layer (底層) */}
                        <Source id="satellite-source" type="raster" tiles={[MAP_STYLES.SATELLITE]} tileSize={256}>
                            <Layer
                                id="satellite-layer"
                                type="raster"
                                layout={{ visibility: mapMode === 'satellite' ? 'visible' : 'none' }}
                            />
                        </Source>

                        {/* 路線渲染 Source */}
                        <Source id="multi-day-route-source" type="geojson" data={featureCollection}>
                            {/* 1. 當日發光柔光層 (Glow Layer) - 提供微霓虹立體質感 */}
                            <Layer
                                id="multi-day-glow-layer"
                                type="line"
                                filter={["==", ["get", "isInterDay"], false]}
                                layout={{ "line-cap": "round", "line-join": "round" }}
                                paint={{
                                    "line-color": ["get", "color"],
                                    "line-width": [
                                        "case",
                                        ["==", ["get", "day"], activeDay],
                                        9,
                                        ["case", ["==", activeDay, 0], 7.5, 3]
                                    ],
                                    "line-opacity": [
                                        "case",
                                        ["==", ["get", "day"], activeDay],
                                        0.38,
                                        ["case", ["==", activeDay, 0], 0.24, 0.05]
                                    ],
                                    "line-blur": 3
                                }}
                            />

                            {/* 2. 當日核心軌跡彩帶 (Daily Core Route) */}
                            <Layer
                                id="multi-day-core-layer"
                                type="line"
                                filter={["==", ["get", "isInterDay"], false]}
                                layout={{ "line-cap": "round", "line-join": "round" }}
                                paint={{
                                    "line-color": ["get", "color"],
                                    "line-width": [
                                        "case",
                                        ["==", ["get", "day"], activeDay],
                                        5.5,
                                        ["case", ["==", activeDay, 0], 4, 1.8]
                                    ],
                                    "line-opacity": [
                                        "case",
                                        ["==", ["get", "day"], activeDay],
                                        1.0,
                                        ["case", ["==", activeDay, 0], 0.92, 0.2]
                                    ],
                                    // 依天數做輕量平行側移，避免相同幹道路段重疊覆蓋
                                    "line-offset": ["*", ["-", ["get", "day"], 1], 1.2]
                                }}
                            />

                            {/* 3. 跨日過渡銜接虛線 (Inter-Day Transition Route) */}
                            <Layer
                                id="multi-day-inter-layer"
                                type="line"
                                filter={["==", ["get", "isInterDay"], true]}
                                layout={{ "line-cap": "round", "line-join": "round" }}
                                paint={{
                                    "line-color": "#94A3B8",
                                    "line-width": 2.2,
                                    "line-dasharray": ["literal", [2, 3]],
                                    "line-opacity": [
                                        "case",
                                        ["==", activeDay, 0],
                                        0.65,
                                        0.15
                                    ]
                                }}
                            />
                        </Source>

                        {/* 景點標記 Pin */}
                        {validPoints.map((pt, idx) => {
                            const isFocused = activeDay === 0 || activeDay === pt.day
                            const color = getDayColor(pt.day)
                            return (
                                <Marker
                                    key={pt.id || `pt-${pt.day}-${pt.sequence}-${idx}`}
                                    longitude={pt.lng}
                                    latitude={pt.lat}
                                    anchor="bottom"
                                    onClick={(e) => {
                                        e.originalEvent.stopPropagation()
                                        setSelectedPOI({
                                            name: pt.place,
                                            type: pt.category || "attraction",
                                            address: pt.place,
                                            lat: pt.lat,
                                            lng: pt.lng
                                        })
                                        setPoiDrawerOpen(true)
                                    }}
                                >
                                    <div
                                        className={`transition-all duration-300 transform flex flex-col items-center group cursor-pointer ${
                                            isFocused ? "scale-100 opacity-100 z-20" : "scale-75 opacity-30 z-10"
                                        }`}
                                    >
                                        {/* 景點名稱膠囊 */}
                                        <div className="mb-1 px-2 py-0.5 rounded-md bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 text-[10px] font-bold shadow-xs border border-slate-200/80 dark:border-slate-800 truncate max-w-30">
                                            {pt.place}
                                        </div>
                                        {/* 圓形彩球 Pin */}
                                        <div
                                            className="rounded-full text-white font-black text-[11px] shadow-lg border-2 border-white dark:border-slate-900 flex items-center justify-center transition-transform hover:scale-110"
                                            style={{
                                                backgroundColor: color,
                                                width: 26,
                                                height: 26
                                            }}
                                        >
                                            D{pt.day}-{pt.sequence}
                                        </div>
                                    </div>
                                </Marker>
                            )
                        })}

                        {/* 縮放與旋轉控制器 */}
                        <NavigationControl position="bottom-right" showCompass={true} />
                        <AttributionControl position="bottom-left" compact={true} />
                    </Map>

                    {/* 🆕 POI 詳情抽屜 (置於地圖容器內部，受控於 bottom-0，不再彈到頂部) */}
                    <POIDetailDrawer
                        isOpen={poiDrawerOpen}
                        onClose={() => setPoiDrawerOpen(false)}
                        poi={selectedPOI}
                        isInternal={true}
                    />
                </div>
            </div>
        </>
    )
}

export const MultiDayMasterMap = React.memo(MultiDayMasterMapComponent)
