"use client"

/**
 * 🆕 Project Silk Touch: PTR Visual Feedback Engine
 * Phase 4: State Machine + Visual Feedback
 * 
 * Features:
 * - 6-state machine (IDLE, PULLING, READY, REFRESHING, SUCCESS, ERROR)
 * - AnimatePresence icon transitions
 * - Status text feedback
 * - Haptic feedback (Android)
 * - 10s timeout protection
 */

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    ChevronDown,
    ArrowDown,
    RefreshCcw,
    Loader2,
    CheckCircle2,
    AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useHaptic } from "@/lib/hooks"
import { toast } from "sonner"
import { PTRStatus, PTRState, PTR_STATUS_CONFIG, PTRIconName } from "@/types/ptr"

// 🎨 Icon Mapping
const ICON_MAP: Record<PTRIconName, React.ComponentType<{ className?: string }>> = {
    'chevron-down': ChevronDown,
    'arrow-down': ArrowDown,
    'refresh-ccw': RefreshCcw,
    'loader-2': Loader2,
    'check-circle-2': CheckCircle2,
    'alert-circle': AlertCircle
}

interface PullToRefreshProps {
    children: React.ReactNode
    onRefresh: () => Promise<void>
    className?: string
    pullThreshold?: number
}

// 🎯 PTR 物理配置
const PTR_CONFIG = {
    threshold: 80,
    maxPull: 150,
    timeout: 10000,
    dampingZones: {
        light: { max: 60, resistance: 0.8 },
        medium: { max: 120, resistance: 0.5 },
        heavy: { max: 200, resistance: 0.25 }
    }
}

/**
 * 🔑 三階段非線性阻尼公式
 */
function calculateDampedTranslation(rawDiff: number): number {
    const { dampingZones, maxPull } = PTR_CONFIG

    if (rawDiff <= 0) return 0

    if (rawDiff <= dampingZones.light.max) {
        return rawDiff * dampingZones.light.resistance
    } else if (rawDiff <= dampingZones.medium.max) {
        const lightDistance = dampingZones.light.max * dampingZones.light.resistance
        const excessDiff = rawDiff - dampingZones.light.max
        return lightDistance + (excessDiff * dampingZones.medium.resistance)
    } else {
        const lightDistance = dampingZones.light.max * dampingZones.light.resistance
        const mediumDistance = (dampingZones.medium.max - dampingZones.light.max) * dampingZones.medium.resistance
        const baseDistance = lightDistance + mediumDistance
        const excessDiff = rawDiff - dampingZones.medium.max
        const heavyTranslation = excessDiff * dampingZones.heavy.resistance
        return Math.min(baseDistance + heavyTranslation, maxPull)
    }
}

export function PullToRefresh({ children, onRefresh, className, pullThreshold = PTR_CONFIG.threshold }: PullToRefreshProps) {
    const haptic = useHaptic()

    // 🔑 單一 State Object（避免雙重渲染）
    const [ptrState, setPtrState] = useState<PTRState>({
        status: PTRStatus.IDLE,
        pullDistance: 0
    })

    const containerRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)  // 🆕 Content ref for will-change control
    const startY = useRef(0)
    const startX = useRef(0)
    const isPulling = useRef(false)
    const rafId = useRef<number | null>(null)
    const ticking = useRef(false)
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const prevStatusRef = useRef<PTRStatus>(PTRStatus.IDLE)
    const willChangeApplied = useRef(false)  // 🆕 動態 will-change 控制

    // 🎯 狀態計算邏輯
    const calculateStatus = (distance: number): PTRStatus => {
        if (distance < pullThreshold * 0.3) return PTRStatus.IDLE
        if (distance < pullThreshold) return PTRStatus.PULLING
        return PTRStatus.READY
    }

    // 🎬 Reset position
    const resetPosition = () => {
        setPtrState({
            status: PTRStatus.IDLE,
            pullDistance: 0
        })
        prevStatusRef.current = PTRStatus.IDLE
    }

    // 🆕 使用原生事件監聯器
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleNativeTouchStart = (e: TouchEvent) => {
            // 🛡️ Guard: 不在頂部時不啟用 PTR
            if (window.scrollY > 0 || container.scrollTop > 0) {
                isPulling.current = false
                return
            }

            // 🛡️ Guard: 正在刷新或顯示結果時不允許新的拖曳
            if (ptrState.status === PTRStatus.REFRESHING ||
                ptrState.status === PTRStatus.SUCCESS ||
                ptrState.status === PTRStatus.ERROR) {
                isPulling.current = false
                return
            }

            const touch = e.touches[0]
            startY.current = touch.clientY
            startX.current = touch.clientX
            isPulling.current = true

            // 🆕 動態啟用 will-change（只在拖動時開啟）
            if (!willChangeApplied.current && contentRef.current) {
                contentRef.current.style.willChange = 'transform'
                willChangeApplied.current = true
            }
        }

        const handleNativeTouchMove = (e: TouchEvent) => {
            if (window.scrollY > 0 || container.scrollTop > 0) {
                if (isPulling.current) {
                    isPulling.current = false
                    resetPosition()
                }
                return
            }

            if (!isPulling.current) return

            // 正在刷新時不處理
            if (ptrState.status === PTRStatus.REFRESHING ||
                ptrState.status === PTRStatus.SUCCESS ||
                ptrState.status === PTRStatus.ERROR) {
                return
            }

            const touch = e.touches[0]
            const diffY = touch.clientY - startY.current
            const diffX = Math.abs(touch.clientX - startX.current)

            // 🛡️ Guard: 水平滑動優先
            if (diffX > Math.abs(diffY) * 1.5) {
                isPulling.current = false
                resetPosition()
                return
            }

            // 🛡️ Guard: 只處理下拉
            if (diffY <= 0) {
                isPulling.current = false
                resetPosition()
                return
            }

            e.preventDefault()

            // ⚡ RAF 節流
            if (!ticking.current) {
                rafId.current = requestAnimationFrame(() => {
                    // 🔥 關鍵：Math.round 消除亞像素抖動
                    const dampedY = Math.round(calculateDampedTranslation(diffY))
                    const newStatus = calculateStatus(dampedY)

                    // 🔔 Haptic: READY 狀態時震動一次
                    if (newStatus === PTRStatus.READY && prevStatusRef.current !== PTRStatus.READY) {
                        haptic.tap()
                    }

                    prevStatusRef.current = newStatus

                    setPtrState({
                        status: newStatus,
                        pullDistance: dampedY
                    })

                    ticking.current = false
                })
                ticking.current = true
            }
        }

        const handleNativeTouchEnd = async () => {
            if (!isPulling.current) return
            isPulling.current = false

            if (rafId.current) {
                cancelAnimationFrame(rafId.current)
                rafId.current = null
            }
            ticking.current = false

            // 🆕 觸控結束後延遲移除 will-change（等待回彈動畫完成）
            setTimeout(() => {
                if (contentRef.current) {
                    contentRef.current.style.willChange = 'auto'
                }
                willChangeApplied.current = false
            }, 300)

            const { status, pullDistance } = ptrState

            // 🚀 觸發刷新
            if (status === PTRStatus.READY) {
                setPtrState({
                    status: PTRStatus.REFRESHING,
                    pullDistance: 50  // 保持 loading 位置
                })
                prevStatusRef.current = PTRStatus.REFRESHING

                try {
                    await Promise.race([
                        onRefresh(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('timeout')), PTR_CONFIG.timeout)
                        )
                    ])

                    // ✅ Success
                    setPtrState({
                        status: PTRStatus.SUCCESS,
                        pullDistance: 50
                    })
                    prevStatusRef.current = PTRStatus.SUCCESS
                    haptic.success()

                    // 1.5s 後重置
                    resetTimeoutRef.current = setTimeout(() => {
                        resetPosition()
                    }, 1500)

                } catch (error) {
                    // ❌ Error
                    setPtrState({
                        status: PTRStatus.ERROR,
                        pullDistance: 50
                    })
                    prevStatusRef.current = PTRStatus.ERROR

                    if (error instanceof Error && error.message === 'timeout') {
                        toast.error('網路逾時，請稍後再試')
                    }
                    haptic.error()

                    // 2s 後重置
                    resetTimeoutRef.current = setTimeout(() => {
                        resetPosition()
                    }, 2000)
                }
            } else {
                // 未達閾值，直接重置
                resetPosition()
            }
        }

        container.addEventListener('touchstart', handleNativeTouchStart, { passive: true })
        container.addEventListener('touchmove', handleNativeTouchMove, { passive: false })
        container.addEventListener('touchend', handleNativeTouchEnd, { passive: true })

        return () => {
            if (rafId.current) {
                cancelAnimationFrame(rafId.current)
            }
            if (resetTimeoutRef.current) {
                clearTimeout(resetTimeoutRef.current)
            }
            container.removeEventListener('touchstart', handleNativeTouchStart)
            container.removeEventListener('touchmove', handleNativeTouchMove)
            container.removeEventListener('touchend', handleNativeTouchEnd)
        }
    }, [pullThreshold, onRefresh, haptic])  // 🔧 FIX: 移除 ptrState.status 依賴，避免 cleanup 清除 timeout

    // 🆕 獨立的 SUCCESS/ERROR 重置 useEffect
    useEffect(() => {
        if (ptrState.status === PTRStatus.SUCCESS) {
            const timer = setTimeout(() => {
                resetPosition()
            }, 1500)
            return () => clearTimeout(timer)
        }
        if (ptrState.status === PTRStatus.ERROR) {
            const timer = setTimeout(() => {
                resetPosition()
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [ptrState.status])

    // 🎨 當前配置
    const config = PTR_STATUS_CONFIG[ptrState.status]
    const Icon = ICON_MAP[config.icon]
    const progress = Math.min(ptrState.pullDistance / pullThreshold, 1)
    // 🔧 FIX: IDLE 狀態且 pullDistance 為 0 時完全隱藏
    const isVisible = ptrState.status !== PTRStatus.IDLE || ptrState.pullDistance > 0
    const opacity = isVisible ? Math.min(progress * 2, 1) : 0

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative overflow-auto",
                "overscroll-y-contain",
                "touch-pan-y",
                className
            )}
            style={{
                WebkitOverflowScrolling: 'touch',
                // 🆕 GPU 加速基礎
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden'
            }}
        >
            {/* 🎯 Indicator */}
            <div
                className={cn(
                    "absolute left-1/2 -translate-x-1/2 z-10",
                    "flex flex-col items-center gap-2",
                    "pointer-events-none",
                    "transition-all duration-150"
                )}
                style={{
                    // 🔧 FIX: SUCCESS/ERROR 狀態時隱藏 indicator（已有 toast 提示）
                    // PULLING/READY 狀態時置中於下拉空間
                    top: (ptrState.status === PTRStatus.SUCCESS || ptrState.status === PTRStatus.ERROR)
                        ? -80  // 隱藏在視窗外
                        : Math.max(ptrState.pullDistance / 2 - 30, -60),
                    opacity: (ptrState.status === PTRStatus.SUCCESS || ptrState.status === PTRStatus.ERROR)
                        ? 0  // 完全透明
                        : opacity
                }}
            >
                {/* 🎨 Icon Container */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={ptrState.status}
                        initial={{ scale: 0.5, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0.5, rotate: 180 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className={cn(
                            "w-12 h-12 rounded-full bg-white shadow-lg border border-slate-100",
                            "flex items-center justify-center",
                            config.color
                        )}
                    >
                        <Icon
                            className={cn(
                                "w-6 h-6",
                                config.spin && "animate-spin"
                            )}
                        />
                    </motion.div>
                </AnimatePresence>

                {/* 📝 Text */}
                <AnimatePresence mode="wait">
                    {config.text && (
                        <motion.p
                            key={ptrState.status}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                                "text-sm font-medium whitespace-nowrap",
                                config.color
                            )}
                        >
                            {config.text}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>

            {/* 📜 Content with transform (GPU 加速) */}
            <div
                ref={contentRef}
                className="transition-transform duration-150"
                style={{
                    // 🔥 關鍵：translate3d 強制 GPU + Math.round 消除亞像素
                    transform: `translate3d(0, ${Math.round(ptrState.pullDistance)}px, 0)`,
                    backfaceVisibility: 'hidden'
                }}
            >
                {children}
            </div>

            {/* 🆕 Accessibility: Screen Reader 替代操作 */}
            <button
                onClick={async () => {
                    if (ptrState.status === PTRStatus.REFRESHING) return

                    setPtrState({
                        status: PTRStatus.REFRESHING,
                        pullDistance: 0
                    })

                    try {
                        await onRefresh()
                        setPtrState({
                            status: PTRStatus.SUCCESS,
                            pullDistance: 0
                        })
                        setTimeout(resetPosition, 1500)
                    } catch {
                        setPtrState({
                            status: PTRStatus.ERROR,
                            pullDistance: 0
                        })
                        setTimeout(resetPosition, 2000)
                    }
                }}
                aria-label="重新整理頁面"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-1/2 focus:-translate-x-1/2 focus:z-20 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
            >
                重新整理
            </button>
        </div >
    )
}
