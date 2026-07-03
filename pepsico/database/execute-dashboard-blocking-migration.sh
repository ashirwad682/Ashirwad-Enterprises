#!/bin/bash

# Script to execute Supabase database migrations for dashboard blocking

echo "🚀 Executing Dashboard Blocking Migration..."
echo ""

# Check if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set"
  echo ""
  echo "To set these variables, add them to your .env file:"
  echo "SUPABASE_URL=your_supabase_url"
  echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
  exit 1
fi

# Create SQL migration content
SQL_MIGRATION="
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_delivery_partner_access_keys_partner_id ON public.delivery_partner_access_keys(partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_partner_access_keys_access_key ON public.delivery_partner_access_keys(access_key);
CREATE INDEX IF NOT EXISTS idx_delivery_partner_access_keys_expires_at ON public.delivery_partner_access_keys(expires_at);

-- Insert default blocking configuration
INSERT INTO public.dashboard_blocking (id, block_time, is_enabled)
VALUES (gen_random_uuid(), '17:30:00', TRUE)
ON CONFLICT DO NOTHING;
"

# Execute the migration using curl to Supabase SQL interface
echo "📝 Executing SQL migration..."
echo ""

# Use curl to execute SQL directly via Supabase REST API
# This requires using the service role key for elevated privileges

curl -X POST "${SUPABASE_URL}/rest/v1/rpc/sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"$(echo "$SQL_MIGRATION" | sed 's/"/\\"/g' | tr '\n' ' ')\"}" 2>/dev/null

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully!"
  echo ""
  echo "Tables created:"
  echo "  ✓ dashboard_blocking"
  echo "  ✓ delivery_partner_access_keys"
else
  echo "⚠️  Note: Direct SQL execution may not be available via REST API"
  echo ""
  echo "Please run the SQL manually in Supabase SQL Editor:"
  echo "1. Go to Supabase Dashboard"
  echo "2. Click 'SQL Editor'"
  echo "3. Create a new query"
  echo "4. Copy the contents of: database/ADD_DASHBOARD_BLOCKING.sql"
  echo "5. Execute the query"
  exit 1
fi
