-- 🚀 Performance Optimization Indexes (2026-01-21)
-- These indexes accelerate Dashboard loading and Trip Member lookups.

-- 1. Index on trip_members(user_id) for fast Dashboard filtering
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON public.trip_members(user_id);

-- 2. Index on itineraries(created_by) for fast ownership lookups
CREATE INDEX IF NOT EXISTS idx_itineraries_created_by ON public.itineraries(created_by);

-- 3. (Optional but recommended) Index on itinerary_items(itinerary_id) 
-- Although usually already existing as a foreign key index in some platforms, 
-- explicitly ensuring it for the Timeline view.
CREATE INDEX IF NOT EXISTS idx_itinerary_items_itinerary_id ON public.itinerary_items(itinerary_id);

-- 4. Composite index for sorted timeline reads
CREATE INDEX IF NOT EXISTS idx_itinerary_items_day_sort_time 
ON public.itinerary_items(itinerary_id, day_number, sort_order, time_slot);
