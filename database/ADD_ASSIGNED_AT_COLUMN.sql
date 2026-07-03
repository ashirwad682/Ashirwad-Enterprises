-- Add assigned_at column to orders table for delivery partner assignment tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

-- Create index for better query performance on assigned_at
CREATE INDEX IF NOT EXISTS idx_orders_assigned_at ON orders(assigned_at);
