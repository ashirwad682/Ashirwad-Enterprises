import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import ws from 'ws'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read env file
const envPath = join(__dirname, '..', '.env')
let envContent = ''
try {
  envContent = readFileSync(envPath, 'utf8')
} catch (err) {
  console.error('❌ Could not read .env file from backend directory')
  process.exit(1)
}

// Parse .env
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
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not found in backend/.env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws }
})

async function runMigration() {
  console.log('🚀 Executing Profile Verification Migration...\n')
  const sqlPath = join(__dirname, '..', '..', 'database', 'ADD_DELIVERY_PARTNER_PROFILE_VERIFICATION.sql')
  const sql = readFileSync(sqlPath, 'utf8')

  try {
    console.log('Trying rpc("exec_sql", { query: sql })...')
    const { data: data1, error: error1 } = await supabase.rpc('exec_sql', { query: sql })
    if (!error1) {
      console.log('✅ Migration executed successfully via exec_sql!')
      console.log(data1)
      return
    }
    console.warn('⚠️ exec_sql failed:', error1.message || error1)

    console.log('Trying rpc("sql", { query: sql })...')
    const { data: data2, error: error2 } = await supabase.rpc('sql', { query: sql })
    if (!error2) {
      console.log('✅ Migration executed successfully via sql RPC!')
      console.log(data2)
      return
    }
    console.warn('⚠️ sql RPC failed:', error2.message || error2)

    console.log('Trying direct HTTP call to /rest/v1/rpc/sql...')
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: sql })
    })

    if (response.ok) {
      console.log('✅ Migration executed successfully via HTTP RPC /sql!')
      return
    }
    const responseText = await response.text()
    console.error('❌ HTTP RPC /sql failed:', response.status, responseText)

    console.log('Trying direct HTTP call to /rest/v1/rpc/exec_sql...')
    const response2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: sql })
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
