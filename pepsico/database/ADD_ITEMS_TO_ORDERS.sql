-- Migration: Add items and total_amount columns to orders table
-- Run this in your Supabase SQL Editor

-- Add items column (JSONB array to store multiple products per order)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- Add total_amount column (to store the final order amount)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN orders.items IS 'JSON array of items: [{"product_id": "uuid", "quantity": number}]';
COMMENT ON COLUMN orders.total_amount IS 'Final order amount after discounts';

-- Optional: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_items ON orders USING GIN (items);

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('items', 'total_amount');
