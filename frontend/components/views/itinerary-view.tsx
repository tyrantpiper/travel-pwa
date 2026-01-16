"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import dynamic from "next/dynamic"
import Image from "next/image"
import { ArrowLeft, Calendar, Plus, Hash, Trash2, MapPin, Edit3, Sun, CloudRain, AlertCircle, LogOut, Download } from "lucide-react"
import { Virtuoso } from "react-virtuoso"
// 🆕 DND-Kit imports
import {
    DndContext,
    closestCorners,  // 🔧 Phase 1: 改用 closestCorners (比 closestCenter 穩定)
    TouchSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay
} from "@dnd-kit/core"
import { createPortal } from "react-dom"
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { SortableTimelineCard } from "@/components/itinerary/SortableTimelineCard"
import { TimelineCardOverlay } from "@/components/itinerary/TimelineCardOverlay"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useTripDetail, useOnlineStatus } from "@/lib/hooks"
import { useLanguage } from "@/lib/LanguageContext"
import { ItineraryItemState, LocationInfo, DailyLocation, DayWeather, Trip, Activity, GeocodeResult, SubItem } from "@/lib/itinerary-types"
import { ActivityEditModal } from "@/components/itinerary/ActivityEditModal"
import { CreateTripModal, JoinTripDialog } from "@/components/itinerary/TripDialogs"

const DayMap = dynamic(() => import("@/components/day-map"), { ssr: false, loading: () => <div className="h-64 w-full bg-slate-100 animate-pulse rounded-xl" /> })
import EditableDailyTips from "@/components/itinerary/EditableDailyTips"
import EditableDailyChecklist from "@/components/itinerary/EditableDailyChecklist"
import EditableDailyAIReview from "@/components/itinerary/EditableDailyAIReview"
import { TripMembersSheet } from "@/components/itinerary/TripMembersSheet"
import { tripsApi, itemsApi, geocodeApi } from "@/lib/api"
import { useDynamicPolling } from "@/lib/polling-manager" // 🆕 Phase 7.3
import { POIBasicData } from "@/components/POIDetailDrawer"
import { useTripContext } from "@/lib/trip-context"
import { TripSwitcher } from "@/components/trip-switcher"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { toast } from "sonner"
import { fetchWeatherWithSDK, generateHourlyCurve } from "@/lib/weather-api"  // 🆕 P6 + Phase 1
import { useHaptic } from "@/lib/hooks"
import { debugLog } from "@/lib/debug"
import { Loader2, Clock } from "lucide-react"
import { TripCardSkeleton } from "@/components/ui/skeleton"
import { getNowInZone } from "@/lib/timezone"
import { COUNTRY_REGIONS } from "@/lib/constants"
import { generateTripPDF, downloadPDF, TripPDFData } from "@/lib/pdf-generator"

const DEFAULT_START_DATE = new Date()
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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
    const [scrollParent, setScrollParent] = useState<HTMLElement | undefined>(undefined) // 🔧 Virtuoso scroll parent
    useEffect(() => setMounted(true), []) // 🔧 Client-side only rendering for Portal


    // 🆕 DND State
    const [activeId, setActiveId] = useState<string | null>(null)
    const [pendingReorder, setPendingReorder] = useState<{
        itemId: string
        oldIndex: number
        newIndex: number
        newOrder: Activity[]
    } | null>(null)
    const [isReorderDialogOpen, setIsReorderDialogOpen] = useState(false)
    const [isReordering, setIsReordering] = useState(false)
    const [leavingTripId, setLeavingTripId] = useState<string | null>(null)
    const [isSelectingLocation, setIsSelectingLocation] = useState(false)

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
    const [weatherData, setWeatherData] = useState<DayWeather[]>([])
    const [weatherMode, setWeatherMode] = useState<'live' | 'forecast' | 'seasonal' | 'trend'>('live')  // 🆕 P3: 天氣模式標籤
    const [elevation, setElevation] = useState<number | null>(null)  // 🆕 Phase 10: 海拔 (m)

    // 🆕 P7: 天氣快取 (避免重複請求)
    const weatherCache = useRef<Map<string, { data: DayWeather[], mode: 'live' | 'forecast' | 'seasonal' | 'trend', timestamp: number }>>(new Map())
    // 🆕 P8: Active Flag (防止競態條件)
    const activeReqRef = useRef<string>("")

    // 🆕 currentDayData - useMemo (defined after day state)
    const currentDayData = useMemo(() => {
        return currentTrip?.days
            ? currentTrip.days.find((d) => d.day === day)?.activities || []
            : []
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
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

            const items = pendingReorder.newOrder.map((activity, index) => {
                const baseTime = adjustTimes ? `${String(9 + Math.floor(index * 1.5)).padStart(2, '0')}:00` : null
                return {
                    item_id: activity.id,
                    sort_order: index * 10,
                    time_slot: baseTime
                }
            })

            const res = await fetch(`${API_BASE}/api/items/reorder`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items, adjust_times: adjustTimes })
            })

            if (!res.ok) throw new Error("Reorder failed")

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
    }, [pendingReorder, activeTripId, reloadTripDetail, isReordering])


    // 🆕 P7+: 定期清理過期快取 (防止記憶體累積)
    useEffect(() => {
        const cleanExpiredCache = () => {
            const now = Date.now()
            const cacheTTL: Record<string, number> = {
                live: 60 * 60 * 1000,
                forecast: 60 * 60 * 1000,
                seasonal: 24 * 60 * 60 * 1000,
                trend: 7 * 24 * 60 * 60 * 1000
            }
            let cleaned = 0
            weatherCache.current.forEach((value, key) => {
                const ttl = cacheTTL[value.mode] || 60 * 60 * 1000
                if (now - value.timestamp > ttl) {
                    weatherCache.current.delete(key)
                    cleaned++
                }
            })
            if (cleaned > 0) debugLog(`🧹 Weather cache cleaned: ${cleaned} expired entries`)
        }

        // 每 5 分鐘清理一次
        const interval = setInterval(cleanExpiredCache, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    const [dailyLocs, setDailyLocs] = useState<Record<number, DailyLocation>>({})
    const [isLocEditOpen, setIsLocEditOpen] = useState(false)
    const [newLocName, setNewLocName] = useState("")
    const [locSearchResults, setLocSearchResults] = useState<LocationInfo[]>([])
    const [isLocSearching, setIsLocSearching] = useState(false)
    const [searchCountry, setSearchCountry] = useState<string>("")  // 國家篩選：空=全球, Japan, Taiwan, etc.
    const [dailyLocSearchRegion, setDailyLocSearchRegion] = useState<string>("") // 每日地點搜尋區域
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
            if (currentTrip?.days) {
                const dayData = currentTrip.days?.find((d) => d.day === day)
                if (dayData?.activities) {
                    for (const activity of dayData.activities) {
                        if (activity.lat && activity.lng) {
                            return { lat: activity.lat, lng: activity.lng, name: activity.place || "Current Location" }
                        }
                    }
                }
            }
            return null
        }

        // 🛡️ AbortController 防止競爭條件
        const controller = new AbortController()

        const fetchWeather = async () => {
            let lat = 35.6895  // Default: Tokyo
            let lng = 139.6917
            // locationName removed - was unused

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

            // Priority 1: Use manually set daily location
            if (dailyLocs && dailyLocs[day]) {
                lat = dailyLocs[day].lat
                lng = dailyLocs[day].lng
                // 根據地點名稱推測時區
                for (const [cityName, coords] of Object.entries(CITY_COORDS)) {
                    if (dailyLocs[day].name?.includes(cityName)) {
                        setCurrentTimezone(coords.timezone)
                        break
                    }
                }
            } else {
                // Priority 2: Use first activity with coordinates
                const activityLoc = getFirstActivityWithCoords()
                if (activityLoc) {
                    lat = activityLoc.lat
                    lng = activityLoc.lng
                    // Note: Don't auto-update dailyLocs here - let the sync useEffect handle it
                } else if (currentTrip?.title) {
                    // Priority 3: Parse city from trip title
                    for (const [cityName, coords] of Object.entries(CITY_COORDS)) {
                        if (currentTrip.title.includes(cityName)) {
                            lat = coords.lat
                            lng = coords.lng
                            setCurrentTimezone(coords.timezone)  // 設定時區
                            // Note: Don't auto-update dailyLocs here - let the sync useEffect handle it
                            break
                        }
                    }
                }
            }

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
                } else if (daysFromNow <= 16) {
                    mode = 'forecast'  // 16 天內用精準預報
                } else if (daysFromNow <= 46) {
                    mode = 'seasonal'  // 16-46 天用季節預報
                } else {
                    mode = 'trend'  // 超過 46 天用趨勢參考
                }
            }

            // 🛡️ Anti-Jitter: Coordinate Stability Check
            // 避免因來源切換 (如: Title -> Activity) 導致的微小座標差異 (Jitter) 觸發重新抓取
            // 閾值: 0.005 度 (~500m)
            const lastCoords = activeReqRef.current ? JSON.parse(sessionStorage.getItem('last_weather_coords') || '{}') : {}
            if (activeReqRef.current &&
                Math.abs(lat - (lastCoords.lat || 0)) < 0.005 &&
                Math.abs(lng - (lastCoords.lng || 0)) < 0.005 &&
                targetDate === lastCoords.date) {
                // Use stable coords
                lat = lastCoords.lat
                lng = lastCoords.lng
            } else {
                sessionStorage.setItem('last_weather_coords', JSON.stringify({ lat, lng, date: targetDate }))
            }

            // 🆕 P8: Active Flag (防止競態條件 - Race Condition Protection)
            // 確保只有最後一次請求的結果會被寫入 State
            const currentReqId = Math.random().toString(36).substring(7)
            activeReqRef.current = currentReqId

            // 🆕 P7: 快取檢查 (避免重複請求)
            const cacheKey = `${lat.toFixed(2)}_${lng.toFixed(2)}_${targetDate || 'today'}`
            const cached = weatherCache.current.get(cacheKey)
            const cacheTTL = {
                live: 60 * 60 * 1000,        // 1 小時
                forecast: 60 * 60 * 1000,    // 1 小時
                seasonal: 24 * 60 * 60 * 1000, // 24 小時
                trend: 7 * 24 * 60 * 60 * 1000 // 7 天
            }

            if (cached && (Date.now() - cached.timestamp) < (cacheTTL[cached.mode] || 3600000)) {
                debugLog(`📦 Weather Cache HIT: ${cacheKey}`)
                // 即時返回，不需要 active check 因為是同步的
                setWeatherData(cached.data)
                setWeatherMode(cached.mode)
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
                        if (sdkResult.elevation !== undefined) setElevation(sdkResult.elevation)  // 🆕 Phase 10: 儲存海拔

                        // 🆕 P8: Cache Limit (LRU-like)
                        if (weatherCache.current.size > 50) {
                            const firstKey = weatherCache.current.keys().next().value
                            if (firstKey) weatherCache.current.delete(firstKey) // 移除最舊的
                        }

                        weatherCache.current.set(cacheKey, {
                            data: sdkResult.forecast,
                            mode: sdkResult.mode,
                            timestamp: Date.now()
                        })
                        debugLog(`💾 Weather Cache STORE (SDK): ${cacheKey}`)
                        return  // SDK 成功，直接返回
                    }
                }

                // JSON Fallback (SDK 失敗或不支援的模式)
                // 🆕 P2: User-Agent Header (避免商業偵測)
                const headers: HeadersInit = {
                    'User-Agent': 'RyanTravelApp/3.0 (Non-commercial travel planning tool)'
                }

                let apiUrl: string

                if (!targetDate || daysFromNow < -5 || daysFromNow > 46) {
                    // 無日期或超出範圍：用今天天氣或去年同期
                    if (targetDate && (daysFromNow < -5 || daysFromNow > 46)) {
                        // 🆕 使用去年同期 (Archive API)
                        const lastYear = new Date(targetDate)
                        lastYear.setFullYear(lastYear.getFullYear() - 1)
                        const archiveDate = lastYear.toISOString().split('T')[0]
                        apiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weather_code&start_date=${archiveDate}&end_date=${archiveDate}&timezone=auto`
                    } else {
                        // 即時天氣
                        apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weather_code&models=ecmwf_ifs&timezone=auto&forecast_days=1`
                    }
                } else if (daysFromNow <= 16) {
                    // 🆕 P1: 1-16 天內使用 Forecast API + ECMWF IFS 9km
                    apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weather_code&models=ecmwf_ifs&start_date=${targetDate}&end_date=${targetDate}&timezone=auto`
                } else {
                    // 🆕 16-46 天使用 Seasonal Forecast API (EC46) + 日出日落 + 降雨 + 風速 (For Inference)
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
                    // 🆕 Phase 1 + 2 + 3: Linvill 曲線 + 日出日落 + 季節調節
                    const tMin = data.daily.temperature_2m_min?.[0] ?? 10
                    const tMax = data.daily.temperature_2m_max?.[0] ?? 20
                    const precipSum = data.daily.precipitation_sum?.[0] ?? 0

                    // 🆕 Phase 11: Seasonal 模式優化
                    // 注意：Seasonal 預報無法精準預測「哪一天」下雨，只能推估「當日累積降雨趨勢」
                    // 因此使用「季節趨勢」描述而非誤導性的百分比
                    // 
                    // 邏輯說明：
                    // - 強降雨 (>5mm)：明顯降水，影響戶外行程 → 顯示「濕潤」
                    // - 小雨/陣雨 (1-5mm)：有降雨可能 → 顯示「不穩定」
                    // - 微量/無雨 (<1mm)：含午後局部陣雨 → 顯示「乾燥」
                    //
                    // 注意：這裡的 precipSum 是「當日預測累積降雨量」，非「降雨機率」
                    // 轉換為「旅遊建議指數」更合適
                    let inferredPrecipProb = 20  // 用於內部計算，UI 會顯示趨勢文字
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
                    let inferredCode = 2 // Default: Cloudy
                    if (precipSum > 5) inferredCode = 63 // Rain
                    else if (precipSum > 1) inferredCode = 51 // Light Rain
                    else if (precipSum <= 1) inferredCode = 1 // Clear/Cloudy

                    // 🆕 Phase 2: 從 API 獲取日出日落時間
                    let sunriseHour = 6  // 預設
                    let sunsetHour = 18  // 預設

                    if (data.daily.sunrise?.[0] && data.daily.sunset?.[0]) {
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
                    if (data.elevation !== undefined) setElevation(data.elevation)

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

                    // 🆕 P12.1: 讀取最大風速 (用於體感校正)
                    const windSpeedMax = data.daily?.wind_speed_10m_max?.[0] ?? 0
                    debugLog(`💨 P12.1: wind_speed_10m_max=${windSpeedMax} km/h`)

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
                }

                // P6 SDK 模式: 直接使用 SDK 回傳的完整資料 (已在上方處理)
                // 此處的 forecast 已由上方填充

                setWeatherData(forecast)
                setWeatherMode(mode)  // 🆕 P3: 更新天氣模式

                // 🆕 P7: 儲存至快取
                weatherCache.current.set(cacheKey, { data: forecast, mode, timestamp: Date.now() })
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
        const prefetchAdjacentDays = async () => {
            if (!currentTrip?.start_date) return

            const adjacentDays = [day - 1, day + 1].filter(d => d >= 1)

            for (const adjDay of adjacentDays) {
                const adjStartDate = new Date(currentTrip.start_date)
                const adjTripDate = new Date(adjStartDate)
                adjTripDate.setDate(adjStartDate.getDate() + (adjDay - 1))
                const adjTargetDate = adjTripDate.toISOString().split('T')[0]
                const adjDaysFromNow = Math.floor((adjTripDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

                // 只預取 16 天內的預報 (Forecast API)
                if (adjDaysFromNow < 0 || adjDaysFromNow > 16) continue

                const adjLat = dailyLocs?.[adjDay]?.lat ?? 35.6895
                const adjLng = dailyLocs?.[adjDay]?.lng ?? 139.6917
                const adjCacheKey = `${adjLat.toFixed(2)}_${adjLng.toFixed(2)}_${adjTargetDate}`

                // 跳過已快取的
                if (weatherCache.current.has(adjCacheKey)) continue

                try {
                    const url = `https://api.open-meteo.com/v1/forecast?latitude=${adjLat}&longitude=${adjLng}&hourly=temperature_2m,weather_code&models=ecmwf_ifs&start_date=${adjTargetDate}&end_date=${adjTargetDate}&timezone=auto`
                    const res = await fetch(url, {
                        headers: { 'User-Agent': 'RyanTravelApp/3.0 (Non-commercial)' }
                    })
                    const data = await res.json()
                    const temps = data.hourly?.temperature_2m || []
                    const codes = data.hourly?.weather_code || []
                    const forecast = []
                    for (let i = 6; i <= 23 && i < temps.length; i++) {
                        forecast.push({ time: `${i}:00`, temp: Math.round(temps[i]), code: codes[i] || 0 })
                    }
                    weatherCache.current.set(adjCacheKey, { data: forecast, mode: 'forecast', timestamp: Date.now() })
                    debugLog(`🔮 P5 Prefetch: Day ${adjDay} cached`)
                } catch { /* 預取失敗不影響主流程 */ }
            }
        }

        // 延遲 500ms 後預取，避免阻塞主請求
        const prefetchTimer = setTimeout(prefetchAdjacentDays, 500)

        // 🛡️ Cleanup: 組件卸載或依賴變化時取消請求
        return () => {
            controller.abort()
            clearTimeout(prefetchTimer)  // 🆕 P5: 清除預取計時器
        }
    }, [day, dailyLocs, currentTrip])

    const handleLeaveTrip = async (tripId: string) => {
        if (leavingTripId) return // Prevent concurrent actions
        if (!confirm(t('confirm_delete') ? "您確定要退出此行程嗎？" : "Are you sure you want to leave this trip?")) return

        setLeavingTripId(tripId)
        try {
            const res = await fetch(`${API_BASE}/api/trips/${tripId}/leave`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-User-ID": userId || ""
                }
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.detail || "Failed to leave trip")
            }

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
            const res = await fetch(`${API_BASE}/api/trips/${deletingTripId}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Delete failed")

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

    const handleSearchLocation = async () => {
        if (!newLocName.trim()) return
        setIsLocSearching(true)
        try {
            // 🆕 使用智能地理編碼 API（支援結構化 country/region）
            const bias = calculateBiasLocation(day) // 取得當前或前一天的位置作為權重
            const data = await geocodeApi.search({
                query: newLocName.trim(),           // 純淨的搜尋字串（不再拼接）
                limit: 8,
                tripTitle: currentTrip?.title,
                lat: bias?.lat,
                lng: bias?.lng,
                country: searchCountry || undefined,         // 🆕 結構化國家過濾
                region: dailyLocSearchRegion || undefined    // 🆕 結構化區域過濾
            })

            if (!data.results || data.results.length === 0) {
                toast.warning("找不到此地點，請嘗試其他關鍵字")
                setLocSearchResults([])
            } else {
                // 轉換成統一格式
                const results = data.results.map((item: GeocodeResult) => ({
                    name: item.name,
                    display_name: item.address || item.name,
                    lat: item.lat,
                    lng: item.lng,
                    type: item.type || "place",
                    // 從地址中解析行政區資訊
                    admin1: item.address?.split(", ").slice(-2, -1)[0] || "",
                    admin2: item.address?.split(", ")[1] || "",
                    country: item.address?.split(", ").slice(-1)[0] || "",
                    source: item.source
                }))
                setLocSearchResults(results)

                // 顯示搜尋來源提示
                if (data.source === "arcgis") {
                    debugLog("🗺️ 使用 ArcGIS 搜尋")
                } else if (data.source === "photon") {
                    debugLog("🔍 使用 Photon 搜尋")
                }
            }
        } catch { toast.error("搜尋失敗") }
        finally { setIsLocSearching(false) }
    }



    const handleSelectLocation = async (loc: LocationInfo) => {
        if (!currentTrip) return
        if (isSelectingLocation) return // Prevent double click
        setIsSelectingLocation(true)

        try {
            const displayName = loc.admin2 || loc.admin1 ? `${loc.name}, ${loc.admin2 || loc.admin1}` : loc.name

            // 🆕 Optimistic Update Pattern (SWR Safe)
            // 1. Update local state immediately for UI response
            setDailyLocs(prev => ({ ...prev, [day]: { name: displayName, lat: loc.lat, lng: loc.lng } }))

            // 2. Optimistic update SWR cache to prevent "flash" reversion
            // Construct the optimistic trip object
            const optimisticTrip = {
                ...currentTrip,
                daily_locations: {
                    ...(currentTrip.daily_locations || {}),
                    [day]: { name: displayName, lat: loc.lat, lng: loc.lng }
                }
            }
            // Update cache immediately, do NOT revalidate yet
            reloadTripDetail(optimisticTrip, false)

            // 3. API Call
            await tripsApi.updateLocation(currentTrip.id, {
                day: day,
                name: displayName,
                lat: loc.lat,
                lng: loc.lng
            })

            setIsLocEditOpen(false)
            setNewLocName("")
            setLocSearchResults([])

            // 4. Final Revalidation (background)
            reloadTripDetail()
            toast.success("地點已更新")

        } catch (e) {
            console.error(e)
            toast.error("更新失敗")
            // Rollback on error (optional, usually revalidating is enough)
            reloadTripDetail()
        } finally {
            setIsSelectingLocation(false)
        }
    }

    const handleSaveEdit = async () => {
        if (!editItem && !isAddMode) return
        if (isSavingActivity) return // 防止重複點擊
        haptic.tap() // 觸覺回饋

        setIsSavingActivity(true)

        let finalLat = editItem?.lat
        let finalLng = editItem?.lng
        if (editItem?.place && (!finalLat || !finalLng)) {
            try {
                // 🆕 使用智能地理編碼 API
                const data = await geocodeApi.search({
                    query: editItem.place,
                    limit: 1,
                    tripTitle: currentTrip?.title  // 🆕 智能國家判斷
                })
                if (data.results && data.results.length > 0) {
                    finalLat = data.results[0].lat
                    finalLng = data.results[0].lng
                }
            } catch { }
        }

        try {
            if (isAddMode) {
                if (!currentTrip || !editItem) return
                await fetch(`${API_BASE}/api/items`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        itinerary_id: currentTrip.id,
                        day_number: day,
                        time_slot: editItem.time,
                        place_name: editItem.place,
                        category: editItem.category,
                        notes: editItem.desc,
                        lat: finalLat ? Number(finalLat) : null,
                        lng: finalLng ? Number(finalLng) : null,
                        image_url: editItem.image_url,
                        image_urls: editItem.image_urls,  // 🆕 多圖片
                        tags: editItem.tags
                    })
                })
            } else {
                if (!editItem) return
                await fetch(`${API_BASE}/api/items/${editItem.id}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        time_slot: editItem.time,
                        place_name: editItem.place,
                        category: editItem.category,
                        tags: editItem.tags,
                        notes: editItem.desc,
                        lat: finalLat ? Number(finalLat) : null,
                        lng: finalLng ? Number(finalLng) : null,
                        image_url: editItem.image_url,
                        image_urls: editItem.image_urls  // 🆕 多圖片
                    })
                })
            }
            haptic.success()
            setIsEditOpen(false)
            reloadTripDetail()
        } catch {
            haptic.error()
            toast.error("Save failed")
        } finally {
            setIsSavingActivity(false)
        }
    }

    const handleUpdateMemo = useCallback(async (id: string, newMemo: string) => {
        try {
            const res = await fetch(`${API_BASE}/api/items/${id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ memo: newMemo })
            })
            if (!res.ok) throw new Error("Failed to save memo")
            reloadTripDetail()
            return true
        } catch {
            toast.error("儲存備忘錄失敗")
            return false
        }
    }, [reloadTripDetail])

    const handleUpdateSubItems = useCallback(async (id: string, newItems: SubItem[]) => {
        try {
            const res = await fetch(`${API_BASE}/api/items/${id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sub_items: newItems })
            })
            if (!res.ok) throw new Error("Failed to save sub items")
            reloadTripDetail()
            return true
        } catch {
            toast.error("儲存連結失敗")
            return false
        }
    }, [reloadTripDetail])

    const handleDeleteItem = useCallback(async (id: string) => {
        if (!confirm(t('confirm_delete'))) return

        // Optimistic update: immediately remove from UI
        if (currentTrip?.days) {
            const optimisticData = {
                ...currentTrip,
                days: currentTrip.days.map((d) => ({
                    ...d,
                    activities: d.activities?.filter((a) => a.id !== id) || []
                }))
            }
            reloadTripDetail(optimisticData, false) // Update cache without revalidation
        }

        // Background API call
        fetch(`${API_BASE}/api/items/${id}`, { method: "DELETE" })
            .catch(() => reloadTripDetail()) // Revert on error
    }, [t, currentTrip, reloadTripDetail])

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
            tags: item.tags || []
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

        try {
            // 1. 先發送 API 請求
            const res = await fetch(`${API_BASE}/api/trips/${currentTrip.id}/days/${dayNum}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Delete failed")

            toast.success("已刪除")

            // 2. 調整當前選擇的日期
            if (day === dayNum && day > 1) setDay(day - 1)

            // 3. 刷新資料
            reloadTripDetail()
        } catch {
            toast.error("刪除失敗")
        }
    }

    // 🧠 Smart Clone 狀態
    const [isClonePromptOpen, setIsClonePromptOpen] = useState(false)
    const [pendingAddDayPosition, setPendingAddDayPosition] = useState<"before" | "end" | null>(null)
    const [cloneSourceDay, setCloneSourceDay] = useState<number | null>(null)

    // 🧠 檢查是否有可移植的資料
    const checkHasCloneableData = (position: "before" | "end") => {
        if (!currentTrip) return false

        let sourceDay = -1
        if (position === "end") {
            const maxDay = Math.max(...(currentTrip.days?.map(d => d.day) || [0]),
                Object.keys(dailyLocs || {}).map(Number).reduce((a, b) => Math.max(a, b), 0))
            sourceDay = maxDay
        } else {
            sourceDay = 1
        }

        setCloneSourceDay(sourceDay)

        const hasLoc = dailyLocs && dailyLocs[sourceDay] && dailyLocs[sourceDay].name
        const hasNotes = currentTrip.day_notes && currentTrip.day_notes[sourceDay] && currentTrip.day_notes[sourceDay].length > 0
        const hasChecklist = currentTrip.day_checklists && currentTrip.day_checklists[sourceDay] && currentTrip.day_checklists[sourceDay].length > 0

        return !!(hasLoc || hasNotes || hasChecklist)
    }

    // 🧠 Add Day Loading State
    const [isAddingDay, setIsAddingDay] = useState(false)

    // ⚡ 實際執行新增 API
    const executeAddDay = async (position: "before" | "end", cloneContent: boolean) => {
        if (!currentTrip) return

        // 🔔 Haptic Feedback (Immediate Response)
        haptic.tap()

        const insertPos = position === "before" ? `before:1` : "end"

        // 🚀 Optimistic Logic: Only for "Append End" & "No Clone" (Simple Case)
        // This makes the standard "Add Day" feel INSTANT.
        const isOptimistic = position === "end" && !cloneContent

        if (isOptimistic) {
            // 🏎️ Optimistic Update
            // 1. Calculate new day
            const currentDays = currentTrip.days || []
            // Safe Max Day Calc
            const maxDay = currentDays.length > 0 ? Math.max(...currentDays.map(d => d.day)) : 0
            const newDay = maxDay + 1

            // 2. Create Fake New Trip Object
            // Deep copy to avoid reference issues (structuredClone is faster than JSON.parse/stringify)
            const optimisticTrip = structuredClone(currentTrip)

            // Append Day to array
            if (!optimisticTrip.days) optimisticTrip.days = []
            optimisticTrip.days.push({ day: newDay, activities: [] })

            // Force Clean Daily Locations (Crucial for Ghostbuster UI)
            // Use undefined to indicate no location set yet (type-safe approach)
            if (!optimisticTrip.daily_locations) optimisticTrip.daily_locations = {}
            delete optimisticTrip.daily_locations[newDay]  // Remove any ghost data

            // 🧹 Force Clean ALL Other Data Fields (The Grim Reaper Fix)
            if (!optimisticTrip.day_notes) optimisticTrip.day_notes = {}
            optimisticTrip.day_notes[newDay] = []

            if (!optimisticTrip.day_costs) optimisticTrip.day_costs = {}
            optimisticTrip.day_costs[newDay] = []

            if (!optimisticTrip.day_tickets) optimisticTrip.day_tickets = {}
            optimisticTrip.day_tickets[newDay] = []

            if (!optimisticTrip.day_checklists) optimisticTrip.day_checklists = {}
            optimisticTrip.day_checklists[newDay] = []

            // Update Local State Immediately (The "Flash" Fix)
            setDailyLocs(prev => {
                const updated = { ...prev }
                delete updated[newDay]  // Remove ghost data from state
                return updated
            })

            // Update SWR Cache Immediately
            // revalidate: false ensures we don't fetch from server immediately, allowing the user to see the change
            // We will fetch real data after the API call completes.
            reloadTripDetail(() => optimisticTrip, false)

            toast.success(`已快速新增 Day ${newDay}`)

        } else {
            // ⏳ Show Loading for Complex Operations (Insert/Clone)
            setIsAddingDay(true)
        }

        try {
            const res = await fetch(`${API_BASE}/api/trips/${currentTrip.id}/days`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ position: insertPos, clone_content: cloneContent })
            })

            if (!res.ok) throw new Error("API failed")

            const data = await res.json()

            // Only toast if we didn't do it optimistically (to avoid double toast)
            if (!isOptimistic) {
                toast.success(cloneContent ? `已新增 Day ${data.new_day} (並移植內容)` : `已新增 Day ${data.new_day}`)
            }

            // Sync True Data from Server (Ghostbuster Verification)
            await reloadTripDetail()

            // 🚀 Auto-navigate to new day (Only after API success to avoid ghost day)
            if (position === "before") {
                setDay(1)
            } else if (position === "end") {
                setDay(data.new_day)
            }

        } catch (e) {
            console.error(e)
            toast.error("新增失敗")
            // Rollback if failed
            reloadTripDetail()
        } finally {
            setIsClonePromptOpen(false)
            setPendingAddDayPosition(null)
            setIsAddingDay(false)
        }
    }

    // 🆕 新增天數 (Wrapper)
    const handleAddDay = (position: "before" | "end") => {
        if (checkHasCloneableData(position)) {
            setPendingAddDayPosition(position)
            setIsClonePromptOpen(true)
        } else {
            executeAddDay(position, false)
        }
    }

    const handleBack = () => { setActiveTripId(null); setViewMode('list') }

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
            // 🔧 Phase 14: View manages its own scrolling
            <div className="h-full overflow-y-auto overscroll-contain">
                <div className="flex flex-col h-[100dvh] bg-stone-50 overflow-hidden">
                    <PullToRefresh
                        className="flex-1 px-6 py-12 pb-32"
                        onRefresh={async () => {
                            try {
                                await reloadTrips()
                                haptic.success()
                                toast.success(t('update_success') || "已更新")
                            } catch {
                                haptic.error()
                                toast.error("更新失敗")
                            }
                        }}
                    >
                        <header className="mb-8">
                            <h1 className="text-3xl font-serif text-slate-900 mb-2">{t('my_trips')}</h1>
                            <p className="text-slate-500 text-sm">{t('manage_journeys')}</p>
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

                        <Dialog open={!!deletingTripId} onOpenChange={(open) => !open && setDeletingTripId(null)}>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="text-red-600 flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5" />
                                        {t('confirm_delete')}
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="py-4">
                                    <p className="text-slate-600">
                                        確定要刪除行程 <span className="font-bold text-slate-900">{trips.find((t: Trip) => t.id === deletingTripId)?.title}</span> 嗎？
                                    </p>
                                    <p className="text-sm text-slate-500 mt-2">此操作無法復原，所有相關資料將會遺失。</p>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <Button variant="outline" onClick={() => setDeletingTripId(null)}>{t('cancel')}</Button>
                                    <Button variant="destructive" onClick={confirmDeleteTrip} disabled={isDeleting}>
                                        {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />刪除中...</> : t('delete')}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <div className="space-y-4">
                            {/* 載入中骨架屏 */}
                            {isTripsLoading && (
                                <>
                                    <TripCardSkeleton />
                                    <TripCardSkeleton />
                                    <TripCardSkeleton />
                                </>
                            )}

                            {/* 實際 Trip 列表 */}
                            {!isTripsLoading && trips.length === 0 && (
                                <div className="text-center py-20 bg-white/50 rounded-xl border-2 border-dashed border-slate-200">
                                    <div className="text-slate-400 mb-2 text-lg">📭</div>
                                    <p className="text-slate-500">尚無行程</p>
                                    <p className="text-xs text-slate-400 mt-1">點擊上方按鈕建立新行程</p>
                                </div>
                            )}

                            {!isTripsLoading && trips.map((trip: Trip) => (
                                <Card key={trip.id} className="p-0 overflow-hidden border-0 shadow-sm transition-transform relative group">
                                    <div className="absolute top-2 right-2 z-20">
                                        {/* 擁有者顯示刪除按鈕 */}
                                        {userId && trip.created_by === userId && (
                                            <Button variant="destructive" size="icon" className="w-8 h-8 rounded-full shadow-md bg-red-500 hover:bg-red-600 border border-white/20" onClick={(e) => { e.stopPropagation(); handleDeleteTrip(trip.id) }}>
                                                <Trash2 className="w-4 h-4 text-white" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="cursor-pointer active:opacity-90" onClick={() => { setActiveTripId(trip.id); setViewMode('detail'); }}>
                                        <div className="h-24 bg-slate-800 relative rounded-t-lg overflow-hidden">
                                            {trip.cover_image ? (
                                                <div className="relative w-full h-full">
                                                    <Image src={trip.cover_image} alt="cover" fill className="object-cover opacity-80" unoptimized />
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            <div className="absolute bottom-4 left-4 text-white">
                                                <h3 className="font-bold text-lg">{trip.title}</h3>
                                                <p className="text-xs opacity-80 flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(trip.start_date || new Date().toISOString()).toLocaleDateString()}</p>
                                            </div>
                                            <div className="absolute top-3 right-12 bg-slate-800/90 px-2 py-1 rounded text-xs text-white font-mono flex items-center gap-1"><Hash className="w-3 h-3" /> {trip.share_code}</div>
                                        </div>
                                        <div className="p-4 bg-white flex justify-between items-center rounded-b-lg">
                                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">By {trip.creator_name || 'Guest'}</span>
                                            <div className="flex items-center gap-2">
                                                {/* PDF 下載按鈕 */}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 gap-1 px-2 h-7"
                                                    onClick={async (e) => {
                                                        e.stopPropagation()
                                                        // 🆕 修復：保存初始 toast ID 以便後續 dismiss
                                                        const toastId: string | number = toast.loading("生成 PDF 中...")
                                                        try {
                                                            // 先取得完整行程資料
                                                            const res = await fetch(`${API_BASE}/api/trips/${trip.id}`)
                                                            if (!res.ok) throw new Error("無法取得行程資料")
                                                            const fullTrip = await res.json()

                                                            // 轉換為 PDF 格式
                                                            const pdfData: TripPDFData = {
                                                                title: fullTrip.title || trip.title,
                                                                startDate: new Date(fullTrip.start_date || trip.start_date).toLocaleDateString(),
                                                                endDate: new Date(fullTrip.end_date || trip.end_date || trip.start_date).toLocaleDateString(),
                                                                coverImage: fullTrip.cover_image,
                                                                days: (fullTrip.days || []).map((d: { day: number; activities?: Activity[] }) => ({
                                                                    day: d.day,
                                                                    date: (() => {
                                                                        const start = new Date(fullTrip.start_date || trip.start_date)
                                                                        start.setDate(start.getDate() + d.day - 1)
                                                                        return start.toLocaleDateString()
                                                                    })(),
                                                                    location: fullTrip.daily_locations?.[d.day]?.name,
                                                                    activities: (d.activities || []).map((a: Activity) => ({
                                                                        time: a.time || "00:00",
                                                                        place: a.place || a.place_name || "",
                                                                        desc: a.desc || a.notes || "",
                                                                        category: a.category || "other",
                                                                        memo: a.memo
                                                                    })),
                                                                    notes: fullTrip.day_notes?.[d.day] || []
                                                                })),
                                                                hotels: fullTrip.hotel_info || []
                                                            }

                                                            // 🆕 進度回調：更新同一個 toast
                                                            const blobUrl = await generateTripPDF(pdfData, (current, total, stage) => {
                                                                toast.loading(`${stage} (${current}/${total})`, { id: toastId })
                                                            })
                                                            toast.dismiss(toastId)
                                                            downloadPDF(blobUrl, `${trip.title || "trip"}.pdf`)
                                                            toast.success("PDF 下載成功！")
                                                        } catch (err) {
                                                            console.error(err)
                                                            toast.dismiss()
                                                            toast.error("PDF 生成失敗")
                                                        }
                                                    }}
                                                >
                                                    <Download className="w-3 h-3" /> PDF
                                                </Button>
                                                {/* 退出行程按鈕 (僅限非擁有者) */}
                                                {userId && trip.created_by !== userId && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 gap-1 px-2 h-7"
                                                        disabled={leavingTripId === trip.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleLeaveTrip(trip.id)
                                                        }}
                                                    >
                                                        {leavingTripId === trip.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />} 退出
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </PullToRefresh>
                </div>
            </div>
        )
    }


    return (
        // 🔧 Phase 14: View manages its own scrolling
        <div ref={(el) => setScrollParent(el || undefined)} className="h-full overflow-y-auto overscroll-contain">
            <div className="flex flex-col min-h-screen bg-stone-50 dark:bg-slate-900 pb-32 overflow-x-hidden">
                <div className="bg-white dark:bg-slate-800 pt-12 pb-2 sticky top-0 z-20 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="px-6 flex justify-between items-end mb-4">
                        <div>
                            <button onClick={handleBack} className="flex items-center gap-1 text-xs font-bold text-slate-400 mb-2">
                                <ArrowLeft className="w-3 h-3" /> BACK
                            </button>
                            <TripSwitcher className="w-[240px] justify-start px-0 font-serif font-bold text-2xl border-none shadow-none bg-transparent hover:bg-slate-100/50 h-auto py-1" />
                        </div>
                        {/* 🆕 成員管理按鈕 */}
                        {currentTrip && (
                            <TripMembersSheet
                                tripId={currentTrip.id}
                                members={currentTrip.members || []}
                                createdBy={currentTrip.created_by || ""}
                                currentUserId={userId || ""}
                                onMemberKicked={() => reloadTripDetail()}
                            />
                        )}
                    </div>

                    <div className="flex gap-3 overflow-x-auto px-6 pb-2 no-scrollbar items-center">
                        {/* 🆕 新增天數按鈕 (開頭) */}
                        <button
                            onClick={() => handleAddDay("before")}
                            className="flex-shrink-0 w-8 h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-lg font-bold flex items-center justify-center shadow-sm transition-all hover:scale-110"
                            title="在開頭新增一天"
                        >
                            +
                        </button>

                        {/* 🔧 FIX: Show skeleton when trip data is stale to prevent wrong dates */}
                        {shouldShowDateSkeleton ? (
                            // Skeleton: avoid showing wrong dates from cached trip
                            [1, 2, 3].map(i => (
                                <div key={i} className="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse flex-shrink-0" />
                            ))
                        ) : (
                            dayNumbers.map((d) => {
                                const { date, week } = getDateInfo(d)
                                return (
                                    <div key={d} className="relative flex flex-col items-center">
                                        <button onClick={() => setDay(d)} className={cn("day-btn relative flex flex-col items-center min-w-[3.5rem] py-2 rounded-lg border dark:border-slate-700", day === d ? "text-white" : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100")}>
                                            {/* Sliding Indicator */}
                                            {day === d && (
                                                <motion.div
                                                    layoutId="day-indicator"
                                                    className="absolute inset-0 bg-slate-900 dark:bg-slate-100 rounded-lg -z-10"
                                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                />
                                            )}
                                            <span className="text-[10px] opacity-70">{week}</span>
                                            <span className="font-bold">{date}</span>
                                        </button>
                                        {/* 📱 手機友善刪除按鈕 - 長按當前選中的日期才顯示 */}
                                        {totalDays > 1 && day === d && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteDay(d) }}
                                                className="mt-1.5 px-2.5 py-1 text-[10px] font-medium 
                                                       text-red-400 bg-red-50/80 backdrop-blur-sm
                                                       border border-red-200/60 rounded-full shadow-sm 
                                                       active:scale-95 active:bg-red-100
                                                       transition-transform duration-100"
                                            >
                                                移除此天
                                            </button>
                                        )}
                                    </div>
                                )
                            })
                        )}

                        {/* 🆕 新增天數按鈕 (結尾) */}
                        <button
                            onClick={() => handleAddDay("end")}
                            className="flex-shrink-0 w-8 h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-lg font-bold flex items-center justify-center shadow-sm transition-all hover:scale-110"
                            title="在結尾新增一天"
                            aria-label="在結尾新增一天"
                        >
                            +
                        </button>
                    </div>
                </div>

                <PullToRefresh
                    scrollableRef={scrollParent}
                    onRefresh={async () => { await reloadTripDetail() }}
                    className="flex-1"
                >
                    <div className="py-6 px-6 bg-stone-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between mb-4">
                            {/* 🆕 Smart Clone Confirmation Dialog */}
                            <AlertDialog open={isClonePromptOpen} onOpenChange={setIsClonePromptOpen}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>是否移植鄰近天數的內容？</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            我們發現 Day {cloneSourceDay} 有設定 <b>地點、筆記或行前清單</b>。
                                            <br /><br />
                                            您想要將這些設定複製到新的一天嗎？
                                            <br />
                                            <span className="text-xs text-slate-500">(注意：預估花費與交通票券不會被複製)</span>
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
                                            {isAddingDay ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />處理中...</> : "✨ 是，移植內容"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <Dialog open={isLocEditOpen} onOpenChange={(open) => {
                                if (open) {
                                    // Reset filters when opening
                                    setSearchCountry("")
                                    setDailyLocSearchRegion("")
                                }
                                setIsLocEditOpen(open)
                            }}>
                                <DialogTrigger asChild>
                                    <button className="flex items-center gap-2 hover:bg-white/50 dark:hover:bg-slate-700/50 p-2 -ml-2 rounded-lg transition-colors group">
                                        <MapPin className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                                            {dailyLocs[day]?.name || "Tokyo (Default)"}
                                        </span>
                                        <Edit3 className="w-3 h-3 text-slate-300 group-hover:text-amber-500 transition-colors" />
                                    </button>
                                </DialogTrigger>
                                {/* 當地時間顯示 */}
                                <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                                        {getNowInZone(currentTimezone)}
                                    </span>
                                </div>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader><DialogTitle>修改第 {day} 天的天氣地點</DialogTitle></DialogHeader>
                                    <div className="space-y-4 py-4">
                                        {/* 當前座標顯示 */}
                                        {dailyLocs[day] && (
                                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                                <div className="text-xs text-slate-500 mb-1">📍 目前地點</div>
                                                <div className="font-bold text-slate-800 dark:text-slate-200">{dailyLocs[day].name}</div>
                                                <div className="text-xs text-slate-400 font-mono">
                                                    {dailyLocs[day].lat?.toFixed(4)}, {dailyLocs[day].lng?.toFixed(4)}
                                                </div>
                                            </div>
                                        )}

                                        {/* 從活動同步按鈕 */}
                                        {(() => {
                                            const activityLoc = currentTrip?.days?.find((d) => d.day === day)?.activities?.find((a) => a.lat && a.lng)
                                            if (activityLoc) {
                                                return (
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-start text-left h-auto py-3"
                                                        onClick={() => {
                                                            setDailyLocs({ ...dailyLocs, [day]: { name: activityLoc.place || "Location", lat: activityLoc.lat!, lng: activityLoc.lng! } })
                                                            setIsLocEditOpen(false)
                                                        }}
                                                    >
                                                        <div>
                                                            <div className="text-xs text-amber-600 font-bold">⚡ 從活動同步</div>
                                                            <div className="text-sm text-slate-700 dark:text-slate-300">{activityLoc.place}</div>
                                                            <div className="text-xs text-slate-400 font-mono">{activityLoc.lat?.toFixed(4)}, {activityLoc.lng?.toFixed(4)}</div>
                                                        </div>
                                                    </Button>
                                                )
                                            }
                                            return null
                                        })()}

                                        {/* 搜尋區域 */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500">🔍 搜尋地點</label>
                                            <div className="flex gap-2">
                                                <div className="w-1/3 space-y-2">
                                                    <select
                                                        className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-400 dark:text-white"
                                                        value={searchCountry}
                                                        onChange={e => {
                                                            setSearchCountry(e.target.value)
                                                            setDailyLocSearchRegion("") // Reset region
                                                        }}
                                                    >
                                                        <option value="">🌍 Country</option>
                                                        <option value="Japan">🇯🇵 Japan</option>
                                                        <option value="Taiwan">🇹🇼 Taiwan</option>
                                                        <option value="South Korea">🇰🇷 Korea</option>
                                                        <option value="Thailand">🇹🇭 Thailand</option>
                                                        <option value="Vietnam">🇻🇳 Vietnam</option>
                                                        <option value="Hong Kong">🇭🇰 Hong Kong</option>
                                                        <option value="Singapore">🇸🇬 Singapore</option>
                                                        <option value="Malaysia">🇲🇾 Malaysia</option>
                                                        <option value="Philippines">🇵🇭 Philippines</option>
                                                        <option value="Indonesia">🇮🇩 Indonesia</option>
                                                        <option value="China">🇨🇳 China</option>
                                                        <option value="USA">🇺🇸 USA</option>
                                                        <option value="Canada">🇨🇦 Canada</option>
                                                        <option value="UK">🇬🇧 UK</option>
                                                        <option value="France">🇫🇷 France</option>
                                                        <option value="Italy">🇮🇹 Italy</option>
                                                        <option value="Germany">🇩🇪 Germany</option>
                                                        <option value="Spain">🇪🇸 Spain</option>
                                                        <option value="Australia">🇦🇺 Australia</option>
                                                        <option value="New Zealand">🇳🇿 New Zealand</option>
                                                    </select>

                                                    {searchCountry && COUNTRY_REGIONS[searchCountry] ? (
                                                        <select
                                                            className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-400 dark:text-white"
                                                            value={dailyLocSearchRegion}
                                                            onChange={e => setDailyLocSearchRegion(e.target.value)}
                                                        >
                                                            <option value="">🏙️ Region (All)</option>
                                                            {COUNTRY_REGIONS[searchCountry].map(region => (
                                                                <option key={region} value={region}>{region}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <Input
                                                            placeholder="🏙️ Region"
                                                            className="h-9 text-xs"
                                                            value={dailyLocSearchRegion}
                                                            onChange={e => setDailyLocSearchRegion(e.target.value)}
                                                        />
                                                    )}
                                                </div>

                                                <div className="flex-1 flex gap-2">
                                                    <Input
                                                        placeholder="輸入地點..."
                                                        value={newLocName}
                                                        onChange={e => setNewLocName(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleSearchLocation()}
                                                        className="flex-1 h-auto"
                                                    />
                                                    <Button onClick={handleSearchLocation} disabled={isLocSearching}>
                                                        {isLocSearching ? "..." : "搜尋"}
                                                    </Button>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400">💡 輸入或選擇國家可提高短地名的搜尋準確度</p>
                                        </div>


                                        {locSearchResults.length > 0 && (
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                                <p className="text-xs text-slate-500">🗺️ 地點搜尋結果 ({locSearchResults.length})：</p>
                                                {locSearchResults.map((loc, idx) => {
                                                    // POI 類型對照
                                                    const typeLabels: { [key: string]: string } = {
                                                        restaurant: '🍽️ 餐廳', cafe: '☕ 咖啡廳', fast_food: '🍔 速食',
                                                        station: '🚉 車站', bus_stop: '🚌 公車站', subway_entrance: '🚇 地鐵',
                                                        hotel: '🏨 飯店', hostel: '🛏️ 旅館', guest_house: '🏠 民宿',
                                                        attraction: '🎯 景點', museum: '🏛️ 博物館', park: '🌳 公園',
                                                        temple: '⛩️ 寺廟', shrine: '⛩️ 神社', church: '⛪ 教堂',
                                                        shop: '🛍️ 商店', mall: '🏬 百貨', supermarket: '🛒 超市',
                                                        convenience: '🏪 便利店', department_store: '🏬 百貨公司',
                                                        administrative: '📍 行政區', suburb: '📍 地區', city: '🏙️ 城市',
                                                    }
                                                    const typeLabel = typeLabels[loc.type || ''] || `📍 ${loc.type || '地點'}`

                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleSelectLocation(loc)}
                                                            disabled={isSelectingLocation}
                                                            className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:border-amber-300 dark:hover:border-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{typeLabel}</span>
                                                                <span className="font-bold text-slate-800 dark:text-white">{loc.name}</span>
                                                            </div>
                                                            <div className="text-xs text-slate-500 line-clamp-1">
                                                                {loc.display_name || [loc.admin2, loc.admin1, loc.country].filter(Boolean).join(', ')}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-mono">
                                                                {loc.lat?.toFixed(6)}, {loc.lng?.toFixed(6)}
                                                            </div>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {/* 手動座標輸入 */}
                                        <div className="space-y-2 pt-2 border-t border-dashed">
                                            <label className="text-xs font-bold text-slate-500">📌 手動輸入座標 (最精確)</label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="緯度 (lat)"
                                                    className="font-mono text-sm"
                                                    id="manual-lat"
                                                />
                                                <Input
                                                    placeholder="經度 (lng)"
                                                    className="font-mono text-sm"
                                                    id="manual-lng"
                                                />
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => {
                                                        const lat = parseFloat((document.getElementById('manual-lat') as HTMLInputElement)?.value)
                                                        const lng = parseFloat((document.getElementById('manual-lng') as HTMLInputElement)?.value)
                                                        if (!isNaN(lat) && !isNaN(lng)) {
                                                            setDailyLocs({ ...dailyLocs, [day]: { name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng } })
                                                            setIsLocEditOpen(false)
                                                        } else {
                                                            // 顯示錯誤 Toast
                                                            const toastId = Math.random().toString(36).substring(7)
                                                            toast.warning("請輸入有效的座標數字", { id: toastId })
                                                        }
                                                    }}
                                                >
                                                    套用
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-slate-400">💡 可從 Google Maps 複製座標貼上</p>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                            {/* 🆕 P3: 動態天氣模式標籤 */}
                            <span className={`text-xs flex items-center gap-1 ml-2 shrink-0 ${weatherMode === 'live' ? 'text-green-500' :
                                weatherMode === 'forecast' ? 'text-blue-500' :
                                    weatherMode === 'seasonal' ? 'text-purple-500' :
                                        'text-amber-500'
                                }`}>
                                <span className={`w-2 h-2 rounded-full ${weatherMode === 'live' ? 'bg-green-500 animate-pulse' :
                                    weatherMode === 'forecast' ? 'bg-blue-500' :
                                        weatherMode === 'seasonal' ? 'bg-purple-500' :
                                            'bg-amber-500'
                                    }`} />
                                {weatherMode === 'live' && '即時天氣'}
                                {weatherMode === 'forecast' && '精準預報 (ECMWF)'}
                                {weatherMode === 'seasonal' && '季節預報'}
                                {weatherMode === 'trend' && '歷史同期參考'}
                            </span>
                        </div >

                        {/* 🤖 AI 天氣建議 */}
                        {weatherData.length > 0 && (
                            <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl p-4 text-white shadow-lg">
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">🤖</span>
                                    <div className="flex-1">
                                        <p className="text-sm leading-relaxed">
                                            {(() => {
                                                const maxTemp = Math.max(...weatherData.map(w => w.temp))
                                                const minTemp = Math.min(...weatherData.map(w => w.temp))
                                                const avgHumidity = weatherData[0]?.humidity ?? 50
                                                const maxPrecip = Math.max(...weatherData.map(w => w.precipitation_probability ?? 0))
                                                const hasRain = weatherData.some(w => w.code > 3)

                                                let advice = `今天氣溫 ${minTemp}°~${maxTemp}°`
                                                if (avgHumidity > 80) advice += `，濕度偏高 (${avgHumidity}%)`
                                                if (maxPrecip > 50) advice += `。下午有 ${maxPrecip}% 機率降雨，建議帶傘`
                                                else if (hasRain) advice += `。可能有短暫降雨`
                                                else advice += `，天氣良好`

                                                if (maxTemp - minTemp > 10) advice += `。日夜溫差大，注意保暖`

                                                return advice + '！'
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                            {weatherData.length > 0 ? weatherData.map((w, i) => (
                                <div key={i} className="flex flex-col items-center min-w-[4rem] gap-2 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                                    <span className="text-xs text-slate-400 font-mono">{w.time}</span>
                                    {w.code <= 3 ? <Sun className="w-6 h-6 text-amber-400" /> : <CloudRain className="w-6 h-6 text-blue-400" />}
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">{w.temp}°</span>
                                </div>
                            )) : (
                                // 💀 Skeleton Loading: Prevent Layout Shift & "Distorted" feel
                                Array.from({ length: 24 }).map((_, i) => (
                                    <div key={i} className="flex flex-col items-center min-w-[4rem] gap-2 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0 animate-pulse">
                                        <div className="w-8 h-3 bg-slate-200 dark:bg-slate-700 rounded"></div>
                                        <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                                        <div className="w-6 h-4 bg-slate-200 rounded"></div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* 📊 今日指數 (2x4 Grid 布局) */}
                        {weatherData.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 pt-2 pb-4">
                                {/* Row 1: 穿衣 | 降雨 */}
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                                    <span className="text-lg">👕</span>
                                    <div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">穿衣</div>
                                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            {(() => {
                                                const avgTemp = (Math.max(...weatherData.map(w => w.temp)) + Math.min(...weatherData.map(w => w.temp))) / 2
                                                if (avgTemp > 28) return '短袖短褲'
                                                if (avgTemp > 22) return '短袖'
                                                if (avgTemp > 15) return '長袖'
                                                if (avgTemp > 10) return '薄外套'
                                                if (avgTemp > 5) return '厚外套'
                                                return '羽絨服'
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                                    <span className="text-lg">☔</span>
                                    <div>
                                        <div className="text-xs text-slate-500">
                                            {weatherData[0]?.isSeasonalEstimate ? '降雨趨勢' : '降雨機率'}
                                        </div>
                                        <div className="text-sm font-medium text-slate-700">
                                            {weatherData[0]?.isSeasonalEstimate ? (
                                                // 🆕 Phase 11: Seasonal 模式顯示趨勢描述
                                                (() => {
                                                    const trend = weatherData[0]?.precipTrend
                                                    if (trend === 'wet') return <span className="text-blue-600">濕潤 💦</span>
                                                    if (trend === 'unstable') return <span className="text-amber-600">不穩定 🌦️</span>
                                                    return <span className="text-green-600">乾燥 ☀️</span>
                                                })()
                                            ) : (
                                                // Forecast 模式顯示精確百分比
                                                <>{Math.max(...weatherData.map(w => w.precipitation_probability ?? 0))}%</>
                                            )}
                                        </div>
                                        {weatherData[0]?.isSeasonalEstimate && (
                                            <div className="text-[9px] text-slate-400 mt-0.5">季節預測・僅供參考</div>
                                        )}
                                    </div>
                                </div>

                                {/* Row 2: 濕度 | 體感 */}
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                                    <span className="text-lg">💧</span>
                                    <div>
                                        <div className="text-xs text-slate-500">濕度</div>
                                        <div className="text-sm font-medium text-slate-700">
                                            {weatherData[Math.floor(weatherData.length / 2)]?.humidity ?? '--'}%
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                                    <span className="text-lg">🌡️</span>
                                    <div>
                                        <div className="text-xs text-slate-500">體感溫度</div>
                                        <div className="text-sm font-medium text-slate-700">
                                            {(() => {
                                                const avgApparent = weatherData[Math.floor(weatherData.length / 2)]?.apparent_temperature
                                                if (avgApparent === undefined) return '-- °C'
                                                // 🔧 修復：基於絕對體感溫度判斷，而非溫差
                                                let feeling = '舒適'
                                                if (avgApparent >= 35) feeling = '酷熱 🥵'
                                                else if (avgApparent >= 28) feeling = '悶熱'
                                                else if (avgApparent >= 20) feeling = '舒適'
                                                else if (avgApparent >= 10) feeling = '涼爽'
                                                else if (avgApparent >= 0) feeling = '寒冷 🥶'
                                                else feeling = '極寒 ❄️'
                                                return `${avgApparent}°C (${feeling})`
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Row 3: UV 指數 | 最大風速 */}
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                                    <span className="text-lg">☀️</span>
                                    <div>
                                        <div className="text-xs text-slate-500">UV 指數</div>
                                        <div className="text-sm font-medium text-slate-700">
                                            {(() => {
                                                const maxUV = Math.max(...weatherData.map(w => w.uvIndex ?? 0))
                                                if (maxUV === 0) return '無資料'
                                                return `${maxUV} (${maxUV > 7 ? '危險' : maxUV > 5 ? '高' : maxUV > 2 ? '中' : '低'})`
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                                    <span className="text-lg">💨</span>
                                    <div>
                                        <div className="text-xs text-slate-500">最大風速</div>
                                        <div className="text-sm font-medium text-slate-700">
                                            {(() => {
                                                const maxWind = Math.max(...weatherData.map(w => w.windSpeed ?? 0))
                                                if (maxWind === 0) return '無資料'
                                                return `${maxWind} km/h`
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Row 4: 能見度 | 海拔 */}
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                                    <span className="text-lg">👁️</span>
                                    <div>
                                        <div className="text-xs text-slate-500">能見度</div>
                                        <div className="text-sm font-medium text-slate-700">
                                            {(() => {
                                                const avgVis = weatherData[Math.floor(weatherData.length / 2)]?.visibility
                                                if (!avgVis) return '無資料'
                                                if (avgVis >= 10000) return `${(avgVis / 1000).toFixed(0)} km (良好)`
                                                if (avgVis >= 5000) return `${(avgVis / 1000).toFixed(1)} km (普通)`
                                                return `${(avgVis / 1000).toFixed(1)} km (差)`
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                                    <span className="text-lg">🏔️</span>
                                    <div>
                                        <div className="text-xs text-slate-500">海拔</div>
                                        <div className="text-sm font-medium text-slate-700">
                                            {elevation !== null ? `${Math.round(elevation)} m` : '無資料'}
                                        </div>
                                    </div>
                                </div>

                                {/* Row 5 (Optional): AQI - 僅在有數據時顯示 */}
                                {(() => {
                                    const maxAQI = Math.max(...weatherData.map(w => w.airQuality ?? 0))
                                    if (maxAQI > 0) {
                                        return (
                                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2 col-span-2">
                                                <span className="text-lg">🌱</span>
                                                <div className="flex-1">
                                                    <div className="text-xs text-slate-500">空氣品質 (AQI)</div>
                                                    <div className="text-sm font-medium text-slate-700">
                                                        {(() => {
                                                            let level = '良好'
                                                            let color = 'text-green-600'
                                                            if (maxAQI > 300) { level = '危害'; color = 'text-red-600' }
                                                            else if (maxAQI > 200) { level = '極差'; color = 'text-red-500' }
                                                            else if (maxAQI > 150) { level = '不健康'; color = 'text-orange-500' }
                                                            else if (maxAQI > 100) { level = '敏感族群'; color = 'text-yellow-600' }
                                                            else if (maxAQI > 50) { level = '普通'; color = 'text-yellow-500' }
                                                            return <span className={color}>{maxAQI} ({level})</span>
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }
                                    return null
                                })()}
                            </div>
                        )}

                        {/* 🆕 Phase 5: Open-Meteo 歸屬標註 (免費使用必要條件) */}
                        <div className="flex justify-end pt-1">
                            <a
                                href="https://open-meteo.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-slate-400 hover:text-blue-500 transition-colors"
                            >
                                Weather data by Open-Meteo
                            </a>
                        </div>
                    </div >

                    {/* 🕵️ AI 深度審核 - 每日都有 */}
                    <EditableDailyAIReview
                        key={`ai-review-${day}`}
                        tripId={activeTripId || ""}
                        day={day}
                        review={getDayData(currentTrip?.day_ai_reviews, day) || (day === 1 ? currentTrip?.ai_review : undefined)}
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
                                await tripsApi.updateDayData(activeTripId, day, updatePayload as Parameters<typeof tripsApi.updateDayData>[2])
                                await reloadTripDetail()
                                return true
                            } catch (e) {
                                console.error("Failed to update day data:", e)
                                toast.error("更新失敗")
                                return false
                            }
                        }}
                    />

                    {/* 🆕 行前清單 */}
                    <EditableDailyChecklist
                        key={`checklist-${day}`}
                        tripId={activeTripId || ""}
                        day={day}
                        items={day === 1 ? [...(getDayData(currentTrip?.day_checklists, 0) || []), ...(getDayData(currentTrip?.day_checklists, 1) || [])] : (getDayData(currentTrip?.day_checklists, day) || [])}
                        userId={userId || undefined}
                        onUpdate={async (items) => {
                            if (!activeTripId) return false
                            try {
                                // 1. 儲存當前天數的清單
                                await tripsApi.updateDayData(activeTripId, day, {
                                    day_checklists: { [day]: items }
                                })

                                // 2. ⚡ 殭屍清除邏輯：如果是在 Day 1 編輯，且 Day 0 有資料，須將 Day 0 清空
                                const hasDay0Items = (currentTrip?.day_checklists?.[0]?.length || 0) > 0
                                if (day === 1 && hasDay0Items) {
                                    debugLog("🧹 Detecting Day 0 items after merge, clearing Day 0...")
                                    await tripsApi.updateDayData(activeTripId, 0, {
                                        day_checklists: { "0": [] }
                                    })
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

                    <div className="px-5 py-6">
                        {/* 🚀 Phase 2: Virtuoso 虛擬化列表 (自動高度偵測) */}
                        {(() => {
                            // 預先計算每個項目的 realIndex
                            const realIndices: number[] = [];
                            let counter = 0;
                            currentDayData.forEach((item: Activity) => {
                                const isHeader = item.category === 'header' || item.time === '00:00';
                                if (!isHeader) counter++;
                                realIndices.push(counter);
                            });

                            return currentDayData.length > 0 ? (
                                <DndContext
                                    sensors={dndSensors}
                                    collisionDetection={closestCorners}  // 🔧 Phase 1: 比 closestCenter 穩定
                                    autoScroll={{
                                        threshold: { x: 0, y: 0.15 },  // 15% 邊緣觸發
                                        acceleration: 25,               // 加速度
                                        interval: 10,                   // 刷新頻率 (ms)
                                    }}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onDragCancel={handleDragCancel}
                                >
                                    <SortableContext
                                        items={currentDayData.map((a: Activity) => a.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <Virtuoso
                                            customScrollParent={scrollParent}
                                            // 🔧 Fix: Remove useWindowScroll as we act as our own scroll container
                                            // useWindowScroll  <-- REMOVED
                                            data={currentDayData}
                                            itemContent={(idx, item) => {
                                                const isHeader = item.category === 'header' || (item.time || item.time_slot || "00:00") === '00:00'
                                                return (
                                                    <SortableTimelineCard
                                                        key={item.id}
                                                        activity={item}
                                                        index={realIndices[idx]}
                                                        isLast={idx === currentDayData.length - 1}
                                                        isDragDisabled={isHeader || !isOnline}
                                                        onEdit={handleEditActivity}
                                                        onDelete={handleDeleteActivity}
                                                        onUpdateMemo={handleUpdateMemo}
                                                        onUpdateSubItems={handleUpdateSubItems}
                                                    />
                                                )
                                            }}
                                        />
                                    </SortableContext>

                                    {/* 🆕 DragOverlay - 🔧 FIX: 使用 Portal 渲染至 Body (避免 overflow 裁切) */}
                                    {
                                        mounted && createPortal(
                                            <DragOverlay
                                                dropAnimation={{
                                                    duration: 250,
                                                    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)', // 🔧 彈簧回彈效果
                                                }}
                                            >
                                                {activeId && (() => {
                                                    const activity = currentDayData.find((a: Activity) => a.id === activeId)
                                                    return activity ? <TimelineCardOverlay activity={activity} /> : null
                                                })()}
                                            </DragOverlay>,
                                            document.body
                                        )
                                    }
                                </DndContext>
                            ) : null;
                        })()}

                        <div className="py-4 text-center">
                            <Button
                                variant="outline"
                                className="w-full border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                                disabled={!isOnline}
                                onClick={() => {
                                    if (!isOnline) {
                                        toast.error("✈️ 離線模式下無法編輯")
                                        return
                                    }
                                    setIsAddMode(true);
                                    setEditItem({ time: "10:00", place: "", desc: "", category: "sightseeing", lat: null, lng: null, tags: [] });
                                    setIsEditOpen(true);
                                }}
                            >
                                <Plus className="w-4 h-4 mr-2" />{isOnline ? "Add Activity" : "✈️ 離線模式"}
                            </Button>
                        </div>

                        <div className="mt-8">
                            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 pl-1">Daily Route Map</h3>
                            <DayMap
                                activities={currentDayData}
                                onAddPOI={handleAddPOI}
                                tripTitle={currentTrip?.title}  // 🆕 傳遞行程標題用於智能搜尋
                            />
                        </div>
                    </div>
                </PullToRefresh >

                <ActivityEditModal
                    isOpen={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    editItem={editItem}
                    setEditItem={setEditItem}
                    isAddMode={isAddMode}
                    isSaving={isSavingActivity}
                    onSave={handleSaveEdit}
                    dailyLoc={dailyLocs[day]}
                    tripTitle={currentTrip?.title}  // 🆕 智能搜尋
                    biasLoc={calculateBiasLocation(day)} // 🆕 注入位置權重 (Sequential Bias)
                />

                {/* 🆕 Reorder Confirmation Dialog - 混合模式 */}
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
            </div >
        </div>
    )
}
