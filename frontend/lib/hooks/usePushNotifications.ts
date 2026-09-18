"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { getSupabaseClient } from "@/lib/supabase"

/**
 * Web Push Notification 訂閱管理 Hook
 * 
 * 功能：
 * - 檢查瀏覽器推播權限狀態
 * - 訂閱/取消訂閱 Web Push
 * - 將訂閱憑證同步到 Supabase push_subscriptions 表
 * 
 * 使用方式：
 * const { permissionState, isSubscribed, subscribe, unsubscribe } = usePushNotifications()
 */

type PermissionState = "default" | "granted" | "denied" | "unsupported"

export function usePushNotifications() {
    const [permissionState, setPermissionState] = useState<PermissionState>("default")
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const autoSubscribedRef = useRef(false)

    // 初始化：檢查當前權限與訂閱狀態
    useEffect(() => {
        // 利用 Promise.resolve().then 將 setState 放入 Microtask 佇列避免 SSR/React 警告
        Promise.resolve().then(() => {
            if (
                typeof window === "undefined" ||
                !("Notification" in window) ||
                !("serviceWorker" in navigator) ||
                !("PushManager" in window)
            ) {
                setPermissionState("unsupported")
                return
            }
            setPermissionState(Notification.permission as PermissionState)
        })

        // 靜默補訂閱函數 (僅在已授權且使用者未曾手動退訂時執行)
        const performSilentSubscription = async () => {
            try {
                const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
                if (!vapidKey) return
                
                const registration = await getReadyServiceWorker(5000)
                if (!registration || !registration.pushManager) return

                const newSubscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidKey),
                })

                const userId = localStorage.getItem("user_uuid")
                if (!userId) return

                const subscriptionJson = newSubscription.toJSON()
                const supabase = getSupabaseClient()

                if (supabase) {
                    await supabase.from("push_subscriptions").upsert(
                        {
                            user_id: userId,
                            endpoint: subscriptionJson.endpoint,
                            p256dh: subscriptionJson.keys?.p256dh || "",
                            auth: subscriptionJson.keys?.auth || "",
                            user_agent: navigator.userAgent,
                            updated_at: new Date().toISOString(),
                        },
                        { onConflict: "user_id,endpoint" }
                    )
                }
                setIsSubscribed(true)
            } catch (error) {
                console.error("[Push] Auto-subscribe failed:", error)
            }
        }

        // 檢查是否已有訂閱 (支援 pushManager 缺失防禦、手動 opt-out 意圖守護與按需逾時防衛)
        if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
            const checkInitialSubscription = async () => {
                const userOptedOut = typeof window !== "undefined" && localStorage.getItem("push_opt_out") === "true"

                let registration: ServiceWorkerRegistration | null | undefined = await navigator.serviceWorker.getRegistration()
                if (!registration && Notification.permission === "granted" && !userOptedOut) {
                    registration = await getReadyServiceWorker(3000)
                } else if (registration) {
                    const readyReg = await Promise.race([
                        navigator.serviceWorker.ready,
                        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
                    ])
                    if (readyReg) registration = readyReg as ServiceWorkerRegistration
                }

                if (!registration || !registration.pushManager) {
                    return
                }

                try {
                    const subscription = await registration.pushManager.getSubscription()
                    if (subscription) {
                        setIsSubscribed(true)
                    } else if (Notification.permission === "granted" && !userOptedOut && !autoSubscribedRef.current) {
                        autoSubscribedRef.current = true
                        performSilentSubscription()
                    }
                } catch {
                    // Ignore background read errors
                }
            }

            checkInitialSubscription().catch(() => {})
        }

        // 監聽全域推播狀態變更事件，消滅跨組件狀態孤島
        const handlePushStatusChange = (e: Event) => {
            const customEvent = e as CustomEvent<{ isSubscribed: boolean; permission?: PermissionState }>
            if (customEvent.detail) {
                if (typeof customEvent.detail.isSubscribed === "boolean") {
                    setIsSubscribed(customEvent.detail.isSubscribed)
                }
                if (customEvent.detail.permission) {
                    setPermissionState(customEvent.detail.permission)
                }
            }
        }

        window.addEventListener("tabidachi-push-status-change", handlePushStatusChange)
        return () => {
            window.removeEventListener("tabidachi-push-status-change", handlePushStatusChange)
        }
    }, [])

    // 訂閱推播
    const subscribe = useCallback(async (timeoutMs = 5000): Promise<boolean> => {
        if (permissionState === "unsupported") return false
        setIsLoading(true)

        try {
            // 1. 請求權限
            const permission = await Notification.requestPermission()
            setPermissionState(permission as PermissionState)

            if (permission !== "granted") {
                return false
            }

            // 2. 取得 VAPID 公鑰
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            if (!vapidKey) {
                console.error("[Push] VAPID public key not configured")
                return false
            }

            // 3. 訂閱 Push Manager (防禦 pushManager 缺失與 ready 掛死)
            const registration = await getReadyServiceWorker(timeoutMs)
            if (!registration || !registration.pushManager) {
                console.error("[Push] PushManager not ready or not supported in current context")
                return false
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            })

            // 4. 將訂閱憑證存入 Supabase
            const userId = localStorage.getItem("user_uuid")
            if (!userId) {
                console.error("[Push] No user_uuid found")
                return false
            }

            const subscriptionJson = subscription.toJSON()
            const supabase = getSupabaseClient()

            if (supabase) {
                const { error } = await supabase
                    .from("push_subscriptions")
                    .upsert(
                        {
                            user_id: userId,
                            endpoint: subscriptionJson.endpoint,
                            p256dh: subscriptionJson.keys?.p256dh || "",
                            auth: subscriptionJson.keys?.auth || "",
                            user_agent: navigator.userAgent,
                            updated_at: new Date().toISOString(),
                        },
                        { onConflict: "user_id,endpoint" }
                    )

                if (error) {
                    console.error("[Push] Failed to save subscription:", error)
                    return false
                }
            }

            // 清除使用者手動關閉標記
            if (typeof window !== "undefined") {
                localStorage.removeItem("push_opt_out")
            }

            setIsSubscribed(true)

            // 跨組件同步廣播
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("tabidachi-push-status-change", {
                    detail: { isSubscribed: true, permission: "granted" }
                }))
            }
            return true
        } catch (error) {
            console.error("[Push] Subscribe failed:", error)
            return false
        } finally {
            setIsLoading(false)
        }
    }, [permissionState])

    // 取消訂閱
    const unsubscribe = useCallback(async (): Promise<boolean> => {
        setIsLoading(true)

        try {
            const registration = await getReadyServiceWorker(3000)
            if (registration && registration.pushManager) {
                const subscription = await registration.pushManager.getSubscription()

                if (subscription) {
                    // 從 Supabase 刪除
                    const userId = localStorage.getItem("user_uuid")
                    const supabase = getSupabaseClient()
                    if (supabase && userId) {
                        await supabase
                            .from("push_subscriptions")
                            .delete()
                            .eq("user_id", userId)
                            .eq("endpoint", subscription.endpoint)
                    }

                    // 取消瀏覽器訂閱
                    await subscription.unsubscribe()
                }
            }

            // 記錄使用者主動退出意圖，防止背景重整時自動流氓重開
            if (typeof window !== "undefined") {
                localStorage.setItem("push_opt_out", "true")
            }

            setIsSubscribed(false)

            // 跨組件同步廣播
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("tabidachi-push-status-change", {
                    detail: { isSubscribed: false }
                }))
            }
            return true
        } catch (error) {
            console.error("[Push] Unsubscribe failed:", error)
            return false
        } finally {
            setIsLoading(false)
        }
    }, [])

    return {
        permissionState,
        isSubscribed,
        isLoading,
        subscribe,
        unsubscribe,
        isSupported: permissionState !== "unsupported",
    }
}

/**
 * 安全取得已就緒之 Service Worker Registration
 * 1. 若當前尚未註冊（例如 localhost 開發模式），動態按需觸發 register('/sw.js')
 * 2. 透過 Promise.race 與硬逾時防衛，杜絕 navigator.serviceWorker.ready 無限掛死
 */
async function getReadyServiceWorker(timeoutMs = 5000): Promise<ServiceWorkerRegistration | null> {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
        return null
    }

    try {
        let reg = await navigator.serviceWorker.getRegistration()
        if (!reg) {
            try {
                reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
            } catch (regErr) {
                console.warn("[Push] Dynamic service worker register failed:", regErr)
            }
        }

        const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), timeoutMs)
        })

        const readyReg = await Promise.race([
            navigator.serviceWorker.ready,
            timeoutPromise
        ])

        return (readyReg as ServiceWorkerRegistration) || reg || null
    } catch (err) {
        console.warn("[Push] Error obtaining service worker registration:", err)
        return null
    }
}

/**
 * 將 Base64 URL 編碼的字串轉為 Uint8Array
 * (PushManager.subscribe 所需格式)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const rawData = window.atob(base64)
    const buffer = new ArrayBuffer(rawData.length)
    const outputArray = new Uint8Array(buffer)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}
