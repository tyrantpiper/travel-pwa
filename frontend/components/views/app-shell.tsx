"use client"

import { useState, useEffect } from "react"
import { ItineraryView } from "@/components/views/itinerary-view"
import { InfoView } from "@/components/views/info-view"
import { ToolsView } from "@/components/views/tools-view"
import { ProfileView } from "@/components/views/profile-view"
import { BottomNav } from "@/components/bottom-nav"
import { TripProvider } from "@/lib/trip-context"

export function AppShell() {
    const [activeView, setActiveView] = useState("itinerary")

    // Listen for navigation events from other components
    useEffect(() => {
        const handleNavigateToProfile = () => setActiveView("profile")
        window.addEventListener('navigate-to-profile', handleNavigateToProfile)
        return () => window.removeEventListener('navigate-to-profile', handleNavigateToProfile)
    }, [])

    return (
        <TripProvider>
            <div className="min-h-screen bg-background flex flex-col">
                <main className="flex-1 pb-20 overflow-y-auto">
                    <div className={activeView === "itinerary" ? "block" : "hidden"}><ItineraryView /></div>
                    <div className={activeView === "info" ? "block" : "hidden"}><InfoView /></div>
                    <div className={activeView === "tools" ? "block" : "hidden"}><ToolsView /></div>
                    <div className={activeView === "profile" ? "block" : "hidden"}><ProfileView /></div>
                </main>
                <BottomNav activeTab={activeView} onTabChange={setActiveView} />
            </div>
        </TripProvider>
    )
}
