-- 1. Drop the foreign key constraint that blocks anonymous users from updating their profile
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. Add triggers to sync name changes to expenses and itineraries
CREATE OR REPLACE FUNCTION public.sync_user_name_changes()
RETURNS trigger AS $$
BEGIN
  IF old.name IS DISTINCT FROM new.name THEN
    -- Update trip_members
    UPDATE public.trip_members
    SET user_name = new.name
    WHERE user_id = new.id;

    -- Update expenses
    UPDATE public.expenses
    SET creator_name = new.name
    WHERE created_by = new.id;

    -- Update itineraries
    UPDATE public.itineraries
    SET creator_name = new.name
    WHERE created_by = new.id;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
