"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import Map, { MapRef, Marker, Source, Layer, NavigationControl, AttributionControl } from "react-map-gl/maplibre"
import { Satellite, Map as MapIcon, Route, Compass, ArrowRight, Plane } from "lucide-react"
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
import { useFlyoverController } from "@/hooks/useFlyoverController"
import { TourHudCapsule } from "@/components/TourHudCapsule"
import MapillaryViewer from "@/components/MapillaryViewer"
import { isMapillaryAvailable } from "@/lib/mapillary"
import { toast } from "sonner"

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

    // ✈️ 3D 航線巡航控制器
    const {
        isFlying,
        isTouring,
        isOrbiting,
        isPaused,
        currentTourIndex,
        currentTourPOI,
        triggerFlyover,
        startTour,
        skipToNext,
        togglePauseTour,
        cancelFlight
    } = useFlyoverController(mapRef)

    // 街景狀態
    const [mapillaryViewerOpen, setMapillaryViewerOpen] = useState(false)
    const [mapillaryTarget, setMapillaryTarget] = useState<{ lat: number; lng: number } | null>(null)

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
    // 5. 兩階段漸進式路網請求 (獨立並行非同步載入 + 抵達即刻渲染)
    useEffect(() => {
        if (!trip || !trip.days || trip.days.length === 0) return

        let isMounted = true
        const globalController = new AbortController()

        const fetchSingleDayRoute = async (dayPlan: (typeof trip.days)[0]) => {
            const dayNum = dayPlan.day
            const acts: Activity[] = dayPlan.activities || (dayPlan as { items?: Activity[] }).items || []
            const validDayStops = acts
                .filter((a: Activity) => a.category !== 'header' && !isNaN(Number(a.lat)) && !isNaN(Number(a.lng)) && Number(a.lat) !== 0)
                .map((a: Activity) => ({
                    lat: Number(a.lat),
                    lng: Number(a.lng),
                    name: a.place || a.place_name || undefined
                }))

            if (validDayStops.length < 2) return

            const dayController = new AbortController()
            const timeoutId = setTimeout(() => dayController.abort(), 10000)

            // 綁定組件卸載全域訊號
            const onGlobalAbort = () => dayController.abort()
            globalController.signal.addEventListener('abort', onGlobalAbort, { once: true })

            try {
                const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8008"
                const res = await fetch(`${API_BASE}/api/route`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        stops: validDayStops,
                        mode: "walk",
                        optimize: false
                    }),
                    signal: dayController.signal
                })

                if (res.ok && isMounted) {
                    const data = await res.json()
                    const coords = data?.route?.geometry?.coordinates
                    if (coords && Array.isArray(coords) && isMounted) {
                        // 單天抵達立即更新，消滅序列 Waterfall 延遲
                        setRoadRoutesByDay(prev => ({
                            ...prev,
                            [dayNum]: coords
                        }))
                    }
                }
            } catch {
                // 容錯靜默降級，維持第一階段幾何線
            } finally {
                clearTimeout(timeoutId)
                globalController.signal.removeEventListener('abort', onGlobalAbort)
            }
        }

        // 各天獨立併發啟動
        trip.days.forEach(dayPlan => {
            fetchSingleDayRoute(dayPlan)
        })

        return () => {
            isMounted = false
            globalController.abort()
        }
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

    // 8. 3D 巡航導覽切換 (全部巡航 vs 當天巡航)
    const handleToggleTour = () => {
        if (isTouring || isFlying) {
            cancelFlight()
            return
        }

        const targetPoints = activeDay === 0
            ? validPoints
            : validPoints.filter(p => p.day === activeDay)

        if (targetPoints.length === 0) {
            toast.info(zh ? "目前沒有可導覽的景點" : "No spots to tour")
            return
        }

        const tourPois = targetPoints.map(p => ({
            lat: p.lat,
            lng: p.lng,
            name: p.place,
            day: p.day,
            sequence: p.sequence
        }))

        startTour(
            tourPois,
            (poi) => {
                setMapillaryTarget({ lat: poi.lat, lng: poi.lng })
                // 嚴格相機解耦：僅同步 activeDay 狀態以高亮彩帶與標記，絕不調用 fitBounds
                if (typeof poi.day === "number" && poi.day !== activeDay) {
                    setActiveDay(poi.day)
                }
            },
            () => {
                fitMapToBounds(mapRef.current)
                toast.success(
                    activeDay === 0
                        ? (zh ? "🎉 全行程 3D 巡航導覽完畢" : "🎉 Full trip 3D tour completed")
                        : (zh ? `🎉 Day ${activeDay} 3D 巡航導覽完畢` : `🎉 Day ${activeDay} 3D tour completed`)
                )
            }
        )
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

                    {/* 右側操作按鈕群 (包含 3D 導覽、全景置中與底圖切換) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* ✈️ 3D 巡航導覽按鈕 */}
                        {validPoints.length > 0 && (
                            <button
                                type="button"
                                onClick={handleToggleTour}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer border ${
                                    isTouring
                                        ? "bg-linear-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-xs animate-pulse"
                                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-transparent"
                                }`}
                                title={isTouring ? (zh ? "停止 3D 導覽" : "Stop 3D Tour") : (zh ? "開啟 3D 巡航導覽" : "Start 3D Tour")}
                                aria-label="Toggle 3D Tour"
                            >
                                <Plane className={`w-3.5 h-3.5 ${isTouring ? "animate-bounce" : ""}`} />
                                <span className="hidden sm:inline">
                                    {isTouring ? (zh ? "結束導覽" : "Stop") : (zh ? "3D 導覽" : "3D Tour")}
                                </span>
                            </button>
                        )}

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
                                    if (isTouring || isFlying) {
                                        cancelFlight()
                                    }
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

                {/* 地圖主容器：大視野自適應高度 (style 實體保底 65vh / 520px~780px，杜絕 Tailwind JIT 類別未掃描造成 height: 0px 塌陷) */}
                <div
                    className="relative w-full bg-slate-100 dark:bg-slate-800 overflow-hidden isolate transform-gpu will-change-transform"
                    style={{ height: "65vh", minHeight: "520px", maxHeight: "780px" }}
                >
                    {/* ✈️ 3D 巡航導覽懸浮膠囊 (共用 TourHudCapsule 元件) */}
                    <TourHudCapsule
                        isTouring={isTouring}
                        isOrbiting={isOrbiting}
                        isPaused={isPaused}
                        currentIndex={currentTourIndex}
                        currentPOI={currentTourPOI}
                        onTogglePause={togglePauseTour}
                        onSkipNext={skipToNext}
                        onCancel={cancelFlight}
                        onOpenStreetView={(lat, lng) => {
                            setMapillaryTarget({ lat, lng })
                            setMapillaryViewerOpen(true)
                        }}
                        hasStreetView={isMapillaryAvailable()}
                    />

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
                        onOpenStreetView={(lat, lng) => {
                            setMapillaryTarget({ lat, lng })
                            setMapillaryViewerOpen(true)
                        }}
                        onFlyover={(lat, lng) => {
                            triggerFlyover({ lat, lng, name: selectedPOI?.name }, () => {
                                setMapillaryTarget({ lat, lng })
                            }, true)
                        }}
                    />

                    {/* 🆕 Mapillary 實景街景 Viewer */}
                    <MapillaryViewer
                        isOpen={mapillaryViewerOpen}
                        lat={mapillaryTarget?.lat}
                        lng={mapillaryTarget?.lng}
                        onClose={() => setMapillaryViewerOpen(false)}
                    />
                </div>
            </div>
        </>
    )
}

export const MultiDayMasterMap = React.memo(MultiDayMasterMapComponent)
