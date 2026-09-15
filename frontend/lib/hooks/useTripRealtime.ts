"use client"

import { useEffect, useRef } from "react"
import { useSWRConfig } from "swr"
import { getSupabaseClient } from "@/lib/supabase"
import { toast } from "sonner"

/**
 * 🔄 E6: Supabase Realtime 跨裝置即時協同 Hook
 * 監聽當前行程 (itineraries) 與分帳費用 (expenses) 的變更
 * 當旅伴在異地更新時，300ms 內無感熱刷新本地 SWR 快照
 */
export function useTripRealtime(tripId: string | null | undefined, userId?: string | null) {
    const { mutate } = useSWRConfig()
    const lastToastTimeRef = useRef<number>(0)

    useEffect(() => {
        if (!tripId || typeof window === "undefined") return

        const supabase = getSupabaseClient()
        if (!supabase) return

        const channelName = `realtime-trip-${tripId}`
        const channel = supabase.channel(channelName)

        // 1. 監聽行程詳情異動 (景點增刪、順序調整、日期變更)
        channel.on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "itineraries",
                filter: `id=eq.${tripId}`,
            },
            (payload) => {
                console.log("🔄 [Realtime] Itinerary updated remotely:", payload.eventType)
                // 靜默更新本地快照
                mutate((key: unknown) => {
                    if (Array.isArray(key) && key[0] === `/api/trips/${tripId}`) return true
                    if (Array.isArray(key) && key[0] === "/api/trips") return true
                    return false
                })

                // 防抖通知 (3 秒內最多提示一次，避免旅伴連續操作轟炸)
                const now = Date.now()
                if (now - lastToastTimeRef.current > 3000) {
                    lastToastTimeRef.current = now
                    toast.info("🔄 旅伴已更新行程內容", { duration: 2500 })
                }
            }
        )

        // 2. 監聽花費記帳異動 (新增花費、分帳修改、刪除費用)
        channel.on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "expenses",
                filter: `trip_id=eq.${tripId}`,
            },
            (payload) => {
                console.log("🔄 [Realtime] Expense updated remotely:", payload.eventType)
                mutate((key: unknown) => {
                    if (typeof key === "string" && key.includes("/api/ledger/expenses")) return true
                    if (typeof key === "string" && key.includes("/api/ledger/summary")) return true
                    return false
                })

                const now = Date.now()
                if (now - lastToastTimeRef.current > 3000) {
                    lastToastTimeRef.current = now
                    toast.info("💰 旅伴已更新記帳資料", { duration: 2500 })
                }
            }
        )

        channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
                console.log(`🌐 [Realtime] Subscribed to trip collaboration: ${tripId}`)
            }
        })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [tripId, userId, mutate])
}
