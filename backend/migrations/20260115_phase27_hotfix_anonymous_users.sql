-- ==============================================================================
-- Phase 27 Hotfix: Allow Anonymous Users
-- Description: Drops Foreign Key constraint on public.users.id
-- Reason: Frontend generates random UUIDs for anonymous users which are NOT in auth.users.
--         The Foreign Key constraint prevents creating profiles for these users.
-- ==============================================================================

-- 1. Drop the Foreign Key constraint
-- This allows 'id' to contain UUIDs that do not exist in auth.users
alter table public.users drop constraint if exists users_id_fkey;

-- 2. (Optional) Re-verify RLS
-- Since backend usually uses Service Role Key, it bypasses RLS.
-- But if your project uses Anon Key for backend, we might need to open up policies.
-- For now, we assume Service Role Key is used.

-- 3. Ensure 'id' is still Primary Key (it should be from previous script)
-- alter table public.users add primary key (id); -- valid only if PK missing
