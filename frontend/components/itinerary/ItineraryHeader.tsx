"use client"

import { ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { TripSwitcher } from "@/components/trip-switcher"
import { ShareButton } from "@/components/itinerary/ShareButton"
import { TripMembersSheet } from "@/components/itinerary/TripMembersSheet"
import { ZenRenew } from "@/components/ui/zen-renew"
import { Trip } from "@/lib/itinerary-types"
import { useLanguage } from "@/lib/LanguageContext"

interface ItineraryHeaderProps {
    currentTrip?: Trip
    dayNumbers: number[]
    day: number
    setDay: (d: number) => void
    onBack: () => void
    onAddDay: (position: "before" | "end") => void
    onDeleteDay: (dayNum: number) => void
    getDateInfo: (dayNum: number) => { date: string; week: string }
    userId: string | null
    onRefresh: () => Promise<void>
    shouldShowDateSkeleton: boolean
}

export function ItineraryHeader({
    currentTrip,
    dayNumbers,
    day,
    setDay,
    onBack,
    onAddDay,
    onDeleteDay,
    getDateInfo,
    userId,
    onRefresh,
    shouldShowDateSkeleton
}: ItineraryHeaderProps) {
    const totalDays = dayNumbers.length
    const { t } = useLanguage()

    return (
        <div className="bg-white dark:bg-slate-800 pt-12 pb-2 border-b border-slate-200 dark:border-slate-700">
            <div className="px-6 flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-4 sm:gap-2">
                <div className="w-full sm:w-auto min-w-0">
                    <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-slate-400 mb-2">
                        <ArrowLeft className="w-3 h-3" /> {t('back')}
                    </button>
                    <TripSwitcher className="w-full sm:w-[240px] justify-start px-0 font-serif font-bold text-2xl border-none shadow-none bg-transparent hover:bg-slate-100/50 h-auto py-1" />
                </div>
                <div className="flex items-center justify-between w-full sm:w-auto sm:gap-4 min-w-0">
                    <div className="flex items-center gap-2">
                        {currentTrip?.public_id && (
                            <ShareButton
                                publicId={currentTrip.public_id}
                                tripTitle={currentTrip.title}
                            />
                        )}
                        {currentTrip && (
                            <TripMembersSheet
                                tripId={currentTrip.id}
                                members={currentTrip.members || []}
                                createdBy={currentTrip.created_by || ""}
                                currentUserId={userId || ""}
                                onMemberKicked={onRefresh}
                            />
                        )}
                    </div>
                    <ZenRenew onRefresh={onRefresh} successMessage={t('update_success')} errorMessage={t('update_failed')} />
                </div>
            </div>

            <div className="flex gap-3 overflow-x-auto px-6 pt-2 no-scrollbar items-center">
                <button
                    onClick={() => onAddDay("before")}
                    className="flex-shrink-0 w-8 h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-lg font-bold flex items-center justify-center shadow-sm transition-all hover:scale-110"
                    title={t('iv_add_day_before')}
                    aria-label={t('iv_add_day_before')}
                >
                    +
                </button>

                {shouldShowDateSkeleton ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse flex-shrink-0" />
                    ))
                ) : (
                    dayNumbers.map((d) => {
                        const { date, week } = getDateInfo(d)
                        return (
                            <div key={d} className="relative flex flex-col items-center">
                                <button
                                    onClick={() => setDay(d)}
                                    className={cn(
                                        "day-btn relative flex flex-col items-center min-w-[3.5rem] py-2 rounded-lg border",
                                        day === d
                                            ? "text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-md"
                                            : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700"
                                    )}
                                >
                                    {day === d && (
                                        <motion.div
                                            layoutId="day-indicator"
                                            className="absolute inset-0 bg-slate-900 dark:bg-slate-100 rounded-lg -z-10"
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                    <span className="text-[10px] opacity-70">{week}</span>
                                    <span className="font-bold">{date}</span>
                                </button>
                                {totalDays > 1 && day === d && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteDay(d) }}
                                        className="mt-1.5 px-2.5 py-1 text-[10px] font-medium 
                                                text-red-400 bg-red-50/80 backdrop-blur-sm
                                                border border-red-200/60 rounded-full shadow-sm 
                                                active:scale-95 active:bg-red-100
                                                transition-transform duration-100"
                                    >
                                        {t('iv_delete_this_day')}
                                    </button>
                                )}
                            </div>
                        )
                    })
                )}

                <button
                    onClick={() => onAddDay("end")}
                    className="flex-shrink-0 w-8 h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-lg font-bold flex items-center justify-center shadow-sm transition-all hover:scale-110"
                    title={t('iv_add_day_end')}
                    aria-label={t('iv_add_day_end')}
                >
                    +
                </button>
            </div>
        </div>
    )
}
