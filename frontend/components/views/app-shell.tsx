"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { PushPermissionPrompt } from "@/components/notifications/push-permission-prompt"
import dynamic from "next/dynamic"
import { BottomNav } from "@/components/bottom-nav"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { useHaptic } from "@/lib/hooks"
import { useScrollState } from "@/lib/hooks/useScrollState" // 🆕
import { useDeepLinkRouter } from "@/lib/hooks/useDeepLinkRouter" // 🧭
import { debugLog } from "@/lib/debug"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { AIStatusButton } from "@/components/ai/ai-status-button"
import { SyncStatusCapsule } from "@/components/layout/SyncStatusCapsule"
import { useTripRealtime } from "@/lib/hooks/useTripRealtime"
import { useTripContext } from "@/lib/trip-context"

import { motion } from "framer-motion"

const TAB_INDICES: Record<string, number> = {
    itinerary: 0,
    info: 1,
    tools: 2,
    profile: 3,
}

// 🚀 [Perf Audit 2026] 將最強大的核心視圖 (ItineraryView) 也改為動態載入
// 配合 Stealth Preheat 機制，達成「啟動極速」與「切換即時」
const ItineraryView = dynamic(() => import("@/components/views/itinerary-view").then(mod => mod.ItineraryView), {
    ssr: false,
    loading: () => (
        <div className="flex-1 flex flex-col bg-stone-50 animate-pulse">
            <div className="h-20 bg-white/50 border-b border-stone-100" />
            <div className="p-6 space-y-6">
                <div className="h-8 bg-stone-200/50 rounded-xl w-1/2" />
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 bg-stone-200/30 rounded-2xl w-full" />
                    ))}
                </div>
            </div>
        </div>
    )
})

// 🚀 [2026 Smart Hybrid Loading] 
// 將非核心視圖轉為動態載入，減少初始 Bundle
const InfoView = dynamic(() => import("@/components/views/info-view").then(mod => mod.InfoView), {
    ssr: false,
    loading: () => (
        <div className="flex-1 flex flex-col bg-stone-50 animate-pulse p-6 space-y-8">
            <div className="h-12 bg-stone-200/50 rounded-2xl w-3/4" />
            <div className="space-y-4">
                <div className="h-40 bg-stone-200/30 rounded-3xl w-full" />
                <div className="h-40 bg-stone-200/30 rounded-3xl w-full" />
            </div>
        </div>
    )
})
const ToolsView = dynamic(() => import("@/components/views/tools-view").then(mod => mod.ToolsView), {
    ssr: false,
    loading: () => (
        <div className="flex-1 flex flex-col bg-stone-50 animate-pulse p-6 space-y-6">
            <div className="h-10 bg-stone-200/50 rounded-xl w-1/3" />
            <div className="h-48 bg-stone-200/30 rounded-3xl w-full" />
            <div className="h-32 bg-stone-200/30 rounded-3xl w-full" />
        </div>
    )
})
const ProfileView = dynamic(() => import("@/components/views/profile-view").then(mod => mod.ProfileView), {
    ssr: false,
    loading: () => (
        <div className="flex-1 flex flex-col bg-stone-50 animate-pulse p-6 space-y-6">
            <div className="h-20 bg-stone-200/50 rounded-2xl w-full" />
            <div className="space-y-3">
                <div className="h-12 bg-stone-200/30 rounded-xl w-full" />
                <div className="h-12 bg-stone-200/30 rounded-xl w-full" />
            </div>
        </div>
    )
})

export function AppShell() {
    const { activeTripId, userId } = useTripContext()
    // 🔄 E6: Supabase Realtime 跨裝置即時協同
    useTripRealtime(activeTripId, userId)

    const [activeView, setActiveView] = useState("itinerary")
    const [direction, setDirection] = useState<1 | -1>(1)
    const prevViewRef = useRef(activeView)

    const handleTabChange = useCallback((nextTab: string) => {
        const prevIdx = TAB_INDICES[prevViewRef.current] ?? 0
        const nextIdx = TAB_INDICES[nextTab] ?? 0
        setDirection(nextIdx >= prevIdx ? 1 : -1)
        prevViewRef.current = nextTab
        setActiveView(nextTab)
    }, [])

    // 🧭 全域深度連結監聽與路由調度器
    useDeepLinkRouter({ onTabChange: handleTabChange })

    // 💡 Preheat 旗標：決定是否在背景偷偷加載並渲染隱藏視圖
    const [shouldPreheat, setShouldPreheat] = useState(false)

    // 🔔 推播授權引導（首次登入 3 秒後顯示）
    const [showPushPrompt, setShowPushPrompt] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            if (
                typeof window !== "undefined" &&
                "Notification" in window &&
                Notification.permission === "default" &&
                !localStorage.getItem("push_prompt_dismissed")
            ) {
                setShowPushPrompt(true)
            }
        }, 3000)
        return () => clearTimeout(timer)
    }, [])

    // 🆕 滾動狀態監測 (2026 Smart UI)
    const { isNavVisible, isAtTop, scrollToTop } = useScrollState()
    const haptic = useHaptic() // 🆕 震動回饋

    // Listen for navigation events from other components
    useEffect(() => {
        const handleNavigateToProfile = () => handleTabChange("profile")
        const handleNavigateToTools = () => handleTabChange("tools")
        window.addEventListener('navigate-to-profile', handleNavigateToProfile)
        window.addEventListener('navigate-to-tools', handleNavigateToTools)
        return () => {
            window.removeEventListener('navigate-to-profile', handleNavigateToProfile)
            window.removeEventListener('navigate-to-tools', handleNavigateToTools)
        }
    }, [handleTabChange])

    // 🕵️‍♂️ [Stealth Preheat] 隱形預熱機制 (Idle-Until-Urgent)
    useEffect(() => {
        const preheatTimer = setTimeout(() => {
            if (!shouldPreheat) {
                setShouldPreheat(true)
                debugLog("🚀 [AppShell] Stealth preheat initiated (Background)")
            }
        }, 2000)

        // 使用類型安全的方式檢查並執行 idle callback
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            const win = window as unknown as Window & {
                requestIdleCallback: (callback: () => void, options?: { timeout: number }) => number;
                cancelIdleCallback: (handle: number) => void;
            };
            const handle = win.requestIdleCallback(() => {
                setShouldPreheat(true)
            }, { timeout: 4000 })

            return () => {
                clearTimeout(preheatTimer)
                win.cancelIdleCallback(handle)
            }
        }

        return () => clearTimeout(preheatTimer)
    }, [shouldPreheat])

    return (
        <>
            <OfflineBanner />
            <PushPermissionPrompt
                isOpen={showPushPrompt}
                onClose={() => {
                    setShowPushPrompt(false)
                    localStorage.setItem("push_prompt_dismissed", "1")
                }}
            />
            <div className="h-screen bg-background flex flex-col overflow-hidden">
                <main className="flex-1 flex flex-col min-h-0 relative" data-scroll="true">
                    {/* ✨ 全域 AI 狀態按鈕 — 左上角固定定位 (與右上角通知對稱) */}
                    <div className="absolute top-2 left-3 z-100">
                        <AIStatusButton />
                    </div>

                    {/* 🔔 通知鈴鐺與 ☁️ 離線同步狀態膠囊 — 右上角固定定位 */}
                    <div className="absolute top-2 right-3 z-100 flex items-center gap-2">
                        <SyncStatusCapsule />
                        <NotificationBell />
                    </div>

                    {/* ItineraryView (Critical Path - Now Dynamic & Preheated) */}
                    <div className={activeView === "itinerary" ? "flex-1 h-full min-h-0 overflow-hidden" : "hidden"}>
                        {(activeView === "itinerary" || shouldPreheat) && (
                            <motion.div
                                animate={activeView === "itinerary" ? { opacity: 1, x: 0 } : { opacity: 0.7, x: direction * 28 }}
                                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                                className="w-full h-full flex flex-col"
                            >
                                <ItineraryView />
                            </motion.div>
                        )}
                    </div>

                    {/* Lazy components with Preheat guard */}
                    <div className={activeView === "info" ? "flex-1 h-full overflow-hidden" : "hidden"}>
                        {(activeView === "info" || shouldPreheat) && (
                            <motion.div
                                animate={activeView === "info" ? { opacity: 1, x: 0 } : { opacity: 0.7, x: direction * 28 }}
                                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                                className="w-full h-full flex flex-col"
                            >
                                <InfoView />
                            </motion.div>
                        )}
                    </div>

                    <div className={activeView === "tools" ? "flex-1 h-full overflow-hidden" : "hidden"}>
                        {(activeView === "tools" || shouldPreheat) && (
                            <motion.div
                                animate={activeView === "tools" ? { opacity: 1, x: 0 } : { opacity: 0.7, x: direction * 28 }}
                                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                                className="w-full h-full flex flex-col"
                            >
                                <ToolsView />
                            </motion.div>
                        )}
                    </div>

                    <div className={activeView === "profile" ? "flex-1 h-full overflow-hidden" : "hidden"}>
                        {(activeView === "profile" || shouldPreheat) && (
                            <motion.div
                                animate={activeView === "profile" ? { opacity: 1, x: 0 } : { opacity: 0.7, x: direction * 28 }}
                                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                                className="w-full h-full flex flex-col"
                            >
                                <ProfileView />
                            </motion.div>
                        )}
                    </div>

                </main>
                <BottomNav 
                    activeTab={activeView} 
                    onTabChange={setActiveView} 
                    onActiveTabClick={() => {
                        if (!isAtTop) {
                            scrollToTop()
                            haptic.tap()
                        } else {
                            // 已經在頂端，觸發刷新
                            window.dispatchEvent(new CustomEvent('refresh-active-view'))
                            haptic.success()
                        }
                    }}
                    isVisible={isNavVisible} // 🆕 滾動時自動隱藏
                />
            </div>
        </>
    )
}
