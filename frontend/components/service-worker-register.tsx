"use client"

import { useEffect } from "react"

/**
 * 全域 Service Worker 註冊器
 * 於 RootLayout 頂層掛載，確保使用者進入網站的第一秒即開始註冊與快取資產
 */
export function ServiceWorkerRegister() {
    useEffect(() => {
        if (
            typeof window !== "undefined" &&
            "serviceWorker" in navigator &&
            process.env.NODE_ENV === "production"
        ) {
            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                    console.log("[SW] Registered with scope:", registration.scope)
                })
                .catch((error) => {
                    console.error("[SW] Registration failed:", error)
                })
        }
    }, [])

    return null
}
