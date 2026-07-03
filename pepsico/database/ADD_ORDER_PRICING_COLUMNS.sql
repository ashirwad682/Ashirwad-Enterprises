-- Add pricing breakdown columns for accurate billing
-- Safe to run multiple times

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_total DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS offer_discount DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_code TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS offer_id UUID;
