-- Auto-populate user_name and user_avatar on insert to trip_members
-- This ensures that when a user joins or creates a trip, their info is immediately available
-- without waiting for a profile update trigger.

create or replace function public.populate_trip_member_info()
returns trigger as $$
declare
  user_meta jsonb;
begin
  -- Fetch user metadata from public.users
  -- metadata is in raw_user_meta_data column
  select raw_user_meta_data into user_meta
  from public.users
  where id = new.user_id;

  -- Populate fields if they are null or empty
  if new.user_name is null or new.user_name = '' then
    new.user_name := COALESCE(user_meta->>'name', 'Unknown User');
  end if;
  
  if new.user_avatar is null or new.user_avatar = '' then
    new.user_avatar := user_meta->>'avatar_url';
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Create Trigger
drop trigger if exists on_trip_member_insert on public.trip_members;

create trigger on_trip_member_insert
before insert on public.trip_members
for each row execute procedure public.populate_trip_member_info();
