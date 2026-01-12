-- ============================================
-- Multi-Image Migration Script
-- For: itinerary_items table
-- Date: 2026-01-13
-- ============================================

-- Step 1: 新增 image_urls 欄位 (JSONB 陣列)
ALTER TABLE itinerary_items 
ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

-- Step 2: 將現有 image_url 資料遷移到 image_urls
-- 處理 NULL、空字串、和有效 URL 三種情況
UPDATE itinerary_items 
SET image_urls = CASE 
    WHEN image_url IS NULL OR image_url = '' 
    THEN '[]'::jsonb
    ELSE jsonb_build_array(image_url)
END
WHERE image_urls = '[]'::jsonb OR image_urls IS NULL;

-- Step 3: 驗證遷移結果
SELECT id, place_name, image_url, image_urls 
FROM itinerary_items 
WHERE image_url IS NOT NULL AND image_url != ''
LIMIT 5;

-- ============================================
-- 預期結果範例:
-- id | place_name | image_url | image_urls
-- 1  | 東京塔     | https://... | ["https://..."]
-- ============================================
