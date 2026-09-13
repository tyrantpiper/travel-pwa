"use client"

import React, { useState } from "react"
import { 
    Sun, 
    CloudSun, 
    CloudRain, 
    CloudSnow, 
    CloudLightning, 
    CloudFog, 
    Cloud, 
    Droplets, 
    Wind, 
    ShieldAlert, 
    Sparkles,
    X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useHaptic } from "@/lib/hooks"
import { useLanguage } from "@/lib/LanguageContext"
import { DailyForecastItem } from "@/lib/stores/weatherStore"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DailyWeatherStripProps {
    dayNumber: number
    locationName?: string
    forecastItems?: DailyForecastItem[] | null
    isLoading?: boolean
    targetDate?: string // 行程排定之當日日期 (YYYY-MM-DD)，若相符則高亮
}

/**
 * 格式化日期為 M/D (例如 9/13, 9/14)
 */
function formatDateDisplay(dateStr: string): string {
    if (!dateStr) return ""
    const parts = dateStr.split("-")
    if (parts.length >= 3) {
        return `${Number(parts[1])}/${Number(parts[2])}`
    }
    return dateStr
}

/**
 * 根據 Open-Meteo 天氣代碼取得對應圖示
 */
function getWeatherIcon(code: number) {
    if (code <= 1) return <Sun className="w-4 h-4 text-amber-500 shrink-0" />
    if (code <= 3) return <CloudSun className="w-4 h-4 text-amber-400 dark:text-amber-300 shrink-0" />
    if (code === 45 || code === 48) return <CloudFog className="w-4 h-4 text-slate-400 shrink-0" />
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain className="w-4 h-4 text-sky-500 shrink-0" />
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return <CloudSnow className="w-4 h-4 text-cyan-400 shrink-0" />
    if (code >= 95) return <CloudLightning className="w-4 h-4 text-purple-500 shrink-0" />
    return <Cloud className="w-4 h-4 text-slate-400 shrink-0" />
}

/**
 * 簡易天氣代碼語意說明
 */
function getWeatherDesc(code: number): string {
    if (code === 0) return "晴朗無雲"
    if (code === 1) return "大致晴朗"
    if (code === 2) return "晴時多雲"
    if (code === 3) return "陰天"
    if (code === 45 || code === 48) return "有霧"
    if (code >= 51 && code <= 55) return "小雨/毛毛雨"
    if (code >= 61 && code <= 65) return "陣雨"
    if (code >= 71 && code <= 77) return "降雪"
    if (code >= 80 && code <= 82) return "強降雨"
    if (code >= 95) return "雷雨對流"
    return "多雲"
}

/**
 * 穿著與微氣候建議
 */
function getClothingTip(tempMax: number, tempMin: number, precipProb: number, uvIndex?: number): string {
    const avg = (tempMax + tempMin) / 2
    let tip = ""
    if (precipProb >= 50) {
        tip += "攜帶雨具 ☔ "
    }
    if (avg >= 28) {
        tip += "高溫炎熱，輕薄透氣短袖 🎽"
    } else if (avg >= 23) {
        tip += "氣溫舒適，短袖配薄防曬外衫 👕"
    } else if (avg >= 18) {
        tip += "早晚微涼，備薄外套 🧥"
    } else if (avg >= 12) {
        tip += "偏涼冷，建議風衣或厚外套 🧥"
    } else {
        tip += "寒冷低溫，羽絨服與圍巾必備 🧣"
    }
    if (uvIndex && uvIndex >= 6) {
        tip += " · 紫外線強"
    }
    return tip
}

export function DailyWeatherStrip({
    dayNumber,
    locationName,
    forecastItems,
    isLoading = false,
    targetDate
}: DailyWeatherStripProps) {
    const { t } = useLanguage()
    const haptic = useHaptic()
    const [openIndex, setOpenIndex] = useState<number | null>(null)

    // 骨架屏載入態 (Skeleton Loading)
    if (isLoading || !forecastItems || forecastItems.length === 0) {
        return (
            <div 
                className="w-full py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none"
                onClick={(e) => e.stopPropagation()}
            >
                {[0, 1, 2, 3, 4].map((i) => (
                    <div 
                        key={i} 
                        className="min-h-14.5 min-w-16 flex-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 animate-pulse border border-slate-200/50 dark:border-slate-700/50"
                    />
                ))}
            </div>
        )
    }

    return (
        <div 
            className="w-full py-1"
            onClick={(e) => e.stopPropagation()} // 🛡️ 徹底阻斷向父層卡片冒泡
        >
            <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    {locationName ? `${locationName} · ` : ""}D{dayNumber} {t("w_five_day_forecast") || "即時連續 5 天天氣"}
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500">
                    ECMWF · {t("w_popover_hint") || "點擊看詳情"}
                </span>
            </div>

            {/* 5-Day Microclimate Pill Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                {forecastItems.map((item, index) => {
                    const isToday = index === 0
                    const isMatchedScheduledDate = targetDate && item.date === targetDate
                    const isHighlighted = isMatchedScheduledDate || (isToday && !targetDate)
                    const dateFormatted = formatDateDisplay(item.date)

                    return (
                        <Popover 
                            key={item.date}
                            open={openIndex === index}
                            onOpenChange={(isOpen) => setOpenIndex(isOpen ? index : null)}
                        >
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation() // 🛡️ 事件隔離，防止誤觸 onSelectDay
                                        haptic.selection()
                                        setOpenIndex((prev) => (prev === index ? null : index))
                                    }}
                                    className={cn(
                                        "flex-1 min-w-16 min-h-14.5 py-1.5 px-1.5 rounded-xl flex flex-col items-center justify-between transition-all active:scale-95 cursor-pointer text-left select-none",
                                        isHighlighted
                                            ? "bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-400/80 dark:border-amber-500/80 shadow-xs"
                                            : "bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                    )}
                                    aria-label={`Weather for ${item.date}`}
                                >
                                    {/* 頂部標籤與日期 */}
                                    <div className="flex items-start justify-between w-full">
                                        <div className="flex flex-col items-start leading-none">
                                            <span className={cn(
                                                "text-[10px] font-bold tracking-tight",
                                                isHighlighted 
                                                    ? "text-amber-700 dark:text-amber-300" 
                                                    : "text-slate-700 dark:text-slate-300"
                                            )}>
                                                {item.dayLabel}
                                            </span>
                                            <span className="text-[8.5px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                                                {dateFormatted}
                                            </span>
                                        </div>
                                        {item.precipProb >= 30 && (
                                            <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400 flex items-center leading-none mt-0.5">
                                                {item.precipProb}%
                                            </span>
                                        )}
                                    </div>

                                    {/* 天氣圖示 */}
                                    <div className="my-0.5 flex items-center justify-center">
                                        {getWeatherIcon(item.weatherCode)}
                                    </div>

                                    {/* 溫度區間 */}
                                    <div className="w-full text-center font-mono font-bold text-[10px] text-slate-800 dark:text-slate-200 leading-none">
                                        {item.tempMax}°<span className="text-[9px] font-normal text-slate-400">/{item.tempMin}°</span>
                                    </div>
                                </button>
                            </PopoverTrigger>

                            {/* 📱 氣象微浮層 */}
                            <PopoverContent 
                                side="top" 
                                align="center" 
                                sideOffset={8}
                                collisionPadding={16}
                                className="w-68 p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl z-50 text-slate-900 dark:text-slate-100"
                                onClick={(e) => e.stopPropagation()} // 🛡️ 浮層內部點擊隔離
                            >
                                <div className="space-y-2">
                                    {/* 浮層 Header */}
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                        <div className="flex items-center gap-1.5">
                                            {getWeatherIcon(item.weatherCode)}
                                            <div>
                                                <div className="text-xs font-bold leading-tight flex items-center gap-1">
                                                    {item.dayLabel} · {getWeatherDesc(item.weatherCode)}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    {item.date} {locationName ? `· ${locationName}` : ""}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100">
                                                {item.tempMax}°C / {item.tempMin}°C
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setOpenIndex(null)
                                                }}
                                                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                aria-label="Close"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 浮層指標網格 */}
                                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                                        {/* 體感溫度 */}
                                        <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{t("w_apparent") || "體感"}</span>
                                            <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                                                {item.apparentMax !== undefined ? `${item.apparentMax}°C` : `${item.tempMax}°C`}
                                            </span>
                                        </div>

                                        {/* 降雨機率 */}
                                        <div className="p-1.5 rounded-lg bg-sky-50/50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 flex items-center justify-between">
                                            <span className="text-[10px] text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                                                <Droplets className="w-3 h-3" />
                                                {t("w_precip_chance") || "降雨率"}
                                            </span>
                                            <span className="text-[11px] font-mono font-bold text-sky-700 dark:text-sky-300">
                                                {item.precipProb}%
                                            </span>
                                        </div>

                                        {/* 紫外線 */}
                                        {item.uvIndex !== undefined && (
                                            <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                                                    <ShieldAlert className="w-3 h-3 text-amber-500" />
                                                    {t("w_uv") || "UV"}
                                                </span>
                                                <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                                                    {item.uvIndex}
                                                </span>
                                            </div>
                                        )}

                                        {/* 風速 */}
                                        {item.windSpeed !== undefined && (
                                            <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                                                    <Wind className="w-3 h-3 text-blue-400" />
                                                    {t("w_wind") || "風速"}
                                                </span>
                                                <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                                                    {item.windSpeed} km/h
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 穿著提示盒 */}
                                    <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 text-[10px] text-amber-800 dark:text-amber-200 leading-relaxed flex items-start gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                        <span>{getClothingTip(item.tempMax, item.tempMin, item.precipProb, item.uvIndex)}</span>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )
                })}
            </div>
        </div>
    )
}
