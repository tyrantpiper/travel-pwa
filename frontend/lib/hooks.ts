import useSWR from "swr"

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

export function useTripDetail(tripId: string | null) {
    const { data, error, mutate } = useSWR(
        tripId ? `${API_BASE}/api/trips/${tripId}` : null,
        fetcher,
        { revalidateOnFocus: false }
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
