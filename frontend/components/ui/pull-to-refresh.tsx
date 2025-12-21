"use client"

import { useState, useRef, useCallback } from "react"
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

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        // Only start pull if we're at the top
        if (containerRef.current && containerRef.current.scrollTop <= 0) {
            startY.current = e.touches[0].clientY
            isPulling.current = true
        }
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling.current || isRefreshing) return

        const currentY = e.touches[0].clientY
        const diff = currentY - startY.current

        // Only allow pull down (positive diff)
        if (diff > 0 && containerRef.current && containerRef.current.scrollTop <= 0) {
            // Add resistance
            const resistance = diff > pullThreshold ? 0.3 : 0.5
            const newDistance = Math.min(diff * resistance, pullThreshold * 1.5)
            setPullDistance(newDistance)

            // Prevent scroll when pulling
            if (diff > 10) {
                e.preventDefault()
            }
        }
    }, [isRefreshing, pullThreshold])

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling.current) return
        isPulling.current = false

        if (pullDistance >= pullThreshold && !isRefreshing) {
            setIsRefreshing(true)
            setPullDistance(50) // Keep indicator visible

            try {
                await onRefresh()
            } finally {
                setIsRefreshing(false)
                setPullDistance(0)
            }
        } else {
            setPullDistance(0)
        }
    }, [pullDistance, pullThreshold, isRefreshing, onRefresh])

    const progress = Math.min(pullDistance / pullThreshold, 1)

    return (
        <div
            ref={containerRef}
            className={cn("relative overflow-auto", className)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
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
