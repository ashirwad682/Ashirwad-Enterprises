-- Add sales tracking to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS total_sold INTEGER DEFAULT 0;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_total_sold ON public.products(total_sold DESC);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

-- Add comments
COMMENT ON COLUMN public.products.total_sold IS 'Number of units sold - used for Best Seller badge';
