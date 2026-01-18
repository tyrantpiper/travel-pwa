-- ==============================================================================
-- Migration: Harden Expense Identity & Sync
-- Description: 
-- 1. Adds 'creator_name' column to expenses for caching.
-- 2. Converts 'created_by' in expenses to UUID for strong integrity.
-- 3. Enforces Foreign Key constraint to public.users.
-- 4. Extends the sync trigger to propagate Name changes to expenses.
-- ==============================================================================

-- 1. SCHEMA EVOLUTION: Add creator_name
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS creator_name TEXT;

-- 2. SCHEMA CONVERSION: created_by to UUID
DO $$ 
BEGIN 
    -- Only alter if it's still text
    IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'created_by') = 'text' THEN
        ALTER TABLE public.expenses ALTER COLUMN created_by TYPE uuid USING (
            CASE 
                WHEN created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
                THEN created_by::uuid 
                ELSE NULL 
            END
        );
    END IF;
END $$;

-- 3. ORPHAN CLEANUP
-- Remove expenses that refer to users not in public.users to prevent FK error.
DELETE FROM public.expenses
WHERE created_by IS NOT NULL 
AND created_by NOT IN (SELECT id FROM public.users);

-- 4. ADD FOREIGN KEY
ALTER TABLE public.expenses 
DROP CONSTRAINT IF EXISTS fk_expenses_user;

ALTER TABLE public.expenses
ADD CONSTRAINT fk_expenses_user
FOREIGN KEY (created_by)
REFERENCES public.users(id)
ON DELETE CASCADE;

-- 5. BACKFILL NAMES
UPDATE public.expenses e
SET creator_name = u.name
FROM public.users u
WHERE e.created_by = u.id
AND (e.creator_name IS DISTINCT FROM u.name OR e.creator_name IS NULL);

-- 6. EXTEND SYNC TRIGGER
CREATE OR REPLACE FUNCTION public.sync_user_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Update Trip Members
  IF (OLD.name <> NEW.name) OR (OLD.avatar_url IS DISTINCT FROM NEW.avatar_url) THEN
    UPDATE public.trip_members
    SET 
      user_name = NEW.name,
      user_avatar = NEW.avatar_url
    WHERE user_id = NEW.id;
  END IF;

  -- Update Expenses (Only Name)
  IF (OLD.name <> NEW.name) THEN
    UPDATE public.expenses
    SET creator_name = NEW.name
    WHERE created_by = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE PLPGSQL SECURITY DEFINER;

-- Re-bind trigger
DROP TRIGGER IF EXISTS on_profile_updated ON public.users;
CREATE TRIGGER on_profile_updated
  AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_user_profile_changes();

-- Done!
