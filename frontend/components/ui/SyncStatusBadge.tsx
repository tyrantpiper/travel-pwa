"use client"

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Cloud, Loader2, Check, AlertCircle } from "lucide-react"
import { ItemSyncStatus } from "@/lib/stores/syncStatusStore"
import { cn } from "@/lib/utils"

interface SyncStatusBadgeProps {
    status?: ItemSyncStatus
    errorMessage?: string
    className?: string
    showText?: boolean
    onRetry?: () => void
}

export function SyncStatusBadge({
    status,
    errorMessage,
    className,
    showText = true,
    onRetry,
}: SyncStatusBadgeProps) {
    const [syncedDismissed, setSyncedDismissed] = useState(false)

    useEffect(() => {
        if (status === "synced") {
            // 綠色打勾展示 1.5 秒後優雅淡出隱藏
            const timer = setTimeout(() => {
                setSyncedDismissed(true)
            }, 1500)
            return () => clearTimeout(timer)
        }
    }, [status])

    if (!status || (status === "synced" && syncedDismissed)) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.85, y: -2 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.3 } }}
                className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide shadow-xs border transition-colors select-none",
                    status === "pending" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse",
                    status === "syncing" && "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
                    status === "synced" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                    status === "failed" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 cursor-pointer hover:bg-rose-500/20",
                    className
                )}
                title={status === "failed" && errorMessage ? errorMessage : undefined}
                onClick={status === "failed" && onRetry ? onRetry : undefined}
            >
                {status === "pending" && (
                    <>
                        <Cloud className="w-3 h-3 shrink-0" />
                        {showText && <span>待同步</span>}
                    </>
                )}
                {status === "syncing" && (
                    <>
                        <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                        {showText && <span>同步中</span>}
                    </>
                )}
                {status === "synced" && (
                    <>
                        <Check className="w-3 h-3 shrink-0" />
                        {showText && <span>已同步</span>}
                    </>
                )}
                {status === "failed" && (
                    <>
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {showText && <span>同步失敗</span>}
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    )
}
