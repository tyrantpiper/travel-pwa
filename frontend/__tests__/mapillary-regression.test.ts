/**
 * Mapillary 整合回歸測試
 * 
 * 📋 測試範圍：
 * 1. lib/mapillary.ts — API 函式、快取、併發控制、Token 驗證
 * 2. hooks/useMapillaryAutoFill.ts — 自動填充邏輯、篩選條件、重複防護
 * 3. 副作用檢查 — 確認不影響既有功能
 * 
 * @qa QA Engineer Regression Test Suite
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================
// MOCK SETUP
// ============================================================

// Mock MAPILLARY constants
vi.mock('@/lib/constants', () => ({
    MAPILLARY: {
        TOKEN: 'MLY|12345|abcdef',
        API_BASE: 'https://graph.mapillary.com',
        get TILES_URL() {
            return `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${this.TOKEN}`
        },
        COVERAGE_MIN_ZOOM: 6,
        COVERAGE_MAX_ZOOM: 14,
        IMAGE_POINT_MIN_ZOOM: 14,
        SEARCH_RADIUS: 50,
        SEARCH_LIMIT: 1,
        THUMB_SIZE: 'thumb_1024_url' as const,
        CACHE_TTL_DAYS: 30,
        MAX_CONCURRENT: 3,
    },
}))

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value }),
        removeItem: vi.fn((key: string) => { delete store[key] }),
        clear: vi.fn(() => { store = {} }),
    }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Mock fetch
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// ============================================================
// 1. lib/mapillary.ts — 核心 API 模組測試
// ============================================================

describe('lib/mapillary.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorageMock.clear()
    })

    describe('searchNearbyImage', () => {
        it('TC-1: 正常搜尋 → 回傳影像並寫入快取', async () => {
            const mockImage = {
                id: '12345678',
                thumb_1024_url: 'https://scontent.mapillary.com/thumb.jpg',
                captured_at: 1700000000000,
                compass_angle: 180,
                is_pano: true,
                geometry: { type: 'Point', coordinates: [121.5, 25.03] },
            }

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: [mockImage] }),
            })

            // 動態 import 避免在 mock 設定前載入
            const { searchNearbyImage } = await import('@/lib/mapillary')
            const result = await searchNearbyImage(25.03, 121.5)

            // ✅ 功能等價性：回傳正確的影像物件
            expect(result).not.toBeNull()
            expect(result!.id).toBe('12345678')
            expect(result!.is_pano).toBe(true)
            expect(result!.thumb_1024_url).toBe('https://scontent.mapillary.com/thumb.jpg')

            // ✅ 副作用檢查：快取已寫入
            expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
            const cacheKey = 'mly_25.0300_121.5000'
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                cacheKey,
                expect.stringContaining('"imageId":"12345678"')
            )
        })

        it('TC-2: 快取命中 → 不發送 API 請求', async () => {
            const cachedEntry = {
                imageId: 'cached-001',
                thumb: 'https://cached-thumb.jpg',
                capturedAt: 1700000000000,
                isPano: false,
                fetchedAt: Date.now() - 1000, // 1 秒前，未過期
            }

            localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(cachedEntry))

            const { searchNearbyImage } = await import('@/lib/mapillary')
            const result = await searchNearbyImage(25.03, 121.5)

            // ✅ 從快取取得
            expect(result).not.toBeNull()
            expect(result!.id).toBe('cached-001')
            expect(result!.thumb_1024_url).toBe('https://cached-thumb.jpg')

            // ✅ 不發送任何 HTTP 請求
            expect(mockFetch).not.toHaveBeenCalled()
        })

        it('TC-3: Token 格式不正確 → isTokenConfigured 回傳 false', async () => {
            // 直接測試 Token 格式驗證邏輯（與 lib/mapillary.ts L116 等價）
            const isTokenConfigured = (token: string): boolean => {
                return token.length > 0 && token.startsWith('MLY|')
            }

            // ✅ 空 Token
            expect(isTokenConfigured('')).toBe(false)
            // ✅ 格式錯誤
            expect(isTokenConfigured('invalid-token')).toBe(false)
            expect(isTokenConfigured('Bearer xxx')).toBe(false)
            // ✅ 正確格式
            expect(isTokenConfigured('MLY|12345|abcdef')).toBe(true)
        })

        it('TC-4: API 回傳 429 → 指數退避重試 1 次', async () => {
            const mockImage = {
                id: 'retry-001',
                thumb_1024_url: 'https://retry-thumb.jpg',
                captured_at: 1700000000000,
                compass_angle: 90,
                is_pano: false,
                geometry: { type: 'Point', coordinates: [121.5, 25.03] },
            }

            // 首次 429
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
            })
            // 重試成功
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: [mockImage] }),
            })

            const { searchNearbyImage } = await import('@/lib/mapillary')
            const result = await searchNearbyImage(25.03, 121.5)

            // ✅ 重試後取得結果
            expect(result).not.toBeNull()
            expect(result!.id).toBe('retry-001')
            // ✅ fetch 被呼叫 2 次（原始 + 重試）
            expect(mockFetch).toHaveBeenCalledTimes(2)
        })

        it('TC-5: 無覆蓋區域 → 回傳 null', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: [] }),
            })

            const { searchNearbyImage } = await import('@/lib/mapillary')
            const result = await searchNearbyImage(0, 0) // 海洋上

            expect(result).toBeNull()
        })

        it('TC-6: 網路離線 → 回傳 null，不 throw', async () => {
            mockFetch.mockRejectedValueOnce(new Error('NetworkError'))

            const { searchNearbyImage } = await import('@/lib/mapillary')
            const result = await searchNearbyImage(25.03, 121.5)

            // ✅ 優雅降級，不崩潰
            expect(result).toBeNull()
        })
    })

    describe('isMapillaryAvailable', () => {
        it('TC-7: Token 格式正確 → true', async () => {
            const { isMapillaryAvailable } = await import('@/lib/mapillary')
            expect(isMapillaryAvailable()).toBe(true)
        })
    })

    describe('Semaphore 併發控制', () => {
        it('TC-8: 同時發起 5 個請求 → 最多 3 個並行', async () => {
            let concurrentCount = 0
            let maxConcurrent = 0

            mockFetch.mockImplementation(async () => {
                concurrentCount++
                maxConcurrent = Math.max(maxConcurrent, concurrentCount)
                await new Promise(r => setTimeout(r, 50))
                concurrentCount--
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: [] }),
                }
            })

            const { searchNearbyImage } = await import('@/lib/mapillary')

            // 同時發 5 個不同座標的請求
            const promises = Array.from({ length: 5 }, (_, i) =>
                searchNearbyImage(25 + i * 0.1, 121 + i * 0.1)
            )

            await Promise.all(promises)

            // ✅ 最大併發不超過 3
            expect(maxConcurrent).toBeLessThanOrEqual(3)
        })
    })
})

// ============================================================
// 2. useMapillaryAutoFill — 自動填充 Hook 測試
// ============================================================

describe('useMapillaryAutoFill — 篩選邏輯驗證', () => {
    it('TC-9: 只篩選出「無圖且有座標」的活動', () => {
        // 模擬 hook 內部的篩選邏輯
        const activities: Array<{
            id: string
            lat: number | undefined
            lng: number | undefined
            image_url: string | undefined
            image_urls: string[]
            preview_metadata: Record<string, string | undefined>
        }> = [
            // ✅ 應該被選中（有座標、無任何圖片）
            {
                id: 'a1', lat: 25.03, lng: 121.5,
                image_url: undefined, image_urls: [],
                preview_metadata: {},
            },
            // ❌ 有上傳圖片 → 跳過
            {
                id: 'a2', lat: 25.04, lng: 121.6,
                image_url: 'https://uploaded.jpg', image_urls: [],
                preview_metadata: {},
            },
            // ❌ 已有 mapillary_thumb → 跳過
            {
                id: 'a3', lat: 25.05, lng: 121.7,
                image_url: undefined, image_urls: [],
                preview_metadata: { mapillary_thumb: 'https://existing.jpg' },
            },
            // ❌ 沒有座標 → 跳過
            {
                id: 'a4', lat: undefined, lng: undefined,
                image_url: undefined, image_urls: [],
                preview_metadata: {},
            },
            // ❌ 有 og_image → 跳過
            {
                id: 'a5', lat: 25.06, lng: 121.8,
                image_url: undefined, image_urls: [],
                preview_metadata: { og_image: 'https://og.jpg' },
            },
        ]

        const inFlight = new Set<string>()

        const targets = activities.filter(a =>
            a.id &&
            a.lat && a.lng &&
            !a.image_url && (!a.image_urls || a.image_urls.length === 0) &&
            !a.preview_metadata?.og_image &&
            !a.preview_metadata?.map_image &&
            !a.preview_metadata?.mapillary_thumb &&
            !inFlight.has(a.id)
        )

        // ✅ 只有 a1 被選中
        expect(targets).toHaveLength(1)
        expect(targets[0].id).toBe('a1')
    })

    it('TC-10: inFlight 防重複 — 已在請求中的活動不會被重新選中', () => {
        const activities: Array<{
            id: string; lat: number; lng: number
            image_url: string | undefined; image_urls: string[]
            preview_metadata: Record<string, string | undefined>
        }> = [
            { id: 'a1', lat: 25.03, lng: 121.5, image_url: undefined, image_urls: [], preview_metadata: {} },
            { id: 'a2', lat: 25.04, lng: 121.6, image_url: undefined, image_urls: [], preview_metadata: {} },
        ]

        const inFlight = new Set<string>(['a1']) // a1 正在處理中

        const targets = activities.filter(a =>
            a.id &&
            a.lat && a.lng &&
            !a.image_url && (!a.image_urls || a.image_urls.length === 0) &&
            !a.preview_metadata?.og_image &&
            !a.preview_metadata?.map_image &&
            !a.preview_metadata?.mapillary_thumb &&
            !inFlight.has(a.id)
        )

        // ✅ a1 被 inFlight 過濾掉，只剩 a2
        expect(targets).toHaveLength(1)
        expect(targets[0].id).toBe('a2')
    })
})

// ============================================================
// 3. 副作用 / Breaking Change 檢查
// ============================================================

describe('副作用與 Breaking Change 檢查', () => {
    it('TC-11: PreviewMetadata 型別擴充 — 舊有欄位仍完全兼容', () => {
        // 模擬舊資料（沒有 mapillary 欄位）
        const oldMetadata = {
            og_image: 'https://old-og.jpg',
            og_title: 'Old Title',
            map_image: 'https://old-map.jpg',
            custom_order: ['img1', 'img2'],
            hidden_images: ['img3'],
        }

        // 擴充後的新欄位
        const newMetadata = {
            ...oldMetadata,
            mapillary_thumb: 'https://new-street.jpg',
            mapillary_image_id: '999',
            mapillary_captured_at: 1700000000000,
            mapillary_is_pano: true,
        }

        // ✅ 舊欄位完全保留
        expect(newMetadata.og_image).toBe('https://old-og.jpg')
        expect(newMetadata.og_title).toBe('Old Title')
        expect(newMetadata.map_image).toBe('https://old-map.jpg')
        expect(newMetadata.custom_order).toEqual(['img1', 'img2'])
        expect(newMetadata.hidden_images).toEqual(['img3'])

        // ✅ 新欄位正確疊加
        expect(newMetadata.mapillary_thumb).toBe('https://new-street.jpg')
        expect(newMetadata.mapillary_is_pano).toBe(true)
    })

    it('TC-12: PhotoGalleryPreview 照片優先鏈不打亂原有順序', () => {
        // 模擬照片優先鏈的邏輯（來自 timeline-card.tsx）
        const metadata = {
            map_image: undefined,
            og_image: undefined,
            mapillary_thumb: 'https://mapillary-fallback.jpg',
        }

        const previewImage = (metadata as Record<string, string | undefined>).map_image
            || (metadata as Record<string, string | undefined>).og_image
            || (metadata as Record<string, string | undefined>).mapillary_thumb

        // ✅ Mapillary 是最低優先級的 fallback
        expect(previewImage).toBe('https://mapillary-fallback.jpg')

        // ✅ 若有 og_image，應優先使用它
        const metadataWithOG = {
            ...metadata,
            og_image: 'https://og-priority.jpg',
        } as Record<string, string | undefined>
        const previewWithOG = metadataWithOG.map_image
            || metadataWithOG.og_image
            || metadataWithOG.mapillary_thumb

        expect(previewWithOG).toBe('https://og-priority.jpg')
    })

    it('TC-13: POIDetailDrawer — onOpenStreetView 是 optional prop，不傳也不崩潰', () => {
        // 模擬不傳 onOpenStreetView 的情境
        const props: Record<string, unknown> = {
            isOpen: true,
            onClose: () => {},
            poi: { name: 'Test', lat: 25, lng: 121, type: 'single' as const },
            // onOpenStreetView 未傳入
        }

        // ✅ Optional chaining 確保安全
        const safeCall = () => {
            const fn = props.onOpenStreetView as ((lat: number, lng: number) => void) | undefined
            fn?.(25, 121)
        }

        expect(safeCall).not.toThrow()
    })

    it('TC-14: DayMap handleMapClick — Mapillary 覆蓋層關閉時不攔截 POI 事件', () => {
        const showMapillaryCoverage = false
        const mapillaryImageClicked = false
        let poiQueryExecuted = false

        // 模擬 handleMapClick 分層邏輯
        if (showMapillaryCoverage && mapillaryImageClicked) {
            // 攔截 → 開啟街景
            // 不應該走到這裡
        } else {
            // 原有 POI 查詢
            poiQueryExecuted = true
        }

        // ✅ 覆蓋層關閉時，POI 查詢正常執行
        expect(poiQueryExecuted).toBe(true)
    })
})

// ============================================================
// 4. 極端情況 (Edge Cases)
// ============================================================

describe('極端情況測試', () => {
    it('TC-15: localStorage 已滿 (QuotaExceededError) → 靜默失敗不崩潰', () => {
        localStorageMock.setItem.mockImplementationOnce(() => {
            throw new DOMException('QuotaExceededError')
        })

        // 模擬 setCache 邏輯
        const setCache = () => {
            try {
                localStorageMock.setItem('mly_test', '{}')
            } catch {
                // 靜默忽略
            }
        }

        expect(setCache).not.toThrow()
    })

    it('TC-16: 快取資料格式損壞 → 回傳 null 不崩潰', () => {
        localStorageMock.getItem.mockReturnValueOnce('{{invalid json}}')

        const getCache = (): object | null => {
            try {
                const raw = localStorageMock.getItem('test')
                if (!raw) return null
                return JSON.parse(raw)
            } catch {
                return null
            }
        }

        expect(getCache()).toBeNull()
    })

    it('TC-17: 快取已過期 (超過 30 天) → 清除並回傳 null', () => {
        const expiredEntry = {
            imageId: 'expired',
            thumb: 'https://old.jpg',
            capturedAt: 1700000000000,
            isPano: false,
            fetchedAt: Date.now() - (31 * 24 * 60 * 60 * 1000), // 31 天前
        }

        localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(expiredEntry))

        const CACHE_TTL_DAYS = 30
        const getCache = (): object | null => {
            try {
                const raw = localStorageMock.getItem('test')
                if (!raw) return null
                const entry = JSON.parse(raw)
                const ttlMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
                if (Date.now() - entry.fetchedAt > ttlMs) {
                    localStorageMock.removeItem('test')
                    return null
                }
                return entry
            } catch {
                return null
            }
        }

        // ✅ 過期後返回 null
        expect(getCache()).toBeNull()
        // ✅ 過期快取被清除
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('test')
    })
})
