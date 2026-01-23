"use client"

import { motion } from "framer-motion"
import { Plane, Clock, Trash2, X, Copy } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useLanguage } from "@/lib/LanguageContext"

export interface FlightData {
    dep_date: string
    arr_date: string
    airline: string
    code: string
    dep_time: string
    arr_time: string
    dep_airport: string
    arr_airport: string
    seat: string
    terminal: string
    pnr: string
    date?: string
    seats?: string[]
    terminals?: string[]
    pnrs?: string[]
}

interface FlightCardProps {
    data: FlightData
    isEditing: boolean
    onChange: (field: string, value: string | string[]) => void
    onClear?: () => void
}

export function FlightCard({ data, isEditing, onChange, onClear }: FlightCardProps) {
    const { t } = useLanguage()

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
        toast.info(t('copied'))
    }

    const handleUpdateList = (field: 'pnrs' | 'terminals' | 'seats', idx: number, value: string) => {
        const list = field === 'pnrs' ? pnrs : field === 'terminals' ? terminals : seats
        const updated = [...list]
        updated[idx] = value
        onChange(field, updated)
    }

    return (
        <div className={cn(
            "group relative rounded-[2rem] border overflow-hidden transition-all duration-500",
            "bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-xl hover:shadow-2xl",
            "border-slate-200/60 dark:border-slate-700/60"
        )}>
            {/* 🎟️ Boarding Pass Cutout (Glassmorphism version) */}
            <div className="absolute top-[38%] -left-3 w-6 h-6 bg-stone-50 dark:bg-slate-900 rounded-full border-r border-slate-200/60 z-10 hidden sm:block shadow-inner" />
            <div className="absolute top-[38%] -right-3 w-6 h-6 bg-stone-50 dark:bg-slate-900 rounded-full border-l border-slate-200/60 z-10 hidden sm:block shadow-inner" />

            {/* 清除按鈕 */}
            {isEditing && onClear && (
                <button
                    onClick={onClear}
                    className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-100/50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                    title={t('clear_flight_info')}
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}

            {/* Top Section: Flight Path & Airports */}
            <div className="p-8 pt-10 bg-gradient-to-br from-blue-50/30 via-transparent to-indigo-50/20 dark:from-blue-900/10 dark:to-transparent">

                {/* 📅 Date Header (Premium Symmetry & Typography) */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-10 px-1">
                    <div className="space-y-1.5 overflow-hidden">
                        <Label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.25em] pl-1 drop-shadow-sm">
                            {t('departure_date')}
                        </Label>
                        {isEditing ? (
                            <Input
                                type="date"
                                value={data.dep_date || data.date || ""}
                                onChange={e => onChange('dep_date', e.target.value)}
                                className="h-7 p-0 border-0 bg-transparent text-sm font-black shadow-none focus-visible:ring-0"
                            />
                        ) : (
                            <div className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight pl-1 leading-none">
                                {data.dep_date || data.date || t('no_date')}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-center px-4">
                        <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-blue-400/50 via-slate-300/30 to-indigo-400/50 relative">
                            <div className="absolute left-0 -top-0.5 w-1 h-1 rounded-full bg-blue-500" />
                            <div className="absolute right-0 -top-0.5 w-1 h-1 rounded-full bg-indigo-500" />
                        </div>
                    </div>

                    <div className="space-y-1.5 text-right overflow-hidden">
                        <Label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.25em] pr-1 flex justify-end drop-shadow-sm">
                            {t('arrival_date')}
                        </Label>
                        {isEditing ? (
                            <div className="flex justify-end">
                                <Input
                                    type="date"
                                    value={data.arr_date || data.date || ""}
                                    onChange={e => onChange('arr_date', e.target.value)}
                                    className="h-7 p-0 border-0 bg-transparent text-sm font-black shadow-none focus-visible:ring-0 text-right w-fit"
                                />
                            </div>
                        ) : (
                            <div className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight pr-1 leading-none text-right">
                                {data.arr_date || data.date || t('no_date')}
                            </div>
                        )}
                    </div>
                </div>

                {/* ✈️ Main Airport & Time Grid */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6 relative px-1">
                    {/* Departure Station */}
                    <div className="relative group/dep">
                        <div className="absolute -inset-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl scale-95 opacity-0 group-hover/dep:opacity-100 group-hover/dep:scale-100 transition-all duration-300" />
                        <div className="relative">
                            <Input
                                disabled={!isEditing}
                                value={data.dep_airport}
                                onChange={e => onChange('dep_airport', e.target.value.toUpperCase())}
                                className={cn(
                                    "border-0 p-0 shadow-none focus-visible:ring-0 font-black tracking-tighter leading-none bg-transparent",
                                    isEditing ? "text-4xl h-12 border-b-2 border-slate-100 dark:border-slate-700/50 rounded-none mb-1 text-center" : "text-5xl sm:text-6xl text-slate-900 dark:text-white"
                                )}
                                maxLength={3}
                                placeholder="TPE"
                            />
                            <div className="flex items-center gap-2 mt-3">
                                <div className="p-1 rounded-md bg-blue-100/50 dark:bg-blue-900/30">
                                    <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                </div>
                                <Input
                                    type={isEditing ? "time" : "text"}
                                    disabled={!isEditing}
                                    value={data.dep_time}
                                    onChange={e => onChange('dep_time', e.target.value)}
                                    className={cn(
                                        "h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent transition-all",
                                        isEditing ? "text-xs font-semibold border-b border-blue-100 dark:border-blue-800 rounded-none w-full" : "text-2xl font-black text-slate-700 dark:text-slate-300"
                                    )}
                                    placeholder="00:00"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Flight Path Visual */}
                    <div className="flex flex-col items-center justify-center px-2">
                        <div className="relative flex items-center justify-center w-16 sm:w-24">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full h-[2px] bg-gradient-to-r from-blue-300/30 via-slate-200/50 to-indigo-300/30 dark:via-slate-700/50 rounded-full" />
                            </div>
                            <motion.div
                                animate={{
                                    x: [-32, 32],
                                    opacity: [0, 1, 1, 0]
                                }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                className="relative z-10"
                            >
                                <Plane className="w-5 h-5 text-blue-500/60 rotate-90" />
                            </motion.div>
                        </div>
                        <div className="mt-4 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] font-mono">
                            Non-Stop
                        </div>
                    </div>

                    {/* Arrival Station */}
                    <div className="relative group/arr text-right">
                        <div className="absolute -inset-2 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl scale-95 opacity-0 group-hover/arr:opacity-100 group-hover/arr:scale-100 transition-all duration-300" />
                        <div className="relative">
                            <div className="flex justify-end">
                                <Input
                                    disabled={!isEditing}
                                    value={data.arr_airport}
                                    onChange={e => onChange('arr_airport', e.target.value.toUpperCase())}
                                    className={cn(
                                        "border-0 p-0 shadow-none focus-visible:ring-0 font-black tracking-tighter leading-none bg-transparent text-right",
                                        isEditing ? "text-4xl h-12 border-b-2 border-slate-100 dark:border-slate-700/50 rounded-none mb-1 text-center" : "text-5xl sm:text-6xl text-slate-900 dark:text-white"
                                    )}
                                    maxLength={3}
                                    placeholder="NRT"
                                />
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-3">
                                <Input
                                    type={isEditing ? "time" : "text"}
                                    disabled={!isEditing}
                                    value={data.arr_time}
                                    onChange={e => onChange('arr_time', e.target.value)}
                                    className={cn(
                                        "h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent transition-all text-right",
                                        isEditing ? "text-xs font-semibold border-b border-indigo-100 dark:border-indigo-800 rounded-none w-full" : "text-2xl font-black text-slate-700 dark:text-slate-300"
                                    )}
                                    placeholder="00:00"
                                />
                                <div className="p-1 rounded-md bg-indigo-100/50 dark:bg-indigo-900/30">
                                    <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ✂️ Dashed Divider with Punched Holes */}
            <div className="relative h-px bg-transparent flex items-center px-4">
                <div className="w-full border-t-2 border-dashed border-slate-100 dark:border-slate-700/50" />
            </div>

            {/* Bottom Section: Airline & Traveler Info */}
            <div className="p-8 space-y-8 bg-white/40 dark:bg-slate-800/20 relative">
                {/* 🛡️ Airline & Flight Number (Boarding Pass Layout) */}
                <div className="grid grid-cols-2 gap-8 relative z-10">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] pl-1">
                            {t('airline')}
                        </Label>
                        {isEditing ? (
                            <Input
                                value={data.airline}
                                onChange={e => onChange('airline', e.target.value)}
                                placeholder="Eg. JAL / ANA"
                                className="h-10 border-0 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl text-sm font-bold px-4 focus-visible:ring-blue-500/20"
                            />
                        ) : (
                            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
                                {data.airline || "-"}
                            </div>
                        )}
                    </div>
                    {/* 🎯 RIGHT ALIGNMENT SYMMETRY */}
                    <div className="space-y-2 flex flex-col items-end">
                        <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] pr-1 w-full text-right flex justify-end">
                            {t('flight_number')}
                        </Label>
                        {isEditing ? (
                            <Input
                                value={data.code}
                                onChange={e => onChange('code', e.target.value)}
                                placeholder="JL802"
                                className="h-10 border-0 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl text-sm font-black font-mono text-right px-4 focus-visible:ring-blue-500/20 w-full"
                            />
                        ) : (
                            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-wider font-mono text-right">
                                {data.code || "-"}
                            </div>
                        )}
                    </div>
                </div>

                {/* 🎒 Traveler Information Grid (PNR / Terminal / Seat) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-8 border-t border-slate-200/50 dark:border-slate-700/30">
                    {/* PNR Column - Orange Theme */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-bold text-orange-600/60 dark:text-orange-400/60 uppercase tracking-widest">{t('confirmation_pnr')}</Label>
                            {isEditing && (
                                <button onClick={() => onChange('pnrs', [...pnrs, ''])} className="text-[9px] font-black text-orange-600 hover:text-orange-700 transition-colors bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 rounded-md border border-orange-200/50">
                                    + ADD
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {pnrs.map((item, idx) => (
                                <div key={idx} className="group/item relative">
                                    {isEditing ? (
                                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-orange-100 dark:border-orange-900/30 shadow-sm focus-within:ring-2 focus-within:ring-orange-500/10">
                                            <Input
                                                value={item}
                                                onChange={e => handleUpdateList('pnrs', idx, e.target.value)}
                                                placeholder="PNR"
                                                className="h-8 text-sm font-mono font-bold bg-transparent border-0 shadow-none focus-visible:ring-0 px-3"
                                            />
                                            <button onClick={() => onChange('pnrs', pnrs.filter((_, i) => i !== idx))} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleCopy(item)}
                                            className="w-full flex items-center justify-between p-4 rounded-[1.25rem] bg-gradient-to-br from-orange-50/80 to-amber-50/50 dark:from-orange-950/20 dark:to-orange-900/10 border border-orange-200/60 dark:border-orange-900/40 hover:shadow-lg hover:shadow-orange-500/5 transition-all text-left group/btn overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 p-1 opacity-10 group-hover/btn:opacity-20 transition-opacity">
                                                <div className="w-12 h-12 border-4 border-orange-500 rounded-full flex items-center justify-center -rotate-12 translate-x-4 -translate-y-4">
                                                    <span className="text-[8px] font-black">OK</span>
                                                </div>
                                            </div>
                                            <span className="text-2xl font-black font-mono text-orange-600 dark:text-orange-400 tracking-[0.1em]">
                                                {item || "-"}
                                            </span>
                                            <Copy className="w-4 h-4 text-orange-300 group-hover/btn:text-orange-500 transition-colors shrink-0" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {pnrs.length === 0 && !isEditing && <span className="text-xs text-slate-400 italic font-medium px-2">{t('no_pnr_set')}</span>}
                        </div>
                    </div>

                    {/* Terminal Column - Indigo Theme */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-bold text-indigo-600/60 dark:text-indigo-400/60 uppercase tracking-widest">{t('terminal')}</Label>
                            {isEditing && (
                                <button onClick={() => onChange('terminals', [...terminals, ''])} className="text-[9px] font-black text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-md border border-indigo-200/50">
                                    + ADD
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {terminals.map((item, idx) => (
                                <div key={idx} className="group/item">
                                    {isEditing ? (
                                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/10">
                                            <Input
                                                value={item}
                                                onChange={e => handleUpdateList('terminals', idx, e.target.value)}
                                                placeholder="T1/T2"
                                                className="h-8 text-sm font-bold bg-transparent border-0 shadow-none focus-visible:ring-0 px-3"
                                            />
                                            <button onClick={() => onChange('terminals', terminals.filter((_, i) => i !== idx))} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ) : (
                                        <div className="w-full p-4 rounded-[1.25rem] bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/80 dark:border-indigo-800/30 text-center shadow-sm relative overflow-hidden group/term">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/40" />
                                            <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{item || "-"}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {terminals.length === 0 && !isEditing && <span className="text-xs text-slate-400 italic font-medium px-2">{t('no_terminal_set')}</span>}
                        </div>
                    </div>

                    {/* Seat Column - Blue Theme */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-bold text-blue-600/60 dark:text-blue-400/60 uppercase tracking-widest">{t('seat_assignments')}</Label>
                            {isEditing && (
                                <button onClick={() => onChange('seats', [...seats, ''])} className="text-[9px] font-black text-blue-600 hover:text-blue-700 transition-colors bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-md border border-blue-200/50">
                                    + ADD
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {seats.map((item, idx) => (
                                <div key={idx} className="group/item">
                                    {isEditing ? (
                                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/10">
                                            <Input
                                                value={item}
                                                onChange={e => handleUpdateList('seats', idx, e.target.value)}
                                                placeholder="12A"
                                                className="h-8 text-sm font-bold bg-transparent border-0 shadow-none focus-visible:ring-0 px-3"
                                            />
                                            <button onClick={() => onChange('seats', seats.filter((_, i) => i !== idx))} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ) : (
                                        <div className="w-full p-4 rounded-[1.25rem] bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 text-center shadow-sm relative group/seat">
                                            <div className="absolute top-2 right-2 flex gap-0.5 opacity-20">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
                                            </div>
                                            <span className="text-2xl font-black text-blue-700 dark:text-blue-300 tracking-tight">{item || "-"}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {seats.length === 0 && !isEditing && <span className="text-xs text-slate-400 italic font-medium px-2">{t('no_seats_set')}</span>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
