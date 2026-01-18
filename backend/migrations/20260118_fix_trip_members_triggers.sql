-- Fix for 500 Error: "cannot cast type text to timestamp with time zone"
-- This error happens when updating public.users, which triggers an update to public.trip_members.
-- The issue likely resides in a bad trigger on trip_members that tries to set updated_at = 'now' (text) instead of now() (function).

-- 1. Drop potential bad triggers
drop trigger if exists handle_updated_at on public.trip_members;
drop trigger if exists set_updated_at on public.trip_members;
drop trigger if exists update_trip_members_modtime on public.trip_members;

-- 2. Ensure updated_at column exists and is correct type (if it was intended to exist)
-- We add it if not exists, to prevent future logical errors if code expects it.
alter table public.trip_members 
add column if not exists updated_at timestamptz default now();

-- 3. Create a CORRECT trigger for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at
  before update on public.trip_members
  for each row execute procedure public.handle_updated_at();

-- 4. Explicitly cast user_name types just in case (defensive)
-- Note: You cannot cast columns via ALTER directly easily if data doesn't fit, 
-- but we assume user_name is text.
