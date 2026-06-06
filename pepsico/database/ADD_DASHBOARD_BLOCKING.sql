-- Create table for dashboard blocking configuration
CREATE TABLE IF NOT EXISTS public.dashboard_blocking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_time TIME NOT NULL DEFAULT '17:30:00', -- 5:30 PM
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create table for access keys
CREATE TABLE IF NOT EXISTS public.delivery_partner_access_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  access_key VARCHAR(32) NOT NULL UNIQUE,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create index for faster lookups
CREATE INDEX idx_delivery_partner_access_keys_partner_id ON public.delivery_partner_access_keys(partner_id);
CREATE INDEX idx_delivery_partner_access_keys_access_key ON public.delivery_partner_access_keys(access_key);
CREATE INDEX idx_delivery_partner_access_keys_expires_at ON public.delivery_partner_access_keys(expires_at);

-- Insert default blocking configuration
INSERT INTO public.dashboard_blocking (id, block_time, is_enabled)
VALUES (gen_random_uuid(), '17:30:00', TRUE)
ON CONFLICT DO NOTHING;
