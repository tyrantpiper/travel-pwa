"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
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

import { WeatherPanel } from "@/components/itinerary/WeatherPanel"
import { LocationEditDialog } from "@/components/itinerary/LocationEditDialog"
import { TripList } from "@/components/itinerary/TripList"
import { ItineraryHeader } from "@/components/itinerary/ItineraryHeader"
import { ItineraryTimeline } from "@/components/itinerary/ItineraryTimeline"
import { TripMasterOverview } from "@/components/itinerary/TripMasterOverview"
import { CalendarRangeSheet } from "@/components/itinerary/CalendarRangeSheet"

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
    const { activeTripId, mutate: reloadTrips, userId, trips, setActiveTripId, isLoading: isTripsLoading, handleTripNotFound } = useTripContext()
    const setFocusedDay = useTripStore((s) => s.setFocusedDay)
    const [viewMode, setViewMode] = useState<'list' | 'detail'>('list')

    // 🆕 Hyper-Heuristics: Dynamic Polling Interval
    const refreshInterval = useDynamicPolling()

    // Use activeTripId from context, pass userId for privacy filtering
    const { trip: currentTrip, mutate: reloadTripDetail, isValidating } = useTripDetail(activeTripId, userId, refreshInterval, handleTripNotFound) as { trip: Trip, mutate: (data?: unknown, shouldRevalidate?: boolean) => Promise<void>, isValidating: boolean }
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

    const originalUrlRef = useRef<string>("")

    // 🆕 Calendar Range Picker States
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
    const [pendingShortenDates, setPendingShortenDates] = useState<{ start_date: string; end_date: string } | null>(null)
    const [isUpdatingDates, setIsUpdatingDates] = useState(false)


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

            toast.success(t('iv_added_to_trip'))
            // 立即重整
            await reloadTripDetail()
        } catch (error) {
            console.error(error)
            toast.error(t('iv_add_to_trip_failed'))
        }
    }


    const [day, setDay] = useState(1)

    // 🆕 2026: Integrated global refresh event listener
    useEffect(() => {
        const handleRefresh = () => {
            debugLog("🔄 ItineraryView: Global refresh triggered via Tab Hub")
            reloadTripDetail()
            reloadTrips()
        }
        window.addEventListener('refresh-active-view', handleRefresh)
        return () => window.removeEventListener('refresh-active-view', handleRefresh)
    }, [reloadTripDetail, reloadTrips])

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
    const prewarmerReqRef = useRef<string | null>(null) // 🆕 Phase 25: 專屬預熱隔離 Ref
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
            toast.error("✈️ " + t('iv_offline_reorder'))
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
    }, [currentDayData, isOnline, t])

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

            toast.success(adjustTimes ? t('iv_reorder_with_time') : t('iv_reorder_done'))
            await reloadTripDetail()

        } catch (e) {
            console.error("Reorder error:", e)
            toast.error(t('iv_reorder_failed'))
        } finally {
            setPendingReorder(null)
            setIsReorderDialogOpen(false)
            setIsReordering(false)
        }
    }, [pendingReorder, activeTripId, reloadTripDetail, isReordering, userId, t])


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
                        return { lat: activity.lat, lng: activity.lng, name: activity.place || t('iv_current_location') }
                    }
                }
            }

            // Priority 2: Search any day in the trip (for context)
            for (const d of currentTrip.days) {
                if (d.activities) {
                    for (const activity of d.activities) {
                        if (activity.lat && activity.lng) {
                            return { lat: activity.lat, lng: activity.lng, name: t('iv_estimated_location', { place: activity.place || "" }) }
                        }
                    }
                }
            }
            return null
        }

        // 🛑 Fix FOIC (Flash of Incorrect Content): Wait for trip to load
        // 🛡️ Overview Guard: Skip single-day weather calculation when in Master Overview (day === 0)
        if (!currentTrip || day === 0) return


        // 🛡️ AbortController 防止競爭條件
        const controller = new AbortController()

        let lat = 35.6895  // Default: Tokyo
        let lng = 139.6917

        // 常見城市座標對照表（含時區）
        const CITY_COORDS: { [key: string]: { lat: number, lng: number, name: string, timezone: string } } = {
            // 日本主要都道府縣與觀光大區
            "東京": { lat: 35.6895, lng: 139.6917, name: "東京", timezone: "Asia/Tokyo" },
            "Tokyo": { lat: 35.6895, lng: 139.6917, name: "Tokyo", timezone: "Asia/Tokyo" },
            "大阪": { lat: 34.6937, lng: 135.5023, name: "大阪", timezone: "Asia/Tokyo" },
            "Osaka": { lat: 34.6937, lng: 135.5023, name: "Osaka", timezone: "Asia/Tokyo" },
            "京都": { lat: 35.0116, lng: 135.7681, name: "京都", timezone: "Asia/Tokyo" },
            "Kyoto": { lat: 35.0116, lng: 135.7681, name: "Kyoto", timezone: "Asia/Tokyo" },
            "北海道": { lat: 43.0618, lng: 141.3545, name: "北海道", timezone: "Asia/Tokyo" },
            "Hokkaido": { lat: 43.0618, lng: 141.3545, name: "Hokkaido", timezone: "Asia/Tokyo" },
            "札幌": { lat: 43.0618, lng: 141.3545, name: "札幌", timezone: "Asia/Tokyo" },
            "Sapporo": { lat: 43.0618, lng: 141.3545, name: "Sapporo", timezone: "Asia/Tokyo" },
            "函館": { lat: 41.7687, lng: 140.7288, name: "函館", timezone: "Asia/Tokyo" },
            "Hakodate": { lat: 41.7687, lng: 140.7288, name: "Hakodate", timezone: "Asia/Tokyo" },
            "小樽": { lat: 43.1907, lng: 140.9947, name: "小樽", timezone: "Asia/Tokyo" },
            "Otaru": { lat: 43.1907, lng: 140.9947, name: "Otaru", timezone: "Asia/Tokyo" },
            "旭川": { lat: 43.7706, lng: 142.3650, name: "旭川", timezone: "Asia/Tokyo" },
            "Asahikawa": { lat: 43.7706, lng: 142.3650, name: "Asahikawa", timezone: "Asia/Tokyo" },
            "富良野": { lat: 43.3421, lng: 142.3832, name: "富良野", timezone: "Asia/Tokyo" },
            "Furano": { lat: 43.3421, lng: 142.3832, name: "Furano", timezone: "Asia/Tokyo" },
            "二世谷": { lat: 42.8622, lng: 140.7042, name: "二世谷", timezone: "Asia/Tokyo" },
            "新雪谷": { lat: 42.8622, lng: 140.7042, name: "新雪谷", timezone: "Asia/Tokyo" },
            "Niseko": { lat: 42.8622, lng: 140.7042, name: "Niseko", timezone: "Asia/Tokyo" },
            "福岡": { lat: 33.5904, lng: 130.4017, name: "福岡", timezone: "Asia/Tokyo" },
            "Fukuoka": { lat: 33.5904, lng: 130.4017, name: "Fukuoka", timezone: "Asia/Tokyo" },
            "名古屋": { lat: 35.1815, lng: 136.9066, name: "名古屋", timezone: "Asia/Tokyo" },
            "Nagoya": { lat: 35.1815, lng: 136.9066, name: "Nagoya", timezone: "Asia/Tokyo" },
            "沖繩": { lat: 26.2124, lng: 127.6809, name: "沖繩", timezone: "Asia/Tokyo" },
            "那霸": { lat: 26.2124, lng: 127.6809, name: "那霸", timezone: "Asia/Tokyo" },
            "Okinawa": { lat: 26.2124, lng: 127.6809, name: "Okinawa", timezone: "Asia/Tokyo" },
            "石垣島": { lat: 24.3448, lng: 124.1572, name: "石垣島", timezone: "Asia/Tokyo" },
            "宮古島": { lat: 24.8055, lng: 125.2811, name: "宮古島", timezone: "Asia/Tokyo" },
            "仙台": { lat: 38.2682, lng: 140.8694, name: "仙台", timezone: "Asia/Tokyo" },
            "Sendai": { lat: 38.2682, lng: 140.8694, name: "Sendai", timezone: "Asia/Tokyo" },
            "青森": { lat: 40.8222, lng: 140.7474, name: "青森", timezone: "Asia/Tokyo" },
            "Aomori": { lat: 40.8222, lng: 140.7474, name: "Aomori", timezone: "Asia/Tokyo" },
            "金澤": { lat: 36.5613, lng: 136.6562, name: "金澤", timezone: "Asia/Tokyo" },
            "Kanazawa": { lat: 36.5613, lng: 136.6562, name: "Kanazawa", timezone: "Asia/Tokyo" },
            "輕井澤": { lat: 36.3488, lng: 138.6358, name: "輕井澤", timezone: "Asia/Tokyo" },
            "Karuizawa": { lat: 36.3488, lng: 138.6358, name: "Karuizawa", timezone: "Asia/Tokyo" },
            "日光": { lat: 36.7554, lng: 139.5986, name: "日光", timezone: "Asia/Tokyo" },
            "Nikko": { lat: 36.7554, lng: 139.5986, name: "Nikko", timezone: "Asia/Tokyo" },
            "橫濱": { lat: 35.4437, lng: 139.6380, name: "橫濱", timezone: "Asia/Tokyo" },
            "Yokohama": { lat: 35.4437, lng: 139.6380, name: "Yokohama", timezone: "Asia/Tokyo" },
            "神戶": { lat: 34.6901, lng: 135.1955, name: "神戶", timezone: "Asia/Tokyo" },
            "Kobe": { lat: 34.6901, lng: 135.1955, name: "Kobe", timezone: "Asia/Tokyo" },
            "奈良": { lat: 34.6851, lng: 135.8048, name: "奈良", timezone: "Asia/Tokyo" },
            "Nara": { lat: 34.6851, lng: 135.8048, name: "Nara", timezone: "Asia/Tokyo" },
            "廣島": { lat: 34.3853, lng: 132.4553, name: "廣島", timezone: "Asia/Tokyo" },
            "Hiroshima": { lat: 34.3853, lng: 132.4553, name: "Hiroshima", timezone: "Asia/Tokyo" },

            // 台灣全區
            "台北": { lat: 25.0330, lng: 121.5654, name: "台北", timezone: "Asia/Taipei" },
            "Taipei": { lat: 25.0330, lng: 121.5654, name: "Taipei", timezone: "Asia/Taipei" },
            "新北": { lat: 25.0169, lng: 121.4628, name: "新北", timezone: "Asia/Taipei" },
            "New Taipei": { lat: 25.0169, lng: 121.4628, name: "New Taipei", timezone: "Asia/Taipei" },
            "台中": { lat: 24.1477, lng: 120.6736, name: "台中", timezone: "Asia/Taipei" },
            "Taichung": { lat: 24.1477, lng: 120.6736, name: "Taichung", timezone: "Asia/Taipei" },
            "台南": { lat: 22.9999, lng: 120.2269, name: "台南", timezone: "Asia/Taipei" },
            "Tainan": { lat: 22.9999, lng: 120.2269, name: "Tainan", timezone: "Asia/Taipei" },
            "高雄": { lat: 22.6273, lng: 120.3014, name: "高雄", timezone: "Asia/Taipei" },
            "Kaohsiung": { lat: 22.6273, lng: 120.3014, name: "Kaohsiung", timezone: "Asia/Taipei" },
            "花蓮": { lat: 23.9872, lng: 121.6016, name: "花蓮", timezone: "Asia/Taipei" },
            "Hualien": { lat: 23.9872, lng: 121.6016, name: "Hualien", timezone: "Asia/Taipei" },
            "台東": { lat: 22.7583, lng: 121.1444, name: "台東", timezone: "Asia/Taipei" },
            "Taitung": { lat: 22.7583, lng: 121.1444, name: "Taitung", timezone: "Asia/Taipei" },
            "宜蘭": { lat: 24.7570, lng: 121.7530, name: "宜蘭", timezone: "Asia/Taipei" },
            "Yilan": { lat: 24.7570, lng: 121.7530, name: "Yilan", timezone: "Asia/Taipei" },
            "新竹": { lat: 24.8138, lng: 120.9675, name: "新竹", timezone: "Asia/Taipei" },
            "澎湖": { lat: 23.5711, lng: 119.5793, name: "澎湖", timezone: "Asia/Taipei" },
            "金門": { lat: 24.4493, lng: 118.3766, name: "金門", timezone: "Asia/Taipei" },

            // 國際熱門旅遊目的地 (全球通用)
            "首爾": { lat: 37.5665, lng: 126.9780, name: "首爾", timezone: "Asia/Seoul" },
            "Seoul": { lat: 37.5665, lng: 126.9780, name: "Seoul", timezone: "Asia/Seoul" },
            "釜山": { lat: 35.1796, lng: 129.0756, name: "釜山", timezone: "Asia/Seoul" },
            "Busan": { lat: 35.1796, lng: 129.0756, name: "Busan", timezone: "Asia/Seoul" },
            "香港": { lat: 22.3193, lng: 114.1694, name: "香港", timezone: "Asia/Hong_Kong" },
            "Hong Kong": { lat: 22.3193, lng: 114.1694, name: "Hong Kong", timezone: "Asia/Hong_Kong" },
            "新加坡": { lat: 1.3521, lng: 103.8198, name: "新加坡", timezone: "Asia/Singapore" },
            "Singapore": { lat: 1.3521, lng: 103.8198, name: "Singapore", timezone: "Asia/Singapore" },
            "曼谷": { lat: 13.7563, lng: 100.5018, name: "曼谷", timezone: "Asia/Bangkok" },
            "Bangkok": { lat: 13.7563, lng: 100.5018, name: "Bangkok", timezone: "Asia/Bangkok" },
            "清邁": { lat: 18.7883, lng: 98.9853, name: "清邁", timezone: "Asia/Bangkok" },
            "Chiang Mai": { lat: 18.7883, lng: 98.9853, name: "Chiang Mai", timezone: "Asia/Bangkok" },
            "峴港": { lat: 16.0544, lng: 108.2022, name: "峴港", timezone: "Asia/Ho_Chi_Minh" },
            "Da Nang": { lat: 16.0544, lng: 108.2022, name: "Da Nang", timezone: "Asia/Ho_Chi_Minh" },
            "峇里島": { lat: -8.4095, lng: 115.1889, name: "峇里島", timezone: "Asia/Makassar" },
            "巴里島": { lat: -8.4095, lng: 115.1889, name: "巴里島", timezone: "Asia/Makassar" },
            "Bali": { lat: -8.4095, lng: 115.1889, name: "Bali", timezone: "Asia/Makassar" },
            "冰島": { lat: 64.9631, lng: -19.0208, name: "冰島", timezone: "Atlantic/Reykjavik" },
            "Iceland": { lat: 64.9631, lng: -19.0208, name: "Iceland", timezone: "Atlantic/Reykjavik" },
            "雷克雅維克": { lat: 64.1466, lng: -21.9426, name: "雷克雅維克", timezone: "Atlantic/Reykjavik" },
            "Reykjavik": { lat: 64.1466, lng: -21.9426, name: "Reykjavik", timezone: "Atlantic/Reykjavik" },
            "巴黎": { lat: 48.8566, lng: 2.3522, name: "巴黎", timezone: "Europe/Paris" },
            "Paris": { lat: 48.8566, lng: 2.3522, name: "Paris", timezone: "Europe/Paris" },
            "倫敦": { lat: 51.5074, lng: -0.1278, name: "倫敦", timezone: "Europe/London" },
            "London": { lat: 51.5074, lng: -0.1278, name: "London", timezone: "Europe/London" },
            "紐約": { lat: 40.7128, lng: -74.0060, name: "紐約", timezone: "America/New_York" },
            "New York": { lat: 40.7128, lng: -74.0060, name: "New York", timezone: "America/New_York" },
            "瑞士": { lat: 46.8182, lng: 8.2275, name: "瑞士", timezone: "Europe/Zurich" },
            "蘇黎世": { lat: 47.3769, lng: 8.5417, name: "蘇黎世", timezone: "Europe/Zurich" },
            "Zurich": { lat: 47.3769, lng: 8.5417, name: "Zurich", timezone: "Europe/Zurich" },
            "羅馬": { lat: 41.9028, lng: 12.4964, name: "羅馬", timezone: "Europe/Rome" },
            "Rome": { lat: 41.9028, lng: 12.4964, name: "Rome", timezone: "Europe/Rome" },
        }

        let activeLoc: { name: string, lat: number, lng: number } | null = null
        let found = false

        // Priority 1: Use manually set daily location (search results)
        if (dailyLocs && dailyLocs[day]) {
            activeLoc = {
                name: dailyLocs[day].name || t('iv_custom_location'),
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

                // 🛡️ Fix daysFromNow Off-by-one: 比較相對於 UTC 午夜的時間，避免時區偏移
                const now = new Date()
                const nowUTCMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
                daysFromNow = Math.round((tripDateUTC.getTime() - nowUTCMidnight.getTime()) / (1000 * 60 * 60 * 24))

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
            prewarmerReqRef.current = currentReqId // 🆕 Phase 25: 使用隔離 Ref，不與主執行軌跡衝突

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
                
                // 🛡️ Fix daysFromNow Off-by-one: 對齊當前的 UTC 午夜進行計算
                const now = new Date()
                const nowUTCMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
                const daysFromNow = Math.round((targetDate.getTime() - nowUTCMidnight.getTime()) / (1000 * 60 * 60 * 24))

                // 2026 策略：僅預熱未來 14 天的精準預報
                if (daysFromNow < 0 || daysFromNow > 14) continue

                const dayLat = dailyLocs?.[dayNum]?.lat ?? lat
                const dayLng = dailyLocs?.[dayNum]?.lng ?? lng
                if (weatherStore.getWeatherData(dayLat, dayLng, dateStr)) continue

                // 2026: 延遲執行以避免阻塞主執行緒
                await new Promise(r => setTimeout(r, 200))

                try {
                    const result = await fetchWeatherWithSDK(dayLat, dayLng, dateStr, daysFromNow)
                    // 🆕 Phase 25: 檢查隔離 Ref，確保預熱請求的過時結果不會干擾當前視圖
                    if (result && prewarmerReqRef.current === currentReqId) {
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
    }, [day, dailyLocs, currentTrip, activeTripId, weatherStore, t])

    const handleLeaveTrip = async (tripId: string) => {
        if (leavingTripId) return // Prevent concurrent actions
        if (!confirm(t('iv_leave_confirm'))) return

        setLeavingTripId(tripId)
        try {
            await tripsApi.leave(tripId, userId || "")
            toast.success(t('iv_left_trip'))
            reloadTrips() // 刷新列表，行程會立即消失
        } catch (e) {
            console.error(e)
            toast.error(t('iv_leave_failed'))
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
            toast.success(t('iv_trip_deleted'))

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
            toast.error(t('iv_delete_failed'))
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

        // 🌟 2026 絕對信任協議 (Absolute Trust Protocol)
        // 條件：UI 畫面上是什麼經緯度，打死就存什麼經緯度，系統不准背後偷改！
        let finalLat = editItem?.lat !== undefined ? editItem.lat : null
        let finalLng = editItem?.lng !== undefined ? editItem.lng : null

        // 🧠 JIT 救援守衛：如果經緯度真的是空的 (例如新增活動時)，才嘗試用名稱執行最後攔截
        if (!editItem?.isManualCoords && editItem?.place && (finalLat === null || finalLng === null)) {
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
                address: editItem?.address, // <=== 🌟 加入這行關鍵的通訊血脈
                desc: editItem?.desc,
                category: editItem?.category,
                lat: (finalLat !== null && finalLat !== "" && !isNaN(parseFloat(String(finalLat)))) ? parseFloat(String(finalLat)) : (finalLat === null || finalLat === "" ? null : undefined),
                lng: (finalLng !== null && finalLng !== "" && !isNaN(parseFloat(String(finalLng)))) ? parseFloat(String(finalLng)) : (finalLng === null || finalLng === "" ? null : undefined),
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
                    toast.error(t('iv_missing_params'))
                    return
                }
                // 🔒 Fix: Pass user_id for auth header
                await itemsApi.create({ ...activityData, trip_id: currentTrip.id, user_id: userId || "" })
            } else {
                if (!editItem || !editItem.id) {
                    console.error("❌ Edit failed: Missing ID", editItem)
                    toast.error(t('iv_missing_id'))
                    return
                }
                // 🔒 Fix: Pass userId as 3rd argument for auth header
                await itemsApi.update(editItem.id, activityData, userId || "")
            }
            haptic.success()
            toast.success(t('iv_saved'))
            setIsEditOpen(false)
            await reloadTripDetail()
        } catch (e) {
            console.error("🔥 Save activity error:", e)
            haptic.error()
            // 🆕 顯示更具體的錯誤
            toast.error(e instanceof Error ? `${t('iv_save_failed_prefix')}${e.message}` : t('iv_save_failed'))
        } finally {
            setIsSavingActivity(false)
        }
    }

    const handleUpdateActivity = useCallback(async (id: string, updates: Partial<Activity>, skipRevalidation?: boolean): Promise<boolean> => {
        // 🚀 Optimistic Update: Immediately reflect changes in UI
        if (currentTrip?.days) {
            const optimisticData = {
                ...currentTrip,
                days: currentTrip.days.map(d => ({
                    ...d,
                    activities: d.activities?.map(a =>
                        a.id === id ? { ...a, ...updates } : a
                    ) || []
                }))
            }
            reloadTripDetail(optimisticData, false)
        }

        try {
            await itemsApi.update(id, updates, userId || "")
            // Finish by revalidating with server data
            if (!skipRevalidation) {
                await reloadTripDetail()
            }
            return true
        } catch (e) {
            console.error("🔥 handleUpdateActivity error:", e)
            toast.error(e instanceof Error ? `${t('iv_update_failed_prefix')}${e.message}` : t('iv_update_failed_short'))
            // 🛡️ Rollback to last known good state from server
            if (!skipRevalidation) {
                await reloadTripDetail()
            }
            return false
        }
    }, [currentTrip, reloadTripDetail, userId, t])


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
            toast.error(e instanceof Error ? e.message : t('iv_delete_item_failed'))
            await reloadTripDetail() // Revert UI
        }
    }, [t, currentTrip, reloadTripDetail, haptic, userId])

    // ⚡ Memoized Handlers for SortableTimelineCard (Fixed: Stable References)
    const handleEditActivity = useCallback((item: Activity) => {
        if (!isOnline) {
            toast.error("✈️ " + t('iv_offline_edit'))
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
            is_highlight: !!item.is_highlight,
            isManualCoords: false // 🆕 初始化為非手動
        })
        originalUrlRef.current = item.link_url || "" // 🆕 捕獲初始網址
        setIsEditOpen(true)
    }, [isOnline, t])

    const handleDeleteActivity = useCallback((id: string) => {
        if (!isOnline) {
            toast.error("✈️ " + t('iv_offline_delete'))
            return
        }
        handleDeleteItem(id)
    }, [isOnline, handleDeleteItem, t])

    const handleDeleteDay = async (dayNum: number) => {
        if (!currentTrip) return
        if (!confirm(t('iv_delete_day_confirm', { day: String(dayNum) }))) return
        haptic.tap()

        try {
            // 1. 先發送 API 請求
            // 🔒 Standardized: Use tripsApi.deleteDay with userId
            await tripsApi.deleteDay(currentTrip.id, dayNum, userId || "")

            haptic.success()
            toast.success(t('iv_day_deleted'))

            // 2. 調整當前選擇的日期
            if (day === dayNum && day > 1) setDay(day - 1)

            // 3. 刷新資料
            reloadTripDetail()
        } catch {
            toast.error(t('iv_delete_failed'))
        }
    }

    // 🧠 Add Day Loading State


    // 📅 實際執行日期更新 API
    const executeDateRangeUpdate = async (startDate: string, endDate: string, onShorten: "merge" | "delete" = "merge") => {
        if (!currentTrip) return
        setIsUpdatingDates(true)
        haptic.tap()

        try {
            await tripsApi.updateDates(currentTrip.id, {
                start_date: startDate,
                end_date: endDate,
                on_shorten: onShorten
            }, userId || "")

            // Invalidate weather cache
            setWeatherData([])
            await reloadTripDetail()
            toast.success(t('cal_updated_success') || "行程日期已成功更新！")
        } catch (e) {
            console.error("🔥 Failed to update trip dates:", e)
            toast.error(t('iv_update_failed_short') || "更新日期失敗")
        } finally {
            setIsUpdatingDates(false)
            setIsDatePickerOpen(false)
            setPendingShortenDates(null)
        }
    }

    const handleDateRangeChange = async (newStartDate: string, newEndDate: string) => {
        if (!currentTrip) return

        const oldStartStr = (currentTrip.start_date || "").split('T')[0]
        const oldEndStr = (currentTrip.end_date || oldStartStr).split('T')[0]

        if (oldStartStr && oldEndStr) {
            const [oy1, om1, od1] = oldStartStr.split('-').map(Number)
            const [oy2, om2, od2] = oldEndStr.split('-').map(Number)
            const [ny1, nm1, nd1] = newStartDate.split('-').map(Number)
            const [ny2, nm2, nd2] = newEndDate.split('-').map(Number)

            const oldDays = Math.max(1, Math.round((new Date(oy2, om2 - 1, od2).getTime() - new Date(oy1, om1 - 1, od1).getTime()) / (1000 * 60 * 60 * 24)) + 1)
            const newDays = Math.max(1, Math.round((new Date(ny2, nm2 - 1, nd2).getTime() - new Date(ny1, nm1 - 1, nd1).getTime()) / (1000 * 60 * 60 * 24)) + 1)

            // If shortening and truncated days have items, show safety confirmation dialog
            if (newDays < oldDays) {
                const hasItemsInTruncatedDays = (currentTrip.days || []).some(d => d.day > newDays && (d.activities || []).length > 0)
                if (hasItemsInTruncatedDays) {
                    setPendingShortenDates({ start_date: newStartDate, end_date: newEndDate })
                    return
                }
            }
        }

        await executeDateRangeUpdate(newStartDate, newEndDate, "merge")
    }

    // Calculate total days from start_date and end_date, with fallback
    const totalDays = (() => {
        if (!currentTrip) return 7
        let daysFromDates = 1
        // First try to calculate from dates
        if (currentTrip.start_date && currentTrip.end_date) {
            const [sy, sm, sd] = currentTrip.start_date.split('T')[0].split('-').map(Number)
            const [ey, em, ed] = currentTrip.end_date.split('T')[0].split('-').map(Number)
            const start = new Date(sy, sm - 1, sd)
            const end = new Date(ey, em - 1, ed)
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                daysFromDates = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
            }
        }
        // 🛡️ 雙重防禦守衛：以「日期計算天數」與「景點實際最大天數」取最大值，絕不隱藏任何一天！
        const maxDayFromItems = currentTrip.days?.length > 0
            ? Math.max(...currentTrip.days.map((d) => d.day || 1))
            : 1
        return Math.max(daysFromDates, maxDayFromItems)
    })()
    const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1)

    // 🔧 FIX: Prevent stale date display when switching trips OR on initial load
    // SWR may return cached data from previous trip before fetching new one
    const shouldShowDateSkeleton =
        !currentTrip ||                              // No data yet (first load)
        (currentTrip.id !== activeTripId) ||         // Trip ID mismatch (switching)
        (isValidating && !currentTrip?.start_date)   // Validating with no valid date

    const getDateInfo = (dayNum: number) => {
        const rawStart = currentTrip?.start_date
        if (rawStart) {
            const [y, m, d] = rawStart.split('T')[0].split('-').map(Number)
            const dt = new Date(y, m - 1, d + (dayNum - 1))
            return { 
                date: `${dt.getMonth() + 1}/${dt.getDate()}`, 
                week: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][dt.getDay()] 
            }
        }
        const now = new Date()
        const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (dayNum - 1))
        return { 
            date: `${dt.getMonth() + 1}/${dt.getDate()}`, 
            week: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][dt.getDay()] 
        }
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-stone-50 dark:bg-slate-900 overflow-hidden relative">
            <AnimatePresence mode="wait" initial={false}>
                {viewMode === 'list' ? (
                    <motion.div
                        key="trip-list"
                        initial={{ opacity: 0, x: "-20%" }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: "-20%" }}
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className="w-full h-full overflow-y-auto overscroll-contain bg-stone-50 dark:bg-slate-900 gpu-layer-accelerated"
                    >
                        <div className="flex flex-col bg-stone-50 dark:bg-slate-900 pb-32">
                            <div className="flex-1 px-6 py-12 pb-32">
                                <header className="mb-8 flex justify-between items-start">
                                    <div>
                                        <h1 className="text-3xl font-serif text-slate-900 dark:text-slate-100 mb-2">{t('my_trips')}</h1>
                                        <p className="text-slate-500 text-sm">{t('manage_journeys')}</p>
                                    </div>
                                    <ZenRenew onRefresh={async () => { await reloadTrips() }} successMessage={t('update_success')} errorMessage={t('update_failed')} />
                                </header>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <CreateTripModal
                                        isOpen={isCreateOpen}
                                        onOpenChange={setIsCreateOpen}
                                        userId={userId || ""}
                                        trips={trips}
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
                                            <DialogDescription>{t('iv_delete_desc')}</DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <p className="text-slate-600">
                                                {t('iv_delete_trip_prefix')}<span className="font-bold text-slate-900">{trips.find((tr: Trip) => tr.id === deletingTripId)?.title}</span>{t('iv_delete_trip_suffix')}
                                            </p>
                                        </div>
                                        <div className="flex justify-end gap-3">
                                            <Button variant="outline" onClick={() => setDeletingTripId(null)}>{t('cancel')}</Button>
                                            <Button variant="destructive" onClick={confirmDeleteTrip} disabled={isDeleting}>
                                                {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('iv_deleting')}</> : t('delete')}
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="trip-detail"
                        initial={{ opacity: 0, x: "100%" }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: "100%" }}
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className="w-full flex-1 flex flex-col h-full overflow-hidden relative bg-stone-50 dark:bg-slate-900 gpu-layer-accelerated"
                    >
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
                        toast.error(t('iv_location_failed'))
                    }
                }}
                currentTrip={currentTrip}
                biasLoc={calculateBiasLocation(day)}
            />

            <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth gpu-layer-accelerated" ref={setScrollerEl}>
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
                    onOpenDatePicker={() => setIsDatePickerOpen(true)}
                    onDeleteDay={handleDeleteDay}
                    getDateInfo={getDateInfo}
                    userId={userId}
                    onRefresh={reloadTripDetail}
                    shouldShowDateSkeleton={shouldShowDateSkeleton}
                />

                {day === 0 ? (
                    /* 🌟 Master Overview View */
                    <TripMasterOverview
                        currentTrip={currentTrip}
                        dayNumbers={dayNumbers}
                        getDateInfo={getDateInfo}
                        dailyLocs={dailyLocs}
                        onSelectDay={(targetDay) => {
                            setDay(targetDay)
                            scrollerEl?.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        onAddActivityToDay={(targetDay) => {
                            setDay(targetDay)
                            scrollerEl?.scrollTo({ top: 0, behavior: 'smooth' })
                            setIsAddMode(true)
                            setEditItem({ time: "10:00", place: "", desc: "", category: "sightseeing", lat: null, lng: null, tags: [] })
                            setIsEditOpen(true)
                        }}
                    />
                ) : (
                    <>
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
                                    toast.error(t('iv_update_failed_short'))
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
                                    toast.error(t('iv_update_failed_short'))
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
                    </>
                )}
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
                        <AlertDialogTitle>{t('iv_reorder_title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('iv_reorder_desc')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
                        <Button
                            className="w-full"
                            onClick={() => handleReorderConfirm(false)}
                            disabled={isReordering}
                        >
                            {isReordering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "🕐"} {t('iv_keep_time')}
                        </Button>
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => handleReorderConfirm(true)}
                            disabled={isReordering}
                        >
                            {isReordering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "⏱️"} {t('iv_auto_time')}
                        </Button>
                        <AlertDialogCancel className="w-full" disabled={isReordering}>{t('cancel')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 📅 iOS Calendar Range Picker Sheet */}
            <CalendarRangeSheet
                key={`${currentTrip?.id}-${currentTrip?.start_date}-${isDatePickerOpen}`}
                isOpen={isDatePickerOpen}
                onOpenChange={setIsDatePickerOpen}
                currentStartDate={currentTrip?.start_date}
                currentEndDate={currentTrip?.end_date}
                onConfirm={handleDateRangeChange}
                isUpdating={isUpdatingDates}
            />

            {/* ⚠️ Shorten Trip Duration Safety Alert Dialog */}
            <AlertDialog open={!!pendingShortenDates} onOpenChange={(open) => !open && setPendingShortenDates(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="w-5 h-5" />
                            {t('cal_shorten_title') || '縮短行程天數提醒'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('cal_shorten_desc') || '縮短天數將影響被截斷天數中的景點與活動，請選擇處理方式：'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-col gap-2">
                        <Button
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
                            onClick={() => pendingShortenDates && executeDateRangeUpdate(pendingShortenDates.start_date, pendingShortenDates.end_date, "merge")}
                            disabled={isUpdatingDates}
                        >
                            {isUpdatingDates ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "📦"} {t('cal_merge_to_last') || '合併景點至最後一天 (推薦)'}
                        </Button>
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => pendingShortenDates && executeDateRangeUpdate(pendingShortenDates.start_date, pendingShortenDates.end_date, "delete")}
                            disabled={isUpdatingDates}
                        >
                            {isUpdatingDates ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "🗑️"} {t('cal_delete_truncated') || '直接刪除被截斷天數'}
                        </Button>
                        <AlertDialogCancel className="w-full" disabled={isUpdatingDates}>
                            {t('cal_cancel') || '取消'}
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
