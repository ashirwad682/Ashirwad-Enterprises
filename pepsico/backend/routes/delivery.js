import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendDeliveryOtpEmail, sendEarlyDeliveryEmail, sendOrderDeliveredEmail } from '../lib/emailer.js';
import { generateBillPdf } from '../lib/bill-generator.js';

const router = express.Router();

/**
 * POST /api/delivery/reset-password
 * Reset password for delivery partner using token
 */
// ...existing code...
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 6) {
      return res.status(400).json({ error: 'Invalid request.' });
    }
    // Find delivery partner by token and check expiry
    const { data: dp, error } = await supabase
      .from('delivery_partners')
      .select('id, reset_token, reset_token_expiry')
      .eq('reset_token', token)
      .single();
    if (error || !dp) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }
    const now = new Date();
    const expiry = dp.reset_token_expiry ? new Date(dp.reset_token_expiry) : null;
    console.log('[RESET DEBUG] Now:', now.toISOString(), '| Expiry:', expiry ? expiry.toISOString() : 'null');
    if (!expiry || expiry < now) {
      return res.status(400).json({ error: 'Reset token has expired.' });
    }
    // Hash the new password securely
    const hashedPassword = await bcrypt.hash(password, 10);
    // Update password in DB
    const { error: updateErr } = await supabase
      .from('delivery_partners')
      .update({ password_hash: hashedPassword, reset_token: null, reset_token_expiry: null })
      .eq('id', dp.id);
    if (updateErr) throw updateErr;
    res.json({ message: 'Password reset successful.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});
/**
 * POST /api/delivery/forgot-password
 * Initiate password reset for delivery partner
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    // Check if delivery partner exists
    const { data: dp, error } = await supabase
      .from('delivery_partners')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();
    if (error || !dp) {
      return res.status(404).json({ error: 'This email is not registered as a Delivery Partner.' });
    }
    // Generate a reset token (simple random string, in production use JWT or similar)
    const token = Math.random().toString(36).substr(2) + Date.now();
    // Set expiry to 10 minutes from now, always in UTC
    const nowUtc = new Date();
    const expiryUtc = new Date(nowUtc.getTime() + 1000 * 60 * 10);
    const expiryIso = expiryUtc.toISOString();
    console.log('[RESET DEBUG] Creating token at:', nowUtc.toISOString(), '| Expiry set to:', expiryIso);
    // Store token and expiry in DB (add columns if needed)
    const { error: updateErr } = await supabase
      .from('delivery_partners')
      .update({ reset_token: token, reset_token_expiry: expiryIso })
      .eq('id', dp.id);
    if (updateErr) throw updateErr;
    // Send reset email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/delivery-reset-password?token=${token}`;
    const { sendDeliveryResetPasswordEmail } = await import('../lib/emailer.js');
    await sendDeliveryResetPasswordEmail(dp.email, resetLink);
    res.json({ message: 'Reset link sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process reset request.' });
  }
});


// Supabase client will be injected via setSupabaseClient
let supabase = null

export function setSupabaseClient(client) {
  supabase = client
}

// Middleware to verify delivery partner auth
const verifyDeliveryPartner = (req, res, next) => {
  const dpId = req.headers['x-delivery-partner-id']
  if (!dpId) {
    return res.status(401).json({ error: 'Delivery partner ID required' })
  }
  req.dpId = dpId
  next()
}

const verifyAdminApiKey = (req, res, next) => {
  const adminKey = req.headers['x-admin-api-key']
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

const INDIAN_TIMEZONE = 'Asia/Kolkata'
const ATTENDANCE_FACE_BUCKET = 'delivery-attendance-faces'
const ATTENDANCE_MAX_FACE_IMAGE_BYTES = 5 * 1024 * 1024
const CHECK_IN_WINDOW_START_HOUR = 7
const CHECK_IN_LATE_HOUR = 10
const CHECK_IN_HALF_DAY_HOUR = 12
const CHECK_OUT_ALLOWED_HOUR = 17
const IMPOSSIBLE_TRAVEL_SPEED_KMPH = 120
const ATTENDANCE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const ATTENDANCE_RATE_LIMIT_MAX_REQUESTS = 40

const attendanceRateLimiterStore = new Map()

const buildAttendanceRateKey = (scope, req) => {
  const headerIp = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim()
  const ip = headerIp || req.headers['x-real-ip'] || req.ip || 'unknown'
  const actor = req.dpId || req.headers['x-admin-api-key'] || 'anonymous'
  return `${scope}:${actor}:${ip}`
}

const attendanceRateLimit = (scope) => (req, res, next) => {
  const now = Date.now()
  const key = buildAttendanceRateKey(scope, req)
  const bucket = attendanceRateLimiterStore.get(key)

  if (!bucket || now - bucket.windowStart >= ATTENDANCE_RATE_LIMIT_WINDOW_MS) {
    attendanceRateLimiterStore.set(key, { windowStart: now, count: 1 })
    return next()
  }

  if (bucket.count >= ATTENDANCE_RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many attendance requests. Please retry shortly.' })
  }

  bucket.count += 1
  attendanceRateLimiterStore.set(key, bucket)
  next()
}

const safeNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const toRadians = (value) => (Number(value) * Math.PI) / 180

const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const nLat1 = safeNumber(lat1)
  const nLon1 = safeNumber(lon1)
  const nLat2 = safeNumber(lat2)
  const nLon2 = safeNumber(lon2)
  if ([nLat1, nLon1, nLat2, nLon2].some((value) => value === null)) {
    return null
  }

  const earthRadiusMeters = 6371000
  const dLat = toRadians(nLat2 - nLat1)
  const dLon = toRadians(nLon2 - nLon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(nLat1)) * Math.cos(toRadians(nLat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusMeters * c
}

const getIndiaTimeParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const mapped = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value
    }
    return acc
  }, {})

  return {
    year: Number(mapped.year),
    month: Number(mapped.month),
    day: Number(mapped.day),
    hour: Number(mapped.hour),
    minute: Number(mapped.minute),
    second: Number(mapped.second)
  }
}

const toAttendanceDate = (date = new Date()) => {
  const parts = getIndiaTimeParts(date)
  const mm = String(parts.month).padStart(2, '0')
  const dd = String(parts.day).padStart(2, '0')
  return `${parts.year}-${mm}-${dd}`
}

const getAttendanceHourInIndia = (date = new Date()) => getIndiaTimeParts(date).hour

const getClientIpAddress = (req) => {
  const forwarded = (req.headers['x-forwarded-for'] || '').toString().trim()
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || req.ip || null
}

const detectVpnOrProxyFlag = (req, networkInfo = {}) => {
  const forwarded = (req.headers['x-forwarded-for'] || '').toString().split(',').map((item) => item.trim()).filter(Boolean)
  const hasProxyHeader = Boolean(req.headers.via || req.headers.forwarded)
  const claimedProxy = Boolean(networkInfo?.vpn || networkInfo?.proxy || networkInfo?.tor)
  return forwarded.length > 1 || hasProxyHeader || claimedProxy
}

const detectFakeGpsFlag = (gpsMeta = {}) => {
  const mocked = Boolean(gpsMeta?.isMocked || gpsMeta?.isFromMockProvider)
  const impossibleAccuracy = Number(gpsMeta?.accuracy) > 1000
  const deniedPermission = gpsMeta?.permission === 'denied'
  return mocked || impossibleAccuracy || deniedPermission
}

const ensureLivenessProof = (proof) => {
  if (!proof || typeof proof !== 'object') {
    return { ok: false, error: 'Liveness proof is required for biometric verification' }
  }

  const challengeId = (proof.challengeId || '').toString().trim()
  const challengeResponse = (proof.challengeResponse || '').toString().trim().toLowerCase()
  const blinkCount = Number(proof.blinkCount || 0)

  if (!challengeId || challengeResponse !== 'blink-detected' || blinkCount < 1) {
    return { ok: false, error: 'Live capture validation failed. Please retry with a new blink challenge.' }
  }

  return { ok: true, blinkCount, challengeId, challengeResponse }
}

const parseFaceImagePayload = (faceImage) => {
  if (!faceImage || typeof faceImage !== 'string') {
    throw new Error('Face image is required')
  }

  const trimmed = faceImage.trim()
  const dataUrlMatch = trimmed.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/i)
  if (!dataUrlMatch) {
    throw new Error('Face image must be a valid base64 image payload')
  }

  const mimeType = dataUrlMatch[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : dataUrlMatch[1].toLowerCase()
  const base64Content = dataUrlMatch[3]
  const buffer = Buffer.from(base64Content, 'base64')
  if (!buffer.length) {
    throw new Error('Uploaded face image is empty')
  }

  if (buffer.length > ATTENDANCE_MAX_FACE_IMAGE_BYTES) {
    throw new Error('Face image exceeds 5MB limit')
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  return { buffer, mimeType, hash }
}

const getImageExtension = (mimeType) => {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

const uploadAttendanceFaceImage = async ({ deliveryPartnerId, attendanceDate, eventType, buffer, mimeType, hash }) => {
  if (!supabase) {
    throw new Error('Database client unavailable')
  }

  const extension = getImageExtension(mimeType)
  const filename = `${eventType}-${Date.now()}-${hash.slice(0, 16)}.${extension}`
  const storagePath = `partner-${deliveryPartnerId}/${attendanceDate}/${filename}`

  const { error } = await supabase.storage
    .from(ATTENDANCE_FACE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false
    })

  if (error) {
    throw new Error(error.message || 'Failed to store attendance face image')
  }

  return storagePath
}

const createSignedFaceUrl = async (storagePath) => {
  if (!storagePath || !supabase) return null
  const { data, error } = await supabase.storage
    .from(ATTENDANCE_FACE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  if (error) {
    console.warn('Failed to create signed face URL:', error.message || error)
    return null
  }

  return data?.signedUrl || null
}

const deriveCheckInStatus = (hourInIndia) => {
  if (hourInIndia >= CHECK_IN_HALF_DAY_HOUR) return 'half_day'
  if (hourInIndia >= CHECK_IN_LATE_HOUR) return 'late'
  return 'on_time'
}

const deriveCheckOutStatus = (hourInIndia) => {
  if (hourInIndia < CHECK_OUT_ALLOWED_HOUR) return 'early'
  return 'on_time'
}

const deriveDayFraction = (checkInStatus) => {
  if (checkInStatus === 'half_day') return 0.5
  return 1
}

const deriveWorkingStatus = (checkInStatus) => {
  if (checkInStatus === 'half_day') return 'half_day'
  return 'present'
}

const sanitizeAttendanceRow = (row) => {
  if (!row) return null
  const flags = row.flags && typeof row.flags === 'object' ? row.flags : {}
  return {
    ...row,
    flags,
    suspicious:
      Boolean(row.location_mismatch) ||
      Boolean(row.fake_gps) ||
      Boolean(row.vpn_proxy_detected) ||
      Boolean(row.repeated_same_image_hash) ||
      Boolean(row.impossible_travel_time) ||
      Boolean(row.suspicious_early_checkout)
  }
}

const recordAttendanceAudit = async ({
  attendanceId,
  deliveryPartnerId,
  actionType,
  actionBy,
  actionById,
  actionReason,
  beforeData,
  afterData,
  req
}) => {
  if (!supabase) return
  try {
    await supabase
      .from('delivery_attendance_audit_logs')
      .insert({
        attendance_id: attendanceId || null,
        delivery_partner_id: deliveryPartnerId || null,
        action_type: actionType,
        action_by: actionBy,
        action_by_id: actionById || null,
        action_reason: actionReason || null,
        ip_address: getClientIpAddress(req),
        user_agent: req?.headers?.['user-agent'] || null,
        before_data: beforeData || null,
        after_data: afterData || null
      })
  } catch (auditErr) {
    console.warn('Failed to store attendance audit log:', auditErr?.message || auditErr)
  }
}

const hasAnyFraudFlag = (payload = {}) => {
  return (
    Boolean(payload.location_mismatch) ||
    Boolean(payload.fake_gps) ||
    Boolean(payload.vpn_proxy_detected) ||
    Boolean(payload.repeated_same_image_hash) ||
    Boolean(payload.impossible_travel_time) ||
    Boolean(payload.suspicious_early_checkout)
  )
}

const buildFlagsPayload = ({
  existingFlags,
  fakeGps,
  vpnProxyDetected,
  repeatedSameImageHash,
  impossibleTravelTime,
  locationMismatch,
  suspiciousEarlyCheckout,
  livenessChallengeId,
  livenessBlinkCount,
  gpsAccuracy
}) => {
  const nextFlags = {
    ...(existingFlags && typeof existingFlags === 'object' ? existingFlags : {}),
    liveness_challenge_id: livenessChallengeId || null,
    liveness_blink_count: Number(livenessBlinkCount || 0),
    gps_accuracy_meters: safeNumber(gpsAccuracy)
  }

  nextFlags.fake_gps = Boolean(fakeGps)
  nextFlags.vpn_proxy_detected = Boolean(vpnProxyDetected)
  nextFlags.repeated_same_image_hash = Boolean(repeatedSameImageHash)
  nextFlags.impossible_travel_time = Boolean(impossibleTravelTime)
  nextFlags.location_mismatch = Boolean(locationMismatch)
  nextFlags.suspicious_early_checkout = Boolean(suspiciousEarlyCheckout)
  nextFlags.suspicious = hasAnyFraudFlag(nextFlags)

  return nextFlags
}

const findRepeatedHashForPartner = async (deliveryPartnerId, hash, attendanceDate) => {
  if (!deliveryPartnerId || !hash) return false

  const escapedHash = hash.replace(/,/g, '')
  const { data, error } = await supabase
    .from('delivery_partner_attendance')
    .select('id, attendance_date')
    .eq('delivery_partner_id', deliveryPartnerId)
    .neq('attendance_date', attendanceDate)
    .or(`face_check_in_hash.eq.${escapedHash},face_check_out_hash.eq.${escapedHash}`)
    .limit(1)

  if (error) {
    console.warn('Repeated image hash check failed:', error.message || error)
    return false
  }

  return Array.isArray(data) && data.length > 0
}

const computeImpossibleTravelFlag = ({ checkInAt, checkInLat, checkInLon, checkOutAt, checkOutLat, checkOutLon }) => {
  if (!checkInAt || !checkOutAt) return false

  const start = new Date(checkInAt)
  const end = new Date(checkOutAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return false
  }

  const distanceMeters = getDistanceMeters(checkInLat, checkInLon, checkOutLat, checkOutLon)
  if (distanceMeters === null) return false

  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  if (hours <= 0) return false
  const kmph = (distanceMeters / 1000) / hours
  return kmph > IMPOSSIBLE_TRAVEL_SPEED_KMPH
}

// Normalized delivery status flow
export const DELIVERY_FLOW = {
  packed: {
    next: 'dispatched',
    label: 'Packed',
    description: 'Order is being prepared',
    icon: '📦'
  },
  dispatched: {
    next: 'out_for_delivery',
    label: 'Dispatched',
    description: 'Order shipped from warehouse',
    icon: '🚚'
  },
  out_for_delivery: {
    next: 'delivered',
    label: 'Out for Delivery',
    description: 'On the way to you',
    icon: '🛵'
  },
  delivered: {
    next: null,
    label: 'Delivered',
    description: 'Delivery confirmed via OTP',
    icon: '🎉'
  }
}

const STATUS_SEQUENCE = ['pending', 'assigned', 'packed', 'dispatched', 'out_for_delivery', 'delivered']
const STATUS_DETAILS = DELIVERY_FLOW
const STATUS_LABELS = Object.fromEntries(Object.entries(STATUS_DETAILS).map(([key, value]) => [key, value.label]))
const UPDATABLE_STATUSES = Object.keys(STATUS_DETAILS)

const normalizeStatus = (status) => {
  if (!status) return 'pending'
  const normalized = status
    .toString()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')

  if (STATUS_SEQUENCE.includes(normalized)) return normalized
  return 'pending'
}

const DELIVERY_TO_ORDER_STATUS = {
  pending: 'Pending',
  assigned: 'Approved',
  packed: 'Approved',
  dispatched: 'Dispatched',
  out_for_delivery: 'Dispatched',
  delivered: 'Delivered'
}

const mapDeliveryStatusToOrderStatus = (status, fallback) => {
  const normalized = normalizeStatus(status)
  return DELIVERY_TO_ORDER_STATUS[normalized] || fallback || 'Pending'
}

const getNextStatusForOrder = (status) => {
  const normalized = normalizeStatus(status)
  if (normalized === 'pending' || normalized === 'assigned') return 'packed'
  if (normalized === 'packed') return 'dispatched'
  if (normalized === 'dispatched') return 'out_for_delivery'
  if (normalized === 'out_for_delivery') return 'delivered'
  return null
}

const getStatusRank = (status) => STATUS_SEQUENCE.indexOf(normalizeStatus(status))

const mapLogToStatus = (eventType = '') => {
  if (!eventType) return null
  if (eventType.startsWith('status_')) return eventType.replace('status_', '')
  if (eventType === 'delivery_started') return 'out_for_delivery'
  if (eventType === 'delivery_completed') return 'delivered'
  return null
}

const OTP_EXPIRY_MINUTES = 5

const SUPPORT_EMAIL_ADDRESS = process.env.SUPPORT_EMAIL || process.env.Email_User || null
const SUPPORT_PHONE_NUMBER = process.env.SUPPORT_PHONE || null

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString()

const getShippingMethod = (order) => {
  if (!order) return 'standard'
  if (order.shipping_method) return String(order.shipping_method).toLowerCase()
  const fee = Number(order.shipping_fee || 0)
  return fee > 0 ? 'express' : 'standard'
}

const getExpectedDeliveryWindow = (order) => {
  const createdAt = order?.created_at ? new Date(order.created_at) : null
  if (!createdAt || Number.isNaN(createdAt.getTime())) return null

  const method = getShippingMethod(order)
  if (method === 'express') {
    const sameDay = createdAt.getHours() < 12
    const expectedBy = new Date(createdAt)
    expectedBy.setDate(expectedBy.getDate() + (sameDay ? 0 : 1))
    expectedBy.setHours(17, 0, 0, 0)
    return { method: 'express', expectedBy }
  }

  const expectedBy = new Date(createdAt)
  expectedBy.setDate(expectedBy.getDate() + 5)
  expectedBy.setHours(17, 0, 0, 0)
  return { method: 'standard', expectedBy }
}

const formatDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

const ORDER_SELECT_FIELDS = `
  id,
  user_id,
  delivery_partner_id,
  delivery_status,
  status,
  total_amount,
  payment_method,
  otp_verified,
  cod_amount_received,
  users(full_name, email, phone)
`

const sanitizeIdentifier = (value) => {
  if (!value) return ''
  return value.toString().trim()
}

const formatOrderReference = (orderId = '') => orderId.toString().slice(0, 8).toUpperCase()

const buildCustomerContext = (order) => {
  const user = order?.users && typeof order.users === 'object' ? order.users : {}
  return {
    name: user?.full_name || order?.customer_name || order?.customer_full_name || 'Customer',
    email: user?.email || order?.customer_email || null,
    phone: user?.phone || order?.customer_phone || null
  }
}

const ensureOutForDelivery = (status) => {
  const normalized = normalizeStatus(status)
  if (normalized === 'out_for_delivery') return true
  return false
}

const resolveExpiryDisplay = (isoString) => {
  if (!isoString) return '5 minutes'
  try {
    return new Date(isoString).toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch (e) {
    return '5 minutes'
  }
}

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

async function fetchOrderForPartner(orderIdentifier, dpId) {
  const reference = sanitizeIdentifier(orderIdentifier)
  if (!reference) {
    return { status: 400, error: 'Order reference is required' }
  }

  if (!supabase) {
    return { status: 500, error: 'Database client unavailable' }
  }

  try {
    const exact = await supabase
      .from('orders')
      .select(ORDER_SELECT_FIELDS)
      .eq('id', reference)
      .limit(1)

    if (exact.error) {
      return { status: 500, error: exact.error.message || 'Failed to fetch order' }
    }

    let order = Array.isArray(exact.data) && exact.data.length > 0 ? exact.data[0] : null

    if (!order && reference.length >= 6) {
      const partial = await supabase
        .from('orders')
        .select(ORDER_SELECT_FIELDS)
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

    const assignedPartnerId = sanitizeIdentifier(order.delivery_partner_id)
    const requestPartnerId = sanitizeIdentifier(dpId)

    if (!requestPartnerId || assignedPartnerId !== requestPartnerId) {
      return { status: 403, error: 'Not authorized for this order' }
    }

    return { order }
  } catch (err) {
    console.error('Order lookup failed:', err)
    return { status: 500, error: 'Failed to fetch order details' }
  }
}

/**
 * POST /api/delivery/login
 * Delivery partner login (for future use - currently handled by frontend)
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    // Fetch delivery partner
    const { data: dp, error: fetchError } = await supabase
      .from('delivery_partners')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()

    if (fetchError || !dp) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Verify password using bcrypt
    const passwordMatch = await bcrypt.compare(password, dp.password_hash)
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    res.json({
      success: true,
      deliveryPartner: {
        id: dp.id,
        delivery_partner_id: dp.delivery_partner_id,
        name: dp.name,
        email: dp.email,
        assigned_area: dp.assigned_area
      }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

/**
 * GET /api/delivery/assigned-orders/:dpId
 * Get all orders assigned to a delivery partner
 */
router.get('/assigned-orders/:dpId', verifyDeliveryPartner, async (req, res) => {
  try {
    const { dpId } = req.params

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        users(full_name, email, phone)
      `)
      .eq('delivery_partner_id', dpId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const userIds = [...new Set((orders || []).map((order) => order.user_id).filter(Boolean))]
    let addressMap = new Map()

    if (userIds.length > 0) {
      try {
        const { data: addressRows, error: addressError } = await supabase
          .from('addresses')
          .select('user_id, address_line, pincode, state, district, is_default')
          .in('user_id', userIds)
          .order('is_default', { ascending: false })

        if (!addressError && Array.isArray(addressRows)) {
          for (const row of addressRows) {
            if (!addressMap.has(row.user_id) || row.is_default) {
              addressMap.set(row.user_id, row)
            }
          }
        }
      } catch (addressFetchErr) {
        console.warn('Failed to fetch delivery addresses for assigned orders:', addressFetchErr?.message || addressFetchErr)
      }
    }

    const enriched = (orders || []).map((order) => {
      const normalizedStatus = normalizeStatus(order.delivery_status)
      const preferredAddress = addressMap.get(order.user_id) || null

      const addressPayload = preferredAddress
        ? {
            address_line: preferredAddress.address_line,
            pincode: preferredAddress.pincode,
            state: preferredAddress.state,
            district: preferredAddress.district
          }
        : null

      return {
        ...order,
        addresses: addressPayload ? [addressPayload] : [],
        delivery_status: normalizedStatus,
        address_line: addressPayload?.address_line || null,
        delivery_pincode: addressPayload?.pincode || null,
        delivery_state: addressPayload?.state || null,
        delivery_district: addressPayload?.district || null
      }
    })

    res.json({ orders: enriched })
  } catch (err) {
    console.error('Error fetching orders:', err)
    res.status(500).json({ error: 'Failed to fetch orders' })
  }
})

/**
 * PATCH /api/delivery/start-delivery/:orderId
 * Mark order as out for delivery
 */
router.patch('/start-delivery/:orderId', verifyDeliveryPartner, async (req, res) => {
  try {
    const { orderId } = req.params
    const dpId = req.dpId

    const targetStatus = 'out_for_delivery'
    const statusLabel = STATUS_LABELS[targetStatus] || 'Out for Delivery'
    const timestamp = new Date().toISOString()

    const { error } = await supabase
      .from('orders')
      .update({ delivery_status: targetStatus, status: statusLabel, updated_at: timestamp })
      .eq('id', orderId)

    if (error) throw error

    // Log the action
    await supabase
      .from('delivery_logs')
      .insert({
        order_id: orderId,
        delivery_partner_id: dpId,
        event_type: 'status_out_for_delivery',
        event_details: {
          status: targetStatus,
          label: statusLabel,
          description: DELIVERY_FLOW[targetStatus]?.description || null,
          updated_at: timestamp
        }
      })

    res.json({ success: true, message: 'Delivery started' })
  } catch (err) {
    console.error('Error starting delivery:', err)
    res.status(500).json({ error: 'Failed to start delivery' })
  }
})

/**
 * POST /api/delivery/orders/:orderIdentifier/otp/send
 * Generate and send delivery completion OTP to customer
 */
router.post('/orders/:orderIdentifier/otp/send', verifyDeliveryPartner, async (req, res) => {
  try {
    const { orderIdentifier } = req.params
    const dpId = req.dpId

    const { order, error, status } = await fetchOrderForPartner(orderIdentifier, dpId)
    if (error) {
      return res.status(status || 500).json({ error })
    }

    if (!ensureOutForDelivery(order.delivery_status)) {
      return res.status(409).json({ error: 'Order must be marked Out for Delivery before requesting OTP' })
    }

    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()

    try {
      await supabase
        .from('delivery_otps')
        .delete()
        .eq('order_id', order.id)
    } catch (cleanupErr) {
      console.warn('Failed to cleanup existing delivery OTP records:', cleanupErr?.message || cleanupErr)
    }

    const { data: otpRow, error: otpError } = await supabase
      .from('delivery_otps')
      .insert({
        order_id: order.id,
        otp,
        expires_at: expiresAt,
        verified: false
      })
      .select('id')
      .single()

    if (otpError) throw otpError

    const customerContext = buildCustomerContext(order)

    let partnerDisplay = 'PepsiCo Delivery Partner'
    const partnerLookupId = sanitizeIdentifier(dpId)
    if (partnerLookupId) {
      try {
        const { data: partnerRow } = await supabase
          .from('delivery_partners')
          .select('name, delivery_partner_id')
          .eq('id', partnerLookupId)
          .maybeSingle()

        if (partnerRow) {
          partnerDisplay = partnerRow.name || partnerRow.delivery_partner_id || partnerDisplay
        }
      } catch (partnerErr) {
        console.warn('Failed to load delivery partner profile for OTP email:', partnerErr?.message || partnerErr)
      }
    }

    let emailSent = false
    let emailErrorMessage = null

    if (customerContext.email) {
      try {
        emailSent = await sendDeliveryOtpEmail(customerContext.email, {
          otp,
          orderReference: formatOrderReference(order.id),
          orderId: order.id,
          partnerName: partnerDisplay,
          customerName: customerContext.name,
          expiresAt: resolveExpiryDisplay(expiresAt),
          supportEmail: SUPPORT_EMAIL_ADDRESS,
          supportPhone: SUPPORT_PHONE_NUMBER
        })
      } catch (emailErr) {
        emailErrorMessage = emailErr?.message || 'Failed to send OTP email'
        console.error('Delivery OTP email error:', emailErrorMessage)
        emailSent = false
      }
    } else {
      emailErrorMessage = 'Customer email address unavailable'
    }

    try {
      await supabase
        .from('delivery_logs')
        .insert({
          order_id: order.id,
          delivery_partner_id: order.delivery_partner_id,
          event_type: 'otp_generated',
          event_details: {
            expires_at: expiresAt,
            email_sent: emailSent,
            fallback_required: !emailSent,
            otp_record_id: otpRow?.id || null,
            reason: emailErrorMessage || null
          }
        })
    } catch (logErr) {
      console.warn('Failed to record OTP generation log:', logErr?.message || logErr)
    }

    const payload = {
      success: true,
      orderId: order.id,
      orderReference: formatOrderReference(order.id),
      expiresAt,
      emailSent,
      message: emailSent
        ? 'OTP sent to customer email. Collect the code when handing over the order.'
        : 'Email unavailable. Share the OTP directly with the customer when you deliver the products.'
    }

    if (!emailSent) {
      payload.otp = otp
      payload.fallback = {
        reason: emailErrorMessage || 'Email service unavailable',
        instructions: 'Share this code with the customer upon delivery and ensure they confirm the drop-off.'
      }
    }

    res.json(payload)
  } catch (err) {
    console.error('Delivery OTP send error:', err)
    res.status(500).json({ error: 'Failed to generate delivery OTP' })
  }
})

/**
 * POST /api/delivery/orders/:orderIdentifier/otp/verify
 * Verify delivery completion OTP
 */
router.post('/orders/:orderIdentifier/otp/verify', verifyDeliveryPartner, async (req, res) => {
  try {
    const { orderIdentifier } = req.params
    const { otp } = req.body || {}
    const dpId = req.dpId

    const normalizedOtp = sanitizeIdentifier(otp)
    if (!/^\d{6}$/.test(normalizedOtp)) {
      return res.status(400).json({ error: 'Enter a valid 6-digit OTP' })
    }

    const { order, error, status } = await fetchOrderForPartner(orderIdentifier, dpId)
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
      console.error('Failed to fetch OTP record:', fetchError?.message || fetchError)
      return res.status(500).json({ error: 'Failed to verify OTP' })
    }

    if (!otpRecord) {
      return res.status(404).json({ error: 'No OTP found for this order. Request a new code.' })
    }

    if (otpRecord.verified) {
      return res.json({
        success: true,
        alreadyVerified: true,
        message: 'OTP already verified. You can mark the order as delivered.'
      })
    }

    const expiresAt = parseSupabaseTimestamp(otpRecord.expires_at)
    if (!expiresAt || expiresAt < new Date()) {
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
      console.error('Failed to update OTP record:', updateError?.message || updateError)
      return res.status(500).json({ error: 'Failed to confirm OTP' })
    }

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ otp_verified: true, updated_at: verifiedAt })
      .eq('id', order.id)

    if (orderUpdateError) {
      console.warn('Failed to set otp_verified flag on order:', orderUpdateError?.message || orderUpdateError)
    }

    try {
      await supabase
        .from('delivery_logs')
        .insert({
          order_id: order.id,
          delivery_partner_id: order.delivery_partner_id,
          event_type: 'otp_verified',
          event_details: {
            verified_at: verifiedAt
          }
        })
    } catch (logErr) {
      console.warn('Failed to record OTP verification log:', logErr?.message || logErr)
    }

    res.json({
      success: true,
      message: 'OTP verified successfully. You can now mark the order as delivered.',
      verifiedAt
    })
  } catch (err) {
    console.error('Delivery OTP verification error:', err)
    res.status(500).json({ error: 'Failed to verify delivery OTP' })
  }
})

/**
 * PATCH /api/delivery/status/:orderId
 * Advance delivery status sequentially (delivery partner only)
 */
router.patch('/status/:orderId', verifyDeliveryPartner, async (req, res) => {
  try {
    const { orderId } = req.params
    const dpId = req.dpId
    const { status: requestedStatus, note } = req.body || {}

    if (!requestedStatus) {
      return res.status(400).json({ error: 'Status is required' })
    }

    const targetStatus = normalizeStatus(requestedStatus)

    if (!UPDATABLE_STATUSES.includes(targetStatus)) {
      return res.status(400).json({ error: 'Invalid delivery status' })
    }

    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, delivery_partner_id, delivery_status, status')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    if (order.delivery_partner_id !== dpId) {
      return res.status(403).json({ error: 'Not authorized for this order' })
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
    const statusLabel = STATUS_LABELS[targetStatus] || order.status || targetStatus
    const orderStatusValue = mapDeliveryStatusToOrderStatus(targetStatus, order.status)

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        delivery_status: targetStatus,
        status: orderStatusValue,
        updated_at: timestamp
      })
      .eq('id', orderId)
      .select('*')
      .single()

    if (updateError) throw updateError

    await supabase
      .from('delivery_logs')
      .insert({
        order_id: orderId,
        delivery_partner_id: dpId,
        event_type: `status_${targetStatus}`,
        event_details: {
          status: targetStatus,
          label: statusLabel,
          description: DELIVERY_FLOW[targetStatus]?.description || null,
          note: note || null,
          updated_at: timestamp
        }
      })

    res.json({
      success: true,
      order: {
        ...updatedOrder,
        delivery_status: normalizeStatus(updatedOrder.delivery_status)
      }
    })
  } catch (err) {
    console.error('Status update error:', err)
    res.status(500).json({ error: 'Failed to update delivery status' })
  }
})

/**
 * PATCH /api/delivery/mark-delivered/:orderId
 * Mark order as delivered (with COD validation)
 */
router.patch('/mark-delivered/:orderId', verifyDeliveryPartner, async (req, res) => {
  try {
    const { orderId } = req.params
    const dpId = req.dpId
    let { codAmountReceived } = req.body || {}

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, delivery_partner_id, delivery_status, payment_method, total_amount, cod_amount_received')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    if (order.delivery_partner_id !== dpId) {
      return res.status(403).json({ error: 'Not authorized for this order' })
    }

    const currentStatus = normalizeStatus(order.delivery_status)
    if (currentStatus !== 'out_for_delivery') {
      return res.status(409).json({ error: 'Order must be out for delivery before completion' })
    }

    const paymentMethod = (order.payment_method || '').toLowerCase()
    const isCOD = paymentMethod === 'cod'
    const orderTotal = Number(order.total_amount || 0)

    if (isCOD) {
      const parsedAmount = Number(codAmountReceived ?? order.cod_amount_received ?? 0)
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Enter the collected COD amount before completing delivery' })
      }
      const delta = Math.abs(parsedAmount - orderTotal)
      if (orderTotal > 0 && delta > 0.5) {
        return res.status(400).json({ error: 'COD amount must match the billed total' })
      }
      codAmountReceived = parsedAmount
    } else {
      codAmountReceived = null
    }

    const { data: otpRecord, error: otpError } = await supabase
      .from('delivery_otps')
      .select('id, verified, verified_at, expires_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otpError) {
      console.warn('OTP lookup failed for delivery completion:', otpError?.message || otpError)
    }

    if (!otpRecord || !otpRecord.verified) {
      return res.status(400).json({ error: 'OTP verification required before marking delivery complete' })
    }

    const timestamp = new Date().toISOString()
    const updatePayload = {
      delivery_status: 'delivered',
      status: mapDeliveryStatusToOrderStatus('delivered', order.status || 'Delivered'),
      delivered_at: timestamp,
      updated_at: timestamp,
      delivery_confirmed_by: dpId,
      otp_verified: true
    }

    if (isCOD) {
      updatePayload.cod_amount_received = codAmountReceived
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)

    if (updateError) throw updateError

    await supabase
      .from('delivery_logs')
      .insert({
        order_id: orderId,
        delivery_partner_id: dpId,
        event_type: 'status_delivered',
        event_details: {
          cod_amount: isCOD ? codAmountReceived : null,
          status: 'delivered',
          label: STATUS_LABELS.delivered || 'Delivered',
          description: DELIVERY_FLOW.delivered?.description || null,
          updated_at: timestamp
        }
      })

    // Fetch customer email and address for delivery confirmation email
    try {
      console.log('🔍 Fetching order details for delivery confirmation email...')
      const { data: orderDetails, error: detailsError } = await supabase
        .from('orders')
        .select('id, user_id, users(full_name, email), created_at, shipping_fee')
        .eq('id', orderId)
        .single()
        
      if (detailsError) {
        console.error('❌ Failed to fetch order details:', detailsError)
        throw detailsError
      }
      
      if (!orderDetails || !orderDetails.users || !orderDetails.users.email) {
        console.warn('⚠️ No customer email found for order:', orderId)
        return
      }
      
      // Fetch customer's default address
      let deliveryAddressText = 'your delivery address'
      try {
        const { data: addressData } = await supabase
          .from('addresses')
          .select('address_line, district, state, pincode')
          .eq('user_id', orderDetails.user_id)
          .eq('is_default', true)
          .maybeSingle()
        
        if (addressData) {
          const parts = []
          if (addressData.address_line) parts.push(addressData.address_line)
          if (addressData.district) parts.push(addressData.district)
          if (addressData.state) parts.push(addressData.state)
          if (addressData.pincode) parts.push(addressData.pincode)
          deliveryAddressText = parts.join(', ') || deliveryAddressText
        }
      } catch (addrErr) {
        console.warn('⚠️ Could not fetch address:', addrErr?.message)
        // Continue without address details
      }
      
      console.log('✅ Order details fetched:', {
        orderId: orderId.slice(0, 8),
        customerEmail: orderDetails.users.email,
        customerName: orderDetails.users.full_name
      })
      
      const expectedWindow = getExpectedDeliveryWindow(orderDetails)
      const deliveredAt = new Date(timestamp)
      
      // Generate bill PDF
      let billPdf = null
      try {
        billPdf = await generateBillPdf(orderId, supabase)
        console.log('✅ Bill PDF generated successfully for order:', orderId.slice(0, 8))
      } catch (pdfErr) {
        console.error('❌ Failed to generate bill PDF:', pdfErr?.message || pdfErr)
        // Continue without PDF if generation fails
      }
      
      // Send delivery confirmation email with bill PDF attachment
      console.log('📧 Sending delivery confirmation email to:', orderDetails.users.email)
      try {
        await sendOrderDeliveredEmail(orderDetails.users.email, {
          orderReference: orderId.toString().slice(0, 8).toUpperCase(),
          customerName: orderDetails.users.full_name || 'Customer',
          deliveryAddress: deliveryAddressText,
          supportEmail: SUPPORT_EMAIL_ADDRESS
        }, billPdf)
        console.log('✅ Delivery confirmation email sent successfully')
      } catch (emailErr) {
        console.error('❌ Delivery confirmation email failed:', emailErr?.message || emailErr)
        console.error('   Error details:', emailErr)
      }

      // Send early delivery email if delivered before expected date
      if (expectedWindow && deliveredAt < expectedWindow.expectedBy) {
        console.log('📧 Sending early delivery email to:', orderDetails.users.email)
        try {
          await sendEarlyDeliveryEmail(orderDetails.users.email, {
            orderReference: orderId.toString().slice(0, 8).toUpperCase(),
            customerName: orderDetails.users.full_name || 'Customer',
            expectedBy: formatDateTime(expectedWindow.expectedBy),
            deliveredAt: formatDateTime(deliveredAt),
            supportEmail: SUPPORT_EMAIL_ADDRESS
          })
          console.log('✅ Early delivery email sent successfully')
        } catch (emailErr) {
          console.error('❌ Early delivery email failed:', emailErr?.message || emailErr)
          console.error('   Error details:', emailErr)
        }
      }
    } catch (emailErr) {
      console.error('❌ Failed to send delivery confirmation email:', emailErr?.message || emailErr)
      console.error('   Full error:', emailErr)
    }
    res.json({ success: true, message: 'Order marked as delivered successfully' })
  } catch (err) {
    console.error('Delivery completion error:', err)
    res.status(500).json({ error: 'Failed to mark as delivered' })
  }
})

/**
 * GET /api/delivery/stats/:dpId
 * Get delivery statistics for a delivery partner
 */
router.get('/stats/:dpId', verifyDeliveryPartner, async (req, res) => {
  try {
    const { dpId } = req.params

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('delivery_partner_id', dpId)

    if (error) throw error

    const normalizedOrders = (orders || []).map((order) => ({
      ...order,
      delivery_status: normalizeStatus(order.delivery_status)
    }))

    const today = new Date().toDateString()
    const codCollected = normalizedOrders
      .filter(o => o.delivery_status === 'delivered' && o.cod_amount_received)
      .reduce((sum, o) => sum + (o.cod_amount_received || 0), 0)

    let codSettled = 0
    try {
      const { data: receipts, error: receiptsError } = await supabase
        .from('settlement_receipts')
        .select('total_settled,cash_received')
        .eq('delivery_partner_id', dpId)

      if (receiptsError) throw receiptsError

      codSettled = (receipts || []).reduce((sum, receipt) => {
        const settledValue = receipt.total_settled ?? receipt.cash_received ?? 0
        return sum + Number(settledValue || 0)
      }, 0)
    } catch (receiptsErr) {
      console.warn('Settlement receipts lookup failed:', receiptsErr?.message || receiptsErr)
    }

    const stats = {
      total: normalizedOrders.length,
      pending: normalizedOrders.filter(o => ['pending', 'assigned', 'packed', 'dispatched'].includes(o.delivery_status)).length,
      outForDelivery: normalizedOrders.filter(o => o.delivery_status === 'out_for_delivery').length,
      deliveredToday: normalizedOrders.filter(o => {
        if (!o.delivered_at) return false
        return new Date(o.delivered_at).toDateString() === today
      }).length,
      codCollected,
      codSettled,
      codOutstanding: Math.max(codCollected - codSettled, 0)
    }

    res.json({ stats })
  } catch (err) {
    console.error('Stats error:', err)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

const parseMonthRange = (monthText) => {
  const normalized = (monthText || '').toString().trim()
  const match = normalized.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null
  }

  const startUtc = new Date(Date.UTC(year, month - 1, 1))
  const endUtc = new Date(Date.UTC(year, month, 0))
  return {
    year,
    month,
    startDate: startUtc.toISOString().slice(0, 10),
    endDate: endUtc.toISOString().slice(0, 10),
    label: `${String(year)}-${String(month).padStart(2, '0')}`,
    totalDays: endUtc.getUTCDate()
  }
}

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test((value || '').toString().trim())

const toCsvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

const enrichAttendanceRowsWithFaceUrls = async (rows = []) => {
  return Promise.all(
    rows.map(async (row) => {
      const safeRow = sanitizeAttendanceRow(row)
      return {
        ...safeRow,
        check_in_face_url: await createSignedFaceUrl(row?.face_check_in_path),
        check_out_face_url: await createSignedFaceUrl(row?.face_check_out_path)
      }
    })
  )
}

/**
 * GET /api/delivery/attendance/today
 * Get today's attendance status for the logged-in delivery partner
 */
router.get('/attendance/today', verifyDeliveryPartner, attendanceRateLimit('attendance-today'), async (req, res) => {
  try {
    const deliveryPartnerId = req.dpId
    const attendanceDate = toAttendanceDate()

    const [{ data: partner, error: partnerError }, { data: attendance, error: attendanceError }] = await Promise.all([
      supabase
        .from('delivery_partners')
        .select('id, delivery_partner_id, name, assigned_area, status, salary_per_day, attendance_required')
        .eq('id', deliveryPartnerId)
        .maybeSingle(),
      supabase
        .from('delivery_partner_attendance')
        .select('*')
        .eq('delivery_partner_id', deliveryPartnerId)
        .eq('attendance_date', attendanceDate)
        .maybeSingle()
    ])

    if (partnerError) throw partnerError
    if (!partner) {
      return res.status(404).json({ error: 'Delivery partner not found' })
    }

    if ((partner.status || '').toLowerCase() !== 'active') {
      return res.status(403).json({ error: 'Attendance access is disabled for inactive delivery partner accounts' })
    }

    if (attendanceError) throw attendanceError

    const nowHourInIndia = getAttendanceHourInIndia()
    const attendanceRow = sanitizeAttendanceRow(attendance)

    res.json({
      success: true,
      attendanceDate,
      attendance: attendanceRow,
      partner: {
        id: partner.id,
        delivery_partner_id: partner.delivery_partner_id,
        name: partner.name,
        assigned_area: partner.assigned_area,
        status: partner.status,
        salary_per_day: partner.salary_per_day,
        attendance_required: Boolean(partner.attendance_required)
      },
      canCheckIn:
        nowHourInIndia >= CHECK_IN_WINDOW_START_HOUR &&
        !attendanceRow?.check_in_at &&
        Boolean(partner.attendance_required) &&
        (partner.status || '').toLowerCase() === 'active',
      canCheckOut: Boolean(attendanceRow?.check_in_at) && !attendanceRow?.check_out_at,
      windows: {
        checkIn: {
          startHour: CHECK_IN_WINDOW_START_HOUR,
          lateAfterHour: CHECK_IN_LATE_HOUR,
          halfDayAfterHour: CHECK_IN_HALF_DAY_HOUR
        },
        checkOut: {
          preferredAfterHour: CHECK_OUT_ALLOWED_HOUR
        }
      }
    })
  } catch (err) {
    console.error('Attendance today lookup failed:', err)
    res.status(500).json({ error: 'Failed to load attendance status' })
  }
})

/**
 * GET /api/delivery/attendance/history
 * Get attendance history for the logged-in delivery partner
 */
router.get('/attendance/history', verifyDeliveryPartner, attendanceRateLimit('attendance-history'), async (req, res) => {
  try {
    const deliveryPartnerId = req.dpId
    const limit = Math.max(1, Math.min(Number(req.query.limit || 45), 120))
    const startDate = (req.query.start_date || '').toString().trim()
    const endDate = (req.query.end_date || '').toString().trim()

    let query = supabase
      .from('delivery_partner_attendance')
      .select('*')
      .eq('delivery_partner_id', deliveryPartnerId)
      .order('attendance_date', { ascending: false })
      .limit(limit)

    if (startDate) {
      if (!isIsoDate(startDate)) {
        return res.status(400).json({ error: 'start_date must be in YYYY-MM-DD format' })
      }
      query = query.gte('attendance_date', startDate)
    }

    if (endDate) {
      if (!isIsoDate(endDate)) {
        return res.status(400).json({ error: 'end_date must be in YYYY-MM-DD format' })
      }
      query = query.lte('attendance_date', endDate)
    }

    const { data, error } = await query
    if (error) throw error

    const records = await enrichAttendanceRowsWithFaceUrls(Array.isArray(data) ? data : [])
    res.json({ success: true, records })
  } catch (err) {
    console.error('Attendance history lookup failed:', err)
    res.status(500).json({ error: 'Failed to load attendance history' })
  }
})

/**
 * POST /api/delivery/attendance/check-in
 * Check in once per day with biometric and GPS validation
 */
router.post('/attendance/check-in', verifyDeliveryPartner, attendanceRateLimit('attendance-check-in'), async (req, res) => {
  try {
    const deliveryPartnerId = req.dpId
    const now = new Date()
    const attendanceDate = toAttendanceDate(now)
    const indiaHour = getAttendanceHourInIndia(now)

    if (indiaHour < CHECK_IN_WINDOW_START_HOUR) {
      return res.status(409).json({
        error: `Check-in starts at ${CHECK_IN_WINDOW_START_HOUR}:00 AM IST`
      })
    }

    const {
      latitude,
      longitude,
      locationAddress,
      faceImage,
      livenessProof,
      gpsMeta = {},
      networkInfo = {}
    } = req.body || {}

    const lat = safeNumber(latitude)
    const lon = safeNumber(longitude)

    if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Valid GPS latitude and longitude are required' })
    }

    const livenessValidation = ensureLivenessProof(livenessProof)
    if (!livenessValidation.ok) {
      return res.status(400).json({ error: livenessValidation.error })
    }

    let imagePayload = null
    try {
      imagePayload = parseFaceImagePayload(faceImage)
    } catch (imageErr) {
      return res.status(400).json({ error: imageErr.message || 'Invalid face image payload' })
    }

    const [{ data: partner, error: partnerError }, { data: existing, error: existingError }] = await Promise.all([
      supabase
        .from('delivery_partners')
        .select('*')
        .eq('id', deliveryPartnerId)
        .maybeSingle(),
      supabase
        .from('delivery_partner_attendance')
        .select('*')
        .eq('delivery_partner_id', deliveryPartnerId)
        .eq('attendance_date', attendanceDate)
        .maybeSingle()
    ])

    if (partnerError) throw partnerError
    if (!partner) return res.status(404).json({ error: 'Delivery partner not found' })
    if ((partner.status || '').toLowerCase() !== 'active') {
      return res.status(403).json({ error: 'Inactive partners cannot check in' })
    }
    if (existingError) throw existingError

    if (existing?.check_in_at) {
      return res.status(409).json({ error: 'Check-in already recorded for today' })
    }

    const distanceFromCapturePoint = null
    const locationMismatch = Boolean(existing?.location_mismatch)
    const checkInStatus = deriveCheckInStatus(indiaHour)
    const dayFraction = deriveDayFraction(checkInStatus)
    const workingStatus = deriveWorkingStatus(checkInStatus)
    const fakeGps = detectFakeGpsFlag(gpsMeta)
    const vpnProxyDetected = detectVpnOrProxyFlag(req, networkInfo)
    const repeatedSameImageHash = await findRepeatedHashForPartner(deliveryPartnerId, imagePayload.hash, attendanceDate)

    const checkInFacePath = await uploadAttendanceFaceImage({
      deliveryPartnerId,
      attendanceDate,
      eventType: 'check-in',
      buffer: imagePayload.buffer,
      mimeType: imagePayload.mimeType,
      hash: imagePayload.hash
    })

    const timestamp = now.toISOString()
    const finalFlags = buildFlagsPayload({
      existingFlags: existing?.flags,
      fakeGps: fakeGps || existing?.fake_gps,
      vpnProxyDetected: vpnProxyDetected || existing?.vpn_proxy_detected,
      repeatedSameImageHash: repeatedSameImageHash || existing?.repeated_same_image_hash,
      impossibleTravelTime: Boolean(existing?.impossible_travel_time),
      locationMismatch,
      suspiciousEarlyCheckout: Boolean(existing?.suspicious_early_checkout),
      livenessChallengeId: livenessValidation.challengeId,
      livenessBlinkCount: livenessValidation.blinkCount,
      gpsAccuracy: gpsMeta?.accuracy
    })

    const basePayload = {
      check_in_at: timestamp,
      check_in_status: checkInStatus,
      day_fraction: dayFraction,
      working_status: workingStatus,
      check_in_latitude: lat,
      check_in_longitude: lon,
      check_in_location_text: locationAddress || null,
      check_in_distance_meters: distanceFromCapturePoint,
      location_mismatch: locationMismatch,
      face_check_in_path: checkInFacePath,
      face_check_in_hash: imagePayload.hash,
      face_liveness_check_in_passed: true,
      fake_gps: fakeGps || Boolean(existing?.fake_gps),
      vpn_proxy_detected: vpnProxyDetected || Boolean(existing?.vpn_proxy_detected),
      repeated_same_image_hash: repeatedSameImageHash || Boolean(existing?.repeated_same_image_hash),
      flags: finalFlags,
      last_action_by: 'delivery_partner',
      last_action_at: timestamp
    }

    let savedRow = null
    if (existing?.id) {
      const { data: updated, error: updateError } = await supabase
        .from('delivery_partner_attendance')
        .update(basePayload)
        .eq('id', existing.id)
        .select('*')
        .single()

      if (updateError) throw updateError
      savedRow = updated
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('delivery_partner_attendance')
        .insert({
          delivery_partner_id: deliveryPartnerId,
          attendance_date: attendanceDate,
          ...basePayload
        })
        .select('*')
        .single()

      if (insertError) throw insertError
      savedRow = inserted
    }

    await recordAttendanceAudit({
      attendanceId: savedRow?.id,
      deliveryPartnerId,
      actionType: 'check_in',
      actionBy: 'delivery_partner',
      actionById: deliveryPartnerId,
      beforeData: existing || null,
      afterData: savedRow || null,
      req
    })

    const responseRow = sanitizeAttendanceRow(savedRow)
    responseRow.check_in_face_url = await createSignedFaceUrl(savedRow?.face_check_in_path)

    res.json({
      success: true,
      message: checkInStatus === 'half_day'
        ? 'Check-in completed as Half Day (post 12:00 PM IST).'
        : checkInStatus === 'late'
          ? 'Check-in completed and marked Late.'
          : 'Check-in completed successfully.',
      attendance: responseRow
    })
  } catch (err) {
    console.error('Attendance check-in failed:', err)
    res.status(500).json({ error: 'Failed to complete attendance check-in' })
  }
})

/**
 * POST /api/delivery/attendance/check-out
 * Check out once per day with biometric and GPS validation
 */
router.post('/attendance/check-out', verifyDeliveryPartner, attendanceRateLimit('attendance-check-out'), async (req, res) => {
  try {
    const deliveryPartnerId = req.dpId
    const now = new Date()
    const attendanceDate = toAttendanceDate(now)
    const indiaHour = getAttendanceHourInIndia(now)

    const {
      latitude,
      longitude,
      locationAddress,
      faceImage,
      livenessProof,
      gpsMeta = {},
      networkInfo = {}
    } = req.body || {}

    const lat = safeNumber(latitude)
    const lon = safeNumber(longitude)
    if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Valid GPS latitude and longitude are required' })
    }

    const livenessValidation = ensureLivenessProof(livenessProof)
    if (!livenessValidation.ok) {
      return res.status(400).json({ error: livenessValidation.error })
    }

    let imagePayload = null
    try {
      imagePayload = parseFaceImagePayload(faceImage)
    } catch (imageErr) {
      return res.status(400).json({ error: imageErr.message || 'Invalid face image payload' })
    }

    const [{ data: partner, error: partnerError }, { data: existing, error: existingError }] = await Promise.all([
      supabase
        .from('delivery_partners')
        .select('*')
        .eq('id', deliveryPartnerId)
        .maybeSingle(),
      supabase
        .from('delivery_partner_attendance')
        .select('*')
        .eq('delivery_partner_id', deliveryPartnerId)
        .eq('attendance_date', attendanceDate)
        .maybeSingle()
    ])

    if (partnerError) throw partnerError
    if (!partner) return res.status(404).json({ error: 'Delivery partner not found' })
    if ((partner.status || '').toLowerCase() !== 'active') {
      return res.status(403).json({ error: 'Inactive partners cannot check out' })
    }
    if (existingError) throw existingError

    if (!existing || !existing.check_in_at) {
      return res.status(409).json({ error: 'Please check in before attempting check-out' })
    }

    if (existing.check_out_at) {
      return res.status(409).json({ error: 'Check-out already recorded for today' })
    }

    const distanceFromCapturePoint = null
    const locationMismatch = Boolean(existing?.location_mismatch)
    const checkOutStatus = deriveCheckOutStatus(indiaHour)
    const suspiciousEarlyCheckout = checkOutStatus === 'early'
    const fakeGps = detectFakeGpsFlag(gpsMeta)
    const vpnProxyDetected = detectVpnOrProxyFlag(req, networkInfo)
    const repeatedSameImageHash = await findRepeatedHashForPartner(deliveryPartnerId, imagePayload.hash, attendanceDate)
    const checkOutAt = now.toISOString()
    const impossibleTravelTime = computeImpossibleTravelFlag({
      checkInAt: existing.check_in_at,
      checkInLat: existing.check_in_latitude,
      checkInLon: existing.check_in_longitude,
      checkOutAt,
      checkOutLat: lat,
      checkOutLon: lon
    })

    const checkOutFacePath = await uploadAttendanceFaceImage({
      deliveryPartnerId,
      attendanceDate,
      eventType: 'check-out',
      buffer: imagePayload.buffer,
      mimeType: imagePayload.mimeType,
      hash: imagePayload.hash
    })

    const finalFlags = buildFlagsPayload({
      existingFlags: existing?.flags,
      fakeGps: fakeGps || existing?.fake_gps,
      vpnProxyDetected: vpnProxyDetected || existing?.vpn_proxy_detected,
      repeatedSameImageHash: repeatedSameImageHash || existing?.repeated_same_image_hash,
      impossibleTravelTime: impossibleTravelTime || existing?.impossible_travel_time,
      locationMismatch,
      suspiciousEarlyCheckout: suspiciousEarlyCheckout || existing?.suspicious_early_checkout,
      livenessChallengeId: livenessValidation.challengeId,
      livenessBlinkCount: livenessValidation.blinkCount,
      gpsAccuracy: gpsMeta?.accuracy
    })

    const updatePayload = {
      check_out_at: checkOutAt,
      check_out_status: checkOutStatus,
      check_out_latitude: lat,
      check_out_longitude: lon,
      check_out_location_text: locationAddress || null,
      check_out_distance_meters: distanceFromCapturePoint,
      location_mismatch: locationMismatch,
      face_check_out_path: checkOutFacePath,
      face_check_out_hash: imagePayload.hash,
      face_liveness_check_out_passed: true,
      suspicious_early_checkout: suspiciousEarlyCheckout || Boolean(existing?.suspicious_early_checkout),
      fake_gps: fakeGps || Boolean(existing?.fake_gps),
      vpn_proxy_detected: vpnProxyDetected || Boolean(existing?.vpn_proxy_detected),
      repeated_same_image_hash: repeatedSameImageHash || Boolean(existing?.repeated_same_image_hash),
      impossible_travel_time: impossibleTravelTime || Boolean(existing?.impossible_travel_time),
      flags: finalFlags,
      last_action_by: 'delivery_partner',
      last_action_at: checkOutAt
    }

    const { data: updated, error: updateError } = await supabase
      .from('delivery_partner_attendance')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('*')
      .single()

    if (updateError) throw updateError

    await recordAttendanceAudit({
      attendanceId: updated?.id,
      deliveryPartnerId,
      actionType: 'check_out',
      actionBy: 'delivery_partner',
      actionById: deliveryPartnerId,
      beforeData: existing || null,
      afterData: updated || null,
      req
    })

    const responseRow = sanitizeAttendanceRow(updated)
    responseRow.check_in_face_url = await createSignedFaceUrl(updated?.face_check_in_path)
    responseRow.check_out_face_url = await createSignedFaceUrl(updated?.face_check_out_path)

    res.json({
      success: true,
      message: suspiciousEarlyCheckout
        ? 'Check-out completed and flagged as suspicious (before 5:00 PM IST).'
        : 'Check-out completed successfully.',
      attendance: responseRow
    })
  } catch (err) {
    console.error('Attendance check-out failed:', err)
    res.status(500).json({ error: 'Failed to complete attendance check-out' })
  }
})

/**
 * GET /api/delivery/admin/attendance/partners
 * Admin endpoint to fetch partner attendance configuration
 */
router.get('/admin/attendance/partners', verifyAdminApiKey, attendanceRateLimit('admin-attendance-partners'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('delivery_partners')
      .select('id, delivery_partner_id, name, assigned_area, status, salary_per_day, attendance_required')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json({ success: true, partners: Array.isArray(data) ? data : [] })
  } catch (err) {
    console.error('Attendance partner config fetch failed:', err)
    res.status(500).json({ error: 'Failed to load partner attendance configuration' })
  }
})

/**
 * PATCH /api/delivery/admin/attendance/partners/:partnerId/config
 * Admin endpoint to update salary/attendance configuration
 */
router.patch('/admin/attendance/partners/:partnerId/config', verifyAdminApiKey, attendanceRateLimit('admin-attendance-partner-config'), async (req, res) => {
  try {
    const { partnerId } = req.params
    const {
      salary_per_day,
      attendance_required
    } = req.body || {}

    const updatePayload = {}

    if (salary_per_day !== undefined) {
      const parsed = Number(salary_per_day)
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).json({ error: 'salary_per_day must be a positive number or 0' })
      }
      updatePayload.salary_per_day = Number(parsed.toFixed(2))
    }

    if (attendance_required !== undefined) {
      updatePayload.attendance_required = Boolean(attendance_required)
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' })
    }

    const { data: updated, error: updateError } = await supabase
      .from('delivery_partners')
      .update(updatePayload)
      .eq('id', partnerId)
      .select('id, delivery_partner_id, name, assigned_area, status, salary_per_day, attendance_required')
      .maybeSingle()

    if (updateError) throw updateError
    if (!updated) return res.status(404).json({ error: 'Delivery partner not found' })

    res.json({ success: true, partner: updated })
  } catch (err) {
    console.error('Attendance partner config update failed:', err)
    res.status(500).json({ error: 'Failed to update partner attendance configuration' })
  }
})

/**
 * GET /api/delivery/admin/attendance/logs
 * Admin endpoint for attendance logs with filters
 */
router.get('/admin/attendance/logs', verifyAdminApiKey, attendanceRateLimit('admin-attendance-logs'), async (req, res) => {
  try {
    const partnerId = (req.query.partner_id || '').toString().trim()
    const month = (req.query.month || '').toString().trim()
    const status = (req.query.status || '').toString().trim().toLowerCase()
    const startDate = (req.query.start_date || '').toString().trim()
    const endDate = (req.query.end_date || '').toString().trim()
    const flagged = (req.query.flagged || '').toString().trim().toLowerCase() === 'true'
    const page = Math.max(1, Number(req.query.page || 1))
    const pageSize = Math.max(1, Math.min(Number(req.query.pageSize || 25), 100))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('delivery_partner_attendance')
      .select('*, delivery_partners(id, delivery_partner_id, name, assigned_area, salary_per_day)', { count: 'exact' })
      .order('attendance_date', { ascending: false })
      .range(from, to)

    if (partnerId) query = query.eq('delivery_partner_id', partnerId)

    if (month) {
      const monthRange = parseMonthRange(month)
      if (!monthRange) {
        return res.status(400).json({ error: 'month must be in YYYY-MM format' })
      }
      query = query.gte('attendance_date', monthRange.startDate).lte('attendance_date', monthRange.endDate)
    }

    if (startDate) {
      if (!isIsoDate(startDate)) {
        return res.status(400).json({ error: 'start_date must be in YYYY-MM-DD format' })
      }
      query = query.gte('attendance_date', startDate)
    }

    if (endDate) {
      if (!isIsoDate(endDate)) {
        return res.status(400).json({ error: 'end_date must be in YYYY-MM-DD format' })
      }
      query = query.lte('attendance_date', endDate)
    }

    if (status) {
      if (status === 'late') {
        query = query.eq('check_in_status', 'late')
      } else if (status === 'half_day') {
        query = query.eq('working_status', 'half_day')
      } else if (status === 'present') {
        query = query.eq('working_status', 'present')
      } else if (status === 'absent') {
        query = query.eq('day_fraction', 0)
      } else if (status === 'early_checkout') {
        query = query.eq('suspicious_early_checkout', true)
      }
    }

    if (flagged) {
      query = query.or('location_mismatch.eq.true,fake_gps.eq.true,vpn_proxy_detected.eq.true,repeated_same_image_hash.eq.true,impossible_travel_time.eq.true,suspicious_early_checkout.eq.true')
    }

    const { data, error, count } = await query
    if (error) throw error

    const rows = await enrichAttendanceRowsWithFaceUrls(Array.isArray(data) ? data : [])

    res.json({
      success: true,
      rows,
      pagination: {
        page,
        pageSize,
        total: Number(count || 0),
        totalPages: Math.max(1, Math.ceil(Number(count || 0) / pageSize))
      }
    })
  } catch (err) {
    console.error('Attendance logs fetch failed:', err)
    res.status(500).json({ error: 'Failed to load attendance logs' })
  }
})

/**
 * GET /api/delivery/admin/attendance/audit-logs
 * Admin endpoint for attendance audit history
 */
router.get('/admin/attendance/audit-logs', verifyAdminApiKey, attendanceRateLimit('admin-attendance-audit-logs'), async (req, res) => {
  try {
    const partnerId = (req.query.partner_id || '').toString().trim()
    const attendanceId = (req.query.attendance_id || '').toString().trim()
    const limit = Math.max(1, Math.min(Number(req.query.limit || 100), 200))

    let query = supabase
      .from('delivery_attendance_audit_logs')
      .select('*, delivery_partners(name, delivery_partner_id)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (partnerId) query = query.eq('delivery_partner_id', partnerId)
    if (attendanceId) query = query.eq('attendance_id', attendanceId)

    const { data, error } = await query
    if (error) throw error

    res.json({ success: true, logs: Array.isArray(data) ? data : [] })
  } catch (err) {
    console.error('Attendance audit logs fetch failed:', err)
    res.status(500).json({ error: 'Failed to load attendance audit logs' })
  }
})

/**
 * GET /api/delivery/admin/attendance/monthly-summary
 * Admin endpoint for monthly attendance salary summary
 */
router.get('/admin/attendance/monthly-summary', verifyAdminApiKey, attendanceRateLimit('admin-attendance-monthly-summary'), async (req, res) => {
  try {
    const requestedMonth = (req.query.month || toAttendanceDate().slice(0, 7)).toString().trim()
    const partnerId = (req.query.partner_id || '').toString().trim()
    const monthRange = parseMonthRange(requestedMonth)

    if (!monthRange) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format' })
    }

    let partnerQuery = supabase
      .from('delivery_partners')
      .select('id, delivery_partner_id, name, assigned_area, salary_per_day, status')
      .order('name', { ascending: true })

    if (partnerId) {
      partnerQuery = partnerQuery.eq('id', partnerId)
    }

    const { data: partners, error: partnersError } = await partnerQuery
    if (partnersError) throw partnersError

    const partnerRows = Array.isArray(partners) ? partners : []
    if (partnerRows.length === 0) {
      return res.json({ success: true, month: monthRange.label, summary: [], totals: { payableDays: 0, totalSalary: 0 } })
    }

    const partnerIds = partnerRows.map((partner) => partner.id)
    const { data: attendanceRows, error: attendanceError } = await supabase
      .from('delivery_partner_attendance')
      .select('*')
      .in('delivery_partner_id', partnerIds)
      .gte('attendance_date', monthRange.startDate)
      .lte('attendance_date', monthRange.endDate)

    if (attendanceError) throw attendanceError

    const todayInIndia = toAttendanceDate()
    const currentMonthInIndia = todayInIndia.slice(0, 7)
    const consideredDays = monthRange.label === currentMonthInIndia
      ? Math.max(1, Number(todayInIndia.slice(8, 10)))
      : monthRange.totalDays

    const records = Array.isArray(attendanceRows) ? attendanceRows : []

    const summary = partnerRows.map((partner) => {
      const rows = records.filter((record) => record.delivery_partner_id === partner.id)
      const fullDays = rows.filter((record) => Number(record.day_fraction) === 1).length
      const halfDays = rows.filter((record) => Number(record.day_fraction) === 0.5).length
      const payableDays = rows.reduce((sum, record) => sum + Number(record.day_fraction || 0), 0)
      const presentDays = rows.filter((record) => Number(record.day_fraction || 0) > 0).length
      const absentDays = Math.max(consideredDays - presentDays, 0)
      const lateDays = rows.filter((record) => (record.check_in_status || '').toString().toLowerCase() === 'late').length
      const suspiciousDays = rows.filter((record) => sanitizeAttendanceRow(record)?.suspicious).length
      const salaryPerDay = Number(partner.salary_per_day || 0)
      const totalSalary = Number((payableDays * salaryPerDay).toFixed(2))

      return {
        partner_id: partner.id,
        partner_code: partner.delivery_partner_id,
        partner_name: partner.name,
        assigned_area: partner.assigned_area,
        status: partner.status,
        salary_per_day: salaryPerDay,
        considered_days: consideredDays,
        full_days: fullDays,
        half_days: halfDays,
        absent_days: absentDays,
        late_days: lateDays,
        suspicious_days: suspiciousDays,
        payable_days: Number(payableDays.toFixed(2)),
        total_salary: totalSalary
      }
    })

    const totals = summary.reduce(
      (acc, row) => {
        acc.payableDays += Number(row.payable_days || 0)
        acc.totalSalary += Number(row.total_salary || 0)
        acc.fullDays += Number(row.full_days || 0)
        acc.halfDays += Number(row.half_days || 0)
        acc.absentDays += Number(row.absent_days || 0)
        return acc
      },
      { payableDays: 0, totalSalary: 0, fullDays: 0, halfDays: 0, absentDays: 0 }
    )

    totals.payableDays = Number(totals.payableDays.toFixed(2))
    totals.totalSalary = Number(totals.totalSalary.toFixed(2))

    res.json({
      success: true,
      month: monthRange.label,
      dateRange: {
        startDate: monthRange.startDate,
        endDate: monthRange.endDate,
        consideredDays
      },
      summary,
      totals
    })
  } catch (err) {
    console.error('Attendance monthly summary failed:', err)
    res.status(500).json({ error: 'Failed to generate monthly attendance summary' })
  }
})

/**
 * GET /api/delivery/admin/attendance/export
 * Admin endpoint to export attendance logs as CSV
 */
router.get('/admin/attendance/export', verifyAdminApiKey, attendanceRateLimit('admin-attendance-export'), async (req, res) => {
  try {
    const requestedMonth = (req.query.month || toAttendanceDate().slice(0, 7)).toString().trim()
    const partnerId = (req.query.partner_id || '').toString().trim()
    const monthRange = parseMonthRange(requestedMonth)

    if (!monthRange) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format' })
    }

    let query = supabase
      .from('delivery_partner_attendance')
      .select('*, delivery_partners(delivery_partner_id, name, assigned_area)')
      .gte('attendance_date', monthRange.startDate)
      .lte('attendance_date', monthRange.endDate)
      .order('attendance_date', { ascending: true })

    if (partnerId) query = query.eq('delivery_partner_id', partnerId)

    const { data, error } = await query
    if (error) throw error

    const rows = Array.isArray(data) ? data : []
    const csvHeader = [
      'Attendance Date',
      'Partner Code',
      'Partner Name',
      'Assigned Area',
      'Check In At',
      'Check Out At',
      'Check In Status',
      'Check Out Status',
      'Working Status',
      'Day Fraction',
      'Location Mismatch',
      'Fake GPS',
      'VPN/Proxy',
      'Repeated Face Hash',
      'Impossible Travel',
      'Suspicious Early Checkout',
      'Check In Latitude',
      'Check In Longitude',
      'Check Out Latitude',
      'Check Out Longitude'
    ]

    const csvRows = rows.map((row) => {
      const partner = row.delivery_partners || {}
      return [
        toCsvCell(row.attendance_date),
        toCsvCell(partner.delivery_partner_id),
        toCsvCell(partner.name),
        toCsvCell(partner.assigned_area),
        toCsvCell(row.check_in_at),
        toCsvCell(row.check_out_at),
        toCsvCell(row.check_in_status),
        toCsvCell(row.check_out_status),
        toCsvCell(row.working_status),
        toCsvCell(row.day_fraction),
        toCsvCell(row.location_mismatch),
        toCsvCell(row.fake_gps),
        toCsvCell(row.vpn_proxy_detected),
        toCsvCell(row.repeated_same_image_hash),
        toCsvCell(row.impossible_travel_time),
        toCsvCell(row.suspicious_early_checkout),
        toCsvCell(row.check_in_latitude),
        toCsvCell(row.check_in_longitude),
        toCsvCell(row.check_out_latitude),
        toCsvCell(row.check_out_longitude)
      ].join(',')
    })

    const csv = [csvHeader.map(toCsvCell).join(','), ...csvRows].join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${monthRange.label}.csv"`)
    res.send(csv)
  } catch (err) {
    console.error('Attendance export failed:', err)
    res.status(500).json({ error: 'Failed to export attendance logs' })
  }
})

/**
 * PATCH /api/delivery/admin/attendance/:attendanceId/manual-correction
 * Admin endpoint for manual attendance corrections with reason + audit
 */
router.patch('/admin/attendance/:attendanceId/manual-correction', verifyAdminApiKey, attendanceRateLimit('admin-attendance-manual-correction'), async (req, res) => {
  try {
    const { attendanceId } = req.params
    const {
      reason,
      check_in_status,
      check_out_status,
      working_status,
      day_fraction,
      check_in_at,
      check_out_at,
      notes,
      location_mismatch,
      suspicious_early_checkout
    } = req.body || {}

    const correctionReason = (reason || '').toString().trim()
    if (!correctionReason) {
      return res.status(400).json({ error: 'Correction reason is required' })
    }

    const { data: existing, error: existingError } = await supabase
      .from('delivery_partner_attendance')
      .select('*')
      .eq('id', attendanceId)
      .maybeSingle()

    if (existingError) throw existingError
    if (!existing) {
      return res.status(404).json({ error: 'Attendance record not found' })
    }

    const updatePayload = {
      manual_override: true,
      last_action_by: 'admin',
      last_action_at: new Date().toISOString()
    }

    if (check_in_status !== undefined) {
      const normalized = check_in_status.toString().trim().toLowerCase()
      if (!['on_time', 'late', 'half_day', 'manual'].includes(normalized)) {
        return res.status(400).json({ error: 'Invalid check_in_status value' })
      }
      updatePayload.check_in_status = normalized
    }

    if (check_out_status !== undefined) {
      const normalized = check_out_status.toString().trim().toLowerCase()
      if (!['on_time', 'early', 'manual'].includes(normalized)) {
        return res.status(400).json({ error: 'Invalid check_out_status value' })
      }
      updatePayload.check_out_status = normalized
    }

    if (working_status !== undefined) {
      const normalized = working_status.toString().trim().toLowerCase()
      if (!['present', 'half_day', 'absent', 'manual'].includes(normalized)) {
        return res.status(400).json({ error: 'Invalid working_status value' })
      }
      updatePayload.working_status = normalized
    }

    if (day_fraction !== undefined) {
      const parsed = Number(day_fraction)
      if (![0, 0.5, 1].includes(parsed)) {
        return res.status(400).json({ error: 'day_fraction must be one of: 0, 0.5, 1' })
      }
      updatePayload.day_fraction = parsed
    }

    if (check_in_at !== undefined) {
      const parsed = check_in_at ? new Date(check_in_at) : null
      if (check_in_at && (!parsed || Number.isNaN(parsed.getTime()))) {
        return res.status(400).json({ error: 'Invalid check_in_at datetime format' })
      }
      updatePayload.check_in_at = parsed ? parsed.toISOString() : null
    }

    if (check_out_at !== undefined) {
      const parsed = check_out_at ? new Date(check_out_at) : null
      if (check_out_at && (!parsed || Number.isNaN(parsed.getTime()))) {
        return res.status(400).json({ error: 'Invalid check_out_at datetime format' })
      }
      updatePayload.check_out_at = parsed ? parsed.toISOString() : null
    }

    if (notes !== undefined) {
      updatePayload.notes = notes ? String(notes).trim() : null
    }

    if (location_mismatch !== undefined) {
      updatePayload.location_mismatch = Boolean(location_mismatch)
    }

    if (suspicious_early_checkout !== undefined) {
      updatePayload.suspicious_early_checkout = Boolean(suspicious_early_checkout)
    }

    const mergedFlags = {
      ...(existing.flags && typeof existing.flags === 'object' ? existing.flags : {}),
      manual_override_reason: correctionReason,
      manual_override_at: updatePayload.last_action_at,
      manual_override_by: 'admin'
    }
    mergedFlags.suspicious = hasAnyFraudFlag({ ...existing, ...updatePayload, ...mergedFlags })
    updatePayload.flags = mergedFlags

    const { data: updated, error: updateError } = await supabase
      .from('delivery_partner_attendance')
      .update(updatePayload)
      .eq('id', attendanceId)
      .select('*')
      .single()

    if (updateError) throw updateError

    await recordAttendanceAudit({
      attendanceId,
      deliveryPartnerId: existing.delivery_partner_id,
      actionType: 'manual_correction',
      actionBy: 'admin',
      actionById: 'admin_api_key',
      actionReason: correctionReason,
      beforeData: existing || null,
      afterData: updated || null,
      req
    })

    const responseRow = sanitizeAttendanceRow(updated)
    responseRow.check_in_face_url = await createSignedFaceUrl(updated?.face_check_in_path)
    responseRow.check_out_face_url = await createSignedFaceUrl(updated?.face_check_out_path)

    res.json({ success: true, attendance: responseRow })
  } catch (err) {
    console.error('Attendance manual correction failed:', err)
    res.status(500).json({ error: 'Failed to apply attendance correction' })
  }
})

/**
 * GET /api/delivery/track/:reference
 * Public order tracking by order reference (full ID or prefix)
 */
router.get('/track/:reference', async (req, res) => {
  try {
    const reference = (req.params.reference || '').trim()

    if (!reference) {
      return res.status(400).json({ error: 'Order reference is required' })
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, status, delivery_status, created_at, updated_at, delivered_at, total_amount, payment_method, cod_amount_received')
      .or(`id.eq.${reference},id.ilike.${reference}%`)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) throw error

    if (!orders || orders.length === 0) {
      return res.status(404).json({ error: 'No order found' })
    }

    const order = orders[0]
    const normalizedStatus = normalizeStatus(order.delivery_status)
    const statusLabel = STATUS_LABELS[normalizedStatus] || order.status || 'Pending'

    const { data: logs } = await supabase
      .from('delivery_logs')
      .select('event_type, event_details, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true })

    const timeline = UPDATABLE_STATUSES.map((key) => {
      const log = (logs || []).find((entry) => mapLogToStatus(entry.event_type) === key)
      const currentRank = getStatusRank(normalizedStatus)
      const stageRank = getStatusRank(key)
      const completed = currentRank >= stageRank && stageRank !== -1
      const reachedAt = log?.created_at || (completed ? order.updated_at : null)

      return {
        key,
        label: STATUS_LABELS[key],
        description: STATUS_DETAILS[key]?.description || null,
        icon: STATUS_DETAILS[key]?.icon || null,
        completed,
        reached_at: reachedAt
      }
    })

    res.json({
      success: true,
      order: {
        id: order.id,
        status: statusLabel,
        delivery_status: normalizedStatus,
        created_at: order.created_at,
        updated_at: order.updated_at,
        delivered_at: order.delivered_at,
        total_amount: order.total_amount,
        payment_method: order.payment_method,
        cod_amount_received: order.cod_amount_received
      },
      timeline
    })
  } catch (err) {
    console.error('Track order error:', err)
    res.status(500).json({ error: 'Failed to fetch tracking details' })
  }
})

/**
 * POST /api/admin/delivery-partners
 * Create delivery partner account (ADMIN ONLY)
 */
router.post('/admin/create', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-api-key']
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { name, email, mobileNumber, assignedArea } = req.body

    if (!name || !email || !mobileNumber || !assignedArea) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const normalizedMobileNumber = String(mobileNumber || '').replace(/\D/g, '').slice(0, 10)
    if (!/^\d{10}$/.test(normalizedMobileNumber)) {
      return res.status(400).json({ error: 'Mobile number must be exactly 10 digits' })
    }

    // Generate delivery partner ID
    const dpId = `DP-${Date.now()}-${Math.floor(Math.random() * 10000)}`

    // Default password (should be changed on first login)
    const tempPassword = Math.random().toString(36).slice(-8)
    // Hash the password before storing
    const passwordHash = await bcrypt.hash(tempPassword, 10)

    // Create delivery partner
    const { data, error } = await supabase
      .from('delivery_partners')
      .insert({
        delivery_partner_id: dpId,
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        password_hash: passwordHash,
        mobile_number: normalizedMobileNumber,
        assigned_area: String(assignedArea).trim(),
        status: 'active'
      })
      .select()
      .single()

    if (error) throw error

    res.status(201).json({
      success: true,
      deliveryPartner: data,
      tempPassword: tempPassword, // Send to admin to share with partner
      message: 'Delivery partner created successfully. Share credentials with the partner.'
    })
  } catch (err) {
    console.error('Creation error:', err)
    res.status(500).json({ error: 'Failed to create delivery partner' })
  }
})

// ============ ADMIN ENDPOINTS ============

// Get all delivery partners (admin only)
router.get('/admin/delivery-partners', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-api-key']
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { data, error } = await supabase
      .from('delivery_partners')
      .select('id, delivery_partner_id, name, email, mobile_number, assigned_area, status, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('List partners error:', err)
    res.status(500).json({ error: 'Failed to fetch delivery partners' })
  }
})

// Update delivery partner status (admin only)
router.patch('/admin/delivery-partners/:id', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-api-key']
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params
    const { status } = req.body

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const { data, error } = await supabase
      .from('delivery_partners')
      .update({ status })
      .eq('id', id)
      .select()

    if (error) throw error
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Delivery partner not found' })
    }

    res.json({
      message: 'Partner status updated',
      deliveryPartner: data[0]
    })
  } catch (err) {
    console.error('Update status error:', err)
    res.status(500).json({ error: 'Failed to update delivery partner' })
  }
})

// Assign an order to a delivery partner (admin only)
router.patch('/admin/orders/:orderId/assign', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-api-key']
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { orderId } = req.params
    const { delivery_partner_id } = req.body

    if (!delivery_partner_id) {
      return res.status(400).json({ error: 'delivery_partner_id is required' })
    }

    // Verify order exists
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Only allow assignment when order is Approved
    if (order.status !== 'Approved') {
      return res.status(400).json({ error: 'Order must be Approved before assigning a delivery partner' })
    }

    // Verify delivery partner exists and is active
    const { data: dp, error: dpErr } = await supabase
      .from('delivery_partners')
      .select('id, delivery_partner_id, status')
      .eq('id', delivery_partner_id)
      .single()

    if (dpErr || !dp) {
      return res.status(404).json({ error: 'Delivery partner not found' })
    }

    if (dp.status !== 'active') {
      return res.status(400).json({ error: 'Delivery partner is not active' })
    }

    // Assign the partner
    const { data: updated, error: updateErr } = await supabase
      .from('orders')
      .update({ delivery_partner_id: dp.id, delivery_status: 'assigned' })
      .eq('id', orderId)
      .select()

    if (updateErr) throw updateErr

    // Log the assignment
    await supabase
      .from('delivery_logs')
      .insert({ order_id: orderId, delivery_partner_id: dp.id, event_type: 'assigned', event_details: { assigned_to: dp.delivery_partner_id, timestamp: new Date().toISOString() } })

    res.json({ message: 'Order assigned to delivery partner', order: updated?.[0] || null })
  } catch (err) {
    console.error('Assign order error:', err)
    res.status(500).json({ error: 'Failed to assign delivery partner' })
  }
})

export default router
