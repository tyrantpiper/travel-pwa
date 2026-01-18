-- ==============================================================================
-- Migration: Harden Itinerary Identity & Sync (Phase 7)
-- Description: 
-- 1. Converts 'user_id' in itineraries to UUID.
-- 2. Enforces Foreign Key constraint to public.users.
-- 3. Extends the global sync trigger to propagate Name changes to itineraries.
-- ==============================================================================

-- 1. SCHEMA CONVERSION: user_id to UUID in itineraries
DO $$ 
BEGIN 
    -- Only alter if it's still text
    IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'itineraries' AND column_name = 'user_id') = 'text' THEN
        ALTER TABLE public.itineraries ALTER COLUMN user_id TYPE uuid USING (
            CASE 
                WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
                THEN user_id::uuid 
                ELSE NULL 
            END
        );
    END IF;
END $$;

-- 2. ADD FOREIGN KEY
ALTER TABLE public.itineraries 
DROP CONSTRAINT IF EXISTS fk_itineraries_user;

ALTER TABLE public.itineraries
ADD CONSTRAINT fk_itineraries_user
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;

-- 3. BACKFILL NAMES (Caching Layer)
UPDATE public.itineraries i
SET creator_name = u.name
FROM public.users u
WHERE i.user_id = u.id
AND (i.creator_name IS DISTINCT FROM u.name OR i.creator_name IS NULL);

-- 4. MASTER SYNC TRIGGER (Unified for members, expenses, and itineraries)
CREATE OR REPLACE FUNCTION public.sync_user_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- A. Update Trip Members (Name & Avatar)
  UPDATE public.trip_members
  SET 
    user_name = NEW.name,
    user_avatar = NEW.avatar_url
  WHERE user_id = NEW.id
  AND (user_name IS DISTINCT FROM NEW.name OR user_avatar IS DISTINCT FROM NEW.avatar_url);

  -- B. Update Expenses (Name cached)
  UPDATE public.expenses
  SET creator_name = NEW.name
  WHERE created_by = NEW.id
  AND (creator_name IS DISTINCT FROM NEW.name);

  -- C. Update Itineraries (Owner Name cached)
  UPDATE public.itineraries
  SET creator_name = NEW.name
  WHERE user_id = NEW.id
  AND (creator_name IS DISTINCT FROM NEW.name);

  RETURN NEW;
END;
$$ LANGUAGE PLPGSQL SECURITY DEFINER;

-- Re-bind trigger to public.users
DROP TRIGGER IF EXISTS on_profile_updated ON public.users;
CREATE TRIGGER on_profile_updated
  AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_user_profile_changes();

-- Done!
