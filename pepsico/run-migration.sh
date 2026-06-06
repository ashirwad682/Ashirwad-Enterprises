#!/bin/bash

# Dashboard Blocking Migration Script (via Supabase REST API)
# This script creates the required tables for dashboard blocking system

set -e

echo "🚀 Dashboard Blocking Migration Script"
echo "======================================="
echo ""

# Read .env file
ENV_FILE="./backend/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: Cannot find $ENV_FILE"
  echo "Make sure you're running this from the pepsico directory"
  exit 1
fi

# Extract SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env
SUPABASE_URL=$(grep "^SUPABASE_URL=" "$ENV_FILE" | cut -d'=' -f2 | tr -d ' ')
SUPABASE_SERVICE_ROLE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" "$ENV_FILE" | cut -d'=' -f2 | tr -d ' ')

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: Could not find SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env"
  exit 1
fi

echo "✓ Found Supabase credentials"
echo ""

# SQL Content
SQL_STATEMENTS="
-- Create table for dashboard blocking configuration
CREATE TABLE IF NOT EXISTS public.dashboard_blocking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_time TIME NOT NULL DEFAULT '17:30:00',
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_partner_access_keys_partner_id 
  ON public.delivery_partner_access_keys(partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_partner_access_keys_access_key 
  ON public.delivery_partner_access_keys(access_key);
CREATE INDEX IF NOT EXISTS idx_delivery_partner_access_keys_expires_at 
  ON public.delivery_partner_access_keys(expires_at);

-- Insert default blocking configuration
INSERT INTO public.dashboard_blocking (id, block_time, is_enabled)
VALUES (gen_random_uuid(), '17:30:00', TRUE)
ON CONFLICT DO NOTHING;
"

echo "📝 Creating tables in Supabase..."
echo ""

# Note: Direct SQL execution via REST API requires the exec_sql RPC function
# If that's not available, users will need to run the SQL manually in Supabase console
echo "⚠️  Note: To execute this SQL, please follow these steps:"
echo ""
echo "1. Go to https://app.supabase.com"
echo "2. Select your project"
echo "3. Click 'SQL Editor' → 'New Query'"
echo "4. Copy and paste the SQL below:"
echo "5. Click 'Run'"
echo ""
echo "========================================="
echo "$SQL_STATEMENTS"
echo "========================================="
echo ""
echo "✅ Instructions provided above"
