-- ============================================
-- SUPABASE SQL MIGRATION - RUN THIS FIRST
-- ============================================
-- Copy and paste THIS ENTIRE BLOCK into Supabase SQL Editor
-- Database → SQL Editor → Click "+" → Paste below → RUN
-- ============================================

-- Step 1: Add payment_method column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'prepaid' CHECK (payment_method IN ('COD', 'prepaid'));

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);

-- Step 3: Add comment for documentation
COMMENT ON COLUMN orders.payment_method IS 'Payment method: COD (Cash on Delivery) or prepaid (Razorpay)';

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this AFTER the above to verify changes:
-- SELECT column_name, data_type, column_default FROM information_schema.columns 
-- WHERE table_name = 'orders' AND column_name = 'payment_method';
-- Expected result: payment_method, text, 'prepaid'::text

-- ============================================
-- TESTING QUERY
-- ============================================
-- Check existing orders and their payment method:
-- SELECT id, total_amount, payment_method, delivery_status FROM orders LIMIT 10;
-- All should show payment_method = 'prepaid' (default value)
