"use client"

import React, { useState, useMemo } from "react"
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Check } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useHaptic } from "@/lib/hooks"
import { useLanguage } from "@/lib/LanguageContext"

interface SingleDateCalendarPopoverProps {
    dayNumber: number
    totalDays?: number
    tripStartDate?: string | null
    onChangeDay: (dayNumber: number, dateStr?: string) => void
    triggerClassName?: string
}

export function SingleDateCalendarPopover({
    dayNumber,
    totalDays = 7,
    tripStartDate,
    onChangeDay,
    triggerClassName,
}: SingleDateCalendarPopoverProps) {
    const [open, setOpen] = useState(false)
    const { lang } = useLanguage()
    const zh = lang === "zh"
    const haptic = useHaptic()

    // 依據 tripStartDate 與 dayNumber 計算目前對應的日期
    const computedDateStr = useMemo(() => {
        if (!tripStartDate) return null
        try {
            const parts = tripStartDate.split("T")[0].split("-").map(Number)
            const d = new Date(parts[0], parts[1] - 1, parts[2] + (dayNumber - 1))
            const mm = String(d.getMonth() + 1).padStart(2, "0")
            const dd = String(d.getDate()).padStart(2, "0")
            return `${mm}/${dd}`
        } catch {
            return null
        }
    }, [tripStartDate, dayNumber])

    // 當前日曆瀏覽月份
    const [viewDate, setViewDate] = useState(() => {
        if (tripStartDate) {
            const parts = tripStartDate.split("T")[0].split("-").map(Number)
            return new Date(parts[0], parts[1] - 1, 1)
        }
        return new Date()
    })

    const year = viewDate.getFullYear()
    const month = viewDate.getMonth() // 0-indexed

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfWeek = new Date(year, month, 1).getDay() // 0 = Sun

    const weekLabels = zh ? ["日", "一", "二", "三", "四", "五", "六"] : ["S", "M", "T", "W", "T", "F", "S"]

    const handleSelectDayPill = (dNum: number) => {
        haptic.tap()
        onChangeDay(dNum)
        setOpen(false)
    }

    const handleSelectCalendarDay = (dayOfMonth: number) => {
        haptic.tap()
        if (tripStartDate) {
            const startParts = tripStartDate.split("T")[0].split("-").map(Number)
            const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2])
            const selectedDate = new Date(year, month, dayOfMonth)
            const diffTime = selectedDate.getTime() - startDate.getTime()
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
            const targetDayNum = Math.max(1, diffDays + 1)
            const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`
            onChangeDay(targetDayNum, ymd)
        } else {
            onChangeDay(dayOfMonth)
        }
        setOpen(false)
    }

    const maxDays = Math.max(totalDays, dayNumber, 5)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors border",
                        "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200",
                        "dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700",
                        triggerClassName
                    )}
                >
                    <CalendarIcon className="w-3 h-3 text-emerald-500" />
                    <span>Day {dayNumber}</span>
                    {computedDateStr && <span className="opacity-70 text-[10px]">({computedDateStr})</span>}
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={6}
                className="w-72 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-180"
            >
                {/* 標頭 */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-emerald-500" />
                        {zh ? "選擇行程天數 / 日期" : "Select Day / Date"}
                    </span>
                    <span className="text-[10px] text-slate-400">Day {dayNumber}</span>
                </div>

                {/* 快捷天數膠囊列 */}
                <div className="mb-3">
                    <span className="text-[10px] font-semibold text-slate-400 block mb-1.5">
                        {zh ? "天數快捷切換" : "Quick Day Switch"}
                    </span>
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                        {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => handleSelectDayPill(d)}
                                className={cn(
                                    "shrink-0 px-2.5 py-1 text-xs rounded-lg font-medium transition-all",
                                    d === dayNumber
                                        ? "bg-emerald-500 text-white shadow-xs font-bold"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                )}
                            >
                                Day {d}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 微型日曆切換標頭 */}
                <div className="flex items-center justify-between mb-1.5 px-1">
                    <button
                        type="button"
                        onClick={() => setViewDate(new Date(year, month - 1, 1))}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {year}年 {month + 1}月
                    </span>
                    <button
                        type="button"
                        onClick={() => setViewDate(new Date(year, month + 1, 1))}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* 星期標頭 */}
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-1">
                    {weekLabels.map((w, idx) => (
                        <div key={idx} className={idx === 0 || idx === 6 ? "text-rose-400" : ""}>
                            {w}
                        </div>
                    ))}
                </div>

                {/* 月曆格子 */}
                <div className="grid grid-cols-7 gap-1 text-center">
                    {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                        <div key={`pad-${idx}`} className="h-6" />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, idx) => idx + 1).map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => handleSelectCalendarDay(d)}
                            className="h-6 w-full text-xs rounded-md flex items-center justify-center font-medium transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}


interface ClockTimePickerPopoverProps {
    time: string
    onChangeTime: (time: string) => void
    triggerClassName?: string
}

export function ClockTimePickerPopover({
    time,
    onChangeTime,
    triggerClassName,
}: ClockTimePickerPopoverProps) {
    const [open, setOpen] = useState(false)
    const { lang } = useLanguage()
    const zh = lang === "zh"
    const haptic = useHaptic()

    // 常用時段預設膠囊
    const timePresets = [
        { label: zh ? "🌅 09:00 上午" : "🌅 09:00 Morning", value: "09:00" },
        { label: zh ? "☀️ 12:00 午餐" : "☀️ 12:00 Lunch", value: "12:00" },
        { label: zh ? "☕ 14:30 下午" : "☕ 14:30 Afternoon", value: "14:30" },
        { label: zh ? "🌙 18:30 晚餐" : "🌙 18:30 Dinner", value: "18:30" },
        { label: zh ? "🌃 21:00 宵夜" : "🌃 21:00 Night", value: "21:00" },
    ]

    const handleSelectPreset = (val: string) => {
        haptic.tap()
        onChangeTime(val)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors border",
                        "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200",
                        "dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700",
                        triggerClassName
                    )}
                >
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span>{time || "12:00"}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={6}
                className="w-64 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-180"
            >
                {/* 標頭 */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        {zh ? "選擇抵達時間" : "Select Arrival Time"}
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                        {time || "12:00"}
                    </span>
                </div>

                {/* 常用時段膠囊 */}
                <div className="space-y-1 mb-3">
                    <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                        {zh ? "快捷時段" : "Quick Presets"}
                    </span>
                    <div className="grid grid-cols-1 gap-1">
                        {timePresets.map((preset) => (
                            <button
                                key={preset.value}
                                type="button"
                                onClick={() => handleSelectPreset(preset.value)}
                                className={cn(
                                    "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors",
                                    time === preset.value
                                        ? "bg-amber-500 text-white font-bold"
                                        : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                )}
                            >
                                <span>{preset.label}</span>
                                {time === preset.value && <Check className="w-3.5 h-3.5" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 自訂精確時間輸入 */}
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                        {zh ? "自訂時間 (時:分)" : "Custom Time"}
                    </span>
                    <input
                        type="time"
                        value={time || "12:00"}
                        onChange={(e) => {
                            haptic.tap()
                            onChangeTime(e.target.value)
                        }}
                        className="w-full h-8 px-2 text-xs text-center font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                </div>
            </PopoverContent>
        </Popover>
    )
}
