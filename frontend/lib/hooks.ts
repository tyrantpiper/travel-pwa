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
