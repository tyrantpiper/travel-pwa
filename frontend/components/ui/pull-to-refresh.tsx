"use client"

/**
 * 🆕 Project Silk Touch: PTR Physics Engine v2.0
 * 
 * 優化內容：
 * - 三階段非線性阻尼（模擬 iOS 橡皮筋）
 * - RAF 節流（60fps，無抖動）
 * - 10 秒 Timeout 安全閥
 * - Haptic 震動回饋
 * - Accessibility 支援
 */

import { useState, useRef, useCallback, useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useHaptic } from "@/lib/hooks"
import { toast } from "sonner"

interface PullToRefreshProps {
    children: React.ReactNode
    onRefresh: () => Promise<void>
    className?: string
    pullThreshold?: number
}

// 🎯 PTR 物理配置
const PTR_CONFIG = {
    threshold: 80,      // 觸發刷新的距離
    maxPull: 150,       // 最大下拉距離
    timeout: 10000,     // 刷新超時 (10秒)
    dampingZones: {
        light: { max: 60, resistance: 0.8 },     // 0-60px: 輕阻力
        medium: { max: 120, resistance: 0.5 },   // 60-120px: 中阻力
        heavy: { max: 200, resistance: 0.25 }    // >120px: 重阻力
    }
}

/**
 * 🔑 三階段非線性阻尼公式
 * 
 * 模擬真實橡皮筋彈性：
 * - 初期：輕鬆拉伸（高回應性）
 * - 中期：感受到阻力（提供回饋感）
 * - 後期：極難拉動（防止過度拉伸）
 */
function calculateDampedTranslation(rawDiff: number): number {
    const { dampingZones, maxPull } = PTR_CONFIG

    if (rawDiff <= 0) return 0

    if (rawDiff <= dampingZones.light.max) {
        // 🟢 輕阻力區（0-60px）
        return rawDiff * dampingZones.light.resistance

    } else if (rawDiff <= dampingZones.medium.max) {
        // 🟡 中阻力區（60-120px）
        const lightDistance = dampingZones.light.max * dampingZones.light.resistance
        const excessDiff = rawDiff - dampingZones.light.max
        return lightDistance + (excessDiff * dampingZones.medium.resistance)

    } else {
        // 🔴 重阻力區（>120px）
        const lightDistance = dampingZones.light.max * dampingZones.light.resistance
        const mediumDistance = (dampingZones.medium.max - dampingZones.light.max) * dampingZones.medium.resistance
        const baseDistance = lightDistance + mediumDistance

        const excessDiff = rawDiff - dampingZones.medium.max
        const heavyTranslation = excessDiff * dampingZones.heavy.resistance

        // 🔒 硬上限
        return Math.min(baseDistance + heavyTranslation, maxPull)
    }
}

export function PullToRefresh({ children, onRefresh, className, pullThreshold = PTR_CONFIG.threshold }: PullToRefreshProps) {
    const [pullDistance, setPullDistance] = useState(0)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const startY = useRef(0)
    const startX = useRef(0)  // 🆕 水平滑動檢測
    const isPulling = useRef(false)
    const rafId = useRef<number | null>(null)  // 🆕 RAF 節流
    const ticking = useRef(false)  // 🆕 RAF 鎖
    const haptic = useHaptic()

    // 🆕 使用原生事件監聽器，可控制 passive
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleNativeTouchStart = (e: TouchEvent) => {
            // 🛡️ Guard: 不在頂部時不啟用 PTR
            if (window.scrollY > 0 || container.scrollTop > 0) {
                isPulling.current = false
                return
            }

            const touch = e.touches[0]
            startY.current = touch.clientY
            startX.current = touch.clientX  // 🆕 記錄起始 X
            isPulling.current = true
        }

        const handleNativeTouchMove = (e: TouchEvent) => {
            // 🛡️ Guard #1: 頁面已捲動，放行給瀏覽器
            if (window.scrollY > 0 || container.scrollTop > 0) {
                if (isPulling.current) {
                    isPulling.current = false
                    setPullDistance(0)
                }
                return
            }

            if (!isPulling.current || isRefreshing) return

            const touch = e.touches[0]
            const diffY = touch.clientY - startY.current
            const diffX = Math.abs(touch.clientX - startX.current)

            // 🛡️ Guard #2: 水平滑動優先（可能是翻頁）
            if (diffX > Math.abs(diffY) * 1.5) {
                isPulling.current = false
                setPullDistance(0)
                return
            }

            // 🛡️ Guard #3: 只處理下拉
            if (diffY <= 0) {
                isPulling.current = false
                setPullDistance(0)
                return
            }

            // 🚫 阻止原生回彈
            e.preventDefault()

            // ⚡ RAF 節流：避免 Layout Thrashing
            if (!ticking.current) {
                rafId.current = requestAnimationFrame(() => {
                    // 🎯 應用三階段阻尼
                    const dampedY = calculateDampedTranslation(diffY)
                    setPullDistance(dampedY)
                    ticking.current = false
                })
                ticking.current = true
            }
        }

        const handleNativeTouchEnd = async () => {
            if (!isPulling.current) return
            isPulling.current = false

            // 清理 RAF
            if (rafId.current) {
                cancelAnimationFrame(rafId.current)
                rafId.current = null
            }
            ticking.current = false

            if (pullDistance >= pullThreshold && !isRefreshing) {
                setIsRefreshing(true)
                setPullDistance(50)  // 保持 loading 位置
                haptic.tap()  // 🆕 震動回饋

                try {
                    // 🔒 Timeout 安全閥
                    await Promise.race([
                        onRefresh(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('timeout')), PTR_CONFIG.timeout)
                        )
                    ])
                    haptic.success()  // 成功回饋
                } catch (error) {
                    if (error instanceof Error && error.message === 'timeout') {
                        toast.error('網路逾時，請稍後再試')
                    }
                    haptic.error()  // 失敗回饋
                } finally {
                    // 🔑 無論如何都重置
                    setIsRefreshing(false)
                    setPullDistance(0)
                }
            } else {
                setPullDistance(0)
            }
        }

        // 🆕 使用 passive: false 讓 preventDefault 生效
        container.addEventListener('touchstart', handleNativeTouchStart, { passive: true })
        container.addEventListener('touchmove', handleNativeTouchMove, { passive: false })
        container.addEventListener('touchend', handleNativeTouchEnd, { passive: true })

        return () => {
            // 🆕 清理 RAF（防止 memory leak）
            if (rafId.current) {
                cancelAnimationFrame(rafId.current)
            }
            container.removeEventListener('touchstart', handleNativeTouchStart)
            container.removeEventListener('touchmove', handleNativeTouchMove)
            container.removeEventListener('touchend', handleNativeTouchEnd)
        }
    }, [isRefreshing, pullThreshold, onRefresh, haptic])  // 🔧 移除 pullDistance 依賴

    const progress = Math.min(pullDistance / pullThreshold, 1)

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative overflow-auto",
                "overscroll-y-contain", // 🔒 阻止捲動鍊
                "touch-pan-y",          // 🔒 讓瀏覽器優先處理垂直捲動
                className
            )}
            style={{
                WebkitOverflowScrolling: 'touch' // iOS 慣性捲動
            }}
        >
            {/* Pull indicator */}
            <div
                className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center transition-all duration-150"
                style={{
                    top: pullDistance - 40,
                    opacity: progress
                }}
            >
                <div className={cn(
                    "bg-white rounded-full p-2 shadow-lg border border-slate-100",
                    isRefreshing && "animate-pulse"
                )}>
                    <RefreshCw
                        className={cn(
                            "w-5 h-5 text-slate-600 transition-transform duration-150",
                            isRefreshing && "animate-spin"
                        )}
                        style={{
                            transform: `rotate(${progress * 360}deg)`
                        }}
                    />
                </div>
            </div>

            {/* Content with transform (GPU 加速) */}
            <div
                className="transition-transform duration-150"
                style={{
                    transform: `translateY(${pullDistance}px)`
                }}
            >
                {children}
            </div>

            {/* 🆕 Accessibility: Screen Reader 替代操作 */}
            <button
                onClick={async () => {
                    if (isRefreshing) return
                    setIsRefreshing(true)
                    try {
                        await onRefresh()
                    } finally {
                        setIsRefreshing(false)
                    }
                }}
                aria-label="重新整理頁面"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-1/2 focus:-translate-x-1/2 focus:z-20 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
            >
                重新整理
            </button>
        </div>
    )
}
