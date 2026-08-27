-- Add hide_navigation column to itinerary_items table
-- This allows users to manually disable the navigation button for specific items.

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='itinerary_items' AND column_name='hide_navigation') THEN
        ALTER TABLE itinerary_items ADD COLUMN hide_navigation BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
