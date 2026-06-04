/**
 * Mapillary API 工具函式庫
 * 
 * 職責：
 * - Image Search API (座標附近街景搜尋)
 * - Entity API (單一影像 metadata)
 * - localStorage 快取 (TTL 30 天)
 * - 內建 Semaphore 併發控制 (max 3，替代 p-limit 避免 ESM 相容問題)
 * 
 * @see https://www.mapillary.com/developer/api-documentation
 */

import { MAPILLARY } from '@/lib/constants'

// ============================================================
// Types
// ============================================================

/** Mapillary Image Search API 回傳的影像資料 */
export interface MapillaryImage {
    id: string
    thumb_1024_url: string
    thumb_256_url?: string
    captured_at: number           // Unix timestamp (ms)
    compass_angle: number         // 拍攝方位角 (0-360)
    is_pano: boolean              // 是否為 360° 全景
    geometry: {
        type: 'Point'
        coordinates: [number, number]  // [lng, lat]
    }
}

/** Mapillary Entity API 完整影像詳情 */
export interface MapillaryImageEntity extends MapillaryImage {
    creator?: { username: string; id: string }
    sequence?: string
    width?: number
    height?: number
}

/** localStorage 快取結構 */
interface CacheEntry {
    imageId: string
    thumb: string
    capturedAt: number
    isPano: boolean
    fetchedAt: number
}

// ============================================================
// Semaphore (併發控制，替代 p-limit)
// ============================================================

let activeCount = 0
const waitQueue: Array<() => void> = []

/**
 * 限制同時進行的 API 請求數量，防止網路雪崩
 * 使用 FIFO 佇列確保公平性
 */
async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (activeCount >= MAPILLARY.MAX_CONCURRENT) {
        await new Promise<void>(resolve => waitQueue.push(resolve))
    }
    activeCount++
    try {
        return await fn()
    } finally {
        activeCount--
        const next = waitQueue.shift()
        if (next) next()
    }
}

// ============================================================
// Cache Helpers
// ============================================================

function getCacheKey(lat: number, lng: number): string {
    return `mly_${lat.toFixed(4)}_${lng.toFixed(4)}`
}

function getCache(lat: number, lng: number): CacheEntry | null {
    try {
        const raw = localStorage.getItem(getCacheKey(lat, lng))
        if (!raw) return null

        const entry: CacheEntry = JSON.parse(raw)
        const ttlMs = MAPILLARY.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
        if (Date.now() - entry.fetchedAt > ttlMs) {
            localStorage.removeItem(getCacheKey(lat, lng))
            return null
        }
        return entry
    } catch {
        return null
    }
}

function setCache(lat: number, lng: number, entry: Omit<CacheEntry, 'fetchedAt'>): void {
    try {
        localStorage.setItem(getCacheKey(lat, lng), JSON.stringify({
            ...entry,
            fetchedAt: Date.now(),
        }))
    } catch {
        // Safari 隱私模式 QuotaExceededError — 靜默忽略
    }
}

// ============================================================
// Token Guard
// ============================================================

function isTokenConfigured(): boolean {
    return MAPILLARY.TOKEN.length > 0 && MAPILLARY.TOKEN.startsWith('MLY|')
}

// ============================================================
// API Functions
// ============================================================

/**
 * 搜尋座標附近最近的街景影像
 * 
 * @param lat 緯度
 * @param lng 經度
 * @param radius 搜尋半徑 (公尺，預設 50)
 * @returns 最近的影像資料，或 null (無覆蓋)
 */
export async function searchNearbyImage(
    lat: number,
    lng: number,
    radius: number = MAPILLARY.SEARCH_RADIUS
): Promise<MapillaryImage | null> {
    if (!isTokenConfigured()) {
        console.warn('[Mapillary] Token not configured, skipping search')
        return null
    }

    // 快取優先
    const cached = getCache(lat, lng)
    if (cached) {
        return {
            id: cached.imageId,
            thumb_1024_url: cached.thumb,
            captured_at: cached.capturedAt,
            is_pano: cached.isPano,
            compass_angle: 0,
            geometry: { type: 'Point', coordinates: [lng, lat] },
        }
    }

    return withConcurrencyLimit(async () => {
        const fields = 'id,thumb_1024_url,thumb_256_url,captured_at,compass_angle,is_pano,geometry'
        // ⚠️ Mapillary API v4: bbox 和 radius 是互斥的搜尋模式
        // 使用 Radius Search (lat+lng+radius) — 自動按距離+品質排序
        const clampedRadius = Math.min(radius, 50) // API 上限 50m
        const url = `${MAPILLARY.API_BASE}/images?access_token=${MAPILLARY.TOKEN}&fields=${fields}&lat=${lat}&lng=${lng}&radius=${clampedRadius}&limit=${MAPILLARY.SEARCH_LIMIT}`

        try {
            const res = await fetch(url, {
                headers: { Authorization: `OAuth ${MAPILLARY.TOKEN}` },
            })

            if (res.status === 401) {
                console.error('[Mapillary] Invalid token (401)')
                return null
            }

            if (res.status === 429) {
                // Rate limit — 指數退避重試 1 次
                await new Promise(r => setTimeout(r, 2000))
                const retry = await fetch(url, {
                    headers: { Authorization: `OAuth ${MAPILLARY.TOKEN}` },
                })
                if (!retry.ok) return null
                const retryData = await retry.json()
                const retryImage = retryData?.data?.[0] as MapillaryImage | undefined
                if (retryImage) {
                    setCache(lat, lng, {
                        imageId: retryImage.id,
                        thumb: retryImage.thumb_1024_url,
                        capturedAt: retryImage.captured_at,
                        isPano: retryImage.is_pano,
                    })
                }
                return retryImage ?? null
            }

            if (!res.ok) return null

            const data = await res.json()
            const image = data?.data?.[0] as MapillaryImage | undefined

            if (image) {
                setCache(lat, lng, {
                    imageId: image.id,
                    thumb: image.thumb_1024_url,
                    capturedAt: image.captured_at,
                    isPano: image.is_pano,
                })
            }

            return image ?? null
        } catch (err) {
            // 離線或網路錯誤 — 回傳快取或 null
            console.warn('[Mapillary] Network error:', err)
            return null
        }
    })
}

/**
 * 取得影像完整 metadata (Entity API)
 * 
 * @param imageId Mapillary 影像 ID
 * @returns 影像詳情，或 null
 */
export async function getImageEntity(imageId: string): Promise<MapillaryImageEntity | null> {
    if (!isTokenConfigured()) return null

    return withConcurrencyLimit(async () => {
        const fields = 'id,thumb_1024_url,thumb_256_url,captured_at,compass_angle,is_pano,geometry,creator,sequence,width,height'
        const url = `${MAPILLARY.API_BASE}/${imageId}?fields=${fields}`

        try {
            const res = await fetch(url, {
                headers: { Authorization: `OAuth ${MAPILLARY.TOKEN}` },
            })

            if (!res.ok) {
                console.warn(`[Mapillary] Entity API ${res.status} for image ${imageId}`)
                return null
            }

            return await res.json() as MapillaryImageEntity
        } catch (err) {
            console.warn('[Mapillary] Entity fetch error:', err)
            return null
        }
    })
}

/**
 * 快速檢查座標是否有街景覆蓋 (快取優先)
 * 
 * @param lat 緯度
 * @param lng 經度
 * @returns 是否有覆蓋
 */
export async function hasStreetView(lat: number, lng: number): Promise<boolean> {
    const cached = getCache(lat, lng)
    if (cached) return true

    const image = await searchNearbyImage(lat, lng)
    return image !== null
}

/**
 * 檢查 Token 是否已設定且格式正確
 * UI 層可用此判斷是否顯示 Mapillary 相關功能
 */
export function isMapillaryAvailable(): boolean {
    return isTokenConfigured()
}

/**
 * 將 Mapillary 街景圖上傳至 Cloudinary 永久保存
 * 
 * @param imageUrl Mapillary 的臨時 URL
 * @param imageId Mapillary 影像 ID，用於命名
 * @returns Cloudinary 永久 URL (已套用最佳化參數)
 */
export async function uploadMapillaryToCloudinary(imageUrl: string, imageId: string): Promise<string | null> {
    try {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;

        if (!cloudName || !apiKey) {
            console.warn('[Mapillary] Missing Cloudinary env vars, skipping upload');
            return null;
        }

        const folder = "ryan_travel/streetview";
        const timestamp = Math.round(Date.now() / 1000);
        const public_id = `mly_${imageId}`;
        
        // 1. 取得 Cloudinary 簽名
        const paramsToSign = { timestamp, folder, public_id };
        const signRes = await fetch("/api/sign-cloudinary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paramsToSign }),
        });

        if (!signRes.ok) {
            console.error('[Mapillary] Failed to sign Cloudinary request:', await signRes.text());
            return null;
        }

        const { signature } = await signRes.json();

        // 2. 直接讓 Cloudinary 透過 URL 抓取並上傳
        const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
        const data = new FormData();
        data.append("file", imageUrl);
        data.append("timestamp", timestamp.toString());
        data.append("folder", folder);
        data.append("public_id", public_id);
        data.append("signature", signature);
        data.append("api_key", apiKey);

        const uploadRes = await fetch(url, {
            method: "POST",
            body: data,
        });

        if (!uploadRes.ok) {
            console.error('[Mapillary] Cloudinary upload failed:', await uploadRes.text());
            return null;
        }

        const result = await uploadRes.json();
        
        // 3. 回傳最原始的 URL (不加參數)
        // 最佳化參數與縮放交給前端 getOptimizedImageUrl 與 Cloudflare Worker 動態處理
        return result.secure_url;
    } catch (err) {
        console.error('[Mapillary] Error uploading to Cloudinary:', err);
        return null;
    }
}
