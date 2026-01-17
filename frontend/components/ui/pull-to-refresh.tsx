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

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback, startTransition } from "react"
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
    scrollableRef?: React.RefObject<HTMLElement | null> | HTMLElement | null | undefined
    /**
     * 🆕 Mechanical Guard: Reference to a timestamp (performance.now()).
     * If recently updated (last 200ms), PTR will be ignored.
     */
    lastInteractionTime?: React.RefObject<number>
}

export interface PullToRefreshHandle {
    container: HTMLDivElement | null
}

// 🎯 PTR 物理配置 (Silk Engine v2.0)
const PTR_CONFIG = {
    threshold: 80,
    maxPull: 150,
    timeout: 10000,
    // 🆕 Logarithmic Damping Constants
    damping: {
        k: 60, // Scale factor
        s: 40  // Stretch factor
    }
}

export const PullToRefresh = forwardRef<HTMLDivElement, PullToRefreshProps>(({ children, onRefresh, className, pullThreshold = PTR_CONFIG.threshold, scrollableRef, lastInteractionTime }, ref) => {
    const haptic = useHaptic()

    // 🔑 單一 State Object（僅用於邏輯狀態，不驅動動畫）
    const [ptrState, setPtrState] = useState<PTRState>({
        status: PTRStatus.IDLE,
        pullDistance: 0
    })

    const internalContainerRef = useRef<HTMLDivElement>(null)
    // Expose internal ref to parent
    useImperativeHandle(ref, () => internalContainerRef.current!)

    const containerRef = internalContainerRef
    const contentRef = useRef<HTMLDivElement>(null)
    const currentDistanceRef = useRef(0) // 🆕 Direct DOM source of truth
    const startY = useRef(0)
    const startX = useRef(0)
    const isPulling = useRef(false)
    const rafId = useRef<number | null>(null)
    const ticking = useRef(false)
    const prevStatusRef = useRef<PTRStatus>(PTRStatus.IDLE)
    const statusRef = useRef<PTRStatus>(PTRStatus.IDLE)
    const willChangeApplied = useRef(false)
    const isGestureCaptured = useRef(false) // 🆕 Track if we've hijacked the gesture
    const isAtTopRef = useRef(true) // 🆕 Ghost Anchor Ref (Zero-Polling)
    const velocityRef = useRef(0) // 🆕 Tracking momentum
    const lastTimeRef = useRef(0)
    const lastYRef = useRef(0)

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
    const resetPosition = useCallback(() => {
        // Stop any pending animations
        if (rafId.current) cancelAnimationFrame(rafId.current)

        // Reset DOM state
        if (contentRef.current && containerRef.current) {
            contentRef.current.style.transform = ''
            containerRef.current.style.setProperty('--ptr-progress', '0')
            containerRef.current.style.setProperty('--ptr-distance', '0px')
            containerRef.current.style.setProperty('--ptr-opacity', '0')
            containerRef.current.style.touchAction = 'pan-y' // 🆕 Restore native scrollability
        }

        currentDistanceRef.current = 0
        isPulling.current = false
        isGestureCaptured.current = false

        setPtrState({
            status: PTRStatus.IDLE,
            pullDistance: 0
        })
    }, [containerRef])

    // 🆕 Silk Engine v2.0: Pointer Events + Direct DOM
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const getScrollElement = () => {
            if (!scrollableRef) return container
            if ('current' in scrollableRef) return scrollableRef.current as HTMLElement
            return scrollableRef as HTMLElement
        }

        // 👻 Ghost Anchor: Zero-Polling At-Top Detection
        const observer = new IntersectionObserver(([entry]) => {
            isAtTopRef.current = entry.isIntersecting
        }, { threshold: 0.1 })

        const setupObserver = () => {
            const scrollEl = getScrollElement()
            const anchor = scrollEl?.querySelector('#ptr-ghost-anchor') || scrollEl?.firstElementChild
            if (anchor) observer.observe(anchor)
        }
        setupObserver()

        const handlePointerDown = (e: PointerEvent) => {
            // Only handle primary button
            if (e.button !== 0) return

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

            startY.current = e.clientY
            startX.current = e.clientX
            lastYRef.current = e.clientY
            lastTimeRef.current = performance.now()
            isPulling.current = true
            isGestureCaptured.current = false

            if (!willChangeApplied.current && contentRef.current) {
                contentRef.current.style.willChange = 'transform'
                contentRef.current.style.transition = 'none'
                willChangeApplied.current = true
            }
        }

        const handlePointerMove = (e: PointerEvent) => {
            if (!isPulling.current) return

            const scrollEl = getScrollElement()
            const isAtTop = scrollEl ? scrollEl.scrollTop <= 5 : window.scrollY <= 0

            // If user scrolled down during pull, abort
            if (!isAtTop && currentDistanceRef.current === 0) {
                isPulling.current = false
                return
            }

            if (statusRef.current === PTRStatus.REFRESHING ||
                statusRef.current === PTRStatus.SUCCESS ||
                statusRef.current === PTRStatus.ERROR) {
                return
            }

            const now = performance.now()
            const dt = now - lastTimeRef.current
            const dy = e.clientY - lastYRef.current
            if (dt > 0) velocityRef.current = dy / dt
            lastTimeRef.current = now
            lastYRef.current = e.clientY

            const diffY = e.clientY - startY.current
            const diffX = Math.abs(e.clientX - startX.current)

            if (!isGestureCaptured.current) {
                // 🆕 Mechanical Guard check
                if (lastInteractionTime?.current && performance.now() - lastInteractionTime.current < 200) {
                    return
                }

                // Only capture if at top AND moving down significantly
                if (isAtTopRef.current && diffY > 10 && diffY > diffX * 2) {
                    // Momentum check: if moving up too fast, ignore
                    if (velocityRef.current < -0.5) return

                    if (container.setPointerCapture) {
                        try { container.setPointerCapture(e.pointerId) } catch { }
                    }
                    isGestureCaptured.current = true
                    container.style.touchAction = 'none'
                } else if (diffX > 15 || diffY < -10) {
                    isPulling.current = false
                    return
                } else {
                    return
                }
            }

            // 🛡️ Prevent native behaviors ONLY once we've captured the gesture
            if (e.cancelable) e.preventDefault()

            if (!ticking.current) {
                rafId.current = requestAnimationFrame(() => {
                    // 🆕 Spring Tension Damping: Stage 1 (Normal) vs Stage 2 (Tight)
                    const { k, s } = PTR_CONFIG.damping
                    let dampedY = k * Math.log(1 + diffY / s)

                    if (dampedY > pullThreshold) {
                        const overflow = dampedY - pullThreshold
                        dampedY = pullThreshold + (overflow * 0.4) // Secondary tension
                    }

                    dampedY = Math.max(0, dampedY)

                    // Update Refs (Source of Truth)
                    currentDistanceRef.current = dampedY

                    // 🚀 Direct DOM Updates (Main Thread Unblocked)
                    if (contentRef.current && containerRef.current) {
                        contentRef.current.style.transform = `translate3d(0, ${dampedY}px, 0)`

                        const progress = Math.min(dampedY / pullThreshold, 1)
                        const opacity = Math.min(progress * 2, 1)

                        // Update CSS Variables for Indicator
                        containerRef.current.style.setProperty('--ptr-progress', progress.toString())
                        containerRef.current.style.setProperty('--ptr-distance', `${dampedY}px`)
                        containerRef.current.style.setProperty('--ptr-opacity', opacity.toString())
                    }

                    const newStatus = calculateStatus(dampedY)

                    // ⚡ Status Change Debounce & Proprioceptive Haptics
                    if (newStatus !== statusRef.current) {
                        // Stage 1: Threshold Crossing (Medium Vibration)
                        if (newStatus === PTRStatus.READY && statusRef.current !== PTRStatus.READY) {
                            haptic.success()
                        }
                        // Stage 2: Returning to Idle from Ready (Subtle Tap)
                        else if (newStatus === PTRStatus.PULLING && statusRef.current === PTRStatus.READY) {
                            haptic.tap()
                        }

                        prevStatusRef.current = statusRef.current // Update prev status before setting new one locally
                        statusRef.current = newStatus // Update local ref immediately

                        // Wrap state update in Transition to keep UI responsive
                        startTransition(() => {
                            setPtrState(prev => ({ ...prev, status: newStatus }))
                        })
                    }

                    ticking.current = false
                })
                ticking.current = true
            }
        }

        const handlePointerUp = async (e: PointerEvent) => {
            if (!isPulling.current) return

            if (isGestureCaptured.current && container.releasePointerCapture) {
                try {
                    container.releasePointerCapture(e.pointerId)
                    container.style.touchAction = 'pan-y' // 🆕 Restore
                } catch { /** ignore */ }
            }

            const captured = isGestureCaptured.current
            isPulling.current = false
            isGestureCaptured.current = false
            if (rafId.current) {
                cancelAnimationFrame(rafId.current)
                rafId.current = null
            }
            ticking.current = false

            // Restore transitions for smooth snap-back
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

            if (captured && statusRef.current === PTRStatus.READY) {
                // LOCK state
                statusRef.current = PTRStatus.REFRESHING
                setPtrState({ status: PTRStatus.REFRESHING, pullDistance: 80 })

                // Set CSS for Refreshing state
                if (containerRef.current) {
                    containerRef.current.style.setProperty('--ptr-distance', '80px')
                    containerRef.current.style.setProperty('--ptr-opacity', '1')
                }
                if (contentRef.current) {
                    contentRef.current.style.transform = `translate3d(0, 80px, 0)`
                }

                try {
                    await Promise.race([
                        onRefresh(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), PTR_CONFIG.timeout))
                    ])

                    statusRef.current = PTRStatus.SUCCESS
                    setPtrState({ status: PTRStatus.SUCCESS, pullDistance: 0 })
                    haptic.success()
                } catch (err) {
                    statusRef.current = PTRStatus.ERROR
                    setPtrState({ status: PTRStatus.ERROR, pullDistance: 0 })

                    if (err instanceof Error && err.message === 'timeout') {
                        toast.error('網路逾時，請稍後再試')
                    }
                    haptic.error()
                }
            } else if (currentDistanceRef.current > 0) {
                // 🚀 Zero-Overhead: Only reset if we actually pulled.
                resetPosition()
            } else {
                // Pure tap: Just clear refs quietly without React state update
                isPulling.current = false
                isGestureCaptured.current = false
                ticking.current = false
            }
        }

        container.addEventListener('pointerdown', handlePointerDown, { passive: true })
        container.addEventListener('pointermove', handlePointerMove, { passive: false })
        container.addEventListener('pointerup', handlePointerUp, { passive: true })
        container.addEventListener('pointercancel', handlePointerUp, { passive: true })
        container.addEventListener('pointerleave', handlePointerUp, { passive: true })

        return () => {
            const currentRaf = rafId.current
            if (currentRaf) cancelAnimationFrame(currentRaf)

            container.removeEventListener('pointerdown', handlePointerDown)
            container.removeEventListener('pointermove', handlePointerMove)
            container.removeEventListener('pointerup', handlePointerUp)
            container.removeEventListener('pointercancel', handlePointerUp)
            container.removeEventListener('pointerleave', handlePointerUp)
            observer.disconnect()
        }
    }, [pullThreshold, onRefresh, haptic, calculateStatus, containerRef, scrollableRef, resetPosition, lastInteractionTime])

    // ... existing cleanup useEffect ...
    useEffect(() => {
        if (ptrState.status === PTRStatus.SUCCESS) {
            const timer = setTimeout(() => resetPosition(), 1500)
            return () => clearTimeout(timer)
        }
        if (ptrState.status === PTRStatus.ERROR) {
            const timer = setTimeout(() => resetPosition(), 2000)
            return () => clearTimeout(timer)
        }
    }, [ptrState.status, resetPosition])

    // 🎨 當前配置
    const config = PTR_STATUS_CONFIG[ptrState.status]
    const Icon = ICON_MAP[config.icon]
    const progress = Math.min(ptrState.pullDistance / pullThreshold, 1)

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative overflow-auto",
                "overscroll-y-contain", // 🆕 Overscroll Locking
                "touch-pan-y",
                className
            )}
            style={{
                WebkitOverflowScrolling: 'touch',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                // 🆕 Initialize CSS Variables
                ['--ptr-progress' as string]: 0,
                ['--ptr-distance' as string]: '0px',
                ['--ptr-opacity' as string]: 0
            } as React.CSSProperties}
        >
            {/* 🎯 Indicator (CSS Variables Driver) */}
            <div
                className={cn(
                    "absolute left-1/2 -translate-x-1/2 z-10",
                    "flex flex-col items-center gap-2",
                    "pointer-events-none",
                    "transition-all duration-150"
                )}
                style={{
                    // 🆕 Hybrid Positioning: Use CSS var for pulling, State for static/success states
                    top: (ptrState.status === PTRStatus.SUCCESS || ptrState.status === PTRStatus.ERROR)
                        ? -80
                        : 'calc(var(--ptr-distance) / 2 - 40px)',
                    opacity: (ptrState.status === PTRStatus.SUCCESS || ptrState.status === PTRStatus.ERROR)
                        ? 0
                        : 'var(--ptr-opacity)'
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
                                    progress={progress} // ⚠️ Partial Limitation: CircularProgress still needs props, but it's small.
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
                                "w-12 h-12 rounded-full shadow-lg border",
                                "bg-white border-slate-100",
                                "dark:bg-slate-800 dark:border-slate-700",
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

            {/* 📜 Content (Ref-based, not State-based for transform) */}
            <div
                ref={contentRef}
                style={{
                    // 🆕 Remove state-based transform binding here!
                    // It is now handled purely by Direct DOM in pointermove
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
                        // Auto reset by useEffect
                    } catch {
                        setPtrState({
                            status: PTRStatus.ERROR,
                            pullDistance: 0
                        })
                    }
                }}
                aria-label="重新整理頁面"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-1/2 focus:-translate-x-1/2 focus:z-20 focus:bg-white dark:focus:bg-slate-800 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-slate-900 dark:focus:text-slate-100"
            >
                重新整理
            </button>
        </div >
    )
})

PullToRefresh.displayName = "PullToRefresh"
