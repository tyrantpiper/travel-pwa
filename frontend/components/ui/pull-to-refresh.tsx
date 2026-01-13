"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface PullToRefreshProps {
    children: React.ReactNode
    onRefresh: () => Promise<void>
    className?: string
    pullThreshold?: number
}

export function PullToRefresh({ children, onRefresh, className, pullThreshold = 80 }: PullToRefreshProps) {
    const [pullDistance, setPullDistance] = useState(0)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const startY = useRef(0)
    const isPulling = useRef(false)

    // 🆕 使用原生事件監聽器，可控制 passive
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleNativeTouchStart = (e: TouchEvent) => {
            // 🛡️ 嚴格邊界檢查：window + container
            if (window.scrollY > 0 || container.scrollTop > 0) {
                isPulling.current = false
                return
            }
            startY.current = e.touches[0].clientY
            isPulling.current = true
        }

        const handleNativeTouchMove = (e: TouchEvent) => {
            // 🛡️ 如果頁面已捲動，完全放行給瀏覽器
            if (window.scrollY > 0 || container.scrollTop > 0) {
                if (isPulling.current) {
                    isPulling.current = false
                    setPullDistance(0)
                }
                return // 不做任何處理，讓瀏覽器執行原生慣性捲動
            }

            if (!isPulling.current || isRefreshing) return

            const touch = e.touches[0]
            const diff = touch.clientY - startY.current

            if (diff > 0) {
                // 下拉：應用阻力
                const resistance = diff > pullThreshold ? 0.3 : 0.5
                const newDistance = Math.min(diff * resistance, pullThreshold * 1.5)
                setPullDistance(newDistance)

                // 只在明確下拉時阻止預設行為
                if (diff > 10) {
                    e.preventDefault()
                }
            } else {
                // 上滑：取消 PTR，讓瀏覽器捲動
                isPulling.current = false
                setPullDistance(0)
            }
        }

        const handleNativeTouchEnd = async () => {
            if (!isPulling.current) return
            isPulling.current = false

            if (pullDistance >= pullThreshold && !isRefreshing) {
                setIsRefreshing(true)
                setPullDistance(50)

                try {
                    await onRefresh()
                } finally {
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
            container.removeEventListener('touchstart', handleNativeTouchStart)
            container.removeEventListener('touchmove', handleNativeTouchMove)
            container.removeEventListener('touchend', handleNativeTouchEnd)
        }
    }, [isRefreshing, pullThreshold, pullDistance, onRefresh])

    const progress = Math.min(pullDistance / pullThreshold, 1)

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative overflow-auto",
                "overscroll-y-contain", // 🆕 阻止捲動鍊
                "touch-pan-y",          // 🆕 讓瀏覽器優先處理垂直捲動
                className
            )}
            style={{
                WebkitOverflowScrolling: 'touch' // 🆕 iOS 慣性捲動
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

            {/* Content with transform */}
            <div
                className="transition-transform duration-150"
                style={{
                    transform: `translateY(${pullDistance}px)`
                }}
            >
                {children}
            </div>
        </div>
    )
}
