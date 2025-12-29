import useSWR from "swr"
import { useState, useEffect } from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const fetcher = (url: string) => fetch(url).then(r => r.json())

const fetcherWithUserId = ([url, uid]: [string, string]) =>
    fetch(API_BASE + url, { headers: { "X-User-ID": uid } }).then(r => r.json())

export function useTrips(userId: string | null) {
    const { data, error, mutate } = useSWR(
        userId ? ["/api/trips", userId] : null,
        fetcherWithUserId,
        { revalidateOnFocus: false }
    )
    return {
        trips: data || [],
        isLoading: !error && !data,
        isError: error,
        mutate
    }
}

export function useTripDetail(tripId: string | null, userId?: string | null) {
    // 🔧 FIX: Include userId in cache key to ensure refetch when userId changes
    // And only make the request when we have a valid userId to prevent unauthenticated fetches
    const { data, error, mutate } = useSWR(
        // Only fetch when both tripId and userId are available
        (tripId && userId) ? [`/api/trips/${tripId}`, userId] : null,
        ([url, uid]: [string, string]) =>
            fetch(API_BASE + url, {
                headers: { "X-User-ID": uid }
            }).then(r => r.json()),
        {
            revalidateOnFocus: false,
            revalidateOnMount: true
        }
    )
    return {
        trip: data,
        isLoading: !error && !data,
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
    const vibrate = (pattern: number | number[]) => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(pattern)
        }
    }

    return {
        /** Light tap - for button clicks */
        tap: () => vibrate(10),
        /** Medium feedback - for successful actions */
        success: () => vibrate([10, 50, 10]),
        /** Strong feedback - for errors or warnings */
        error: () => vibrate([50, 30, 50]),
        /** Custom pattern */
        custom: (pattern: number | number[]) => vibrate(pattern)
    }
}

/**
 * Online status hook for detecting network connectivity
 * Usage: const isOnline = useOnlineStatus();
 * Returns false when user is offline, useful for showing offline notifications
 */
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(true)

    useEffect(() => {
        // Set initial state (only in browser)
        if (typeof window !== 'undefined') {
            setIsOnline(navigator.onLine)
        }

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
