"use client"

import { useEffect, useCallback } from "react"
import { useTripStore } from "@/lib/stores/tripStore"
import { debugLog } from "@/lib/debug"

const VALID_TABS = ["itinerary", "info", "tools", "profile"] as const
type ValidTab = typeof VALID_TABS[number]

interface UseDeepLinkRouterOptions {
    onTabChange: (tab: string) => void
}

/**
 * 🧭 useDeepLinkRouter
 * Parses URL query parameters (?trip=...&tab=...&expense_id=...&day=...)
 * and synchronizes state with Zustand tripStore, active tab navigation,
 * and pending deep links from session storage.
 */
export function useDeepLinkRouter({ onTabChange }: UseDeepLinkRouterOptions) {
    const setActiveTripId = useTripStore((s) => s.setActiveTripId)
    const setFocusedDay = useTripStore((s) => s.setFocusedDay)
    const setTargetExpenseId = useTripStore((s) => s.setTargetExpenseId)

    const processDeepLink = useCallback((searchStr: string) => {
        if (!searchStr && typeof window !== "undefined") {
            const pending = sessionStorage.getItem("pending_deep_link")
            if (pending) {
                sessionStorage.removeItem("pending_deep_link")
                searchStr = pending
            }
        }

        if (!searchStr) return

        try {
            const params = new URLSearchParams(searchStr.startsWith("?") ? searchStr : `?${searchStr}`)
            const tripId = params.get("trip")
            let tab = params.get("tab")
            const expenseId = params.get("expense_id")
            const dayStr = params.get("day")

            debugLog("🧭 [DeepLinkRouter] Processing query params:", { tripId, tab, expenseId, dayStr })

            // 1. Trip ID synchronization
            if (tripId) {
                const currentActive = useTripStore.getState().activeTripId
                if (currentActive !== tripId) {
                    setActiveTripId(tripId)
                    if (typeof window !== "undefined") {
                        localStorage.setItem("active_trip_id", tripId)
                    }
                }
            }

            // 2. Day synchronization (0 = Overview, 1..N = Specific Day)
            if (dayStr !== null && dayStr !== undefined) {
                const dayNum = parseInt(dayStr, 10)
                if (!isNaN(dayNum) && dayNum >= 0) {
                    setFocusedDay(dayNum)
                }
            }

            // 3. Expense ID synchronization
            if (expenseId) {
                setTargetExpenseId(expenseId)
                if (!tab) {
                    tab = "tools" // Default to tools view if expense_id is specified
                }
            }

            // 4. Tab navigation
            if (tab && VALID_TABS.includes(tab as ValidTab)) {
                onTabChange(tab)
            } else if (dayStr !== null && !tab) {
                onTabChange("itinerary") // Default to itinerary if day is specified
            }

            // 5. Clean up temporary target parameters to avoid re-trigger on user refresh
            if (expenseId && typeof window !== "undefined") {
                const url = new URL(window.location.href)
                url.searchParams.delete("expense_id")
                window.history.replaceState({}, "", url.pathname + url.search)
            }
        } catch (err) {
            console.error("❌ [DeepLinkRouter] Error parsing deep link:", err)
        }
    }, [setActiveTripId, setFocusedDay, setTargetExpenseId, onTabChange])

    useEffect(() => {
        if (typeof window === "undefined") return

        // Process initial URL query string on mount
        processDeepLink(window.location.search)

        // Listen for popstate / browser back-forward
        const handlePopState = () => {
            processDeepLink(window.location.search)
        }

        // Listen for internal programmatic deep links
        const handleCustomDeepLink = (e: Event) => {
            const customEvent = e as CustomEvent<{ link?: string; search?: string }>
            const target = customEvent.detail?.search || customEvent.detail?.link || ""
            if (target) {
                const searchPart = target.includes("?") ? target.split("?")[1] : target
                processDeepLink(searchPart)
            }
        }

        window.addEventListener("popstate", handlePopState)
        window.addEventListener("tabidachi-deep-link", handleCustomDeepLink)

        return () => {
            window.removeEventListener("popstate", handlePopState)
            window.removeEventListener("tabidachi-deep-link", handleCustomDeepLink)
        }
    }, [processDeepLink])
}

/**
 * Dispatches an in-app deep link event for immediate synchronous handling
 */
export function dispatchDeepLink(link: string) {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("tabidachi-deep-link", { detail: { link } }))
    }
}
