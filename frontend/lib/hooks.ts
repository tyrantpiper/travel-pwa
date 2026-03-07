import useSWR from "swr"
import { useState, useEffect, useCallback, useMemo } from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"


import { toast } from "sonner"

export const fetcherWithUserId = ([url, uid]: [string, string]) =>
    fetch(API_BASE + url, { headers: { "X-User-ID": uid } })
        .then(r => r.json())
        .catch(err => {
            console.error("fetcher error:", err);
            toast.error("伺服器連線失敗，請稍後再試 (Server connection failed)");
            throw err;
        })

export function useTrips(userId: string | null) {
    const { data, error, mutate } = useSWR(
        userId ? ["/api/trips", userId] : null,
        fetcherWithUserId,
        { revalidateOnFocus: false }
    )
    return {
        trips: Array.isArray(data) ? data : [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useTripDetail(tripId: string | null, userId?: string | null, refreshInterval: number = 0) {
    // 🔧 FIX: Include userId in cache key to ensure refetch when userId changes
    // And only make the request when we have a valid userId to prevent unauthenticated fetches
    // 🧠 2026 Normalization: userId is critical for privacy-aware caching
    const swrKey = (tripId && userId) ? [`/api/trips/${tripId}`, userId] : null

    const { data, error, mutate, isValidating } = useSWR(
        swrKey,
        ([url, uid]: [string, string]) =>
            fetch(API_BASE + url, {
                headers: { "X-User-ID": uid }
            }).then(r => r.json())
                .catch(err => {
                    console.error("fetcher error:", err);
                    toast.error("伺服器連線失敗，請稍後再試 (Server connection failed)");
                    throw err;
                }),
        {
            revalidateOnFocus: false,
            revalidateOnMount: true,
            refreshInterval, // 🆕 Hyper-Heuristics Injection
            dedupingInterval: 2000 // Prevent spam
        }
    )

    // 🔧 FIX: 當 userId 從 Zustand hydration 準備好後，強制刷新
    // 這解決了首次載入時資料不顯示的問題
    useEffect(() => {
        if (userId && tripId && mutate) {
            mutate()
        }
    }, [userId, tripId, mutate])

    return {
        trip: data,
        isLoading: !error && !data,
        isValidating,  // 🆕 Indicates SWR is fetching fresh data (even with cache)
        isError: error,
        mutate
    }
}

export function useExpenses(tripId: string | null, userId: string | null) {
    const { data, error, mutate } = useSWR(
        (tripId && userId) ? [`/api/trips/${tripId}/expenses`, userId] : null,
        fetcherWithUserId,
        { revalidateOnFocus: false }
    )
    return {
        expenses: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

/**
 * Haptic feedback hook for mobile devices
 * Usage: const haptic = useHaptic(); haptic.tap();
 */
export function useHaptic() {
    const vibrate = useCallback((pattern: number | number[]) => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(pattern)
        }
    }, [])

    return useMemo(() => ({
        /** Light tap - for button clicks */
        tap: () => vibrate(10),
        /** Medium feedback - for successful actions */
        success: () => vibrate([10, 50, 10]),
        /** Strong feedback - for errors or warnings */
        error: () => vibrate([50, 30, 50]),
        /** Custom pattern */
        custom: (pattern: number | number[]) => vibrate(pattern)
    }), [vibrate])
}

/**
 * Online status hook for detecting network connectivity
 * Usage: const isOnline = useOnlineStatus();
 * Returns false when user is offline, useful for showing offline notifications
 */
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(true)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync with browser state on mount
        setIsOnline(navigator.onLine)

        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    return isOnline
}

/**
 * Service Worker registration hook
 * Only registers in production environment
 */
export function useServiceWorker() {
    useEffect(() => {
        if (
            typeof window !== 'undefined' &&
            'serviceWorker' in navigator &&
            process.env.NODE_ENV === 'production'
        ) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('SW registered:', registration.scope)
                })
                .catch((error) => {
                    console.error('SW registration failed:', error)
                })
        }
    }, [])
}
