"use client"

import { useState, useRef } from "react"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SwipeableItemProps {
    children: React.ReactNode
    onDelete: () => void
    deleteThreshold?: number
    className?: string
}

export function SwipeableItem({ children, onDelete, deleteThreshold = 100, className }: SwipeableItemProps) {
    const [translateX, setTranslateX] = useState(0)
    const [isDeleting, setIsDeleting] = useState(false)
    const startX = useRef(0)
    const currentX = useRef(0)
    const isSwiping = useRef(false)

    const handleTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX
        currentX.current = e.touches[0].clientX
        isSwiping.current = false
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        currentX.current = e.touches[0].clientX
        const diff = startX.current - currentX.current

        // Only allow left swipe (positive diff)
        if (diff > 10) {
            isSwiping.current = true
            // Add resistance when swiping past threshold
            const resistance = diff > deleteThreshold ? 0.3 : 1
            const newTranslate = Math.min(diff * resistance, deleteThreshold * 1.5)
            setTranslateX(-newTranslate)
        } else if (diff < -10 && translateX < 0) {
            // Allow swipe right to cancel
            setTranslateX(Math.min(0, -diff * 0.5))
        }
    }

    const handleTouchEnd = () => {
        const diff = startX.current - currentX.current

        if (diff > deleteThreshold) {
            // Trigger delete
            setIsDeleting(true)
            setTranslateX(-window.innerWidth)
            setTimeout(() => {
                onDelete()
            }, 200)
        } else {
            // Reset position
            setTranslateX(0)
        }
    }

    return (
        <div className={cn("relative overflow-hidden", className)}>
            {/* Delete background */}
            <div
                className={cn(
                    "absolute inset-0 bg-red-500 flex items-center justify-end pr-6 transition-opacity",
                    translateX < -20 ? "opacity-100" : "opacity-0"
                )}
            >
                <div className="flex items-center gap-2 text-white">
                    <Trash2 className="w-5 h-5" />
                    <span className="text-sm font-medium">刪除</span>
                </div>
            </div>

            {/* Content */}
            <div
                className={cn(
                    "relative bg-white transition-transform",
                    isDeleting ? "duration-200" : isSwiping.current ? "duration-0" : "duration-150"
                )}
                style={{ transform: `translateX(${translateX}px)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    )
}
