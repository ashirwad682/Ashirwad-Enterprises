-- ============================================
-- ADD COUPONS TABLE TO EXISTING DATABASE
-- Run this in Supabase SQL Editor if coupons table is missing
-- ============================================

-- Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('flat','percent')),
  value NUMERIC NOT NULL,
  min_amount NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_to TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '365 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(active);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_dates ON public.coupons(valid_from, valid_to);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Everyone can view active coupons" ON public.coupons;

-- Create policy for viewing active coupons
CREATE POLICY "Everyone can view active coupons" 
ON public.coupons FOR SELECT 
USING (active = true);

-- Insert sample coupons
INSERT INTO public.coupons (code, type, value, min_amount) VALUES
('SAVE10', 'percent', 10, 0),
('FLAT50', 'flat', 50, 199),
('WELCOME20', 'percent', 20, 299)
ON CONFLICT (code) DO NOTHING;

-- Verify coupons table was created
SELECT * FROM public.coupons;
