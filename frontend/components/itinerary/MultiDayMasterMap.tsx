"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import Map, { MapRef, Marker, Source, Layer, NavigationControl, AttributionControl } from "react-map-gl/maplibre"
import type { MapLayerMouseEvent } from "react-map-gl/maplibre"
import { Satellite, Map as MapIcon, Route, ArrowRight, Plane, Footprints, Car, Bus, Eye, Calendar } from "lucide-react"
import "maplibre-gl/dist/maplibre-gl.css"
import { setWorkerUrl } from "maplibre-gl"

if (typeof window !== "undefined") {
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")
}

import { Trip, Activity } from "@/lib/itinerary-types"
import { MAP_STYLES, MAP_LOCALIZATION, MAPILLARY } from "@/lib/constants"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MapControlCapsule } from "@/components/MapControlCapsule"

// API 基礎路徑 (模組頂部常數化，避免在並行閉包內重複解析 process.env)
const ROUTE_API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8008"

interface MultiDayMasterMapProps {
    trip?: Trip
    onSelectDay?: (day: number) => void
    onScrollToDay?: (day: number) => void
    onAddPOI?: (poi: POIBasicData, time: string, notes?: string, targetDay?: number) => void
}

function MultiDayMasterMapComponent({ trip, onSelectDay, onScrollToDay, onAddPOI }: MultiDayMasterMapProps) {
    const { lang } = useLanguage()
    const zh = lang === 'zh'

    const [activeDay, setActiveDay] = useState<number>(0) // 0 = ALL (全天高亮)
    const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard')

    // POI 抽屜狀態
    const [selectedPOI, setSelectedPOI] = useState<POIBasicData | null>(null)
    const [poiDrawerOpen, setPoiDrawerOpen] = useState<boolean>(false)
    // 🆕 搜尋與長按結果標記（紅色跳動大頭針）
    const [searchResultMarker, setSearchResultMarker] = useState<{ lat: number; lng: number; name: string } | null>(null)

    // 🆕 多日天數選擇彈窗狀態 (在 ALL 模式下加入行程時彈出)
    const [isDayPickerOpen, setIsDayPickerOpen] = useState<boolean>(false)
    const [pendingPoiData, setPendingPoiData] = useState<{ poi: POIBasicData; time: string; notes?: string } | null>(null)
    const [isAddingActivity, setIsAddingActivity] = useState<boolean>(false)

    // 🗺️ 地圖拖曳中狀態 (用於驅動 MapControlCapsule 呼吸降敏)
    const [isMapMoving, setIsMapMoving] = useState<boolean>(false)

    // 🆕 跨設備長按防手震手勢引用 (500ms / 5px 門檻)
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
    const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
    const isMoveDetectedRef = useRef<boolean>(false)

    // 兩階段道路 Polyline 快取 (DayNum ➔ Coordinates)
    const [roadRoutesByDay, setRoadRoutesByDay] = useState<Record<number, [number, number][]>>({})
    // 交通模式狀態 (預設 'walk')
    const [mode, setMode] = useState<'walk' | 'drive' | 'transit'>('walk')
    // 模式二級快取引用 (杜絕跨模式軌跡混雜與重複請求)
    const modeCacheRef = useRef<Record<string, Record<number, [number, number][]>>>({
        walk: {},
        drive: {},
        transit: {}
    })

    // GPS 定位狀態
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [isLocating, setIsLocating] = useState<boolean>(false)

    // 🌐 3D 地球儀切換狀態
    const [isGlobe, setIsGlobe] = useState<boolean>(false)
    const toggleGlobeProjection = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        const rawMap = mapRef.current?.getMap() as unknown as {
            getProjection?: () => { type: string } | undefined
            setProjection?: (spec: { type: string }) => void
        } | undefined
        const current = rawMap?.getProjection?.()?.type
        if (current === 'globe') {
            rawMap?.setProjection?.({ type: 'mercator' })
            setIsGlobe(false)
        } else {
            rawMap?.setProjection?.({ type: 'globe' })
            setIsGlobe(true)
        }
    }, [])

    // 街景覆蓋圖層開關
    const [showMapillaryCoverage, setShowMapillaryCoverage] = useState<boolean>(false)

    const mapRef = useRef<MapRef>(null)

    // 🆕 處理底圖 POI 點擊 (MapLibre queryRenderedFeatures 查詢)
    const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
        const map = mapRef.current?.getMap()
        if (!map) return

        // 查詢點擊位置 (使用 5px 緩衝區增加命中率)
        const bbox: [[number, number], [number, number]] = [
            [e.point.x - 5, e.point.y - 5],
            [e.point.x + 5, e.point.y + 5]
        ]

        // ① 優先查詢 Mapillary 影像點 (circle 圖層，僅在覆蓋層可見時)
        if (showMapillaryCoverage && map.getLayer('mapillary-images')) {
            const mlyFeatures = map.queryRenderedFeatures(bbox, {
                layers: ['mapillary-images']
            })
            if (mlyFeatures.length > 0) {
                const feat = mlyFeatures[0]
                const rawId = feat.properties?.id ?? feat.id
                const imageId = rawId ? String(rawId) : ''
                if (imageId) {
                    setMapillaryTarget({ lat: e.lngLat.lat, lng: e.lngLat.lng })
                    setMapillaryViewerOpen(true)
                    return // 攔截，不繼續查 POI
                }
            }
        }

        // ② 原有 POI symbol 查詢
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
                return props.name || (zh ? "地圖上的點" : "Map Point")
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

            setSearchResultMarker({ lat: poiData.lat, lng: poiData.lng, name: poiData.name })
            setSelectedPOI(poiData)
            setPoiDrawerOpen(true)
        }
    }, [showMapillaryCoverage, zh])

    // 🆕 處理地圖長按 (任意取點)
    const handleMapLongPress = useCallback((e: MapLayerMouseEvent) => {
        const { lng, lat } = e.lngLat

        const poiData: POIBasicData = {
            name: zh ? "地圖上的點" : "Map Point",
            type: 'place',
            lat: lat,
            lng: lng,
        }

        // 設置跳動大頭針標記
        setSearchResultMarker({ lat, lng, name: poiData.name })
        setSelectedPOI(poiData)
        setPoiDrawerOpen(true)
    }, [zh])

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

        // 若移動超過 5 像素，判定為平移並鎖定狀態，取消長按計時
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

    // 監聽地圖原生移動事件，一旦開始平移則鎖定狀態並取消計時
    const handleMapMoveStart = useCallback(() => {
        isMoveDetectedRef.current = true
        touchStartPosRef.current = null
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
        }
    }, [])

    const handleContextMenu = useCallback((e: MapLayerMouseEvent) => {
        e.originalEvent.preventDefault()
        if (!isMoveDetectedRef.current) {
            handleMapLongPress(e)
        }
    }, [handleMapLongPress])

    // 卸載時清理長按定時器
    useEffect(() => {
        return () => {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
        }
    }, [])

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

    // 切換交通模式 (帶相機鎖釋放與二級快取極速載入)
    const handleModeChange = useCallback((newMode: 'walk' | 'drive' | 'transit') => {
        if (mode === newMode) return
        if (isTouring || isFlying) cancelFlight()
        setMode(newMode)
        const cached = modeCacheRef.current[newMode]
        if (cached && Object.keys(cached).length > 0) {
            setRoadRoutesByDay(cached)
        } else {
            setRoadRoutesByDay({})
        }
    }, [mode, isTouring, isFlying, cancelFlight])

    // GPS 定位到我 (帶相機鎖釋放、高精度防禦與平滑 flyTo)
    const handleLocateMe = useCallback(() => {
        if (typeof window === 'undefined' || !navigator?.geolocation) {
            toast.error(zh ? "您的瀏覽器不支援地理定位功能" : "Geolocation not supported")
            return
        }
        if (isTouring || isFlying) cancelFlight()
        setIsLocating(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords
                if (Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0) {
                    setUserLocation({ lat: latitude, lng: longitude })
                    mapRef.current?.flyTo({
                        center: [longitude, latitude],
                        zoom: 15,
                        duration: 1800,
                        essential: true
                    })
                    toast.success(zh ? "已定位至當前位置" : "Located to your position")
                }
                setIsLocating(false)
            },
            (error) => {
                setIsLocating(false)
                if (error.code === error.PERMISSION_DENIED) {
                    toast.error(zh ? "定位權限遭拒，請至瀏覽器設定允許" : "Location permission denied")
                } else {
                    toast.error(zh ? "無法取得定位，請稍後再試" : "Location acquisition failed")
                }
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
        )
    }, [zh, isTouring, isFlying, cancelFlight])

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

    // 可選的天數清單 (排除 0 全體，保底至少 Day 1)
    const availableDayNumbers = useMemo(() => {
        const days = dayTabs.filter(d => d !== 0)
        return days.length > 0 ? days : [1]
    }, [dayTabs])

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
                const res = await fetch(`${ROUTE_API_BASE}/api/route`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        stops: validDayStops,
                        mode: mode,
                        optimize: false
                    }),
                    signal: dayController.signal
                })

                if (res.ok && isMounted) {
                    const data = await res.json()
                    const coords = data?.route?.geometry?.coordinates
                    if (coords && Array.isArray(coords) && isMounted) {
                        // 寫入二級快取
                        if (!modeCacheRef.current[mode]) {
                            modeCacheRef.current[mode] = {}
                        }
                        modeCacheRef.current[mode][dayNum] = coords

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
    }, [trip, mode])

    // 6. 安全縮放聚焦 (Fit Bounds)
    const fitMapToBounds = useCallback((targetMap: MapRef | null, resetBearingPitch = false) => {
        if (!targetMap || validPoints.length === 0) return
        try {
            targetMap.fitBounds(bounds, {
                padding: { top: 60, bottom: 60, left: 50, right: 50 },
                ...(resetBearingPitch ? { bearing: 0, pitch: 0 } : {}),
                duration: 900,
                maxZoom: 16
            })
        } catch {
            // 防禦性捕獲
        }
    }, [bounds, validPoints.length])

    // 🧭 羅盤正北歸零與全景置中 (正北歸零 + 俯視角歸零 + 智能行程聚焦)
    const handleCompassReset = useCallback(() => {
        if (isTouring || isFlying) cancelFlight()
        const targetMap = mapRef.current
        if (!targetMap) return

        if (activeDay !== 0) {
            const dayPoints = validPoints.filter(p => p.day === activeDay)
            if (dayPoints.length > 0) {
                const dayBounds = computeSafeMultiDayBounds(dayPoints)
                targetMap.fitBounds(dayBounds, {
                    padding: { top: 60, bottom: 60, left: 40, right: 40 },
                    bearing: 0,
                    pitch: 0,
                    duration: 800,
                    maxZoom: 16
                })
                return
            }
        }
        fitMapToBounds(targetMap, true)
    }, [isTouring, isFlying, cancelFlight, activeDay, validPoints, fitMapToBounds])

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
                {/* 頂部操作列：第一排標題與景點統計，第二排左側交通方式膠囊、右側3大功能鍵 (3D導覽/街景/衛星) */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
                    {/* 第一排：標題與景點計數 */}
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <Route className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
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

                    {/* 第二排（下面那一排）：左側交通方式，右側3個旗艦功能鍵 */}
                    <div className="flex items-center justify-between gap-2 pt-0.5 overflow-x-auto scrollbar-none">
                        {/* 🚶🚗🚌 交通方式左邊 */}
                        <div className="flex items-center gap-0.5 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs backdrop-blur-xs shrink-0">
                            <button
                                type="button"
                                onClick={() => handleModeChange('walk')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
                                    mode === 'walk'
                                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200/40 dark:border-slate-800'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                                title={zh ? "步行模式" : "Walking Mode"}
                            >
                                <Footprints className="w-3.5 h-3.5" />
                                <span>{zh ? "步行" : "Walk"}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleModeChange('drive')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
                                    mode === 'drive'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/40 dark:border-slate-800'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                                title={zh ? "開車模式" : "Driving Mode"}
                            >
                                <Car className="w-3.5 h-3.5" />
                                <span>{zh ? "開車" : "Drive"}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleModeChange('transit')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
                                    mode === 'transit'
                                        ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200/40 dark:border-slate-800'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                                title={zh ? "大眾運輸模式" : "Transit Mode"}
                            >
                                <Bus className="w-3.5 h-3.5" />
                                <span>{zh ? "大眾運輸" : "Transit"}</span>
                            </button>
                        </div>

                        {/* ✈️👁️🛰️ 剩下的3個功能鍵在對應的右邊 */}
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

                            {/* 👁️ Mapillary 街景覆蓋綠網 toggle */}
                            {isMapillaryAvailable() && (
                                <button
                                    type="button"
                                    onClick={() => setShowMapillaryCoverage(prev => !prev)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer border ${
                                        showMapillaryCoverage
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-transparent'
                                    }`}
                                    title={zh ? "切換街景覆蓋圖層" : "Toggle Street View Coverage"}
                                    aria-label="Toggle Street View Coverage"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">{zh ? "街景" : "Street View"}</span>
                                </button>
                            )}

                            {/* 🛰️ 衛星/向量底圖切換 */}
                            <button
                                type="button"
                                onClick={() => setMapMode(prev => prev === 'standard' ? 'satellite' : 'standard')}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer border ${
                                    mapMode === 'satellite'
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-transparent"
                                }`}
                                title={mapMode === 'satellite' ? (zh ? "切換至向量地圖" : "Vector Map") : (zh ? "切換至衛星影像" : "Satellite")}
                                aria-label="Toggle Map Style"
                            >
                                {mapMode === 'satellite' ? <MapIcon className="w-3.5 h-3.5" /> : <Satellite className="w-3.5 h-3.5" />}
                                <span className="hidden sm:inline">{mapMode === 'satellite' ? (zh ? "地圖" : "Map") : (zh ? "衛星" : "Satellite")}</span>
                            </button>
                        </div>
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

                    {/* 🧭📍🌐 地圖右上角懸浮控制膠囊 (Liquid Glass 物理晶透，具備 Ryan AI 同款 isIdle 呼吸降敏) */}
                    <MapControlCapsule
                        isGlobe={isGlobe}
                        onToggleGlobe={toggleGlobeProjection}
                        isLocating={isLocating}
                        onLocateMe={handleLocateMe}
                        onCompassReset={handleCompassReset}
                        compassTitle={activeDay === 0 ? (zh ? "全景置中 (正北歸零)" : "Fit All Bounds (North)") : (zh ? `聚焦 Day ${activeDay} (正北歸零)` : `Fit Day ${activeDay}`)}
                        isTouring={isTouring}
                        isMapMoving={isMapMoving}
                    />

                    <Map
                        ref={mapRef}
                        initialViewState={initialCenter}
                        mapStyle={MAP_STYLES.VECTOR}
                        onLoad={() => {
                            fitMapToBounds(mapRef.current)
                        }}
                        onMoveStart={() => {
                            handleMapMoveStart()
                            setIsMapMoving(true)
                        }}
                        onMoveEnd={() => {
                            setIsMapMoving(false)
                        }}
                        onMouseDown={handlePointerStart}
                        onMouseMove={handlePointerMove}
                        onMouseUp={handlePointerEnd}
                        onClick={(e) => {
                            if ((e.originalEvent.target as HTMLElement).closest('button')) return
                            handleMapClick(e)
                        }}
                        onContextMenu={handleContextMenu}
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

                        {/* 📸 Mapillary 街景覆蓋向量圖層 (宣告式拓撲，在彩帶之下) */}
                        {isMapillaryAvailable() && MAPILLARY.TOKEN && (
                            <Source
                                id="mapillary-coverage"
                                type="vector"
                                tiles={[MAPILLARY.TILES_URL]}
                                minzoom={MAPILLARY.COVERAGE_MIN_ZOOM}
                                maxzoom={MAPILLARY.COVERAGE_MAX_ZOOM}
                            >
                                <Layer
                                    id="mapillary-sequences"
                                    type="line"
                                    source-layer="sequence"
                                    layout={{ visibility: showMapillaryCoverage ? 'visible' : 'none' }}
                                    paint={{
                                        'line-color': '#05CB63',
                                        'line-width': 2,
                                        'line-opacity': 0.7,
                                    }}
                                />
                                <Layer
                                    id="mapillary-images"
                                    type="circle"
                                    source-layer="image"
                                    minzoom={MAPILLARY.IMAGE_POINT_MIN_ZOOM}
                                    layout={{ visibility: showMapillaryCoverage ? 'visible' : 'none' }}
                                    paint={{
                                        'circle-radius': 4,
                                        'circle-color': '#05CB63',
                                        'circle-stroke-width': 1,
                                        'circle-stroke-color': '#fff',
                                    }}
                                />
                            </Source>
                        )}

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
                                    "line-offset": ["*", ["-", ["get", "day"], 1], 1.2],
                                    ...(mode === 'transit' ? { "line-dasharray": [2, 2] } : {})
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

                        {/* 🆕 搜尋與長按結果標記（紅色跳動大頭針） */}
                        {searchResultMarker && (
                            <Marker
                                longitude={searchResultMarker.lng}
                                latitude={searchResultMarker.lat}
                                anchor="bottom"
                            >
                                <div className="relative animate-bounce" style={{ animationDuration: '0.6s', animationIterationCount: 3 }}>
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/30 rounded-full blur-sm" />
                                    <div className="relative">
                                        <div
                                            className="w-8 h-8 bg-red-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center"
                                            style={{
                                                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.5), 0 2px 4px rgba(0,0,0,0.2)'
                                            }}
                                        >
                                            <div className="w-2 h-2 bg-white rounded-full" />
                                        </div>
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

                        {/* 📍 使用者位置藍點脈衝標記 */}
                        {userLocation && (
                            <Marker
                                longitude={userLocation.lng}
                                latitude={userLocation.lat}
                                anchor="center"
                            >
                                <div className="relative">
                                    {/* 外層脈動圓 */}
                                    <div className="absolute -inset-3 bg-blue-400/30 rounded-full animate-ping pointer-events-none" />
                                    {/* 藍點實體 */}
                                    <div className="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg" />
                                </div>
                            </Marker>
                        )}

                        {/* 縮放與旋轉控制器 */}
                        <NavigationControl position="bottom-right" showCompass={true} />
                        <AttributionControl position="bottom-left" compact={true} />
                    </Map>

                    {/* 🆕 POI 詳情抽屜 (置於地圖容器內部，受控於 bottom-0，不再彈到頂部) */}
                    <POIDetailDrawer
                        isOpen={poiDrawerOpen}
                        onClose={() => {
                            setPoiDrawerOpen(false)
                            setSearchResultMarker(null)
                        }}
                        poi={selectedPOI}
                        isInternal={true}
                        onAddToItinerary={onAddPOI ? (poi, time, aiSummary) => {
                            const notes = aiSummary
                                ? `${aiSummary.summary}\n${zh ? '必訪/必點' : 'Must try'}: ${aiSummary.must_try?.join(', ') || ''}`
                                : undefined

                            if (activeDay !== 0) {
                                // 智能判斷：若上方已選定某天，直接加入該天
                                onAddPOI(poi, time, notes, activeDay)
                                setPoiDrawerOpen(false)
                                setSearchResultMarker(null)
                            } else {
                                // 若在全部 (ALL) 狀態，暫存並喚起天數選擇視窗
                                setPendingPoiData({ poi, time, notes })
                                setIsDayPickerOpen(true)
                            }
                        } : undefined}
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

                {/* 🆕 天數選擇彈窗 (在 ALL 模式下加入行程時，透過 Portal 掛載於 body，杜絕容器裁切) */}
                <Dialog open={isDayPickerOpen} onOpenChange={setIsDayPickerOpen}>
                    <DialogContent className="sm:max-w-xs rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-500" />
                                {zh ? "選擇加入天數" : "Select Target Day"}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {pendingPoiData?.poi.name}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-3 gap-2 py-3">
                            {availableDayNumbers.map(d => (
                                <Button
                                    key={d}
                                    disabled={isAddingActivity}
                                    onClick={async () => {
                                        if (!pendingPoiData || !onAddPOI) return
                                        setIsAddingActivity(true)
                                        try {
                                            await onAddPOI(pendingPoiData.poi, pendingPoiData.time, pendingPoiData.notes, d)
                                            setIsDayPickerOpen(false)
                                            setPoiDrawerOpen(false)
                                            setSearchResultMarker(null)
                                            setPendingPoiData(null)
                                        } finally {
                                            setIsAddingActivity(false)
                                        }
                                    }}
                                    variant="outline"
                                    className="h-12 rounded-xl font-bold hover:border-indigo-500 hover:text-indigo-600 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                                >
                                    <span className="text-[10px] text-slate-400 font-normal">Day</span>
                                    <span className="text-sm font-black leading-none">{d}</span>
                                </Button>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    )
}

export const MultiDayMasterMap = React.memo(MultiDayMasterMapComponent)
