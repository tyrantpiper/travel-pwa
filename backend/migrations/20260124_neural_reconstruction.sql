-- ============================================
-- Migration: Neural Reconstruction & Parity Alignment
-- Table: itinerary_items
-- Date: 2026-01-24
-- ============================================

-- Step 1: Add is_private (Boolean)
ALTER TABLE itinerary_items 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Step 2: Add is_highlight (Boolean, for Amber VIP mode)
ALTER TABLE itinerary_items 
ADD COLUMN IF NOT EXISTS is_highlight BOOLEAN DEFAULT FALSE;

-- Step 3: Add preview_metadata (JSONB, for Smart Link Previews)
ALTER TABLE itinerary_items 
ADD COLUMN IF NOT EXISTS preview_metadata JSONB DEFAULT '{}'::jsonb;

-- Step 4: Add website_link (Text)
ALTER TABLE itinerary_items 
ADD COLUMN IF NOT EXISTS website_link TEXT;

-- Step 5: Add reservation_code (Text)
ALTER TABLE itinerary_items 
ADD COLUMN IF NOT EXISTS reservation_code TEXT;

-- Step 6: Add memo (Text, for private user notes)
ALTER TABLE itinerary_items 
ADD COLUMN IF NOT EXISTS memo TEXT;

-- Step 7: Verify Columns
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'itinerary_items' 
-- AND column_name IN ('is_private', 'is_highlight', 'preview_metadata', 'website_link', 'reservation_code', 'memo');
