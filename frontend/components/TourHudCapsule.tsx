"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, Pause, Play, SkipForward, X } from "lucide-react"
import { FlyoverPOI } from "@/hooks/useFlyoverController"
import { useLanguage } from "@/lib/LanguageContext"

export interface TourHudCapsuleProps {
    isTouring: boolean
    isOrbiting: boolean
    isPaused: boolean
    currentIndex: number
    currentPOI: FlyoverPOI | null
    onTogglePause: () => void
    onSkipNext: () => void
    onCancel: () => void
    onOpenStreetView?: (lat: number, lng: number) => void
    hasStreetView?: boolean
}

export function TourHudCapsule({
    isTouring,
    isOrbiting,
    isPaused,
    currentIndex,
    currentPOI,
    onTogglePause,
    onSkipNext,
    onCancel,
    onOpenStreetView,
    hasStreetView = false,
}: TourHudCapsuleProps) {
    const { t } = useLanguage()

    if (!isTouring || !currentPOI) return null

    // 支援多天標籤格式（若 POI 包含 day 欄位則顯示 D{day}-{seq}，否則顯示序號）
    const poiDay = typeof currentPOI.day === "number" ? currentPOI.day : undefined
    const poiSeq = typeof currentPOI.sequence === "number" ? currentPOI.sequence : currentIndex + 1
    const badgeText = poiDay ? `D${poiDay}-${poiSeq}` : `${currentIndex + 1}`

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute top-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl px-3.5 py-2.5 shadow-2xl border border-white/15 flex items-center justify-between gap-3 max-w-sm sm:max-w-md w-auto pointer-events-auto select-none"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-7 px-2 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 text-xs font-black shadow-xs">
                        {badgeText}
                    </span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span
                                className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                                    isPaused ? "text-amber-300" : "text-indigo-300"
                                }`}
                            >
                                {isPaused
                                    ? t("flyover_paused") || "⏸️ 導覽已暫停 (可自由瀏覽周邊)"
                                    : isOrbiting
                                    ? t("flyover_orbiting") || "🔄 360° 環繞盤旋中"
                                    : t("flyover_flying") || "✈️ 飛往此站中..."}
                            </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-100 truncate">
                            {currentPOI.name || "景點"}
                        </h4>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {hasStreetView && onOpenStreetView && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onOpenStreetView(currentPOI.lat, currentPOI.lng)
                            }}
                            className="px-2 py-1 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer shadow-xs"
                            title={t("mapillary_streetview") || "實景"}
                        >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{t("mapillary_streetview") || "實景"}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onTogglePause()
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer shadow-xs ${
                            isPaused
                                ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-black animate-pulse"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        }`}
                        title={isPaused ? t("flyover_resume") || "繼續" : t("flyover_pause") || "暫停"}
                    >
                        {isPaused ? (
                            <Play className="w-3.5 h-3.5 fill-current" />
                        ) : (
                            <Pause className="w-3.5 h-3.5" />
                        )}
                        <span>{isPaused ? t("flyover_resume") || "繼續" : t("flyover_pause") || "暫停"}</span>
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onSkipNext()
                        }}
                        className="px-2 py-1 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer shadow-xs"
                        title={t("flyover_next") || "下一站"}
                    >
                        <SkipForward className="w-3.5 h-3.5" />
                        <span>{t("flyover_next") || "下一站"}</span>
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onCancel()
                        }}
                        className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title={t("flyover_stop") || "結束導覽"}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
