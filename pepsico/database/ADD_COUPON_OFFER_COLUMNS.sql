-- ============================================
-- EXTEND COUPONS TABLE WITH OFFER METADATA
-- Run this in Supabase SQL editor to enable offer management UI
-- ============================================

ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS headline TEXT;

ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS auto_apply BOOLEAN DEFAULT FALSE;
