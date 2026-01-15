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

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from "react"
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
import { CircularProgress } from "./circular-progress"

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
    /**
     * Optional: The element that actually scrolls.
     * If provided, we check THIS element's scrollTop instead of the direct container.
     * Supports both RefObject (useRef) and HTMLElement (state-based ref).
     */
    scrollableRef?: React.RefObject<HTMLElement | null> | HTMLElement | null | undefined
}

export interface PullToRefreshHandle {
    container: HTMLDivElement | null
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

export const PullToRefresh = forwardRef<HTMLDivElement, PullToRefreshProps>(({ children, onRefresh, className, pullThreshold = PTR_CONFIG.threshold, scrollableRef }, ref) => {
    const haptic = useHaptic()

    // 🔑 單一 State Object（避免雙重渲染）
    const [ptrState, setPtrState] = useState<PTRState>({
        status: PTRStatus.IDLE,
        pullDistance: 0
    })

    const internalContainerRef = useRef<HTMLDivElement>(null)
    // Expose internal ref to parent
    useImperativeHandle(ref, () => internalContainerRef.current!)

    const containerRef = internalContainerRef
    const contentRef = useRef<HTMLDivElement>(null)
    const startY = useRef(0)
    const startX = useRef(0)
    const isPulling = useRef(false)
    const rafId = useRef<number | null>(null)
    const ticking = useRef(false)
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const prevStatusRef = useRef<PTRStatus>(PTRStatus.IDLE)
    const statusRef = useRef<PTRStatus>(PTRStatus.IDLE)
    const willChangeApplied = useRef(false)

    // 🔧 每次 render 同步 status 到 ref（避免閉包陳舊）
    useEffect(() => {
        statusRef.current = ptrState.status
    }, [ptrState.status])

    // 🎯 狀態計算邏輯
    const calculateStatus = useCallback((distance: number): PTRStatus => {
        if (distance < pullThreshold * 0.3) return PTRStatus.IDLE
        if (distance < pullThreshold) return PTRStatus.PULLING
        return PTRStatus.READY
    }, [pullThreshold])

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

        // Helper to get the actual scroll element
        const getScrollElement = () => {
            if (!scrollableRef) return container

            if ('current' in scrollableRef) {
                return scrollableRef.current as HTMLElement
            }
            return scrollableRef as HTMLElement
        }

        const handleNativeTouchStart = (e: TouchEvent) => {
            const scrollEl = getScrollElement()
            const isAtTop = scrollEl ? scrollEl.scrollTop <= 5 : window.scrollY <= 0

            if (!isAtTop) {
                isPulling.current = false
                return
            }

            if (statusRef.current === PTRStatus.REFRESHING ||
                statusRef.current === PTRStatus.SUCCESS ||
                statusRef.current === PTRStatus.ERROR) {
                isPulling.current = false
                return
            }

            const touch = e.touches[0]
            startY.current = touch.clientY
            startX.current = touch.clientX
            isPulling.current = true

            if (!willChangeApplied.current && contentRef.current) {
                contentRef.current.style.willChange = 'transform'
                contentRef.current.style.transition = 'none'
                willChangeApplied.current = true
            }
        }

        const handleNativeTouchMove = (e: TouchEvent) => {
            const scrollEl = getScrollElement()
            const isAtTop = scrollEl ? scrollEl.scrollTop <= 5 : window.scrollY <= 0

            if (!isAtTop) {
                if (isPulling.current) {
                    isPulling.current = false
                    resetPosition()
                }
                return
            }

            if (!isPulling.current) return

            if (statusRef.current === PTRStatus.REFRESHING ||
                statusRef.current === PTRStatus.SUCCESS ||
                statusRef.current === PTRStatus.ERROR) {
                return
            }

            const touch = e.touches[0]
            const diffY = touch.clientY - startY.current
            const diffX = Math.abs(touch.clientX - startX.current)

            if (diffX > Math.abs(diffY) * 1.5) {
                isPulling.current = false
                resetPosition()
                return
            }

            if (diffY <= 0) {
                isPulling.current = false
                resetPosition()
                return
            }

            if (!ticking.current) {
                rafId.current = requestAnimationFrame(() => {
                    const dampedY = Math.round(calculateDampedTranslation(diffY))
                    const newStatus = calculateStatus(dampedY)

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

            if (contentRef.current) {
                contentRef.current.style.transition = 'transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }

            setTimeout(() => {
                if (contentRef.current) {
                    contentRef.current.style.willChange = 'auto'
                    contentRef.current.style.transition = 'none'
                }
                willChangeApplied.current = false
            }, 300)

            if (statusRef.current === PTRStatus.READY) {
                setPtrState({
                    status: PTRStatus.REFRESHING,
                    pullDistance: 80
                })
                prevStatusRef.current = PTRStatus.REFRESHING

                try {
                    await Promise.race([
                        onRefresh(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('timeout')), PTR_CONFIG.timeout)
                        )
                    ])

                    setPtrState({
                        status: PTRStatus.SUCCESS,
                        pullDistance: 0
                    })
                    prevStatusRef.current = PTRStatus.SUCCESS
                    haptic.success()

                    resetTimeoutRef.current = setTimeout(() => {
                        resetPosition()
                    }, 1500)

                } catch (error) {
                    setPtrState({
                        status: PTRStatus.ERROR,
                        pullDistance: 0
                    })
                    prevStatusRef.current = PTRStatus.ERROR

                    if (error instanceof Error && error.message === 'timeout') {
                        toast.error('網路逾時，請稍後再試')
                    }
                    haptic.error()

                    resetTimeoutRef.current = setTimeout(() => {
                        resetPosition()
                    }, 2000)
                }
            } else {
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
    }, [pullThreshold, onRefresh, haptic, calculateStatus, containerRef, scrollableRef])

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
                    top: (ptrState.status === PTRStatus.SUCCESS || ptrState.status === PTRStatus.ERROR)
                        ? -80
                        : Math.max(ptrState.pullDistance / 2 - 40, -80),
                    opacity: (ptrState.status === PTRStatus.SUCCESS || ptrState.status === PTRStatus.ERROR)
                        ? 0
                        : opacity
                }}
            >
                {/* 🎨 Icon Container */}
                <div className="relative">
                    <AnimatePresence>
                        {ptrState.status === PTRStatus.PULLING && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.15 }}
                                className="absolute inset-0 flex items-center justify-center"
                            >
                                <CircularProgress
                                    progress={progress}
                                    size={56}
                                    strokeWidth={2.5}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

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
                </div>

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

            {/* 📜 Content */}
            <div
                ref={contentRef}
                style={{
                    transform: `translate3d(0, ${Math.round(ptrState.pullDistance)}px, 0)`,
                    backfaceVisibility: 'hidden'
                }}
            >
                {children}
            </div>

            {/* 🆕 Accessibility */}
            <button
                onClick={async () => {
                    if (ptrState.status === PTRStatus.REFRESHING) return

                    setPtrState({
                        status: PTRStatus.REFRESHING,
                        pullDistance: 80
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
})

PullToRefresh.displayName = "PullToRefresh"
