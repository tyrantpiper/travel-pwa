"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { BottomNav } from "@/components/bottom-nav"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { BackToTop } from "@/components/ui/back-to-top" // 🆕
import { useServiceWorker } from "@/lib/hooks"
import { useScrollState } from "@/lib/hooks/useScrollState" // 🆕
import { debugLog } from "@/lib/debug"

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
        <div className="flex-1 p-6 bg-stone-50 animate-pulse">
            <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 bg-stone-200/40 rounded-3xl" />
                ))}
            </div>
        </div>
    )
})
const ProfileView = dynamic(() => import("@/components/views/profile-view").then(mod => mod.ProfileView), {
    ssr: false,
    loading: () => (
        <div className="flex-1 flex flex-col bg-stone-50 animate-pulse">
            <div className="h-48 bg-stone-200/40" />
            <div className="p-6 -mt-12 space-y-6">
                <div className="w-24 h-24 bg-stone-300/50 rounded-full border-4 border-white" />
                <div className="space-y-3">
                    <div className="h-6 bg-stone-200/50 rounded-lg w-1/3" />
                    <div className="h-4 bg-stone-200/30 rounded-lg w-1/4" />
                </div>
            </div>
        </div>
    )
})

export function AppShell() {
    const [activeView, setActiveView] = useState("itinerary")
    // 💡 Preheat 旗標：決定是否在背景偷偷加載並渲染隱藏視圖
    const [shouldPreheat, setShouldPreheat] = useState(false)

    // 🆕 滾動狀態監測 (2026 Smart UI)
    const { isNavVisible, showTopButton, scrollToTop } = useScrollState()

    // Register Service Worker in production
    useServiceWorker()

    // Listen for navigation events from other components
    useEffect(() => {
        const handleNavigateToProfile = () => setActiveView("profile")
        window.addEventListener('navigate-to-profile', handleNavigateToProfile)
        return () => window.removeEventListener('navigate-to-profile', handleNavigateToProfile)
    }, [])

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
            <div className="h-screen bg-background flex flex-col overflow-hidden">
                <main className="flex-1 flex flex-col min-h-0" data-scroll="true">

                    {/* ItineraryView (Critical Path - Now Dynamic & Preheated) */}
                    <div className={activeView === "itinerary" ? "flex-1 h-full min-h-0 overflow-hidden" : "hidden"}>
                        {(activeView === "itinerary" || shouldPreheat) && <ItineraryView />}
                    </div>

                    {/* Lazy components with Preheat guard */}
                    <div className={activeView === "info" ? "flex-1 h-full overflow-hidden" : "hidden"}>
                        {(activeView === "info" || shouldPreheat) && <InfoView />}
                    </div>

                    <div className={activeView === "tools" ? "flex-1 h-full overflow-hidden" : "hidden"}>
                        {(activeView === "tools" || shouldPreheat) && <ToolsView />}
                    </div>

                    <div className={activeView === "profile" ? "flex-1 h-full overflow-hidden" : "hidden"}>
                        {(activeView === "profile" || shouldPreheat) && <ProfileView />}
                    </div>

                </main>
                <BottomNav 
                    activeTab={activeView} 
                    onTabChange={setActiveView} 
                    isVisible={isNavVisible} // 🆕 滾動時自動隱藏
                />
                
                {/* 🆕 智能回頂部按鈕 */}
                <BackToTop 
                    isVisible={showTopButton} 
                    onClick={scrollToTop} 
                />
            </div>
        </>
    )
}
