"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Sparkles,
    Calendar,
    Bot,
    Compass,
    Wrench,
    Rocket,
    X,
    ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/LanguageContext"
import { useOnboardingStore } from "@/lib/stores/onboardingStore"
import { useHaptic } from "@/lib/hooks"
import { cn } from "@/lib/utils"
import type { TranslationKey } from "@/lib/i18n"

interface TourStepConfig {
    id: string
    selector: string
    icon: React.ComponentType<{ className?: string }>
    titleKey: TranslationKey
    descKey: TranslationKey
    actionKey: TranslationKey
    preferredSide: "top" | "bottom" | "center"
}

const TOUR_STEPS: TourStepConfig[] = [
    {
        id: "ai-status",
        selector: "#tour-ai-status",
        icon: Sparkles,
        titleKey: "tour_step1_title",
        descKey: "tour_step1_desc",
        actionKey: "tour_step1_action",
        preferredSide: "bottom",
    },
    {
        id: "ai-bot",
        selector: "#tour-ai-bot",
        icon: Bot,
        titleKey: "tour_step2_title",
        descKey: "tour_step2_desc",
        actionKey: "tour_step2_action",
        preferredSide: "top",
    },
    {
        id: "create-trip",
        selector: "#tour-create-trip",
        icon: Calendar,
        titleKey: "tour_step3_title",
        descKey: "tour_step3_desc",
        actionKey: "tour_step3_action",
        preferredSide: "bottom",
    },
    {
        id: "sample-trip",
        selector: "#tour-sample-trip",
        icon: Compass,
        titleKey: "tour_step4_title",
        descKey: "tour_step4_desc",
        actionKey: "tour_step4_action",
        preferredSide: "bottom",
    },
    {
        id: "nav-tools",
        selector: "#tour-nav-tools",
        icon: Wrench,
        titleKey: "tour_step5_title",
        descKey: "tour_step5_desc",
        actionKey: "tour_step5_action",
        preferredSide: "top",
    },
    {
        id: "celebrate",
        selector: "#tour-celebrate",
        icon: Rocket,
        titleKey: "tour_step6_title",
        descKey: "tour_step6_desc",
        actionKey: "tour_step6_action",
        preferredSide: "center",
    },
]

// 🎯 定位與收斂穩定性常數定義 (Zero Magic Numbers)
const CARD_MAX_WIDTH = 340
const CARD_HORIZONTAL_PADDING = 32
const TARGET_PADDING = 4
const MIN_OBSERVATION_MS = 180
const MAX_TRACKING_TIMEOUT_MS = 600
const STABLE_FRAME_CONVERGENCE = 4
const VELOCITY_TOLERANCE_PX = 0.5

export function SpotlightTour() {
    const { t } = useLanguage()
    const haptic = useHaptic()
    const {
        isTourActive,
        currentTourStep,
        nextTourStep,
        skipTour,
        completeTour,
    } = useOnboardingStore()

    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
    const [targetRadius, setTargetRadius] = useState<number>(16)
    const [isReady, setIsReady] = useState(false)
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
    const [hasActiveDialog, setHasActiveDialog] = useState(false)
    const trackingRafRef = useRef<number | null>(null)
    const stepAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)

    const step = TOUR_STEPS[currentTourStep] || TOUR_STEPS[0]
    const totalSteps = TOUR_STEPS.length
    const isLastStep = currentTourStep === totalSteps - 1

    // 清理非同步計時器防止記憶體洩漏
    useEffect(() => {
        return () => {
            if (stepAdvanceTimerRef.current) {
                clearTimeout(stepAdvanceTimerRef.current)
            }
        }
    }, [])

    // 視窗尺寸追蹤
    useEffect(() => {
        const updateSize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            })
        }

        updateSize()
        window.addEventListener("resize", updateSize)
        return () => window.removeEventListener("resize", updateSize)
    }, [])

    // 🎯 目標元素真實 CSS 圓角動態提取（精準匹配正圓與同心圓角卡片）
    const extractRadius = useCallback((el: Element, width: number, height: number): number => {
        try {
            const computed = window.getComputedStyle(el)
            const maxPossible = Math.min(width, height) / 2
            if (computed.borderRadius.includes("9999") || computed.borderRadius.includes("50%")) {
                return maxPossible
            }
            const raw = parseFloat(computed.borderRadius) || 16
            if (raw >= maxPossible) return maxPossible
            return Math.min(maxPossible, Math.max(8, raw + 4))
        } catch {
            return 16
        }
    }, [])

    // 🎯 任務感應 1: 監聽全域 Dialog 開關，開啟時隱藏聚光燈（掛載時立即執行一次）
    useEffect(() => {
        if (!isTourActive) return

        const checkDialog = () => {
            const activeModal = document.querySelector('[role="dialog"][data-state="open"]')
            setHasActiveDialog(!!activeModal && activeModal.getAttribute("data-testid") !== "spotlight-tour-overlay")
        }

        checkDialog()
        const observer = new MutationObserver(checkDialog)
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] })
        return () => observer.disconnect()
    }, [isTourActive])

    // 🎯 任務感應 2: Step 2 (建立行程) 進入時確保處於清單檢視
    useEffect(() => {
        if (!isTourActive || currentTourStep !== 2) return

        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("tabidachi-reset-itinerary-view"))
        }
    }, [isTourActive, currentTourStep])

    // 🎯 任務感應 3: Step 4 (工具箱) 監聽 tabidachi-tab-changed 自動推進（附帶 Timer 釋放）
    useEffect(() => {
        if (!isTourActive) return
        let tabTimer: NodeJS.Timeout | null = null

        const handleTabChanged = (e: Event) => {
            const tab = (e as CustomEvent).detail
            if (currentTourStep === 4 && tab === "tools") {
                haptic.selection()
                tabTimer = setTimeout(() => nextTourStep(totalSteps), 300)
            }
        }

        window.addEventListener("tabidachi-tab-changed", handleTabChanged)
        return () => {
            if (tabTimer) clearTimeout(tabTimer)
            window.removeEventListener("tabidachi-tab-changed", handleTabChanged)
        }
    }, [isTourActive, currentTourStep, nextTourStep, totalSteps, haptic])

    // 🎯 目標節點探測與即時定位更新
    const updateTargetPosition = useCallback(() => {
        if (!isTourActive) return

        if (step.preferredSide === "center") {
            setTargetRect(null)
            setTargetRadius(16)
            setIsReady(true)
            return
        }

        const el = document.querySelector(step.selector)
        if (el) {
            const rect = el.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
                setTargetRect(rect)
                setTargetRadius(extractRadius(el, rect.width, rect.height))
                setIsReady(true)
                return
            }
        }

        setTargetRect(null)
    }, [isTourActive, step, extractRadius])

    // 🎯 速度收斂穩定追蹤引擎（180ms 最小觀察窗 + 連續 4 幀位移差 < 0.5px，徹底消除頁面切換殘影）
    useEffect(() => {
        if (!isTourActive) return

        let cancelled = false
        const startTime = performance.now()
        let stableFrames = 0
        let prevRect: DOMRect | null = null

        const poll = () => {
            if (cancelled) return
            const el = document.querySelector(step.selector)
            if (el) {
                const rect = el.getBoundingClientRect()
                if (rect.width > 0 && rect.height > 0) {
                    const elapsed = performance.now() - startTime
                    if (prevRect) {
                        const dx = Math.abs(rect.left - prevRect.left)
                        const dy = Math.abs(rect.top - prevRect.top)
                        if (dx < VELOCITY_TOLERANCE_PX && dy < VELOCITY_TOLERANCE_PX && elapsed > MIN_OBSERVATION_MS) {
                            stableFrames++
                        } else {
                            stableFrames = 0
                        }
                    }
                    prevRect = rect
                    setTargetRect(rect)
                    setTargetRadius(extractRadius(el, rect.width, rect.height))
                    setIsReady(true)

                    if (stableFrames >= STABLE_FRAME_CONVERGENCE || elapsed > MAX_TRACKING_TIMEOUT_MS) {
                        return // 🎯 動畫完全收斂，結束追蹤鎖定精準座標
                    }
                }
            } else if (performance.now() - startTime >= MAX_TRACKING_TIMEOUT_MS) {
                setTargetRect(null)
                setIsReady(true)
                return
            }

            trackingRafRef.current = requestAnimationFrame(poll)
        }

        trackingRafRef.current = requestAnimationFrame(() => {
            if (cancelled) return
            setIsReady(false)
            poll()
        })

        return () => {
            cancelled = true
            if (trackingRafRef.current) {
                cancelAnimationFrame(trackingRafRef.current)
            }
        }
    }, [isTourActive, currentTourStep, step, extractRadius])

    // 當捲動或變更大小時同步校正孔洞
    useEffect(() => {
        if (!isTourActive) return
        const handleScroll = () => {
            updateTargetPosition()
        }
        window.addEventListener("scroll", handleScroll, true)
        return () => window.removeEventListener("scroll", handleScroll, true)
    }, [isTourActive, updateTargetPosition])

    // 推進下一步
    const handleNext = () => {
        haptic.selection()
        if (isLastStep) {
            completeTour()
        } else {
            nextTourStep(totalSteps)
        }
    }

    // 🎯 原生動作穿透轉發引擎：優先委託主業務按鈕，嚴格排除紅色刪除按鈕防誤觸
    const triggerNativeAction = useCallback((selector: string) => {
        const container = document.querySelector(selector)
        if (!container) return
        const primaryBtn = container.querySelector<HTMLElement>("[data-tour-action='primary']")
        if (primaryBtn) {
            primaryBtn.click()
            return
        }
        const clickable = container.matches("button:not(.bg-red-500), a, [role='button']")
            ? container
            : container.querySelector<HTMLElement>("button:not(.bg-red-500):not([variant='destructive']), a, [role='button']") || container
        ;(clickable as HTMLElement).click()
    }, [])

    // 點擊高亮目標（真實觸發底層按鈕／開啟 Dialog／切換 Tab／探索範例行程）
    const handleTargetClick = () => {
        haptic.tap()
        if (step.selector) {
            triggerNativeAction(step.selector)
        }
        // 若為 Step 3 (探索範例行程)，點擊卡片後自動平滑推進至 Step 4
        if (currentTourStep === 3) {
            if (stepAdvanceTimerRef.current) clearTimeout(stepAdvanceTimerRef.current)
            stepAdvanceTimerRef.current = setTimeout(() => {
                nextTourStep(totalSteps)
            }, 400)
        }
    }

    // 氣泡位置與翻轉計算 (Placement & Flip Calculation)
    const tooltipPosition = useMemo(() => {
        if (!targetRect || step.preferredSide === "center") {
            return {
                top: Math.max(20, windowSize.height / 2 - 120),
                bottom: undefined,
                left: Math.max(16, (windowSize.width - CARD_MAX_WIDTH) / 2),
                maxHeight: Math.min(360, windowSize.height - 40),
                arrow: "none" as const,
                arrowLeft: undefined,
            }
        }

        const CARD_WIDTH = Math.min(CARD_MAX_WIDTH, windowSize.width - CARD_HORIZONTAL_PADDING)
        const PADDING = 12

        // 計算水平居中與邊界夾緊
        const targetCenterX = targetRect.left + targetRect.width / 2
        let left = targetCenterX - CARD_WIDTH / 2
        left = Math.max(16, Math.min(left, windowSize.width - CARD_WIDTH - 16))

        // 🎯 動態箭頭相對於卡片左側的像素位置（保證精確指向目標中心且不溢出圓角）
        const arrowLeft = Math.max(24, Math.min(CARD_WIDTH - 24, targetCenterX - left))

        // 垂直翻轉與空間評估：優先尊重 preferredSide，但在空間極端不足時智慧動態反轉
        const spaceAbove = targetRect.top
        const spaceBelow = windowSize.height - targetRect.bottom

        const shouldShowAbove =
            step.preferredSide === "top"
                ? spaceAbove >= 180 || spaceAbove >= spaceBelow
                : targetRect.top > windowSize.height / 2 && spaceAbove >= 180

        if (shouldShowAbove) {
            // 🛡️ 剛性底線 1：卡片底緣必須距目標頂端嚴格保留 PADDING 間隔，絕對不可透過 Math.min 下壓！
            const bottom = windowSize.height - targetRect.top + PADDING
            // 🛡️ 頂部保護：卡片最大高度為頂部邊界到目標邊界的實際剩餘高度（保留 20px 頂部間距）
            const maxHeight = Math.max(150, targetRect.top - PADDING - 20)

            return { top: undefined, bottom, left, maxHeight, arrow: "down" as const, arrowLeft }
        } else {
            // 🛡️ 剛性底線 2：卡片頂緣必須距目標底端嚴格保留 PADDING 間隔
            const top = targetRect.bottom + PADDING
            const maxHeight = Math.max(150, windowSize.height - targetRect.bottom - PADDING - 20)

            return { top, bottom: undefined, left, maxHeight, arrow: "up" as const, arrowLeft }
        }
    }, [targetRect, windowSize, step])

    if (!isTourActive) return null

    const StepIcon = step.icon
    const padding = TARGET_PADDING
    const holeX = targetRect ? Math.max(0, targetRect.left - padding) : 0
    const holeY = targetRect ? Math.max(0, targetRect.top - padding) : 0
    const holeWidth = targetRect ? targetRect.width + padding * 2 : 0
    const holeHeight = targetRect ? targetRect.height + padding * 2 : 0

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-200 overflow-hidden select-none"
                data-testid="spotlight-tour-overlay"
                role="dialog"
                aria-modal="true"
                aria-label={t(step.titleKey)}
            >
                {/* 🌑 1. SVG 聚光燈遮罩 (Dark Backdrop with Animated Cutout) */}
                <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    width="100%"
                    height="100%"
                >
                    <defs>
                        <mask id="tabidachi-spotlight-mask">
                            {/* 白色全螢幕底層 */}
                            <rect width="100%" height="100%" fill="white" />
                            {/* 黑色挖孔矩形（動態圓角與形變平滑過渡） */}
                            {targetRect && (
                                <motion.rect
                                    initial={false}
                                    animate={{
                                        x: holeX,
                                        y: holeY,
                                        width: holeWidth,
                                        height: holeHeight,
                                        rx: targetRadius,
                                        ry: targetRadius,
                                    }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 380,
                                        damping: 32,
                                    }}
                                    fill="black"
                                />
                            )}
                        </mask>
                    </defs>
                    <rect
                        width="100%"
                        height="100%"
                        fill="rgba(15, 23, 42, 0.78)"
                        mask="url(#tabidachi-spotlight-mask)"
                    />
                </svg>

                {/* 💫 2. 目標元素呼吸光環與可觸發區 (Pulsing Focal Ring) */}
                {targetRect && (
                    <motion.div
                        initial={false}
                        animate={{
                            left: holeX,
                            top: holeY,
                            width: holeWidth,
                            height: holeHeight,
                            borderRadius: `${targetRadius}px`,
                        }}
                        transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 32,
                        }}
                        onClick={handleTargetClick}
                        className="absolute ring-4 ring-indigo-500/50 shadow-[0_0_24px_rgba(99,102,241,0.6)] cursor-pointer z-201 transition-all active:scale-98"
                        style={{ pointerEvents: "auto", borderRadius: `${targetRadius}px` }}
                        title={t("tour_next")}
                    >
                        <div 
                            style={{ borderRadius: `${targetRadius}px` }}
                            className="absolute inset-0 animate-ping opacity-30 ring-2 ring-indigo-400 pointer-events-none" 
                        />
                    </motion.div>
                )}

                {/* 💬 3. 浮動說明卡片 (Floating Tooltip Popover) */}
                {isReady && (
                    <motion.div
                        key={step.id}
                        initial={{ opacity: 0, scale: 0.92, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: -8 }}
                        transition={{ type: "spring", stiffness: 420, damping: 28 }}
                        style={{
                            top: tooltipPosition.top !== undefined ? `${tooltipPosition.top}px` : undefined,
                            bottom: tooltipPosition.bottom !== undefined ? `${tooltipPosition.bottom}px` : undefined,
                            left: `${tooltipPosition.left}px`,
                            width: Math.min(340, windowSize.width - 32),
                            maxHeight: tooltipPosition.maxHeight !== undefined ? `${tooltipPosition.maxHeight}px` : undefined,
                            pointerEvents: "auto",
                        }}
                        className={cn(
                            "absolute z-202 flex flex-col transition-opacity duration-200",
                            hasActiveDialog && "opacity-0 pointer-events-none"
                        )}
                    >
                        {/* 內層卡片容器（背景、毛玻璃、圓角與安全滾動，不影響外層箭頭） */}
                        <div className="relative w-full h-full overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl p-3.5 shadow-2xl border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 flex flex-col">
                            {/* 卡片標頭列 */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                                        <StepIcon className="w-4 h-4" />
                                    </div>
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                                        {t("tour_step")} {currentTourStep + 1} {t("tour_of")}{" "}
                                        {totalSteps}
                                    </span>
                                </div>

                                {/* 逃生跳過按鈕 */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        haptic.tap()
                                        skipTour()
                                    }}
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    aria-label={t("tour_skip")}
                                    title={t("tour_skip")}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* 主標題 */}
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
                                {t(step.titleKey)}
                            </h4>

                            {/* 說明內文 */}
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5">
                                {t(step.descKey)}
                            </p>

                            {/* 行動引導提示 (Call-to-Action) */}
                            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl px-2.5 py-1.5 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium mb-3 border border-indigo-100/60 dark:border-indigo-900/40 flex items-center gap-1.5">
                                <span className="leading-snug">{t(step.actionKey)}</span>
                            </div>

                            {/* 控制工具列 */}
                            <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800 mt-auto">
                                {/* 點狀進度指示 */}
                                <div className="flex items-center gap-1.5 px-1">
                                    {TOUR_STEPS.map((s, idx) => (
                                        <div
                                            key={s.id}
                                            className={cn(
                                                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                                idx === currentTourStep
                                                    ? "w-4 bg-indigo-600 dark:bg-indigo-400"
                                                    : idx < currentTourStep
                                                      ? "bg-slate-300 dark:bg-slate-600"
                                                      : "bg-slate-200 dark:bg-slate-700"
                                            )}
                                        />
                                    ))}
                                </div>

                                {/* 前進按鈕 */}
                                <Button
                                    size="sm"
                                    onClick={handleNext}
                                    className="h-8 px-3.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all active:scale-95 gap-1"
                                >
                                    {isLastStep ? (
                                        <>
                                            <Rocket className="w-3.5 h-3.5" />
                                            <span>{t("tour_finish")}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{t("tour_next")}</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* 指向箭頭 (Directional Arrow - 置於外層不受裁切) */}
                        {tooltipPosition.arrow === "up" && (
                            <div
                                style={{ left: tooltipPosition.arrowLeft !== undefined ? `${tooltipPosition.arrowLeft}px` : "50%" }}
                                className="absolute -top-1.5 -translate-x-1/2 w-3.5 h-3.5 bg-white dark:bg-slate-900 rotate-45 border-t border-l border-slate-200/80 dark:border-slate-700/80 pointer-events-none"
                            />
                        )}
                        {tooltipPosition.arrow === "down" && (
                            <div
                                style={{ left: tooltipPosition.arrowLeft !== undefined ? `${tooltipPosition.arrowLeft}px` : "50%" }}
                                className="absolute -bottom-1.5 -translate-x-1/2 w-3.5 h-3.5 bg-white dark:bg-slate-900 rotate-45 border-b border-r border-slate-200/80 dark:border-slate-700/80 pointer-events-none"
                            />
                        )}
                    </motion.div>
                )}
            </div>
        </AnimatePresence>
    )
}
