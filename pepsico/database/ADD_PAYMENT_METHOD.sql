-- Add payment_method column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'prepaid' CHECK (payment_method IN ('COD', 'prepaid'));

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);

-- Comment for documentation
COMMENT ON COLUMN orders.payment_method IS 'Payment method: COD (Cash on Delivery) or prepaid (Razorpay)';
