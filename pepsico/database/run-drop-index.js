import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from backend
dotenv.config({ path: join(__dirname, '../backend/.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function dropImageIndex() {
  console.log('🔧 Dropping idx_products_image index...')
  
  try {
    // Drop the index using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: 'DROP INDEX IF EXISTS idx_products_image;'
    })
    
    if (error) {
      // Try alternative method if RPC doesn't work
      console.log('⚠️  RPC method failed, trying direct query...')
      
      // Use the REST API to execute raw SQL (admin only)
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          query: 'DROP INDEX IF EXISTS idx_products_image;'
        })
      })
      
      if (!response.ok) {
        console.log('⚠️  Automated method not available.')
        console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:')
        console.log('─'.repeat(60))
        console.log('DROP INDEX IF EXISTS idx_products_image;')
        console.log('─'.repeat(60))
        console.log('\n🔗 Go to: https://supabase.com/dashboard/project/kpnvvrmvwfztkfxdsrrb/sql')
        return
      }
    }
    
    console.log('✅ Index dropped successfully!')
    console.log('✅ Products table can now accept compressed images')
    
  } catch (err) {
    console.log('\n⚠️  Could not drop index automatically.')
    console.log('📋 Please run this SQL manually in Supabase SQL Editor:')
    console.log('─'.repeat(60))
    console.log('DROP INDEX IF EXISTS idx_products_image;')
    console.log('─'.repeat(60))
    console.log('\n🔗 Go to: https://supabase.com/dashboard/project/kpnvvrmvwfztkfxdsrrb/sql')
    console.log('\nError:', err.message)
  }
}

dropImageIndex()
