import React, { useState, useEffect, useCallback } from "react"
import { Globe, Crosshair, Loader2, Compass } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/LanguageContext"

export interface MapControlCapsuleProps {
    /** 🌐 3D 地球儀 / 2D 平面投影狀態 */
    isGlobe: boolean
    /** 切換地球儀與平面投影 */
    onToggleGlobe: (e: React.MouseEvent) => void

    /** 📍 GPS 定位載入狀態 */
    isLocating: boolean
    /** 觸發 GPS 定位到使用者位置 */
    onLocateMe: (e: React.MouseEvent) => void

    /** 🧭 羅盤正北歸零與全景置中操作 */
    onCompassReset: (e: React.MouseEvent) => void
    /** 羅盤按鈕自訂提示文字 (可選) */
    compassTitle?: string

    /** ✈️ 3D 航線巡航進行中 (巡航時完全隱藏) */
    isTouring?: boolean

    /** 🗺️ 地圖當前是否處於平移/縮放手勢中 (由地圖 onMoveStart / onMoveEnd 驅動) */
    isMapMoving?: boolean

    /** ⏱️ 降敏延遲緩衝時長 (毫秒，預設 3000ms) */
    idleTimeoutMs?: number

    /** 額外自訂 CSS 類別 */
    className?: string
}

/**
 * 🧭📍🌐 MapControlCapsule
 * 統一封裝地圖右上角 Liquid Glass 懸浮控制膠囊
 * 繼承 Ryan AI 聊天機器人的 isIdle 呼吸降敏（Idle Dimming）機制：
 * - 靜止 3 秒無操作自動降低亮度至 25% 晶透幽靈態
 * - 地圖滑動、游標 Hover、手指碰觸瞬間點亮至 100% 飽和高亮態
 */
export function MapControlCapsule({
    isGlobe,
    onToggleGlobe,
    isLocating,
    onLocateMe,
    onCompassReset,
    compassTitle,
    isTouring = false,
    isMapMoving = false,
    idleTimeoutMs = 3000,
    className
}: MapControlCapsuleProps) {
    const { t, lang } = useLanguage()
    const zh = lang === "zh"

    // 🤖 呼吸降敏狀態 (對齊 ChatWidget isIdle DNA)
    const [isIdle, setIsIdle] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [wakeKey, setWakeKey] = useState(0)

    // 響應地圖手勢與非同步降敏排程 (杜絕 effect 同步 setState 引發 cascading render)
    useEffect(() => {
        if (isMapMoving || isHovered) {
            const wakeTimer = setTimeout(() => {
                setIsIdle(false)
            }, 0)
            return () => clearTimeout(wakeTimer)
        }

        const idleTimer = setTimeout(() => {
            setIsIdle(true)
        }, idleTimeoutMs)

        return () => clearTimeout(idleTimer)
    }, [isMapMoving, isHovered, wakeKey, idleTimeoutMs])

    // 滑鼠 Hover 處理 (Touch-Safe：僅對 mouse 指針生效，防止行動端 Sticky Hover)
    const handlePointerEnter = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === "mouse") {
            setIsHovered(true)
        }
    }, [])

    const handlePointerLeave = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === "mouse") {
            setIsHovered(false)
        }
    }, [])

    // 手指觸控或點擊喚醒
    const handleTouchWake = useCallback(() => {
        setIsIdle(false)
        setWakeKey((k) => k + 1)
    }, [])

    const defaultCompassTitle = zh ? "全景置中 (正北歸零)" : "Fit Bounds and Reset North"
    const isVisibleAwake = !isIdle || isMapMoving || isHovered

    return (
        <div
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
            onPointerDown={(e) => { e.stopPropagation(); handleTouchWake(); }}
            onTouchStart={(e) => { e.stopPropagation(); handleTouchWake(); }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className={cn(
                "absolute top-3 right-3 z-10 flex flex-col items-center gap-1.5 p-1 rounded-2xl pointer-events-auto select-none",
                "transform-gpu will-change-transform transition-all duration-300 ease-out",
                "backdrop-blur-xl saturate-180 border border-white/50 dark:border-slate-700/60",
                isTouring ? "opacity-0 pointer-events-none scale-90 -translate-y-2" : (
                    !isVisibleAwake
                        ? "opacity-25 hover:opacity-100 scale-95 bg-white/40 dark:bg-slate-900/40 shadow-sm"
                        : "opacity-100 scale-100 bg-white/85 dark:bg-slate-900/85 shadow-[inset_0_1.5px_1px_0_rgba(255,255,255,0.9),0_8px_24px_rgba(0,0,0,0.12)]"
                ),
                className
            )}
        >
            {/* 🌐 3D 地球儀 / 2D 平面切換 */}
            <button
                type="button"
                onClick={(e) => {
                    handleTouchWake()
                    onToggleGlobe(e)
                }}
                className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/80 transition-all active:scale-88 active:rounded-2xl cursor-pointer"
                title={isGlobe ? (zh ? "切換至平面地圖" : "Switch to 2D Mercator") : (zh ? "切換至 3D 地球儀" : "Switch to 3D Globe")}
                aria-label="Toggle Globe Projection"
            >
                <Globe className={cn("w-4 h-4 transition-colors", isGlobe ? "text-sky-500 dark:text-sky-400" : "text-slate-600 dark:text-slate-300")} />
            </button>

            <div className="w-3.5 h-px bg-slate-200/80 dark:bg-slate-800/80 shadow-[inset_0_1px_0_rgba(0,0,0,0.05)]" />

            {/* 📍 GPS 定位到我按鈕 */}
            <button
                type="button"
                onClick={(e) => {
                    handleTouchWake()
                    onLocateMe(e)
                }}
                disabled={isLocating}
                className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/80 transition-all active:scale-88 active:rounded-2xl cursor-pointer disabled:opacity-50"
                title={t('map_my_location') || (zh ? "我的位置" : "My Location")}
                aria-label="Locate Me"
            >
                {isLocating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                ) : (
                    <Crosshair className="w-4 h-4 text-indigo-500" />
                )}
            </button>

            <div className="w-3.5 h-px bg-slate-200/80 dark:bg-slate-800/80 shadow-[inset_0_1px_0_rgba(0,0,0,0.05)]" />

            {/* 🧭 羅盤 / 視角聚焦 */}
            <button
                type="button"
                onClick={(e) => {
                    handleTouchWake()
                    onCompassReset(e)
                }}
                className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/80 transition-all active:scale-88 active:rounded-2xl cursor-pointer"
                title={compassTitle || defaultCompassTitle}
                aria-label="Fit Bounds and Reset North"
            >
                <Compass className="w-4 h-4 text-indigo-500" />
            </button>
        </div>
    )
}

export default MapControlCapsule
