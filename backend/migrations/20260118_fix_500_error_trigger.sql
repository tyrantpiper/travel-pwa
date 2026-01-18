-- Fix 500 Error in populate_trip_member_info
-- The original function tried to select 'raw_user_meta_data' from public.users, which likely doesn't exist.
-- We switch to selecting 'name' and 'avatar_url' directly from public.users.

create or replace function public.populate_trip_member_info()
returns trigger as $$
declare
  u_name text;
  u_avatar text;
begin
  -- Fetch user profile from public.users
  select name, avatar_url into u_name, u_avatar
  from public.users
  where id = new.user_id;

  -- Populate fields if they are null or empty
  if new.user_name is null or new.user_name = '' then
    new.user_name := COALESCE(u_name, 'Unknown User');
  end if;
  
  if new.user_avatar is null or new.user_avatar = '' then
    new.user_avatar := u_avatar;
  end if;

  return new;
end;
$$ language plpgsql security definer;
