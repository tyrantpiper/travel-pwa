import useSWR from "swr"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { travelDataApi } from './api'
import { getTripSnapshotSync, saveTripSnapshot, preloadTripSnapshot, getTripsListSnapshotSync, preloadTripsListSnapshot, saveTripsListSnapshot } from './idb-storage'
import type { Trip } from './itinerary-types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8008"


import { toast } from "sonner"

export class HttpError extends Error {
    constructor(public status: number, message: string, public data?: unknown) {
        super(message)
        this.name = "HttpError"
    }
}

export const fetcherWithUserId = ([url, uid]: [string, string]) =>
    fetch(API_BASE + url, { headers: { "X-User-ID": uid } })
        .then(async r => {
            if (!r.ok) {
                const errorBody = await r.json().catch(() => ({}))
                if (r.status !== 404) {
                    toast.error("伺服器連線失敗，請稍後再試 (Server connection failed)")
                }
                throw new HttpError(r.status, errorBody?.detail || `HTTP ${r.status}`, errorBody)
            }
            return r.json()
        })
        .catch(err => {
            if (err instanceof HttpError) {
                throw err
            }
            // 🌐 網絡抖動或離線斷網（Failed to fetch / Connection Refused）
            // 降級為 warn，避免 Next.js Turbopack 誤將背景 SWR 離線輪詢當作 Fatal Error Overlay 彈窗阻擋
            console.warn("[Fetcher] Network degradation or offline:", err?.message || err)
            throw new HttpError(0, err?.message || "Network error", { offline: true })
        })

export function useTrips(userId: string | null) {
    const [idbTrips, setIdbTrips] = useState<Trip[] | null>(() => getTripsListSnapshotSync<Trip[]>(userId))

    useEffect(() => {
        if (userId && !idbTrips) {
            preloadTripsListSnapshot<Trip[]>(userId).then((data) => {
                if (data && Array.isArray(data) && data.length > 0) {
                    setIdbTrips(data)
                }
            })
        }
    }, [userId, idbTrips])

    const initialSnapshot = useMemo(() => getTripsListSnapshotSync<Trip[]>(userId) || idbTrips, [userId, idbTrips])
    const { data, error, mutate } = useSWR<Trip[]>(
        userId ? ["/api/trips", userId] : null,
        fetcherWithUserId,
        {
            fallbackData: initialSnapshot || undefined,
            revalidateOnFocus: false,
            onSuccess: (freshData) => {
                if (userId && freshData) {
                    saveTripsListSnapshot(userId, freshData)
                }
            }
        }
    )
    const effectiveTrips = Array.isArray(data) ? data : (Array.isArray(initialSnapshot) ? initialSnapshot : [])
    return {
        trips: effectiveTrips,
        isLoading: !error && !data && !initialSnapshot,
        isError: !!error,
        mutate
    }
}

export function useTripDetail(
    tripId: string | null, 
    userId?: string | null, 
    refreshInterval: number = 0,
    onTripNotFound?: (invalidId: string) => void
) {
    // 🔧 FIX: Include userId in cache key to ensure refetch when userId changes
    // And only make the request when we have a valid userId to prevent unauthenticated fetches
    // 🧠 2026 Normalization: userId is critical for privacy-aware caching
    const swrKey = (tripId && userId) ? [`/api/trips/${tripId}`, userId] : null

    // ⚡ 0ms L1 記憶體微秒級快顯 (首幀 0 骨架屏)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initialSnapshot = useMemo(() => getTripSnapshotSync<any>(tripId), [tripId])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error, mutate, isValidating } = useSWR<any>(
        swrKey,
        ([url, uid]: [string, string]) =>
            fetch(API_BASE + url, {
                headers: { "X-User-ID": uid }
            }).then(async r => {
                if (!r.ok) {
                    const errorBody = await r.json().catch(() => ({}))
                    // 🛡️ 404 代表行程已被刪除或不存在，不跳出連線失敗 toast，由自癒機制靜默接管
                    if (r.status !== 404) {
                        toast.error("伺服器連線失敗，請稍後再試 (Server connection failed)")
                    }
                    throw new HttpError(r.status, errorBody?.detail || `HTTP ${r.status}`, errorBody)
                }
                return r.json()
            }).catch(err => {
                if (err instanceof HttpError) throw err
                console.warn("🌐 [Fetcher] Offline network suppression:", err?.message || err)
                throw new HttpError(0, err?.message || "Offline", { offline: true })
            }),
        {
            fallbackData: initialSnapshot || undefined,
            revalidateOnFocus: false,
            revalidateOnMount: true,
            refreshInterval, // 🆕 Hyper-Heuristics Injection
            dedupingInterval: 2000, // Prevent spam
            onSuccess: (freshData) => {
                // ⚡ 雲端獲取最新資料後，同步更新 L1 記憶體與 L2 IndexedDB
                if (tripId && freshData) {
                    saveTripSnapshot(tripId, freshData)
                }
            },
            onErrorRetry: (err) => {
                // 🛡️ 404 資源不存在，徹底禁止無效重試，保護 Cloud Run 冷啟動與頻寬
                if (err instanceof HttpError && err.status === 404) return
            },
            onError: (err) => {
                if (err instanceof HttpError && err.status === 404 && tripId && onTripNotFound) {
                    onTripNotFound(tripId)
                }
            }
        }
    )

    // 🚀 非同步自 L2 (IndexedDB) 預熱快取至 L1 記憶體
    useEffect(() => {
        if (tripId) {
            preloadTripSnapshot(tripId).then(cached => {
                // 若當前無資料且 L2 預熱出資料，立即觸發一次局部 revalidate 注入
                if (cached && !data && mutate) {
                    mutate(cached, false)
                }
            })
        }
    }, [tripId, data, mutate])

    // 🔧 FIX: 當 userId 從 Zustand hydration 準備好後，保底刷新 (帶 2 秒去重時間閘門)
    const lastMutateTimeRef = useRef(0)
    useEffect(() => {
        if (userId && tripId && mutate) {
            const now = Date.now()
            if (now - lastMutateTimeRef.current > 2000) {
                lastMutateTimeRef.current = now
                mutate()
            }
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

/**
 * 🔍 SWR Hook: Real-time lowest flight price (Phase 2A)
 * Only triggers when both origin and destination IATA codes are available.
 */
export function useFlightPrice(
    origin?: string,
    destination?: string,
    departureAt?: string
) {

    const key = origin && destination
        ? `flight-price-${origin}-${destination}-${departureAt || ''}`
        : null

    const { data, error, isLoading } = useSWR(
        key,
        () => travelDataApi.getFlightPrices({
            origin: origin!,
            destination: destination!,
            departure_at: departureAt,
            currency: 'twd',
        }),
        {
            revalidateOnFocus: false,
            dedupingInterval: 300000,   // 5 min dedup
            errorRetryCount: 1,
        }
    )

    return {
        lowestPrice: data?.lowest_price ?? null,
        prices: data?.prices ?? [],
        currency: data?.currency ?? 'TWD',
        isLoading,
        error,
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
        /** Ultra-light tick - for tabs, lists, and segmented pickers */
        selection: () => vibrate(6),
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
