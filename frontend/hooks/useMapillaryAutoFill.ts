import { useState, useRef, useEffect, useCallback } from 'react'
import { Activity } from '@/lib/itinerary-types'
import { searchNearbyImage, isMapillaryAvailable, uploadMapillaryToCloudinary } from '@/lib/mapillary'

/**
 * 自動搜尋並填充行程中缺少照片的地點之街景圖片
 *
 * @param activities 行程中的所有活動
 * @param onUpdateActivity 用於更新行程資料的回調函數
 * @returns 包含執行狀態的物件
 */
export function useMapillaryAutoFill(
    activities: Activity[],
    onUpdateActivity: (id: string, updates: Partial<Activity>, skipRevalidation?: boolean) => Promise<boolean>
) {
    const [isFilling, setIsFilling] = useState(false)
    const [filledCount, setFilledCount] = useState(0)

    // 追蹤進行中的請求，避免重複 fetch
    const inFlightRef = useRef<Set<string>>(new Set())
    // 追蹤失敗的請求，避免無窮重試
    const failedRef = useRef<Set<string>>(new Set())

    // 使用 useRef 保存最新的 onUpdateActivity，避免不必要的 re-run
    const updaterRef = useRef(onUpdateActivity)
    useEffect(() => {
        updaterRef.current = onUpdateActivity
    }, [onUpdateActivity])

    const processAutoFill = useCallback(async () => {
        if (!isMapillaryAvailable()) return;

        // 篩選出需要填充的目標：
        // 1. 有經緯度
        // 2. 沒有上傳的圖片 (image_url, image_urls)
        // 3. 沒有 og_image 和 map_image
        // 4. 還沒有 mapillary_thumb
        // 5. 不在進行中的請求集合內，也不在失敗集合內
        const targets = activities.filter(a =>
            a.id &&
            a.lat && a.lng &&
            !a.image_url && (!a.image_urls || a.image_urls.length === 0) &&
            !a.preview_metadata?.og_image &&
            !a.preview_metadata?.map_image &&
            !a.preview_metadata?.mapillary_thumb &&
            !inFlightRef.current.has(a.id) &&
            !failedRef.current.has(a.id)
        )

        if (targets.length === 0) return;

        setIsFilling(true)

        let successCount = 0;
        
        // 標記處理中
        targets.forEach(a => inFlightRef.current.add(a.id!));

        // 使用 Promise.allSettled 平行處理 (由於 mapillary.ts 內有 Semaphore，不用擔心請求雪崩)
        await Promise.allSettled(targets.map(async (activity) => {
            const id = activity.id!
            try {
                // 1. 取得 Mapillary 街景
                const image = await searchNearbyImage(activity.lat!, activity.lng!)

                if (image) {
                    // 2. 上傳至 Cloudinary 獲取永久 URL
                    const permanentUrl = await uploadMapillaryToCloudinary(image.thumb_1024_url, image.id);
                    
                    // 3. 呼叫 API 更新，跳過 revalidation 以防止畫面閃爍
                    const success = await updaterRef.current(id, {
                        preview_metadata: {
                            ...activity.preview_metadata,
                            mapillary_thumb: permanentUrl || image.thumb_1024_url,
                            mapillary_image_id: image.id,
                            mapillary_is_pano: image.is_pano
                        }
                    }, true) // skipRevalidation = true

                    if (success) {
                        successCount++;
                        // 若成功，我們不需要在 inFlightRef 移除，因為更新後此項目就有 mapillary_thumb，自然不會被選中
                    } else {
                        failedRef.current.add(id);
                    }
                } else {
                    // 沒有街景，標記為失敗避免重複抓取
                    failedRef.current.add(id);
                }
            } catch (error) {
                console.warn(`[AutoFill] Failed to fetch Mapillary for activity ${id}:`, error)
                failedRef.current.add(id);
            } finally {
                inFlightRef.current.delete(id);
            }
        }));

        if (successCount > 0) {
            setFilledCount(prev => prev + successCount)
            // 由於跳過了單筆 revalidation，這裡觸發全域重新整理，一次性重繪 UI
            window.dispatchEvent(new Event('refresh-active-view'))
        }

        setIsFilling(false)
    }, [activities])

    useEffect(() => {
        // Debounce 執行，避免頻繁觸發
        const timer = setTimeout(() => {
            processAutoFill()
        }, 1000)

        return () => clearTimeout(timer)
    }, [processAutoFill])

    return { isFilling, filledCount }
}
