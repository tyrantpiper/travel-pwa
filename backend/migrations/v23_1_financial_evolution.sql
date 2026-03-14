-- 🚀 V23.1 財務欄位升格 (具備冪等性與版本安全性)
-- Migration: 20240313_v23_1_financial_evolution
-- Description: Promotion of financial sub-columns and introduction of schema versioning for items.

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tip_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS details_schema_version INTEGER DEFAULT 1, -- 預設 1 (考古相容模式)
ADD COLUMN IF NOT EXISTS validation_status VARCHAR DEFAULT 'pass',
ADD COLUMN IF NOT EXISTS validation_code VARCHAR,
ADD COLUMN IF NOT EXISTS validation_message TEXT,
ADD COLUMN IF NOT EXISTS mismatch_amount NUMERIC DEFAULT 0;

COMMENT ON COLUMN expenses.details IS 'JSONB, mapped to "items" attribute in application logic. Structure follows details_schema_version.';
