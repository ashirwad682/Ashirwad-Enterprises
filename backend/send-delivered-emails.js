import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { generateBillPdf } from './lib/bill-generator.js'
import { sendOrderDeliveredEmail } from './lib/emailer.js'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function sendEmailsForDeliveredOrders() {
  console.log('🔍 Fetching all delivered orders...\n')
  
  try {
    // Get all delivered orders
    const { data: deliveredOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id, created_at, users(full_name, email)')
      .eq('delivery_status', 'delivered')
      .order('created_at', { ascending: false })
    
    if (ordersError) {
      console.error('❌ Error fetching delivered orders:', ordersError)
      return
    }
    
    if (!deliveredOrders || deliveredOrders.length === 0) {
      console.log('ℹ️  No delivered orders found')
      return
    }
    
    console.log(`📦 Found ${deliveredOrders.length} delivered orders\n`)
    console.log('━'.repeat(80))
    
    let successCount = 0
    let failureCount = 0
    
    for (const order of deliveredOrders) {
      const orderRef = `ORD-${order.id.slice(0, 8).toUpperCase()}`
      const customerEmail = order.users?.email
      const customerName = order.users?.full_name || 'Customer'
      
      console.log(`\n📧 Processing Order: ${orderRef}`)
      console.log(`   Customer: ${customerName} (${customerEmail})`)
      
      if (!customerEmail) {
        console.log('   ⚠️  Skipping - No email address found')
        failureCount++
        continue
      }
      
      try {
        // Fetch customer's default address
        const { data: addressData } = await supabase
          .from('addresses')
          .select('address_line, district, state, pincode')
          .eq('user_id', order.user_id)
          .eq('is_default', true)
          .maybeSingle()
        
        let deliveryAddress = 'your delivery address'
        if (addressData) {
          const parts = [
            addressData.address_line,
            addressData.district,
            addressData.state,
            addressData.pincode
          ].filter(Boolean)
          deliveryAddress = parts.join(', ')
        }
        
        console.log('   🔍 Generating bill PDF...')
        const billPdf = await generateBillPdf(order.id, supabase)
        
        console.log('   📧 Sending delivery confirmation email...')
        const emailSent = await sendOrderDeliveredEmail(
          customerEmail,
          {
            orderReference: orderRef,
            customerName: customerName,
            deliveryAddress: deliveryAddress,
            supportEmail: process.env.Email_User || 'support@ashirwadenterprises.com'
          },
          billPdf
        )
        
        if (emailSent) {
          console.log(`   ✅ Email sent successfully!`)
          successCount++
        } else {
          console.log(`   ❌ Failed to send email`)
          failureCount++
        }
        
        // Add a small delay between emails to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`)
        failureCount++
      }
    }
    
    console.log('\n' + '━'.repeat(80))
    console.log('\n📊 Summary:')
    console.log(`   Total Orders: ${deliveredOrders.length}`)
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ❌ Failed: ${failureCount}`)
    console.log('\n✨ Done!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
  
  process.exit(0)
}

// Run the script
sendEmailsForDeliveredOrders()
