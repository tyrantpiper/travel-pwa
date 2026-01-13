-- ============================================
-- Migration: Add sort_order column for drag-and-drop reordering
-- ============================================
-- Run this in Supabase SQL Editor

-- Step 1: Add the sort_order column
ALTER TABLE itinerary_items 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Step 2: Initialize sort_order based on existing time_slot values
-- This converts HH:MM to minutes for initial sorting
UPDATE itinerary_items 
SET sort_order = (
    CASE 
        WHEN time_slot IS NOT NULL AND time_slot != '' THEN
            CAST(SPLIT_PART(time_slot, ':', 1) AS INTEGER) * 60 + 
            CAST(SPLIT_PART(time_slot, ':', 2) AS INTEGER)
        ELSE 0
    END
)
WHERE sort_order = 0 OR sort_order IS NULL;

-- Step 3: Create index for faster sorting
CREATE INDEX IF NOT EXISTS idx_itinerary_items_sort_order 
ON itinerary_items(itinerary_id, day_number, sort_order);

-- Step 4: Verify migration
SELECT 
    id, 
    day_number, 
    time_slot, 
    sort_order,
    place_name
FROM itinerary_items 
ORDER BY day_number, sort_order
LIMIT 20;
