"use client"

import { ArrowUp } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface BackToTopProps {
    isVisible: boolean
    onClick: () => void
}

/**
 * 2026 Premium Scroll Action:
 * A theme-aware, glassmorphic "Back to Top" button.
 */
export function BackToTop({ isVisible, onClick }: BackToTopProps) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: 20 }}
                    onClick={onClick}
                    className={cn(
                        "fixed left-6 bottom-24 z-[110]", // 位於左側，避開右側聊天視窗
                        "w-12 h-12 rounded-full",
                        "bg-white/10 dark:bg-slate-900/20 backdrop-blur-xl",
                        "border border-white/20 dark:border-white/10",
                        "shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
                        "flex items-center justify-center transition-transform active:scale-90"
                    )}
                    style={{ 
                        // 使用修復後的 --primary 變數
                        backgroundColor: 'var(--primary)',
                        color: 'white' // 保持圖示清晰
                    }}
                    whileHover={{ scale: 1.1 }}
                >
                    <ArrowUp className="w-5 h-5 strike-clamp" strokeWidth={2.5} />
                </motion.button>
            )}
        </AnimatePresence>
    )
}
