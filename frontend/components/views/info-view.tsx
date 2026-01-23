"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Plane, Bed, Save, Edit3, Clock, MapPin,
    Copy, ExternalLink, Phone, Wifi, Link as LinkIcon, Plus, Trash2, Info, Navigation2, Search, Loader2, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLanguage } from "@/lib/LanguageContext"
import { ImageUpload } from "@/components/ui/image-upload"
import { cn } from "@/lib/utils"
import { useTripContext } from "@/lib/trip-context"
import { TripSwitcher } from "@/components/trip-switcher"
import { ZenRenew } from "@/components/ui/zen-renew"
import { toast } from "sonner"
import { COUNTRY_REGIONS } from "@/lib/constants"
import { tripsApi, geocodeApi } from "@/lib/api"
import { debugLog } from "@/lib/debug"



const DEFAULT_FLIGHTS = {
    outbound: { dep_date: "", arr_date: "", airline: "", code: "", dep_time: "", arr_time: "", dep_airport: "TPE", arr_airport: "NRT", seat: "", terminal: "", pnr: "", seats: [] as string[], terminals: [] as string[], pnrs: [] as string[] },
    inbound: { dep_date: "", arr_date: "", airline: "", code: "", dep_time: "", arr_time: "", dep_airport: "NRT", arr_airport: "TPE", seat: "", terminal: "", pnr: "", seats: [] as string[], terminals: [] as string[], pnrs: [] as string[] }
}

const DEFAULT_HOTEL = {
    name: "", address: "", booking_id: "",
    check_in: "15:00", check_out: "11:00", phone: "",
    memo: "",
    image_url: "",
    lat: null as number | null,
    lng: null as number | null,
    links: [] as { title: string, url: string }[]
}

// Type definitions
type Hotel = typeof DEFAULT_HOTEL

interface PlaceSearchResult {
    name: string
    display_name?: string
    lat?: number
    lng?: number
    latitude?: number
    longitude?: number
}

interface FlightData {
    dep_date: string
    arr_date: string
    airline: string
    code: string
    dep_time: string
    arr_time: string
    dep_airport: string
    arr_airport: string
    // 舊格式（向後相容）
    seat: string
    terminal: string
    pnr: string
    date?: string  // Legacy fallback
    // 新格式（多筆記錄）
    seats?: string[]
    terminals?: string[]
    pnrs?: string[]
}

export function InfoView() {
    const { t } = useLanguage()
    const { activeTripId, activeTrip, mutate: tripMutate } = useTripContext()
    const [isEditing, setIsEditing] = useState(false)

    const [flights, setFlights] = useState(DEFAULT_FLIGHTS)
    const [hotels, setHotels] = useState<Hotel[]>([DEFAULT_HOTEL])

    const [detailOpen, setDetailOpen] = useState(false)
    const [currentHotelIdx, setCurrentHotelIdx] = useState<number | null>(null)

    // 🔧 使用 ref 來追蹤當前索引，解決異步回調的閉包問題
    const currentHotelIdxRef = useRef<number | null>(null)
    currentHotelIdxRef.current = currentHotelIdx

    // 🏨 飯店地點搜尋狀態
    const [hotelSearchQuery, setHotelSearchQuery] = useState("")
    const [hotelSearchCountry, setHotelSearchCountry] = useState("")
    const [hotelSearchRegion, setHotelSearchRegion] = useState("")
    const [hotelSearchResults, setHotelSearchResults] = useState<PlaceSearchResult[]>([])
    const [isHotelSearching, setIsHotelSearching] = useState(false)
    const [searchingHotelIdx, setSearchingHotelIdx] = useState<number | null>(null)
    const [flightTab, setFlightTab] = useState<'outbound' | 'inbound'>('outbound')
    const [activeSection, setActiveSection] = useState("flights")

    useEffect(() => {
        const fetchInfo = async () => {
            if (!activeTripId) {
                setFlights(DEFAULT_FLIGHTS)
                setHotels([DEFAULT_HOTEL])
                return
            }
            try {
                const userId = localStorage.getItem("user_uuid") || ""
                const data = await tripsApi.get(activeTripId, userId)
                if (data) {
                    if (data.flight_info?.outbound) {
                        setFlights({
                            outbound: { ...DEFAULT_FLIGHTS.outbound, ...data.flight_info.outbound },
                            inbound: { ...DEFAULT_FLIGHTS.inbound, ...data.flight_info.inbound }
                        })
                    } else {
                        setFlights(DEFAULT_FLIGHTS)
                    }
                    const hData = data.hotel_info || {}
                    const parsedHotels = (Array.isArray(hData) ? hData : (Object.keys(hData).length ? [hData] : [DEFAULT_HOTEL]))
                        .map((h: Partial<Hotel>) => ({ ...DEFAULT_HOTEL, ...h }))
                    setHotels(parsedHotels)
                }
            } catch (e) { console.error(e) }
        }
        fetchInfo()
    }, [activeTripId])

    // 獨立的刷新函數供 ZenRenew 使用
    const refreshInfo = async () => {
        if (!activeTripId) return
        try {
            const userId = localStorage.getItem("user_uuid") || ""
            const data = await tripsApi.get(activeTripId, userId)
            if (data) {
                if (data.flight_info?.outbound) {
                    setFlights({
                        outbound: { ...DEFAULT_FLIGHTS.outbound, ...data.flight_info.outbound },
                        inbound: { ...DEFAULT_FLIGHTS.inbound, ...data.flight_info.inbound }
                    })
                }
                const hData = data.hotel_info || {}
                const parsedHotels = (Array.isArray(hData) ? hData : (Object.keys(hData).length ? [hData] : [DEFAULT_HOTEL]))
                    .map((h: Partial<Hotel>) => ({ ...DEFAULT_HOTEL, ...h }))
                setHotels(parsedHotels)
                await tripMutate() // 🔄 Refresh global context
            }
        } catch (e) {
            console.error(e)
            throw e // 🆕 Re-throw for ZenRenew state machine
        }
    }

    const handleSave = async () => {
        if (!activeTripId) return
        try {
            const userId = localStorage.getItem("user_uuid") || ""

            // 🧠 v4.5: Use standardized API with identity guard
            await tripsApi.updateInfo(activeTripId, {
                flight_info: flights,
                hotel_info: hotels
            }, userId)

            toast.success("Done")
            setIsEditing(false)
            tripMutate() // 🔄 Refresh global context
        } catch (e) {
            console.error("Save failed:", e)
            toast.error("Save failed. Please check your connection or permissions.")
        }
    }

    const updateHotel = (index: number, field: string, value: string | number | null | undefined | { title: string; url: string }[]) => {
        setHotels(prev => {
            const newHotels = [...prev]
            newHotels[index] = { ...newHotels[index], [field]: value }
            return newHotels
        })
    }

    // 🆕 批量更新多個欄位（避免競態條件）
    const updateHotelFields = (index: number, fields: Partial<Hotel>) => {
        setHotels(prev => {
            const newHotels = [...prev]
            newHotels[index] = { ...newHotels[index], ...fields }
            return newHotels
        })
    }
    const addHotel = () => setHotels([...hotels, DEFAULT_HOTEL])
    const removeHotel = (index: number) => {
        if (confirm(t('confirm_delete'))) {
            const newList = hotels.filter((_, i) => i !== index)
            setHotels(newList.length ? newList : [DEFAULT_HOTEL])
        }
    }

    // 🔍 飯店地點搜尋
    const handleSearchHotelPlace = async (hotelIdx: number) => {
        if (!hotelSearchQuery.trim()) return
        setIsHotelSearching(true)
        setSearchingHotelIdx(hotelIdx)
        try {
            // 🧠 Sequential Hotel Bias (旅人軌跡：優先參考上一間飯店的位置)
            let biasLat: number | undefined
            let biasLng: number | undefined
            if (hotelIdx > 0 && hotels[hotelIdx - 1]?.lat && hotels[hotelIdx - 1]?.lng) {
                biasLat = hotels[hotelIdx - 1].lat!
                biasLng = hotels[hotelIdx - 1].lng!
            }

            // 🆕 使用結構化參數（取代字串拼接）
            const data = await geocodeApi.search({
                query: hotelSearchQuery.trim(),  // 純淨的搜尋字串
                limit: 5,
                tripTitle: activeTrip?.title,
                lat: biasLat,
                lng: biasLng,
                country: hotelSearchCountry || undefined,  // 🆕 結構化國家過濾
                region: hotelSearchRegion || undefined     // 🆕 結構化區域過濾
            })
            setHotelSearchResults(data.results || [])
        } catch (e) {
            console.error("Hotel search failed:", e)
            toast.error("搜尋失敗")
        } finally {
            setIsHotelSearching(false)
        }
    }

    // 🎯 選擇搜尋結果（使用批量更新避免競態條件）
    const handleSelectHotelPlace = (hotelIdx: number, place: PlaceSearchResult) => {
        // 一次更新所有欄位，避免 race condition
        updateHotelFields(hotelIdx, {
            address: place.name || place.display_name || '',
            lat: place.latitude || place.lat || null,
            lng: place.longitude || place.lng || null
        })
        setHotelSearchResults([])
        setHotelSearchQuery("")
        setSearchingHotelIdx(null)
        toast.success(`已選擇: ${place.name}`)
    }

    const addLink = (index: number) => {
        const newHotels = [...hotels]
        if (!newHotels[index].links) newHotels[index].links = []
        newHotels[index].links.push({ title: "", url: "" })
        setHotels(newHotels)
    }
    const updateLink = (hotelIdx: number, linkIdx: number, field: 'title' | 'url', value: string) => {
        const newHotels = [...hotels]
        newHotels[hotelIdx].links[linkIdx][field] = value
        setHotels(newHotels)
    }
    const removeLink = (hotelIdx: number, linkIdx: number) => {
        const newHotels = [...hotels]
        newHotels[hotelIdx].links = newHotels[hotelIdx].links.filter((_: { title: string; url: string }, i: number) => i !== linkIdx)
        setHotels(newHotels)
    }

    return (
        <div className="h-full bg-stone-50 dark:bg-slate-900 overflow-y-auto overflow-x-hidden overscroll-y-contain overscroll-x-none">
            <div className="min-h-screen pb-32">
                {/* 🆕 v4.8: Dark Premium Header (Matching ToolsView) */}
                <div className="bg-gradient-to-b from-slate-900 to-slate-800 pt-12 pb-6 px-6 text-white">
                    <div className="space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-serif mb-2 text-white">{t('trip_info')}</h1>
                                <p className="text-slate-300 text-sm">{t('trip_details')}</p>
                            </div>
                            <ZenRenew
                                onRefresh={refreshInfo}
                                className="text-white/80 hover:text-white"
                            />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <TripSwitcher className="bg-white/10 text-white border-white/20 hover:bg-white/20 flex-1" />
                            <Button
                                variant={isEditing ? "default" : "outline"}
                                size="sm"
                                disabled={!activeTripId}
                                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                className={cn(
                                    "shrink-0 h-10 px-4",
                                    isEditing ? "bg-white text-slate-900 border-0" : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                                )}
                            >
                                {isEditing ? <><Save className="w-4 h-4 mr-1.5" /> {t('save')}</> : <><Edit3 className="w-4 h-4 mr-1.5" /> {t('edit')}</>}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="px-4 -mt-4">
                    {!activeTripId ? (
                        <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-white mt-8">
                            <Info className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No trip selected</p>
                            <p className="text-sm">Please select or create a trip to view details.</p>
                        </div>
                    ) : (
                        <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-6">
                            {/* 🆕 v4.8: Segmented Sliding Tab Menu */}
                            <div className="grid grid-cols-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-lg rounded-2xl p-1.5 mb-8 border border-white/50 dark:border-slate-700/50">
                                {[
                                    { value: 'flights', label: '✈️ ' + t('flight_details') },
                                    { value: 'hotels', label: '🏨 ' + t('accommodation') }
                                ].map((tab) => (
                                    <button
                                        key={tab.value}
                                        onClick={() => setActiveSection(tab.value)}
                                        className={cn(
                                            "relative z-10 py-3.5 px-4 rounded-xl text-sm font-black transition-all duration-300",
                                            activeSection === tab.value
                                                ? "text-slate-900 dark:text-white"
                                                : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                        )}
                                    >
                                        {activeSection === tab.value && (
                                            <motion.div
                                                layoutId="info-tab-indicator"
                                                className="absolute inset-0 bg-white dark:bg-slate-700 shadow-sm rounded-xl -z-10"
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <TabsContent value="flights" className="mt-0 focus-visible:ring-0">
                                <motion.section
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shadow-sm">
                                            <Plane className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                            {t('flight_details')}
                                        </h2>
                                    </div>

                                    {/* Flight Tabs with Sliding Indicator */}
                                    <div className="w-full">
                                        <div className="grid grid-cols-2 mb-4 bg-white/50 dark:bg-slate-700/50 p-1 rounded-xl relative border border-slate-200 shadow-sm">
                                            {(['outbound', 'inbound'] as const).map((tab) => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setFlightTab(tab)}
                                                    className={`relative z-10 py-2.5 px-4 rounded-lg text-xs font-bold transition-all ${flightTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {flightTab === tab && (
                                                        <motion.div
                                                            layoutId="flight-tab-indicator"
                                                            className="absolute inset-0 bg-white rounded-lg shadow-sm -z-10"
                                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                        />
                                                    )}
                                                    {tab === 'outbound' ? '去程 OUT' : '回程 IN'}
                                                </button>
                                            ))}
                                        </div>
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={flightTab}
                                                initial={{ opacity: 0, x: flightTab === 'outbound' ? -10 : 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: flightTab === 'outbound' ? 10 : -10 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                {flightTab === 'outbound' ? (
                                                    <FlightCard
                                                        data={flights.outbound}
                                                        isEditing={isEditing}
                                                        onChange={(f: string, v: string | string[]) => setFlights(prev => ({ ...prev, outbound: { ...prev.outbound, [f]: v } }))}
                                                        onClear={() => setFlights({ ...flights, outbound: { ...DEFAULT_FLIGHTS.outbound } })}
                                                    />
                                                ) : (
                                                    <FlightCard
                                                        data={flights.inbound}
                                                        isEditing={isEditing}
                                                        onChange={(f: string, v: string | string[]) => setFlights(prev => ({ ...prev, inbound: { ...prev.inbound, [f]: v } }))}
                                                        onClear={() => setFlights({ ...flights, inbound: { ...DEFAULT_FLIGHTS.inbound } })}
                                                    />
                                                )}
                                            </motion.div>
                                        </AnimatePresence>
                                    </div>
                                </motion.section>
                            </TabsContent>

                            <TabsContent value="hotels" className="mt-0 focus-visible:ring-0">
                                <motion.section
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shadow-sm">
                                                <Bed className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                {t('accommodation')}
                                            </h2>
                                        </div>
                                        {isEditing && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={addHotel}
                                                className="h-9 px-4 text-xs font-bold text-indigo-600 hover:bg-indigo-50 bg-white rounded-xl border border-indigo-100 shadow-sm transition-all hover:shadow-md active:scale-95"
                                            >
                                                <Plus className="w-3 h-3 mr-1.5" /> {t('add_hotel')}
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <motion.div
                                            initial="hidden"
                                            animate="visible"
                                            variants={{
                                                hidden: {},
                                                visible: {
                                                    transition: {
                                                        staggerChildren: 0.08,
                                                        delayChildren: 0.2
                                                    }
                                                }
                                            }}
                                        >
                                            <AnimatePresence mode="popLayout">
                                                {hotels.map((item, idx) => (
                                                    <motion.div
                                                        key={idx}
                                                        layout
                                                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                                        transition={{ duration: 0.35, ease: "easeOut" }}
                                                    >
                                                        <Card className="border-0 shadow-sm relative group overflow-hidden">
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                                                            <CardContent className="p-4 pl-6">
                                                                {isEditing && <button onClick={() => removeHotel(idx)} className="absolute top-2 right-2 text-slate-200 hover:text-red-500">X</button>}

                                                                <div className="space-y-3">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-[10px] text-slate-400 uppercase">Hotel Name</Label>
                                                                        <Input disabled={!isEditing} value={item.name} onChange={e => updateHotel(idx, 'name', e.target.value)} className={isEditing ? "bg-white dark:bg-slate-800 h-9" : "bg-transparent border-0 p-0 h-auto text-lg font-bold text-slate-800 dark:text-slate-100 shadow-none focus-visible:ring-0"} placeholder="Hotel name..." />
                                                                    </div>
                                                                    {/* Place Search - 全寬顯示 */}
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                                                                            <MapPin className="w-3 h-3" /> Place
                                                                        </Label>
                                                                        {isEditing ? (
                                                                            <div className="space-y-2">
                                                                                <div className="flex gap-1">
                                                                                    <select
                                                                                        className="h-8 text-xs rounded-md border border-slate-200 bg-white px-2"
                                                                                        value={hotelSearchCountry}
                                                                                        onChange={e => { setHotelSearchCountry(e.target.value); setHotelSearchRegion("") }}
                                                                                    >
                                                                                        <option value="">🌍 Country</option>
                                                                                        <option value="Japan">🇯🇵 Japan</option>
                                                                                        <option value="Taiwan">🇹🇼 Taiwan</option>
                                                                                        <option value="South Korea">🇰🇷 Korea</option>
                                                                                        <option value="Thailand">🇹🇭 Thailand</option>
                                                                                        <option value="Hong Kong">🇭🇰 HK</option>
                                                                                        <option value="Singapore">🇸🇬 SG</option>
                                                                                    </select>
                                                                                    {hotelSearchCountry && COUNTRY_REGIONS[hotelSearchCountry] && (
                                                                                        <select
                                                                                            className="h-8 text-xs rounded-md border border-slate-200 bg-white px-2 flex-1"
                                                                                            value={hotelSearchRegion}
                                                                                            onChange={e => setHotelSearchRegion(e.target.value)}
                                                                                        >
                                                                                            <option value="">🏙️ Region</option>
                                                                                            {COUNTRY_REGIONS[hotelSearchCountry].map(r => (
                                                                                                <option key={r} value={r}>{r}</option>
                                                                                            ))}
                                                                                        </select>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex gap-1">
                                                                                    <Input
                                                                                        className="h-8 text-xs flex-1"
                                                                                        placeholder="搜尋飯店..."
                                                                                        value={hotelSearchQuery}
                                                                                        onChange={e => setHotelSearchQuery(e.target.value)}
                                                                                        onKeyDown={e => e.key === 'Enter' && handleSearchHotelPlace(idx)}
                                                                                    />
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        className="h-8 px-2"
                                                                                        onClick={() => handleSearchHotelPlace(idx)}
                                                                                        disabled={isHotelSearching && searchingHotelIdx === idx}
                                                                                    >
                                                                                        {isHotelSearching && searchingHotelIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                                                                    </Button>
                                                                                </div>
                                                                                {/* 搜尋結果 */}
                                                                                {searchingHotelIdx === idx && hotelSearchResults.length > 0 && (
                                                                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700">
                                                                                        {hotelSearchResults.map((place, pIdx) => (
                                                                                            <button
                                                                                                key={pIdx}
                                                                                                className="w-full text-left p-2 text-xs rounded hover:bg-indigo-50 transition-colors"
                                                                                                onClick={() => handleSelectHotelPlace(idx, place)}
                                                                                            >
                                                                                                <div className="font-bold text-slate-700">{place.name}</div>
                                                                                                <div className="text-slate-400 text-[10px] line-clamp-2">{place.display_name}</div>
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                                {/* 已選擇的地點 - 顯示商家名稱（不是經緯度）*/}
                                                                                {(item.address || (item.lat && item.lng)) && (
                                                                                    <div className="text-sm text-slate-700 bg-green-50 p-2.5 rounded-lg flex items-center gap-2 border border-green-200">
                                                                                        <MapPin className="w-4 h-4 text-green-600 shrink-0" />
                                                                                        <span className="font-medium">
                                                                                            {/* 優先顯示地址/名稱，沒有才顯示經緯度 */}
                                                                                            {item.address || item.name || `${item.lat?.toFixed(4)}, ${item.lng?.toFixed(4)}`}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                {/* 手動輸入經緯度 */}
                                                                                <div className="flex gap-2 items-center">
                                                                                    <span className="text-[10px] text-slate-400">📍 手動座標:</span>
                                                                                    <Input
                                                                                        type="number"
                                                                                        step="any"
                                                                                        className="h-7 text-xs w-24 text-center font-mono"
                                                                                        placeholder="緯度 Lat"
                                                                                        value={item.lat ?? ''}
                                                                                        onChange={e => updateHotel(idx, 'lat', e.target.value ? parseFloat(e.target.value) : null)}
                                                                                    />
                                                                                    <Input
                                                                                        type="number"
                                                                                        step="any"
                                                                                        className="h-7 text-xs w-24 text-center font-mono"
                                                                                        placeholder="經度 Lng"
                                                                                        value={item.lng ?? ''}
                                                                                        onChange={e => updateHotel(idx, 'lng', e.target.value ? parseFloat(e.target.value) : null)}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2">
                                                                                {/* 非編輯模式：顯示商家名稱 */}
                                                                                {item.address || item.name ? (
                                                                                    <span className="text-sm text-slate-700 font-medium">{item.address || item.name}</span>
                                                                                ) : item.lat && item.lng ? (
                                                                                    <span className="text-sm text-slate-500">{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</span>
                                                                                ) : (
                                                                                    <span className="text-sm text-slate-400 italic">未設定地點</span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="pt-2 border-t border-slate-200 mt-2 flex gap-2">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="flex-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 h-8 text-xs"
                                                                            onClick={() => { setCurrentHotelIdx(idx); setDetailOpen(true); }}
                                                                        >
                                                                            <Info className="w-3 h-3 mr-2" /> {t('details')}
                                                                        </Button>
                                                                        {/* 導航按鈕：使用經緯度定位 + 商家名稱搜尋 */}
                                                                        {(item.lat && item.lng) || item.address || item.name ? (
                                                                            <a
                                                                                href={
                                                                                    // 使用經緯度定位 + 商家名稱搜尋
                                                                                    item.lat && item.lng && (item.address || item.name)
                                                                                        ? `https://www.google.com/maps/search/${encodeURIComponent(item.address || item.name || '')}/@${item.lat},${item.lng},17z`
                                                                                        : item.lat && item.lng
                                                                                            ? `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`
                                                                                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address || item.name || '')}`
                                                                                }
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="flex items-center gap-1 px-3 h-8 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                                                                            >
                                                                                <Navigation2 className="w-3 h-3" /> Maps
                                                                            </a>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </motion.div>
                                    </div>
                                </motion.section>
                            </TabsContent>
                        </Tabs>
                    )}
                </div>

                <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                    <DialogContent className="sm:max-w-md h-[90dvh] md:h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-t-[2.5rem] md:rounded-3xl border-0 shadow-2xl">
                        {currentHotelIdx !== null && hotels[currentHotelIdx] && (
                            <>
                                {/* Premium Dialog Header */}
                                <div className="p-8 pb-6 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-b border-slate-100 dark:border-slate-800 relative">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
                                    <DialogHeader>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                                <Bed className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{t('accommodation')}</span>
                                        </div>
                                        <DialogTitle className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                                            {hotels[currentHotelIdx].name || "Untitled Hotel"}
                                        </DialogTitle>
                                        <DialogDescription className="sr-only">
                                            檢視與編輯飯店的詳細資訊
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Check-In / Out</span>
                                            <div className="flex gap-2 mt-1 items-center">
                                                <Input
                                                    className="h-6 text-xs w-full px-1 text-center font-bold" placeholder="15:00"
                                                    value={hotels[currentHotelIdx].check_in}
                                                    onChange={e => updateHotel(currentHotelIdx, 'check_in', e.target.value)}
                                                />
                                                <span className="text-slate-300">/</span>
                                                <Input
                                                    className="h-6 text-xs w-full px-1 text-center font-bold" placeholder="11:00"
                                                    value={hotels[currentHotelIdx].check_out}
                                                    onChange={e => updateHotel(currentHotelIdx, 'check_out', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1"><Phone className="w-3 h-3" /> Tel</span>
                                            <Input
                                                className="h-6 text-xs mt-1 px-1 border-0 border-b rounded-none focus-visible:ring-0 font-mono"
                                                placeholder="03-1234-5678"
                                                value={hotels[currentHotelIdx].phone}
                                                onChange={e => updateHotel(currentHotelIdx, 'phone', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <ScrollArea className="flex-1 p-6">
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                                <Wifi className="w-3 h-3" /> Memo (Wi-Fi / Lock / Storage)
                                            </Label>
                                            <Textarea
                                                className="min-h-[150px] bg-yellow-50/50 border-amber-200 text-sm focus-visible:ring-amber-200 leading-relaxed"
                                                placeholder="Enter memo..."
                                                value={hotels[currentHotelIdx].memo}
                                                onChange={e => updateHotel(currentHotelIdx, 'memo', e.target.value)}
                                            />
                                        </div>

                                        {/* Booking Confirmation Image */}
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">
                                                Booking Confirmation
                                            </Label>
                                            <ImageUpload
                                                value={hotels[currentHotelIdx].image_url}
                                                onChange={(url) => {
                                                    // 使用 ref 獲取最新的索引值
                                                    const idx = currentHotelIdxRef.current
                                                    if (idx === null) {
                                                        console.warn('❌ currentHotelIdxRef is null')
                                                        return
                                                    }
                                                    debugLog('🖼️ Image uploaded:', url.substring(0, 50) + '...', 'for hotel index:', idx)
                                                    setHotels(prev => {
                                                        const newHotels = [...prev]
                                                        if (newHotels[idx]) {
                                                            newHotels[idx] = { ...newHotels[idx], image_url: url }
                                                            debugLog('✅ Hotel updated with image_url')
                                                        } else {
                                                            console.warn('❌ Hotel at index', idx, 'not found')
                                                        }
                                                        return newHotels
                                                    })
                                                }}
                                                onRemove={() => {
                                                    const idx = currentHotelIdxRef.current
                                                    if (idx === null) return
                                                    setHotels(prev => {
                                                        const newHotels = [...prev]
                                                        if (newHotels[idx]) {
                                                            newHotels[idx] = { ...newHotels[idx], image_url: '' }
                                                        }
                                                        return newHotels
                                                    })
                                                }}
                                                folder="ryan_travel/hotels"
                                            />
                                        </div>

                                        <div className="space-y-3 pt-4 border-t border-dashed border-slate-200">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                                    <LinkIcon className="w-3 h-3" /> Links
                                                </Label>
                                                <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600 hover:bg-blue-50" onClick={() => addLink(currentHotelIdx)}>
                                                    <Plus className="w-3 h-3 mr-1" /> Add Link
                                                </Button>
                                            </div>

                                            <div className="space-y-2">
                                                {hotels[currentHotelIdx].links?.map((link: { title: string; url: string }, i: number) => (
                                                    <div key={i} className="flex gap-2 items-center bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                                                        <Input className="h-7 text-xs w-1/3 border-0 bg-slate-50" placeholder="Title" value={link.title} onChange={e => updateLink(currentHotelIdx, i, 'title', e.target.value)} />
                                                        <Input className="h-7 text-xs flex-1 font-mono text-slate-500 border-0" placeholder="https://..." value={link.url} onChange={e => updateLink(currentHotelIdx, i, 'url', e.target.value)} />
                                                        {link.url && <a href={link.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-full"><ExternalLink className="w-3 h-3" /></a>}
                                                        <button onClick={() => removeLink(currentHotelIdx, i)} className="text-slate-300 hover:text-red-500 p-1.5"><Trash2 className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>

                                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                    <Button className="w-full bg-slate-900 text-white hover:bg-slate-800" onClick={() => { setDetailOpen(false); handleSave(); }}>
                                        {t('save_and_close')}
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div >
    )
}

function FlightCard({ data, isEditing, onChange, onClear }: { data: FlightData, isEditing: boolean, onChange: (field: string, value: string | string[]) => void, onClear?: () => void }) {
    // 🛡️ 保持既有優點：強大的向後相容與多旅客支援
    const getPnrs = (): string[] => {
        if (Array.isArray(data.pnrs) && data.pnrs.length > 0) return data.pnrs
        return data.pnr ? [data.pnr] : []
    }
    const getTerminals = (): string[] => {
        if (Array.isArray(data.terminals) && data.terminals.length > 0) return data.terminals
        return data.terminal ? [data.terminal] : []
    }
    const getSeats = (): string[] => {
        if (Array.isArray(data.seats) && data.seats.length > 0) return data.seats
        return data.seat ? [data.seat] : []
    }

    const pnrs = getPnrs()
    const terminals = getTerminals()
    const seats = getSeats()

    const handleCopy = (text: string) => {
        if (!text) return
        navigator.clipboard.writeText(text)
        toast.info("已複製到剪貼簿")
    }

    // 更新項目（維持單次更新邏輯，預防 Race Condition）
    const handleUpdateList = (field: 'pnrs' | 'terminals' | 'seats', idx: number, value: string) => {
        const list = field === 'pnrs' ? pnrs : field === 'terminals' ? terminals : seats
        const updated = [...list]
        updated[idx] = value
        onChange(field, updated)
    }

    return (
        <div className="group relative bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden transition-all duration-500 hover:shadow-2xl">
            {/* 🎟️ Boarding Pass Cutout Logic (CSS Pseudo-elements approach for perfect scaling) */}
            <div className="absolute top-[42%] -left-3 w-6 h-6 bg-stone-50 dark:bg-slate-900 rounded-full border-r border-slate-200/60 z-10 hidden sm:block" />
            <div className="absolute top-[42%] -right-3 w-6 h-6 bg-stone-50 dark:bg-slate-900 rounded-full border-l border-slate-200/60 z-10 hidden sm:block" />

            {/* 清除按鈕 */}
            {isEditing && onClear && (
                <button
                    onClick={onClear}
                    className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-100/50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                    title="清除航班資訊"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}

            {/* Top Section: Flight Path & Airports */}
            <div className="p-8 pt-10 bg-gradient-to-br from-slate-50/50 via-white to-slate-50/30 dark:from-slate-800 dark:to-slate-900">

                {/* 📅 Date Header (Premium Typography) */}
                <div className="flex items-center justify-between mb-8 px-2">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest pl-1">Departure Date</Label>
                        <Input
                            type="date"
                            disabled={!isEditing}
                            value={data.dep_date || data.date || ""}
                            onChange={e => onChange('dep_date', e.target.value)}
                            className={cn(
                                "h-auto p-0 border-0 bg-transparent text-sm font-bold shadow-none focus-visible:ring-0",
                                !isEditing && "text-slate-500"
                            )}
                        />
                    </div>
                    <div className="h-px flex-1 mx-4 bg-slate-200/50 hidden sm:block" />
                    <div className="space-y-1 text-right">
                        <Label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest pr-1">Arrival Date</Label>
                        <Input
                            type="date"
                            disabled={!isEditing}
                            value={data.arr_date || data.date || ""}
                            onChange={e => onChange('arr_date', e.target.value)}
                            className={cn(
                                "h-auto p-0 border-0 bg-transparent text-sm font-bold shadow-none focus-visible:ring-0 text-right justify-end",
                                !isEditing && "text-slate-500"
                            )}
                        />
                    </div>
                </div>

                {/* ✈️ Main Airport & Time Grid (Standardized for No Truncation) */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-4 relative px-1">
                    {/* Departure Station */}
                    <div className="min-w-0">
                        <Input
                            disabled={!isEditing}
                            value={data.dep_airport}
                            onChange={e => onChange('dep_airport', e.target.value.toUpperCase())}
                            className={cn(
                                "border-0 p-0 shadow-none focus-visible:ring-0 font-black tracking-tighter leading-none bg-transparent",
                                isEditing ? "text-4xl h-12 border-b-2 border-slate-100 rounded-none mb-1 text-center" : "text-5xl text-slate-900 dark:text-white"
                            )}
                            maxLength={3}
                            placeholder="DEP"
                        />
                        <div className="flex items-center gap-1.5 mt-2">
                            <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                            <Input
                                type={isEditing ? "time" : "text"}
                                disabled={!isEditing}
                                value={data.dep_time}
                                onChange={e => onChange('dep_time', e.target.value)}
                                className={cn(
                                    "h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent transition-all",
                                    isEditing ? "text-xs font-medium border-b border-blue-100 rounded-none w-full" : "text-lg font-black text-slate-600 dark:text-slate-400"
                                )}
                                placeholder="Time"
                            />
                        </div>
                    </div>

                    {/* Flight Path Visual */}
                    <div className="flex flex-col items-center justify-center px-4">
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="relative"
                        >
                            <Plane className="w-6 h-6 text-blue-500/30 rotate-90" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500/5 rounded-full blur-xl" />
                        </motion.div>
                        <div className="w-16 h-px border-t-2 border-dashed border-slate-200 mt-2"></div>
                    </div>

                    {/* Arrival Station */}
                    <div className="min-w-0 text-right">
                        <div className="flex justify-end">
                            <Input
                                disabled={!isEditing}
                                value={data.arr_airport}
                                onChange={e => onChange('arr_airport', e.target.value.toUpperCase())}
                                className={cn(
                                    "border-0 p-0 shadow-none focus-visible:ring-0 font-black tracking-tighter leading-none bg-transparent text-right",
                                    isEditing ? "text-4xl h-12 border-b-2 border-slate-100 rounded-none mb-1 text-center" : "text-5xl text-slate-900 dark:text-white"
                                )}
                                maxLength={3}
                                placeholder="ARR"
                            />
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-2">
                            <Input
                                type={isEditing ? "time" : "text"}
                                disabled={!isEditing}
                                value={data.arr_time}
                                onChange={e => onChange('arr_time', e.target.value)}
                                className={cn(
                                    "h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent transition-all text-right",
                                    isEditing ? "text-xs font-medium border-b border-indigo-100 rounded-none w-full" : "text-lg font-black text-slate-600 dark:text-slate-400"
                                )}
                                placeholder="Time"
                            />
                            <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ✂️ Dashed Divider with Punched Holes (Boarding Pass Visual) */}
            <div className="relative h-4 bg-white dark:bg-slate-800 flex items-center">
                <div className="absolute left-0 right-0 border-t-2 border-dashed border-slate-100 dark:border-slate-700/50" />
                <div className="absolute left-[-12px] w-6 h-6 rounded-full bg-stone-50 dark:bg-slate-900 border border-slate-200/40" />
                <div className="absolute right-[-12px] w-6 h-6 rounded-full bg-stone-50 dark:bg-slate-900 border border-slate-200/40" />
            </div>

            {/* Bottom Section: Traveler Info & Airline */}
            <div className="p-8 space-y-8 bg-white dark:bg-slate-800">
                {/* Airline & Code Row */}
                <div className="grid grid-cols-2 gap-6 pb-2">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Airline</Label>
                        <Input
                            disabled={!isEditing}
                            value={data.airline}
                            onChange={e => onChange('airline', e.target.value)}
                            placeholder="Eg. JAL / ANA"
                            className={cn(
                                "h-9 border-0 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-sm font-bold px-3 focus-visible:ring-blue-500/20",
                                !isEditing && "bg-transparent px-0 text-lg"
                            )}
                        />
                    </div>
                    <div className="space-y-2 text-right">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-1">Flight Number</Label>
                        <Input
                            disabled={!isEditing}
                            value={data.code}
                            onChange={e => onChange('code', e.target.value)}
                            placeholder="JL802"
                            className={cn(
                                "h-9 border-0 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-sm font-black font-mono text-right px-3 focus-visible:ring-blue-500/20",
                                !isEditing && "bg-transparent px-0 text-xl text-blue-600"
                            )}
                        />
                    </div>
                </div>

                {/* 🎒 Traveler Information Grid (PNR / Terminal / Seat) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                    {/* PNR Column */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmation (PNR)</Label>
                            {isEditing && (
                                <button onClick={() => onChange('pnrs', [...pnrs, ''])} className="text-[10px] font-bold text-blue-500 hover:text-blue-600 transition-colors bg-blue-50 px-2 py-0.5 rounded-full">
                                    + ADD
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {pnrs.map((item, idx) => (
                                <div key={idx} className="group/item flex items-center gap-2">
                                    {isEditing ? (
                                        <div className="flex-1 flex gap-1 items-center bg-slate-50 dark:bg-slate-900/30 p-1 rounded-lg border border-transparent focus-within:border-blue-200">
                                            <Input
                                                value={item}
                                                onChange={e => handleUpdateList('pnrs', idx, e.target.value)}
                                                placeholder="PNR"
                                                className="h-7 text-xs font-mono font-bold bg-transparent border-0 shadow-none focus-visible:ring-0 px-2"
                                            />
                                            <button onClick={() => onChange('pnrs', pnrs.filter((_, i) => i !== idx))} className="p-1 text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleCopy(item)}
                                            className="w-full flex items-center justify-between p-3 rounded-2xl bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100/50 dark:border-orange-800/30 hover:bg-orange-100/50 transition-all text-left"
                                        >
                                            <span className="text-xl font-black font-mono text-orange-600 dark:text-orange-400 tracking-wider">{item || "-"}</span>
                                            <Copy className="w-4 h-4 text-orange-300 group-hover/item:text-orange-500" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {pnrs.length === 0 && !isEditing && <span className="text-sm text-slate-300 italic px-2">No PNR set</span>}
                        </div>
                    </div>

                    {/* Terminal Column */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Terminal</Label>
                            {isEditing && (
                                <button onClick={() => onChange('terminals', [...terminals, ''])} className="text-[10px] font-bold text-blue-500 hover:text-blue-600 transition-colors bg-blue-50 px-2 py-0.5 rounded-full">
                                    + ADD
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {terminals.map((item, idx) => (
                                <div key={idx} className="group/item flex items-center gap-2">
                                    {isEditing ? (
                                        <div className="flex-1 flex gap-1 items-center bg-slate-50 dark:bg-slate-900/30 p-1 rounded-lg border border-transparent focus-within:border-blue-200">
                                            <Input
                                                value={item}
                                                onChange={e => handleUpdateList('terminals', idx, e.target.value)}
                                                placeholder="T1/T2"
                                                className="h-7 text-xs font-bold bg-transparent border-0 shadow-none focus-visible:ring-0 px-2"
                                            />
                                            <button onClick={() => onChange('terminals', terminals.filter((_, i) => i !== idx))} className="p-1 text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                                        </div>
                                    ) : (
                                        <div className="w-full p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600 transition-all text-center">
                                            <span className="text-xl font-black text-slate-700 dark:text-slate-200">{item || "-"}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {terminals.length === 0 && !isEditing && <span className="text-sm text-slate-300 italic px-2">No terminal set</span>}
                        </div>
                    </div>

                    {/* Seat Column */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seat Assignments</Label>
                            {isEditing && (
                                <button onClick={() => onChange('seats', [...seats, ''])} className="text-[10px] font-bold text-blue-500 hover:text-blue-600 transition-colors bg-blue-50 px-2 py-0.5 rounded-full">
                                    + ADD
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {seats.map((item, idx) => (
                                <div key={idx} className="group/item flex items-center gap-2">
                                    {isEditing ? (
                                        <div className="flex-1 flex gap-1 items-center bg-slate-50 dark:bg-slate-900/30 p-1 rounded-lg border border-transparent focus-within:border-blue-200">
                                            <Input
                                                value={item}
                                                onChange={e => handleUpdateList('seats', idx, e.target.value)}
                                                placeholder="12A"
                                                className="h-7 text-xs font-bold bg-transparent border-0 shadow-none focus-visible:ring-0 px-2"
                                            />
                                            <button onClick={() => onChange('seats', seats.filter((_, i) => i !== idx))} className="p-1 text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                                        </div>
                                    ) : (
                                        <div className="w-full p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/30 transition-all text-center">
                                            <span className="text-xl font-black text-indigo-600 dark:text-indigo-300">{item || "-"}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {seats.length === 0 && !isEditing && <span className="text-sm text-slate-300 italic px-2">No seats set</span>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

