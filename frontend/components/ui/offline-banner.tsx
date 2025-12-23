"use client"

import { useOnlineStatus } from "@/lib/hooks"
import { Plane } from "lucide-react"

/**
 * OfflineBanner - 當網路斷線時顯示的橫幅
 * 自動偵測網路狀態，離線時顯示，上線時隱藏
 */
export function OfflineBanner() {
    const isOnline = useOnlineStatus()

    if (isOnline) return null

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-sky-500 to-blue-600 text-white px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium shadow-lg animate-in slide-in-from-top duration-300">
            <Plane className="w-4 h-4 animate-pulse" />
            <span>✈️ 離線模式 - 僅可查看快取的行程</span>
        </div>
    )
}

