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
                {/* 🔧 Phase 14: Scroll Architecture Refactor - AppShell no longer scrolls, each View manages its own scroll */}
                <main className="flex-1 pb-20 overflow-hidden flex flex-col" data-scroll="true">
                    <div className={activeView === "itinerary" ? "flex-1 h-full overflow-hidden" : "hidden"}><ItineraryView /></div>
                    <div className={activeView === "info" ? "flex-1 h-full overflow-hidden" : "hidden"}><InfoView /></div>
                    <div className={activeView === "tools" ? "flex-1 h-full overflow-hidden" : "hidden"}><ToolsView /></div>
                    <div className={activeView === "profile" ? "flex-1 h-full overflow-hidden" : "hidden"}><ProfileView /></div>
                </main>
                <BottomNav activeTab={activeView} onTabChange={setActiveView} />
            </div>
        </>
    )
}

