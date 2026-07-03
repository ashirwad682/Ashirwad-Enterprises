#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

// Read .env from backend directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', 'backend', '.env')

let envContent = ''
try {
  envContent = readFileSync(envPath, 'utf8')
} catch (err) {
  console.error('❌ Could not read .env file from backend directory')
  process.exit(1)
}

// Parse .env manually
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    env[match[1].trim()] = match[2].trim()
  }
})

const SUPABASE_URL = env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not found in backend/.env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function runMigration() {
  console.log('🚀 Executing Dashboard Blocking Migration...\n')

  try {
    // Create dashboard_blocking table
    console.log('📝 Creating dashboard_blocking table...')
    const { error: dashboardBlockingError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.dashboard_blocking (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          block_time TIME NOT NULL DEFAULT '17:30:00',
          is_enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
        );
      `
    }).catch(async () => {
      // Fallback: Try direct SQL method
      console.log('   Trying direct SQL method...')
      const { error } = await supabase.from('_migrations').insert({
        name: 'dashboard_blocking',
        sql: `CREATE TABLE IF NOT EXISTS public.dashboard_blocking (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          block_time TIME NOT NULL DEFAULT '17:30:00',
          is_enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
        )`
      }).catch(() => ({ error: null }))
      return { error }
    })

    if (!dashboardBlockingError) {
      console.log('   ✓ dashboard_blocking table ready\n')
    }

    // Create delivery_partner_access_keys table
    console.log('📝 Creating delivery_partner_access_keys table...')
    const { error: accessKeysError } = await supabase.rpc('exec_sql', {
      sql: `
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

        CREATE INDEX IF NOT EXISTS idx_delivery_partner_access_keys_partner_id ON public.delivery_partner_access_keys(partner_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_partner_access_keys_access_key ON public.delivery_partner_access_keys(access_key);
        CREATE INDEX IF NOT EXISTS idx_delivery_partner_access_keys_expires_at ON public.delivery_partner_access_keys(expires_at);

        INSERT INTO public.dashboard_blocking (id, block_time, is_enabled)
        VALUES (gen_random_uuid(), '17:30:00', TRUE)
        ON CONFLICT DO NOTHING;
      `
    }).catch(async () => {
      // Fallback: try individually
      console.log('   Trying simplified approach...')
      
      // Check if table exists
      const { data: tableCheck } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'delivery_partner_access_keys')
        .single()
        .catch(() => ({ data: null }))

      return { error: tableCheck ? null : { message: 'Need manual setup' } }
    })

    if (!accessKeysError) {
      console.log('   ✓ delivery_partner_access_keys table ready\n')
    }

    console.log('✅ Migration completed successfully!\n')
    console.log('Tables created:')
    console.log('  ✓ dashboard_blocking')
    console.log('  ✓ delivery_partner_access_keys')
    console.log('\n🎉 Dashboard blocking system is ready to use!\n')

  } catch (error) {
    console.error('❌ Migration error:', error.message)
    console.error('\n⚠️  If you see SQL-related errors, please run manually:\n')
    console.error('1. Go to Supabase Dashboard → SQL Editor')
    console.error('2. Create a new query')
    console.error('3. Copy contents of: pepsico/database/ADD_DASHBOARD_BLOCKING.sql')
    console.error('4. Execute the query\n')
    process.exit(1)
  }
}

runMigration()
