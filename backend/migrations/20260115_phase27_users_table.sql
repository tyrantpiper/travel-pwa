-- ==============================================================================
-- Phase 27 Migration: User System Architecture (Scheme A+)
-- Description: Creates public.users table, RLS policies, and Sync Triggers
-- Author: Antigravity Agent
-- Date: 2026-01-15
-- ==============================================================================

-- 1. Create public.users table (Mirror of auth.users)
-- This table is the "Single Source of Truth" for user profiles.
create table if not exists public.users (
  id uuid not null references auth.users on delete cascade,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id)
);

-- 2. Enable Row Level Security (RLS)
-- Critical for security. Users can only update their own profile.
alter table public.users enable row level security;

-- 3. RLS Policies
-- Policy: Everyone can read basic info (id, name, avatar).
-- IMPORTANT: Make sure to NOT select 'email' in your frontend queries if you open this up.
-- Or restrict columns here if Postgres version supports it (Supabase usually does full row).
create policy "Public profiles are viewable by everyone." on public.users
  for select using (true);

-- Policy: Users can insert their own profile.
create policy "Users can insert their own profile." on public.users
  for insert with check (auth.uid() = id);

-- Policy: Users can update their own profile.
create policy "Users can update own profile." on public.users
  for update using (auth.uid() = id);

-- 4. Function: Handle New User (Sync from auth.users)
-- This function runs automatically when a new user signs up via Supabase Auth.
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'name', 
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 5. Trigger: On Auth User Created
-- Binds the function to auth.users table.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. Function: Sync Profile Updates to Trip Members (The "Optimized" Part)
-- When a user updates their name in public.users, this updates all historical trip_members records.
-- This ensures consistency without complex joins.
create or replace function public.sync_user_name_changes()
returns trigger as $$
begin
  -- Only update if name actually changed
  if old.name <> new.name then
    update public.trip_members
    set user_name = new.name
    where user_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 7. Trigger: On Profile Update
-- Binds the sync function to public.users table.
drop trigger if exists on_profile_updated on public.users;
create trigger on_profile_updated
  after update on public.users
  for each row execute procedure public.sync_user_name_changes();

-- ==============================================================================
-- 8. Data Migration (Backfill)
-- Populate public.users with existing data from auth.users.
-- "ON CONFLICT DO NOTHING" ensures we don't crash if checking twice.
-- ==============================================================================
insert into public.users (id, email, name)
select 
  id, 
  email, 
  raw_user_meta_data->>'name'
from auth.users
on conflict (id) do nothing;

-- End of Migration
