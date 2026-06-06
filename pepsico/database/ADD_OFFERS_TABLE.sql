-- Creates dedicated offers table for admin-managed promotions
-- Run inside Supabase SQL editor or psql against your database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'flat' CHECK (discount_type IN ('flat', 'percent')),
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  end_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(active);
CREATE INDEX IF NOT EXISTS idx_offers_schedule ON offers(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_offers_product ON offers(product_id);

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION set_current_timestamp_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_offers_updated_at ON offers;
CREATE TRIGGER set_offers_updated_at
BEFORE UPDATE ON offers
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp_updated_at();
