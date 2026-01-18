-- Comprehensive Fix for 500 "text to timestamp" Error
-- This script fixes triggers on BOTH public.users and public.trip_members.

-- 1. Create a safe, standard timestamp update function
-- This avoids dependency on the 'moddatetime' extension which might be missing or misconfigured.
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 2. Fix public.users triggers
drop trigger if exists handle_updated_at on public.users;
drop trigger if exists set_updated_at on public.users;
drop trigger if exists on_profile_updated_timestamp on public.users;

create trigger handle_updated_at
  before update on public.users
  for each row execute procedure public.handle_updated_at();

-- 3. Fix public.trip_members triggers (Just to be sure, in case the previous run failed)
drop trigger if exists handle_updated_at on public.trip_members;
drop trigger if exists set_updated_at on public.trip_members;
drop trigger if exists update_trip_members_modtime on public.trip_members;

-- Ensure column exists
alter table public.trip_members 
add column if not exists updated_at timestamptz default now();

create trigger handle_updated_at
  before update on public.trip_members
  for each row execute procedure public.handle_updated_at();

-- 4. Verify public.users columns (Just in case)
alter table public.users 
alter column updated_at type timestamptz using updated_at::timestamptz;

