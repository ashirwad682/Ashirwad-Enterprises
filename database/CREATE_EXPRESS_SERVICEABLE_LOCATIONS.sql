-- ============================================================
-- Express Delivery Serviceable Locations
-- Run this in your Supabase SQL Editor (one-time setup)
-- ============================================================

-- Create table
CREATE TABLE IF NOT EXISTS public.express_serviceable_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  sub_district TEXT,          -- Sub-district / Tehsil (optional)
  city_town_village TEXT,     -- City / Town / Village (optional)
  pincode VARCHAR(10) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for fast checkout serviceability lookups
CREATE INDEX IF NOT EXISTS idx_express_locs_pincode
  ON public.express_serviceable_locations(pincode)
  WHERE is_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_express_locs_state_district
  ON public.express_serviceable_locations(lower(state), lower(district))
  WHERE is_enabled = TRUE;

-- Row-level security (backend uses service-role key, so RLS won't block it)
ALTER TABLE public.express_serviceable_locations ENABLE ROW LEVEL SECURITY;

-- Allow the backend (service role) full access
CREATE POLICY "Service role full access" ON public.express_serviceable_locations
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Optional: Seed a sample location (Patna, Bihar)
-- Uncomment to add an initial location immediately
-- ============================================================
-- INSERT INTO public.express_serviceable_locations
--   (state, district, sub_district, city_town_village, pincode, is_enabled)
-- VALUES
--   ('Bihar', 'Patna', 'Patna Sadar', 'Patna G.P.O.', '800001', TRUE),
--   ('Bihar', 'Patna', 'Patna Sadar', 'Gardanibagh', '800007', TRUE)
-- ON CONFLICT DO NOTHING;
