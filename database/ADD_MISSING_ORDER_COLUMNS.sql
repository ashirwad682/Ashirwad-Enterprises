-- Add missing columns to orders table for order details and payments
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'COD';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_total DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offer_discount DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
-- Note: offer_id foreign key depends on offers table existing. Run after ADD_OFFERS_TABLE.sql
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offer_id UUID;

-- Create index for faster order lookups
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN public.orders.total_amount IS 'Total amount including all charges and discounts';
COMMENT ON COLUMN public.orders.items IS 'Array of items in order with product_id and quantity';
COMMENT ON COLUMN public.orders.payment_method IS 'Payment method: COD (Cash on Delivery) or prepaid (online payment)';
COMMENT ON COLUMN public.orders.subtotal IS 'Subtotal before any discounts';
COMMENT ON COLUMN public.orders.discount_total IS 'Total discount amount applied';
COMMENT ON COLUMN public.orders.coupon_discount IS 'Discount from coupon code';
COMMENT ON COLUMN public.orders.offer_discount IS 'Discount from offer';
COMMENT ON COLUMN public.orders.shipping_fee IS 'Shipping/delivery fee';
COMMENT ON COLUMN public.orders.gst_amount IS 'GST amount calculated on order';
COMMENT ON COLUMN public.orders.coupon_code IS 'Coupon code used (if any)';
COMMENT ON COLUMN public.orders.offer_id IS 'Reference to offer applied';
