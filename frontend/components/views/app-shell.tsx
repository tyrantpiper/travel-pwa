"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { ItineraryView } from "@/components/views/itinerary-view"
import { BottomNav } from "@/components/bottom-nav"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { useServiceWorker } from "@/lib/hooks"
import { debugLog } from "@/lib/debug"

// 🚀 [2026 Smart Hybrid Loading] 
// 將非核心視圖轉為動態載入，減少初始 Bundle
const InfoView = dynamic(() => import("@/components/views/info-view").then(mod => mod.InfoView), {
    ssr: false,
    loading: () => <div className="flex-1 flex items-center justify-center bg-background"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
})
const ToolsView = dynamic(() => import("@/components/views/tools-view").then(mod => mod.ToolsView), {
    ssr: false,
    loading: () => <div className="flex-1 flex items-center justify-center bg-background"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
})
const ProfileView = dynamic(() => import("@/components/views/profile-view").then(mod => mod.ProfileView), {
    ssr: false,
    loading: () => <div className="flex-1 flex items-center justify-center bg-background"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
})

export function AppShell() {
    const [activeView, setActiveView] = useState("itinerary")
    // 💡 Preheat 旗標：決定是否在背景偷偷加載並渲染隱藏視圖
    const [shouldPreheat, setShouldPreheat] = useState(false)

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
                <main className="flex-1 pb-20 flex flex-col min-h-0" data-scroll="true">

                    {/* ItineraryView (Critical Path) */}
                    <div className={activeView === "itinerary" ? "flex-1 h-full min-h-0 overflow-hidden" : "hidden"}>
                        <ItineraryView />
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
                <BottomNav activeTab={activeView} onTabChange={setActiveView} />
            </div>
        </>
    )
}
