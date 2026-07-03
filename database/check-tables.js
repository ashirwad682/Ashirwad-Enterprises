import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', 'backend', '.env')

import ws from 'ws'

const envContent = readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    env[match[1].trim()] = match[2].trim()
  }
})

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws }
})

async function check() {
  console.log('Checking bank_accounts...')
  const { data: bData, error: bErr } = await supabase.from('bank_accounts').select('*').limit(1)
  console.log('bank_accounts:', bErr ? bErr.message : 'OK (' + bData.length + ' rows)')

  console.log('Checking salaries...')
  const { data: sData, error: sErr } = await supabase.from('salaries').select('*').limit(1)
  console.log('salaries:', sErr ? sErr.message : 'OK (' + sData.length + ' rows)')
  if (sData && sData.length > 0) console.log('salaries row keys:', Object.keys(sData[0]))

  console.log('Checking refunds...')
  const { data: rData, error: rErr } = await supabase.from('refunds').select('*').limit(1)
  console.log('refunds:', rErr ? rErr.message : 'OK (' + rData.length + ' rows)')
  if (rData && rData.length > 0) console.log('refunds row keys:', Object.keys(rData[0]))

  console.log('Checking managers columns...')
  const { data: mData, error: mErr } = await supabase.from('managers').select('*').limit(1)
  if (mErr) console.log('managers error:', mErr.message)
  else if (mData.length > 0) console.log('managers row keys:', Object.keys(mData[0]))
  else console.log('managers OK but empty')

  console.log('Checking delivery_partners columns...')
  const { data: dpData, error: dpErr } = await supabase.from('delivery_partners').select('*').limit(1)
  if (dpErr) console.log('delivery_partners error:', dpErr.message)
  else if (dpData.length > 0) console.log('delivery_partners row keys:', Object.keys(dpData[0]))
  else console.log('delivery_partners OK but empty')
}

check()
