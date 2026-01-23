-- ============================================================
-- 20260122_sync_creator_name.sql
-- Fix: Sync creator_name in itineraries when profile name changes
-- ============================================================

-- Update the sync_user_profile_changes trigger to also update creator_name in all tables
CREATE OR REPLACE FUNCTION public.sync_user_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Update if Name OR Avatar changed
  IF (OLD.name <> NEW.name) OR (OLD.avatar_url IS DISTINCT FROM NEW.avatar_url) THEN
    -- 1. Update trip_members (existing logic)
    UPDATE public.trip_members
    SET 
      user_name = NEW.name,
      user_avatar = NEW.avatar_url
    WHERE user_id = NEW.id::TEXT;

    -- 🆕 2. Update itineraries.creator_name for trips created by this user
    IF OLD.name <> NEW.name THEN
      UPDATE public.itineraries
      SET creator_name = NEW.name
      WHERE created_by = NEW.id::TEXT;
      
      -- 🆕 3. Update expenses.creator_name for expenses created by this user
      UPDATE public.expenses
      SET creator_name = NEW.name
      WHERE created_by = NEW.id::TEXT;
      
      RAISE NOTICE '✅ Profile sync for user %: Name updated from % to %', NEW.id, OLD.name, NEW.name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_user_profile_update'
  ) THEN
    CREATE TRIGGER on_user_profile_update
      AFTER UPDATE ON public.users
      FOR EACH ROW EXECUTE PROCEDURE public.sync_user_profile_changes();
    RAISE NOTICE '✅ Created trigger on_user_profile_update';
  ELSE
    RAISE NOTICE '✅ Trigger on_user_profile_update already exists';
  END IF;
END $$;
