-- ==============================================================================
-- Migration: Visibility Rescue & Identity Balance
-- Description: 
-- 1. Reverts user_id to TEXT to support legacy non-UUID identifiers.
-- 2. Restores missing creator memberships that were deleted by previous strict migration.
-- 3. Maintains performance via specialized indexes.
-- ==============================================================================

-- 1. Temporary Drop View and Constraints to allow type alteration
-- PostgreSQL prevents altering columns used by views or involved in FKs of different types.
DROP VIEW IF EXISTS public.user_trips_view;

ALTER TABLE public.trip_members
DROP CONSTRAINT IF EXISTS fk_trip_members_user;

-- 2. Revert user_id to TEXT to allow legacy guest memberships
ALTER TABLE public.trip_members
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 3. Recreate the consolidated view (optimized for dashboard)
CREATE OR REPLACE VIEW user_trips_view AS
SELECT DISTINCT ON (user_id, id)
    sub.user_id,
    sub.id,
    sub.title,
    sub.creator_name,
    sub.created_by,
    sub.share_code,
    sub.public_id,
    sub.start_date,
    sub.end_date,
    sub.status,
    sub.content,
    sub.flight_info,
    sub.hotel_info,
    sub.cover_image,
    sub.created_at
FROM (
    -- Case 1: User is an explicit member
    SELECT 
        tm.user_id::text AS user_id,
        i.id,
        i.title,
        i.creator_name,
        i.created_by,
        i.share_code,
        i.public_id,
        i.start_date,
        i.end_date,
        i.status,
        i.content,
        i.flight_info,
        i.hotel_info,
        i.cover_image,
        i.created_at
    FROM itineraries i
    JOIN trip_members tm ON i.id = tm.itinerary_id
    
    UNION ALL
    
    -- Case 2: User is the creator
    SELECT 
        i.created_by::text AS user_id,
        i.id,
        i.title,
        i.creator_name,
        i.created_by,
        i.share_code,
        i.public_id,
        i.start_date,
        i.end_date,
        i.status,
        i.content,
        i.flight_info,
        i.hotel_info,
        i.cover_image,
        i.created_at
    FROM itineraries i
) sub;

-- 4. Fix Trigger Functions (Type-Safe Identity Parity)
-- Fix populate_trip_member_info to handle non-UUID IDs safely
CREATE OR REPLACE FUNCTION public.populate_trip_member_info()
RETURNS TRIGGER AS $$
DECLARE
  u_name TEXT;
  u_avatar TEXT;
BEGIN
  -- ONLY attempt to fetch if user_id is a valid UUID to avoid type mismatch errors
  IF NEW.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT name, avatar_url INTO u_name, u_avatar
      FROM public.users
      WHERE id = NEW.user_id::UUID;
  END IF;

  -- Populate fields if they are null or empty
  IF NEW.user_name IS NULL OR NEW.user_name = '' THEN
    NEW.user_name := COALESCE(u_name, 'Traveler');
  END IF;
  
  IF NEW.user_avatar IS NULL OR NEW.user_avatar = '' THEN
    NEW.user_avatar := u_avatar;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix sync_user_profile_changes to handle text comparison
CREATE OR REPLACE FUNCTION public.sync_user_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Update if Name OR Avatar changed
  IF (OLD.name <> NEW.name) OR (OLD.avatar_url IS DISTINCT FROM NEW.avatar_url) THEN
    UPDATE public.trip_members
    SET 
      user_name = NEW.name,
      user_avatar = NEW.avatar_url
    WHERE user_id = NEW.id::TEXT; -- Explicitly cast UUID to TEXT
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Self-Healing: Restore missing creator memberships
-- This ensures every trip creator is listed as a member of their own trip.
-- This recovers the visibility of trips for users whose member records were deleted.
-- 🛡️ DEFENSIVE: Filter out "Ghost Trips" (NULL created_by) to prevent constraint violations.
INSERT INTO public.trip_members (itinerary_id, user_id, user_name, joined_at)
SELECT 
    id AS itinerary_id, 
    created_by AS user_id, 
    COALESCE(creator_name, 'Traveler') AS user_name,
    created_at AS joined_at
FROM public.itineraries i
WHERE created_by IS NOT NULL  -- 🛡️ CRITICAL FIX: Skip ghost trips
  AND NOT EXISTS (
    SELECT 1 FROM public.trip_members tm 
    WHERE tm.itinerary_id = i.id AND tm.user_id = i.created_by
)
ON CONFLICT (itinerary_id, user_id) DO NOTHING;

-- 5. Re-add indexes for performance
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id_text ON public.trip_members(user_id);

-- 6. Performance Note: The user_trips_view already uses ::text, so it remains performant.
