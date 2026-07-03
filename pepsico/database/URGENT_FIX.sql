-- =====================================================
-- URGENT FIX - Run this NOW in Supabase SQL Editor
-- =====================================================
-- This adds the minimum required columns to fix "Failed to fetch orders"
-- Safe to run - uses IF NOT EXISTS

-- 1. Add missing columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'prepaid';

-- 2. Create basic indexes
CREATE INDEX IF NOT EXISTS idx_orders_items ON orders USING GIN (items);
CREATE INDEX IF NOT EXISTS idx_orders_total ON orders(total_amount);

-- 3. Verify it worked - you should see these 3 columns listed
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND table_schema = 'public'
AND column_name IN ('items', 'total_amount', 'payment_method')
ORDER BY column_name;
