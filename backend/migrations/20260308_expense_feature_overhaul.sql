-- 20260308_expense_feature_overhaul.sql
-- Description: Phase 1 of Expense Feature Overhaul
-- Adds necessary columns for granular expense items and public ledger sharing.

-- 1. Safely expand the `expenses` table
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_icon TEXT NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS payer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NULL;

-- 2. Safely expand the `itineraries` table
ALTER TABLE itineraries
  ADD COLUMN IF NOT EXISTS ledger_share_code UUID DEFAULT uuid_generate_v4();

-- 3. Backfill old itineraries (Guarantee that existing trips have a ledger code)
-- Important: Do not overwrite existing ones if they somehow have a value.
UPDATE itineraries
SET ledger_share_code = uuid_generate_v4()
WHERE ledger_share_code IS NULL;
