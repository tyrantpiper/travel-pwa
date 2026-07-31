-- 1. Create or replace the sync_user_name_changes trigger function to handle type casting correctly
CREATE OR REPLACE FUNCTION public.sync_user_name_changes()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(old.name, '') <> COALESCE(new.name, '') THEN
    
    -- 1. Update trip_members (Fix: explicit cast new.id to text)
    UPDATE public.trip_members
    SET user_name = new.name
    WHERE user_id = new.id::text;

    -- 2. Update expenses creator_name
    UPDATE public.expenses
    SET creator_name = new.name
    WHERE created_by = new.id;

    -- 3. Update itineraries creator_name
    UPDATE public.itineraries
    SET creator_name = new.name
    WHERE user_id = new.id;

  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
