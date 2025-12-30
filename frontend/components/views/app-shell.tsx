"use client"

import { useState, useEffect } from "react"
import { ItineraryView } from "@/components/views/itinerary-view"
import { InfoView } from "@/components/views/info-view"
import { ToolsView } from "@/components/views/tools-view"
import { ProfileView } from "@/components/views/profile-view"
import { BottomNav } from "@/components/bottom-nav"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { useServiceWorker } from "@/lib/hooks"

export function AppShell() {
    const [activeView, setActiveView] = useState("itinerary")

    // Register Service Worker in production
    useServiceWorker()

    // Listen for navigation events from other components
    useEffect(() => {
        const handleNavigateToProfile = () => setActiveView("profile")
        window.addEventListener('navigate-to-profile', handleNavigateToProfile)
        return () => window.removeEventListener('navigate-to-profile', handleNavigateToProfile)
    }, [])

    return (
        <>
            <OfflineBanner />
            <div className="min-h-screen bg-background flex flex-col">
                {/* 🔧 Mobile Optimization: overscroll-none (prevents browser pull-to-refresh), touch-pan-y (optimizes vertical scroll) */}
                <main className="flex-1 pb-20 overflow-y-auto overscroll-none touch-pan-y" data-scroll="true">
                    <div className={activeView === "itinerary" ? "block" : "hidden"}><ItineraryView /></div>
                    <div className={activeView === "info" ? "block" : "hidden"}><InfoView /></div>
                    <div className={activeView === "tools" ? "block" : "hidden"}><ToolsView /></div>
                    <div className={activeView === "profile" ? "block" : "hidden"}><ProfileView /></div>
                </main>
                <BottomNav activeTab={activeView} onTabChange={setActiveView} />
            </div>
        </>
    )
}

