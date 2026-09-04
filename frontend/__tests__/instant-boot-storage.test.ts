import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import {
    saveTripSnapshot,
    getTripSnapshotSync,
    preloadTripSnapshot,
    deleteTripSnapshot,
    clearAllMemorySnapshots
} from '@/lib/idb-storage'

// Mock idb-keyval in-memory store
interface MockStoredSnapshot {
    data: unknown
    timestamp: number
    version: number
}
const mockIdbStore = new Map<string, MockStoredSnapshot>()

vi.mock('idb-keyval', () => ({
    get: vi.fn(async (key: string) => mockIdbStore.get(key)),
    set: vi.fn(async (key: string, val: unknown) => {
        mockIdbStore.set(key, val as MockStoredSnapshot)
    }),
    del: vi.fn(async (key: string) => {
        mockIdbStore.delete(key)
    })
}))

beforeAll(() => {
    // @ts-expect-error Mock indexedDB for test runner
    globalThis.indexedDB = {}
})

afterAll(() => {
    // @ts-expect-error Clean up
    delete globalThis.indexedDB
})

describe('Instant Boot L1/L2 Storage Engine Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIdbStore.clear()
        clearAllMemorySnapshots()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    const sampleTrip = {
        id: 'trip-alpha-123',
        title: '東京賞櫻極速之旅',
        destination: 'Tokyo',
        start_date: '2026-03-25',
        end_date: '2026-03-30',
        days: [
            { day: 1, activities: [{ id: 'act-1', place: '新宿御苑' }] }
        ]
    }

    it('TC-1: saveTripSnapshot updates L1 memory synchronously and L2 IndexedDB asynchronously', async () => {
        await saveTripSnapshot('trip-alpha-123', sampleTrip)

        // 1. L1 記憶體 0ms 同步直出
        const syncResult = getTripSnapshotSync('trip-alpha-123')
        expect(syncResult).toEqual(sampleTrip)

        // 2. L2 IndexedDB 已持久化
        expect(mockIdbStore.has('tabidachi_trip_snapshot_trip-alpha-123')).toBe(true)
        const storedPayload = mockIdbStore.get('tabidachi_trip_snapshot_trip-alpha-123')
        expect(storedPayload).toBeDefined()
        expect(storedPayload!.data).toEqual(sampleTrip)
        expect(storedPayload!.version).toBe(1)
    })

    it('TC-2: preloadTripSnapshot loads from L2 IndexedDB into L1 memory when L1 is empty', async () => {
        // 手動在 L2 IndexedDB 塞入資料（模擬關閉瀏覽器後重開）
        mockIdbStore.set('tabidachi_trip_snapshot_trip-beta-456', {
            data: { id: 'trip-beta-456', title: '大阪美食行' },
            timestamp: Date.now(),
            version: 1
        })

        // 此時 L1 記憶體中為空
        expect(getTripSnapshotSync('trip-beta-456')).toBeNull()

        // 觸發非同步預熱
        const loaded = await preloadTripSnapshot('trip-beta-456')
        expect(loaded).toEqual({ id: 'trip-beta-456', title: '大阪美食行' })

        // 預熱後，L1 同步讀取立即命中
        expect(getTripSnapshotSync('trip-beta-456')).toEqual({ id: 'trip-beta-456', title: '大阪美食行' })
    })

    it('TC-3: deleteTripSnapshot clears both L1 memory and L2 IndexedDB (Triple-Purge Defense)', async () => {
        await saveTripSnapshot('trip-alpha-123', sampleTrip)
        expect(getTripSnapshotSync('trip-alpha-123')).not.toBeNull()
        expect(mockIdbStore.has('tabidachi_trip_snapshot_trip-alpha-123')).toBe(true)

        // 觸發自癒清除
        await deleteTripSnapshot('trip-alpha-123')

        // 驗證 L1 已清除
        expect(getTripSnapshotSync('trip-alpha-123')).toBeNull()
        // 驗證 L2 IndexedDB 已清除
        expect(mockIdbStore.has('tabidachi_trip_snapshot_trip-alpha-123')).toBe(false)
    })

    it('TC-4: Outdated schema version in IndexedDB is safely discarded', async () => {
        // 模擬上一代舊版快照 (version: 0)
        mockIdbStore.set('tabidachi_trip_snapshot_trip-old', {
            data: { id: 'trip-old', legacyField: true },
            timestamp: Date.now() - 100000,
            version: 0 // 版本不符
        })

        const loaded = await preloadTripSnapshot('trip-old')
        expect(loaded).toBeNull()
        expect(getTripSnapshotSync('trip-old')).toBeNull()
    })

    it('TC-5: Safe fallback when IndexedDB throws (e.g. Safari Incognito / SecurityError)', async () => {
        const { get: idbGet } = await import('idb-keyval')
        vi.mocked(idbGet).mockRejectedValueOnce(new Error('SecurityError: Access denied in incognito mode'))

        // 不應拋出異常，應優雅返回 null
        const result = await preloadTripSnapshot('trip-incognito')
        expect(result).toBeNull()
    })
})
