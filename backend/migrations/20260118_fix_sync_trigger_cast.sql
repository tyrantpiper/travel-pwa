-- Fix for 500 Error: "operator does not exist: text = uuid"
-- The issue is in the function `sync_user_name_changes`.
-- It tries to compare `trip_members.user_id` (TEXT) with `new.id` (UUID).
-- Postgres is strict and fails. We must cast the UUID to TEXT.

create or replace function public.sync_user_name_changes()
returns trigger as $$
begin
  -- Only update if name actually changed
  if old.name <> new.name then
    update public.trip_members
    set user_name = new.name
    -- FIX: Cast new.id to text explicitly
    where user_id = new.id::text;
  end if;
  return new;
end;
$$ language plpgsql security definer;
