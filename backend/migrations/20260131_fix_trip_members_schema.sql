-- ==============================================================================
-- Migration: Fix trip_members schema (Adding audit columns)
-- Date: 2026-01-31
-- Description: 
--   This is a non-destructive migration that adds the missing 'created_at' 
--   column to the trip_members table. This allows user_trips_view to function 
--   correctly and ensures zero-regression for dashboard data retrieval.
-- ==============================================================================

-- 1. Add created_at column if not exists.
-- Using TIMESTAMPTZ (Standard for UTC compliance) and DEFAULT NOW().
-- This operation is safe and will NOT overwrite existing data.
ALTER TABLE public.trip_members 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- End of Migration
