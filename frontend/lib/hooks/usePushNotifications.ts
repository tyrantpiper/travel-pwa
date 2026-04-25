"use client"

import { useState, useEffect, useCallback } from "react"
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

    // 初始化：檢查當前權限與訂閱狀態
    useEffect(() => {
        if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
            setPermissionState("unsupported")
            return
        }

        setPermissionState(Notification.permission as PermissionState)

        // 檢查是否已有訂閱
        navigator.serviceWorker.ready.then((registration) => {
            registration.pushManager.getSubscription().then((subscription) => {
                setIsSubscribed(!!subscription)
            })
        })
    }, [])

    // 訂閱推播
    const subscribe = useCallback(async (): Promise<boolean> => {
        if (permissionState === "unsupported") return false
        setIsLoading(true)

        try {
            // 1. 請求權限
            const permission = await Notification.requestPermission()
            setPermissionState(permission as PermissionState)

            if (permission !== "granted") {
                setIsLoading(false)
                return false
            }

            // 2. 取得 VAPID 公鑰
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            if (!vapidKey) {
                console.error("[Push] VAPID public key not configured")
                setIsLoading(false)
                return false
            }

            // 3. 訂閱 Push Manager
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
            })

            // 4. 將訂閱憑證存入 Supabase
            const userId = localStorage.getItem("user_uuid")
            if (!userId) {
                console.error("[Push] No user_uuid found")
                setIsLoading(false)
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
                    setIsLoading(false)
                    return false
                }
            }

            setIsSubscribed(true)
            setIsLoading(false)
            return true
        } catch (error) {
            console.error("[Push] Subscribe failed:", error)
            setIsLoading(false)
            return false
        }
    }, [permissionState])

    // 取消訂閱
    const unsubscribe = useCallback(async (): Promise<boolean> => {
        setIsLoading(true)

        try {
            const registration = await navigator.serviceWorker.ready
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

            setIsSubscribed(false)
            setIsLoading(false)
            return true
        } catch (error) {
            console.error("[Push] Unsubscribe failed:", error)
            setIsLoading(false)
            return false
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
 * 將 Base64 URL 編碼的字串轉為 Uint8Array
 * (PushManager.subscribe 所需格式)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}
