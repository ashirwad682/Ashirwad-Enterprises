ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'prepaid' 
CHECK (payment_method IN ('COD', 'prepaid'));

CREATE INDEX IF NOT EXISTS idx_orders_payment_method 
ON orders(payment_method);

COMMENT ON COLUMN orders.payment_method IS 'Payment method: COD (Cash on Delivery) or prepaid (Razorpay)';

SELECT 
  column_name, 
  data_type, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name = 'payment_method';
