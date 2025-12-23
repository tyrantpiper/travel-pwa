"use client"

import { useState, useEffect } from "react"
import {
    Plane, Bed, Save, Edit3, Clock, MapPin, Ticket,
    Copy, ExternalLink, Phone, Wifi, Link as LinkIcon, Plus, Trash2, Info
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLanguage } from "@/lib/LanguageContext"
import { ImageUpload } from "@/components/ui/image-upload"
import { useTripContext } from "@/lib/trip-context"
import { TripSwitcher } from "@/components/trip-switcher"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { toast } from "sonner"

// API URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const DEFAULT_FLIGHTS = {
    outbound: { dep_date: "", arr_date: "", airline: "", code: "", dep_time: "", arr_time: "", dep_airport: "TPE", arr_airport: "NRT", seat: "", terminal: "", pnr: "" },
    inbound: { dep_date: "", arr_date: "", airline: "", code: "", dep_time: "", arr_time: "", dep_airport: "NRT", arr_airport: "TPE", seat: "", terminal: "", pnr: "" }
}

const DEFAULT_HOTEL = {
    name: "", address: "", booking_id: "",
    check_in: "15:00", check_out: "11:00", phone: "",
    memo: "",
    image_url: "",
    links: [] as { title: string, url: string }[]
}

export function InfoView() {
    const { t } = useLanguage()
    const { activeTripId } = useTripContext()
    const [isEditing, setIsEditing] = useState(false)

    const [flights, setFlights] = useState(DEFAULT_FLIGHTS)
    const [hotels, setHotels] = useState<any[]>([DEFAULT_HOTEL])

    const [detailOpen, setDetailOpen] = useState(false)
    const [currentHotelIdx, setCurrentHotelIdx] = useState<number | null>(null)

    useEffect(() => {
        const fetchInfo = async () => {
            if (!activeTripId) {
                setFlights(DEFAULT_FLIGHTS)
                setHotels([DEFAULT_HOTEL])
                return
            }
            try {
                const res = await fetch(`${API_BASE}/api/trips/${activeTripId}`)
                const data = await res.json()
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
                        .map((h: any) => ({ ...DEFAULT_HOTEL, ...h }))
                    setHotels(parsedHotels)
                }
            } catch (e) { console.error(e) }
        }
        fetchInfo()
    }, [activeTripId])

    // 獨立的刷新函數供 PullToRefresh 使用
    const refreshInfo = async () => {
        if (!activeTripId) return
        try {
            const res = await fetch(`${API_BASE}/api/trips/${activeTripId}`)
            const data = await res.json()
            if (data) {
                if (data.flight_info?.outbound) {
                    setFlights({
                        outbound: { ...DEFAULT_FLIGHTS.outbound, ...data.flight_info.outbound },
                        inbound: { ...DEFAULT_FLIGHTS.inbound, ...data.flight_info.inbound }
                    })
                }
                const hData = data.hotel_info || {}
                const parsedHotels = (Array.isArray(hData) ? hData : (Object.keys(hData).length ? [hData] : [DEFAULT_HOTEL]))
                    .map((h: any) => ({ ...DEFAULT_HOTEL, ...h }))
                setHotels(parsedHotels)
                toast.success("資料已更新")
            }
        } catch (e) { console.error(e) }
    }

    const handleSave = async () => {
        if (!activeTripId) return
        try {
            await fetch(`${API_BASE}/api/trips/${activeTripId}/info`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ flight_info: flights, hotel_info: hotels })
            })
            toast.success("Done")
            setIsEditing(false)
        } catch (e) { toast.error("Save failed") }
    }

    const updateHotel = (index: number, field: string, value: any) => {
        const newHotels = [...hotels]
        newHotels[index] = { ...newHotels[index], [field]: value }
        setHotels(newHotels)
    }
    const addHotel = () => setHotels([...hotels, DEFAULT_HOTEL])
    const removeHotel = (index: number) => {
        if (confirm(t('confirm_delete'))) {
            const newList = hotels.filter((_, i) => i !== index)
            setHotels(newList.length ? newList : [DEFAULT_HOTEL])
        }
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
        newHotels[hotelIdx].links = newHotels[hotelIdx].links.filter((_: any, i: number) => i !== linkIdx)
        setHotels(newHotels)
    }

    return (
        <div className="min-h-screen bg-stone-50 px-4 py-12 pb-32">
            <header className="mb-6 space-y-3">
                <div>
                    <h1 className="text-3xl font-serif text-slate-900">{t('trip_info')}</h1>
                    <p className="text-slate-500 text-sm">{t('trip_details')}</p>
                </div>
                <TripSwitcher />
                <Button
                    variant={isEditing ? "default" : "outline"}
                    size="sm"
                    disabled={!activeTripId}
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    className={isEditing ? "bg-slate-900 text-white" : "border-slate-300 text-slate-600"}
                >
                    {isEditing ? <><Save className="w-4 h-4 mr-1" /> {t('save')}</> : <><Edit3 className="w-4 h-4 mr-1" /> {t('edit')}</>}
                </Button>
            </header>

            <PullToRefresh onRefresh={refreshInfo} className="flex-1">
                <div className="space-y-8">
                    {!activeTripId ? (
                        <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                            <Info className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No trip selected</p>
                            <p className="text-sm">Please select or create a trip to view details.</p>
                        </div>
                    ) : (
                        <>
                            <section>
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Plane className="w-4 h-4" /> {t('flight_details')}
                                </h2>
                                <Tabs defaultValue="outbound" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 mb-4 bg-stone-200/50 p-1 rounded-xl">
                                        <TabsTrigger value="outbound" className="rounded-lg data-[state=active]:bg-white">{t('outbound')}</TabsTrigger>
                                        <TabsTrigger value="inbound" className="rounded-lg data-[state=active]:bg-white">{t('inbound')}</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="outbound">
                                        <FlightCard
                                            data={flights.outbound}
                                            isEditing={isEditing}
                                            onChange={(f: string, v: string) => setFlights({ ...flights, outbound: { ...flights.outbound, [f]: v } })}
                                            onClear={() => setFlights({ ...flights, outbound: { ...DEFAULT_FLIGHTS.outbound } })}
                                        />
                                    </TabsContent>
                                    <TabsContent value="inbound">
                                        <FlightCard
                                            data={flights.inbound}
                                            isEditing={isEditing}
                                            onChange={(f: string, v: string) => setFlights({ ...flights, inbound: { ...flights.inbound, [f]: v } })}
                                            onClear={() => setFlights({ ...flights, inbound: { ...DEFAULT_FLIGHTS.inbound } })}
                                        />
                                    </TabsContent>
                                </Tabs>
                            </section>

                            <section>
                                <div className="flex justify-between items-center mb-3">
                                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Bed className="w-4 h-4" /> {t('accommodation')}
                                    </h2>
                                    {isEditing && <Button size="sm" variant="ghost" onClick={addHotel} className="h-6 text-xs text-blue-600">{t('add_hotel')}</Button>}
                                </div>

                                <div className="space-y-3">
                                    {hotels.map((item, idx) => (
                                        <Card key={idx} className="border-0 shadow-sm relative group overflow-hidden">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                                            <CardContent className="p-4 pl-6">
                                                {isEditing && <button onClick={() => removeHotel(idx)} className="absolute top-2 right-2 text-slate-200 hover:text-red-500">X</button>}

                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-slate-400 uppercase">Hotel Name</Label>
                                                        <Input disabled={!isEditing} value={item.name} onChange={e => updateHotel(idx, 'name', e.target.value)} className={isEditing ? "bg-white h-9" : "bg-transparent border-0 p-0 h-auto text-lg font-bold text-slate-800 shadow-none focus-visible:ring-0"} placeholder="Hotel name..." />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1"><Label className="text-[10px] text-slate-400 uppercase flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</Label><Input disabled={!isEditing} value={item.address} onChange={e => updateHotel(idx, 'address', e.target.value)} className={isEditing ? "bg-white h-8 text-xs" : "bg-transparent border-0 p-0 h-auto text-sm text-slate-600 shadow-none focus-visible:ring-0"} placeholder="Address..." /></div>
                                                        <div className="space-y-1"><Label className="text-[10px] text-slate-400 uppercase flex items-center gap-1"><Ticket className="w-3 h-3" /> Booking ID</Label><Input disabled={!isEditing} value={item.booking_id} onChange={e => updateHotel(idx, 'booking_id', e.target.value)} className={isEditing ? "bg-white h-8 text-xs font-mono" : "bg-transparent border-0 p-0 h-auto text-sm font-mono text-indigo-600 shadow-none focus-visible:ring-0"} placeholder="Booking ID..." /></div>
                                                    </div>

                                                    <div className="pt-2 border-t border-slate-100 mt-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 h-8 text-xs"
                                                            onClick={() => { setCurrentHotelIdx(idx); setDetailOpen(true); }}
                                                        >
                                                            <Info className="w-3 h-3 mr-2" /> {t('details')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </PullToRefresh>

            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="sm:max-w-md h-[85vh] flex flex-col p-0 gap-0">
                    {currentHotelIdx !== null && hotels[currentHotelIdx] && (
                        <>
                            <div className="p-6 bg-slate-50 border-b border-slate-200">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold text-slate-900 line-clamp-1">{hotels[currentHotelIdx].name || "Untitled Hotel"}</DialogTitle>
                                </DialogHeader>

                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <div className="bg-white p-2 rounded border border-slate-200">
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
                                    <div className="bg-white p-2 rounded border border-slate-200">
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
                                            onChange={(url) => updateHotel(currentHotelIdx, 'image_url', url)}
                                            onRemove={() => updateHotel(currentHotelIdx, 'image_url', '')}
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
                                            {hotels[currentHotelIdx].links?.map((link: any, i: number) => (
                                                <div key={i} className="flex gap-2 items-center bg-white p-2 rounded border border-slate-100">
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

                            <div className="p-4 border-t border-slate-100 bg-white">
                                <Button className="w-full bg-slate-900 text-white hover:bg-slate-800" onClick={() => { setDetailOpen(false); handleSave(); }}>
                                    {t('save_and_close')}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

function FlightCard({ data, isEditing, onChange, onClear }: { data: any, isEditing: boolean, onChange: (field: string, value: string) => void, onClear?: () => void }) {
    const [copied, setCopied] = useState(false)
    const handleCopyPNR = () => { if (data.pnr) { navigator.clipboard.writeText(data.pnr); setCopied(true); setTimeout(() => setCopied(false), 2000) } }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
            {/* 清除按鈕 */}
            {isEditing && onClear && (
                <button
                    onClick={onClear}
                    className="absolute top-2 right-2 z-10 text-slate-300 hover:text-red-500 transition-colors"
                    title="清除航班資訊"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}

            <div className="p-5 bg-gradient-to-br from-slate-50 to-white">
                {/* 日期區塊 - 出發/到達雙日期（支援跨天）*/}
                <div className="mb-4 pb-3 border-b border-slate-100">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                            <Label className="text-[10px] text-slate-400 uppercase block mb-1">Departure</Label>
                            <Input
                                type="date"
                                disabled={!isEditing}
                                value={data.dep_date || data.date || ""}
                                onChange={e => onChange('dep_date', e.target.value)}
                                className={isEditing ? "h-9 text-sm text-center" : "bg-transparent border-0 p-0 h-auto text-base font-bold text-center text-slate-800"}
                            />
                        </div>
                        <div className="text-center">
                            <Label className="text-[10px] text-slate-400 uppercase block mb-1">Arrival</Label>
                            <Input
                                type="date"
                                disabled={!isEditing}
                                value={data.arr_date || data.date || ""}
                                onChange={e => onChange('arr_date', e.target.value)}
                                className={isEditing ? "h-9 text-sm text-center" : "bg-transparent border-0 p-0 h-auto text-base font-bold text-center text-slate-800"}
                            />
                        </div>
                    </div>
                </div>

                {/* 出發/到達 機場 + 時間 */}
                <div className="flex justify-between items-center mb-4">
                    <div className="flex-1">
                        <Input disabled={!isEditing} value={data.dep_airport} onChange={e => onChange('dep_airport', e.target.value.toUpperCase())} className={isEditing ? "bg-white h-10 w-20 text-center font-bold" : "bg-transparent border-0 p-0 h-auto text-4xl font-black text-slate-800 w-24"} maxLength={3} />
                        <Input type={isEditing ? "time" : "text"} disabled={!isEditing} value={data.dep_time} onChange={e => onChange('dep_time', e.target.value)} className={isEditing ? "mt-2 h-8 text-xs w-24" : "bg-transparent border-0 p-0 h-auto text-lg font-bold text-slate-600 mt-1"} placeholder="出發" />
                    </div>
                    <div className="flex flex-col items-center justify-center px-4 opacity-50">
                        <Plane className="w-6 h-6 text-slate-400 rotate-90 mb-1" /><div className="w-16 h-px border-t-2 border-dashed border-slate-300"></div>
                    </div>
                    <div className="flex-1 text-right">
                        <div className="flex justify-end"><Input disabled={!isEditing} value={data.arr_airport} onChange={e => onChange('arr_airport', e.target.value.toUpperCase())} className={isEditing ? "bg-white h-10 w-20 text-center font-bold" : "bg-transparent border-0 p-0 h-auto text-4xl font-black text-slate-800 w-24 text-right"} maxLength={3} /></div>
                        <div className="flex justify-end"><Input type={isEditing ? "time" : "text"} disabled={!isEditing} value={data.arr_time} onChange={e => onChange('arr_time', e.target.value)} className={isEditing ? "mt-2 h-8 text-xs w-24" : "bg-transparent border-0 p-0 h-auto text-lg font-bold text-slate-600 mt-1 text-right"} placeholder="到達" /></div>
                    </div>
                </div>

                {/* Airline / Flight */}
                <div className="space-y-1">
                    <Label className="text-[10px] text-slate-400 uppercase">Airline / Flight</Label>
                    <div className="flex gap-2">
                        <Input disabled={!isEditing} value={data.airline} onChange={e => onChange('airline', e.target.value)} placeholder="Airline" className="h-8 text-xs" />
                        <Input disabled={!isEditing} value={data.code} onChange={e => onChange('code', e.target.value)} placeholder="Code" className="h-8 text-xs font-mono font-bold w-24" />
                    </div>
                </div>
            </div>

            <div className="relative flex items-center justify-between px-4"><div className="w-4 h-4 bg-stone-50 rounded-full -ml-6"></div><div className="flex-1 border-t-2 border-dashed border-slate-200"></div><div className="w-4 h-4 bg-stone-50 rounded-full -mr-6"></div></div>

            {/* PNR / Terminal / Seat - 置中對齊 */}
            <div className="p-5 bg-white">
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400 uppercase">PNR</Label>
                        <div className="flex items-center gap-2">
                            <Input disabled={!isEditing} value={data.pnr} onChange={e => onChange('pnr', e.target.value)} placeholder="Code" className={isEditing ? "h-8 text-xs font-mono" : "bg-transparent border-0 p-0 h-auto text-lg font-mono font-black text-slate-800 tracking-wider"} />
                            {!isEditing && data.pnr && <button onClick={handleCopyPNR} className="text-slate-400 hover:text-green-600"><Copy className="w-4 h-4" /></button>}
                        </div>
                    </div>
                    <div className="space-y-1 text-center">
                        <Label className="text-[10px] text-slate-400 uppercase">Terminal</Label>
                        <Input disabled={!isEditing} value={data.terminal} onChange={e => onChange('terminal', e.target.value)} placeholder="-" className={isEditing ? "h-8 text-xs text-center" : "bg-transparent border-0 p-0 h-auto text-xl font-bold text-center text-slate-800"} />
                    </div>
                    <div className="space-y-1 text-center">
                        <Label className="text-[10px] text-slate-400 uppercase">Seat</Label>
                        <Input disabled={!isEditing} value={data.seat} onChange={e => onChange('seat', e.target.value)} placeholder="-" className={isEditing ? "h-8 text-xs text-center" : "bg-transparent border-0 p-0 h-auto text-xl font-bold text-center text-slate-800"} />
                    </div>
                </div>
            </div>
        </div>
    )
}
