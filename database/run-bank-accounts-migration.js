#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import ws from 'ws'

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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws }
})

async function runMigration() {
  console.log('🚀 Executing Bank Accounts Migration...\n')
  const sqlPath = join(__dirname, 'ADD_BANK_ACCOUNTS.sql')
  const sql = readFileSync(sqlPath, 'utf8')

  try {
    console.log('Trying rpc("exec_sql", { sql: sql })...')
    const { data: data1, error: error1 } = await supabase.rpc('exec_sql', { sql: sql })
    if (!error1) {
      console.log('✅ Migration executed successfully via exec_sql!')
      console.log(data1)
      return
    }
    console.warn('⚠️ exec_sql failed:', error1.message || error1)

    console.log('Trying direct HTTP call to /rest/v1/rpc/exec_sql...')
    const response2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ sql: sql })
    })

    if (response2.ok) {
      console.log('✅ Migration executed successfully via HTTP RPC /exec_sql!')
      return
    }
    const response2Text = await response2.text()
    console.error('❌ HTTP RPC /exec_sql failed:', response2.status, response2Text)
    process.exit(1)
  } catch (err) {
    console.error('❌ Unexpected Migration Error:', err.message)
    process.exit(1)
  }
}

runMigration()
