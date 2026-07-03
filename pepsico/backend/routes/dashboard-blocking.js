import { Router } from 'express'
import crypto from 'crypto'

const router = Router()

// Generate a random 6-digit alphanumeric access key
function generateAccessKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let key = ''
  const randomBytes = crypto.randomBytes(6)
  for (let i = 0; i < 6; i++) {
    key += chars[randomBytes[i] % chars.length]
  }
  return key
}

// Get dashboard blocking configuration
router.get('/dashboard-blocking', async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('dashboard_blocking')
      .select('*')
      .single()

    if (error) {
      console.error('Dashboard blocking config error:', error)
      
      // Check if table doesn't exist
      if (error.message && (error.message.includes('relation') || error.message.includes('does not exist'))) {
        return res.status(503).json({ 
          error: 'Dashboard blocking not initialized',
          message: 'Run DASHBOARD_BLOCKING_SETUP.md migration first',
          setup_guide: '/pepsico/DASHBOARD_BLOCKING_SETUP.md'
        })
      }
      
      return res.status(404).json({ error: 'Configuration not found' })
    }

    // Check if current time is after block time
    const now = new Date()
    const [blockHours, blockMinutes] = data.block_time.split(':').map(Number)
    const blockTime = new Date()
    blockTime.setHours(blockHours, blockMinutes, 0, 0)

    const isBlocked = data.is_enabled && now >= blockTime

    res.json({
      blockTime: data.block_time,
      isEnabled: data.is_enabled,
      isBlocked: isBlocked,
      nextBlockTime: blockTime.toISOString()
    })
  } catch (error) {
    console.error('Error fetching dashboard blocking config:', error)
    res.status(500).json({ error: error.message })
  }
})

// Check if delivery partner can access dashboard
router.post('/check-dashboard-access', async (req, res) => {
  try {
    const { partnerId, accessKey } = req.body

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner ID required' })
    }

    // Get blocking configuration
    const { data: blockConfig, error: blockError } = await req.supabase
      .from('dashboard_blocking')
      .select('*')
      .single()

    if (blockError || !blockConfig) {
      return res.json({ canAccess: true }) // If config not found, allow access
    }

    // Check if within block time
    const now = new Date()
    const [blockHours, blockMinutes] = blockConfig.block_time.split(':').map(Number)
    const blockTime = new Date()
    blockTime.setHours(blockHours, blockMinutes, 0, 0)

    const isBlocked = blockConfig.is_enabled && now >= blockTime

    if (!isBlocked) {
      return res.json({ canAccess: true, message: 'Dashboard is accessible' })
    }

    // Dashboard is blocked, check for valid access key
    if (!accessKey) {
      return res.json({
        canAccess: false,
        message: 'Dashboard is locked. Access key required.',
        blockTime: blockConfig.block_time
      })
    }

    // Verify access key
    const { data: keyData, error: keyError } = await req.supabase
      .from('delivery_partner_access_keys')
      .select('*')
      .eq('access_key', accessKey)
      .eq('partner_id', partnerId)
      .single()

    if (keyError || !keyData) {
      console.log('❌ Invalid access key attempt for partner:', partnerId)
      return res.json({ canAccess: false, message: 'Invalid access key' })
    }

    // Check if key is expired
    const expiryTime = new Date(keyData.expires_at)
    if (now >= expiryTime) {
      console.log('⏰ Expired access key attempted for partner:', partnerId)
      return res.json({ canAccess: false, message: 'Access key has expired. Please contact your admin for a new one.' })
    }

    // Check if key was already used
    if (keyData.is_used) {
      console.log('♻️ Reuse attempt of already-used access key for partner:', partnerId)
      return res.json({ canAccess: false, message: 'Access key has already been used. Each key is single-use only. Contact your admin for a new access key.' })
    }

    // Mark key as used
    await req.supabase
      .from('delivery_partner_access_keys')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', keyData.id)

    console.log('✅ Dashboard access granted to partner:', partnerId, 'via single-use access key')
    res.json({ canAccess: true, message: 'Access granted' })
  } catch (error) {
    console.error('Error checking dashboard access:', error)
    res.status(500).json({ error: error.message })
  }
})

// Admin: Update block time (admin only)
router.patch('/admin/dashboard-blocking', async (req, res) => {
  try {
    const { blockTime, isEnabled } = req.body
    const adminKey = req.headers['x-admin-api-key']

    if (!adminKey) {
      return res.status(401).json({ error: 'Admin key required' })
    }

    // Validate admin key
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Invalid admin key' })
    }

    // Get the existing configuration first
    const { data: existingConfig, error: fetchError } = await req.supabase
      .from('dashboard_blocking')
      .select('id')
      .limit(1)

    if (fetchError || !existingConfig || existingConfig.length === 0) {
      return res.status(503).json({
        error: 'Database not initialized',
        message: 'Dashboard blocking configuration not found. Run migration first.',
        details: 'Execute: node pepsico/database/run-dashboard-blocking-migration.js'
      })
    }

    const configId = existingConfig[0].id

    // Update configuration by ID
    const { data, error } = await req.supabase
      .from('dashboard_blocking')
      .update({
        block_time: blockTime || '17:30:00',
        is_enabled: isEnabled !== undefined ? isEnabled : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', configId)
      .select()

    if (error) {
      console.error('Error updating dashboard blocking config:', error)
      
      if (error.message && (error.message.includes('relation') || error.message.includes('does not exist'))) {
        return res.status(503).json({ 
          error: 'Database not initialized',
          message: 'Dashboard blocking tables do not exist. Run the migration first.',
          details: 'Execute: node pepsico/database/run-dashboard-blocking-migration.js'
        })
      }
      
      // More detailed error message
      return res.status(500).json({ 
        error: 'Failed to update dashboard blocking configuration',
        message: error.message,
        hint: 'Ensure database tables exist and admin key is valid'
      })
    }

    if (!data || data.length === 0) {
      return res.status(500).json({ 
        error: 'No dashboard blocking configuration found',
        message: 'Could not update configuration. Database may not be initialized.',
        hint: 'Run: node pepsico/database/run-dashboard-blocking-migration.js'
      })
    }

    res.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('Error updating dashboard blocking:', error)
    res.status(500).json({ error: error.message })
  }
})

// Admin: Generate access key for delivery partner
router.post('/admin/generate-access-key', async (req, res) => {
  try {
    const { partnerId, expiryHours } = req.body
    const adminKey = req.headers['x-admin-api-key']

    if (!adminKey) {
      return res.status(401).json({ error: 'Admin key required' })
    }

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner ID required' })
    }

    // Validate admin key
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Invalid admin key' })
    }

    // Check if partner exists
    const { data: partner, error: partnerError } = await req.supabase
      .from('delivery_partners')
      .select('*')
      .eq('id', partnerId)
      .single()

    if (partnerError || !partner) {
      return res.status(404).json({ error: 'Delivery partner not found' })
    }

    // Generate access key
    const accessKey = generateAccessKey()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + (expiryHours || 24)) // Default 24 hours

    const { data: keyData, error: keyError } = await req.supabase
      .from('delivery_partner_access_keys')
      .insert({
        partner_id: partnerId,
        access_key: accessKey,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single()

    if (keyError) {
      console.error('Access key generation error:', keyError)
      
      // Check if error is due to missing table
      if (keyError.message && (keyError.message.includes('relation') || keyError.message.includes('does not exist'))) {
        return res.status(500).json({ 
          error: 'Database not initialized. Please run the dashboard blocking setup migration first.',
          details: 'See DASHBOARD_BLOCKING_SETUP.md for instructions',
          technicalError: keyError.message
        })
      }
      
      return res.status(500).json({ 
        error: 'Error generating access key: ' + (keyError.message || 'Unknown error'),
        technicalError: keyError 
      })
    }

    res.json({
      success: true,
      accessKey: accessKey,
      partnerId: partnerId,
      partnerName: partner.name || partner.phone,
      expiresAt: expiresAt.toISOString(),
      message: `Access key generated successfully. Expires in ${expiryHours || 24} hours.`
    })
  } catch (error) {
    console.error('Error generating access key:', error)
    res.status(500).json({ error: error.message })
  }
})

// Admin: Get all active access keys
router.get('/admin/access-keys', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-api-key']

    if (!adminKey) {
      return res.status(401).json({ error: 'Admin key required' })
    }

    // Validate admin key
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Invalid admin key' })
    }

    // Get all keys with partner info
    const { data: keys, error } = await req.supabase
      .from('delivery_partner_access_keys')
      .select(`
        id,
        access_key,
        expires_at,
        is_used,
        used_at,
        generated_at,
        delivery_partners(id, name, phone, email)
      `)
      .order('generated_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching access keys:', error)
      
      if (error.message && (error.message.includes('relation') || error.message.includes('does not exist'))) {
        return res.status(503).json({ 
          error: 'Dashboard blocking not initialized',
          message: 'Run DASHBOARD_BLOCKING_SETUP.md migration first',
          keys: []
        })
      }
      
      return res.status(500).json({ error: error.message, keys: [] })
    }

    // Filter to show only active and recent keys
    const activeKeys = (keys || []).filter(key => {
      const expiryTime = new Date(key.expires_at)
      return expiryTime > new Date()
    })

    res.json({
      success: true,
      totalKeys: keys?.length || 0,
      activeKeys: activeKeys.length,
      keys: activeKeys.map(key => ({
        id: key.id,
        accessKey: key.access_key.substring(0, 8) + '...',
        partnerName: key.delivery_partners?.name || key.delivery_partners?.phone || 'Unknown',
        partnerPhone: key.delivery_partners?.phone,
        generatedAt: key.generated_at,
        expiresAt: key.expires_at,
        isUsed: key.is_used,
        usedAt: key.used_at
      }))
    })
  } catch (error) {
    console.error('Error fetching access keys:', error)
    res.status(500).json({ error: error.message })
  }
})

// Admin: Revoke access key
router.delete('/admin/access-keys/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params
    const adminKey = req.headers['x-admin-api-key']

    if (!adminKey) {
      return res.status(401).json({ error: 'Admin key required' })
    }

    // Validate admin key
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Invalid admin key' })
    }

    // Delete the key
    const { error } = await req.supabase
      .from('delivery_partner_access_keys')
      .delete()
      .eq('id', keyId)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.json({ success: true, message: 'Access key revoked' })
  } catch (error) {
    console.error('Error revoking access key:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
