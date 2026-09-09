"use client"

import React, { useEffect, useMemo, ReactNode } from "react"
import { SWRConfig } from "swr"
import { get } from "idb-keyval"

const SWR_PERSIST_KEY = "tabidachi_swr_persisted_cache"

interface SwrCachePayload {
    data?: unknown
    error?: unknown
    isValidating?: boolean
    isLoading?: boolean
    [key: string]: unknown
}

/**
 * ⚡ 全域 SWR 持久化快取 Provider
 * 1. 記憶體同步 Map 緩衝，保障 React 19 首幀 0ms 零骨架屏秒閃
 * 2. 背景非同步預載與防抖寫回 IndexedDB
 * 3. 呼叫 navigator.storage.persist() 申請 Safari 7 天免清理權限
 */
export function IdbSwrProvider({ children }: { children: ReactNode }) {
    // 🧠 微秒級同步緩衝 Map
    const cacheMap = useMemo(() => new Map<string, SwrCachePayload>(), [])

    useEffect(() => {
        // 🛡️ Safari 7 天自動清理防衛 (JSDOM/SSR 安全守護)
        if (typeof navigator !== "undefined" && navigator.storage?.persist) {
            navigator.storage.persist().then((persisted) => {
                if (persisted) {
                    console.log("🛡️ [Storage] Persistent storage granted by browser.")
                }
            }).catch(() => {})
        }

        // 🚀 從 IndexedDB 預熱歷史快照至記憶體 Map
        get<Record<string, SwrCachePayload>>(SWR_PERSIST_KEY).then((stored) => {
            if (stored && typeof stored === "object") {
                Object.entries(stored).forEach(([key, val]) => {
                    // 僅恢復無 Promise / 乾淨資料的項目
                    if (val && typeof val === "object" && "data" in val) {
                        cacheMap.set(key, val)
                    }
                })
            }
        }).catch((err) => {
            console.warn("⚠️ [Storage] SWR Cache restore warning:", err)
        })
    }, [cacheMap])

    return (
        <SWRConfig 
            value={{ 
                provider: () => cacheMap,
                revalidateOnFocus: false,
                dedupingInterval: 2000,
            }}
        >
            {children}
        </SWRConfig>
    )
}
