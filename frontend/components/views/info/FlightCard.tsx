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

                {/* 📅 Date Header (Premium Typography) */}
                <div className="flex items-center justify-between mb-8 px-2">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] pl-1">
                            {t('departure_date')}
                        </Label>
                        <Input
                            type="date"
                            disabled={!isEditing}
                            value={data.dep_date || data.date || ""}
                            onChange={e => onChange('dep_date', e.target.value)}
                            className={cn(
                                "h-auto p-0 border-0 bg-transparent text-sm font-black shadow-none focus-visible:ring-0",
                                !isEditing && "text-slate-500"
                            )}
                        />
                    </div>
                    <div className="h-px flex-1 mx-6 bg-slate-200/50 dark:bg-slate-700/50 hidden sm:block relative">
                        <div className="absolute right-0 -top-1 w-2 h-2 rounded-full bg-blue-400/30" />
                    </div>
                    <div className="space-y-1 text-right">
                        <Label className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] pr-1 flex justify-end">
                            {t('arrival_date')}
                        </Label>
                        <Input
                            type="date"
                            disabled={!isEditing}
                            value={data.arr_date || data.date || ""}
                            onChange={e => onChange('arr_date', e.target.value)}
                            className={cn(
                                "h-auto p-0 border-0 bg-transparent text-sm font-black shadow-none focus-visible:ring-0 text-right justify-end",
                                !isEditing && "text-slate-500"
                            )}
                        />
                    </div>
                </div>

                {/* ✈️ Main Airport & Time Grid */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6 relative px-1">
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
                            placeholder="TPE"
                        />
                        <div className="flex items-center gap-2 mt-2">
                            <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <Input
                                type={isEditing ? "time" : "text"}
                                disabled={!isEditing}
                                value={data.dep_time}
                                onChange={e => onChange('dep_time', e.target.value)}
                                className={cn(
                                    "h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent transition-all",
                                    isEditing ? "text-xs font-semibold border-b border-blue-100 rounded-none w-full" : "text-xl font-black text-slate-600 dark:text-slate-400"
                                )}
                                placeholder="00:00"
                            />
                        </div>
                    </div>

                    {/* Flight Path Visual */}
                    <div className="flex flex-col items-center justify-center">
                        <motion.div
                            animate={{
                                x: [0, 5, 0],
                                rotate: 90
                            }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="relative"
                        >
                            <Plane className="w-7 h-7 text-blue-500/40" />
                        </motion.div>
                        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-blue-200 to-transparent dark:via-blue-800 mt-3 rounded-full opacity-50" />
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
                                placeholder="NRT"
                            />
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-2">
                            <Input
                                type={isEditing ? "time" : "text"}
                                disabled={!isEditing}
                                value={data.arr_time}
                                onChange={e => onChange('arr_time', e.target.value)}
                                className={cn(
                                    "h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent transition-all text-right",
                                    isEditing ? "text-xs font-semibold border-b border-indigo-100 rounded-none w-full" : "text-xl font-black text-slate-600 dark:text-slate-400"
                                )}
                                placeholder="00:00"
                            />
                            <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ✂️ Dashed Divider with Punched Holes */}
            <div className="relative h-px bg-transparent flex items-center px-4">
                <div className="w-full border-t-2 border-dashed border-slate-100 dark:border-slate-700/50" />
            </div>

            {/* Bottom Section: Airline & Traveler Info */}
            <div className="p-8 space-y-8 bg-white/40 dark:bg-slate-800/20">
                {/* 🛡️ THE FIX: Airline & Flight Number Alignment */}
                <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] pl-1">
                            {t('airline')}
                        </Label>
                        <Input
                            disabled={!isEditing}
                            value={data.airline}
                            onChange={e => onChange('airline', e.target.value)}
                            placeholder="Eg. JAL / ANA"
                            className={cn(
                                "h-10 border-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl text-sm font-bold px-4 focus-visible:ring-blue-500/20",
                                !isEditing && "bg-transparent px-0 text-xl font-black text-slate-900 dark:text-white"
                            )}
                        />
                    </div>
                    {/* 🎯 RIGHT ALIGNMENT FIX APPLIED HERE */}
                    <div className="space-y-2 flex flex-col items-end">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] pr-1 w-full text-right flex justify-end">
                            {t('flight_number')}
                        </Label>
                        <Input
                            disabled={!isEditing}
                            value={data.code}
                            onChange={e => onChange('code', e.target.value)}
                            placeholder="JL802"
                            className={cn(
                                "h-10 border-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl text-sm font-black font-mono text-right px-4 focus-visible:ring-blue-500/20",
                                !isEditing && "bg-transparent px-0 text-2xl text-blue-600 dark:text-blue-400"
                            )}
                        />
                    </div>
                </div>

                {/* 🎒 Traveler Information Grid (PNR / Terminal / Seat) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t border-slate-100/50 dark:border-slate-700/30">
                    {/* PNR Column */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('confirmation_pnr')}</Label>
                            {isEditing && (
                                <button onClick={() => onChange('pnrs', [...pnrs, ''])} className="text-[10px] font-bold text-blue-500 hover:text-blue-600 transition-colors bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
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
                                            className="w-full flex items-center justify-between p-4 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100/50 dark:border-orange-900/30 hover:bg-orange-100/50 transition-all text-left shadow-sm hover:shadow-md"
                                        >
                                            <span className="text-2xl font-black font-mono text-orange-600 dark:text-orange-400 tracking-wider">
                                                {item || "-"}
                                            </span>
                                            <Copy className="w-4 h-4 text-orange-300 group-hover/item:text-orange-500 transition-colors" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {pnrs.length === 0 && !isEditing && <span className="text-sm text-slate-300 italic px-2">{t('no_pnr_set')}</span>}
                        </div>
                    </div>

                    {/* Terminal Column */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('terminal')}</Label>
                            {isEditing && (
                                <button onClick={() => onChange('terminals', [...terminals, ''])} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 transition-colors bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                    + ADD
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {terminals.map((item, idx) => (
                                <div key={idx} className="group/item flex items-center gap-2">
                                    {isEditing ? (
                                        <div className="flex-1 flex gap-1 items-center bg-slate-50 dark:bg-slate-900/30 p-1 rounded-lg border border-transparent focus-within:border-indigo-200">
                                            <Input
                                                value={item}
                                                onChange={e => handleUpdateList('terminals', idx, e.target.value)}
                                                placeholder="T1/T2"
                                                className="h-7 text-xs font-bold bg-transparent border-0 shadow-none focus-visible:ring-0 px-2"
                                            />
                                            <button onClick={() => onChange('terminals', terminals.filter((_, i) => i !== idx))} className="p-1 text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                                        </div>
                                    ) : (
                                        <div className="w-full p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600 text-center shadow-sm">
                                            <span className="text-2xl font-black text-slate-700 dark:text-slate-200">{item || "-"}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {terminals.length === 0 && !isEditing && <span className="text-sm text-slate-300 italic px-2">{t('no_terminal_set')}</span>}
                        </div>
                    </div>

                    {/* Seat Column */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('seat_assignments')}</Label>
                            {isEditing && (
                                <button onClick={() => onChange('seats', [...seats, ''])} className="text-[10px] font-bold text-blue-500 hover:text-blue-600 transition-colors bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
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
                                        <div className="w-full p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 text-center shadow-sm">
                                            <span className="text-2xl font-black text-blue-600 dark:text-blue-300">{item || "-"}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {seats.length === 0 && !isEditing && <span className="text-sm text-slate-300 italic px-2">{t('no_seats_set')}</span>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
