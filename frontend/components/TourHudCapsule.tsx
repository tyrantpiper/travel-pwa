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
                className="absolute top-3 left-3 right-3 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-30 bg-slate-950/80 dark:bg-black/85 backdrop-blur-2xl saturate-180 text-white rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-white/12 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-auto mx-auto sm:mx-0 pointer-events-auto select-none"
            >
                {/* Row 1: 景點資訊標題與微型關閉按鈕 */}
                <div className="flex items-center justify-between gap-2.5 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="flex h-6 px-2 shrink-0 items-center justify-center rounded-full bg-white/10 text-slate-200 border border-white/15 text-xs font-semibold tracking-wide shadow-xs">
                            {badgeText}
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <span
                                    className={`text-[11px] font-semibold uppercase tracking-wider truncate leading-tight ${
                                        isPaused
                                            ? "text-slate-300"
                                            : isOrbiting
                                            ? "text-indigo-300"
                                            : "text-slate-400"
                                    }`}
                                >
                                    {isPaused
                                        ? t("flyover_paused") || "⏸️ 導覽已暫停 (可自由瀏覽周邊)"
                                        : isOrbiting
                                        ? t("flyover_orbiting") || "🔄 360° 環繞盤旋中"
                                        : t("flyover_flying") || "✈️ 飛往此站中..."}
                                </span>
                            </div>
                            <h4 className="text-sm font-semibold text-slate-100 truncate leading-tight mt-0.5 tracking-tight">
                                {currentPOI.name || "景點"}
                            </h4>
                        </div>
                    </div>

                    {/* 右上角獨立關閉按鈕 */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onCancel()
                        }}
                        className="w-7 h-7 shrink-0 rounded-full bg-white/8 hover:bg-white/15 active:scale-90 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10 shadow-xs"
                        title={t("flyover_stop") || "結束導覽"}
                        aria-label={t("flyover_stop") || "結束導覽"}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Row 2: 獨立操作列 (Apple VisionOS 晶透極簡按鈕群) */}
                <div className="flex items-center gap-2 w-full pt-0.5">
                    {hasStreetView && onOpenStreetView && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onOpenStreetView(currentPOI.lat, currentPOI.lng)
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 px-2 bg-white/8 hover:bg-white/15 active:bg-white/20 text-slate-200 hover:text-white border border-white/10 rounded-xl text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-xs whitespace-nowrap"
                            title={t("mapillary_streetview") || "實景"}
                        >
                            <Camera className="w-3.5 h-3.5 text-emerald-400/90 shrink-0" />
                            <span className="truncate">{t("mapillary_streetview") || "實景"}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onTogglePause()
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 h-8 px-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs whitespace-nowrap ${
                            isPaused
                                ? "bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-950 border border-white shadow-md shadow-black/20"
                                : "bg-white/8 hover:bg-white/15 active:bg-white/20 text-slate-200 hover:text-white border border-white/10 font-medium"
                        }`}
                        title={isPaused ? t("flyover_resume") || "繼續" : t("flyover_pause") || "暫停"}
                    >
                        {isPaused ? (
                            <Play className="w-3.5 h-3.5 fill-current shrink-0 text-slate-950" />
                        ) : (
                            <Pause className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        )}
                        <span className="truncate">{isPaused ? t("flyover_resume") || "繼續" : t("flyover_pause") || "暫停"}</span>
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onSkipNext()
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 h-8 px-2 bg-white/8 hover:bg-white/15 active:bg-white/20 text-slate-200 hover:text-white border border-white/10 rounded-xl text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-xs whitespace-nowrap"
                        title={t("flyover_next") || "下一站"}
                    >
                        <SkipForward className="w-3.5 h-3.5 text-indigo-300/90 shrink-0" />
                        <span className="truncate">{t("flyover_next") || "下一站"}</span>
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
