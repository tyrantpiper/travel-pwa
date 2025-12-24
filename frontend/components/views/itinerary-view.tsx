"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { ArrowLeft, Calendar, Plus, Hash, Trash2, MapPin, Edit3, Sun, CloudRain } from "lucide-react"
import { TimelineCard } from "@/components/timeline-card"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useTripDetail, useOnlineStatus } from "@/lib/hooks"
import { useLanguage } from "@/lib/LanguageContext"
import { ImageUpload } from "@/components/ui/image-upload"

const DayMap = dynamic(() => import("@/components/day-map"), { ssr: false, loading: () => <div className="h-64 w-full bg-slate-100 animate-pulse rounded-xl" /> })
import DailyTips from "@/components/daily-tips"
import { useTripContext } from "@/lib/trip-context"
import { TripSwitcher } from "@/components/trip-switcher"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { toast } from "sonner"
import { useHaptic } from "@/lib/hooks"
import { Loader2, Clock } from "lucide-react"
import { TripCardSkeleton } from "@/components/ui/skeleton"
import { getNowInZone } from "@/lib/timezone"
import { POISearch } from "@/components/poi-search"

const DEFAULT_START_DATE = new Date()
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export function ItineraryView() {
    const { t } = useLanguage()
    const { activeTripId, mutate: reloadTrips, userId, trips, setActiveTripId, isLoading: isTripsLoading } = useTripContext()
    const [viewMode, setViewMode] = useState<'list' | 'detail'>('list')

    // Use activeTripId from context
    const { trip: currentTrip, mutate: reloadTripDetail } = useTripDetail(activeTripId)

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newTripTitle, setNewTripTitle] = useState("")
    const [newTripStart, setNewTripStart] = useState("2026-02-02")
    const [newTripEnd, setNewTripEnd] = useState("2026-02-10")
    const [newTripCover, setNewTripCover] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [joinCode, setJoinCode] = useState("")
    const [isJoinLoading, setIsJoinLoading] = useState(false)
    const haptic = useHaptic()
    const isOnline = useOnlineStatus()  // 🆕 離線狀態偵測

    const [editItem, setEditItem] = useState<any>(null)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isAddMode, setIsAddMode] = useState(false)
    const [placeSearchResults, setPlaceSearchResults] = useState<any[]>([])
    const [isPlaceSearching, setIsPlaceSearching] = useState(false)
    const [isSavingActivity, setIsSavingActivity] = useState(false)

    const [day, setDay] = useState(1)
    const [weatherData, setWeatherData] = useState<any[]>([])
    const [dailyLocs, setDailyLocs] = useState<any>({})
    const [isLocEditOpen, setIsLocEditOpen] = useState(false)
    const [newLocName, setNewLocName] = useState("")
    const [locSearchResults, setLocSearchResults] = useState<any[]>([])
    const [isLocSearching, setIsLocSearching] = useState(false)
    const [searchCountry, setSearchCountry] = useState<string>("")  // 國家篩選：空=全球, Japan, Taiwan, etc.
    const [dailyLocSearchRegion, setDailyLocSearchRegion] = useState<string>("") // 每日地點搜尋區域
    const [currentTimezone, setCurrentTimezone] = useState<string>("Asia/Tokyo")  // 當前顯示地點的時區
    const [activitySearchCountry, setActivitySearchCountry] = useState<string>("")
    const [activitySearchRegion, setActivitySearchRegion] = useState<string>("")

    const COUNTRY_REGIONS: { [key: string]: string[] } = {
        "Japan": ["Tokyo 東京", "Osaka 大阪", "Kyoto 京都", "Hokkaido 北海道", "Okinawa 沖繩", "Fukuoka 福岡", "Nagoya 名古屋", "Yokohama 橫濱", "Nara 奈良", "Hiroshima 廣島"],
        "Taiwan": ["Taipei 台北", "Kaohsiung 高雄", "Taichung 台中", "Tainan 台南", "Hualien 花蓮", "Yilan 宜蘭", "Taitung 台東"],
        "South Korea": ["Seoul 首爾", "Busan 釜山", "Jeju 濟州島", "Incheon 仁川", "Daegu 大邱"],
        "Thailand": ["Bangkok 曼谷", "Chiang Mai 清邁", "Phuket 普吉島", "Pattaya 芭達雅"],
        "Vietnam": ["Ho Chi Minh City 胡志明市", "Hanoi 河內", "Da Nang 峴港", "Hoi An 會安"],
        "Hong Kong": ["Central 中環", "Tsim Sha Tsui 尖沙咀", "Mong Kok 旺角", "Causeway Bay 銅鑼灣"],
        "Singapore": ["Marina Bay 濱海灣", "Sentosa 聖淘沙", "Chinatown 牛車水", "Orchard 烏節路"],
        "USA": ["New York 紐約", "Los Angeles 洛杉磯", "San Francisco 舊金山", "Las Vegas 拉斯維加斯", "Chicago 芝加哥"],
        "UK": ["London 倫敦", "Edinburgh 愛丁堡", "Manchester 曼徹斯特", "Oxford 牛津"],
        "France": ["Paris 巴黎", "Nice 尼斯", "Lyon 里昂", "Marseille 馬賽"],
        "Italy": ["Rome 羅馬", "Milan 米蘭", "Venice 威尼斯", "Florence 佛羅倫斯"],
    }

    useEffect(() => {
        if (currentTrip && currentTrip.daily_locations) {
            setDailyLocs(currentTrip.daily_locations)
        }
    }, [currentTrip])

    // 🆕 離線快取：有網路時將行程存入 localStorage
    useEffect(() => {
        if (isOnline && currentTrip && activeTripId) {
            try {
                localStorage.setItem(`offline_trip_${activeTripId}`, JSON.stringify(currentTrip))
                console.log(`✈️ 已快取行程: ${currentTrip.title}`)
            } catch (e) {
                console.warn("快取行程失敗:", e)
            }
        }
    }, [isOnline, currentTrip, activeTripId])
    // Get the first activity with coordinates for the current day
    const getFirstActivityWithCoords = () => {
        if (currentTrip?.days) {
            const dayData = currentTrip.days.find((d: any) => d.day === day)
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

    useEffect(() => {
        const fetchWeather = async () => {
            let lat = 35.6895  // Default: Tokyo
            let lng = 139.6917
            let locationName = "Tokyo (Default)"

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
                locationName = dailyLocs[day].name || "Current Location"
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
                    locationName = activityLoc.name
                    // Auto-update dailyLocs for display
                    setDailyLocs((prev: any) => ({ ...prev, [day]: activityLoc }))
                } else if (currentTrip?.title) {
                    // Priority 3: Parse city from trip title
                    for (const [cityName, coords] of Object.entries(CITY_COORDS)) {
                        if (currentTrip.title.includes(cityName)) {
                            lat = coords.lat
                            lng = coords.lng
                            locationName = coords.name
                            setCurrentTimezone(coords.timezone)  // 設定時區
                            // Auto-update dailyLocs for display
                            setDailyLocs((prev: any) => ({ ...prev, [day]: { lat, lng, name: locationName } }))
                            break
                        }
                    }
                }
            }

            try {
                const res = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=1`
                )
                const data = await res.json()
                const temps = data.hourly.temperature_2m
                const codes = data.hourly.weather_code
                const forecast = []

                for (let i = 6; i <= 23; i++) {
                    forecast.push({
                        time: `${i}:00`,
                        temp: Math.round(temps[i]),
                        code: codes[i]
                    })
                }
                setWeatherData(forecast)
            } catch (e) { console.error("Weather error", e) }
        }
        fetchWeather()
    }, [day, dailyLocs, currentTrip])

    const handleDeleteTrip = async (tripId: string) => {
        if (!confirm("確定要刪除此行程嗎？此操作無法復原！")) return

        try {
            const res = await fetch(`${API_BASE}/api/trips/${tripId}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Delete failed")

            toast.success("行程已刪除")

            // If we're deleting the active trip, clear selection
            if (activeTripId === tripId) {
                setActiveTripId(null)
            }

            // Refresh the trips list
            reloadTrips()
        } catch (error) {
            console.error(error)
            toast.error("刪除失敗")
        }
    }

    const handleManualCreate = async () => {
        if (isCreating) return // 防止重複點擊
        haptic.tap()

        const userName = localStorage.getItem("user_nickname")
        if (!userId || !newTripTitle) { haptic.error(); return }

        setIsCreating(true)
        try {
            await fetch(`${API_BASE}/api/trip/create-manual`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newTripTitle, start_date: newTripStart, end_date: newTripEnd,
                    creator_name: userName, user_id: userId,
                    cover_image: newTripCover
                })
            })
            haptic.success()
            setIsCreateOpen(false)
            setNewTripCover("")
            reloadTrips()
        } catch (_e) { haptic.error(); toast.error("Create failed") }
        finally { setIsCreating(false) }
    }

    const handleJoinTrip = async () => {
        if (joinCode.length !== 4) { toast.warning("Please enter 4-digit code"); return }
        setIsJoinLoading(true)
        const userName = localStorage.getItem("user_nickname")
        try {
            const res = await fetch(`${API_BASE}/api/join-trip`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ share_code: joinCode, user_id: userId, user_name: userName })
            })
            if (!res.ok) throw new Error("Invalid code")
            toast.success("Joined!")
            setJoinCode("")
            reloadTrips()
        } catch (_e) { toast.error("Trip not found") }
        finally { setIsJoinLoading(false) }
    }

    const handleSearchLocation = async () => {
        if (!newLocName.trim()) return
        setIsLocSearching(true)
        try {
            // 組合搜尋詞：關鍵字 + 地區 + 國家
            const queryWithCountry = `${newLocName.trim()} ${dailyLocSearchRegion} ${searchCountry}`.trim()

            // 使用後端統一地理編碼 API（ArcGIS + Photon）
            const res = await fetch(`${API_BASE}/api/geocode/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: queryWithCountry, limit: 8 })
            })
            const data = await res.json()

            if (!data.results || data.results.length === 0) {
                toast.warning("找不到此地點，請嘗試其他關鍵字")
                setLocSearchResults([])
            } else {
                // 轉換成統一格式
                const results = data.results.map((item: any) => ({
                    name: item.name,
                    display_name: item.address || item.name,
                    latitude: item.lat,
                    longitude: item.lng,
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
                    console.log("🗺️ 使用 ArcGIS 搜尋")
                } else if (data.source === "photon") {
                    console.log("🔍 使用 Photon 搜尋")
                }
            }
        } catch (_e) { toast.error("搜尋失敗") }
        finally { setIsLocSearching(false) }
    }


    const handleSelectLocation = async (loc: any) => {
        if (!currentTrip) return
        try {
            const displayName = loc.admin2 || loc.admin1 ? `${loc.name}, ${loc.admin2 || loc.admin1}` : loc.name
            await fetch(`${API_BASE}/api/trips/${currentTrip.id}/location`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ day: day, name: displayName, lat: loc.latitude, lng: loc.longitude })
            })

            setDailyLocs({ ...dailyLocs, [day]: { name: displayName, lat: loc.latitude, lng: loc.longitude } })
            setIsLocEditOpen(false)
            setNewLocName("")
            setLocSearchResults([])
            reloadTripDetail()
        } catch (_e) { toast.error("更新失敗") }
    }

    const handleSaveEdit = async () => {
        if (!editItem && !isAddMode) return
        if (isSavingActivity) return // 防止重複點擊
        haptic.tap() // 觸覺回饋

        setIsSavingActivity(true)

        let finalLat = editItem.lat
        let finalLng = editItem.lng
        if (editItem.place && (!finalLat || !finalLng)) {
            try {
                // 使用後端統一地理編碼 API
                const res = await fetch(`${API_BASE}/api/geocode/search`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: editItem.place, limit: 1 })
                })
                const data = await res.json()
                if (data.results && data.results.length > 0) {
                    finalLat = data.results[0].lat
                    finalLng = data.results[0].lng
                }
            } catch (_e) { }
        }

        try {
            if (isAddMode) {
                if (!currentTrip) return
                await fetch(`${API_BASE}/api/items`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        itinerary_id: currentTrip.id,
                        day_number: day,
                        time_slot: editItem.time,
                        place_name: editItem.place,
                        category: editItem.category,
                        notes: editItem.desc,
                        lat: finalLat, lng: finalLng
                    })
                })
            } else {
                await fetch(`${API_BASE}/api/items/${editItem.id}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        time_slot: editItem.time,
                        place_name: editItem.place,
                        category: editItem.category,
                        tags: editItem.tags,
                        notes: editItem.desc,
                        lat: finalLat, lng: finalLng,
                        image_url: editItem.image_url
                    })
                })
            }
            haptic.success()
            setIsEditOpen(false)
            reloadTripDetail()
        } catch (_e) {
            haptic.error()
            toast.error("Save failed")
        } finally {
            setIsSavingActivity(false)
        }
    }

    const handleUpdateMemo = async (id: string, newMemo: string) => {
        await fetch(`${API_BASE}/api/items/${id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memo: newMemo })
        })
        reloadTripDetail()
        return true
    }

    const handleUpdateSubItems = async (id: string, newItems: any[]) => {
        await fetch(`${API_BASE}/api/items/${id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sub_items: newItems })
        })
        reloadTripDetail()
        return true
    }

    const handleDeleteItem = async (id: string) => {
        if (!confirm(t('confirm_delete'))) return

        // Optimistic update: immediately remove from UI
        if (currentTrip?.days) {
            const optimisticData = {
                ...currentTrip,
                days: currentTrip.days.map((d: any) => ({
                    ...d,
                    activities: d.activities?.filter((a: any) => a.id !== id) || []
                }))
            }
            reloadTripDetail(optimisticData, false) // Update cache without revalidation
        }

        // Background API call
        fetch(`${API_BASE}/api/items/${id}`, { method: "DELETE" })
            .catch(() => reloadTripDetail()) // Revert on error
    }

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
        } catch (_e) {
            toast.error("刪除失敗")
        }
    }

    // 🆕 新增天數
    const handleAddDay = async (position: "before" | "end") => {
        if (!currentTrip) return

        const insertPos = position === "before" ? `before:1` : "end"

        // Optimistic update: add a new empty day
        const optimisticData = {
            ...currentTrip,
            // 不需要調整 days，因為新天數是空的
        }
        reloadTripDetail(optimisticData, false)

        try {
            const res = await fetch(`${API_BASE}/api/trips/${currentTrip.id}/days`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ position: insertPos })
            })

            if (!res.ok) throw new Error("API failed")

            const data = await res.json()
            toast.success(`已新增 Day ${data.new_day}`)

            // 刷新取得正確的天數資料
            reloadTripDetail()

            // 如果是新增到開頭，切換到第一天
            if (position === "before") setDay(1)
        } catch {
            toast.error("新增失敗")
            reloadTripDetail()
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
            return Math.max(...currentTrip.days.map((d: any) => d.day || 1))
        }
        return 7
    })()
    const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1)

    const getDateInfo = (dayNum: number) => {
        const start = currentTrip ? new Date(currentTrip.start_date || DEFAULT_START_DATE) : DEFAULT_START_DATE
        const d = new Date(start)
        d.setDate(d.getDate() + (dayNum - 1))
        return { date: `${d.getMonth() + 1}/${d.getDate()}`, week: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()] }
    }

    if (viewMode === 'list') {
        return (
            <div className="flex flex-col min-h-screen bg-stone-50 px-6 py-12 pb-32">
                <header className="mb-8">
                    <h1 className="text-3xl font-serif text-slate-900 mb-2">{t('my_trips')}</h1>
                    <p className="text-slate-500 text-sm">{t('manage_journeys')}</p>
                </header>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-24 border-2 border-dashed border-slate-300 bg-transparent text-slate-400 hover:bg-slate-100 rounded-2xl flex flex-col gap-2"><Plus className="w-6 h-6" /><span className="text-xs font-bold uppercase">{t('new_trip')}</span></Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>{t('create_trip')}</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                {/* Cover Image Upload */}
                                <div className="flex justify-center">
                                    <ImageUpload
                                        value={newTripCover}
                                        onChange={setNewTripCover}
                                        onRemove={() => setNewTripCover("")}
                                        folder="ryan_travel/covers"
                                    />
                                </div>
                                <div className="space-y-2"><Label>{t('trip_name')}</Label><Input value={newTripTitle} onChange={e => setNewTripTitle(e.target.value)} placeholder="Tokyo 2026" /></div>
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>{t('start_date')}</Label><Input type="date" value={newTripStart} onChange={e => setNewTripStart(e.target.value)} /></div><div className="space-y-2"><Label>{t('end_date')}</Label><Input type="date" value={newTripEnd} onChange={e => setNewTripEnd(e.target.value)} /></div></div>
                                <div className="flex gap-2 pt-2"><Button className="flex-1" onClick={handleManualCreate} disabled={isCreating}>{isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />創建中...</> : t('create')}</Button><Button variant="outline" className="flex-1" onClick={() => toast.info("Go to Tools page for AI import")}>{t('ai_import')}</Button></div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog>
                        <DialogTrigger asChild><Button className="h-24 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl flex flex-col gap-2 shadow-lg"><Hash className="w-6 h-6 text-amber-400" /><span className="text-xs font-bold uppercase">{t('join_code')}</span></Button></DialogTrigger>
                        <DialogContent className="sm:max-w-xs"><DialogHeader><DialogTitle>{t('enter_trip_code')}</DialogTitle></DialogHeader><div className="space-y-4 py-4"><Input placeholder="8821" className="text-center text-2xl tracking-[0.5em] font-mono uppercase h-14" maxLength={4} value={joinCode} onChange={(e) => setJoinCode(e.target.value)} /><Button className="w-full" onClick={handleJoinTrip} disabled={isJoinLoading}>{isJoinLoading ? t('joining') : t('join_trip')}</Button></div></DialogContent>
                    </Dialog>
                </div>

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
                    {!isTripsLoading && trips.map((trip: any) => (
                        <Card key={trip.id} className="p-0 overflow-hidden border-0 shadow-sm transition-transform relative group">
                            <div className="absolute top-2 right-2 z-20">
                                <Button variant="destructive" size="icon" className="w-8 h-8 rounded-full shadow-md bg-red-500 hover:bg-red-600 border border-white/20" onClick={(e) => { e.stopPropagation(); handleDeleteTrip(trip.id) }}><Trash2 className="w-4 h-4 text-white" /></Button>
                            </div>
                            <div className="cursor-pointer active:opacity-90" onClick={() => { setActiveTripId(trip.id); setViewMode('detail'); }}>
                                <div className="h-24 bg-slate-800 relative rounded-t-lg overflow-hidden">
                                    {trip.cover_image ? (
                                        <img src={trip.cover_image} alt="cover" className="w-full h-full object-cover opacity-80" />
                                    ) : (
                                        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                    <div className="absolute bottom-4 left-4 text-white">
                                        <h3 className="font-bold text-lg">{trip.title}</h3>
                                        <p className="text-xs opacity-80 flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(trip.start_date).toLocaleDateString()}</p>
                                    </div>
                                    <div className="absolute top-3 right-12 bg-white/20 backdrop-blur-md px-2 py-1 rounded text-xs text-white font-mono flex items-center gap-1"><Hash className="w-3 h-3" /> {trip.share_code}</div>
                                </div>
                                <div className="p-4 bg-white flex justify-between items-center rounded-b-lg">
                                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">By {trip.creator_name || 'Guest'}</span>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    const currentDayData = currentTrip?.days
        ? currentTrip.days.find((d: any) => d.day === day)?.activities || []
        : []

    return (
        <div className="flex flex-col min-h-screen bg-stone-50 pb-32 overflow-x-hidden">
            <div className="bg-white pt-12 pb-2 sticky top-0 z-20 border-b border-slate-100 shadow-sm">
                <div className="px-6 flex justify-between items-end mb-4">
                    <div>
                        <button onClick={handleBack} className="flex items-center gap-1 text-xs font-bold text-slate-400 mb-2">
                            <ArrowLeft className="w-3 h-3" /> BACK
                        </button>
                        <TripSwitcher className="w-[240px] justify-start px-0 font-serif font-bold text-2xl border-none shadow-none bg-transparent hover:bg-slate-100/50 h-auto py-1" />
                    </div>
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

                    {dayNumbers.map((d) => {
                        const { date, week } = getDateInfo(d)
                        return (
                            <div key={d} className="relative group">
                                <button onClick={() => setDay(d)} className={cn("flex flex-col items-center min-w-[3.5rem] py-2 rounded-lg border transition-all", day === d ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50")}>
                                    <span className="text-[10px] opacity-70">{week}</span>
                                    <span className="font-bold">{date}</span>
                                </button>
                                {totalDays > 1 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteDay(d) }}
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center shadow-sm touch-manipulation border border-white"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        )
                    })}

                    {/* 🆕 新增天數按鈕 (結尾) */}
                    <button
                        onClick={() => handleAddDay("end")}
                        className="flex-shrink-0 w-8 h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-lg font-bold flex items-center justify-center shadow-sm transition-all hover:scale-110"
                        title="在結尾新增一天"
                    >
                        +
                    </button>
                </div>
            </div>

            <PullToRefresh onRefresh={async () => { await reloadTripDetail() }} className="flex-1">
                <div className="py-6 px-6 bg-stone-50/50">
                    <div className="flex items-center justify-between mb-4">
                        <Dialog open={isLocEditOpen} onOpenChange={(open) => {
                            if (open) {
                                // Reset filters when opening
                                setSearchCountry("")
                                setDailyLocSearchRegion("")
                            }
                            setIsLocEditOpen(open)
                        }}>
                            <DialogTrigger asChild>
                                <button className="flex items-center gap-2 hover:bg-white/50 p-2 -ml-2 rounded-lg transition-colors group">
                                    <MapPin className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                                    <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900">
                                        {dailyLocs[day]?.name || "Tokyo (Default)"}
                                    </span>
                                    <Edit3 className="w-3 h-3 text-slate-300 group-hover:text-amber-500 transition-colors" />
                                </button>
                            </DialogTrigger>
                            {/* 當地時間顯示 */}
                            <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1.5 rounded-lg shadow-sm border border-slate-100">
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-xs font-mono font-medium text-slate-700">
                                    {getNowInZone(currentTimezone)}
                                </span>
                            </div>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader><DialogTitle>修改第 {day} 天的天氣地點</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4">
                                    {/* 當前座標顯示 */}
                                    {dailyLocs[day] && (
                                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                                            <div className="text-xs text-slate-500 mb-1">📍 目前地點</div>
                                            <div className="font-bold text-slate-800">{dailyLocs[day].name}</div>
                                            <div className="text-xs text-slate-400 font-mono">
                                                {dailyLocs[day].lat?.toFixed(4)}, {dailyLocs[day].lng?.toFixed(4)}
                                            </div>
                                        </div>
                                    )}

                                    {/* 從活動同步按鈕 */}
                                    {(() => {
                                        const activityLoc = currentTrip?.days?.find((d: any) => d.day === day)?.activities?.find((a: any) => a.lat && a.lng)
                                        if (activityLoc) {
                                            return (
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-start text-left h-auto py-3"
                                                    onClick={() => {
                                                        setDailyLocs({ ...dailyLocs, [day]: { name: activityLoc.place, lat: activityLoc.lat, lng: activityLoc.lng } })
                                                        setIsLocEditOpen(false)
                                                    }}
                                                >
                                                    <div>
                                                        <div className="text-xs text-amber-600 font-bold">⚡ 從活動同步</div>
                                                        <div className="text-sm text-slate-700">{activityLoc.place}</div>
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
                                                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
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
                                                        className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
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
                                                const typeLabel = typeLabels[loc.type] || `📍 ${loc.type || '地點'}`

                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleSelectLocation(loc)}
                                                        className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-amber-50 hover:border-amber-300 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{typeLabel}</span>
                                                            <span className="font-bold text-slate-800">{loc.name}</span>
                                                        </div>
                                                        <div className="text-xs text-slate-500 line-clamp-1">
                                                            {loc.display_name || [loc.admin2, loc.admin1, loc.country].filter(Boolean).join(', ')}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-mono">
                                                            {loc.latitude?.toFixed(6)}, {loc.longitude?.toFixed(6)}
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
                                                        toast.warning("請輸入有效的座標數字")
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
                        <span className="text-xs text-slate-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Live Weather</span>
                    </div >

                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                        {weatherData.length > 0 ? weatherData.map((w, i) => (
                            <div key={i} className="flex flex-col items-center min-w-[4rem] gap-2 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm shrink-0">
                                <span className="text-xs text-slate-400 font-mono">{w.time}</span>
                                {w.code <= 3 ? <Sun className="w-6 h-6 text-amber-400" /> : <CloudRain className="w-6 h-6 text-blue-400" />}
                                <span className="text-sm font-bold text-slate-700">{w.temp}C</span>
                            </div>
                        )) : <div className="text-xs text-slate-400 p-2">Loading weather...</div>}
                    </div>
                </div >



                <DailyTips
                    day={day}
                    notes={currentTrip?.day_notes?.[day]}
                    costs={currentTrip?.day_costs?.[day]}
                    tickets={currentTrip?.day_tickets?.[day]}
                />

                <div className="px-5 py-6 space-y-1">
                    {(() => {
                        let realIndex = 0;
                        return currentDayData.map((item: any, idx: number) => {
                            const isHeader = item.category === 'header' || item.time === '00:00';
                            if (!isHeader) realIndex++;
                            return (
                                <TimelineCard
                                    key={item.id}
                                    activity={item}
                                    index={realIndex}
                                    isLast={idx === currentDayData.length - 1}
                                    onEdit={(item) => {
                                        if (!isOnline) {
                                            toast.error("✈️ 離線模式下無法編輯")
                                            return
                                        }
                                        setIsAddMode(false)
                                        setEditItem(item)
                                        // Reset search filters when opening edit
                                        setActivitySearchCountry("")
                                        setActivitySearchRegion("")
                                        setIsEditOpen(true)
                                    }}
                                    onDelete={(id) => {
                                        if (!isOnline) {
                                            toast.error("✈️ 離線模式下無法刪除")
                                            return
                                        }
                                        handleDeleteItem(id)
                                    }}
                                    onUpdateMemo={handleUpdateMemo}
                                    onUpdateSubItems={handleUpdateSubItems}
                                />
                            )
                        })
                    })()}

                    <div className="py-4 text-center">
                        <Button
                            variant="outline"
                            className="w-full border-dashed border-slate-300 text-slate-400"
                            disabled={!isOnline}
                            onClick={() => {
                                if (!isOnline) {
                                    toast.error("✈️ 離線模式下無法編輯")
                                    return
                                }
                                setIsAddMode(true);
                                setEditItem({ time: "10:00", place: "", desc: "", category: "sightseeing", lat: null, lng: null });
                                // Reset search filters when opening add
                                setActivitySearchCountry("")
                                setActivitySearchRegion("")
                                setIsEditOpen(true);
                            }}
                        >
                            <Plus className="w-4 h-4 mr-2" />{isOnline ? "Add Activity" : "✈️ 離線模式"}
                        </Button>
                    </div>

                    <div className="mt-8">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">Daily Route Map</h3>
                        <DayMap activities={currentDayData} />
                    </div>
                </div>
            </PullToRefresh >

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{isAddMode ? "Add Activity" : "Edit Activity"}</DialogTitle></DialogHeader>
                    {editItem && (
                        <div className="space-y-4 py-4">
                            {/* Spot Photo Upload */}
                            <div className="flex justify-center mb-2">
                                <ImageUpload
                                    value={editItem.image_url}
                                    onChange={(url) => setEditItem({ ...editItem, image_url: url })}
                                    onRemove={() => setEditItem({ ...editItem, image_url: "" })}
                                    folder="ryan_travel/spots"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Time</Label>
                                <Input type="time" value={editItem.time} onChange={(e) => setEditItem({ ...editItem, time: e.target.value })} className="col-span-3" />
                            </div>

                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right pt-2">Filter</Label>
                                <div className="col-span-3 flex flex-wrap gap-2">
                                    <select
                                        className="min-w-[100px] flex-1 h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                                        value={activitySearchCountry}
                                        onChange={(e) => {
                                            setActivitySearchCountry(e.target.value)
                                            setActivitySearchRegion("") // Reset region when country changes
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
                                        <option value="USA">🇺🇸 USA</option>
                                        <option value="UK">🇬🇧 UK</option>
                                        <option value="France">🇫🇷 France</option>
                                        <option value="Italy">🇮🇹 Italy</option>
                                    </select>

                                    {activitySearchCountry && COUNTRY_REGIONS[activitySearchCountry] ? (
                                        <select
                                            className="min-w-[100px] flex-1 h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                                            value={activitySearchRegion}
                                            onChange={(e) => setActivitySearchRegion(e.target.value)}
                                        >
                                            <option value="">🏙️ Region (All)</option>
                                            {COUNTRY_REGIONS[activitySearchCountry].map(region => (
                                                <option key={region} value={region}>{region}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <Input
                                            placeholder="🏙️ Region"
                                            className="min-w-[100px] flex-1"
                                            value={activitySearchRegion}
                                            onChange={(e) => setActivitySearchRegion(e.target.value)}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right pt-2">Place</Label>
                                <div className="col-span-3 space-y-2">
                                    <div className="flex gap-2">
                                        <Input
                                            value={editItem.place}
                                            onChange={(e) => setEditItem({ ...editItem, place: e.target.value })}
                                            placeholder="輸入商家/景點名稱..."
                                            onKeyDown={(e) => e.key === 'Enter' && (async () => {
                                                if (!editItem.place?.trim()) return
                                                setIsPlaceSearching(true)
                                                try {
                                                    const res = await fetch(`${API_BASE}/api/geocode/search`, {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            query: `${editItem.place} ${activitySearchRegion} ${activitySearchCountry}`.trim(),
                                                            limit: 5
                                                        })
                                                    })
                                                    const data = await res.json()
                                                    setPlaceSearchResults((data.results || []).map((item: any) => ({
                                                        name: item.name,
                                                        display_name: item.address || item.name,
                                                        lat: item.lat,
                                                        lng: item.lng,
                                                        type: item.type || "place",
                                                        source: item.source
                                                    })))
                                                } catch (_e) { toast.error('搜尋失敗') }
                                                finally { setIsPlaceSearching(false) }
                                            })()}
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            disabled={isPlaceSearching}
                                            onClick={async () => {
                                                if (!editItem.place?.trim()) return
                                                setIsPlaceSearching(true)
                                                try {
                                                    const res = await fetch(`${API_BASE}/api/geocode/search`, {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            query: `${editItem.place} ${activitySearchRegion} ${activitySearchCountry}`.trim(),
                                                            limit: 5
                                                        })
                                                    })
                                                    const data = await res.json()
                                                    setPlaceSearchResults((data.results || []).map((item: any) => ({
                                                        name: item.name,
                                                        display_name: item.address || item.name,
                                                        lat: item.lat,
                                                        lng: item.lng,
                                                        type: item.type || "place",
                                                        source: item.source
                                                    })))
                                                } catch (_e) { toast.error('搜尋失敗') }
                                                finally { setIsPlaceSearching(false) }
                                            }}
                                        >
                                            {isPlaceSearching ? '...' : '🔍'}
                                        </Button>
                                    </div>

                                    {placeSearchResults.length > 0 && (
                                        <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2 bg-slate-50">
                                            {placeSearchResults.map((loc, idx) => {
                                                const typeLabels: { [key: string]: string } = {
                                                    restaurant: '🍽️', cafe: '☕', fast_food: '🍔',
                                                    station: '🚉', bus_stop: '🚌', subway_entrance: '🚇',
                                                    hotel: '🏨', hostel: '🛏️', attraction: '🎯',
                                                    museum: '🏛️', park: '🌳', temple: '⛩️', shrine: '⛩️',
                                                    shop: '🛍️', mall: '🏬', supermarket: '🛒',
                                                }
                                                const icon = typeLabels[loc.type] || '📍'
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        className="w-full text-left p-2 rounded hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors"
                                                        onClick={() => {
                                                            setEditItem({ ...editItem, place: loc.name, lat: loc.lat, lng: loc.lng })
                                                            setPlaceSearchResults([])
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span>{icon}</span>
                                                            <span className="font-bold text-sm text-slate-800">{loc.name}</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 line-clamp-1 ml-6">{loc.display_name}</div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 🆕 POI 快速搜索 */}
                            {(editItem.lat && editItem.lng) || (dailyLocs[day]?.lat && dailyLocs[day]?.lng) ? (
                                <div className="border-t border-dashed pt-4 mt-2">
                                    <Label className="text-xs text-slate-500 mb-2 block">📍 附近搜索</Label>
                                    <POISearch
                                        centerLat={editItem.lat || dailyLocs[day]?.lat || 35.6895}
                                        centerLng={editItem.lng || dailyLocs[day]?.lng || 139.6917}
                                        onSelectPOI={(poi) => {
                                            setEditItem({
                                                ...editItem,
                                                place: poi.name,
                                                lat: poi.lat,
                                                lng: poi.lng,
                                                desc: poi.opening_hours ? `營業: ${poi.opening_hours}` : editItem.desc
                                            })
                                            toast.success(`已選擇: ${poi.name}`)
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400 text-center py-2 border-t border-dashed mt-2">
                                    💡 先搜索地點以啟用附近 POI 搜索
                                </div>
                            )}

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Notes</Label>
                                <Input value={editItem.desc} onChange={(e) => setEditItem({ ...editItem, desc: e.target.value })} className="col-span-3" />
                            </div>

                            {/* 🆕 分類選擇器 - 圖示按鈕 */}
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right pt-2">Category</Label>
                                <div className="col-span-3 flex flex-wrap gap-2">
                                    {[
                                        { id: 'sightseeing', icon: '🎯', label: '景點' },
                                        { id: 'food', icon: '🍽️', label: '美食' },
                                        { id: 'hotel', icon: '🏨', label: '住宿' },
                                        { id: 'transport', icon: '🚃', label: '交通' },
                                        { id: 'shopping', icon: '🛍️', label: '購物' },
                                        { id: 'activity', icon: '🎭', label: '活動' },
                                    ].map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setEditItem({ ...editItem, category: cat.id })}
                                            className={cn(
                                                "px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-all",
                                                editItem.category === cat.id
                                                    ? "bg-slate-800 text-white shadow-sm"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                            )}
                                        >
                                            <span>{cat.icon}</span>
                                            <span>{cat.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 🆕 標籤編輯器 */}
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right pt-2">Tags</Label>
                                <div className="col-span-3 space-y-2">
                                    <div className="flex flex-wrap gap-1">
                                        {(editItem.tags || []).map((tag: string, i: number) => (
                                            <span key={i} className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                                                {tag}
                                                <button
                                                    type="button"
                                                    className="hover:text-red-800"
                                                    onClick={() => setEditItem({
                                                        ...editItem,
                                                        tags: (editItem.tags || []).filter((_: string, idx: number) => idx !== i)
                                                    })}
                                                >×</button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            id="tag-input"
                                            placeholder="新增標籤"
                                            className="text-sm flex-1"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    const input = e.target as HTMLInputElement
                                                    const newTag = input.value.trim()
                                                    if (newTag && !(editItem.tags || []).includes(newTag)) {
                                                        setEditItem({ ...editItem, tags: [...(editItem.tags || []), newTag] })
                                                        input.value = ''
                                                    }
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => {
                                                const input = document.getElementById('tag-input') as HTMLInputElement
                                                const newTag = input?.value?.trim()
                                                if (newTag && !(editItem.tags || []).includes(newTag)) {
                                                    setEditItem({ ...editItem, tags: [...(editItem.tags || []), newTag] })
                                                    input.value = ''
                                                }
                                            }}
                                        >
                                            +
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 items-start gap-4 pt-2 border-t border-dashed">
                                <Label className="text-right pt-2 text-xs text-slate-400">Coordinates</Label>
                                <div className="col-span-3 space-y-2">
                                    <div className="flex gap-2">
                                        <Input placeholder="Lat" className="text-xs font-mono" value={editItem.lat || ''} onChange={(e) => setEditItem({ ...editItem, lat: e.target.value })} />
                                        <Input placeholder="Lng" className="text-xs font-mono" value={editItem.lng || ''} onChange={(e) => setEditItem({ ...editItem, lng: e.target.value })} />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-slate-400">{editItem.lat && editItem.lng ? "Precise" : "Search mode"}</span>
                                        <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] text-red-400" onClick={() => setEditItem({ ...editItem, lat: null, lng: null })}>Clear</Button>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button onClick={handleSaveEdit} disabled={isSavingActivity}>
                                    {isSavingActivity ? "儲存中..." : (isAddMode ? "Add" : "Save")}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    )
}
