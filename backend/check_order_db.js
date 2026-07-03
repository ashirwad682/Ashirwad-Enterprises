import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function run() {
  const { data: recent, error: recentErr } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)

  if (recentErr) {
    console.error('Error fetching orders:', recentErr)
    return
  }

  if (!recent || recent.length === 0) {
    console.log('No orders found.')
    return
  }

  const o = recent[0]
  console.log('Latest Order Details:')
  console.log(JSON.stringify(o, null, 2))
}

run()
