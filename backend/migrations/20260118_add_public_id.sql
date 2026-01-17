-- ==============================================================================
-- Phase 21 Migration: Secure Public ID Mapping
-- Description: Adds public_id column to itineraries table for secure sharing
-- Author: Antigravity Agent
-- Date: 2026-01-18
-- ==============================================================================

-- 1. Add public_id column
alter table public.itineraries 
add column if not exists public_id text unique;

-- 2. Index for fast lookup
create index if not exists idx_itineraries_public_id on public.itineraries(public_id);

-- Note: Existing rows will have null public_id. 
-- The backend will auto-generate them on first fetch, or you can run a script.
-- To backfill manually (optional):
-- update public.itineraries set public_id = 'pub_' || encode(gen_random_bytes(6), 'hex') where public_id is null;
