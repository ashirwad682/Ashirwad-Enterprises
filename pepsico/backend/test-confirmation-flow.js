import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFlow() {
  console.log('🧪 Testing Confirmation Flow\n');

  // 1. Check if pending update was created
  console.log('1️⃣ Checking for pending updates in database...');
  const { data: pendingUpdates, error } = await supabase
    .from('delivery_partner_pending_updates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('❌ Error querying pending updates:', error.message);
    process.exit(1);
  }

  if (pendingUpdates && pendingUpdates.length > 0) {
    const update = pendingUpdates[0];
    console.log('✅ Found pending update:', {
      id: update.id,
      token: update.confirmation_token.substring(0, 20) + '...',
      status: update.status,
      old_mobile: update.old_data?.mobile_number,
      new_mobile: update.new_data?.mobile_number,
      created_at: update.created_at,
      expires_at: update.expires_at
    });

    // 2. Test approve flow
    console.log('\n2️⃣ Testing approval flow...');
    console.log(`   Token: ${update.confirmation_token}`);
    console.log(`   Partner ID: ${update.partner_id}`);
    console.log(`   Link would be: http://localhost:5001/api/admin/delivery-partners/${update.partner_id}/confirm-update?token=${update.confirmation_token}`);

  } else {
    console.warn('⚠️ No pending updates found');
  }

  // 3. Verify original data is unchanged
  console.log('\n3️⃣ Verifying original partner data is unchanged...');
  const { data: partners, error: partnerError } = await supabase
    .from('delivery_partners')
    .select('id, mobile_number')
    .eq('id', 'a7d8e134-5870-4652-9aef-4644366f3542')
    .limit(1);

  if (!partnerError && partners && partners.length > 0) {
    const partner = partners[0];
    console.log(`   Current mobile: ${partner.mobile_number}`);
    if (partner.mobile_number === '9876543210') {
      console.log('✅ Original data unchanged (still 9876543210)');
    } else if (partner.mobile_number === '9876543999') {
      console.log('❌ Data was updated (should not be!)');
    }
  }

  process.exit(0);
}

testFlow();
