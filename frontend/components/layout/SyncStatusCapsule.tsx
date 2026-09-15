"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Cloud, AlertCircle, RefreshCw } from "lucide-react"
import { useSyncStatusStore } from "@/lib/stores/syncStatusStore"
import { toast } from "sonner"

export function SyncStatusCapsule() {
    const { pendingCount, failedCount, isOnline } = useSyncStatusStore()

    if (pendingCount === 0 && failedCount === 0) {
        return null
    }

    const handleClick = () => {
        if (failedCount > 0) {
            toast.error(`共有 ${failedCount} 筆離線操作同步未成功，連網後將自動重試。`)
        } else if (!isOnline) {
            toast.info(`處於離線狀態，${pendingCount} 筆變更已暫存於裝置，連網後將自動上雲。`)
        } else {
            toast.loading(`正在同步 ${pendingCount} 筆離線變更...`, { duration: 2000 })
        }
    }

    return (
        <AnimatePresence>
            <motion.button
                initial={{ opacity: 0, scale: 0.8, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -4 }}
                onClick={handleClick}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm backdrop-blur-md transition-all active:scale-95 cursor-pointer border"
                style={{
                    backgroundColor: failedCount > 0 ? "rgba(244, 63, 94, 0.12)" : "rgba(245, 158, 11, 0.12)",
                    borderColor: failedCount > 0 ? "rgba(244, 63, 94, 0.3)" : "rgba(245, 158, 11, 0.3)",
                    color: failedCount > 0 ? "#e11d48" : "#d97706",
                }}
            >
                {failedCount > 0 ? (
                    <>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                        <span>{failedCount} 筆待確認</span>
                    </>
                ) : isOnline ? (
                    <>
                        <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
                        <span>同步中 ({pendingCount})</span>
                    </>
                ) : (
                    <>
                        <Cloud className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                        <span>離線暫存 ({pendingCount})</span>
                    </>
                )}
            </motion.button>
        </AnimatePresence>
    )
}
