import express from 'express'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { sendDeliveryOtpEmail, sendOrderDeliveredEmail } from '../lib/emailer.js'
import { generateBillPdf } from '../lib/bill-generator.js'

const router = express.Router()

let supabase = null

export function setWarehouseSupabaseClient(client) {
  supabase = client
}

const WAREHOUSE_TOKEN_SECRET = process.env.WAREHOUSE_TOKEN_SECRET || process.env.ADMIN_API_KEY || 'warehouse-portal-secret'
const WAREHOUSE_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const OTP_EXPIRY_MINUTES = 10

// Supabase can return timestamptz without explicit offset — normalize to UTC before comparing
const parseSupabaseTimestamp = (value) => {
  if (!value) return null
  if (value instanceof Date) return value
  const text = value.toString().trim()
  if (!text) return null
  const hasOffset = /([+-]\d{2}:\d{2}|z)$/i.test(text)
  const normalized = hasOffset ? text : `${text}Z`
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}
const STATUS_SEQUENCE = ['pending', 'assigned', 'packed', 'delivered']
const STATUS_LABELS = {
  packed: 'Packed',
  delivered: 'Delivered'
}
const DELIVERY_TO_ORDER_STATUS = {
  pending: 'Pending',
  assigned: 'Approved',
  packed: 'Approved',
  delivered: 'Delivered'
}
const SUPPORT_EMAIL_ADDRESS = process.env.SUPPORT_EMAIL || process.env.Email_User || null

const isSchemaError = (error, identifier = '') => {
  if (!error) return false
  const code = String(error.code || '')
  const message = String(error.message || error.details || error.hint || '')
  const needle = String(identifier || '').toLowerCase()
  return code === '42703' || code === '42P01' || code === 'PGRST204' || (!needle ? false : message.toLowerCase().includes(needle))
}

const normalizeStatus = (status) => {
  if (!status) return 'pending'
  const normalized = status.toString().toLowerCase().replace(/[-\s]+/g, '_')
  // Legacy pickup statuses are collapsed into packed for the new simplified pickup flow.
  if (normalized === 'dispatched' || normalized === 'out_for_delivery') return 'packed'
  return STATUS_SEQUENCE.includes(normalized) ? normalized : 'pending'
}

const getNextStatusForOrder = (status) => {
  const current = normalizeStatus(status)
  if (current === 'pending' || current === 'assigned') return 'packed'
  if (current === 'packed') return 'delivered'
  return null
}

const mapDeliveryStatusToOrderStatus = (status, fallback = 'Pending') => {
  const normalized = normalizeStatus(status)
  return DELIVERY_TO_ORDER_STATUS[normalized] || fallback
}

const sanitizeIdentifier = (value) => String(value || '').trim()

const buildWarehouseToken = (warehouseId) => {
  const issuedAt = Date.now().toString()
  const base = `${warehouseId}.${issuedAt}`
  const signature = createHash('sha256').update(`${base}.${WAREHOUSE_TOKEN_SECRET}`).digest('hex')
  return `${base}.${signature}`
}

const verifyWarehouseToken = (token, expectedWarehouseId = null) => {
  const raw = String(token || '').trim()
  if (!raw) return { valid: false, error: 'Warehouse session token required' }

  const parts = raw.split('.')
  if (parts.length !== 3) return { valid: false, error: 'Invalid warehouse session token' }

  const [warehouseId, issuedAtText, signature] = parts
  const issuedAt = Number(issuedAtText)
  if (!warehouseId || !Number.isFinite(issuedAt) || !signature) {
    return { valid: false, error: 'Invalid warehouse session token' }
  }

  if (expectedWarehouseId && warehouseId !== expectedWarehouseId) {
    return { valid: false, error: 'Warehouse session does not match requested warehouse' }
  }

  if (Date.now() - issuedAt > WAREHOUSE_TOKEN_MAX_AGE_MS) {
    return { valid: false, error: 'Warehouse session has expired. Please sign in again.' }
  }

  const base = `${warehouseId}.${issuedAtText}`
  const expectedSignature = createHash('sha256').update(`${base}.${WAREHOUSE_TOKEN_SECRET}`).digest('hex')
  if (expectedSignature !== signature) {
    return { valid: false, error: 'Invalid warehouse session token' }
  }

  return { valid: true, warehouseId }
}

const verifyWarehouseAuth = (req, res, next) => {
  const warehouseId = sanitizeIdentifier(req.headers['x-warehouse-id'])
  const authToken = sanitizeIdentifier(req.headers['x-warehouse-auth'])

  if (!warehouseId || !authToken) {
    return res.status(401).json({ error: 'Warehouse authentication required' })
  }

  const verification = verifyWarehouseToken(authToken, warehouseId)
  if (!verification.valid) {
    return res.status(401).json({ error: verification.error || 'Unauthorized warehouse session' })
  }

  req.warehouseId = warehouseId
  next()
}

const sanitizeWarehouse = (warehouse) => {
  if (!warehouse) return null
  return {
    id: warehouse.id,
    name: warehouse.name,
    address: warehouse.address,
    contact_number: warehouse.contact_number || null,
    password_set_at: warehouse.password_set_at || null,
    created_at: warehouse.created_at || null,
    updated_at: warehouse.updated_at || null
  }
}

const fetchWarehouseForAuth = async (warehouseId) => {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, name, address, contact_number, password_hash, password_set_at, created_at, updated_at')
    .eq('id', warehouseId)
    .maybeSingle()

  if (error) throw error
  return data || null
}

const findWarehouseByName = async (name) => {
  const trimmedName = String(name || '').trim().replace(/\s+/g, ' ')
  if (!trimmedName) return null

  const { data, error } = await supabase
    .from('warehouses')
    .select('id, name, address, contact_number, password_hash, password_set_at, created_at, updated_at')
    .limit(500)

  if (error) throw error

  const rows = Array.isArray(data) ? data : []
  const normalizedInput = trimmedName.toLowerCase()
  const exactMatches = rows.filter((row) => String(row?.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === normalizedInput)

  if (exactMatches.length === 0) {
    const looseMatches = rows.filter((row) => String(row?.name || '').trim().replace(/\s+/g, ' ').toLowerCase().includes(normalizedInput))
    if (looseMatches.length === 1) return looseMatches[0]
    if (looseMatches.length > 1) {
      throw new Error('Multiple warehouses match this name. Use the exact warehouse name configured in Admin.')
    }
    return null
  }

  if (exactMatches.length > 1) {
    throw new Error('Multiple warehouses share this name. Rename warehouses to unique names before using warehouse login.')
  }

  return exactMatches[0]
}

const buildCustomerContext = (order) => {
  const user = order?.users && typeof order.users === 'object' ? order.users : {}
  return {
    name: user.full_name || 'Customer',
    email: user.email || null,
    phone: user.phone || null
  }
}

const formatOrderReference = (orderId = '') => orderId.toString().slice(0, 8).toUpperCase()

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString()

const fetchOrderForWarehouse = async (orderIdentifier, warehouseId) => {
  const reference = sanitizeIdentifier(orderIdentifier)
  if (!reference) {
    return { status: 400, error: 'Order reference is required' }
  }

  const orderSelect = 'id, user_id, pickup_warehouse_id, pickup_order, shipping_method, delivery_status, status, total_amount, payment_method, otp_verified, cod_amount_received, pickup_available_from, pickup_available_until, created_at, users(full_name, email, phone)'

  try {
    const exact = await supabase
      .from('orders')
      .select(orderSelect)
      .eq('id', reference)
      .limit(1)

    if (exact.error) {
      return { status: 500, error: exact.error.message || 'Failed to fetch order' }
    }

    let order = Array.isArray(exact.data) && exact.data.length > 0 ? exact.data[0] : null

    if (!order && reference.length >= 6) {
      const partial = await supabase
        .from('orders')
        .select(orderSelect)
        .ilike('id', `${reference}%`)
        .order('created_at', { ascending: false })
        .limit(1)

      if (partial.error) {
        return { status: 500, error: partial.error.message || 'Failed to locate order' }
      }

      order = Array.isArray(partial.data) && partial.data.length > 0 ? partial.data[0] : null
    }

    if (!order) {
      return { status: 404, error: 'Order not found' }
    }

    const assignedWarehouseId = sanitizeIdentifier(order.pickup_warehouse_id)
    if (!assignedWarehouseId || assignedWarehouseId !== warehouseId) {
      return { status: 403, error: 'Not authorized for this order' }
    }

    if (!Boolean(order.pickup_order) && String(order.shipping_method || '').toLowerCase() !== 'pickup_drive') {
      return { status: 409, error: 'This order is not assigned to the pickup workflow' }
    }

    return { order }
  } catch (err) {
    console.error('Warehouse order lookup failed:', err)
    return { status: 500, error: 'Failed to fetch order details' }
  }
}

const insertWarehouseDeliveryLog = async (payload) => {
  if (!supabase) return

  try {
    await supabase
      .from('delivery_logs')
      .insert(payload)
  } catch (logErr) {
    console.warn('Warehouse delivery log write skipped:', logErr?.message || logErr)
  }
}

router.post('/login', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database client unavailable' })
    }

    const warehouseName = String(req.body?.username || req.body?.warehouseName || '').trim()
    const password = String(req.body?.password || '')

    if (!warehouseName) {
      return res.status(400).json({ error: 'Warehouse name is required' })
    }

    const warehouse = await findWarehouseByName(warehouseName)
    if (!warehouse) {
      return res.status(401).json({ error: 'Invalid warehouse credentials' })
    }

    if (!warehouse.password_hash) {
      return res.json({
        success: false,
        requiresPasswordSetup: true,
        message: 'First login detected. Set a password to continue.',
        warehouse: sanitizeWarehouse(warehouse)
      })
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required for this warehouse' })
    }

    const isMatch = await bcrypt.compare(password, warehouse.password_hash)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid warehouse credentials' })
    }

    const token = buildWarehouseToken(warehouse.id)
    res.json({
      success: true,
      token,
      warehouse: sanitizeWarehouse(warehouse)
    })
  } catch (err) {
    console.error('Warehouse login error:', err)
    if (isSchemaError(err, 'password_hash') || isSchemaError(err, 'warehouses')) {
      return res.status(500).json({ error: 'Warehouse portal authentication columns are missing. Run ADD_WAREHOUSE_PORTAL_AUTH.sql.' })
    }
    res.status(500).json({ error: err.message || 'Warehouse login failed' })
  }
})

router.post('/setup-password', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database client unavailable' })
    }

    const warehouseId = sanitizeIdentifier(req.body?.warehouseId)
    const password = String(req.body?.password || '')

    if (!warehouseId || !password) {
      return res.status(400).json({ error: 'warehouseId and password are required' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' })
    }

    const warehouse = await fetchWarehouseForAuth(warehouseId)
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' })
    }

    if (warehouse.password_hash) {
      return res.status(409).json({ error: 'Password is already set for this warehouse. Please use the regular login form.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const timestamp = new Date().toISOString()

    const { data, error } = await supabase
      .from('warehouses')
      .update({
        password_hash: passwordHash,
        password_set_at: timestamp,
        password_updated_at: timestamp,
        updated_at: timestamp
      })
      .eq('id', warehouseId)
      .select('id, name, address, contact_number, password_set_at, created_at, updated_at')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Warehouse not found' })
    }

    const token = buildWarehouseToken(data.id)
    res.json({
      success: true,
      token,
      warehouse: sanitizeWarehouse(data)
    })
  } catch (err) {
    console.error('Warehouse password setup error:', err)
    if (isSchemaError(err, 'password_hash') || isSchemaError(err, 'warehouses')) {
      return res.status(500).json({ error: 'Warehouse portal authentication columns are missing. Run ADD_WAREHOUSE_PORTAL_AUTH.sql.' })
    }
    res.status(500).json({ error: err.message || 'Failed to set warehouse password' })
  }
})

router.get('/me', verifyWarehouseAuth, async (req, res) => {
  try {
    const warehouse = await fetchWarehouseForAuth(req.warehouseId)
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' })
    }

    res.json({ success: true, warehouse: sanitizeWarehouse(warehouse) })
  } catch (err) {
    console.error('Warehouse profile lookup error:', err)
    res.status(500).json({ error: err.message || 'Failed to verify warehouse session' })
  }
})

router.get('/assigned-orders/:warehouseId', verifyWarehouseAuth, async (req, res) => {
  try {
    const warehouseId = sanitizeIdentifier(req.params.warehouseId)
    if (!warehouseId || warehouseId !== req.warehouseId) {
      return res.status(403).json({ error: 'Warehouse access mismatch' })
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        users(full_name, email, phone)
      `)
      .eq('pickup_warehouse_id', warehouseId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const enriched = (Array.isArray(orders) ? orders : [])
      .filter((order) => Boolean(order?.pickup_order) || String(order?.shipping_method || '').toLowerCase() === 'pickup_drive')
      .map((order) => {
        const normalizedStatus = normalizeStatus(order.delivery_status)
        const customer = buildCustomerContext(order)
        return {
          ...order,
          delivery_status: normalizedStatus,
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone
        }
      })

    res.json({ orders: enriched })
  } catch (err) {
    console.error('Warehouse assigned orders error:', err)
    res.status(500).json({ error: err.message || 'Failed to fetch warehouse orders' })
  }
})

router.get('/stats/:warehouseId', verifyWarehouseAuth, async (req, res) => {
  try {
    const warehouseId = sanitizeIdentifier(req.params.warehouseId)
    if (!warehouseId || warehouseId !== req.warehouseId) {
      return res.status(403).json({ error: 'Warehouse access mismatch' })
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, delivery_status, delivered_at, cod_amount_received, pickup_warehouse_id, pickup_order, shipping_method')
      .eq('pickup_warehouse_id', warehouseId)

    if (error) throw error

    const relevantOrders = (Array.isArray(orders) ? orders : []).filter((order) => Boolean(order?.pickup_order) || String(order?.shipping_method || '').toLowerCase() === 'pickup_drive')
    const today = new Date().toDateString()

    const stats = {
      total: relevantOrders.length,
      pending: relevantOrders.filter((order) => ['pending', 'assigned', 'packed'].includes(normalizeStatus(order.delivery_status))).length,
      deliveredToday: relevantOrders.filter((order) => order.delivered_at && new Date(order.delivered_at).toDateString() === today).length,
      codCollected: relevantOrders
        .filter((order) => normalizeStatus(order.delivery_status) === 'delivered' && order.cod_amount_received)
        .reduce((sum, order) => sum + Number(order.cod_amount_received || 0), 0)
    }

    res.json({ stats })
  } catch (err) {
    console.error('Warehouse stats error:', err)
    res.status(500).json({ error: err.message || 'Failed to fetch warehouse stats' })
  }
})

router.post('/orders/:orderIdentifier/otp/send', verifyWarehouseAuth, async (req, res) => {
  try {
    const { orderIdentifier } = req.params
    const warehouseId = req.warehouseId

    const { order, error, status } = await fetchOrderForWarehouse(orderIdentifier, warehouseId)
    if (error) {
      return res.status(status || 500).json({ error })
    }

    if (normalizeStatus(order.delivery_status) !== 'packed') {
      return res.status(409).json({ error: 'Order must be marked Packed before requesting OTP' })
    }

    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()

    try {
      await supabase.from('delivery_otps').delete().eq('order_id', order.id)
    } catch (cleanupErr) {
      console.warn('Warehouse OTP cleanup skipped:', cleanupErr?.message || cleanupErr)
    }

    const { data: otpRow, error: otpError } = await supabase
      .from('delivery_otps')
      .insert({ order_id: order.id, otp, expires_at: expiresAt, verified: false })
      .select('id')
      .single()

    if (otpError) throw otpError

    const customer = buildCustomerContext(order)
    const warehouse = await fetchWarehouseForAuth(warehouseId)
    const actorName = warehouse?.name || 'Assigned Warehouse'

    let emailSent = false
    let emailErrorMessage = null
    if (customer.email) {
      try {
        emailSent = await sendDeliveryOtpEmail(customer.email, {
          otp,
          orderReference: formatOrderReference(order.id),
          orderId: order.id,
          partnerName: actorName,
          customerName: customer.name,
          expiresAt,
          supportEmail: SUPPORT_EMAIL_ADDRESS,
          supportPhone: warehouse?.contact_number || null
        })
      } catch (emailErr) {
        emailErrorMessage = emailErr?.message || 'Failed to send OTP email'
        emailSent = false
      }
    } else {
      emailErrorMessage = 'Customer email address unavailable'
    }

    await insertWarehouseDeliveryLog({
      order_id: order.id,
      delivery_partner_id: null,
      pickup_warehouse_id: warehouseId,
      event_type: 'otp_generated',
      event_details: {
        actor_type: 'warehouse',
        actor_name: actorName,
        expires_at: expiresAt,
        email_sent: emailSent,
        fallback_required: !emailSent,
        otp_record_id: otpRow?.id || null,
        reason: emailErrorMessage || null
      }
    })

    const payload = {
      success: true,
      orderId: order.id,
      orderReference: formatOrderReference(order.id),
      expiresAt,
      emailSent,
      message: emailSent
        ? 'OTP sent to customer email. Collect the code when handing over the pickup order.'
        : 'Email unavailable. Share the OTP directly with the customer at pickup.'
    }

    if (!emailSent) {
      payload.otp = otp
      payload.fallback = {
        reason: emailErrorMessage || 'Email service unavailable',
        instructions: 'Share this code with the customer at pickup and confirm it before marking the order as completed.'
      }
    }

    res.json(payload)
  } catch (err) {
    console.error('Warehouse OTP send error:', err)
    res.status(500).json({ error: err.message || 'Failed to generate pickup OTP' })
  }
})

router.post('/orders/:orderIdentifier/otp/verify', verifyWarehouseAuth, async (req, res) => {
  try {
    const { orderIdentifier } = req.params
    const warehouseId = req.warehouseId
    const normalizedOtp = sanitizeIdentifier(req.body?.otp)

    if (!/^\d{6}$/.test(normalizedOtp)) {
      return res.status(400).json({ error: 'Enter a valid 6-digit OTP' })
    }

    const { order, error, status } = await fetchOrderForWarehouse(orderIdentifier, warehouseId)
    if (error) {
      return res.status(status || 500).json({ error })
    }

    const { data: otpRecord, error: fetchError } = await supabase
      .from('delivery_otps')
      .select('id, otp, expires_at, verified, verified_at, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message || 'Failed to verify OTP' })
    }

    if (!otpRecord) {
      return res.status(404).json({ error: 'No OTP found for this order. Request a new code.' })
    }

    if (otpRecord.verified) {
      return res.json({ success: true, alreadyVerified: true, message: 'OTP already verified. You can complete the order.' })
    }

    const parsedExpiry = parseSupabaseTimestamp(otpRecord.expires_at)
    if (!parsedExpiry || parsedExpiry < new Date()) {
      return res.status(400).json({ error: 'OTP has expired. Request a new code.' })
    }

    if (otpRecord.otp !== normalizedOtp) {
      return res.status(400).json({ error: 'Incorrect OTP. Please try again.' })
    }

    const verifiedAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('delivery_otps')
      .update({ verified: true, verified_at: verifiedAt })
      .eq('id', otpRecord.id)

    if (updateError) {
      return res.status(500).json({ error: updateError.message || 'Failed to confirm OTP' })
    }

    await supabase
      .from('orders')
      .update({ otp_verified: true, updated_at: verifiedAt })
      .eq('id', order.id)

    await insertWarehouseDeliveryLog({
      order_id: order.id,
      delivery_partner_id: null,
      pickup_warehouse_id: warehouseId,
      event_type: 'otp_verified',
      event_details: {
        actor_type: 'warehouse',
        verified_at: verifiedAt
      }
    })

    res.json({ success: true, message: 'OTP verified successfully. You can now complete the pickup order.', verifiedAt })
  } catch (err) {
    console.error('Warehouse OTP verification error:', err)
    res.status(500).json({ error: err.message || 'Failed to verify pickup OTP' })
  }
})

router.patch('/status/:orderId', verifyWarehouseAuth, async (req, res) => {
  try {
    const warehouseId = req.warehouseId
    const orderId = sanitizeIdentifier(req.params.orderId)
    const requestedStatus = req.body?.status
    const note = req.body?.note || null

    if (!requestedStatus) {
      return res.status(400).json({ error: 'Status is required' })
    }

    const targetStatus = normalizeStatus(requestedStatus)
    if (!['packed'].includes(targetStatus)) {
      return res.status(400).json({ error: 'Invalid delivery status' })
    }

    const { order, error, status } = await fetchOrderForWarehouse(orderId, warehouseId)
    if (error) {
      return res.status(status || 500).json({ error })
    }

    const currentStatus = normalizeStatus(order.delivery_status)
    if (currentStatus === 'delivered') {
      return res.status(409).json({ error: 'Order already delivered' })
    }

    if (currentStatus === targetStatus) {
      return res.json({ success: true, order: { ...order, delivery_status: currentStatus } })
    }

    const expectedNext = getNextStatusForOrder(currentStatus)
    if (!expectedNext) {
      return res.status(409).json({ error: 'No further status updates allowed' })
    }

    if (targetStatus !== expectedNext) {
      return res.status(409).json({ error: `Next status must be ${STATUS_LABELS[expectedNext] || expectedNext}` })
    }

    const timestamp = new Date().toISOString()
    const orderStatusValue = mapDeliveryStatusToOrderStatus(targetStatus, order.status)
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ delivery_status: targetStatus, status: orderStatusValue, updated_at: timestamp })
      .eq('id', order.id)
      .select('*')
      .single()

    if (updateError) throw updateError

    await insertWarehouseDeliveryLog({
      order_id: order.id,
      delivery_partner_id: null,
      pickup_warehouse_id: warehouseId,
      event_type: `status_${targetStatus}`,
      event_details: {
        actor_type: 'warehouse',
        status: targetStatus,
        label: STATUS_LABELS[targetStatus] || targetStatus,
        note,
        updated_at: timestamp
      }
    })

    res.json({ success: true, order: { ...updatedOrder, delivery_status: normalizeStatus(updatedOrder.delivery_status) } })
  } catch (err) {
    console.error('Warehouse status update error:', err)
    res.status(500).json({ error: err.message || 'Failed to update warehouse order status' })
  }
})

router.patch('/mark-delivered/:orderId', verifyWarehouseAuth, async (req, res) => {
  try {
    const warehouseId = req.warehouseId
    const orderId = sanitizeIdentifier(req.params.orderId)
    let codAmountReceived = req.body?.codAmountReceived

    const { order, error, status } = await fetchOrderForWarehouse(orderId, warehouseId)
    if (error) {
      return res.status(status || 500).json({ error })
    }

    const currentStatus = normalizeStatus(order.delivery_status)
    if (currentStatus !== 'packed') {
      return res.status(409).json({ error: 'Order must be packed before completion' })
    }

    const { data: otpRecord, error: otpError } = await supabase
      .from('delivery_otps')
      .select('id, verified')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otpError) {
      return res.status(500).json({ error: otpError.message || 'Failed to validate pickup OTP' })
    }

    if (!otpRecord || !otpRecord.verified) {
      return res.status(400).json({ error: 'OTP verification required before marking pickup complete' })
    }

    const paymentMethod = String(order.payment_method || '').toLowerCase()
    const isCod = paymentMethod === 'cod'
    const orderTotal = Number(order.total_amount || 0)

    if (isCod) {
      const parsedAmount = Number(codAmountReceived ?? order.cod_amount_received ?? 0)
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Enter the collected COD amount before completing pickup' })
      }
      if (orderTotal > 0 && Math.abs(parsedAmount - orderTotal) > 0.5) {
        return res.status(400).json({ error: 'COD amount must match the billed total' })
      }
      codAmountReceived = parsedAmount
    } else {
      codAmountReceived = null
    }

    const timestamp = new Date().toISOString()
    const updatePayload = {
      delivery_status: 'delivered',
      status: mapDeliveryStatusToOrderStatus('delivered', order.status || 'Delivered'),
      delivered_at: timestamp,
      updated_at: timestamp,
      otp_verified: true
    }

    if (isCod) {
      updatePayload.cod_amount_received = codAmountReceived
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id)

    if (updateError) throw updateError

    await insertWarehouseDeliveryLog({
      order_id: order.id,
      delivery_partner_id: null,
      pickup_warehouse_id: warehouseId,
      event_type: 'status_delivered',
      event_details: {
        actor_type: 'warehouse',
        status: 'delivered',
        label: STATUS_LABELS.delivered,
        cod_amount: isCod ? codAmountReceived : null,
        updated_at: timestamp
      }
    })

    try {
      const warehouse = await fetchWarehouseForAuth(warehouseId)
      const customer = buildCustomerContext(order)
      if (customer.email) {
        const pickupAddress = warehouse
          ? [warehouse.name, warehouse.address].filter(Boolean).join(', ')
          : 'the assigned pickup warehouse'

        // Generate invoice PDF
        let billPdf = null
        try {
          billPdf = await generateBillPdf(order.id, supabase)
          console.log('✅ Bill PDF generated for pickup order:', order.id.toString().slice(0, 8))
        } catch (pdfErr) {
          console.error('❌ Failed to generate bill PDF for pickup:', pdfErr?.message || pdfErr)
        }

        await sendOrderDeliveredEmail(customer.email, {
          orderReference: formatOrderReference(order.id),
          customerName: customer.name,
          deliveryAddress: pickupAddress,
          supportEmail: SUPPORT_EMAIL_ADDRESS
        }, billPdf)
      }
    } catch (emailErr) {
      console.warn('Pickup completion email skipped:', emailErr?.message || emailErr)
    }

    res.json({ success: true, message: 'Pickup order marked as completed successfully' })
  } catch (err) {
    console.error('Warehouse pickup completion error:', err)
    res.status(500).json({ error: err.message || 'Failed to complete pickup order' })
  }
})

export default router