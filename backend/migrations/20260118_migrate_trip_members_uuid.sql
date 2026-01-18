-- ==============================================================================
-- Migration: Fix Trip Members Integrity & Sync Strategy
-- Description: 
-- 1. Cleans invalid 'test' data from trip_members.
-- 2. Adds 'user_avatar' column for syncing.
-- 3. Converts 'user_id' from TEXT to UUID (Deep Fix).
-- 4. Enforces Foreign Key constraint to public.users.
-- 5. Updates trigger to sync Name AND Avatar.
--
-- CAUTION: This script DELETES data (invalid user_ids) to ensure integrity.
-- ==============================================================================

-- 1. SANITIZATION: Remove records that cannot be cast to UUID
-- This cleans up the 8 "test_user_frontend_verify" records found in audit.
delete from public.trip_members
where user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2. SCHEMA EVOLUTION
-- 2.1 Add user_avatar column
alter table public.trip_members
add column if not exists user_avatar text;

-- 2.2 Convert user_id to UUID (The "Deep Fix")
-- "USING user_id::uuid" tells Postgres how to transform the data.
alter table public.trip_members
alter column user_id type uuid using user_id::uuid;

-- 2.3 Remove Orphaned Records (Crucial Fix)
-- We must remove records pointing to users that don't exist in public.users
-- otherwise the Foreign Key constraint will fail.
delete from public.trip_members
where user_id not in (select id from public.users);

-- 2.4 Add Foreign Key Constraint
-- This ensures no "ghost members". If a user is deleted, their trip membership is removed.
alter table public.trip_members
add constraint fk_trip_members_user
foreign key (user_id)
references public.users(id)
on delete cascade;

-- 3. BACKFILL (One-time Sync)
-- Update existing trip_members with avatars from public.users
update public.trip_members tm
set user_avatar = u.avatar_url
from public.users u
where tm.user_id = u.id;

-- 4. TRIGGER UPGRADE
-- Redefine the sync function to handle Name AND Avatar.
create or replace function public.sync_user_profile_changes()
returns trigger as $$
begin
  -- Update if Name OR Avatar changed
  if (old.name <> new.name) or (old.avatar_url is distinct from new.avatar_url) then
    update public.trip_members
    set 
      user_name = new.name,
      user_avatar = new.avatar_url
    where user_id = new.id; -- Note: user_id is now UUID, so no cast needed!
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 5. REBIND TRIGGER
-- Drop old trigger/function if exists to avoid conflicts
drop trigger if exists on_profile_updated on public.users;
drop function if exists public.sync_user_name_changes; -- Remove the old function

-- Create new trigger
create trigger on_profile_updated
  after update on public.users
  for each row execute procedure public.sync_user_profile_changes();

-- Done!
