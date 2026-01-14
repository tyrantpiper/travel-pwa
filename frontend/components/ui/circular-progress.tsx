"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface CircularProgressProps {
    progress: number  // 0-1
    size?: number     // 圓環大小（px）
    strokeWidth?: number  // 線條粗細
    className?: string
}

/**
 * 🆕 Project Silk Touch P2: CircularProgress
 * 
 * Displays a smooth circular progress indicator for PTR pull distance.
 * Uses Framer Motion for performant animations.
 */
export function CircularProgress({
    progress,
    size = 56,
    strokeWidth = 2.5,
    className
}: CircularProgressProps) {
    // 🎨 計算參數
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (progress * circumference)

    // 🌈 根據進度變色
    const getProgressColor = () => {
        if (progress < 0.5) return "text-slate-400"   // 開始：灰色
        if (progress < 0.8) return "text-blue-500"    // 中段：藍色
        return "text-blue-600"                        // 接近完成：深藍
    }

    return (
        <svg
            className={cn("transform -rotate-90", className)}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
        >
            {/* 背景圓環（淡灰色） */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-slate-200"
            />

            {/* 進度圓環（動態） */}
            <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className={getProgressColor()}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{
                    duration: 0.15,
                    ease: "easeOut"
                }}
            />
        </svg>
    )
}
