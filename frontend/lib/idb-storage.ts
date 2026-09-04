import { get, set, del } from "idb-keyval"

const SNAPSHOT_KEY_PREFIX = "tabidachi_trip_snapshot_"
const SNAPSHOT_SCHEMA_VERSION = 1

interface SnapshotPayload<T = unknown> {
    data: T
    timestamp: number
    version: number
}

// 🧠 Layer 1: 記憶體微秒級同步快取 (RAM Cache)，供 SWR 首幀 0ms 零骨架屏直出
const l1SnapshotCache = new Map<string, SnapshotPayload>()

/**
 * 檢查是否處於安全且支援 IndexedDB 的瀏覽器環境
 */
function isBrowserWithStorage(): boolean {
    return typeof window !== "undefined" && typeof indexedDB !== "undefined"
}

/**
 * 0ms 同步讀取 L1 記憶體快照 (供 SWR fallbackData 首幀使用)
 */
export function getTripSnapshotSync<T = unknown>(tripId: string | null | undefined): T | null {
    if (!tripId) return null
    const cached = l1SnapshotCache.get(tripId)
    if (!cached || cached.version !== SNAPSHOT_SCHEMA_VERSION) {
        return null
    }
    return cached.data as T
}

/**
 * 非同步預熱：自 L2 (IndexedDB) 載入快照至 L1 (記憶體)
 */
export async function preloadTripSnapshot<T = unknown>(tripId: string | null | undefined): Promise<T | null> {
    if (!tripId) return null

    // 若 L1 命中則直接返回
    const memoryHit = getTripSnapshotSync<T>(tripId)
    if (memoryHit) return memoryHit

    if (!isBrowserWithStorage()) return null

    try {
        const stored = await get<SnapshotPayload<T>>(SNAPSHOT_KEY_PREFIX + tripId)
        if (stored && stored.version === SNAPSHOT_SCHEMA_VERSION && stored.data) {
            l1SnapshotCache.set(tripId, stored)
            return stored.data
        }
        return null
    } catch (err) {
        console.warn("[Storage] L2 IndexedDB read warning (safely ignored):", err)
        return null
    }
}

/**
 * 同步寫入 L1 記憶體，並非同步持久化至 L2 IndexedDB
 */
export async function saveTripSnapshot<T = unknown>(tripId: string | null | undefined, data: T): Promise<void> {
    if (!tripId || !data) return

    const payload: SnapshotPayload<T> = {
        data,
        timestamp: Date.now(),
        version: SNAPSHOT_SCHEMA_VERSION,
    }

    // 1. 0ms 同步更新 L1 記憶體
    l1SnapshotCache.set(tripId, payload)

    // 2. 非同步持久化至 L2 IndexedDB
    if (isBrowserWithStorage()) {
        try {
            await set(SNAPSHOT_KEY_PREFIX + tripId, payload)
        } catch (err) {
            console.warn("[Storage] L2 IndexedDB write warning (safely ignored):", err)
        }
    }
}

/**
 * ⚡ 四清自癒閉環：同步抹除 L1 記憶體、L2 IndexedDB 與 L3 Service Worker CacheStorage
 * 徹底杜絕 404 幽靈行程在客戶端或離線時復活
 */
export async function deleteTripSnapshot(tripId: string | null | undefined): Promise<void> {
    if (!tripId) return

    // 1. 清除 L1 記憶體
    l1SnapshotCache.delete(tripId)

    // 2. 清除 L2 IndexedDB
    if (isBrowserWithStorage()) {
        try {
            await del(SNAPSHOT_KEY_PREFIX + tripId)
        } catch (err) {
            console.warn("[Storage] L2 IndexedDB delete warning (safely ignored):", err)
        }
    }

    // 3. ⚡ 清除 L3 Service Worker CacheStorage (四清閉環：抹除 trips-api-cache)
    if (typeof window !== "undefined" && "caches" in window) {
        try {
            const cache = await caches.open("trips-api-cache")
            const keys = await cache.keys()
            for (const request of keys) {
                if (request.url.includes(`/api/trips/${tripId}`)) {
                    await cache.delete(request)
                }
            }
        } catch (err) {
            console.warn("[Storage] CacheStorage delete warning (safely ignored):", err)
        }
    }
}

/**
 * 清空所有記憶體快照 (測試與全域登出專用)
 */
export function clearAllMemorySnapshots(): void {
    l1SnapshotCache.clear()
}
