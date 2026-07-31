-- 1. Create or replace the sync_user_profile_changes trigger function to handle type casting correctly
CREATE OR REPLACE FUNCTION public.sync_user_profile_changes()
 RETURNS trigger AS $function$
BEGIN
  IF (OLD.name <> NEW.name) OR (OLD.avatar_url IS DISTINCT FROM NEW.avatar_url) THEN
    
    -- 1. Update trip_members (user_id is text)
    UPDATE public.trip_members
    SET user_name = NEW.name, user_avatar = NEW.avatar_url
    WHERE user_id = NEW.id::TEXT;

    IF OLD.name <> NEW.name THEN
      -- 2. Update itineraries (created_by is text)
      UPDATE public.itineraries
      SET creator_name = NEW.name
      WHERE created_by = NEW.id::TEXT;
      
      -- 3. Update expenses (created_by is uuid, removed ::TEXT to fix the crash)
      UPDATE public.expenses
      SET creator_name = NEW.name
      WHERE created_by = NEW.id;
      
      RAISE NOTICE '✅ Profile sync for user %: Name updated from % to %', NEW.id, OLD.name, NEW.name;
    END IF;

  END IF;
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up redundant trigger and function
DROP TRIGGER IF EXISTS on_profile_updated ON public.users;
DROP FUNCTION IF EXISTS public.sync_user_name_changes();
