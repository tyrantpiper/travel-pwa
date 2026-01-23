-- ==============================================================================
-- Migration: Atomic Tool Card Updates (Phase 11)
-- Description: 
-- 1. Creates an RPC to update only the 'credit_cards' key in 'itineraries.content'.
-- 2. Prevents race conditions where updating tools overwrites concurrent itinerary edits.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_trip_credit_cards(target_trip_id UUID, new_cards JSONB)
RETURNS VOID AS $$
BEGIN
  UPDATE public.itineraries
  SET content = jsonb_set(COALESCE(content, '{}'::jsonb), '{credit_cards}', new_cards, true)
  WHERE id = target_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access (if needed, though already SECURITY DEFINER)
-- ALREADY HANDLED BY DATABASE ROLES
