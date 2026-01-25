"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useTripDetail, useOnlineStatus, useHaptic } from "@/lib/hooks"
import { useLanguage } from "@/lib/LanguageContext"
import { ItineraryItemState, Trip, Activity, DailyLocation, DayWeather, ChecklistItem } from "@/lib/itinerary-types"
import { ActivityEditModal } from "@/components/itinerary/ActivityEditModal"
import { CreateTripModal, JoinTripDialog } from "@/components/itinerary/TripDialogs"
import EditableDailyTips from "@/components/itinerary/EditableDailyTips"
import EditableDailyChecklist from "@/components/itinerary/EditableDailyChecklist"
import EditableDailyAIReview from "@/components/itinerary/EditableDailyAIReview"
import { tripsApi, itemsApi, geocodeApi } from "@/lib/api"
import { useDynamicPolling } from "@/lib/polling-manager"
import { useTripContext } from "@/lib/trip-context"
import { useTripStore } from "@/lib/stores/tripStore"
import { useWeatherStore } from "@/lib/stores/weatherStore"
import { toast } from "sonner"
import { ZenRenew } from "@/components/ui/zen-renew"
import { fetchWeatherWithSDK, generateHourlyCurve } from "@/lib/weather-api"
import { debugLog } from "@/lib/debug"
import { VirtuosoHandle } from "react-virtuoso"
import {
    useSensor,
    useSensors,
    PointerSensor,
    TouchSensor,
    DragStartEvent,
    DragEndEvent
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { POIBasicData } from "@/components/POIDetailDrawer"

// 🆕 Phase 3 Components
import { WeatherPanel } from "@/components/itinerary/WeatherPanel"
import { LocationEditDialog } from "@/components/itinerary/LocationEditDialog"
import { TripList } from "@/components/itinerary/TripList"
import { ItineraryHeader } from "@/components/itinerary/ItineraryHeader"
import { ItineraryTimeline } from "@/components/itinerary/ItineraryTimeline"

const DEFAULT_START_DATE = new Date()

/**
 * 🔧 Helper to access day data with number/string key fallback
 * JSON parses keys as strings, but TypeScript types use numbers
 */
function getDayData<T>(data: Record<number | string, T> | undefined, day: number): T | undefined {
    if (!data) return undefined
    // Try number key first, then string key
    return data[day] ?? data[String(day)]
}

export function ItineraryView() {
    const { t } = useLanguage()
    const { activeTripId, mutate: reloadTrips, userId, trips, setActiveTripId, isLoading: isTripsLoading } = useTripContext()
    const setFocusedDay = useTripStore((s) => s.setFocusedDay)
    const [viewMode, setViewMode] = useState<'list' | 'detail'>('list')

    // 🆕 Hyper-Heuristics: Dynamic Polling Interval
    const refreshInterval = useDynamicPolling()

    // Use activeTripId from context, pass userId for privacy filtering
    const { trip: currentTrip, mutate: reloadTripDetail, isValidating } = useTripDetail(activeTripId, userId, refreshInterval) as { trip: Trip, mutate: (data?: unknown, shouldRevalidate?: boolean) => Promise<void>, isValidating: boolean }
    const [deletingTripId, setDeletingTripId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const haptic = useHaptic()
    const isOnline = useOnlineStatus()  // 🆕 離線狀態偵測

    const [editItem, setEditItem] = useState<ItineraryItemState | null>(null)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isAddMode, setIsAddMode] = useState(false)
    const [isSavingActivity, setIsSavingActivity] = useState(false)
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), []) // 🔧 Client-side only rendering for Portal


    // 🆕 DND State
    const [activeId, setActiveId] = useState<string | null>(null)
    const [pendingReorder, setPendingReorder] = useState<{
        itemId: string
        oldIndex: number
        newIndex: number
        newOrder: Activity[]
    } | null>(null)
    const [isReordering, setIsReordering] = useState(false)
    const [isReorderDialogOpen, setIsReorderDialogOpen] = useState(false)
    const [leavingTripId, setLeavingTripId] = useState<string | null>(null)
    const itnVirtuosoRef = useRef<VirtuosoHandle | null>(null)
    // 🔧 v2.5: Use State callback to ensure ref propagation to Virtuoso
    const [scrollerEl, setScrollerEl] = useState<HTMLElement | null>(null)

    // 🆕 Smart Clone States
    const [isClonePromptOpen, setIsClonePromptOpen] = useState(false)
    const [cloneSourceDay, setCloneSourceDay] = useState<number | null>(null)
    const [pendingAddDayPosition, setPendingAddDayPosition] = useState<'before' | 'end' | null>(null)
    const [isAddingDay, setIsAddingDay] = useState(false)


    // 🆕 DND Sensors (同多圖拖曳)
    const dndSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    )

    // 🆕 處理從地圖加入 POI
    const handleAddPOI = async (poi: POIBasicData, time: string, notes?: string) => {
        if (!activeTripId) return

        try {
            await itemsApi.create({
                trip_id: activeTripId,
                user_id: userId || "", // 🔒 Fix: Auth header
                day: day,
                time: time,
                place: poi.name,
                desc: notes || poi.address || "",
                category: poi.type || "sightseeing",
                lat: poi.lat,
                lng: poi.lng,
                image_url: poi.photo_url || poi.image_url
            })

            toast.success("已加入行程")
            // 立即重整
            await reloadTripDetail()
        } catch (error) {
            console.error(error)
            toast.error("加入失敗")
        }
    }


    const [day, setDay] = useState(1)

    // 🆕 2026: Sync local day to global store for AI Adaptive Resolution
    useEffect(() => {
        setFocusedDay(day)
    }, [day, setFocusedDay])
    const [weatherData, setWeatherData] = useState<DayWeather[]>([])
    const [weatherMode, setWeatherMode] = useState<'live' | 'forecast' | 'seasonal' | 'trend'>('live')
    const [resolvedLocation, setResolvedLocation] = useState<{ name: string, lat: number, lng: number } | null>(null) // 🆕 統一位置狀態
    const [elevation, setElevation] = useState<number | null>(null)
    const [weatherConfidence, setWeatherConfidence] = useState<number | null>(null) // 🆕 2026: 預報信心度

    // 🆕 P8: Active Flag (防止競態條件)
    const activeReqRef = useRef<string | null>(null)
    const weatherStore = useWeatherStore()
    const currentDayData = useMemo(() => {
        if (!currentTrip?.days || !Array.isArray(currentTrip.days)) return []
        // 🛡️ 使用 Number() 確保型別一致，避免 JSON 序列化導致的 string vs number 比較失敗
        return currentTrip.days.find((d) => Number(d.day) === Number(day))?.activities || []
    }, [currentTrip?.days, day])

    // 🆕 DND Event Handlers
    const handleDragStart = useCallback((event: DragStartEvent) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10) // 📳 Haptic: Lift
        setActiveId(event.active.id as string)
    }, [])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)

        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([5, 20, 5]) // 📳 Haptic: Drop

        if (!over || active.id === over.id) return
        if (!isOnline) {
            toast.error("✈️ 離線模式下無法調整順序")
            return
        }

        const oldIndex = currentDayData.findIndex((item: Activity) => item.id === active.id)
        const newIndex = currentDayData.findIndex((item: Activity) => item.id === over.id)

        if (oldIndex === -1 || newIndex === -1) return

        const newOrder = arrayMove([...currentDayData], oldIndex, newIndex)

        setPendingReorder({
            itemId: active.id as string,
            oldIndex,
            newIndex,
            newOrder
        })
        setIsReorderDialogOpen(true)
    }, [currentDayData, isOnline])

    const handleDragCancel = useCallback(() => {
        setActiveId(null)
    }, [])

    const handleReorderConfirm = useCallback(async (adjustTimes: boolean) => {
        if (!pendingReorder || !activeTripId) return
        if (isReordering) return // 🛡️ Prevent double click
        setIsReordering(true)

        try {
            const items = pendingReorder.newOrder.map((activity, index) => {
                const baseTime = adjustTimes ? `${String(9 + Math.floor(index * 1.5)).padStart(2, '0')}:00` : null
                return {
                    item_id: activity.id,
                    sort_order: index * 10,
                    time_slot: baseTime
                }
            })

            // 🔒 Standardized: Use itemsApi.reorder with userId
            await itemsApi.reorder(items, adjustTimes, userId || "")

            toast.success(adjustTimes ? "順序與時間已更新" : "順序已更新")
            await reloadTripDetail()

        } catch (e) {
            console.error("Reorder error:", e)
            toast.error("排序更新失敗")
        } finally {
            setPendingReorder(null)
            setIsReorderDialogOpen(false)
            setIsReordering(false)
        }
    }, [pendingReorder, activeTripId, reloadTripDetail, isReordering, userId])


    // 🆕 2026: Store-based GC is now handled by the weatherStore itself

    const [dailyLocs, setDailyLocs] = useState<Record<number, DailyLocation>>({})
    const [isLocEditOpen, setIsLocEditOpen] = useState(false)
    const [currentTimezone, setCurrentTimezone] = useState<string>("Asia/Tokyo")  // 當前顯示地點的時區

    // 🔧 FIX: Clear stale data immediately when switching trips (before SWR cache loads)
    // This prevents "ghost date" flash from previous trip's cached data
    useEffect(() => {
        setDailyLocs({})  // Clear immediately
        setDay(1)         // Reset to day 1
        setWeatherData([]) // Clear weather
    }, [activeTripId])

    useEffect(() => {
        // 🔄 State Sync Fix: Always sync state with props, defaulting to empty object if null
        // This ensures that if backend clears data (e.g. Ghostbuster clean), the frontend state is also cleared.
        // 🐛 FIX: Backend stores keys as strings ("1", "2"), but frontend uses numbers (1, 2)
        // Convert string keys to number keys to ensure dailyLocs[day] works correctly
        if (currentTrip) {
            debugLog("🔍 DEBUG: currentTrip Content Dump:", {
                checklist: currentTrip.day_checklists,
                review: currentTrip.ai_review
            })

            const rawLocs = currentTrip.daily_locations || {}
            debugLog("🔍 DEBUG: currentTrip.daily_locations =", JSON.stringify(rawLocs))
            const normalizedLocs: Record<number, DailyLocation> = {}
            for (const [key, value] of Object.entries(rawLocs)) {
                normalizedLocs[Number(key)] = value as DailyLocation
            }
            debugLog("🔍 DEBUG: normalizedLocs (after conversion) =", JSON.stringify(normalizedLocs))
            setDailyLocs(normalizedLocs)
        }
    }, [currentTrip])

    // 🆕 離線快取：有網路時將行程存入 localStorage
    useEffect(() => {
        if (isOnline && currentTrip && activeTripId) {
            try {
                localStorage.setItem(`offline_trip_${activeTripId}`, JSON.stringify(currentTrip))
                debugLog(`✈️ 已快取行程: ${currentTrip.title}`)
            } catch (e) {
                console.warn("快取行程失敗:", e)
            }
        }
    }, [isOnline, currentTrip, activeTripId])
    // Get the first activity with coordinates for the current day


    useEffect(() => {
        const getFirstActivityWithCoords = () => {
            if (!currentTrip?.days) return null

            // Priority 1: Search current day
            const currentDayData = currentTrip.days.find((d) => d.day === day)
            if (currentDayData?.activities) {
                for (const activity of currentDayData.activities) {
                    if (activity.lat && activity.lng) {
                        return { lat: activity.lat, lng: activity.lng, name: activity.place || "當前行程地點" }
                    }
                }
            }

            // Priority 2: Search any day in the trip (for context)
            for (const d of currentTrip.days) {
                if (d.activities) {
                    for (const activity of d.activities) {
                        if (activity.lat && activity.lng) {
                            return { lat: activity.lat, lng: activity.lng, name: `行程參考地點: ${activity.place || ""}` }
                        }
                    }
                }
            }
            return null
        }

        // 🛑 Fix FOIC (Flash of Incorrect Content): Wait for trip to load
        if (!currentTrip) return


        // 🛡️ AbortController 防止競爭條件
        const controller = new AbortController()

        let lat = 35.6895  // Default: Tokyo
        let lng = 139.6917

        // 常見城市座標對照表（含時區）
        const CITY_COORDS: { [key: string]: { lat: number, lng: number, name: string, timezone: string } } = {
            "東京": { lat: 35.6895, lng: 139.6917, name: "東京", timezone: "Asia/Tokyo" },
            "大阪": { lat: 34.6937, lng: 135.5023, name: "大阪", timezone: "Asia/Tokyo" },
            "京都": { lat: 35.0116, lng: 135.7681, name: "京都", timezone: "Asia/Tokyo" },
            "台北": { lat: 25.0330, lng: 121.5654, name: "台北", timezone: "Asia/Taipei" },
            "高雄": { lat: 22.6273, lng: 120.3014, name: "高雄", timezone: "Asia/Taipei" },
            "台中": { lat: 24.1477, lng: 120.6736, name: "台中", timezone: "Asia/Taipei" },
            "台南": { lat: 22.9999, lng: 120.2269, name: "台南", timezone: "Asia/Taipei" },
            "橫濱": { lat: 35.4437, lng: 139.6380, name: "橫濱", timezone: "Asia/Tokyo" },
            "札幌": { lat: 43.0618, lng: 141.3545, name: "札幌", timezone: "Asia/Tokyo" },
            "福岡": { lat: 33.5904, lng: 130.4017, name: "福岡", timezone: "Asia/Tokyo" },
            "名古屋": { lat: 35.1815, lng: 136.9066, name: "名古屋", timezone: "Asia/Tokyo" },
            "沖繩": { lat: 26.2124, lng: 127.6809, name: "沖繩", timezone: "Asia/Tokyo" },
            "首爾": { lat: 37.5665, lng: 126.9780, name: "首爾", timezone: "Asia/Seoul" },
            "釜山": { lat: 35.1796, lng: 129.0756, name: "釜山", timezone: "Asia/Seoul" },
            "香港": { lat: 22.3193, lng: 114.1694, name: "香港", timezone: "Asia/Hong_Kong" },
            "新加坡": { lat: 1.3521, lng: 103.8198, name: "新加坡", timezone: "Asia/Singapore" },
            "曼谷": { lat: 13.7563, lng: 100.5018, name: "曼谷", timezone: "Asia/Bangkok" },
        }

        let activeLoc: { name: string, lat: number, lng: number } | null = null
        let found = false

        // Priority 1: Use manually set daily location (search results)
        if (dailyLocs && dailyLocs[day]) {
            activeLoc = {
                name: dailyLocs[day].name || "自定義地點",
                lat: dailyLocs[day].lat,
                lng: dailyLocs[day].lng
            }
            found = true
            for (const [cityName, coords] of Object.entries(CITY_COORDS)) {
                if (activeLoc.name.includes(cityName)) {
                    setCurrentTimezone(coords.timezone)
                    break
                }
            }
        }

        // Priority 2: Use current day activities
        if (!found) {
            const activityLoc = getFirstActivityWithCoords()
            if (activityLoc) {
                activeLoc = { name: activityLoc.name, lat: activityLoc.lat, lng: activityLoc.lng }
                found = true
            }
        }

        // Priority 3: Fallback to Trip Title
        if (!found && currentTrip?.title) {
            activeLoc = { name: currentTrip.title, lat: 35.6895, lng: 139.6917 } // Default init
            for (const [cityName, coords] of Object.entries(CITY_COORDS)) {
                if (currentTrip.title.includes(cityName)) {
                    activeLoc = { name: cityName, lat: coords.lat, lng: coords.lng }
                    setCurrentTimezone(coords.timezone)
                    found = true
                    break
                }
            }
        }

        // 🛡️ Final Guard: If still no location, default to Tokyo ONLY if we have looked everywhere
        if (!activeLoc) {
            activeLoc = { name: "東京", lat: 35.6895, lng: 139.6917 }
        }

        setResolvedLocation(activeLoc)
        lat = activeLoc.lat
        lng = activeLoc.lng

        const fetchWeather = async () => {


            // 🆕 P0: 計算行程對應的實際日期 (Timezone Safe Fix)
            let targetDate: string | null = null
            let daysFromNow = 0
            let mode: 'live' | 'forecast' | 'seasonal' | 'trend' = 'live'

            if (currentTrip?.start_date) {
                // 🛡️ Fix Timezone Off-by-one: Parse YYYY-MM-DD manually and use UTC
                const [y, m, d] = currentTrip.start_date.split('-').map(Number)
                const tripDateUTC = new Date(Date.UTC(y, m - 1, d + (day - 1)))
                targetDate = tripDateUTC.toISOString().split('T')[0]

                daysFromNow = Math.floor((tripDateUTC.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

                // 決定天氣模式
                if (daysFromNow < 0) {
                    mode = 'trend'  // 過去日期用歷史參考
                } else if (daysFromNow <= 14) {
                    mode = 'forecast'  // 14 天內用精準預報 (🛡️ Fix 400: Sync with API limit)
                } else if (daysFromNow <= 45) {
                    mode = 'seasonal'  // 14-45 天用季節預報
                } else {
                    mode = 'trend'  // 超過 45 天用趨勢參考
                }
            }

            // 🛡️ Anti-Jitter: High-Precision Coordinate Stability Check
            // 閾值: 0.001 度 (~100m) - 2026 標配
            const lastCoordsRaw = sessionStorage.getItem('last_weather_coords')
            let isLocationStable = false

            if (lastCoordsRaw) {
                try {
                    const last = JSON.parse(lastCoordsRaw)
                    const latDiff = Math.abs(last.lat - lat)
                    const lngDiff = Math.abs(last.lng - lng)
                    // 如果位移小於 100m，視為同一個地點 (Sticky Elevation)
                    if (latDiff < 0.001 && lngDiff < 0.001) {
                        isLocationStable = true
                        debugLog('📍 Sticky Location: Preserving elevation state')
                    }
                } catch { /* ignore */ }
            }

            sessionStorage.setItem('last_weather_coords', JSON.stringify({ lat, lng, date: targetDate }))

            // 🆕 清除舊數據以顯示 Skeletons 並預設正確模式
            setWeatherData([])
            setWeatherMode(mode)
            // 🚀優化：只有在位置變動較大時才清空海拔 (避免翻页閃爍)
            if (!isLocationStable) {
                const elevKey = `elev_${lat.toFixed(3)}_${lng.toFixed(3)}`
                const persisted = typeof localStorage !== 'undefined' ? localStorage.getItem(elevKey) : null
                if (persisted) {
                    setElevation(parseFloat(persisted))
                    debugLog(`📍 Geo-Cache HIT (Local): ${elevKey}`)
                } else {
                    setElevation(null)
                }
            }

            // 🆕 P8: Active Flag (防止競態條件 - Race Condition Protection)
            // 確保只有最後一次請求的結果會被寫入 State
            const currentReqId = Math.random().toString(36).substring(7)
            activeReqRef.current = currentReqId

            // 🆕 P7: 快取檢查 (避免重複請求)
            const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}_${targetDate || 'today'}`
            const cached = weatherStore.getWeatherData(lat, lng, targetDate || 'today')

            const cacheTTL = {
                live: 60 * 60 * 1000,        // 1 小時
                forecast: 60 * 60 * 1000,    // 1 小時
                seasonal: 24 * 60 * 60 * 1000, // 24 小時
                trend: 7 * 24 * 60 * 60 * 1000 // 7 天
            }

            if (cached && (Date.now() - cached.timestamp) < (cacheTTL[cached.mode] || 3600000)) {
                debugLog(`📦 Weather Neural-Store HIT: ${cacheKey}`)
                setWeatherData(cached.forecast)
                setWeatherMode(cached.mode)
                if (cached.elevation !== undefined) setElevation(cached.elevation)
                if (cached.confidenceScore !== undefined) setWeatherConfidence(cached.confidenceScore)
                return
            }

            try {
                // 🆕 P6: 嘗試使用 SDK (FlatBuffers) - 節省 70% 流量
                if (mode === 'forecast' || mode === 'live') {
                    const sdkResult = await fetchWeatherWithSDK(lat, lng, targetDate, daysFromNow)

                    // 🛡️ P8: Race Check
                    if (activeReqRef.current !== currentReqId) {
                        debugLog('🛡️ Race Condition Prevented (SDK): Stale response ignored')
                        return
                    }

                    if (sdkResult) {
                        setWeatherData(sdkResult.forecast)
                        setWeatherMode(sdkResult.mode)
                        if (sdkResult.confidenceScore !== undefined) setWeatherConfidence(sdkResult.confidenceScore)
                        if (sdkResult.elevation !== undefined) {
                            setElevation(sdkResult.elevation)
                            if (typeof localStorage !== 'undefined') {
                                localStorage.setItem(`elev_${lat.toFixed(3)}_${lng.toFixed(3)}`, sdkResult.elevation.toString())
                            }
                        }

                        weatherStore.setWeatherData(lat, lng, targetDate || 'today', sdkResult)
                        debugLog(`💾 Weather Neural-Store STORE (SDK): ${cacheKey}`)
                        return  // SDK 成功，直接返回
                    }
                }

                // JSON Fallback (SDK 失敗或不支援的模式)
                // 🆕 P2: User-Agent Header (避免商業偵測)
                const headers: HeadersInit = {
                    'User-Agent': 'RyanTravelApp/3.0 (Non-commercial travel planning tool)'
                }

                let apiUrl: string

                if (!targetDate || daysFromNow < -5 || daysFromNow > 45) {
                    // 無日期或超出範圍：用今天天氣或去年同期
                    if (targetDate && (daysFromNow < -5 || daysFromNow > 45)) {
                        // 🆕 使用去年同期 (Archive API)
                        const lastYear = new Date(targetDate)
                        lastYear.setFullYear(lastYear.getFullYear() - 1)
                        const archiveDate = lastYear.toISOString().split('T')[0]
                        apiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weather_code&start_date=${archiveDate}&end_date=${archiveDate}&timezone=auto`
                    } else {
                        // 即時天氣
                        apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=1`
                    }
                } else if (daysFromNow <= 14) {
                    // 🆕 P1: 1-14 天內使用 Forecast API (🛡️ Fix 400: Limit to 14 days)
                    apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weather_code&start_date=${targetDate}&end_date=${targetDate}&timezone=auto`
                } else {
                    // 🆕 14-45 天使用 Seasonal Forecast API (EC46) (🛡️ Fix 400: Expanded range)
                    // P12.1: 加入 wind_speed_10m_max 用於體感校正
                    apiUrl = `https://seasonal-api.open-meteo.com/v1/seasonal?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,wind_speed_10m_max&start_date=${targetDate}&end_date=${targetDate}&timezone=auto`
                }

                debugLog(`🌡️ Weather API Request: ${mode} mode`)

                const res = await fetch(apiUrl, {
                    signal: controller.signal,
                    headers
                })
                const data = await res.json()

                // 🛡️ P8: Race Check (Post-fetch)
                if (activeReqRef.current !== currentReqId) {
                    debugLog('🛡️ Race Condition Prevented (JSON): Stale response ignored')
                    return
                }

                let temps: number[]
                let codes: number[]
                const forecast: DayWeather[] = []  // 🆕 Phase 10: 提前宣告

                if (mode === 'seasonal' && data.daily) {
                    // 🆕 Phase 11: Seasonal 模式 EnsembleMean 優化
                    const getEnsembleMean = (dailyData: Record<string, number[] | undefined>, prefix: string) => {
                        const members = Object.keys(dailyData).filter(k => k.startsWith(prefix))
                        if (members.length === 0) return dailyData[prefix]?.[0]
                        const values = members.map(m => dailyData[m]?.[0]).filter(v => v !== undefined && v !== null)
                        if (values.length === 0) return undefined
                        return values.reduce((a, b) => a + b, 0) / values.length
                    }

                    const tMin = getEnsembleMean(data.daily, 'temperature_2m_min') ?? 10
                    const tMax = getEnsembleMean(data.daily, 'temperature_2m_max') ?? 20
                    const precipSum = getEnsembleMean(data.daily, 'precipitation_sum') ?? 0
                    const windSpeedMax = getEnsembleMean(data.daily, 'wind_speed_10m_max') ?? 0

                    debugLog(`📊 Seasonal Ensemble Mean (N=${Object.keys(data.daily).filter(k => k.includes('member')).length / 6}): T:${tMin.toFixed(1)}~${tMax.toFixed(1)}, P:${precipSum.toFixed(1)}, W:${windSpeedMax.toFixed(1)}`)

                    let inferredPrecipProb = 20
                    let precipTrend: 'wet' | 'unstable' | 'dry' = 'dry'
                    if (precipSum > 5) {
                        inferredPrecipProb = 80
                        precipTrend = 'wet'
                    } else if (precipSum > 1) {
                        inferredPrecipProb = 50
                        precipTrend = 'unstable'
                    }

                    // 🆕 Phase 9: 根據降雨量推測天氣代碼 (Frontend Clustering)
                    // >5mm: 雨天(63), >1mm: 小雨(51), <=1mm: 多雲(2)
                    let inferredCode = 2
                    if (precipSum > 5) inferredCode = 63
                    else if (precipSum > 1) inferredCode = 51
                    else if (precipSum <= 1) inferredCode = 1

                    // 🆕 Phase 2: 從 API 獲取日出日落時間 (注意：Seasonal API 不支援，改用固定時段或今日值)
                    let sunriseHour = 6
                    let sunsetHour = 18

                    if (data.daily && data.daily.sunrise?.[0] && data.daily.sunset?.[0]) {
                        // API 回傳 ISO 格式如 "2026-05-18T05:30"
                        const sunriseTime = new Date(data.daily.sunrise[0])
                        const sunsetTime = new Date(data.daily.sunset[0])
                        // 🔒 安全性驗證：確保日期有效
                        if (!isNaN(sunriseTime.getTime()) && !isNaN(sunsetTime.getTime())) {
                            sunriseHour = sunriseTime.getHours() + sunriseTime.getMinutes() / 60
                            sunsetHour = sunsetTime.getHours() + sunsetTime.getMinutes() / 60
                            debugLog(`🌅 Phase 2: sunrise=${sunriseHour.toFixed(1)}, sunset=${sunsetHour.toFixed(1)}`)
                        }
                    }

                    // 🆕 Phase 3: 從目標日期獲取月份用於季節調節
                    const targetMonth = targetDate ? new Date(targetDate).getMonth() + 1 : new Date().getMonth() + 1

                    // 🆕 Phase 10: 儲存海拔
                    if (data.elevation !== undefined) {
                        setElevation(data.elevation)
                        if (typeof localStorage !== 'undefined') {
                            localStorage.setItem(`elev_${lat.toFixed(3)}_${lng.toFixed(3)}`, data.elevation.toString())
                        }
                    }

                    // 🆕 Phase 4 + 6 + 9: 使用緯度、海拔、與天氣代碼進行聚類修正
                    temps = generateHourlyCurve(
                        Math.round(tMin),
                        Math.round(tMax),
                        sunriseHour,
                        sunsetHour,
                        targetMonth,
                        data.elevation,
                        lat,
                        inferredCode // 🆕 Phase 9: Weather Code
                    )
                    codes = Array(24).fill(inferredCode)  // 季節預報使用推測代碼

                    // 🆕 P12.2: 濕度動態區間 (下雨 85-95%, 多雲 65-75%, 晴天 40-60%)
                    const getDynamicHumidity = () => {
                        if (precipSum > 5) return 85 + Math.floor(Math.random() * 10)  // 85-95%
                        if (precipSum > 1) return 65 + Math.floor(Math.random() * 10)  // 65-75%
                        return 40 + Math.floor(Math.random() * 20)  // 40-60%
                    }

                    // 🆕 P12.3: 體感溫度校正 (含風速)
                    const getApparentMod = () => {
                        let mod = 0
                        if (precipSum > 1) mod -= 2      // 下雨冷
                        if (inferredCode <= 1) mod += 2  // 晴天熱
                        // P12.3: 風速校正
                        if (windSpeedMax > 20) mod -= 2  // 強風 (>20 km/h)
                        else if (windSpeedMax > 10) mod -= 1  // 中風 (>10 km/h)
                        return mod
                    }

                    // 🆕 Phase 11 + P12: 為 Seasonal 模式構建完整 forecast
                    for (let i = 0; i <= 23 && i < temps.length; i++) {
                        forecast.push({
                            time: `${i}:00`,
                            temp: Math.round(temps[i]),
                            code: codes[i] || 0,
                            precipitation_probability: inferredPrecipProb,
                            apparent_temperature: Math.round(temps[i]) + getApparentMod(),
                            humidity: getDynamicHumidity(),
                            windSpeed: Math.round(windSpeedMax),  // 🆕 P12.1: 儲存風速供 UI 顯示
                            precipTrend,
                            isSeasonalEstimate: true
                        })
                    }
                } else {
                    temps = data.hourly?.temperature_2m || []
                    codes = data.hourly?.weather_code || []

                    // Fallback JSON 模式 (手動構建)
                    for (let i = 0; i <= 23 && i < temps.length; i++) {
                        forecast.push({
                            time: `${i}:00`,
                            temp: Math.round(temps[i]),
                            code: codes[i] || 0
                            // JSON 模式沒有其他數據
                        })
                    }
                    if (data.elevation !== undefined) {
                        setElevation(data.elevation)
                        if (typeof localStorage !== 'undefined') {
                            localStorage.setItem(`elev_${lat.toFixed(3)}_${lng.toFixed(3)}`, data.elevation.toString())
                        }
                    }
                }

                // P6 SDK 模式: 直接使用 SDK 回傳的完整資料 (已在上方處理)
                // 此處的 forecast 已由上方填充

                setWeatherData(forecast)
                setWeatherMode(mode)  // 🆕 P3: 更新天氣模式

                debugLog(`💾 Weather Cache STORE: ${cacheKey}`)
            } catch (e) {
                // 忽略 AbortError（正常的取消操作）
                if ((e as Error).name !== 'AbortError') {
                    console.error("Weather error", e)
                }
            }
        }
        fetchWeather()

        // 🆕 P5: 預取相鄰天數 (day-1, day+1) 到快取
        // 🆕 2026: 能源感知型全行程背景預熱 (Trip-wide Background Pre-warming)
        const warmUpWeatherCache = async () => {
            if (!currentTrip?.start_date || !currentTrip.days) return

            // 🆕 P8: Active Flag (防止競態條件 - Race Condition Protection) for pre-warmer
            const currentReqId = Math.random().toString(36).substring(7)
            activeReqRef.current = currentReqId // Update activeReqRef for pre-warmer

            // 能源檢查：如果在 6 小時內已經預熱過此行程，則跳過
            const lastWarmupKey = `warmup_${activeTripId}`
            const lastWarmup = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(lastWarmupKey) : null
            if (lastWarmup && (Date.now() - parseInt(lastWarmup)) < 6 * 60 * 60 * 1000) {
                debugLog(`🔋 Energy Save: Skipping pre-warm for trip ${activeTripId}`)
                return
            }

            debugLog(`🚀 2026 Pre-warmer: Warming up all ${currentTrip.days.length} days...`)

            for (const tDay of currentTrip.days) {
                const dayNum = tDay.day
                const targetDate = new Date(currentTrip.start_date)
                targetDate.setDate(targetDate.getDate() + (dayNum - 1))
                const dateStr = targetDate.toISOString().split('T')[0]
                const daysFromNow = Math.floor((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

                // 2026 策略：僅預熱未來 14 天的精準預報
                if (daysFromNow < 0 || daysFromNow > 14) continue

                const dayLat = dailyLocs?.[dayNum]?.lat ?? lat
                const dayLng = dailyLocs?.[dayNum]?.lng ?? lng
                if (weatherStore.getWeatherData(dayLat, dayLng, dateStr)) continue

                // 2026: 延遲執行以避免阻塞主執行緒
                await new Promise(r => setTimeout(r, 200))

                try {
                    const result = await fetchWeatherWithSDK(dayLat, dayLng, dateStr, daysFromNow)
                    if (result && activeReqRef.current === currentReqId) {
                        weatherStore.setWeatherData(dayLat, dayLng, dateStr, result)
                    }
                } catch { /* ignore */ }
            }

            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(lastWarmupKey, Date.now().toString())
            }
        }

        // 延遲 3 秒後預取，避免阻塞主請求
        const prefetchTimer = setTimeout(warmUpWeatherCache, 3000)

        // 🛡️ Cleanup: 組件卸載或依賴變化時取消請求
        return () => {
            controller.abort()
            clearTimeout(prefetchTimer)
        }
    }, [day, dailyLocs, currentTrip, activeTripId, weatherStore])

    const handleLeaveTrip = async (tripId: string) => {
        if (leavingTripId) return // Prevent concurrent actions
        if (!confirm(t('confirm_delete') ? "您確定要退出此行程嗎？" : "Are you sure you want to leave this trip?")) return

        setLeavingTripId(tripId)
        try {
            await tripsApi.leave(tripId, userId || "")
            toast.success("已成功退出行程")
            reloadTrips() // 刷新列表，行程會立即消失
        } catch (e) {
            console.error(e)
            toast.error("退出行程失敗")
        } finally {
            setLeavingTripId(null)
        }
    }

    const handleDeleteTrip = async (tripId: string) => {
        setDeletingTripId(tripId)
    }

    const confirmDeleteTrip = async () => {
        if (!deletingTripId) return
        if (isDeleting) return
        haptic.tap()

        setIsDeleting(true)
        try {
            // 🔒 Standardized: Use tripsApi.delete with userId
            await tripsApi.delete(deletingTripId, userId || undefined)

            haptic.success()
            toast.success("行程已刪除")

            // If we're deleting the active trip, clear selection
            if (activeTripId === deletingTripId) {
                setActiveTripId(null)
            }

            // Refresh the trips list
            reloadTrips()
            setDeletingTripId(null)
        } catch (error) {
            console.error(error)
            haptic.error()
            toast.error("刪除失敗")
        } finally {
            setIsDeleting(false)
        }
    }


    // 🧠 計算位置權重 (Sequential Location Bias)
    // 旅人軌跡演算法：優先使用當日地點 > 前一日地點 > ... > 第一天
    const calculateBiasLocation = (targetDay: number) => {
        if (!dailyLocs) return undefined
        for (let d = targetDay; d >= 1; d--) {
            if (dailyLocs[d] && dailyLocs[d].lat && dailyLocs[d].lng) {
                return { lat: dailyLocs[d].lat, lng: dailyLocs[d].lng }
            }
        }
        return undefined
    }


    const handleSaveEdit = async () => {
        if (!editItem && !isAddMode) return
        if (isSavingActivity) return // 防止重複點擊
        haptic.tap() // 觸覺回饋

        setIsSavingActivity(true)

        let finalLat = editItem?.lat
        let finalLng = editItem?.lng

        // 🧠 偵測：如果地點存在但無座標，啟動智能搜尋
        if (editItem?.place && (finalLat === null || finalLat === undefined || finalLng === null || finalLng === undefined)) {
            try {
                const data = await geocodeApi.search({
                    query: editItem.place,
                    limit: 1,
                    tripTitle: currentTrip?.title
                })
                if (data.results && data.results.length > 0) {
                    finalLat = data.results[0].lat
                    finalLng = data.results[0].lng
                }
            } catch (e) {
                console.warn("⚠️ Geocoding during save failed:", e)
            }
        }

        try {
            const activityData = {
                trip_id: currentTrip?.id || "",
                day: day,
                time: editItem?.time || "10:00",
                place: editItem?.place || "",
                desc: editItem?.desc,
                category: editItem?.category,
                lat: (finalLat !== null && finalLat !== undefined && !isNaN(Number(finalLat))) ? Number(finalLat) : null,
                lng: (finalLng !== null && finalLng !== undefined && !isNaN(Number(finalLng))) ? Number(finalLng) : null,
                image_url: editItem?.image_url,
                image_urls: editItem?.image_urls,
                tags: editItem?.tags,
                memo: editItem?.memo,
                sub_items: editItem?.sub_items,
                link_url: editItem?.link_url,
                website_link: editItem?.website_link,
                preview_metadata: editItem?.preview_metadata,
                reservation_code: editItem?.reservation_code,
                cost: editItem?.cost,
                hide_navigation: editItem?.hide_navigation,
                is_private: editItem?.is_private,
                is_highlight: editItem?.is_highlight
            }

            if (isAddMode) {
                if (!currentTrip || !editItem) {
                    toast.error("參數缺失，無法新增項目")
                    return
                }
                // 🔒 Fix: Pass user_id for auth header
                await itemsApi.create({ ...activityData, trip_id: currentTrip.id, user_id: userId || "" })
            } else {
                if (!editItem || !editItem.id) {
                    console.error("❌ Edit failed: Missing ID", editItem)
                    toast.error("系統辨識異常：缺少項目 ID")
                    return
                }
                // 🔒 Fix: Pass userId as 3rd argument for auth header
                await itemsApi.update(editItem.id, activityData, userId || "")
            }
            haptic.success()
            toast.success("已儲存變更")
            setIsEditOpen(false)
            await reloadTripDetail()
        } catch (e) {
            console.error("🔥 Save activity error:", e)
            haptic.error()
            // 🆕 顯示更具體的錯誤
            toast.error(e instanceof Error ? `儲存失敗: ${e.message}` : "儲存失敗，請檢查網路連線")
        } finally {
            setIsSavingActivity(false)
        }
    }

    const handleUpdateActivity = useCallback(async (id: string, updates: Partial<Activity>): Promise<boolean> => {
        try {
            await itemsApi.update(id, updates, userId || "")
            await reloadTripDetail()
            return true
        } catch (e) {
            console.error("🔥 handleUpdateActivity error:", e)
            toast.error(e instanceof Error ? `更新失敗: ${e.message}` : "更新失敗")
            return false
        }
    }, [reloadTripDetail, userId])


    const handleDeleteItem = useCallback(async (id: string) => {
        if (!confirm(t('confirm_delete'))) return
        haptic.tap()

        // Optimistic update: immediately remove from UI
        if (currentTrip?.days) {
            const optimisticData = {
                ...currentTrip,
                days: currentTrip.days.map((d) => ({
                    ...d,
                    activities: d.activities?.filter((a) => a.id !== id) || []
                }))
            }
            reloadTripDetail(optimisticData, false)
        }

        try {
            // 🔒 Standardized: Use itemsApi.delete with userId
            await itemsApi.delete(id, userId || "")
            haptic.success()
        } catch (e) {
            console.error("🔥 Delete item error:", e)
            toast.error(e instanceof Error ? e.message : "刪除失敗，已啟動自動復原")
            await reloadTripDetail() // Revert UI
        }
    }, [t, currentTrip, reloadTripDetail, haptic, userId])

    // ⚡ Memoized Handlers for SortableTimelineCard (Fixed: Stable References)
    const handleEditActivity = useCallback((item: Activity) => {
        if (!isOnline) {
            toast.error("✈️ 離線模式下無法編輯")
            return
        }
        setIsAddMode(false)
        setEditItem({
            id: item.id,
            time: item.time || item.time_slot || "00:00",
            place: item.place || item.place_name || "",
            category: item.category || "sightseeing",
            desc: item.desc || item.notes || "",
            lat: item.lat,
            lng: item.lng,
            image_url: item.image_url,
            image_urls: item.image_urls || [],
            tags: item.tags || [],
            link_url: item.link_url || "",
            website_link: item.website_link || "",
            preview_metadata: item.preview_metadata || {},
            reservation_code: item.reservation_code || "",
            cost: item.cost ?? item.cost_amount,
            hide_navigation: !!item.hide_navigation,
            is_private: !!item.is_private,
            is_highlight: !!item.is_highlight
        })
        setIsEditOpen(true)
    }, [isOnline])

    const handleDeleteActivity = useCallback((id: string) => {
        if (!isOnline) {
            toast.error("✈️ 離線模式下無法刪除")
            return
        }
        handleDeleteItem(id)
    }, [isOnline, handleDeleteItem])

    const handleDeleteDay = async (dayNum: number) => {
        if (!currentTrip) return
        if (!confirm(`確定要刪除第 ${dayNum} 天的所有行程嗎？此操作無法復原！`)) return
        haptic.tap()

        try {
            // 1. 先發送 API 請求
            // 🔒 Standardized: Use tripsApi.deleteDay with userId
            await tripsApi.deleteDay(currentTrip.id, dayNum, userId || "")

            haptic.success()
            toast.success("已刪除")

            // 2. 調整當前選擇的日期
            if (day === dayNum && day > 1) setDay(day - 1)

            // 3. 刷新資料
            reloadTripDetail()
        } catch {
            toast.error("刪除失敗")
        }
    }

    // 🧠 Add Day Loading State


    // 🧠 Smart Clone Logic: 檢查是否有可克隆的資料 (Checklist/Notes/Location)
    const checkHasCloneableData = (sourceDay: number) => {
        if (!currentTrip) return false
        const hasNotes = (getDayData(currentTrip.day_notes, sourceDay)?.length || 0) > 0
        const hasLoc = !!dailyLocs[sourceDay]?.name
        const hasChecklist = (getDayData(currentTrip.day_checklists, sourceDay)?.length || 0) > 0
        return hasNotes || hasLoc || hasChecklist
    }

    // ⚡ 實際執行新增 API
    const executeAddDay = async (position: "before" | "end", cloneContent: boolean = false): Promise<void> => {
        if (!currentTrip) return
        setIsAddingDay(true)
        haptic.tap()

        const isOptimistic = position === "end" && !cloneContent

        if (isOptimistic) {
            const currentDays = currentTrip.days || []
            const maxDay = currentDays.length > 0 ? Math.max(...currentDays.map(d => d.day)) : 0
            const newDay = maxDay + 1
            const optimisticTrip = structuredClone(currentTrip)

            if (!optimisticTrip.days) optimisticTrip.days = []
            optimisticTrip.days.push({ day: newDay, activities: [] })

            if (!optimisticTrip.daily_locations) optimisticTrip.daily_locations = {}
            delete optimisticTrip.daily_locations[newDay]

            if (!optimisticTrip.day_notes) optimisticTrip.day_notes = {}
            optimisticTrip.day_notes[newDay] = []
            if (!optimisticTrip.day_costs) optimisticTrip.day_costs = {}
            optimisticTrip.day_costs[newDay] = []
            if (!optimisticTrip.day_tickets) optimisticTrip.day_tickets = {}
            optimisticTrip.day_tickets[newDay] = []
            if (!optimisticTrip.day_checklists) optimisticTrip.day_checklists = {}
            optimisticTrip.day_checklists[newDay] = []

            setDailyLocs(prev => {
                const updated = { ...prev }
                delete updated[newDay]
                return updated
            })

            reloadTripDetail(() => optimisticTrip, false)
            toast.success(`已成功新增第 ${newDay} 天`)
        }

        try {
            // 🔒 Standardized: Use tripsApi.addDay with userId
            const data = await tripsApi.addDay(currentTrip.id, position === "before" ? "before:1" : "end", userId || "", cloneContent)

            if (!isOptimistic) {
                toast.success(cloneContent ? `已新增第 ${data.new_day} 天 (包含克隆內容)` : `已新增第 ${data.new_day} 天`)
            }

            await reloadTripDetail()
            if (position === "before") setDay(1)
            else if (position === "end") setDay(data.new_day)

        } catch (e) {
            console.error(e)
            toast.error("新增失敗")
            reloadTripDetail()
        } finally {
            setIsAddingDay(false)
            setIsClonePromptOpen(false)
            setPendingAddDayPosition(null)
        }
    }

    const handleAddDay = async (position: "before" | "end"): Promise<void> => {
        if (!currentTrip) return

        // 判斷來源天數 (如果是 Before 1 則源自本來的 Day 1，如果是 End 則源自本來的最後一天)
        const sourceDay = position === "before" ? 1 : Math.max(...(currentTrip.days?.map(d => d.day) || [1]))

        if (checkHasCloneableData(sourceDay)) {
            setCloneSourceDay(sourceDay)
            setPendingAddDayPosition(position)
            setIsClonePromptOpen(true)
        } else {
            await executeAddDay(position, false)
        }
    }

    // Calculate total days from start_date and end_date, with fallback
    const totalDays = (() => {
        if (!currentTrip) return 7
        // First try to calculate from dates
        if (currentTrip.start_date && currentTrip.end_date) {
            const start = new Date(currentTrip.start_date)
            const end = new Date(currentTrip.end_date)
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
            }
        }
        // Fallback: use max day_number from days data
        if (currentTrip.days?.length > 0) {
            return Math.max(...currentTrip.days.map((d) => d.day || 1))
        }
        return 7
    })()
    const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1)

    // 🔧 FIX: Prevent stale date display when switching trips OR on initial load
    // SWR may return cached data from previous trip before fetching new one
    const shouldShowDateSkeleton =
        !currentTrip ||                              // No data yet (first load)
        (currentTrip.id !== activeTripId) ||         // Trip ID mismatch (switching)
        (isValidating && !currentTrip?.start_date)   // Validating with no valid date

    const getDateInfo = (dayNum: number) => {
        const start = currentTrip ? new Date(currentTrip.start_date || DEFAULT_START_DATE) : DEFAULT_START_DATE
        const d = new Date(start)
        d.setDate(d.getDate() + (dayNum - 1))
        return { date: `${d.getMonth() + 1}/${d.getDate()}`, week: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()] }
    }

    if (viewMode === 'list') {
        return (
            <div className="h-full overflow-y-auto overscroll-contain">
                <div className="flex flex-col bg-stone-50 dark:bg-slate-900 pb-32">
                    <div className="flex-1 px-6 py-12 pb-32">
                        <header className="mb-8 flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-serif text-slate-900 dark:text-slate-100 mb-2">{t('my_trips')}</h1>
                                <p className="text-slate-500 text-sm">{t('manage_journeys')}</p>
                            </div>
                            <ZenRenew onRefresh={async () => { await reloadTrips() }} successMessage={t('update_success') || "已更新"} />
                        </header>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <CreateTripModal
                                isOpen={isCreateOpen}
                                onOpenChange={setIsCreateOpen}
                                userId={userId || ""}
                                onSuccess={() => {
                                    reloadTrips()
                                    setTimeout(() => reloadTrips(), 500)
                                }}
                            />
                            <JoinTripDialog userId={userId || ""} onSuccess={reloadTrips} />
                        </div>

                        <TripList
                            trips={trips}
                            userId={userId}
                            isTripsLoading={isTripsLoading}
                            onSelectTrip={(id) => {
                                setActiveTripId(id)
                                setViewMode('detail')
                            }}
                            onDeleteTrip={handleDeleteTrip}
                            onLeaveTrip={handleLeaveTrip}
                            leavingTripId={leavingTripId}
                        />

                        {/* Delete Confirmation Dialog */}
                        <Dialog open={!!deletingTripId} onOpenChange={(open) => !open && setDeletingTripId(null)}>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="text-red-600 flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5" />
                                        {t('confirm_delete')}
                                    </DialogTitle>
                                    <DialogDescription>確定要刪除此行程嗎？此操作無法恢復。</DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <p className="text-slate-600">
                                        確定要刪除行程 <span className="font-bold text-slate-900">{trips.find((t: Trip) => t.id === deletingTripId)?.title}</span> 嗎？
                                    </p>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <Button variant="outline" onClick={() => setDeletingTripId(null)}>{t('cancel')}</Button>
                                    <Button variant="destructive" onClick={confirmDeleteTrip} disabled={isDeleting}>
                                        {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />刪除中...</> : t('delete')}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>
        )
    }


    return (
        <div className="flex-1 flex flex-col h-full bg-stone-50 dark:bg-slate-900 overflow-hidden relative">
            {/* 🆕 Phase 3: Modular Header */}

            <LocationEditDialog
                isOpen={isLocEditOpen}
                onOpenChange={setIsLocEditOpen}
                day={day}
                dailyLocs={dailyLocs}
                setDailyLocs={async (newLocs) => {
                    if (!activeTripId) return
                    try {
                        const targetLoc = newLocs[day]
                        if (!targetLoc) return

                        // 🧠 Persistence: Immediately sync to backend
                        await tripsApi.updateLocation(activeTripId, {
                            day,
                            name: targetLoc.name,
                            lat: targetLoc.lat,
                            lng: targetLoc.lng
                        }, userId || "")

                        setDailyLocs(newLocs)
                        await reloadTripDetail()
                    } catch (e) {
                        console.error("🔥 Location sync failed:", e)
                        toast.error("更新地點失敗，請檢查網路")
                    }
                }}
                currentTrip={currentTrip}
                biasLoc={calculateBiasLocation(day)}
            />

            <div className="flex-1 overflow-y-auto scroll-smooth" ref={setScrollerEl}>
                {/* 🆕 Phase 3: Modular Header - Restored to Scroll Flow (bcfeb32 parity) */}
                <ItineraryHeader
                    currentTrip={currentTrip}
                    dayNumbers={dayNumbers}
                    day={day}
                    setDay={setDay}
                    onBack={() => {
                        window.history.pushState({}, '', '/')
                        setActiveTripId(null)
                        setViewMode('list')
                    }}
                    onAddDay={handleAddDay}
                    onDeleteDay={handleDeleteDay}
                    getDateInfo={getDateInfo}
                    userId={userId}
                    onRefresh={reloadTripDetail}
                    shouldShowDateSkeleton={shouldShowDateSkeleton}
                />

                {/* 🕵️ Phase 3: Modular Weather Panel */}
                <WeatherPanel
                    day={day}
                    weatherData={weatherData}
                    weatherMode={weatherMode}
                    weatherConfidence={weatherConfidence}
                    elevation={elevation}
                    resolvedLocation={resolvedLocation}
                    currentTimezone={currentTimezone}
                    onEditLocation={() => setIsLocEditOpen(true)}
                />

                {/* AI Reviews & Tips */}
                <EditableDailyAIReview
                    key={`ai-review-${day}`}
                    tripId={activeTripId || ""}
                    day={day}
                    review={getDayData(currentTrip?.day_ai_reviews, day) || (day === 1 ? currentTrip?.ai_review : undefined)}
                    userId={userId || ""}
                    onUpdate={async () => {
                        await reloadTripDetail()
                    }}
                />

                <EditableDailyTips
                    key={`tips-${day}`}
                    tripId={activeTripId || ""}
                    day={day}
                    notes={getDayData(currentTrip?.day_notes, day) || []}
                    costs={getDayData(currentTrip?.day_costs, day) || []}
                    tickets={getDayData(currentTrip?.day_tickets, day) || []}
                    userId={userId || undefined}
                    onUpdate={async (type, data) => {
                        if (!activeTripId) return false
                        try {
                            const updatePayload: Record<string, unknown> = {}
                            if (type === "notes") updatePayload.day_notes = { [day]: data }
                            if (type === "costs") updatePayload.day_costs = { [day]: data }
                            if (type === "tickets") updatePayload.day_tickets = { [day]: data }

                            await tripsApi.updateDayData(activeTripId, day, updatePayload, userId || "")
                            await reloadTripDetail()
                            return true
                        } catch (e) {
                            console.error("Failed to update day data:", e)
                            toast.error("更新失敗")
                            return false
                        }
                    }}
                />

                <EditableDailyChecklist
                    key={`checklist-${day}`}
                    tripId={activeTripId || ""}
                    day={day}
                    items={day === 1 ? (() => {
                        const d0 = getDayData(currentTrip?.day_checklists, 0) || [];
                        const d1 = getDayData(currentTrip?.day_checklists, 1) || [];
                        // 🛡️ L4 深度防禦：使用 Map 依據 ID 去重，防止 React Key 衝突導致崩潰
                        const uniqueMap = new Map();
                        [...d0, ...d1].forEach(item => { if (item.id) uniqueMap.set(item.id, item); });
                        return Array.from(uniqueMap.values()) as ChecklistItem[];
                    })() : (getDayData(currentTrip?.day_checklists, day) || [])}
                    userId={userId || undefined}
                    onUpdate={async (items) => {
                        if (!activeTripId) return false
                        try {
                            // 1. Update current day items
                            await tripsApi.updateDayData(activeTripId, day, {
                                day_checklists: { [day]: items }
                            }, userId || "")

                            // 2. Clear Day 0 items if they were merged into Day 1 (bcfeb32 parity)
                            // If user is editing Day 1 and there are items in Day 0 (pre-trip), we assume they are now merged and should be cleared from Day 0
                            const hasDay0Items = (getDayData(currentTrip?.day_checklists, 0)?.length || 0) > 0
                            if (day === 1 && hasDay0Items) {
                                debugLog("🕵️ Detecting Day 0 items after merge, clearing Day 0...")
                                await tripsApi.updateDayData(activeTripId, 0, {
                                    day_checklists: { "0": [] }
                                }, userId || "")
                            }

                            await reloadTripDetail()
                            return true
                        } catch (e) {
                            console.error("Failed to update checklist:", e)
                            toast.error("更新失敗")
                            return false
                        }
                    }}
                />

                {/* 🕵️ Phase 3: Modular Timeline */}
                <ItineraryTimeline
                    currentDayData={currentDayData}
                    dndSensors={dndSensors}
                    handleDragStart={handleDragStart}
                    handleDragEnd={handleDragEnd}
                    handleDragCancel={handleDragCancel}
                    itnVirtuosoRef={itnVirtuosoRef}
                    scrollerEl={scrollerEl}
                    onEditActivity={handleEditActivity}
                    onDeleteActivity={handleDeleteActivity}
                    onUpdateActivity={handleUpdateActivity}
                    activeId={activeId}
                    isOnline={isOnline}
                    mounted={mounted}
                    onAddActivity={() => {
                        setIsAddMode(true);
                        setEditItem({ time: "10:00", place: "", desc: "", category: "sightseeing", lat: null, lng: null, tags: [] });
                        setIsEditOpen(true);
                    }}
                    onAddPOI={handleAddPOI}
                    currentTrip={currentTrip}
                />
            </div>

            <ActivityEditModal
                isOpen={isEditOpen}
                onOpenChange={setIsEditOpen}
                editItem={editItem}
                setEditItem={setEditItem}
                isAddMode={isAddMode}
                isSaving={isSavingActivity}
                onSave={handleSaveEdit}
                dailyLoc={dailyLocs[day]}
                tripTitle={currentTrip?.title}
                biasLoc={calculateBiasLocation(day)}
            />

            {/* Reorder Confirmation Dialog */}
            <AlertDialog open={isReorderDialogOpen} onOpenChange={setIsReorderDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>調整順序方式</AlertDialogTitle>
                        <AlertDialogDescription>
                            請選擇如何處理時間：
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
                        <Button
                            className="w-full"
                            onClick={() => handleReorderConfirm(false)}
                            disabled={isReordering}
                        >
                            {isReordering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "🕐"} 保持原時間
                        </Button>
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => handleReorderConfirm(true)}
                            disabled={isReordering}
                        >
                            {isReordering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "⏱️"} 自動調整時間
                        </Button>
                        <AlertDialogCancel className="w-full" disabled={isReordering}>取消</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 🆕 Smart Clone Confirmation Dialog */}
            <AlertDialog open={isClonePromptOpen} onOpenChange={setIsClonePromptOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>是否複製前一天的初始設定？</AlertDialogTitle>
                        <AlertDialogDescription>
                            我們偵測到 Day {cloneSourceDay} 有設置<b>天氣地點、筆記或清單</b>。
                            <br /><br />
                            您是否想要將這些設定同步到新的一天，節省重複輸入的時間？
                            <br />
                            <span className="text-xs text-slate-500">(註：具體行程活動不會被複製)</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={isAddingDay}
                            onClick={() => pendingAddDayPosition && executeAddDay(pendingAddDayPosition, false)}
                        >
                            {isAddingDay ? "處理中..." : "新增空白天數"}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isAddingDay}
                            onClick={() => pendingAddDayPosition && executeAddDay(pendingAddDayPosition, true)}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400"
                        >
                            {isAddingDay ? <><Loader2 className="w-4 h-4 mr-1" />處理中...</> : "是的，複製並新增"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
