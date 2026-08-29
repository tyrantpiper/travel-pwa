"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { 
    Calendar, 
    MapPin, 
    Sparkles, 
    Clock, 
    ArrowRight, 
    Coins, 
    Plus, 
    Utensils, 
    Hotel, 
    Train, 
    ShoppingBag, 
    Camera
} from "lucide-react"
import { Trip, Activity, DailyLocation } from "@/lib/itinerary-types"
import { useLanguage } from "@/lib/LanguageContext"

interface TripMasterOverviewProps {
    currentTrip?: Trip
    dayNumbers: number[]
    getDateInfo: (dayNum: number) => { date: string; week: string }
    dailyLocs: Record<number, DailyLocation>
    onSelectDay: (day: number) => void
    onAddActivityToDay: (day: number) => void
}

/**
 * 🗺️ Helper: Get category icon with appropriate coloring
 */
function getCategoryIcon(category?: string) {
    switch (category?.toLowerCase()) {
        case "food":
        case "restaurant":
            return <Utensils className="w-3.5 h-3.5 text-amber-500" />
        case "hotel":
        case "accommodation":
            return <Hotel className="w-3.5 h-3.5 text-indigo-500" />
        case "transport":
        case "flight":
        case "transit":
            return <Train className="w-3.5 h-3.5 text-blue-500" />
        case "shopping":
            return <ShoppingBag className="w-3.5 h-3.5 text-rose-500" />
        case "sightseeing":
        case "attraction":
        default:
            return <Camera className="w-3.5 h-3.5 text-emerald-500" />
    }
}

export function TripMasterOverview({
    currentTrip,
    dayNumbers,
    getDateInfo,
    dailyLocs,
    onSelectDay,
    onAddActivityToDay,
}: TripMasterOverviewProps) {
    const { t } = useLanguage()

    // 📊 Metrics Calculation
    const metrics = useMemo(() => {
        if (!currentTrip?.days || !Array.isArray(currentTrip.days)) {
            return {
                totalSpots: 0,
                totalCost: 0,
                cities: [] as string[],
                currency: "JPY",
                highlightSpotsCount: 0
            }
        }

        let spotCount = 0
        let totalCost = 0
        let highlightCount = 0
        const citySet = new Set<string>()

        // Collect cities from dailyLocs
        Object.values(dailyLocs || {}).forEach((loc) => {
            if (loc?.name) citySet.add(loc.name.split(",")[0].trim())
        })

        // Collect from activities
        currentTrip.days.forEach((d) => {
            if (d.activities) {
                d.activities.forEach((act) => {
                    spotCount += 1
                    if (act.cost || act.cost_amount) {
                        totalCost += Number(act.cost ?? act.cost_amount ?? 0)
                    }
                    if (act.is_highlight) {
                        highlightCount += 1
                    }
                })
            }
        })

        return {
            totalSpots: spotCount,
            totalCost,
            cities: Array.from(citySet),
            highlightSpotsCount: highlightCount
        }
    }, [currentTrip, dailyLocs])

    // Group activities by day for fast lookup
    const activitiesByDay = useMemo(() => {
        const map: Record<number, Activity[]> = {}
        if (currentTrip?.days) {
            currentTrip.days.forEach((d) => {
                map[Number(d.day)] = d.activities || []
            })
        }
        return map
    }, [currentTrip])

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {/* 🌟 1. Master Trip Pulse Metrics Card */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-linear-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-700/50 relative overflow-hidden"
            >
                {/* Background Ambient Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl z-0 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl z-0 pointer-events-none" />

                <div className="relative z-10 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                                <Sparkles className="w-5 h-5 text-amber-300" />
                            </span>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                    {currentTrip?.title || t('ov_trip_pulse')}
                                </h2>
                                <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    {currentTrip?.start_date || "—"} ~ {currentTrip?.end_date || "—"}
                                </p>
                            </div>
                        </div>

                        {metrics.cities.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                                {metrics.cities.map((city, idx) => (
                                    <span 
                                        key={idx}
                                        className="text-[11px] font-medium bg-white/15 px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1 text-slate-200 border border-white/10"
                                    >
                                        <MapPin className="w-3 h-3 text-emerald-400" />
                                        {city}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Stat Badges Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                            <p className="text-[11px] text-slate-400 font-medium">{t('ov_total_days')}</p>
                            <p className="text-lg sm:text-xl font-bold text-white mt-0.5">{dayNumbers.length} <span className="text-xs font-normal text-slate-300">Days</span></p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                            <p className="text-[11px] text-slate-400 font-medium">{t('ov_total_spots')}</p>
                            <p className="text-lg sm:text-xl font-bold text-emerald-300 mt-0.5">{metrics.totalSpots} <span className="text-xs font-normal text-slate-300">Spots</span></p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                            <p className="text-[11px] text-slate-400 font-medium">{t('ov_total_budget')}</p>
                            <p className="text-lg sm:text-xl font-bold text-amber-300 mt-0.5">
                                {metrics.totalCost > 0 ? metrics.totalCost.toLocaleString() : "—"}
                            </p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                            <p className="text-[11px] text-slate-400 font-medium">{t('ov_cities_visited')}</p>
                            <p className="text-lg sm:text-xl font-bold text-sky-300 mt-0.5">
                                {metrics.cities.length > 0 ? metrics.cities.length : 1} <span className="text-xs font-normal text-slate-300">Cities</span>
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* 🗓️ 2. Day-by-Day Master Timeline Cards */}
            <div className="space-y-4">
                {dayNumbers.map((d, index) => {
                    const { date, week } = getDateInfo(d)
                    const activities = activitiesByDay[d] || []
                    const dailyLocation = dailyLocs[d]?.name
                    const hasActivities = activities.length > 0
                    const dayTotalCost = activities.reduce((sum, item) => sum + Number(item.cost ?? item.cost_amount ?? 0), 0)

                    return (
                        <motion.div
                            key={d}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: index * 0.04 }}
                            className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md border border-slate-200/80 dark:border-slate-700 transition-all group"
                        >
                            {/* Day Header Row */}
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3 mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl flex flex-col items-center justify-center font-bold shadow-sm">
                                        <span className="text-[10px] opacity-75 leading-tight">{week}</span>
                                        <span className="text-sm font-extrabold leading-tight">D{d}</span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                                                Day {d} · {date}
                                            </h3>
                                            {dailyLocation && (
                                                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {dailyLocation.split(",")[0].trim()}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                            {activities.length} {t('ov_total_spots')}
                                            {dayTotalCost > 0 && ` · ${t('ov_daily_estimated_cost')}: ${dayTotalCost.toLocaleString()} ${metrics.currency}`}
                                        </p>
                                    </div>
                                </div>

                                {/* Jump to Day Button */}
                                <button
                                    onClick={() => onSelectDay(d)}
                                    className="min-h-11 min-w-11 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-all group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-slate-100 dark:group-hover:text-slate-900 active:scale-95 cursor-pointer"
                                    aria-label={`Jump to Day ${d}`}
                                >
                                    <span>{t('ov_view_day')}</span>
                                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                </button>
                            </div>

                            {/* Activities Timeline Stream */}
                            {hasActivities ? (
                                <div 
                                    onClick={() => onSelectDay(d)}
                                    className="space-y-2 cursor-pointer rounded-xl p-1.5 -mx-1.5 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors"
                                >
                                    {activities.map((act, actIdx) => (
                                        <div 
                                            key={act.id || actIdx}
                                            className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 w-11 shrink-0 flex items-center gap-1">
                                                    <Clock className="w-3 h-3 opacity-60" />
                                                    {act.time || act.time_slot || "—"}
                                                </span>
                                                <span className="shrink-0 p-1 bg-white dark:bg-slate-800 rounded-md shadow-2xs">
                                                    {getCategoryIcon(act.category)}
                                                </span>
                                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                                    {act.place || act.place_name || "Untitled Spot"}
                                                </span>
                                                {act.is_highlight && (
                                                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded font-semibold shrink-0">
                                                        ⭐
                                                    </span>
                                                )}
                                            </div>

                                            {/* Cost or Tag Pill */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                {(act.cost || act.cost_amount) ? (
                                                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-0.5">
                                                        <Coins className="w-3 h-3 text-amber-500" />
                                                        {Number(act.cost ?? act.cost_amount).toLocaleString()}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* 🌱 Empty Day State */
                                <div className="py-4 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-700 text-center">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                                        {t('ov_empty_day_prompt')}
                                    </p>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onAddActivityToDay(d)
                                        }}
                                        className="min-h-9 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>{t('add_activity')}</span>
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
