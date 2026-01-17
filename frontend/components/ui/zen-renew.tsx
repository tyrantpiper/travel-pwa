"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { RotateCw, Check, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useHaptic } from "@/lib/hooks"
import { toast } from "sonner"

interface ZenRenewProps {
    onRefresh: () => Promise<unknown> | void
    className?: string
    successMessage?: string
    errorMessage?: string
}

type RefreshState = "idle" | "loading" | "success" | "error"

const REFRESH_TIMEOUT = 15000 // 15s Safety Timeout

export function ZenRenew({ onRefresh, className, successMessage = "已更新", errorMessage = "更新失敗" }: ZenRenewProps) {
    const [state, setState] = useState<RefreshState>("idle")
    const haptic = useHaptic()
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    const handleRefresh = async () => {
        if (state === "loading") return

        // 📳 Haptic Impact
        haptic.tap()
        setState("loading")
        let hasError = false

        try {
            // Promise.race with Timeout
            await Promise.race([
                onRefresh(),
                new Promise((_, reject) => {
                    timerRef.current = setTimeout(() => reject(new Error("Timeout")), REFRESH_TIMEOUT)
                })
            ])

            setState("success")
            haptic.success()
            toast.success(successMessage)
        } catch (error) {
            console.error("[ZenRenew] Refresh sync failed:", error)
            hasError = true
            setState("error")
            haptic.error()
            toast.error(errorMessage)
        } finally {
            if (timerRef.current) clearTimeout(timerRef.current)
            // Non-blocking return to idle
            const delay = hasError ? 3000 : 2000
            timerRef.current = setTimeout(() => setState("idle"), delay)
        }
    }

    return (
        <button
            onClick={handleRefresh}
            disabled={state === "loading"}
            className={cn(
                "relative flex items-center justify-center w-11 h-11 transition-all active:scale-90", // 44px hit target
                className
            )}
            title="重新整理"
            aria-label="重新整理"
        >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900/5 dark:bg-white/5 backdrop-blur-sm">
                <AnimatePresence>
                    {state === "loading" && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0, rotate: 0 }}
                            animate={{ opacity: 1, rotate: 360 }}
                            exit={{ opacity: 0, rotate: 0 }} // Stop rotation immediately on exit
                            transition={{
                                rotate: { repeat: Infinity, duration: 1, ease: "linear" },
                                opacity: { duration: 0.1 }
                            }}
                            className="absolute"
                        >
                            <RotateCw className="w-4 h-4 text-slate-500" />
                        </motion.div>
                    )}
                    {state === "success" && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-emerald-500 absolute"
                            transition={{ duration: 0.2 }}
                        >
                            <Check className="w-4 h-4" />
                        </motion.div>
                    )}
                    {state === "error" && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-rose-500 absolute"
                            transition={{ duration: 0.2 }}
                        >
                            <AlertCircle className="w-4 h-4" />
                        </motion.div>
                    )}
                    {state === "idle" && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <RotateCw className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </button>
    )
}
