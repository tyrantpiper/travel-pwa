"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Plane, Bed, Save, Edit3, Clock, MapPin,
    ExternalLink, Phone, Wifi, Link as LinkIcon, Plus, Trash2, Info, Navigation2, Search, Loader2, ChevronRight
} from "lucide-react"
import Image from "next/image"
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
import { useHaptic, useTripDetail } from "@/lib/hooks"
import { FlightCard } from "./info/FlightCard"
import { extractCoordsFromUrl, isGoogleMapsShortlink, getDistanceKm } from "@/lib/location-utils"



const DEFAULT_FLIGHTS = {
    outbound: { dep_date: "", arr_date: "", airline: "", code: "", dep_time: "", arr_time: "", dep_airport: "TPE", arr_airport: "NRT", seat: "", terminal: "", pnr: "", seats: [] as string[], terminals: [] as string[], pnrs: [] as string[] },
    inbound: { dep_date: "", arr_date: "", airline: "", code: "", dep_time: "", arr_time: "", dep_airport: "NRT", arr_airport: "TPE", seat: "", terminal: "", pnr: "", seats: [] as string[], terminals: [] as string[], pnrs: [] as string[] }
}

const DEFAULT_HOTEL = {
    name: "", address: "", booking_id: "",
    check_in: "15:00", check_out: "11:00", phone: "",
    memo: "",
    image_url: "",
    link_url: "", // 🆕 v4.8: Primary website parity with itinerary
    hide_navigation: false, // 🆕 v4.9: 住宿也支援隱藏導航
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
    osm_id?: number | string
}

export function InfoView() {
    const { t } = useLanguage()
    const { activeTripId, activeTrip, mutate: tripMutate, userId } = useTripContext()
    const haptic = useHaptic()
    const [isEditing, setIsEditing] = useState(false)

    // 🚀 SWR Hook for Caching & Sync
    const { trip: activeTripData, mutate: reloadTripDetail } = useTripDetail(activeTripId, userId)

    const [flights, setFlights] = useState(DEFAULT_FLIGHTS)
    const [hotels, setHotels] = useState<Hotel[]>([DEFAULT_HOTEL])

    const [detailOpen, setDetailOpen] = useState(false)
    const [currentHotelIdx, setCurrentHotelIdx] = useState<number | null>(null)
    const [innerEditing, setInnerEditing] = useState(false)
    const [tempHotel, setTempHotel] = useState<Hotel | null>(null)

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
    const [resolutionState, setResolutionState] = useState<{ idx: number | null, status: 'idle' | 'success' | 'fallback' | 'error' }>({ idx: null, status: 'idle' })
    const [isResolvingHotel, setIsResolvingHotel] = useState(false)
    const [flightTab, setFlightTab] = useState<'outbound' | 'inbound'>('outbound')
    const [activeSection, setActiveSection] = useState("flights")

    useEffect(() => {
        if (detailOpen && currentHotelIdx !== null) {
            setInnerEditing(false)
            setTempHotel(hotels[currentHotelIdx])
        }
    }, [detailOpen, currentHotelIdx, hotels])

    const handleSaveInner = () => {
        if (!activeTripId || currentHotelIdx === null || !tempHotel) return
        haptic.success()
        const newHotels = [...hotels]
        newHotels[currentHotelIdx] = tempHotel
        setHotels(newHotels)
        setInnerEditing(false)
        handleSave() // Sync to backend (Chain-Reaction Trigger)
    }

    // 🔄 Sync SWR Data to Local State (Hybrid Mode)
    // Only update when switching trips or initial load, NOT while user is editing
    useEffect(() => {
        if (!activeTripId) {
            setFlights(DEFAULT_FLIGHTS)
            setHotels([DEFAULT_HOTEL])
            return
        }

        // If we are editing, don't overwrite user's work with background revalidations
        if (isEditing) return

        if (activeTripData) {
            if (activeTripData.flight_info?.outbound) {
                setFlights({
                    outbound: { ...DEFAULT_FLIGHTS.outbound, ...activeTripData.flight_info.outbound },
                    inbound: { ...DEFAULT_FLIGHTS.inbound, ...activeTripData.flight_info.inbound }
                })
            } else {
                setFlights(DEFAULT_FLIGHTS)
            }
            const hData = activeTripData.hotel_info || {}
            const parsedHotels = (Array.isArray(hData) ? hData : (Object.keys(hData).length ? [hData] : [DEFAULT_HOTEL]))
                .map((h: Partial<Hotel>) => ({ ...DEFAULT_HOTEL, ...h }))
            setHotels(parsedHotels)
        }
    }, [activeTripData, activeTripId, isEditing])

    // 獨立的刷新函數供 ZenRenew 使用
    const refreshInfo = async () => {
        if (!activeTripId) return
        try {
            await reloadTripDetail() // 🔄 Check server
            await tripMutate() // 🔄 Refresh global context
        } catch (e) {
            console.error(e)
            throw e
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
            // 🧠 v4.5: Absolute Fidelity Protocol - Trigger detail revalidation before list mutate
            await reloadTripDetail()
            await tripMutate() // 🔄 Refresh global context
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
        haptic.tap()
        if (confirm(t('confirm_delete'))) {
            haptic.success()
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
            const rawResults = data.results || []
            const deduped = rawResults.filter((r: PlaceSearchResult, idx: number, self: PlaceSearchResult[]) => {
                if (r.osm_id) {
                    return self.findIndex(x => x.osm_id && String(x.osm_id) === String(r.osm_id)) === idx
                }
                return !self.slice(0, idx).some(existing => {
                    const eLat = existing.lat ?? 0;
                    const eLng = existing.lng ?? 0;
                    const rLat = r.lat ?? 0;
                    const rLng = r.lng ?? 0;
                    return getDistanceKm(eLat, eLng, rLat, rLng) < 0.05;
                })
            })
            setHotelSearchResults(deduped)
        } catch (e) {
            console.error("Hotel search failed:", e)
            toast.error(t('info_search_failed'))
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
        toast.success(t('info_selected', { name: place.name }))
    }

    // 🧠 Magic Resolve for Hotel links
    const handleResolveHotelLink = async (idx: number) => {
        const hotel = hotels[idx]
        if (!hotel?.link_url?.trim()) return

        const url = hotel.link_url.trim()
        haptic.tap()

        // Tier 1: Regex
        const extracted = extractCoordsFromUrl(url)
        if (extracted.lat && extracted.lng) {
            updateHotelFields(idx, { lat: extracted.lat, lng: extracted.lng })
            setResolutionState({ idx, status: 'success' })
            toast.success(t('info_coords_extracted'))
            return
        }

        // Tier 2: API
        if (isGoogleMapsShortlink(url)) {
            setIsResolvingHotel(true)
            setResolutionState({ idx, status: 'idle' })
            try {
                const result = await geocodeApi.resolveLink(url)
                if (result.success && result.lat && result.lng) {
                    updateHotelFields(idx, { lat: result.lat, lng: result.lng })
                    setResolutionState({ idx, status: result.method.includes('jit') ? 'fallback' : 'success' })
                    toast.success(result.method.includes('jit') ? t('info_resolved_by_name') : t('info_resolved_url'))
                } else {
                    setResolutionState({ idx, status: 'error' })
                    toast.error(t('info_resolve_failed'))
                }
            } catch {
                setResolutionState({ idx, status: 'error' })
            } finally {
                setIsResolvingHotel(false)
            }
        } else {
            toast.info(t('info_link_no_coords'))
        }
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
                                successMessage={t('update_success')}
                                errorMessage={t('update_failed')}
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
                                                    {tab === 'outbound' ? t('info_outbound_tab') : t('info_inbound_tab')}
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
                                                                {isEditing && (
                                                                    <button
                                                                        onClick={() => removeHotel(idx)}
                                                                        className="absolute top-3 right-3 z-10 p-3 bg-red-50/90 dark:bg-red-950/40 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/60 rounded-full transition-all active:scale-90 shadow-sm border border-red-100/50 touch-manipulation"
                                                                        aria-label={t('info_delete_hotel_aria')}
                                                                    >
                                                                        <Trash2 className="w-5 h-5" />
                                                                    </button>
                                                                )}

                                                                <div className="space-y-3">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-[10px] text-slate-400 uppercase">Hotel Name</Label>
                                                                        <Input disabled={!isEditing} value={item.name} onChange={e => updateHotel(idx, 'name', e.target.value)} className={isEditing ? "bg-white dark:bg-slate-800 h-9" : "bg-transparent border-0 p-0 h-auto text-lg font-bold text-slate-800 dark:text-slate-100 shadow-none focus-visible:ring-0"} placeholder="Hotel name..." />
                                                                    </div>

                                                                    {/* 🆕 Primary Address Input - Moved to main card for direct access */}
                                                                    {isEditing && (
                                                                        <div className="space-y-1 bg-amber-50/50 dark:bg-amber-900/10 p-2 rounded-lg border border-amber-100/50 dark:border-amber-800/50">
                                                                            <div className="flex justify-between items-center mb-1">
                                                                                <Label className="text-[10px] text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1.5 font-bold">
                                                                                    <MapPin className="w-3 h-3" /> {t('primary_address') || "Primary Address / Nav Link"}
                                                                                </Label>
                                                                                {resolutionState.idx === idx && (
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        {isResolvingHotel && <Loader2 className="w-2.5 h-2.5 text-amber-500 animate-spin" />}
                                                                                        {!isResolvingHotel && resolutionState.status === 'success' && <div className="text-[8px] bg-green-500 text-white px-1 rounded-sm uppercase font-black">Link Pin</div>}
                                                                                        {!isResolvingHotel && resolutionState.status === 'fallback' && <div className="text-[8px] bg-amber-500 text-white px-1 rounded-sm uppercase font-black">AI PIN</div>}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <Input
                                                                                    className="h-8 text-xs font-mono bg-white dark:bg-slate-900 border-amber-100/50 flex-1"
                                                                                    placeholder={t('primary_address_placeholder') || "Paste address or Google Maps link..."}
                                                                                    value={item.link_url || ""}
                                                                                    onChange={e => {
                                                                                        updateHotel(idx, 'link_url', e.target.value)
                                                                                        if (resolutionState.idx === idx) setResolutionState({ idx: null, status: 'idle' })
                                                                                    }}
                                                                                />
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="secondary"
                                                                                    disabled={isResolvingHotel || !item.link_url?.trim()}
                                                                                    onClick={() => handleResolveHotelLink(idx)}
                                                                                    className="h-8 px-3 bg-amber-100/80 hover:bg-amber-200 text-amber-700 border-none transition-all active:scale-95 text-[10px] font-bold"
                                                                                >
                                                                                    {isResolvingHotel && resolutionState.idx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : t('info_resolve_btn')}
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    )}
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
                                                                                        placeholder={t('info_search_hotel_ph')}
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
                                                                                    <span className="text-[10px] text-slate-400">📍 {t('info_manual_coords')}</span>
                                                                                    <Input
                                                                                        type="number"
                                                                                        step="any"
                                                                                        className="h-7 text-xs w-24 text-center font-mono"
                                                                                        placeholder={t('info_lat_ph')}
                                                                                        value={item.lat ?? ''}
                                                                                        onChange={e => updateHotel(idx, 'lat', e.target.value ? parseFloat(e.target.value) : null)}
                                                                                    />
                                                                                    <Input
                                                                                        type="number"
                                                                                        step="any"
                                                                                        className="h-7 text-xs w-24 text-center font-mono"
                                                                                        placeholder={t('info_lng_ph')}
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
                                                                                    <span className="text-sm text-slate-400 italic">{t('info_no_location')}</span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="pt-2 border-t border-slate-200 mt-2 flex gap-2">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="flex-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 h-9 text-xs"
                                                                            onClick={() => { haptic.tap(); setCurrentHotelIdx(idx); setDetailOpen(true); }}
                                                                        >
                                                                            <Info className="w-3 h-3 mr-2" /> {t('details')}
                                                                        </Button>

                                                                        {/* 🆕 Website 按鈕 (Primary Link) */}
                                                                        {item.link_url && (
                                                                            <a
                                                                                href={item.link_url}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                onClick={() => haptic.tap()}
                                                                                className="flex items-center gap-1.5 px-3 h-9 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md transition-all active:scale-95"
                                                                            >
                                                                                <LinkIcon className="w-3.5 h-3.5" /> Site
                                                                            </a>
                                                                        )}

                                                                        {/* 🆕 導航開關按鈕 (尊重隱藏設定) */}
                                                                        {!item.hide_navigation && ((item.lat && item.lng) || item.address || item.name || item.link_url) ? (
                                                                            <a
                                                                                href={
                                                                                    item.link_url?.startsWith('http')
                                                                                        ? item.link_url
                                                                                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.link_url || item.address || item.name || '')}`
                                                                                }
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                onClick={() => haptic.tap()}
                                                                                className="flex items-center gap-1.5 px-3 h-9 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-all active:scale-95"
                                                                            >
                                                                                <Navigation2 className="w-3.5 h-3.5" /> Maps
                                                                            </a>
                                                                        ) : (
                                                                            <div className="flex items-center gap-1.5 px-3 h-9 text-xs bg-slate-100 text-slate-400 rounded-md opacity-60" title={t('info_no_location_title')}>
                                                                                <Navigation2 className="w-3.5 h-3.5" /> Maps
                                                                            </div>
                                                                        )}
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
                            <div className="relative h-full flex flex-col overflow-hidden">
                                {/* Premium Dialog Header */}
                                <div className="p-8 pb-4 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-b border-slate-100 dark:border-slate-800 relative">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
                                    <DialogHeader>
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                                        <Bed className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{t('accommodation')}</span>
                                                </div>
                                                <DialogTitle className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                                                    {hotels[currentHotelIdx].name || t('untitled_hotel')}
                                                </DialogTitle>
                                                <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" /> {hotels[currentHotelIdx].address || "No address set"}
                                                </p>
                                                {hotels[currentHotelIdx].booking_id && (
                                                    <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-500 uppercase">
                                                        #{hotels[currentHotelIdx].booking_id}
                                                    </div>
                                                )}
                                            </div>
                                            {!innerEditing && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 px-3 text-indigo-600 hover:bg-indigo-50 border border-indigo-100 rounded-full text-[10px] font-bold"
                                                    onClick={() => { haptic.tap(); setInnerEditing(true); }}
                                                >
                                                    <Edit3 className="w-3 h-3 mr-1" /> {t('edit')}
                                                </Button>
                                            )}
                                        </div>
                                        <DialogDescription className="sr-only">
                                            Hotel details view and management
                                        </DialogDescription>
                                    </DialogHeader>
                                </div>

                                <ScrollArea className="flex-1 bg-stone-50/50 dark:bg-slate-900/50">
                                    <div className="p-6 space-y-6 pb-24">
                                        {innerEditing && tempHotel ? (
                                            /* 📝 EDIT MODE */
                                            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] text-slate-400 uppercase font-bold ml-1">Check-In</Label>
                                                        <Input className="h-9 text-xs font-bold text-center" value={tempHotel.check_in} onChange={e => setTempHotel({ ...tempHotel, check_in: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] text-slate-400 uppercase font-bold ml-1">Check-Out</Label>
                                                        <Input className="h-9 text-xs font-bold text-center" value={tempHotel.check_out} onChange={e => setTempHotel({ ...tempHotel, check_out: e.target.value })} />
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] text-slate-400 uppercase font-bold ml-1">Phone</Label>
                                                    <Input className="h-9 text-xs font-mono" value={tempHotel.phone} onChange={e => setTempHotel({ ...tempHotel, phone: e.target.value })} />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] text-slate-400 uppercase font-bold ml-1">{t('booking_id')}</Label>
                                                    <Input className="h-9 text-xs font-mono" value={tempHotel.booking_id} onChange={e => setTempHotel({ ...tempHotel, booking_id: e.target.value })} />
                                                </div>


                                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200">
                                                    <div className="space-y-0.5">
                                                        <Label className="text-xs font-bold">Hide Navigation</Label>
                                                        <p className="text-[10px] text-slate-400">Remove Map button from main card</p>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300"
                                                        checked={tempHotel.hide_navigation}
                                                        onChange={e => setTempHotel({ ...tempHotel, hide_navigation: e.target.checked })}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] text-slate-400 uppercase font-bold ml-1">Memo</Label>
                                                    <Textarea className="min-h-[120px] text-sm leading-relaxed" value={tempHotel.memo} onChange={e => setTempHotel({ ...tempHotel, memo: e.target.value })} />
                                                </div>

                                                <div className="space-y-3">
                                                    <Label className="text-[10px] text-slate-400 uppercase font-bold ml-1">Reference Links</Label>
                                                    <div className="space-y-2">
                                                        {(tempHotel.links || []).map((link, i) => (
                                                            <div key={i} className="flex gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200">
                                                                <Input className="h-7 text-[10px] w-1/3" placeholder="Title" value={link.title} onChange={e => {
                                                                    const newLinks = [...(tempHotel.links || [])]; newLinks[i].title = e.target.value; setTempHotel({ ...tempHotel, links: newLinks })
                                                                }} />
                                                                <Input className="h-7 text-[10px] flex-1" placeholder="URL" value={link.url} onChange={e => {
                                                                    const newLinks = [...(tempHotel.links || [])]; newLinks[i].url = e.target.value; setTempHotel({ ...tempHotel, links: newLinks })
                                                                }} />
                                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => {
                                                                    setTempHotel({ ...tempHotel, links: (tempHotel.links || []).filter((_, idx) => idx !== i) })
                                                                }}><Trash2 className="w-3 h-3" /></Button>
                                                            </div>
                                                        ))}
                                                        <Button variant="outline" size="sm" className="w-full h-8 border-dashed text-[10px]" onClick={() => setTempHotel({ ...tempHotel, links: [...(tempHotel.links || []), { title: "", url: "" }] })}>
                                                            + Add Reference Link
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5 pt-2 border-t border-dashed border-slate-200">
                                                    <Label className="text-[10px] text-slate-400 uppercase font-bold ml-1">Booking Confirmation Photo</Label>
                                                    <ImageUpload
                                                        value={tempHotel.image_url}
                                                        onChange={(url) => setTempHotel({ ...tempHotel, image_url: url })}
                                                        onRemove={() => setTempHotel({ ...tempHotel, image_url: "" })}
                                                        folder="ryan_travel/hotels"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            /* ✨ IMMERSIVE VIEW MODE */
                                            <div className="space-y-6 animate-in fade-in duration-500">
                                                {/* Phone & Time Grid */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm">
                                                        <span className="text-[10px] text-slate-400 uppercase font-black flex items-center gap-1.5 mb-2">
                                                            <Clock className="w-3 h-3" /> Schedule
                                                        </span>
                                                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                            {hotels[currentHotelIdx].check_in} – {hotels[currentHotelIdx].check_out}
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition-transform"
                                                        onClick={() => { if (hotels[currentHotelIdx].phone) window.open(`tel:${hotels[currentHotelIdx].phone}`) }}
                                                    >
                                                        <span className="text-[10px] text-slate-400 uppercase font-black flex items-center gap-1.5 mb-2">
                                                            <Phone className="w-3 h-3" /> Contact
                                                        </span>
                                                        <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 underline underline-offset-4">
                                                            {hotels[currentHotelIdx].phone || "Not set"}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Memo Section */}
                                                <div className="space-y-2">
                                                    <span className="text-[10px] text-slate-400 uppercase font-black flex items-center gap-1.5 ml-1">
                                                        <Wifi className="w-3 h-3" /> Memo & Instructions
                                                    </span>
                                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm min-h-[100px] text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                        {hotels[currentHotelIdx].memo || "No special instructions..."}
                                                    </div>
                                                </div>

                                                {/* Confirmation Photo */}
                                                {hotels[currentHotelIdx].image_url && (
                                                    <div className="space-y-2">
                                                        <span className="text-[10px] text-slate-400 uppercase font-black flex items-center gap-1.5 ml-1">
                                                            <Info className="w-3 h-3" /> Confirmation Screenshot
                                                        </span>
                                                        <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-md bg-slate-200 dark:bg-slate-700 aspect-video relative">
                                                            <Image
                                                                src={hotels[currentHotelIdx].image_url}
                                                                alt="Confirmation"
                                                                fill
                                                                unoptimized
                                                                className="object-cover"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Secondary Links */}
                                                {(hotels[currentHotelIdx].links || []).length > 0 && (
                                                    <div className="space-y-2">
                                                        <span className="text-[10px] text-slate-400 uppercase font-black flex items-center gap-1.5 ml-1">
                                                            <LinkIcon className="w-3 h-3" /> Reference Resources
                                                        </span>
                                                        <div className="space-y-2">
                                                            {hotels[currentHotelIdx].links.map((link: { title: string; url: string }, i: number) => (
                                                                <a key={i} href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-indigo-50/50 dark:bg-indigo-900/10 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 transition-colors">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm text-indigo-600 dark:text-indigo-400">
                                                                            <ExternalLink className="w-4 h-4" />
                                                                        </div>
                                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{link.title || "Link"}</span>
                                                                    </div>
                                                                    <ChevronRight className="w-4 h-4 text-slate-300" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>

                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex gap-3 z-20">
                                    {innerEditing ? (
                                        <>
                                            <Button variant="ghost" className="flex-1 h-11 rounded-xl" onClick={() => { haptic.tap(); setInnerEditing(false); }}>Cancel</Button>
                                            <Button className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg" onClick={handleSaveInner}>Save Changes</Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button variant="outline" className="flex-1 h-11 rounded-xl border-slate-200" onClick={() => setDetailOpen(false)}>Close</Button>
                                            {((hotels[currentHotelIdx].lat && hotels[currentHotelIdx].lng) || hotels[currentHotelIdx].address || hotels[currentHotelIdx].link_url) && (
                                                <Button className="flex-1 h-11 bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-100 text-white rounded-xl shadow-lg"
                                                    onClick={() => {
                                                        const item = hotels[currentHotelIdx];
                                                        const url = item.link_url?.startsWith('http')
                                                            ? item.link_url
                                                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.link_url || item.address || item.name || '')}`;
                                                        window.open(url, '_blank');
                                                    }}
                                                >
                                                    <Navigation2 className="w-4 h-4 mr-2" /> Navigate Now
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div >
        </div >
    )
}


