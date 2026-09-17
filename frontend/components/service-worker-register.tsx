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
            let activeRegistration: ServiceWorkerRegistration | null = null

            // 🚀 1. 監聽前台恢復 (Resume from background)：主動觸發背景更新
            const handleVisibilityChange = () => {
                if (document.visibilityState === "visible" && navigator.onLine && activeRegistration) {
                    activeRegistration.update().catch(() => {})
                }
            }
            document.addEventListener("visibilitychange", handleVisibilityChange)

            // 🚀 2. 註冊 Service Worker (強制切斷 WebKit 內部 HTTP 快取)
            navigator.serviceWorker
                .register("/sw.js", { updateViaCache: "none" })
                .then((registration) => {
                    activeRegistration = registration
                    console.log("[SW] Registered with scope:", registration.scope)

                    // 啟動時主動檢查更新
                    registration.update().catch(() => {})

                    // 若有等待中的 SW，主動通知 skipWaiting
                    if (registration.waiting) {
                        registration.waiting.postMessage({ type: "SKIP_WAITING" })
                    }
                })
                .catch((error) => {
                    console.error("[SW] Registration failed:", error)
                })

            // 🛡️ 記錄頁面載入時是否已有舊版 Controller 控制
            const hadControllerAtLaunch = Boolean(navigator.serviceWorker.controller)
            let isReloading = false

            // 🚀 3. 當 SW 控制權切換時 (New SW Activated)，執行熱重載
            const handleControllerChange = () => {
                console.log("⚡ [SW] Controller changed: New SW is now in control.")
                // 🛡️ 防禦性判定：只有在非初次安裝（確定為版本升級）且尚未重載過時才刷新
                if (hadControllerAtLaunch && !isReloading) {
                    isReloading = true
                    console.log("🔄 [SW] Applying latest update seamlessly...")
                    window.location.reload()
                }
            }
            navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)

            return () => {
                document.removeEventListener("visibilitychange", handleVisibilityChange)
                navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
            }
        }
    }, [])

    return null
}
