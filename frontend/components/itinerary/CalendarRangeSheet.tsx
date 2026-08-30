"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { 
    X, 
    Calendar as CalendarIcon, 
    RotateCcw, 
    Check, 
    Sparkles,
    Loader2
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useHaptic } from "@/lib/hooks"
import { useLanguage } from "@/lib/LanguageContext"

interface CalendarRangeSheetProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    currentStartDate?: string | null
    currentEndDate?: string | null
    onConfirm: (startDate: string, endDate: string) => Promise<void>
    isUpdating?: boolean
}

// 🛡️ Timezone-safe date helpers
function formatYMD(year: number, month: number, day: number): string {
    const mm = String(month).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return `${year}-${mm}-${dd}`
}

function parseLocalDateParts(ymdStr: string) {
    const parts = ymdStr.split('T')[0].split('-').map(Number)
    return {
        year: parts[0],
        month: parts[1], // 1-indexed
        day: parts[2]
    }
}

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
    // 0 = Sunday, 1 = Monday, ...
    return new Date(year, month - 1, 1).getDay()
}

export function CalendarRangeSheet({
    isOpen,
    onOpenChange,
    currentStartDate,
    currentEndDate,
    onConfirm,
    isUpdating = false,
}: CalendarRangeSheetProps) {
    const { t, lang } = useLanguage()
    const zh = lang === 'zh'
    const haptic = useHaptic()

    // Today string in local time
    const todayYMD = useMemo(() => {
        const now = new Date()
        return formatYMD(now.getFullYear(), now.getMonth() + 1, now.getDate())
    }, [])

    const initialStart = useMemo(() => currentStartDate?.split('T')[0] || todayYMD, [currentStartDate, todayYMD])
    const initialEnd = useMemo(() => currentEndDate?.split('T')[0] || initialStart, [currentEndDate, initialStart])

    const [selectedStart, setSelectedStart] = useState<string | null>(initialStart)
    const [selectedEnd, setSelectedEnd] = useState<string | null>(initialEnd)
    const [prevOpen, setPrevOpen] = useState(isOpen)
    const [prevStartDate, setPrevStartDate] = useState(currentStartDate)
    const [prevEndDate, setPrevEndDate] = useState(currentEndDate)

    // 🔄 Standard React 19 pattern: sync selection when modal opens or trip dates change
    if (isOpen !== prevOpen || currentStartDate !== prevStartDate || currentEndDate !== prevEndDate) {
        setPrevOpen(isOpen)
        setPrevStartDate(currentStartDate)
        setPrevEndDate(currentEndDate)
        if (isOpen) {
            setSelectedStart(initialStart)
            setSelectedEnd(initialEnd)
        }
    }

    const activeMonthRef = useRef<HTMLDivElement | null>(null)
    const todayMonthRef = useRef<HTMLDivElement | null>(null)
    const scrollContainerRef = useRef<HTMLDivElement | null>(null)

    // Today month key (YYYY-M)
    const todayParts = useMemo(() => parseLocalDateParts(todayYMD), [todayYMD])
    const todayMonthKey = `${todayParts.year}-${todayParts.month}`

    // Auto scroll to active month when modal opens
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                activeMonthRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 180)
            return () => clearTimeout(timer)
        }
    }, [isOpen])

    // Generate seamless month stream covering both today and trip start date
    const monthsList = useMemo(() => {
        const rawTrip = currentStartDate?.split('T')[0] || todayYMD
        const tripParts = parseLocalDateParts(rawTrip)
        
        const tripMonthIndex = tripParts.year * 12 + (tripParts.month - 1)
        const todayMonthIndex = todayParts.year * 12 + (todayParts.month - 1)
        
        // Ensure stream covers from min(trip, today) - 2 months up to max(trip, today) + 20 months
        const minIndex = Math.min(tripMonthIndex, todayMonthIndex) - 2
        const maxIndex = Math.max(tripMonthIndex, todayMonthIndex) + 20
        
        const list: { year: number; month: number; label: string; key: string }[] = []
        
        for (let idx = minIndex; idx <= maxIndex; idx++) {
            const y = Math.floor(idx / 12)
            const m = (idx % 12) + 1
            const d = new Date(y, m - 1, 1)
            const monthLabel = zh 
                ? `${y} 年 ${m} 月` 
                : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            list.push({
                year: y,
                month: m,
                label: monthLabel,
                key: `${y}-${m}`
            })
        }
        return list
    }, [currentStartDate, todayYMD, todayParts, zh])

    // Calculate selected duration
    const durationInfo = useMemo(() => {
        if (!selectedStart) return null
        const end = selectedEnd || selectedStart
        const startParts = parseLocalDateParts(selectedStart)
        const endParts = parseLocalDateParts(end)

        const startD = new Date(startParts.year, startParts.month - 1, startParts.day)
        const endD = new Date(endParts.year, endParts.month - 1, endParts.day)
        
        const diffMs = endD.getTime() - startD.getTime()
        const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1)
        const nights = Math.max(0, days - 1)

        return { days, nights }
    }, [selectedStart, selectedEnd])

    // Handle day tap
    const handleDateClick = (ymd: string) => {
        haptic.tap()

        if (!selectedStart || (selectedStart && selectedEnd)) {
            // First tap: start new selection
            setSelectedStart(ymd)
            setSelectedEnd(null)
        } else if (selectedStart && !selectedEnd) {
            // Second tap: set end
            if (ymd < selectedStart) {
                // If tapped earlier date, make it the start date
                setSelectedEnd(selectedStart)
                setSelectedStart(ymd)
            } else {
                setSelectedEnd(ymd)
            }
        }
    }

    const handleJumpToToday = () => {
        haptic.tap()
        todayMonthRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const handleConfirmSubmit = async () => {
        if (!selectedStart) return
        haptic.success()
        const end = selectedEnd || selectedStart
        await onConfirm(selectedStart, end)
        onOpenChange(false)
    }

    const weekHeaders = zh 
        ? ["日", "一", "二", "三", "四", "五", "六"] 
        : ["S", "M", "T", "W", "T", "F", "S"]

    // Check which month is the current active trip month
    const targetTripMonthKey = useMemo(() => {
        const raw = currentStartDate?.split('T')[0] || selectedStart
        if (!raw) return ""
        const p = parseLocalDateParts(raw)
        return `${p.year}-${p.month}`
    }, [currentStartDate, selectedStart])

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent 
                showCloseButton={false}
                className="p-0 max-w-lg w-full max-h-[85vh] h-180 rounded-3xl overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-120 pointer-events-auto"
            >
                
                {/* 🏷️ 1. Header with iOS Glass Pill */}
                <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
                    <div>
                        <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
                                <CalendarIcon className="w-4 h-4 text-emerald-500" />
                            </span>
                            {t('cal_title') || '調整旅行日期'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {t('cal_select_range') || '點選出發與結束日期'}
                        </DialogDescription>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleJumpToToday}
                            className="text-xs h-8 px-2.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <RotateCcw className="w-3 h-3 mr-1 text-emerald-500" />
                            {t('cal_jump_to_today') || '跳至今日'}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onOpenChange(false)}
                            className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* 📅 2. Fixed Weekday Indicator Bar */}
                <div className="grid grid-cols-7 text-center py-2 px-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800/80 text-[11px] font-bold text-slate-400 dark:text-slate-400 tracking-wider">
                    {weekHeaders.map((w, idx) => (
                        <div key={idx} className={cn(idx === 0 || idx === 6 ? "text-rose-400 dark:text-rose-400/80" : "")}>
                            {w}
                        </div>
                    ))}
                </div>

                {/* 📜 3. Continuous 24-Month Vertical Scroll Stream */}
                <div 
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto px-4 py-2 space-y-6 no-scrollbar overscroll-contain"
                >
                    {monthsList.map(({ year, month, label, key }) => {
                        const daysInMonth = getDaysInMonth(year, month)
                        const firstDayOfWeek = getFirstDayOfWeek(year, month)
                        const isTargetMonth = key === targetTripMonthKey
                        const isTodayMonth = key === todayMonthKey

                        return (
                            <div 
                                key={key}
                                ref={(el) => {
                                    if (isTargetMonth) activeMonthRef.current = el
                                    if (isTodayMonth) todayMonthRef.current = el
                                }}
                                className="space-y-2 pt-1"
                            >
                                {/* Sticky Month Subtitle */}
                                <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs py-1 px-2 z-10">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-1.5">
                                        {label}
                                        {isTargetMonth && (
                                            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                                                Active
                                            </span>
                                        )}
                                    </h3>
                                </div>

                                {/* Month Grid */}
                                <div className="grid grid-cols-7 gap-y-1 text-center">
                                    {/* Empty cells before day 1 */}
                                    {Array.from({ length: firstDayOfWeek }).map((_, emptyIdx) => (
                                        <div key={`empty-${emptyIdx}`} className="h-10" />
                                    ))}

                                    {/* Month Days */}
                                    {Array.from({ length: daysInMonth }).map((_, dayIdx) => {
                                        const dayNum = dayIdx + 1
                                        const ymd = formatYMD(year, month, dayNum)

                                        const isStart = ymd === selectedStart
                                        const isEnd = ymd === (selectedEnd || selectedStart)
                                        const isInRange = selectedStart && selectedEnd && ymd >= selectedStart && ymd <= selectedEnd
                                        const isSingleDay = selectedStart && selectedEnd && selectedStart === selectedEnd && isStart
                                        const isToday = ymd === todayYMD

                                        return (
                                            <button 
                                                type="button"
                                                key={ymd} 
                                                className={cn(
                                                    "relative h-10 w-full flex items-center justify-center cursor-pointer select-none transition-colors p-0 border-none bg-transparent outline-hidden",
                                                    isInRange && !isStart && !isEnd ? "bg-slate-100 dark:bg-slate-800/70" : "",
                                                    isInRange && isStart && !isSingleDay ? "bg-linear-to-r from-transparent to-slate-100 dark:to-slate-800/70" : "",
                                                    isInRange && isEnd && !isSingleDay ? "bg-linear-to-l from-transparent to-slate-100 dark:to-slate-800/70" : ""
                                                )}
                                                onClick={() => handleDateClick(ymd)}
                                            >
                                                {/* Capsule / Circular Highlight Container */}
                                                <div 
                                                    className={cn(
                                                        "w-9 h-9 rounded-full flex flex-col items-center justify-center text-xs font-semibold transition-all pointer-events-none",
                                                        (isStart || isEnd) 
                                                            ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md scale-105 z-10" 
                                                            : isInRange 
                                                                ? "text-slate-900 dark:text-slate-100" 
                                                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50",
                                                        isToday && !(isStart || isEnd) && "border border-emerald-500 font-bold text-emerald-600 dark:text-emerald-400"
                                                    )}
                                                >
                                                    <span>{dayNum}</span>
                                                    {isToday && (
                                                        <span className={cn(
                                                            "w-1 h-1 rounded-full -mt-0.5",
                                                            (isStart || isEnd) ? "bg-white dark:bg-slate-900" : "bg-emerald-500"
                                                        )} />
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* 🎯 4. Bottom Sticky Action & Summary Bar */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-xs text-slate-400 font-medium">
                                {selectedStart && (selectedEnd || selectedStart) 
                                    ? `${selectedStart} → ${selectedEnd || selectedStart}` 
                                    : "請選取日期區間"}
                            </p>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                {durationInfo 
                                    ? (durationInfo.nights === 0 
                                        ? (t('cal_single_day') || '1 天當日來回') 
                                        : (t('cal_days_nights') || '{days} 天 {nights} 晚')
                                            .replace('{days}', String(durationInfo.days))
                                            .replace('{nights}', String(durationInfo.nights)))
                                    : "—"}
                            </p>
                        </div>

                        <Button
                            onClick={handleConfirmSubmit}
                            disabled={!selectedStart || isUpdating}
                            className="px-6 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 font-bold shadow-lg transition-transform active:scale-95"
                        >
                            {isUpdating ? (
                                <span className="flex items-center gap-1.5">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('cal_updating') || '更新中...'}
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5">
                                    <Check className="w-4 h-4" />
                                    {t('cal_confirm_range') || '確認變更日期'}
                                </span>
                            )}
                        </Button>
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    )
}
