-- Adds discount metadata columns required for advanced offer handling
-- Run this script in the Supabase SQL editor or psql against your database

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'flat' CHECK (discount_type IN ('flat', 'percent')),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Backfill any NULL values that might exist from earlier migrations
UPDATE offers
SET
  discount_type = COALESCE(discount_type, 'flat'),
  discount_value = COALESCE(discount_value, 0),
  minimum_amount = COALESCE(minimum_amount, 0)
WHERE discount_type IS NULL
   OR discount_value IS NULL
   OR minimum_amount IS NULL;
