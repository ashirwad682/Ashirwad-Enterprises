-- Fix delivery_status check constraint to include 'assigned' status
-- First, drop the existing constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_status_check;

-- Then, add the updated constraint with all valid statuses
ALTER TABLE orders ADD CONSTRAINT orders_delivery_status_check 
  CHECK (delivery_status IN ('pending', 'assigned', 'out_for_delivery', 'delivered'));
