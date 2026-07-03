-- =============================================================================================================
-- COMPLETE DATABASE UPDATE SCRIPT - Run this in Supabase SQL Editor
-- =============================================================================================================
-- This script will add all missing columns and tables required for the PepsiCo Distribution Portal
-- Safe to run multiple times (uses IF NOT EXISTS and ADD COLUMN IF NOT EXISTS)
-- =============================================================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. FIX ORDERS TABLE - Add Missing Columns
-- =====================================================

-- Add items column (JSONB array to store multiple products per order)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- Add total_amount column (to store the final order amount)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0;

-- Add payment_method column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'prepaid';

-- Update the status constraint to include 'Cancelled'
DO $$ 
BEGIN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Update payment_method constraint
DO $$ 
BEGIN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
    ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('cod', 'prepaid'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- =====================================================
-- 2. CREATE OFFERS TABLE
-- =====================================================

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

-- =====================================================
-- 3. CREATE DELIVERY PARTNERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS delivery_partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_partner_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  assigned_area TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. ADD DELIVERY FIELDS TO ORDERS TABLE
-- =====================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner_id UUID REFERENCES delivery_partners(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_amount_received DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_confirmed_by UUID REFERENCES delivery_partners(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

-- Update delivery_status constraint
DO $$ 
BEGIN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_status_check;
    ALTER TABLE orders ADD CONSTRAINT orders_delivery_status_check 
    CHECK (delivery_status IN ('pending', 'assigned', 'packed', 'dispatched', 'out_for_delivery', 'delivered'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- =====================================================
-- 5. CREATE DELIVERY OTP TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS delivery_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  otp TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. CREATE DELIVERY LOGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS delivery_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id),
  event_type TEXT NOT NULL,
  event_details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. CREATE MANAGERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS managers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manager_permissions (
  id SERIAL PRIMARY KEY,
  manager_id UUID REFERENCES managers(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  can_access BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(manager_id, section)
);

-- =====================================================
-- 8. CREATE COUPON USAGE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_code TEXT NOT NULL REFERENCES coupons(code) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(coupon_code, user_id, order_id)
);

-- =====================================================
-- 9. ADD OFFER/DISCOUNT COLUMNS TO ORDERS
-- =====================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES offers(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT REFERENCES coupons(code) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;

-- =====================================================
-- 10. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_items ON orders USING GIN (items);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_total_amount ON orders(total_amount);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner ON orders(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_offer_id ON orders(offer_id);
CREATE INDEX IF NOT EXISTS idx_orders_coupon_code ON orders(coupon_code);

-- Offers indexes
CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(active);
CREATE INDEX IF NOT EXISTS idx_offers_schedule ON offers(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_offers_product ON offers(product_id);

-- Delivery Partners indexes
CREATE INDEX IF NOT EXISTS idx_delivery_partners_email ON delivery_partners(email);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_id ON delivery_partners(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_status ON delivery_partners(status);

-- Delivery OTPs indexes
CREATE INDEX IF NOT EXISTS idx_delivery_otps_order ON delivery_otps(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_otps_expires ON delivery_otps(expires_at);

-- Delivery Logs indexes
CREATE INDEX IF NOT EXISTS idx_delivery_logs_order ON delivery_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_partner ON delivery_logs(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_created ON delivery_logs(created_at);

-- Manager indexes
CREATE INDEX IF NOT EXISTS idx_managers_email ON managers(email);
CREATE INDEX IF NOT EXISTS idx_manager_permissions_manager ON manager_permissions(manager_id);

-- Coupon usage indexes
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_code);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order ON coupon_usage(order_id);

-- =====================================================
-- 11. CREATE/UPDATE TRIGGERS
-- =====================================================

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION set_current_timestamp_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to offers
DROP TRIGGER IF EXISTS set_offers_updated_at ON offers;
CREATE TRIGGER set_offers_updated_at
BEFORE UPDATE ON offers
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp_updated_at();

-- Apply trigger to orders
DROP TRIGGER IF EXISTS set_orders_updated_at ON orders;
CREATE TRIGGER set_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp_updated_at();

-- =====================================================
-- 12. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN orders.items IS 'JSON array of items: [{"product_id": "uuid", "quantity": number, "price": number}]';
COMMENT ON COLUMN orders.total_amount IS 'Final order amount after discounts';
COMMENT ON COLUMN orders.payment_method IS 'Payment method: cod (Cash on Delivery) or prepaid (Razorpay)';
COMMENT ON COLUMN orders.delivery_status IS 'Current delivery status of the order';
COMMENT ON COLUMN orders.discount_amount IS 'Total discount applied from offers and coupons';

-- =====================================================
-- 13. VERIFY INSTALLATION
-- =====================================================

-- Show all orders columns
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Count records in key tables
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'offers', COUNT(*) FROM offers
UNION ALL
SELECT 'delivery_partners', COUNT(*) FROM delivery_partners
UNION ALL
SELECT 'managers', COUNT(*) FROM managers;
