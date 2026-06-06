-- =====================================================
-- FIX ORDERS TABLE - Add Missing Columns
-- =====================================================
-- Run this SQL in your Supabase SQL Editor
-- This will add all required columns to the orders table

-- Add items column (JSONB array to store multiple products per order)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- Add total_amount column (to store the final order amount)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0;

-- Add payment_method column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'prepaid' CHECK (payment_method IN ('cod', 'prepaid'));

-- Update the status constraint to include 'Cancelled'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled'));

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_items ON orders USING GIN (items);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_total_amount ON orders(total_amount);

-- Add comments for documentation
COMMENT ON COLUMN orders.items IS 'JSON array of items: [{"product_id": "uuid", "quantity": number, "price": number}]';
COMMENT ON COLUMN orders.total_amount IS 'Final order amount after discounts';
COMMENT ON COLUMN orders.payment_method IS 'Payment method: cod (Cash on Delivery) or prepaid (Razorpay)';

-- Verify the changes
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND table_schema = 'public'
ORDER BY ordinal_position;
