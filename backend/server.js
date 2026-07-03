import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { randomUUID, randomBytes, createHash } from 'crypto';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import { setSupabaseClient } from './routes/delivery.js';
import deliveryRoutes from './routes/delivery.js';
import { setWarehouseSupabaseClient } from './routes/warehouse.js';
import warehouseRoutes from './routes/warehouse.js';
import dashboardBlockingRoutes from './routes/dashboard-blocking.js';
import createProductSlabRouter from './routes/product-slabs.js';
import { calculateSlabDiscountAmount, formatSlabRuleText, resolveApplicableSlab } from './lib/slab-utils.js';
// ...existing code...

// Register OTP email route (after app is initialized)
// Place this after 'const app = express();'


import express from 'express';
import cron from 'node-cron';
import bcrypt from 'bcryptjs';
const app = express();

// =============================
// GLOBAL BULLETPROOF CORS
// =============================
const corsOptions = { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-admin-api-key', 'x-manager-token', 'x-warehouse-id', 'x-warehouse-auth', 'x-delivery-partner-id', 'x-admin-report-password'] };
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

import multer from 'multer';

const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const baseDir = isVercel ? '/tmp' : process.cwd();
const productUpload = multer({ dest: path.join(baseDir, 'uploads/') });

const PROFILE_PHOTOS_BUCKET = 'user-profile-photos';
const VERIFICATION_DOCS_BUCKET = 'user-verification-documents';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const REQUIRED_DOCUMENT_TYPES = ['aadhaar', 'pan', 'gst_certificate'];
const DOCUMENT_TYPE_LABELS = {
  aadhaar: 'Aadhaar Card',
  pan: 'PAN Card',
  gst_certificate: 'GST Certificate'
};

const MANAGER_REQUIRED_DOCUMENT_TYPES = ['aadhaar', 'pan', 'bank_account_details', 'police_verification_certificate', 'passport'];
const MANAGER_OPTIONAL_DOCUMENT_TYPES = new Set(['police_verification_certificate', 'passport']);
const MANAGER_DOCUMENT_TYPE_LABELS = {
  aadhaar: 'Aadhaar Card',
  pan: 'PAN Card',
  bank_account_details: 'Bank Account Details',
  police_verification_certificate: 'Police Verification Certificate',
  passport: 'Passport'
};
const MANAGER_PERMISSION_SECTIONS = [
  'orders',
  'products',
  'offers',
  'users',
  'coupons',
  'slabs',
  'transactions-revenue',
  'transactions-settlement',
  'transactions-warehouse-settlement',
  // Keep legacy key for older manager records.
  'transactions',
  'notifications',
  'delivery'
];

const MIME_EXTENSION_MAP = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png'
};

const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_DOCUMENT_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);

const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_PHOTO_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Only JPG and PNG files are allowed for profile photos.'));
    }
    return cb(null, true);
  }
});

const verificationDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Only PDF, JPG, and PNG files are allowed for documents.'));
    }
    return cb(null, true);
  }
});

// Notify Me: User requests notification when product is back in stock
app.post('/api/notify-me', async (req, res) => {
  try {
    const { product_id, user_id } = req.body || {}
    if (!product_id || !user_id) {
      return res.status(400).json({ error: 'product_id and user_id required' })
    }
    // Get user email
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', user_id)
      .maybeSingle()
    if (userErr || !user?.email) {
      return res.status(404).json({ error: 'User not found' })
    }
    // Store notification request in DB
    const { data, error } = await supabase
      .from('notify_requests')
      .insert([{ product_id, user_id, email: user.email, notified: false, created_at: new Date().toISOString() }])
      .select()
    if (error) throw error
    res.status(201).json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Cron job: Check for restocked products and notify users
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('*/10 * * * *', async () => {
    try {
      // Find all pending notify requests
      const { data: requests, error: reqErr } = await supabase
        .from('notify_requests')
        .select('*')
        .eq('notified', false)
      if (reqErr || !Array.isArray(requests) || requests.length === 0) return
      // Get all product_ids
      const productIds = [...new Set(requests.map(r => r.product_id))]
      if (productIds.length === 0) return
      // Fetch product stock
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, name, stock')
        .in('id', productIds)
      if (prodErr) return
      const stockMap = new Map((products || []).map(p => [p.id, p]))
      for (const req of requests) {
        const prod = stockMap.get(req.product_id)
        if (prod && Number(prod.stock) > 0) {
          // Create in-app notification for user
          try {
            await supabase
              .from('notifications')
              .insert([{ user_id: req.user_id, message: `${prod.name} is back in stock! Order now from your dashboard.` }])
          } catch (notifErr) {
            console.warn('Failed to insert notify-me notification:', notifErr?.message || notifErr)
          }
          // Send email notification to user
          try {
            const transporter = ensureTransporter()
            if (transporter && req.email) {
              await transporter.sendMail({
                from: `"ASHIRWAD ENTERPRISES" <${process.env.Email_User}>`,
                to: req.email,
                subject: `Product Back in Stock: ${prod.name}`,
                html: `<div style=\"font-family:Arial,sans-serif;color:#0f172a;padding:12px;\"><h2 style=\"color:#0b5fff;\">${prod.name} is back in stock!</h2><p>Dear customer,<br><br>The product <strong>${prod.name}</strong> you requested is now available. <a href=\"${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/products\">Order now</a> before it sells out again!<br><br>Thank you for shopping with us.<br>Team Ashirwad Enterprises</p></div>`
              })
            }
          } catch (mailErr) {
            console.warn('Failed to send notify-me email:', mailErr?.message || mailErr)
          }
          // Mark as notified
          await supabase
            .from('notify_requests')
            .update({ notified: true, notified_at: new Date().toISOString() })
            .eq('id', req.id)
        }
      }
    } catch (err) {
      console.warn('Notify-me cron error:', err?.message || err)
    }
  })
}

// Define PORT for server
const PORT = process.env.PORT || 5001;
// ...existing code...


// --- DEBUG: Insert Dummy Manager ---
app.post('/api/admin/debug-insert-manager', requireAdminKey, async (req, res) => {
  try {
    const email = `debug_${Date.now()}@test.com`;
    const full_name = 'Debug Manager';
    const phone = '9999999999';
    const password_hash = await bcrypt.hash('debugpassword', 10);
    const is_verified = true;
    const role = 'manager';
    const { data, error } = await supabase
      .from('managers')
      .insert([{ email, full_name, phone, password_hash, is_verified, role }])
      .select('*')
      .single();
    if (error) throw error;
    console.log('[DEBUG MANAGER INSERTED]', data);
    res.json({ success: true, manager: data });
  } catch (err) {
    console.error('[DEBUG MANAGER INSERT ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoint: fully delete a user from both users and Supabase Auth
app.delete('/api/admin/users/:userId/full-delete', requireAdminKey, async (req, res) => {
  try {
    const userId = req.params.userId
    if (!userId) return res.status(400).json({ error: 'userId required' })

    // Capture storage paths before deleting DB rows.
    const { data: userProfile } = await supabase
      .from('users')
      .select('profile_photo_path')
      .eq('id', userId)
      .maybeSingle()

    let documentStoragePaths = []
    try {
      const { data: documentRows, error: documentError } = await supabase
        .from('user_verification_documents')
        .select('storage_path,file_path')
        .eq('user_id', userId)

      if (!documentError) {
        documentStoragePaths = [...new Set(
          (documentRows || [])
            .flatMap((row) => [row?.storage_path, row?.file_path])
            .filter(Boolean)
        )]
      }
    } catch (documentFetchErr) {
      console.warn('Failed to fetch user document paths during full delete:', documentFetchErr?.message || documentFetchErr)
    }

    if (userProfile?.profile_photo_path) {
      try {
        await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([userProfile.profile_photo_path])
      } catch (photoCleanupErr) {
        console.warn('Failed to remove profile photo during full delete:', photoCleanupErr?.message || photoCleanupErr)
      }
    }

    if (documentStoragePaths.length > 0) {
      try {
        await supabase.storage.from(VERIFICATION_DOCS_BUCKET).remove(documentStoragePaths)
      } catch (docCleanupErr) {
        console.warn('Failed to remove verification documents during full delete:', docCleanupErr?.message || docCleanupErr)
      }
    }

    // Delete from users table first
    const { error: userDelErr } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)
    if (userDelErr) {
      return res.status(500).json({ error: 'Failed to delete user profile: ' + userDelErr.message })
    }

    // Delete from Supabase Auth. Some legacy rows may already be missing in auth;
    // treat that specific case as a successful cleanup.
    const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authDelErr && !isAuthUserNotFoundError(authDelErr)) {
      return res.status(500).json({ error: 'Failed to delete auth user: ' + authDelErr.message })
    }

    const authAlreadyMissing = Boolean(authDelErr)
    res.json({
      success: true,
      message: authAlreadyMissing
        ? 'User profile deleted. Auth user was already missing.'
        : 'User fully deleted from profile and auth.'
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
// ...existing code...
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!process.env.ADMIN_API_KEY) {
  console.error('Missing ADMIN_API_KEY for admin route protection')
  process.exit(1)
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// =============================
// Middleware
// =============================
app.use(express.json({ limit: '50mb' })) // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));
app.use(express.static(path.join(path.dirname(new URL(import.meta.url).pathname), '../frontend/dist')));
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Manager authentication and permission middleware
function isManagerInactiveRouteAllowed(requestPath) {
  const normalizedPath = String(requestPath || '').toLowerCase()
  const allowedPrefixes = [
    '/api/manager/profile',
    '/api/manager/profile-photo',
    '/api/manager/verification-documents',
    '/api/manager/personal-email',
    '/api/manager/password-reset/request-auth'
  ]
  return allowedPrefixes.some((prefix) => normalizedPath.startsWith(prefix))
}

async function requireManagerAuth(req, res, next) {
  // Manager token is manager id (for demo, use JWT in production)
  const token = req.headers['x-manager-token']
  if (!token) return res.status(401).json({ error: 'Manager token required' })
  // Fetch manager
  const { data: manager, error: managerErr } = await supabase
    .from('managers')
    .select('id, email, full_name, phone, is_verified')
    .eq('id', token)
    .maybeSingle()
  if (managerErr) return res.status(500).json({ error: managerErr.message })
  if (!manager) return res.status(404).json({ error: 'Manager not found' })

  const isActive = Boolean(manager.is_verified)
  if (!isActive && !isManagerInactiveRouteAllowed(req.path)) {
    return res.status(403).json({
      error: 'Account is inactive. Only dashboard and profile access are allowed.'
    })
  }

  // Fetch permissions
  const { data: perms, error: permsErr } = await supabase
    .from('manager_permissions')
    .select('section, can_access')
    .eq('manager_id', manager.id)
  if (permsErr) return res.status(500).json({ error: permsErr.message })
  req.manager = {
    ...manager,
    is_active: isActive,
    account_status: isActive ? 'active' : 'inactive'
  }
  req.managerPermissions = perms.filter(p => p.can_access).map(p => p.section)
  next()
}

// Create admin client for email confirmation
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)


// Email sending is handled by ./lib/emailer.js which loads templates and configures transporter
import {
  sendOtpEmail,
  sendWelcomeEmail,
  sendApprovalEmail,
  sendOrderConfirmationEmail,
  sendOrderRejectionEmail,
  sendPartnerUpdateEmail,
  isMailerConfigured,
  ensureTransporter
} from './lib/emailer.js'


app.use(express.json({ limit: '50mb' })) // Increased limit for base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// --- Global error handler to ensure all errors return JSON ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  if (res.headersSent) return next(err)
  res.status(500).json({ error: err.message || 'Internal Server Error' })
})

// Razorpay instance (optional; only used if keys are configured)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const isMockRazorpay = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_ID.startsWith('rzp_test_mock')) || Boolean(RAZORPAY_KEY_SECRET && RAZORPAY_KEY_SECRET.startsWith('mockSecret'))

let razorpay = null
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && !isMockRazorpay) {
  try {
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET
    })
  } catch (e) {
    console.warn('Failed to initialize Razorpay:', e?.message)
  }
} else if (isMockRazorpay) {
  console.log('Razorpay running in mock mode. No live requests will be sent.')
}

export function requireAdminKey(req, res, next) {
  const providedKey = String(
    req.headers['x-admin-key']
    || req.headers['x-admin-api-key']
    || ''
  ).trim()
  if (!providedKey || providedKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

function getAdminReportPassword() {
  return String(
    process.env.ADMIN_REPORT_PASSWORD
    || process.env.ADMIN_PASSWORD
    || process.env.TRANSACTIONS_REPORT_PASSWORD
    || 'ASHI2005'
  ).trim()
}

function requireAdminReportPassword(req, res, next) {
  const providedPassword = String(
    req.headers['x-admin-report-password']
    || req.body?.adminPassword
    || req.query?.adminPassword
    || ''
  ).trim()

  if (!providedPassword || providedPassword !== getAdminReportPassword()) {
    return res.status(403).json({ error: 'Invalid admin password for report download' })
  }

  next()
}

async function requireUserAuth(req, res, next) {
  const authorization = String(req.headers.authorization || '')
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''

  if (!token) {
    return res.status(401).json({ error: 'Authorization token is required' })
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid authorization token' })
    }
    req.user = data.user
    return next()
  } catch (err) {
    return res.status(401).json({ error: 'Unable to validate authentication token' })
  }
}

function normalizeDocumentType(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_')
  if (normalized === 'aadhaar_card') return 'aadhaar'
  if (normalized === 'pan_card') return 'pan'
  if (normalized === 'gst' || normalized === 'gstcertificate' || normalized === 'gst_cert') return 'gst_certificate'
  return normalized
}

function getProfilePhotoSourceCandidates(sourceValue) {
  const normalized = String(sourceValue || '').trim().toLowerCase()
  const isLiveSource = ['live', 'camera', 'capture', 'live_photo'].includes(normalized)

  const preferred = isLiveSource
    ? ['live', 'camera', 'live_photo', 'capture']
    : ['upload', 'uploaded', 'file_upload', 'gallery', 'device_upload']

  // The final undefined candidate means: update photo URL/path but keep existing source untouched.
  return [...new Set([...preferred, undefined])]
}

function getDocumentTypeLabel(documentType) {
  return DOCUMENT_TYPE_LABELS[documentType] || documentType
}

function sanitizeFileName(fileName) {
  return String(fileName || 'document').replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getRenamedDocumentFileName(documentType, originalFileName, mimeType) {
  const baseName = String(documentType || 'document')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_') || 'document'

  const extFromOriginal = String(path.extname(String(originalFileName || '')) || '').replace(/^\./, '')
  const safeExt = extFromOriginal.replace(/[^a-zA-Z0-9]/g, '')
  const fallbackExt = MIME_EXTENSION_MAP[mimeType] || 'bin'
  const extension = safeExt || fallbackExt

  return `${baseName}.${extension}`
}

function getUploadErrorMessage(err) {
  if (!err) return 'File upload failed'
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return 'Maximum file size is 5MB.'
    }
    return err.message
  }
  return err.message || 'File upload failed'
}

function isAuthUserNotFoundError(err) {
  const status = Number(err?.status || err?.statusCode || 0)
  if (status === 404) return true

  const code = String(err?.code || '').toLowerCase()
  const message = String(err?.message || '').toLowerCase()

  return code.includes('user_not_found') || message.includes('user not found')
}

// Verify Razorpay payment signature and create order server-side
app.post('/api/payments/verify-and-create-order', async (req, res) => {
  try {
    const { paymentResponse, orderPayload } = req.body || {}
    if (!paymentResponse || !orderPayload) return res.status(400).json({ error: 'paymentResponse and orderPayload are required' })

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = paymentResponse || {}
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Incomplete payment response from Razorpay' })
    }

    if (!RAZORPAY_KEY_SECRET) return res.status(500).json({ error: 'Payment gateway not configured on server' })

    // Verify signature
    const expected = createHash('sha256').update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex')
    // Razorpay signature is HMAC_SHA256 using key_secret — compute HMAC
    const hmac = createHash('sha256')
    // Use crypto.createHmac for HMAC
    const { createHmac } = await import('crypto')
    const computed = createHmac('sha256', RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex')
    if (computed !== String(razorpay_signature)) {
      return res.status(400).json({ error: 'Invalid payment signature' })
    }

    // Attach payment info to order payload
    const payloadWithPayment = {
      ...orderPayload,
      payment_info: {
        provider: 'razorpay',
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature
      },
      payment_method: 'prepaid'
    }

    // Forward to existing orders endpoint to reuse validation and insertion logic
    const fetchRes = await fetch(`${process.env.SELF_BASE_URL || `http://localhost:${PORT}`}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadWithPayment)
    })

    const body = await fetchRes.json().catch(() => null)
    if (!fetchRes.ok) {
      return res.status(fetchRes.status).json({ error: body?.error || 'Failed to create order after payment verification' })
    }

    return res.status(201).json(body)
  } catch (err) {
    console.error('Payment verify error:', err)
    return res.status(500).json({ error: err.message })
  }
})

function isMissingSchemaCacheColumnError(err, columnName, tableName) {
  const message = `${err?.message || ''} ${err?.details || ''}`.toLowerCase()
  const columnLower = String(columnName || '').toLowerCase()
  const tableLower = String(tableName || '').toLowerCase()
  return message.includes(`could not find the '${columnLower}' column`) && message.includes(tableLower)
}

function isMissingTableError(err, tableName) {
  const message = `${err?.message || ''} ${err?.details || ''}`.toLowerCase()
  const tableLower = String(tableName || '').toLowerCase()
  return (
    message.includes(`could not find the table 'public.${tableLower}'`)
    || message.includes(`relation \"${tableLower}\" does not exist`)
  )
}

function getManagerProfileSetupErrorMessage(err) {
  const missingManagerProfileSchema = ['manager_profiles', 'manager_verification_documents', 'manager_password_reset_tokens']
    .some((tableName) => isMissingTableError(err, tableName))

  if (missingManagerProfileSchema) {
    return 'Manager profile schema is missing. Run database/ADD_MANAGER_PROFILE_AND_VERIFICATION.sql and retry.'
  }

  return err?.message || 'Manager profile operation failed.'
}

function runMulterMiddleware(req, res, middleware) {
  return new Promise((resolve, reject) => {
    middleware(req, res, (err) => {
      if (err) return reject(err)
      return resolve()
    })
  })
}

async function createSignedStorageUrl(bucketName, storagePath, expiresInSeconds = 1800) {
  if (!storagePath) return null
  const { data, error } = await supabase
    .storage
    .from(bucketName)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error) {
    console.warn(`Failed to sign URL for ${bucketName}/${storagePath}:`, error?.message || error)
    return null
  }
  return data?.signedUrl || null
}

function normalizeManagerDocumentType(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_')
  if (normalized === 'aadhaar_card') return 'aadhaar'
  if (normalized === 'pan_card') return 'pan'
  if (normalized === 'bank' || normalized === 'bank_details' || normalized === 'bank_account') return 'bank_account_details'
  if (normalized === 'police_certificate' || normalized === 'police_verification') return 'police_verification_certificate'
  return normalized
}

function getManagerDocumentTypeLabel(documentType) {
  return MANAGER_DOCUMENT_TYPE_LABELS[documentType] || documentType
}

function generateSecureToken() {
  return randomBytes(32).toString('hex')
}

function hashSecureToken(value) {
  return createHash('sha256').update(String(value || '')).digest('hex')
}

function resolveUploadsAbsolutePath(filePathLike) {
  const raw = String(filePathLike || '').trim()
  if (!raw) return null

  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '')

  if (path.isAbsolute(raw)) {
    return raw
  }

  if (normalized.startsWith('uploads/')) {
    return path.join(baseDir, normalized)
  }

  if (normalized.startsWith('manager-')) {
    return path.join(baseDir, 'uploads', normalized)
  }

  return path.join(baseDir, 'uploads', normalized)
}

function toUploadsPublicUrl(absolutePath) {
  const uploadsRoot = path.join(baseDir, 'uploads')
  const rel = path.relative(uploadsRoot, absolutePath).split(path.sep).join('/')
  return `/uploads/${rel}`
}

function writeBufferToUploads(relativeDir, filename, fileBuffer) {
  const uploadsRoot = path.join(baseDir, 'uploads')
  const targetDir = path.join(uploadsRoot, relativeDir)
  fs.mkdirSync(targetDir, { recursive: true })

  const safeName = sanitizeFileName(filename)
  const absolutePath = path.join(targetDir, safeName)
  fs.writeFileSync(absolutePath, fileBuffer)

  return {
    absolutePath,
    publicUrl: toUploadsPublicUrl(absolutePath),
    filePath: `uploads/${path.relative(uploadsRoot, absolutePath).split(path.sep).join('/')}`
  }
}

function removeUploadFileQuiet(filePathLike) {
  try {
    const resolved = resolveUploadsAbsolutePath(filePathLike)
    if (resolved && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved)
    }
  } catch (err) {
    console.warn('Failed to remove file:', err?.message || err)
  }
}

async function getManagerById(managerId) {
  const id = String(managerId || '').trim()
  if (!id) throw new Error('manager id is required')

  const { data, error } = await supabase
    .from('managers')
    .select('id, email, full_name, phone, is_verified, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Manager not found')
  return data
}

async function ensureManagerProfileRow(managerRef) {
  const manager = typeof managerRef === 'string' ? await getManagerById(managerRef) : managerRef
  const managerId = String(manager?.id || '').trim()
  if (!managerId) throw new Error('Manager profile cannot be initialized without manager id')

  const { data: existingProfile, error: profileError } = await supabase
    .from('manager_profiles')
    .select('*')
    .eq('manager_id', managerId)
    .maybeSingle()

  if (profileError) {
    throw new Error(profileError.message)
  }

  if (existingProfile) return existingProfile

  const { data: created, error: createError } = await supabase
    .from('manager_profiles')
    .insert([{
      manager_id: managerId,
      full_name: String(manager?.full_name || '').trim() || null,
      registered_email: String(manager?.email || '').trim().toLowerCase() || null,
      mobile_number: String(manager?.phone || '').trim() || null,
      personal_email_verified: false,
      profile_verification_status: 'Pending Verification'
    }])
    .select('*')
    .single()

  if (createError) {
    throw new Error(createError.message)
  }

  return created
}

async function getManagerVerificationRows(managerId) {
  const { data, error } = await supabase
    .from('manager_verification_documents')
    .select('*')
    .eq('manager_id', managerId)

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) ? data : []
}

function computeManagerVerificationStatusFromRows(rows) {
  const statusByType = new Map((rows || []).map((row) => [row.document_type, row.status]))
  // Only aadhaar, pan, bank_account_details are mandatory for Verified Manager
  const mandatoryTypes = MANAGER_REQUIRED_DOCUMENT_TYPES.filter((t) => !MANAGER_OPTIONAL_DOCUMENT_TYPES.has(t))
  const allMandatoryApproved = mandatoryTypes.every((type) => statusByType.get(type) === 'Approved')

  if (allMandatoryApproved) return 'Verified Manager'

  // For non-verified states, check mandatory docs only
  const mandatoryStatuses = mandatoryTypes.map((type) => statusByType.get(type) || null)
  const uploadedCount = mandatoryStatuses.filter(Boolean).length
  const hasRejected = mandatoryStatuses.includes('Rejected')

  if (uploadedCount === 0 || hasRejected) return 'Pending Verification'
  return 'Under Review'
}

async function mapManagerVerificationRowsWithUrls(rows) {
  const sortedRows = [...(rows || [])].sort((a, b) => {
    const aIndex = MANAGER_REQUIRED_DOCUMENT_TYPES.indexOf(a.document_type)
    const bIndex = MANAGER_REQUIRED_DOCUMENT_TYPES.indexOf(b.document_type)
    const safeA = aIndex >= 0 ? aIndex : Number.MAX_SAFE_INTEGER
    const safeB = bIndex >= 0 ? bIndex : Number.MAX_SAFE_INTEGER
    return safeA - safeB
  })

  return sortedRows.map((row) => {
    const normalizedFileSize = Number(row.file_size_bytes ?? row.file_size ?? 0) || null
    const downloadUrl = row.file_url || (row.file_path ? `/${String(row.file_path).replace(/^\/+/, '')}` : null)
    return {
      id: row.id,
      document_type: row.document_type,
      document_name: getManagerDocumentTypeLabel(row.document_type),
      file_name: row.file_name,
      mime_type: row.mime_type,
      file_size_bytes: normalizedFileSize,
      status: row.status,
      rejection_reason: row.rejection_reason,
      uploaded_at: row.uploaded_at,
      reviewed_at: row.reviewed_at,
      file_path: row.file_path || null,
      file_url: row.file_url || null,
      download_url: downloadUrl
    }
  })
}

async function syncManagerProfileVerificationStatus(managerId) {
  const rows = await getManagerVerificationRows(managerId)
  const verificationStatus = computeManagerVerificationStatusFromRows(rows)

  await supabase
    .from('manager_profiles')
    .update({ profile_verification_status: verificationStatus, updated_at: new Date().toISOString() })
    .eq('manager_id', managerId)

  return verificationStatus
}

async function ensureUserProfileRow(authUser) {
  const userId = authUser?.id
  if (!userId) throw new Error('Authenticated user id is missing')

  const { data: existing, error: existingErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (existingErr) {
    throw new Error(existingErr.message)
  }

  if (existing) return existing

  const safeEmail = String(authUser.email || `${userId}@unknown.local`).trim().toLowerCase()
  const fallbackName = String(
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.name ||
    (safeEmail.includes('@') ? safeEmail.split('@')[0] : 'User') ||
    'User'
  ).trim()

  const { data: created, error: upsertErr } = await supabase
    .from('users')
    .upsert([
      {
        id: userId,
        email: safeEmail,
        full_name: fallbackName,
        role: 'user',
        is_verified: false
      }
    ], { onConflict: 'id' })
    .select('*')
    .single()

  if (upsertErr) {
    throw new Error(upsertErr.message)
  }

  return created
}

async function getUserVerificationRows(userId) {
  const { data, error } = await supabase
    .from('user_verification_documents')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) ? data : []
}

function computeVerificationStatusFromRows(rows) {
  const statusByType = new Map((rows || []).map((row) => [row.document_type, row.status]))
  const statuses = REQUIRED_DOCUMENT_TYPES.map((type) => statusByType.get(type) || null)

  const uploadedCount = statuses.filter(Boolean).length
  const allApproved = REQUIRED_DOCUMENT_TYPES.every((type) => statusByType.get(type) === 'Approved')

  if (allApproved) return 'Verified'
  if (uploadedCount === 0) return 'Pending Verification'
  return 'Under Review'
}

async function mapVerificationRowsWithSignedUrls(rows, expiresInSeconds = 1800) {
  const sortedRows = [...(rows || [])].sort((a, b) => {
    const aIndex = REQUIRED_DOCUMENT_TYPES.indexOf(a.document_type)
    const bIndex = REQUIRED_DOCUMENT_TYPES.indexOf(b.document_type)
    const safeA = aIndex >= 0 ? aIndex : Number.MAX_SAFE_INTEGER
    const safeB = bIndex >= 0 ? bIndex : Number.MAX_SAFE_INTEGER
    return safeA - safeB
  })

  const mapped = []
  for (const row of sortedRows) {
    const rawPath = row.storage_path || row.file_path || null
    const pathCandidates = getVerificationStoragePathCandidates(rawPath)

    let resolvedStoragePath = pathCandidates[0] || rawPath || null
    let downloadUrl = null

    for (const candidate of pathCandidates) {
      // eslint-disable-next-line no-await-in-loop
      const maybeSigned = await createSignedStorageUrl(VERIFICATION_DOCS_BUCKET, candidate, expiresInSeconds)
      if (maybeSigned) {
        downloadUrl = maybeSigned
        resolvedStoragePath = candidate
        break
      }
    }

    if (!downloadUrl && rawPath) {
      const absolutePath = resolveUploadsAbsolutePath(rawPath)
      if (absolutePath && fs.existsSync(absolutePath)) {
        downloadUrl = toUploadsPublicUrl(absolutePath)
      }
    }

    const normalizedFileSize = Number(row.file_size_bytes ?? row.file_size ?? 0) || null
    mapped.push({
      id: row.id,
      document_type: row.document_type,
      document_name: getDocumentTypeLabel(row.document_type),
      file_name: row.file_name,
      mime_type: row.mime_type,
      file_size_bytes: normalizedFileSize,
      file_size: normalizedFileSize,
      status: row.status,
      rejection_reason: row.rejection_reason,
      uploaded_at: row.uploaded_at,
      reviewed_at: row.reviewed_at,
      storage_path: resolvedStoragePath,
      file_path: row.file_path || resolvedStoragePath || rawPath,
      download_url: downloadUrl
    })
  }

  return mapped
}

function getVerificationStoragePathCandidates(rawPathLike) {
  const rawPath = String(rawPathLike || '').trim()
  if (!rawPath) return []

  const normalizedPath = rawPath.replace(/^\/+/, '')
  const candidates = [normalizedPath]

  if (normalizedPath.startsWith(`${VERIFICATION_DOCS_BUCKET}/`)) {
    candidates.push(normalizedPath.slice(`${VERIFICATION_DOCS_BUCKET}/`.length))
  }

  if (normalizedPath.startsWith('uploads/')) {
    candidates.push(normalizedPath.slice('uploads/'.length))
  }

  return [...new Set(candidates.filter(Boolean))]
}

async function notifyUserAccountApproved(userRecord) {
  const userId = String(userRecord?.id || '').trim()
  if (!userId) return

  const userEmail = String(userRecord?.email || '').trim()
  const userName = String(userRecord?.full_name || (userEmail ? userEmail.split('@')[0] : 'User') || 'User')

  try {
    await supabase
      .from('notifications')
      .insert([{ user_id: userId, message: 'Your account has been approved by admin. You can now place orders.' }])
  } catch (notifErr) {
    console.warn('Failed to insert notification for user verification:', notifErr?.message || notifErr)
  }

  if (!userEmail) return

  try {
    const sent = await sendApprovalEmail(userEmail, userName, userEmail).catch((mailErr) => {
      console.warn('sendApprovalEmail failed:', mailErr)
      return false
    })

    if (sent) {
      console.log(`✅ Sent approval email to ${userEmail}`)
    } else {
      console.warn('Emailer not configured or failed; skipping approval email')
    }
  } catch (mailErr) {
    console.warn('Failed to send approval email:', mailErr?.message || mailErr)
  }
}

function formatOrderNotificationAmount(value) {
  const amount = Number(value || 0)
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatOrderNotificationId(orderId) {
  const normalized = String(orderId || '').trim()
  if (!normalized) return 'N/A'
  return `#${normalized.slice(0, 10).toUpperCase()}`
}

function formatOrderNotificationPaymentMethod(value) {
  return String(value || '').trim().toLowerCase() === 'cod' ? 'COD' : 'prepaid'
}

function isMissingSchemaReferenceError(err, identifier = '') {
  const source = [err?.message, err?.details, err?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!source) return false

  const hasSchemaSignal =
    source.includes('does not exist') ||
    source.includes('schema cache') ||
    source.includes('could not find') ||
    source.includes('unknown column') ||
    ['42703', '42p01', 'pgrst204'].includes(String(err?.code || '').toLowerCase())

  if (!hasSchemaSignal) return false
  if (!identifier) return true
  return source.includes(String(identifier).toLowerCase())
}

function normalizeShippingMethod(value, fallback = 'standard') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s&-]+/g, '_')

  if (normalized === 'express') return 'express'
  if (normalized === 'standard') return 'standard'
  if (['pickup', 'pickup_drive', 'pickup_and_drive', 'pickupdrive'].includes(normalized)) {
    return 'pickup_drive'
  }

  const fallbackNormalized = String(fallback || '')
    .trim()
    .toLowerCase()
    .replace(/[\s&-]+/g, '_')

  if (['express', 'standard', 'pickup_drive'].includes(fallbackNormalized)) {
    return fallbackNormalized
  }

  return 'standard'
}

function isPickupOrderRecord(orderRecord) {
  if (Boolean(orderRecord?.pickup_order)) return true
  const derivedFallback = Number(orderRecord?.shipping_fee || 0) > 0 ? 'express' : 'standard'
  return normalizeShippingMethod(orderRecord?.shipping_method, derivedFallback) === 'pickup_drive'
}

function computePickupAvailabilityWindow(orderDate = new Date()) {
  const placedAt = orderDate instanceof Date ? new Date(orderDate) : new Date(orderDate)
  if (Number.isNaN(placedAt.getTime())) return null

  const cutoff = new Date(placedAt)
  cutoff.setHours(17, 0, 0, 0)

  if (placedAt <= cutoff) {
    const availableUntil = new Date(placedAt)
    availableUntil.setHours(21, 0, 0, 0)
    return {
      availableFrom: placedAt.toISOString(),
      availableUntil: availableUntil.toISOString()
    }
  }

  const availableFrom = new Date(placedAt)
  availableFrom.setDate(availableFrom.getDate() + 1)
  availableFrom.setHours(9, 0, 0, 0)

  const availableUntil = new Date(availableFrom)
  availableUntil.setHours(21, 0, 0, 0)

  return {
    availableFrom: availableFrom.toISOString(),
    availableUntil: availableUntil.toISOString()
  }
}

function formatPickupAvailabilityWindow(startIso, endIso) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Pickup window will be shared by admin.'
  }

  const dateLabel = start.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  const startTimeLabel = start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const endTimeLabel = end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  if (start.toDateString() === end.toDateString()) {
    return `${dateLabel}, ${startTimeLabel} - ${endTimeLabel}`
  }

  const endDateLabel = end.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  return `${dateLabel}, ${startTimeLabel} to ${endDateLabel}, ${endTimeLabel}`
}

async function getWarehouseDetails(warehouseId) {
  const id = String(warehouseId || '').trim()
  if (!id) return null

  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('id,name,address,contact_number')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data || null
  } catch (err) {
    if (!isMissingSchemaReferenceError(err, 'warehouses')) {
      console.warn('Failed to fetch warehouse details:', err?.message || err)
    }
    return null
  }
}

async function getDeliveryPartnerName(deliveryPartnerId) {
  const normalizedId = String(deliveryPartnerId || '').trim()
  if (!normalizedId) return 'Not Assigned'

  try {
    const { data, error } = await supabase
      .from('delivery_partners')
      .select('name')
      .eq('id', normalizedId)
      .maybeSingle()

    if (error) throw error

    const partnerName = String(data?.name || '').trim()
    return partnerName || 'Not Assigned'
  } catch (err) {
    console.warn('Failed to fetch delivery partner for order notification:', err?.message || err)
    return 'Not Assigned'
  }
}

async function getDeliveryPartnerPhone(deliveryPartnerId) {
  const normalizedId = String(deliveryPartnerId || '').trim()
  if (!normalizedId) return null

  try {
    const { data, error } = await supabase
      .from('delivery_partners')
      .select('mobile_number')
      .eq('id', normalizedId)
      .maybeSingle()

    if (error) throw error
    return data?.mobile_number || null
  } catch (err) {
    console.warn('Failed to fetch delivery partner phone for order notification:', err?.message || err)
    return null
  }
}

async function notifyUserOrderApproved(orderRecord) {
  const userId = String(orderRecord?.user_id || '').trim()
  const orderId = String(orderRecord?.id || '').trim()

  if (!userId || !orderId) return

  const message = [
    'Order Approved',
    `Your order (Order ID: ${formatOrderNotificationId(orderId)}) has been approved.`
  ].join('\n')

  try {
    await supabase
      .from('notifications')
      .insert([{ user_id: userId, message }])
  } catch (notifErr) {
    console.warn('Failed to insert order approval notification:', notifErr?.message || notifErr)
  }
}

async function notifyUserPickupOrderApproved(orderRecord, warehouseRecord = null) {
  const userId = String(orderRecord?.user_id || '').trim()
  const orderId = String(orderRecord?.id || '').trim()

  if (!userId || !orderId) return

  const warehouse = warehouseRecord || await getWarehouseDetails(orderRecord?.pickup_warehouse_id)
  const pickupWindowText = formatPickupAvailabilityWindow(
    orderRecord?.pickup_available_from,
    orderRecord?.pickup_available_until
  )

  const lines = [
    'Pickup Order Approved',
    `Your Pickup & Drive order (Order ID: ${formatOrderNotificationId(orderId)}) has been approved.`,
    `Amount: ${formatOrderNotificationAmount(orderRecord?.total_amount)}`,
    `Pickup Availability: ${pickupWindowText}`
  ]

  if (warehouse?.name) {
    lines.push(`Warehouse: ${warehouse.name}`)
  }
  if (warehouse?.address) {
    lines.push(`Address: ${warehouse.address}`)
  }
  if (warehouse?.contact_number) {
    lines.push(`Contact: ${warehouse.contact_number}`)
  }

  try {
    await supabase
      .from('notifications')
      .insert([{ user_id: userId, message: lines.join('\n') }])
  } catch (notifErr) {
    console.warn('Failed to insert pickup approval notification:', notifErr?.message || notifErr)
  }
}

async function notifyUserDeliveryPartnerAssigned(orderRecord, deliveryPartnerId) {
  const userId = String(orderRecord?.user_id || '').trim()
  const orderId = String(orderRecord?.id || '').trim()

  if (!userId || !orderId) return

  const deliveryPartnerName = await getDeliveryPartnerName(deliveryPartnerId)
  const deliveryPartnerPhone = await getDeliveryPartnerPhone(deliveryPartnerId)
  const paymentMethod = formatOrderNotificationPaymentMethod(orderRecord?.payment_method)
  const paymentLabel = paymentMethod === 'COD' ? 'COD (Unpaid)' : 'Prepaid'
  
  const lines = [
    'Delivery Partner Assigned',
    `Your order (Order ID: ${formatOrderNotificationId(orderId)}) has been approved and assigned to the delivery partner ${deliveryPartnerName}.`,
    `Amount: ${formatOrderNotificationAmount(orderRecord?.total_amount)}`,
    `Payment Method: ${paymentLabel}`
  ]

  if (deliveryPartnerPhone) {
    lines.push(`Delivery Partner Phone: ${deliveryPartnerPhone}`)
  }

  const message = lines.join('\n')

  try {
    await supabase
      .from('notifications')
      .insert([{ user_id: userId, message }])
  } catch (notifErr) {
    console.warn('Failed to insert delivery partner assignment notification:', notifErr?.message || notifErr)
  }
}

async function notifyAllUsersStockUpdate(productName, productDescription, previousStock, updatedStock) {
  try {
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id')
    if (usersErr || !users || users.length === 0) return

    const desc = String(productDescription || 'No description available').trim()
    const message = [
      'Stock Update Notification',
      `The stock for the product **${productName}** has been updated.`,
      `Product Description: ${desc}`,
      `Previous Stock: ${previousStock}`,
      `Updated Stock: ${updatedStock}`
    ].join('\n')

    const rows = users.map((u) => ({ user_id: u.id, message }))
    await supabase.from('notifications').insert(rows)
  } catch (err) {
    console.warn('Failed to send stock update notifications:', err?.message || err)
  }
}

async function syncUserVerifiedFromDocumentStatuses(userId) {
  const rows = await getUserVerificationRows(userId)
  const statusByType = new Map(rows.map((row) => [row.document_type, row.status]))
  const allApproved = REQUIRED_DOCUMENT_TYPES.every((type) => statusByType.get(type) === 'Approved')

  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('id, email, full_name, is_verified')
    .eq('id', userId)
    .maybeSingle()

  if (existingUserError) {
    throw new Error(existingUserError.message)
  }

  const wasVerified = Boolean(existingUser?.is_verified)
  const nextIsVerified = wasVerified || allApproved

  if (allApproved && !wasVerified) {
    const { error } = await supabase
      .from('users')
      .update({ is_verified: true })
      .eq('id', userId)

    if (error) {
      throw new Error(error.message)
    }
  }

  if (allApproved && !wasVerified && existingUser) {
    await notifyUserAccountApproved(existingUser)
  }

  return nextIsVerified
}

function normalizeOfferRow(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    active: row.active,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    minimumAmount: row.minimum_amount,
    productId: row.product_id,
    productName: row.product?.name || null,
    productCategory: row.product?.category || null,
    productPrice: row.product?.price || null,
    startAt: row.start_at,
    endAt: row.end_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

app.get('/', (req, res) => {
  res.json({ message: 'PepsiCo Distributor API' })
})

// Health endpoint for quick diagnostics
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    port: PORT,
    mailerConfigured: isMailerConfigured()
  }
  try {
    const { error } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
    health.db = {
      ok: !error,
      error: error ? (error.message || JSON.stringify(error) || String(error)) : null
    }
  } catch (e) {
    health.db = { ok: false, error: e?.message || e?.toString() || JSON.stringify(e) || String(e) }
  }
  res.json(health)
})

// Geo helper: proxy pincode to avoid CORS issues on frontend
app.get('/api/geo/pincode/:pin', async (req, res) => {
  try {
    const pin = (req.params.pin || '').trim()
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: 'Invalid pincode' })
    }
    const resp = await fetch(`https://api.postalpincode.in/pincode/${pin}`)
    const data = await resp.json()
    if (!Array.isArray(data) || !data[0] || data[0].Status !== 'Success') {
      return res.status(404).json({ error: 'Pincode not found' })
    }
    const office = data[0].PostOffice?.[0]
    res.json({
      pincode: pin,
      state: office?.State || null,
      district: office?.District || null,
      country: office?.Country || 'India'
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')

      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (error) {
      if (error.code === '42P01') {
        console.warn('Offers table not found for public endpoint. Returning empty list until migration runs.')
        return res.json([])
      }
      throw error
    }
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/orders/:userId', async (req, res) => {
  try {
    const baseOrderSelect = 'id,user_id,product_id,status,created_at,total_amount,payment_method,shipping_fee,subtotal,discount_total,coupon_discount,Slab_discount,offer_discount,gst_amount,coupon_code,offer_id,items, products(name,price)'
    const pickupAwareOrderSelect = `${baseOrderSelect}, shipping_method, pickup_order, pickup_available_from, pickup_available_until, pickup_warehouse_id`

    let { data, error } = await supabase
      .from('orders')
      .select(pickupAwareOrderSelect)
      .eq('user_id', req.params.userId)
      .order('created_at', { ascending: false })

    if (error && isMissingSchemaReferenceError(error)) {
      const fallbackResult = await supabase
        .from('orders')
        .select(baseOrderSelect)
        .eq('user_id', req.params.userId)
        .order('created_at', { ascending: false })

      data = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) throw error

    const orders = Array.isArray(data) ? data : []
    const fallbackIds = new Set()

    for (const order of orders) {
      const total = Number(order.total_amount)
      if (!Number.isFinite(total) || total <= 0) {
        if (Array.isArray(order.items)) {
          for (const item of order.items) {
            if (item?.product_id) fallbackIds.add(item.product_id)
          }
        }
        if (order.product_id) {
          fallbackIds.add(order.product_id)
        }
      }
    }

    const priceMap = new Map()
    if (fallbackIds.size > 0) {
      const { data: products, error: productError } = await supabase
        .from('products')
        .select('id, price')
        .in('id', Array.from(fallbackIds))
      if (productError) {
        console.warn('Failed to backfill order totals:', productError?.message || productError)
      } else {
        for (const product of products || []) {
          priceMap.set(product.id, Number(product.price) || 0)
        }
      }
    }

    const updates = []

    const enriched = orders.map((order) => {
      let amount = Number(order.total_amount)
      const linkedProductPrice = Array.isArray(order.products)
        ? Number(order.products?.[0]?.price ?? 0)
        : Number(order.products?.price ?? 0)

      const hadStoredAmount = Number.isFinite(amount) && amount > 0

      if (!hadStoredAmount) {
        let computed = 0
        if (Array.isArray(order.items) && order.items.length > 0) {
          for (const item of order.items) {
            const priceFromMap = item?.product_id ? priceMap.get(item.product_id) : undefined
            const price = Number(priceFromMap ?? linkedProductPrice ?? 0)
            const qty = Number(item?.quantity ?? 1)
            if (Number.isFinite(price) && Number.isFinite(qty)) {
              computed += price * Math.max(qty, 0)
            }
          }
        } else if (order.product_id) {
          const price = Number(priceMap.get(order.product_id) ?? linkedProductPrice ?? 0)
          if (Number.isFinite(price)) {
            computed = price
          }
        }
        if (computed > 0) {
          amount = computed
          updates.push({ id: order.id, total_amount: computed })
        }
      }

      return {
        ...order,
        total_amount: Number.isFinite(amount) && amount > 0 ? amount : hadStoredAmount ? amount : 0
      }
    })

    if (updates.length > 0) {
      try {
        await supabase
          .from('orders')
          .upsert(updates, { onConflict: 'id' })
      } catch (persistErr) {
        console.warn('Failed to persist backfilled totals:', persistErr?.message || persistErr)
      }
    }

    // Gather all product_ids from all orders' items
    const allItems = (orders || []).flatMap(order => Array.isArray(order.items) ? order.items : [])
    const allProductIds = [...new Set(allItems.map(item => item.product_id).filter(Boolean))]

    // Fetch product names for all product_ids
    let productNameMap = new Map()
    if (allProductIds.length > 0) {
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name')
        .in('id', allProductIds)
      if (!prodError && Array.isArray(products)) {
        for (const p of products) {
          productNameMap.set(p.id, p.name)
        }
      }
    }

    const pickupWarehouseIds = [...new Set((enriched || []).map((order) => order.pickup_warehouse_id).filter(Boolean))]
    const warehouseMap = new Map()
    if (pickupWarehouseIds.length > 0) {
      const { data: warehouses, error: warehouseError } = await supabase
        .from('warehouses')
        .select('id,name,address,contact_number')
        .in('id', pickupWarehouseIds)

      if (warehouseError) {
        if (!isMissingSchemaReferenceError(warehouseError, 'warehouses')) {
          console.warn('Failed to fetch pickup warehouses for user orders:', warehouseError?.message || warehouseError)
        }
      } else {
        for (const warehouse of warehouses || []) {
          warehouseMap.set(warehouse.id, warehouse)
        }
      }
    }

    const enrichedWithNames = enriched.map((order) => {
      const normalizedShippingMethod = normalizeShippingMethod(
        order?.shipping_method,
        Number(order?.shipping_fee || 0) > 0 ? 'express' : 'standard'
      )

      return {
        ...order,
        shipping_method: normalizedShippingMethod,
        pickup_order: Boolean(order?.pickup_order) || normalizedShippingMethod === 'pickup_drive',
        pickup_warehouse: order?.pickup_warehouse_id ? (warehouseMap.get(order.pickup_warehouse_id) || null) : null,
        items: Array.isArray(order.items)
          ? order.items.map(item => ({
              ...item,
              name: item.name || productNameMap.get(item.product_id) || ''
            }))
          : order.items
      }
    })

    res.json(enrichedWithNames)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Temporary helper: search order by prefix/full id (public, read-only)
app.get('/api/orders/search/:prefix', async (req, res) => {
  try {
    const prefix = String((req.params.prefix || '').trim())
    if (!prefix) return res.status(400).json({ error: 'Prefix is required' })

    // Try exact match first (safe for uuid column)
    const { data: exactMatch, error: exactErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', prefix)
      .limit(1)

    if (exactErr) console.warn('Order search exact match error:', exactErr)
    if (exactMatch && exactMatch.length > 0) {
      const orderRecord = { ...exactMatch[0] }
      if (orderRecord.delivery_partner_id) {
        try {
          const { data: dpData } = await supabase
            .from('delivery_partners')
            .select('name, mobile_number')
            .eq('id', orderRecord.delivery_partner_id)
            .maybeSingle()
          if (dpData) {
            orderRecord.delivery_partner = dpData
          }
        } catch (dpErr) {
          console.warn('Failed to fetch delivery partner for search:', dpErr)
        }
      }
      return res.json(orderRecord)
    }

    // Fallback: fetch recent orders and match by prefix in JS (avoids ilike on uuid type)
    const { data: recent, error: recentErr } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (recentErr) throw recentErr
    if (!recent || recent.length === 0) return res.status(404).json({ error: 'No order found' })

    const found = recent.find((o) => String(o.id || '').toLowerCase().startsWith(prefix.toLowerCase()))
    if (!found) return res.status(404).json({ error: 'No order found' })

    const orderRecord = { ...found }
    if (orderRecord.delivery_partner_id) {
      try {
        const { data: dpData } = await supabase
          .from('delivery_partners')
          .select('name, mobile_number')
          .eq('id', orderRecord.delivery_partner_id)
          .maybeSingle()
        if (dpData) {
          orderRecord.delivery_partner = dpData
        }
      } catch (dpErr) {
        console.warn('Failed to fetch delivery partner for search:', dpErr)
      }
    }

    res.json(orderRecord)
  } catch (err) {
    console.error('Order search failed:', err)
    res.status(500).json({ error: 'Order search failed' })
  }
})

app.get('/api/orders/:orderId/progress', async (req, res) => {
  try {
    const orderId = req.params.orderId
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' })
    }

    const { data, error } = await supabase
      .from('delivery_progress_view')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Delivery progress not found for this order' })
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch delivery progress' })
  }
})

app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.params.userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    const notificationId = String(req.params.notificationId || '').trim()
    if (!notificationId) {
      return res.status(400).json({ error: 'notificationId is required' })
    }

    const isRead = req.body?.is_read
    if (typeof isRead !== 'boolean') {
      return res.status(400).json({ error: 'is_read must be boolean' })
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: isRead })
      .eq('id', notificationId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/notifications/user/:userId/read-all', async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim()
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      // .or filter removed - updating all notifications to read
      .select('id')

    if (error) throw error

    res.json({
      success: true,
      updated_count: Array.isArray(data) ? data.length : 0
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/orders', async (req, res) => {
  try {
    const { user_id, items, total_amount, payment_method, subtotal, discount_total, coupon_discount, offer_discount, shipping_fee, gst_amount, coupon_code, offer_id } = req.body

    if (!user_id) return res.status(400).json({ error: 'user_id is required' })

    // normalize items
    let orderItems = []
    if (Array.isArray(items) && items.length > 0) {
      // Attach slab info for each item
      orderItems = await Promise.all(items.map(async item => {
        let slab = null;
        // Fetch slabs for this product
        const { data: slabs } = await supabase
          .from('product_slabs')
          .select('*')
          .eq('product_id', item.product_id)
        slab = resolveApplicableSlab(Array.isArray(slabs) ? slabs : [], item.quantity, new Date())
        return {
          ...item,
          slab: slab ? {
            min_quantity: slab.min_quantity,
            discount_type: slab.discount_type,
            discount_value: slab.discount_value,
            start_date: slab.start_date,
            end_date: slab.end_date
          } : null
        };
      }));
    } else if (req.body.product_id) {
      // Attach slab info for single item
      let slab = null;
      const { data: slabs } = await supabase
        .from('product_slabs')
        .select('*')
        .eq('product_id', req.body.product_id);
      slab = resolveApplicableSlab(Array.isArray(slabs) ? slabs : [], req.body.quantity || 1, new Date())
      orderItems = [{
        product_id: req.body.product_id,
        quantity: req.body.quantity || 1,
        slab: slab ? {
          min_quantity: slab.min_quantity,
          discount_type: slab.discount_type,
          discount_value: slab.discount_value,
          start_date: slab.start_date,
          end_date: slab.end_date
        } : null
      }];
    } else {
      return res.status(400).json({ error: 'items array or product_id required' })
    }

    // Check if user exists and is verified
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id,is_verified')
      .eq('id', user_id)
      .maybeSingle()

    if (userError) throw userError
    if (!userData) {
      return res.status(404).json({ error: 'User profile not found. Please complete registration.' })
    }
    if (userData.is_verified === false) {
      return res.status(403).json({ error: 'Account pending approval. Please wait for admin verification.' })
    }

    // Validate products and stock
    const productIds = orderItems.map(i => i.product_id)
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id,name,stock,price')
      .in('id', productIds)

    if (prodError) throw prodError
    if (!products || products.length !== productIds.length) return res.status(400).json({ error: 'Some products not found' })

    for (const item of orderItems) {
      const p = products.find(x => x.id === item.product_id)
      const qty = item.quantity || 1
      if (!p) return res.status(400).json({ error: `Product not found` })
      if (p.stock < qty) {
        return res.status(400).json({ 
          error: `INSUFFICIENT_STOCK`,
          message: `${p.name} has only ${p.stock} unit(s) available, but you ordered ${qty}. Please update your quantities.`,
          product_name: p.name,
          requested: qty,
          available: p.stock
        })
      }
    }

    const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
    const productsById = new Map((products || []).map((product) => [String(product.id), product]))

    // Ensure each order item carries concrete slab discount so bills can show detail lines.
    orderItems = orderItems.map((item) => {
      const quantity = Number(item?.quantity || 1)
      const normalizedItem = {
        ...item,
        quantity,
        slab: item?.slab || null
      }

      let itemSlabDiscount = Number(item?.slab_discount || 0)
      const slab = normalizedItem.slab

      if (itemSlabDiscount <= 0 && slab && quantity >= Number(slab.min_quantity || 0)) {
        const unitPrice = Number(productsById.get(String(item.product_id))?.price || 0)
        itemSlabDiscount = calculateSlabDiscountAmount({ price: unitPrice, quantity, slab })
      }

      return {
        ...normalizedItem,
        slab_discount: round2(Math.max(0, itemSlabDiscount))
      }
    })

    const slabDiscountFromPayload = Number((req.body.slab_discount ?? req.body.Slab_discount) || 0)
    const slabDiscountFromItems = round2(orderItems.reduce((sum, item) => sum + Number(item?.slab_discount || 0), 0))
    const slabDiscountToStore = round2(Math.max(0, slabDiscountFromPayload > 0 ? slabDiscountFromPayload : slabDiscountFromItems))

    const parsedSubtotal = Number(subtotal) || 0
    const parsedCouponDiscount = Number(coupon_discount) || 0
    const parsedOfferDiscount = Number(offer_discount) || 0
    const parsedDiscountTotal = Number(discount_total) || 0
    const normalizedDiscountTotal = round2(Math.max(parsedDiscountTotal, slabDiscountToStore + parsedCouponDiscount + parsedOfferDiscount))
    const normalizedShippingMethod = normalizeShippingMethod(
      req.body.shipping_method || req.body.shippingMethod,
      Number(shipping_fee || 0) > 0 ? 'express' : 'standard'
    )
    const pickupWindow = normalizedShippingMethod === 'pickup_drive'
      ? computePickupAvailabilityWindow(new Date())
      : null

    // Strict coupon usage check before creating order
    const couponCode = coupon_code || req.body.coupon_code || (req.body.coupon && req.body.coupon.code)
    if (couponCode) {
      // Check if user has already used this coupon
      const { data: usageRows, error: usageError } = await supabase
        .from('coupon_usages')
        .select('id')
        .eq('user_id', user_id)
        .eq('coupon_code', couponCode)
        .limit(1)
      if (usageError) throw usageError
      if (Array.isArray(usageRows) && usageRows.length > 0) {
        return res.status(400).json({ error: 'COUPON_ALREADY_USED', message: 'You have already used this coupon. Each coupon can only be used once per user.' })
      }
    }

    // Check if user has already used the offer (if offer_id provided)
    const offerId = offer_id || req.body.offer_id
    if (offerId) {
      const { data: offerUsageRows, error: offerUsageError } = await supabase
        .from('offer_usages')
        .select('id')
        .eq('user_id', user_id)
        .eq('offer_id', offerId)
        .limit(1)
      
      if (offerUsageError && offerUsageError.code !== '42P01') {
        // Ignore if table doesn't exist, but throw other errors
        throw offerUsageError
      }
      
      if (!offerUsageError && Array.isArray(offerUsageRows) && offerUsageRows.length > 0) {
        return res.status(400).json({ error: 'OFFER_ALREADY_USED', message: 'You have already used this offer. Each offer can only be used once per user.' })
      }
    }

    const orderPayloadBase = {
      user_id,
      status: 'Pending',
      total_amount: Number(total_amount) || 0,
      items: orderItems,
      payment_method: payment_method || 'prepaid',
      subtotal: parsedSubtotal,
      discount_total: normalizedDiscountTotal,
      coupon_discount: parsedCouponDiscount,
      offer_discount: parsedOfferDiscount,
      shipping_fee: Number(shipping_fee) || 0,
      gst_amount: Number(gst_amount) || 0,
      coupon_code: couponCode || null,
      offer_id: offerId || null,
      shipping_method: normalizedShippingMethod,
      pickup_order: normalizedShippingMethod === 'pickup_drive',
      pickup_available_from: pickupWindow?.availableFrom || null,
      pickup_available_until: pickupWindow?.availableUntil || null
    }

    const pickupShippingSelected = normalizedShippingMethod === 'pickup_drive'
    const fullSchemaPayload = orderPayloadBase
    const legacyPayload = {
      user_id,
      status: orderPayloadBase.status,
      total_amount: orderPayloadBase.total_amount,
      items: orderPayloadBase.items,
      payment_method: orderPayloadBase.payment_method,
      subtotal: orderPayloadBase.subtotal,
      discount_total: orderPayloadBase.discount_total,
      coupon_discount: orderPayloadBase.coupon_discount,
      offer_discount: orderPayloadBase.offer_discount,
      shipping_fee: orderPayloadBase.shipping_fee,
      gst_amount: orderPayloadBase.gst_amount,
      coupon_code: orderPayloadBase.coupon_code,
      offer_id: orderPayloadBase.offer_id
    }

    const insertCandidates = [
      { ...fullSchemaPayload, Slab_discount: slabDiscountToStore },
      { ...fullSchemaPayload, slab_discount: slabDiscountToStore },
      fullSchemaPayload
    ]

    if (!pickupShippingSelected) {
      insertCandidates.push(
        { ...legacyPayload, Slab_discount: slabDiscountToStore },
        { ...legacyPayload, slab_discount: slabDiscountToStore },
        legacyPayload
      )
    }

    let orderData = null
    let lastInsertError = null

    for (const payload of insertCandidates) {
      // eslint-disable-next-line no-await-in-loop
      const insertResult = await supabase
        .from('orders')
        .insert([payload])
        .select()

      if (!insertResult.error) {
        orderData = insertResult.data
        lastInsertError = null
        break
      }

      lastInsertError = insertResult.error
      if (!isMissingSchemaReferenceError(insertResult.error)) {
        break
      }
    }

    if (lastInsertError) {
      if (pickupShippingSelected && isMissingSchemaReferenceError(lastInsertError)) {
        return res.status(500).json({
          error: 'Pickup & Drive is not configured in the database. Please run ADD_PICKUP_WAREHOUSE_SUPPORT.sql first.'
        })
      }
      throw lastInsertError
    }

    if (!Array.isArray(orderData) || orderData.length === 0) {
      throw new Error('Failed to create order')
    }

    const orderId = orderData[0]?.id

    // Only after successful order creation, record coupon usage
    if (couponCode) {
      console.log('[COUPON USAGE] Attempting to record usage:', { user_id, coupon_code: couponCode, order_id: orderId })
      try {
        const { error: usageInsertError } = await supabase
          .from('coupon_usages')
          .insert([{ user_id, coupon_code: couponCode, used_at: new Date().toISOString() }])
        if (usageInsertError) {
          console.warn('[COUPON USAGE] Insert error:', usageInsertError.message || usageInsertError)
        } else {
          console.log('[COUPON USAGE] Successfully recorded usage for user:', user_id, 'coupon:', couponCode)
        }
      } catch (usageErr) {
        // If already inserted, ignore unique violation
        if (!/unique|duplicate/i.test(usageErr?.message || '')) {
          console.warn('[COUPON USAGE] Exception:', usageErr?.message || usageErr)
        }
      }
    }

    // Record offer usage if offer was applied
    if (offerId && orderId) {
      console.log('[OFFER USAGE] Attempting to record usage:', { user_id, offer_id: offerId, order_id: orderId })
      try {
        const { error: offerUsageInsertError } = await supabase
          .from('offer_usages')
          .insert([{ user_id, offer_id: offerId, order_id: orderId, used_at: new Date().toISOString() }])
        
        if (offerUsageInsertError) {
          // Ignore if table doesn't exist yet
          if (offerUsageInsertError.code !== '42P01') {
            console.warn('[OFFER USAGE] Insert error:', offerUsageInsertError.message || offerUsageInsertError)
          }
        } else {
          console.log('[OFFER USAGE] Successfully recorded usage for user:', user_id, 'offer:', offerId)
        }
      } catch (offerUsageErr) {
        // If already inserted, ignore unique violation
        if (!/unique|duplicate/i.test(offerUsageErr?.message || '')) {
          console.warn('[OFFER USAGE] Exception:', offerUsageErr?.message || offerUsageErr)
        }
      }
    }

    // Decrement stock for each product
    for (const item of orderItems) {
      const { product_id, quantity } = item
      if (product_id && quantity) {
        // Fetch current stock
        const { data: currentProduct, error: fetchErr } = await supabase
          .from('products')
          .select('stock, total_sold')
          .eq('id', product_id)
          .single()
        
        if (fetchErr || !currentProduct) {
          console.warn(`Failed to fetch product ${product_id}:`, fetchErr?.message)
          continue
        }

        // Calculate new stock and total_sold
        const newStock = Math.max(0, (currentProduct.stock || 0) - quantity)
        const newTotalSold = (currentProduct.total_sold || 0) + quantity

        // Update both stock and total_sold in a single update
        const { error: updateErr } = await supabase
          .from('products')
          .update({ 
            stock: newStock,
            total_sold: newTotalSold,
            updated_at: new Date().toISOString()
          })
          .eq('id', product_id)
        
        if (updateErr) {
          console.error(`Failed to update stock for product ${product_id}:`, updateErr.message)
        } else {
          console.log(`✓ Stock decreased: ${quantity} units. New stock: ${newStock}. Total sold: ${newTotalSold}`)
        }
      }
    }

    // Send order confirmation email
    try {
      const { data: user } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', user_id)
        .single()

      if (user?.email) {
        // Get product details for email
        const { data: productDetails } = await supabase
          .from('products')
          .select('id, name, price')
          .in('id', productIds)

        const itemsWithDetails = orderItems.map(item => {
          const product = productDetails?.find(p => p.id === item.product_id)
          return {
            name: product?.name || 'Product',
            quantity: item.quantity || 1,
            price: (product?.price || 0).toFixed(2),
            total: ((product?.price || 0) * (item.quantity || 1)).toFixed(2)
          }
        })

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
        const trackingUrl = `${frontendUrl}/dashboard/track-order?id=${orderData[0].id}`

        const paymentMethodDisplay = (() => {
          const pm = (orderData[0].payment_method || payment_method || 'cod').toLowerCase()
          if (pm === 'prepaid' || pm === 'online' || pm === 'razorpay') return 'Online Payment'
          if (pm === 'cod') return 'Cash on Delivery'
          return payment_method || 'Cash on Delivery'
        })()

        await sendOrderConfirmationEmail(user.email, {
          userName: user.full_name || 'Customer',
          orderId: `ORD-${orderData[0].id.slice(0, 8).toUpperCase()}`,
          orderDate: new Date(orderData[0].created_at).toLocaleDateString('en-IN', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
          }),
          status: 'Pending - Awaiting Approval',
          paymentMethod: paymentMethodDisplay,
          items: itemsWithDetails,
          totalAmount: (total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          trackingUrl: trackingUrl,
          supportEmail: process.env.Email_User || 'support@ashirwadenterprises.com'
        })
        console.log(`Order confirmation email sent to ${user.email}`)
      }
    } catch (emailErr) {
      console.warn('Failed to send order confirmation email:', emailErr?.message || emailErr)
      // Don't fail the order creation if email fails
    }

    res.status(201).json(orderData)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Save/Upsert address for a user
app.post('/api/addresses/upsert', async (req, res) => {
  try {
    let { user_id, pincode, state, district, address_line, is_default } = req.body

    user_id = (user_id || '').trim()
    pincode = (pincode || '').trim()
    state = (state || '').trim()
    district = (district || '').trim()
    address_line = (address_line || '').trim()

    if (!user_id || !pincode || !state || !district) {
      return res.status(400).json({ error: 'user_id, pincode, state, district required' })
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ error: 'Invalid pincode. Must be 6 digits.' })
    }

    // Ensure user profile exists to satisfy foreign key constraint
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .single()
    if (userErr || !userRow) {
      return res.status(404).json({ error: 'User profile not found. Please complete registration.' })
    }

    // When setting a new default address, unset other defaults
    if (is_default === true) {
      try {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', user_id)
      } catch (unsetErr) {
        console.warn('Failed to unset previous default addresses:', unsetErr?.message)
      }
    }

    // Insert new address
    const { data, error } = await supabase
      .from('addresses')
      .insert([{ user_id, pincode, state, district, address_line: address_line || null, is_default: !!is_default }])
      .select('*')

    if (error) {
      const msg = error?.message || 'Unknown error while saving address'
      const lower = msg.toLowerCase()
      if (lower.includes('foreign key')) {
        return res.status(400).json({ error: 'Address save failed due to invalid user reference.' })
      }
      return res.status(400).json({ error: msg })
    }

    return res.status(201).json(data)
  } catch (err) {
    console.error('Address upsert failed:', err)
    return res.status(500).json({ error: err.message })
  }
})

app.post('/api/user/profile-photo', requireUserAuth, async (req, res) => {
  try {
    await runMulterMiddleware(req, res, profilePhotoUpload.single('photo'))

    if (!req.file) {
      return res.status(400).json({ error: 'Profile photo file is required' })
    }

    const source = String(req.body?.source || 'upload').trim().toLowerCase()
    const profilePhotoSourceCandidates = getProfilePhotoSourceCandidates(source)
    const existingProfile = await ensureUserProfileRow(req.user)

    const extension = MIME_EXTENSION_MAP[req.file.mimetype] || 'jpg'
    const storagePath = `${req.user.id}/${Date.now()}-${randomUUID()}.${extension}`

    const { error: storageError } = await supabase
      .storage
      .from(PROFILE_PHOTOS_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      })

    if (storageError) {
      throw new Error(storageError.message)
    }

    const { data: publicData } = supabase
      .storage
      .from(PROFILE_PHOTOS_BUCKET)
      .getPublicUrl(storagePath)

    const publicUrl = publicData?.publicUrl || null

    let updatedProfile = null
    let updateError = null

    for (const sourceCandidate of profilePhotoSourceCandidates) {
      const updatePayload = {
        profile_photo_url: publicUrl,
        profile_photo_path: storagePath
      }

      if (typeof sourceCandidate === 'string') {
        updatePayload.profile_photo_source = sourceCandidate
      }

      const updateResult = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', req.user.id)
        .select('id, profile_photo_url, profile_photo_source, profile_photo_path')
        .single()

      if (!updateResult.error) {
        updatedProfile = updateResult.data
        updateError = null
        break
      }

      updateError = updateResult.error
      const errorText = `${updateResult.error?.message || ''} ${updateResult.error?.details || ''}`.toLowerCase()
      const isSourceCheckConstraint = errorText.includes('profile_photo_source') || errorText.includes('check constraint')

      if (!isSourceCheckConstraint) {
        break
      }
    }

    if (updateError || !updatedProfile) {
      // Cleanup orphaned file if DB update fails.
      try {
        await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([storagePath])
      } catch (cleanupErr) {
        console.warn('Failed to cleanup profile photo after DB update error:', cleanupErr?.message || cleanupErr)
      }
      throw new Error(updateError?.message || 'Failed to update profile photo metadata')
    }

    if (existingProfile?.profile_photo_path && existingProfile.profile_photo_path !== storagePath) {
      try {
        await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([existingProfile.profile_photo_path])
      } catch (removeErr) {
        console.warn('Failed to remove previous profile photo:', removeErr?.message || removeErr)
      }
    }

    return res.json({
      success: true,
      profile_photo_url: updatedProfile.profile_photo_url,
      profile_photo_source: updatedProfile.profile_photo_source
    })
  } catch (err) {
    const statusCode = err instanceof multer.MulterError || /Only JPG and PNG/.test(String(err?.message || '')) ? 400 : 500
    return res.status(statusCode).json({ error: getUploadErrorMessage(err) })
  }
})

app.get('/api/user/verification-documents', requireUserAuth, async (req, res) => {
  try {
    const profile = await ensureUserProfileRow(req.user)
    const rows = await getUserVerificationRows(req.user.id)
    const documents = await mapVerificationRowsWithSignedUrls(rows)
    const verificationStatus = computeVerificationStatusFromRows(rows)

    return res.json({
      user_id: req.user.id,
      user_is_verified: Boolean(profile?.is_verified),
      profile_photo_url: profile?.profile_photo_url || null,
      verification_status: verificationStatus,
      required_documents: REQUIRED_DOCUMENT_TYPES.map((type) => ({
        document_type: type,
        document_name: getDocumentTypeLabel(type)
      })),
      documents
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/api/user/verification-documents/by-user/:userId', async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim()
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, is_verified, profile_photo_url')
      .eq('id', userId)
      .maybeSingle()

    if (userError) {
      throw new Error(userError.message)
    }

    if (!userRow) {
      return res.status(404).json({ error: 'User profile not found' })
    }

    const rows = await getUserVerificationRows(userId)
    const documents = await mapVerificationRowsWithSignedUrls(rows)
    const verificationStatus = computeVerificationStatusFromRows(rows)

    return res.json({
      user_id: userId,
      user_is_verified: Boolean(userRow?.is_verified),
      profile_photo_url: userRow?.profile_photo_url || null,
      verification_status: verificationStatus,
      required_documents: REQUIRED_DOCUMENT_TYPES.map((type) => ({
        document_type: type,
        document_name: getDocumentTypeLabel(type)
      })),
      documents
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

async function buildUserDocumentDownloadPayload(userId, normalizedDocumentType) {
  const { data: row, error: rowError } = await supabase
    .from('user_verification_documents')
    .select('document_type,file_name,status,storage_path,file_path')
    .eq('user_id', userId)
    .eq('document_type', normalizedDocumentType)
    .maybeSingle()

  if (rowError) {
    throw new Error(rowError.message)
  }

  if (!row) {
    return { notFound: true, reason: 'Document not found for this user' }
  }

  const rawPath = String(row.storage_path || row.file_path || '').trim()
  if (!rawPath) {
    return { notFound: true, reason: 'Document file path is missing' }
  }

  const pathCandidates = getVerificationStoragePathCandidates(rawPath)

  let signedUrl = null
  let resolvedPath = null

  for (const pathCandidate of [...new Set(pathCandidates.filter(Boolean))]) {
    // eslint-disable-next-line no-await-in-loop
    const maybeSignedUrl = await createSignedStorageUrl(VERIFICATION_DOCS_BUCKET, pathCandidate, 1800)
    if (maybeSignedUrl) {
      signedUrl = maybeSignedUrl
      resolvedPath = pathCandidate
      break
    }
  }

  if (!signedUrl) {
    const absolutePath = resolveUploadsAbsolutePath(rawPath)
    if (absolutePath && fs.existsSync(absolutePath)) {
      signedUrl = toUploadsPublicUrl(absolutePath)
      resolvedPath = rawPath
    }
  }

  if (!signedUrl) {
    return { notFound: true, reason: 'Document file not found in storage' }
  }

  return {
    notFound: false,
    payload: {
      document_type: normalizedDocumentType,
      file_name: row.file_name || null,
      status: row.status || 'Pending',
      storage_path: resolvedPath,
      download_url: signedUrl
    }
  }
}

app.get('/api/user/verification-documents/:documentType/download', requireUserAuth, async (req, res) => {
  const normalizedDocumentType = normalizeDocumentType(req.params.documentType)

  if (!REQUIRED_DOCUMENT_TYPES.includes(normalizedDocumentType)) {
    return res.status(400).json({ error: 'Invalid document type' })
  }

  try {
    const resolved = await buildUserDocumentDownloadPayload(req.user.id, normalizedDocumentType)
    if (resolved.notFound) {
      return res.status(404).json({ error: resolved.reason })
    }

    return res.json(resolved.payload)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/api/user/verification-documents/by-user/:userId/:documentType/download', async (req, res) => {
  const userId = String(req.params.userId || '').trim()
  const normalizedDocumentType = normalizeDocumentType(req.params.documentType)

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  if (!REQUIRED_DOCUMENT_TYPES.includes(normalizedDocumentType)) {
    return res.status(400).json({ error: 'Invalid document type' })
  }

  try {
    const resolved = await buildUserDocumentDownloadPayload(userId, normalizedDocumentType)
    if (resolved.notFound) {
      return res.status(404).json({ error: resolved.reason })
    }

    return res.json(resolved.payload)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/api/user/verification-documents/by-user/:userId/:documentType', async (req, res) => {
  const userId = String(req.params.userId || '').trim()
  const normalizedDocumentType = normalizeDocumentType(req.params.documentType)

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  if (!REQUIRED_DOCUMENT_TYPES.includes(normalizedDocumentType)) {
    return res.status(400).json({ error: 'Invalid document type' })
  }

  try {
    await runMulterMiddleware(req, res, verificationDocUpload.single('document'))

    if (!req.file) {
      return res.status(400).json({ error: 'Document file is required' })
    }

    let { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (userError) throw new Error(userError.message)
    if (!userRow) {
      const fallbackEmail = `${userId}@unknown.local`
      const fallbackName = 'User'

      const { data: createdRow, error: createErr } = await supabase
        .from('users')
        .upsert([
          {
            id: userId,
            email: fallbackEmail,
            full_name: fallbackName,
            role: 'user',
            is_verified: false
          }
        ], { onConflict: 'id' })
        .select('id')
        .single()

      if (createErr) {
        throw new Error(createErr.message)
      }

      userRow = createdRow
    }

    const { data: existingRow, error: existingError } = await supabase
      .from('user_verification_documents')
      .select('*')
      .eq('user_id', userId)
      .eq('document_type', normalizedDocumentType)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    if (existingRow && existingRow.status !== 'Rejected') {
      return res.status(409).json({ error: 'Document is locked. You can re-upload only after admin rejection.' })
    }

    const extension = MIME_EXTENSION_MAP[req.file.mimetype] || 'bin'
    const storagePath = `${userId}/${normalizedDocumentType}/${Date.now()}-${randomUUID()}.${extension}`

    const { error: storageError } = await supabase
      .storage
      .from(VERIFICATION_DOCS_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      })

    if (storageError) {
      throw new Error(storageError.message)
    }

    const nowIso = new Date().toISOString()
    const payload = {
      user_id: userId,
      document_type: normalizedDocumentType,
      file_name: getRenamedDocumentFileName(normalizedDocumentType, req.file.originalname, req.file.mimetype),
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      file_size_bytes: req.file.size,
      storage_path: storagePath,
      file_path: storagePath,
      status: 'Pending',
      rejection_reason: null,
      uploaded_at: nowIso,
      reviewed_at: null
    }

    const optionalPayloadColumns = ['file_size_bytes', 'file_size', 'file_path', 'storage_path']
    const omittedColumns = new Set()

    let saveResult = { error: null }
    for (let attempt = 0; attempt <= optionalPayloadColumns.length; attempt += 1) {
      const payloadVariant = { ...payload }
      for (const columnName of omittedColumns) {
        delete payloadVariant[columnName]
      }

      // eslint-disable-next-line no-await-in-loop
      saveResult = await supabase
        .from('user_verification_documents')
        .upsert([payloadVariant], { onConflict: 'user_id,document_type' })

      if (!saveResult.error) {
        break
      }

      const nextColumn = optionalPayloadColumns.find((columnName) => !omittedColumns.has(columnName) && isMissingSchemaCacheColumnError(saveResult.error, columnName, 'user_verification_documents'))
      if (!nextColumn) {
        break
      }

      omittedColumns.add(nextColumn)
    }

    if (saveResult.error) {
      try {
        await supabase.storage.from(VERIFICATION_DOCS_BUCKET).remove([storagePath])
      } catch (cleanupErr) {
        console.warn('Failed to cleanup uploaded document after fallback upload DB error:', cleanupErr?.message || cleanupErr)
      }
      throw new Error(saveResult.error.message)
    }

    if (existingRow?.storage_path && existingRow.storage_path !== storagePath) {
      try {
        await supabase.storage.from(VERIFICATION_DOCS_BUCKET).remove([existingRow.storage_path])
      } catch (removeErr) {
        console.warn('Failed to remove previous document from storage:', removeErr?.message || removeErr)
      }
    }

    const rows = await getUserVerificationRows(userId)
    const documents = await mapVerificationRowsWithSignedUrls(rows)
    const verificationStatus = computeVerificationStatusFromRows(rows)
    const isVerified = await syncUserVerifiedFromDocumentStatuses(userId)

    return res.status(201).json({
      success: true,
      message: `${getDocumentTypeLabel(normalizedDocumentType)} uploaded successfully`,
      verification_status: verificationStatus,
      user_is_verified: isVerified,
      documents
    })
  } catch (err) {
    const statusCode = err instanceof multer.MulterError || /Only PDF|Only JPG|Only PNG|Maximum file size/.test(String(err?.message || '')) ? 400 : 500
    return res.status(statusCode).json({ error: getUploadErrorMessage(err) })
  }
})

app.post('/api/user/verification-documents/:documentType', requireUserAuth, async (req, res) => {
  const normalizedDocumentType = normalizeDocumentType(req.params.documentType)

  if (!REQUIRED_DOCUMENT_TYPES.includes(normalizedDocumentType)) {
    return res.status(400).json({ error: 'Invalid document type' })
  }

  try {
    await runMulterMiddleware(req, res, verificationDocUpload.single('document'))

    if (!req.file) {
      return res.status(400).json({ error: 'Document file is required' })
    }

    await ensureUserProfileRow(req.user)

    const { data: existingRow, error: existingError } = await supabase
      .from('user_verification_documents')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('document_type', normalizedDocumentType)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    if (existingRow && existingRow.status !== 'Rejected') {
      return res.status(409).json({ error: 'Document is locked. You can re-upload only after admin rejection.' })
    }

    const extension = MIME_EXTENSION_MAP[req.file.mimetype] || 'bin'
    const storagePath = `${req.user.id}/${normalizedDocumentType}/${Date.now()}-${randomUUID()}.${extension}`

    const { error: storageError } = await supabase
      .storage
      .from(VERIFICATION_DOCS_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      })

    if (storageError) {
      throw new Error(storageError.message)
    }

    const nowIso = new Date().toISOString()
    const payload = {
      user_id: req.user.id,
      document_type: normalizedDocumentType,
      file_name: getRenamedDocumentFileName(normalizedDocumentType, req.file.originalname, req.file.mimetype),
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      file_size_bytes: req.file.size,
      storage_path: storagePath,
      file_path: storagePath,
      status: 'Pending',
      rejection_reason: null,
      uploaded_at: nowIso,
      reviewed_at: null
    }

    const optionalPayloadColumns = ['file_size_bytes', 'file_size', 'file_path', 'storage_path']
    const omittedColumns = new Set()

    let saveResult = { error: null }
    for (let attempt = 0; attempt <= optionalPayloadColumns.length; attempt += 1) {
      const payloadVariant = { ...payload }
      for (const columnName of omittedColumns) {
        delete payloadVariant[columnName]
      }

      if (!payloadVariant.storage_path && !payloadVariant.file_path) {
        payloadVariant.storage_path = storagePath
      }

      saveResult = await supabase
        .from('user_verification_documents')
        .upsert([payloadVariant], { onConflict: 'user_id,document_type' })

      if (!saveResult.error) break

      const missingColumn = optionalPayloadColumns.find((columnName) => (
        !omittedColumns.has(columnName)
        && isMissingSchemaCacheColumnError(saveResult.error, columnName, 'user_verification_documents')
      ))

      if (!missingColumn) break
      omittedColumns.add(missingColumn)
    }

    const saveError = saveResult.error

    if (saveError) {
      await supabase.storage.from(VERIFICATION_DOCS_BUCKET).remove([storagePath])
      throw new Error(saveError.message)
    }

    const previousStoragePath = existingRow?.storage_path || existingRow?.file_path || null
    if (previousStoragePath && previousStoragePath !== storagePath) {
      try {
        await supabase.storage.from(VERIFICATION_DOCS_BUCKET).remove([previousStoragePath])
      } catch (removeErr) {
        console.warn('Failed to remove previous rejected document:', removeErr?.message || removeErr)
      }
    }

    const rows = await getUserVerificationRows(req.user.id)
    const documents = await mapVerificationRowsWithSignedUrls(rows)
    const verificationStatus = computeVerificationStatusFromRows(rows)
    const userIsVerified = await syncUserVerifiedFromDocumentStatuses(req.user.id)

    return res.status(201).json({
      success: true,
      message: `${getDocumentTypeLabel(normalizedDocumentType)} uploaded successfully`,
      verification_status: verificationStatus,
      user_is_verified: userIsVerified,
      documents
    })
  } catch (err) {
    const statusCode = err instanceof multer.MulterError || /Only PDF, JPG, and PNG/.test(String(err?.message || '')) ? 400 : 500
    return res.status(statusCode).json({ error: getUploadErrorMessage(err) })
  }
})

app.get('/api/manager/profile', requireManagerAuth, async (req, res) => {
  try {
    const manager = await getManagerById(req.manager.id)
    const profile = await ensureManagerProfileRow(manager)
    const rows = await getManagerVerificationRows(manager.id)
    const documents = await mapManagerVerificationRowsWithUrls(rows)
    const verificationStatus = computeManagerVerificationStatusFromRows(rows)

    if (verificationStatus !== profile?.profile_verification_status) {
      await supabase
        .from('manager_profiles')
        .update({ profile_verification_status: verificationStatus, updated_at: new Date().toISOString() })
        .eq('manager_id', manager.id)
    }

    return res.json({
      manager: {
        id: manager.id,
        full_name: manager.full_name,
        registered_email: manager.email,
        mobile_number: manager.phone || null,
        is_active: Boolean(manager.is_verified),
        account_status: manager.is_verified ? 'active' : 'inactive'
      },
      profile: {
        manager_id: manager.id,
        full_name: profile?.full_name || manager.full_name || '',
        registered_email: profile?.registered_email || manager.email || '',
        personal_email: profile?.personal_email || '',
        personal_email_verified: Boolean(profile?.personal_email_verified),
        profile_details_locked: Boolean(profile?.profile_details_locked),
        mobile_number: profile?.mobile_number || manager.phone || '',
        address_line: profile?.address_line || '',
        pincode: profile?.pincode || '',
        state: profile?.state || '',
        district: profile?.district || '',
        profile_photo_url: profile?.profile_photo_url || null,
        profile_photo_source: profile?.profile_photo_source || null,
        profile_verification_status: verificationStatus
      },
      verification_status: verificationStatus,
      required_documents: MANAGER_REQUIRED_DOCUMENT_TYPES.map((type) => ({
        document_type: type,
        document_name: getManagerDocumentTypeLabel(type),
        optional: MANAGER_OPTIONAL_DOCUMENT_TYPES.has(type)
      })),
      documents
    })
  } catch (err) {
    return res.status(500).json({ error: getManagerProfileSetupErrorMessage(err) })
  }
})

app.put('/api/manager/profile', requireManagerAuth, async (req, res) => {
  try {
    const manager = await getManagerById(req.manager.id)
    const existingProfile = await ensureManagerProfileRow(manager)

    const existingProfileDetailsLocked = Boolean(existingProfile?.profile_details_locked)
    const requestedLockProfileDetails = req.body?.lock_profile_details === true

    const fullName = String(req.body?.full_name || manager.full_name || '').trim()
    const mobileNumber = String(req.body?.mobile_number || '').trim()
    const personalEmail = String(req.body?.personal_email || '').trim().toLowerCase()
    const addressLine = String(req.body?.address_line || '').trim()
    const pincode = String(req.body?.pincode || '').trim()
    const state = String(req.body?.state || '').trim()
    const district = String(req.body?.district || '').trim()

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' })
    }

    if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
      return res.status(400).json({ error: 'Please enter a valid personal email address' })
    }

    if (pincode && !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ error: 'Pincode must be 6 digits' })
    }

    const existingPersonalEmail = String(existingProfile?.personal_email || '').trim().toLowerCase()
    const personalEmailChanged = personalEmail !== String(existingProfile?.personal_email || '').trim().toLowerCase()
    const personalEmailLocked = Boolean(existingProfile?.personal_email_verified) && Boolean(existingPersonalEmail)
    const existingLockedFullName = String(existingProfile?.full_name || manager.full_name || '').trim()
    const existingLockedAddressLine = String(existingProfile?.address_line || '').trim()
    const existingLockedPincode = String(existingProfile?.pincode || '').trim()
    const existingLockedState = String(existingProfile?.state || '').trim()
    const existingLockedDistrict = String(existingProfile?.district || '').trim()

    if (existingProfileDetailsLocked) {
      const hasLockedFieldChanges = fullName !== existingLockedFullName ||
        addressLine !== existingLockedAddressLine ||
        pincode !== existingLockedPincode ||
        state !== existingLockedState ||
        district !== existingLockedDistrict

      if (hasLockedFieldChanges || personalEmailChanged) {
        return res.status(403).json({ error: 'Profile details are locked. Only mobile number can be changed.' })
      }
    }

    if (personalEmailLocked && personalEmailChanged) {
      return res.status(403).json({ error: 'Personal email is already verified and cannot be changed.' })
    }

    const nextFullName = existingProfileDetailsLocked ? (existingLockedFullName || fullName) : fullName
    const nextAddressLine = existingProfileDetailsLocked ? existingLockedAddressLine : addressLine
    const nextPincode = existingProfileDetailsLocked ? existingLockedPincode : pincode
    const nextState = existingProfileDetailsLocked ? existingLockedState : state
    const nextDistrict = existingProfileDetailsLocked ? existingLockedDistrict : district
    const shouldLockProfileDetails = !existingProfileDetailsLocked && personalEmailLocked && requestedLockProfileDetails
    const nextProfileDetailsLocked = existingProfileDetailsLocked || shouldLockProfileDetails

    const { error: managerUpdateError } = await supabase
      .from('managers')
      .update({
        full_name: nextFullName,
        phone: mobileNumber || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', manager.id)

    if (managerUpdateError) {
      throw new Error(managerUpdateError.message)
    }

    const profileUpdatePayload = {
      manager_id: manager.id,
      full_name: nextFullName,
      registered_email: manager.email,
      personal_email: personalEmail || null,
      mobile_number: mobileNumber || null,
      address_line: nextAddressLine || null,
      pincode: nextPincode || null,
      state: nextState || null,
      district: nextDistrict || null,
      profile_details_locked: nextProfileDetailsLocked,
      updated_at: new Date().toISOString()
    }

    if (personalEmailChanged) {
      profileUpdatePayload.personal_email_verified = false
      profileUpdatePayload.personal_email_verification_token_hash = null
      profileUpdatePayload.personal_email_verification_expires_at = null
    }

    const optionalProfileColumns = ['profile_details_locked']
    const omittedProfileColumns = new Set()
    let profileUpdateError = null

    for (let attempt = 0; attempt <= optionalProfileColumns.length; attempt += 1) {
      const payloadVariant = { ...profileUpdatePayload }
      for (const columnName of omittedProfileColumns) {
        delete payloadVariant[columnName]
      }

      const saveResult = await supabase
        .from('manager_profiles')
        .upsert([payloadVariant], { onConflict: 'manager_id' })

      if (!saveResult.error) {
        profileUpdateError = null
        break
      }

      const missingColumn = optionalProfileColumns.find((columnName) => (
        !omittedProfileColumns.has(columnName) &&
        isMissingSchemaCacheColumnError(saveResult.error, columnName, 'manager_profiles')
      ))

      if (missingColumn) {
        omittedProfileColumns.add(missingColumn)
        continue
      }

      profileUpdateError = saveResult.error
      break
    }

    if (profileUpdateError) {
      throw new Error(profileUpdateError.message)
    }

    return res.json({ success: true, profile_details_locked: nextProfileDetailsLocked })
  } catch (err) {
    return res.status(500).json({ error: getManagerProfileSetupErrorMessage(err) })
  }
})

app.post('/api/manager/profile-photo', requireManagerAuth, async (req, res) => {
  try {
    await runMulterMiddleware(req, res, profilePhotoUpload.single('photo'))

    if (!req.file) {
      return res.status(400).json({ error: 'Profile photo file is required' })
    }

    const manager = await getManagerById(req.manager.id)
    const profile = await ensureManagerProfileRow(manager)

    const source = String(req.body?.source || 'camera').trim().toLowerCase()
    const isCameraSource = ['live', 'camera', 'capture', 'live_photo'].includes(source)

    if (!isCameraSource) {
      return res.status(403).json({
        error: 'Only live camera capture is allowed for profile photos. Device upload is disabled.'
      })
    }

    const extension = MIME_EXTENSION_MAP[req.file.mimetype] || 'jpg'
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`

    const saved = writeBufferToUploads(
      `manager-profile-photos/${manager.id}`,
      fileName,
      req.file.buffer
    )

    const { error: updateError } = await supabase
      .from('manager_profiles')
      .update({
        profile_photo_url: saved.publicUrl,
        profile_photo_path: saved.filePath,
        profile_photo_source: 'camera',
        updated_at: new Date().toISOString()
      })
      .eq('manager_id', manager.id)

    if (updateError) {
      removeUploadFileQuiet(saved.filePath)
      throw new Error(updateError.message)
    }

    const previousPath = profile?.profile_photo_path || profile?.profile_photo_url || null
    if (previousPath && previousPath !== saved.filePath && previousPath !== saved.publicUrl) {
      removeUploadFileQuiet(previousPath)
    }

    return res.json({
      success: true,
      profile_photo_url: saved.publicUrl,
      profile_photo_source: 'camera'
    })
  } catch (err) {
    const statusCode = err instanceof multer.MulterError || /Only JPG and PNG/.test(String(err?.message || '')) ? 400 : 500
    if (statusCode === 500) {
      return res.status(500).json({ error: getManagerProfileSetupErrorMessage(err) })
    }
    return res.status(statusCode).json({ error: getUploadErrorMessage(err) })
  }
})

app.get('/api/manager/verification-documents', requireManagerAuth, async (req, res) => {
  try {
    const manager = await getManagerById(req.manager.id)
    const profile = await ensureManagerProfileRow(manager)
    const rows = await getManagerVerificationRows(manager.id)
    const documents = await mapManagerVerificationRowsWithUrls(rows)
    const verificationStatus = computeManagerVerificationStatusFromRows(rows)

    return res.json({
      manager_id: manager.id,
      verification_status: verificationStatus,
      required_documents: MANAGER_REQUIRED_DOCUMENT_TYPES.map((type) => ({
        document_type: type,
        document_name: getManagerDocumentTypeLabel(type),
        optional: MANAGER_OPTIONAL_DOCUMENT_TYPES.has(type)
      })),
      documents
    })
  } catch (err) {
    return res.status(500).json({ error: getManagerProfileSetupErrorMessage(err) })
  }
})

app.post('/api/manager/verification-documents/:documentType', requireManagerAuth, async (req, res) => {
  const normalizedDocumentType = normalizeManagerDocumentType(req.params.documentType)

  if (!MANAGER_REQUIRED_DOCUMENT_TYPES.includes(normalizedDocumentType)) {
    return res.status(400).json({ error: 'Invalid document type' })
  }

  try {
    await runMulterMiddleware(req, res, verificationDocUpload.single('document'))

    if (!req.file) {
      return res.status(400).json({ error: 'Document file is required' })
    }

    const manager = await getManagerById(req.manager.id)
    await ensureManagerProfileRow(manager)

    const { data: existingRow, error: existingError } = await supabase
      .from('manager_verification_documents')
      .select('*')
      .eq('manager_id', manager.id)
      .eq('document_type', normalizedDocumentType)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    if (existingRow && existingRow.status !== 'Rejected') {
      return res.status(409).json({ error: 'Document is locked. You can re-upload only after admin rejection.' })
    }

    const extension = MIME_EXTENSION_MAP[req.file.mimetype] || 'bin'
    const storagePath = `manager-${manager.id}/${normalizedDocumentType}/${Date.now()}-${randomUUID()}.${extension}`

    const { error: storageError } = await supabase
      .storage
      .from(VERIFICATION_DOCS_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      })

    if (storageError) {
      throw new Error(storageError.message)
    }

    const payload = {
      manager_id: manager.id,
      document_type: normalizedDocumentType,
      file_name: getRenamedDocumentFileName(normalizedDocumentType, req.file.originalname, req.file.mimetype),
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      file_size_bytes: req.file.size,
      file_path: storagePath,
      file_url: null,
      status: 'Pending',
      rejection_reason: null,
      uploaded_at: new Date().toISOString(),
      reviewed_at: null
    }

    const { error: saveError } = await supabase
      .from('manager_verification_documents')
      .upsert([payload], { onConflict: 'manager_id,document_type' })

    if (saveError) {
      await supabase.storage.from(VERIFICATION_DOCS_BUCKET).remove([storagePath]).catch(() => {})
      throw new Error(saveError.message)
    }

    const previousFile = existingRow?.file_path || existingRow?.file_url || null
    if (previousFile && previousFile !== storagePath) {
      if (!previousFile.startsWith('uploads/')) {
        await supabase.storage.from(VERIFICATION_DOCS_BUCKET).remove([previousFile]).catch(() => {})
      } else {
        removeUploadFileQuiet(previousFile)
      }
    }

    const verificationStatus = await syncManagerProfileVerificationStatus(manager.id)
    const rows = await getManagerVerificationRows(manager.id)
    const documents = await mapManagerVerificationRowsWithUrls(rows)

    return res.status(201).json({
      success: true,
      message: `${getManagerDocumentTypeLabel(normalizedDocumentType)} uploaded successfully`,
      verification_status: verificationStatus,
      documents
    })
  } catch (err) {
    const statusCode = err instanceof multer.MulterError || /Only PDF, JPG, and PNG/.test(String(err?.message || '')) ? 400 : 500
    if (statusCode === 500) {
      return res.status(500).json({ error: getManagerProfileSetupErrorMessage(err) })
    }
    return res.status(statusCode).json({ error: getUploadErrorMessage(err) })
  }
})

app.post('/api/manager/personal-email/send-verification', requireManagerAuth, async (req, res) => {
  try {
    const manager = await getManagerById(req.manager.id)
    const profile = await ensureManagerProfileRow(manager)
    const requestedPersonalEmail = String(req.body?.personal_email || '').trim().toLowerCase()
    const personalEmail = requestedPersonalEmail || String(profile?.personal_email || '').trim().toLowerCase()
    const existingPersonalEmail = String(profile?.personal_email || '').trim().toLowerCase()
    const personalEmailLocked = Boolean(profile?.personal_email_verified) && Boolean(existingPersonalEmail)

    if (!personalEmail) {
      return res.status(400).json({ error: 'Please add a personal email address before requesting verification.' })
    }

    if (!/^[^\s@]+@gmail\.com$/i.test(personalEmail)) {
      return res.status(400).json({ error: 'Personal email must be a Google account (gmail.com).' })
    }

    if (personalEmailLocked) {
      if (personalEmail !== existingPersonalEmail) {
        return res.status(403).json({ error: 'Personal email is already verified and cannot be changed.' })
      }
      return res.status(400).json({ error: 'Personal email is already verified.' })
    }

    const transporter = ensureTransporter()
    if (!transporter) {
      return res.status(503).json({ error: 'Email service is not configured. Please contact admin.' })
    }

    const rawToken = generateSecureToken()
    const tokenHash = hashSecureToken(rawToken)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { error: updateError } = await supabase
      .from('manager_profiles')
      .update({
        personal_email: personalEmail,
        personal_email_verified: false,
        personal_email_verification_token_hash: tokenHash,
        personal_email_verification_expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('manager_id', manager.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173'
    const verifyLink = `${frontendBase}/manager-personal-email-verify?token=${encodeURIComponent(rawToken)}`

    await transporter.sendMail({
      from: `\"ASHIRWAD ENTERPRISES\" <${process.env.Email_User}>`,
      to: personalEmail,
      subject: 'Verify Your Manager Personal Email',
      html: `
        <div style=\"font-family:Arial,sans-serif;color:#0f172a;padding:16px\">
          <h2 style=\"margin:0 0 12px;color:#0b5fff\">Manager Personal Email Verification</h2>
          <p>Hello ${manager.full_name || 'Manager'},</p>
          <p>Click the button below to verify your personal email. This link is valid for 24 hours.</p>
          <p style=\"margin:16px 0\"><a href=\"${verifyLink}\" style=\"background:#0b5fff;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block\">Verify Personal Email</a></p>
          <p>If the button does not work, copy this link:</p>
          <p><a href=\"${verifyLink}\">${verifyLink}</a></p>
        </div>
      `
    })

    return res.json({ success: true, message: 'Verification email sent to your personal email.' })
  } catch (err) {
    return res.status(500).json({ error: getManagerProfileSetupErrorMessage(err) || 'Failed to send verification email' })
  }
})

app.get('/api/manager/personal-email/verify', async (req, res) => {
  try {
    const rawToken = String(req.query?.token || '').trim()
    if (!rawToken) {
      return res.status(400).json({ error: 'Verification token is required' })
    }

    const tokenHash = hashSecureToken(rawToken)

    const { data: profile, error: profileError } = await supabase
      .from('manager_profiles')
      .select('manager_id, personal_email, personal_email_verification_expires_at')
      .eq('personal_email_verification_token_hash', tokenHash)
      .maybeSingle()

    if (profileError) {
      throw new Error(profileError.message)
    }

    if (!profile) {
      return res.status(400).json({ error: 'Invalid verification token' })
    }

    const expiresAt = new Date(profile.personal_email_verification_expires_at || 0)
    if (!profile.personal_email_verification_expires_at || Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired' })
    }

    const { error: updateError } = await supabase
      .from('manager_profiles')
      .update({
        personal_email_verified: true,
        personal_email_verification_token_hash: null,
        personal_email_verification_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('manager_id', profile.manager_id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return res.json({ success: true, message: 'Personal email verified successfully.' })
  } catch (err) {
    return res.status(500).json({ error: getManagerProfileSetupErrorMessage(err) || 'Failed to verify personal email' })
  }
})

app.post('/api/manager/password-reset/request-auth', requireManagerAuth, async (req, res) => {
  try {
    const manager = await getManagerById(req.manager.id)
    const profile = await ensureManagerProfileRow(manager)

    const destinationEmail = String(profile?.personal_email || '').trim().toLowerCase()
    if (!destinationEmail) {
      return res.status(400).json({ error: 'Please add a personal email before requesting password reset.' })
    }

    if (!profile?.personal_email_verified) {
      return res.status(403).json({ error: 'Personal email must be verified before requesting password reset.' })
    }

    const transporter = ensureTransporter()
    if (!transporter) {
      return res.status(503).json({ error: 'Email service is not configured. Please contact admin.' })
    }

    const rawToken = generateSecureToken()
    const tokenHash = hashSecureToken(rawToken)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    await supabase
      .from('manager_password_reset_tokens')
      .delete()
      .eq('manager_id', manager.id)
      .is('used_at', null)

    const { error: insertError } = await supabase
      .from('manager_password_reset_tokens')
      .insert([{
        manager_id: manager.id,
        token_hash: tokenHash,
        expires_at: expiresAt
      }])

    if (insertError) {
      throw new Error(insertError.message)
    }

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173'
    const resetLink = `${frontendBase}/manager-password-reset?token=${encodeURIComponent(rawToken)}`

    await transporter.sendMail({
      from: `\"ASHIRWAD ENTERPRISES\" <${process.env.Email_User}>`,
      to: destinationEmail,
      subject: 'Manager Password Reset Link',
      html: `
        <div style=\"font-family:Arial,sans-serif;color:#0f172a;padding:16px\">
          <h2 style=\"margin:0 0 12px;color:#0b5fff\">Manager Password Reset</h2>
          <p>Hello ${manager.full_name || 'Manager'},</p>
          <p>Click below to reset your manager password. This link expires in 30 minutes.</p>
          <p style=\"margin:16px 0\"><a href=\"${resetLink}\" style=\"background:#0b5fff;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block\">Reset Password</a></p>
          <p>If the button does not work, copy this link:</p>
          <p><a href=\"${resetLink}\">${resetLink}</a></p>
        </div>
      `
    })

    return res.json({ success: true, message: 'Password reset link sent to your personal email.' })
  } catch (err) {
    return res.status(500).json({ error: getManagerProfileSetupErrorMessage(err) || 'Failed to send password reset link' })
  }
})

app.post('/api/manager/password-reset/complete', async (req, res) => {
  try {
    const rawToken = String(req.body?.token || '').trim()
    const password = String(req.body?.password || '')

    if (!rawToken || !password) {
      return res.status(400).json({ error: 'Token and password are required' })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' })
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must include at least one letter and one number.' })
    }

    const tokenHash = hashSecureToken(rawToken)

    const { data: resetRow, error: resetError } = await supabase
      .from('manager_password_reset_tokens')
      .select('id, manager_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (resetError) {
      throw new Error(resetError.message)
    }

    if (!resetRow || resetRow.used_at) {
      return res.status(400).json({ error: 'Invalid reset token.' })
    }

    const expiresAt = new Date(resetRow.expires_at || 0)
    if (!resetRow.expires_at || Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const { error: managerUpdateError } = await supabase
      .from('managers')
      .update({ password_hash: hashedPassword, updated_at: new Date().toISOString() })
      .eq('id', resetRow.manager_id)

    if (managerUpdateError) {
      throw new Error(managerUpdateError.message)
    }

    const { error: tokenUpdateError } = await supabase
      .from('manager_password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetRow.id)

    if (tokenUpdateError) {
      throw new Error(tokenUpdateError.message)
    }

    return res.json({ success: true, message: 'Manager password updated successfully.' })
  } catch (err) {
    return res.status(500).json({ error: getManagerProfileSetupErrorMessage(err) || 'Failed to reset manager password' })
  }
})

// Admin endpoints
// Manager approves user
// Manager approves order
app.patch('/api/manager/orders/:orderId/approve', requireManagerAuth, async (req, res) => {
  try {
    const baseExistingOrderSelect = 'id, user_id, status, total_amount, payment_method, delivery_partner_id, shipping_fee'
    const pickupAwareExistingOrderSelect = `${baseExistingOrderSelect}, shipping_method, pickup_order`

    let { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select(pickupAwareExistingOrderSelect)
      .eq('id', req.params.orderId)
      .maybeSingle()

    if (existingOrderError && isMissingSchemaReferenceError(existingOrderError)) {
      const fallbackResult = await supabase
        .from('orders')
        .select(baseExistingOrderSelect)
        .eq('id', req.params.orderId)
        .maybeSingle()
      existingOrder = fallbackResult.data
      existingOrderError = fallbackResult.error
    }

    if (existingOrderError) throw existingOrderError
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' })
    }

    if (isPickupOrderRecord(existingOrder)) {
      return res.status(400).json({ error: 'Pickup orders must be approved by admin with warehouse assignment.' })
    }

    const wasApproved = String(existingOrder.status || '').trim() === 'Approved'

    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'Approved', approved_by_manager_id: req.manager.id })
      .eq('id', req.params.orderId)
      .select();
    if (error) throw error;

    const approvedOrder = Array.isArray(data) ? data[0] : data
    if (!wasApproved && approvedOrder) {
      await notifyUserOrderApproved(approvedOrder)
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.patch('/api/manager/users/:userId/verify', requireManagerAuth, async (req, res) => {
  try {
    const { is_verified } = req.body;
    const userId = req.params.userId;
    if (typeof is_verified !== 'boolean') {
      return res.status(400).json({ error: 'is_verified must be boolean' });
    }
    const { data, error } = await supabase
      .from('users')
      .update({ is_verified, approved_by_manager_id: req.manager.id })
      .eq('id', userId)
      .select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Manager endpoints
// Manager: Assign delivery partner to order
app.patch('/api/manager/orders/:orderId/assign', requireManagerAuth, async (req, res) => {
  try {
    const { delivery_partner_id } = req.body;
    if (!delivery_partner_id) {
      return res.status(400).json({ error: 'delivery_partner_id is required' });
    }

    const baseOrderSelect = 'id, status, shipping_fee'
    const pickupAwareOrderSelect = `${baseOrderSelect}, shipping_method, pickup_order`

    let { data: orderRecord, error: orderLookupError } = await supabase
      .from('orders')
      .select(pickupAwareOrderSelect)
      .eq('id', req.params.orderId)
      .maybeSingle()

    if (orderLookupError && isMissingSchemaReferenceError(orderLookupError)) {
      const fallbackResult = await supabase
        .from('orders')
        .select(baseOrderSelect)
        .eq('id', req.params.orderId)
        .maybeSingle()
      orderRecord = fallbackResult.data
      orderLookupError = fallbackResult.error
    }

    if (orderLookupError) throw orderLookupError
    if (!orderRecord) {
      return res.status(404).json({ error: 'Order not found' })
    }

    if (orderRecord.status !== 'Approved') {
      return res.status(400).json({ error: 'Order must be Approved before assigning a delivery partner' })
    }

    if (isPickupOrderRecord(orderRecord)) {
      return res.status(400).json({ error: 'Pickup orders do not require delivery partner assignment.' })
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ delivery_partner_id })
      .eq('id', req.params.orderId)
      .select();
    if (error) throw error;

    // Send notification to user about delivery partner assignment
    try {
      const { data: fullOrder } = await supabase
        .from('orders')
        .select('id, user_id, total_amount, payment_method')
        .eq('id', req.params.orderId)
        .single()
      if (fullOrder) {
        await notifyUserDeliveryPartnerAssigned(fullOrder, delivery_partner_id)
      }
    } catch (notifErr) {
      console.warn('Failed to send assignment notification:', notifErr?.message)
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Manager: Get all delivery partners
app.get('/api/manager/delivery-partners', requireManagerAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('delivery_partners')
      .select('id, delivery_partner_id, name, assigned_area, status, email')
      .order('name', { ascending: true })
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
});
// Manager: Get all warehouses (read-only, for settlement purposes)
app.get('/api/manager/warehouses', requireManagerAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('id, name, address, contact_number')
      .order('name', { ascending: true })
    if (error) throw error
    res.json(Array.isArray(data) ? data : [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Manager: Get all products
app.get('/api/manager/products', requireManagerAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true })
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
});

// Manager: Get all users (filtered by assigned sections)
app.get('/api/manager/users', requireManagerAuth, async (req, res) => {
  try {
    // Example: filter users by section if you have a section field in users table
    // Adjust this logic as per your schema
    let query = supabase
      .from('users')
      .select('*, approving_manager:approved_by_manager_id(full_name,email)')
      .order('created_at', { ascending: false });
    // If you want to filter users by section, uncomment and adjust below:
    // if (req.managerPermissions.length > 0) {
    //   query = query.in('section', req.managerPermissions);
    // }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Manager: Add product
app.post('/api/manager/products', requireManagerAuth, async (req, res) => {
  try {
    const { name, category, price, stock, description } = req.body
    if (!name || !category || price == null || stock == null) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const { data, error } = await supabase
      .from('products')
      .insert([{ name, category, price, stock, description, is_active: true }])
      .select()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Manager: Edit product (name, category, price, stock, description)
app.put('/api/manager/products/:id', requireManagerAuth, async (req, res) => {
  try {
    const { name, category, price, stock, description } = req.body

    // Fetch previous stock before update
    const { data: existing } = await supabase
      .from('products')
      .select('stock, name, description')
      .eq('id', req.params.id)
      .single()
    const previousStock = existing ? Number(existing.stock || 0) : null

    const { data, error } = await supabase
      .from('products')
      .update({ name, category, price, stock, description })
      .eq('id', req.params.id)
      .select()
    if (error) throw error

    // Send stock notification if stock changed
    const newStock = Number(stock)
    if (previousStock !== null && !isNaN(newStock) && previousStock !== newStock) {
      const productName = name || existing?.name || 'Unknown Product'
      const productDesc = description || existing?.description || ''
      notifyAllUsersStockUpdate(productName, productDesc, previousStock, newStock)
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
app.get('/api/manager/orders', requireManagerAuth, async (req, res) => {
  try {
    const baseOrderSelect = `
      id,
      status,
      delivery_status,
      created_at,
      user_id,
      items,
      total_amount,
      payment_method,
      delivery_partner_id,
      shipping_fee,
      subtotal,
      discount_total,
      coupon_discount,
      Slab_discount,
      offer_discount,
      gst_amount,
      coupon_code,
      offer_id,
      users(full_name,email,profile_photo_url)
    `
    const pickupAwareOrderSelect = `${baseOrderSelect}, shipping_method, pickup_order, pickup_available_from, pickup_available_until, pickup_warehouse_id`

    let query = supabase
      .from('orders')
      .select(pickupAwareOrderSelect)
      .order('created_at', { ascending: false });

    let { data, error } = await query;
    if (error && isMissingSchemaReferenceError(error)) {
      query = supabase
        .from('orders')
        .select(baseOrderSelect)
        .order('created_at', { ascending: false });
      const fallbackResult = await query
      data = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) throw error;
    // ...existing code for enrichment...
    const partnerIds = [...new Set((data || []).map((order) => order.delivery_partner_id).filter(Boolean))];
    let partnerMap = new Map();
    if (partnerIds.length > 0) {
      const { data: partners, error: partnerError } = await supabase
        .from('delivery_partners')
        .select('id, delivery_partner_id, name, assigned_area, status')
        .in('id', partnerIds);
      if (!partnerError && Array.isArray(partners)) {
        for (const partner of partners) {
          partnerMap.set(partner.id, partner);
        }
      }
    }
    const allItems = (data || []).flatMap(order => Array.isArray(order.items) ? order.items : []);
    const allProductIds = [...new Set(allItems.map(item => item.product_id).filter(Boolean))];
    let productNameMap = new Map();
    if (allProductIds.length > 0) {
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name')
        .in('id', allProductIds);
      if (!prodError && Array.isArray(products)) {
        for (const p of products) {
          productNameMap.set(p.id, p.name);
        }
      }
    }
    const pickupWarehouseIds = [...new Set((data || []).map((order) => order.pickup_warehouse_id).filter(Boolean))]
    const warehouseMap = new Map()

    if (pickupWarehouseIds.length > 0) {
      const { data: warehouses, error: warehouseError } = await supabase
        .from('warehouses')
        .select('id,name,address,contact_number')
        .in('id', pickupWarehouseIds)

      if (warehouseError) {
        if (!isMissingSchemaReferenceError(warehouseError, 'warehouses')) {
          console.warn('Failed to fetch pickup warehouses for manager orders:', warehouseError?.message || warehouseError)
        }
      } else {
        for (const warehouse of warehouses || []) {
          warehouseMap.set(warehouse.id, warehouse)
        }
      }
    }

    const enriched = (data || []).map((order) => {
      const normalizedShippingMethod = normalizeShippingMethod(
        order?.shipping_method,
        Number(order?.shipping_fee || 0) > 0 ? 'express' : 'standard'
      )

      return {
        ...order,
        shipping_method: normalizedShippingMethod,
        pickup_order: Boolean(order?.pickup_order) || normalizedShippingMethod === 'pickup_drive',
        pickup_warehouse: order?.pickup_warehouse_id ? (warehouseMap.get(order.pickup_warehouse_id) || null) : null,
        items: Array.isArray(order.items)
          ? order.items.map(item => ({
              ...item,
              name: item.name || productNameMap.get(item.product_id) || `ID ${item.product_id}`
            }))
          : order.items,
        delivery_partner: partnerMap.get(order.delivery_partner_id) || null
      }
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// --- Manager Management Endpoints (Admin Only) ---
// List all managers
app.get('/api/admin/managers', requireAdminKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('managers')
      .select('id, email, full_name, phone, is_verified, created_at, base_salary, payroll_schedule')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const managerIds = Array.isArray(data) ? data.map((manager) => manager.id).filter(Boolean) : [];
    const permissionsMap = new Map();
    const photoMap = new Map();

    if (managerIds.length > 0) {
      const [permsResult, profilesResult] = await Promise.all([
        supabase.from('manager_permissions').select('manager_id, section, can_access').in('manager_id', managerIds),
        supabase.from('manager_profiles').select('manager_id, profile_photo_url, profile_photo_path').in('manager_id', managerIds)
      ]);

      if (permsResult.error) throw permsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      for (const row of permsResult.data || []) {
        if (!row?.manager_id || !row?.can_access) continue;
        const section = String(row.section || '').trim().toLowerCase();
        if (!MANAGER_PERMISSION_SECTIONS.includes(section)) continue;
        const existing = permissionsMap.get(row.manager_id) || [];
        if (!existing.includes(section)) {
          permissionsMap.set(row.manager_id, [...existing, section]);
        }
      }

      for (const [managerId, sections] of permissionsMap.entries()) {
        const ordered = MANAGER_PERMISSION_SECTIONS.filter((section) => sections.includes(section));
        permissionsMap.set(managerId, ordered);
      }

      for (const row of profilesResult.data || []) {
        const photo = row?.profile_photo_url || row?.profile_photo_path || null;
        if (row?.manager_id && photo) {
          photoMap.set(row.manager_id, photo);
        }
      }
    }

    const enrichedManagers = (data || []).map((manager) => ({
      ...manager,
      profile_photo_url: photoMap.get(manager.id) || null,
      permissions: permissionsMap.get(manager.id) || []
    }));

    res.json(enrichedManagers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a manager and all their permissions
app.delete('/api/admin/managers/:managerId', requireAdminKey, async (req, res) => {
  try {
    const managerId = req.params.managerId;
    // Delete permissions first
    await supabase.from('manager_permissions').delete().eq('manager_id', managerId);
    // Delete manager
    const { error } = await supabase.from('managers').delete().eq('id', managerId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activate/deactivate a manager
app.patch('/api/admin/managers/:managerId/activate', requireAdminKey, async (req, res) => {
  try {
    const managerId = req.params.managerId;
    const { is_verified } = req.body;
    if (typeof is_verified !== 'boolean') {
      return res.status(400).json({ error: 'is_verified must be boolean' });
    }
    const { data, error } = await supabase
      .from('managers')
      .update({ is_verified })
      .eq('id', managerId)
      .select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update assigned manager sections (roles/permissions)
app.patch('/api/admin/managers/:managerId/sections', requireAdminKey, async (req, res) => {
  try {
    const managerId = String(req.params.managerId || '').trim();
    const sectionsInput = req.body?.sections;

    if (!managerId) {
      return res.status(400).json({ error: 'managerId is required' });
    }

    if (!Array.isArray(sectionsInput)) {
      return res.status(400).json({ error: 'sections must be an array' });
    }

    const normalizedSections = [...new Set(
      sectionsInput
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean)
    )];

    const invalidSections = normalizedSections.filter((section) => !MANAGER_PERMISSION_SECTIONS.includes(section));
    if (invalidSections.length > 0) {
      return res.status(400).json({ error: `Invalid section(s): ${invalidSections.join(', ')}` });
    }

    const { data: managerRow, error: managerError } = await supabase
      .from('managers')
      .select('id')
      .eq('id', managerId)
      .maybeSingle();

    if (managerError) throw managerError;
    if (!managerRow) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    const { error: deleteError } = await supabase
      .from('manager_permissions')
      .delete()
      .eq('manager_id', managerId);

    if (deleteError) throw deleteError;

    if (normalizedSections.length > 0) {
      const permissionRows = normalizedSections.map((section) => ({
        manager_id: managerId,
        section,
        can_access: true
      }));

      const { error: insertError } = await supabase
        .from('manager_permissions')
        .insert(permissionRows);

      if (insertError) throw insertError;
    }

    return res.json({ success: true, permissions: normalizedSections });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
// --- Manager Account Creation (Admin Only) ---
app.post('/api/admin/create-manager', requireAdminKey, async (req, res) => {
  try {
    const { full_name, email, phone, password, sections } = req.body
    if (!full_name || !email || !password || !Array.isArray(sections)) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const normalizedSections = [...new Set(
      sections
        .map(section => String(section || '').trim().toLowerCase())
        .filter(Boolean)
    )]

    const invalidSections = normalizedSections.filter((section) => !MANAGER_PERMISSION_SECTIONS.includes(section))
    if (invalidSections.length > 0) {
      return res.status(400).json({ error: `Invalid section(s): ${invalidSections.join(', ')}` })
    }

    // Check if email already exists in managers
    const { data: existing, error: existErr } = await supabase
      .from('managers')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()
    if (existErr) throw existErr
    if (existing) return res.status(409).json({ error: 'Manager email already exists' })
    // Hash password before storing
    const password_hash = await bcrypt.hash(password, 10)
    // Create manager in managers table
    const { data: managerData, error: managerErr } = await supabase
      .from('managers')
      .insert([{
        email: email.trim().toLowerCase(),
        full_name: full_name.trim(),
        phone: phone || null,
        password_hash,
        is_verified: true
      }])
      .select('*')
      .single()
    if (managerErr) throw managerErr
    // Store section permissions
    const perms = normalizedSections.map(section => ({ manager_id: managerData.id, section, can_access: true }))
    if (perms.length > 0) {
      const { error: permErr } = await supabase
        .from('manager_permissions')
        .insert(perms)
      if (permErr) {
        console.error('[Manager Permissions Insert Error]', permErr)
        return res.status(500).json({ error: 'Failed to store manager permissions', details: permErr.message })
      }
    }
    res.status(201).json({ success: true, manager: managerData })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Manager Login ---
function looksLikeBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$/.test(String(value || ''))
}

async function verifyManagerPasswordFromDb(managerId, storedPasswordHash, enteredPassword) {
  const stored = String(storedPasswordHash || '')
  const entered = String(enteredPassword ?? '')
  if (!stored) return false

  // Primary path: verify bcrypt-hashed manager password from DB.
  try {
    if (await bcrypt.compare(entered, stored)) {
      return true
    }
  } catch (_) {
    // Ignore malformed legacy values and try the compatibility branch below.
  }

  // Compatibility for legacy rows where password_hash may still contain plain text.
  if (!looksLikeBcryptHash(stored) && entered === stored) {
    try {
      const migratedHash = await bcrypt.hash(entered, 10)
      await supabase
        .from('managers')
        .update({ password_hash: migratedHash, updated_at: new Date().toISOString() })
        .eq('id', managerId)
    } catch (_) {
      // Do not block auth if migration fails; keep behavior backward compatible.
    }
    return true
  }

  return false
}

app.post('/api/manager/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    console.log('[Manager Login] Checking email:', email.trim().toLowerCase())
    const { data: manager, error: managerErr } = await supabase
      .from('managers')
      .select('id, email, full_name, phone, is_verified, password_hash')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()
    if (managerErr) throw managerErr
    if (!manager) return res.status(404).json({ error: 'Manager not found' })

    // Validate against password data stored in managers table.
    const valid = await verifyManagerPasswordFromDb(manager.id, manager.password_hash, password)
    if (!valid) return res.status(401).json({ error: 'Invalid password' })

    const { data: profile } = await supabase
      .from('manager_profiles')
      .select('profile_verification_status, personal_email_verified')
      .eq('manager_id', manager.id)
      .maybeSingle()

    // Fetch section permissions
    const { data: perms, error: permsErr } = await supabase
      .from('manager_permissions')
      .select('section, can_access')
      .eq('manager_id', manager.id)
    if (permsErr) throw permsErr

    const { password_hash, ...safeManager } = manager

    // Issue token (for demo, just manager id; use JWT in production)
    const token = manager.id
    res.json({
      token,
      manager: {
        ...safeManager,
        is_active: Boolean(manager.is_verified),
        account_status: manager.is_verified ? 'active' : 'inactive',
        profile_verification_status: profile?.profile_verification_status || 'Pending Verification',
        personal_email_verified: Boolean(profile?.personal_email_verified),
        permissions: perms.filter(p => p.can_access).map(p => p.section)
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/manager/verify-password', requireManagerAuth, async (req, res) => {
  try {
    const password = String(req.body?.password ?? '')
    if (password.length === 0) {
      return res.status(400).json({ error: 'Manager password is required' })
    }

    const { data: manager, error: managerErr } = await supabase
      .from('managers')
      .select('id, password_hash')
      .eq('id', req.manager.id)
      .maybeSingle()

    if (managerErr) {
      return res.status(500).json({ error: managerErr.message })
    }

    if (!manager || !manager.password_hash) {
      return res.status(404).json({ error: 'Manager password record not found' })
    }

    const valid = await verifyManagerPasswordFromDb(manager.id, manager.password_hash, password)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid manager password' })
    }

    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})


// Admin endpoints
app.get('/api/admin/products', requireAdminKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true })
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/admin/products', requireAdminKey, productUpload.single('image'), async (req, res) => {
  try {
    const { name, category, price, stock, description } = req.body;
    let image_url = req.body.image_url || null;
    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
    }
    // Log what we received
    console.log('📦 Creating product:', { name, category, price, stock });
    console.log('📸 Image URL received:', image_url ? image_url : 'No');
    const { data, error } = await supabase
      .from('products')
      .insert([{ name, category, price, stock, description, image_url, is_active: true }])
      .select();
    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }
    // Verify what was saved
    console.log('✅ Product created with ID:', data[0]?.id);
    console.log('✅ Image URL saved:', data[0]?.image_url ? 'Yes' : 'No');
    res.status(201).json(data);
  } catch (err) {
    console.error('❌ Error creating product:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/products/:id', requireAdminKey, productUpload.single('image'), async (req, res) => {
  try {
    const { name, category, price, stock, description } = req.body;
    let image_url = req.body.image_url || null;
    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
    }

    // Fetch previous stock before update
    const { data: existing } = await supabase
      .from('products')
      .select('stock, name, description')
      .eq('id', req.params.id)
      .single()
    const previousStock = existing ? Number(existing.stock || 0) : null

    // Log what we received
    console.log('📦 Updating product ID:', req.params.id);
    console.log('📸 Image URL received:', image_url ? image_url : 'No');
    const { data, error } = await supabase
      .from('products')
      .update({ name, category, price, stock, description, image_url })
      .eq('id', req.params.id)
      .select();
    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }
    // Verify what was saved
    console.log('✅ Product updated');
    console.log('✅ Image URL saved:', data[0]?.image_url ? 'Yes' : 'No');

    // Send stock notification if stock changed
    const newStock = Number(stock)
    if (previousStock !== null && !isNaN(newStock) && previousStock !== newStock) {
      const productName = name || existing?.name || 'Unknown Product'
      const productDesc = description || existing?.description || ''
      notifyAllUsersStockUpdate(productName, productDesc, previousStock, newStock)
    }

    res.json(data);
  } catch (err) {
    console.error('❌ Error updating product:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/products/:id', requireAdminKey, async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Image proxy – fetches an external image server-side (no browser CORS restrictions)
app.get('/api/admin/proxy-image', requireAdminKey, async (req, res) => {
  try {
    const imageUrl = String(req.query.url || '').trim()
    if (!imageUrl) {
      return res.status(400).json({ error: 'url query parameter is required' })
    }
    // Only allow http/https to prevent SSRF via file:// or other schemes
    if (!/^https?:\/\//i.test(imageUrl)) {
      return res.status(400).json({ error: 'Only http/https URLs are allowed' })
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PepsiCo-Admin/1.0)',
        'Accept': 'image/*,*/*;q=0.8'
      }
    })

    if (!response.ok) {
      return res.status(502).json({ error: `Remote server returned ${response.status}` })
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return res.status(422).json({ error: 'URL does not point to an image' })
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400')

    const buffer = await response.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to proxy image' })
  }
})

app.get('/api/admin/users', requireAdminKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`*, approving_manager:approved_by_manager_id(full_name,email)`) // include approving manager
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/admin/users/:userId/verification-documents', requireAdminKey, async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim()
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, profile_photo_url, is_verified, created_at')
      .eq('id', userId)
      .maybeSingle()

    if (userError) {
      throw new Error(userError.message)
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const rows = await getUserVerificationRows(userId)
    const documents = await mapVerificationRowsWithSignedUrls(rows, 3600)
    const verificationStatus = computeVerificationStatusFromRows(rows)

    return res.json({
      user,
      verification_status: verificationStatus,
      required_documents: REQUIRED_DOCUMENT_TYPES.map((type) => ({
        document_type: type,
        document_name: getDocumentTypeLabel(type)
      })),
      documents
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.patch('/api/admin/users/:userId/verification-documents/:documentType/status', requireAdminKey, async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim()
    const normalizedDocumentType = normalizeDocumentType(req.params.documentType)
    const requestedStatus = String(req.body?.status || '').trim()
    const rejectionReason = String(req.body?.rejection_reason || '').trim()

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    if (!REQUIRED_DOCUMENT_TYPES.includes(normalizedDocumentType)) {
      return res.status(400).json({ error: 'Invalid document type' })
    }

    if (requestedStatus !== 'Approved' && requestedStatus !== 'Rejected') {
      return res.status(400).json({ error: 'status must be Approved or Rejected' })
    }

    if (requestedStatus === 'Rejected' && !rejectionReason) {
      return res.status(400).json({ error: 'rejection_reason is required when rejecting a document' })
    }

    const { data: existingRow, error: existingError } = await supabase
      .from('user_verification_documents')
      .select('*')
      .eq('user_id', userId)
      .eq('document_type', normalizedDocumentType)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    if (!existingRow) {
      return res.status(404).json({ error: 'Document not found for this user' })
    }

    const { error: updateError } = await supabase
      .from('user_verification_documents')
      .update({
        status: requestedStatus,
        rejection_reason: requestedStatus === 'Rejected' ? rejectionReason : null,
        reviewed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('document_type', normalizedDocumentType)

    if (updateError) {
      throw new Error(updateError.message)
    }

    const userIsVerified = await syncUserVerifiedFromDocumentStatuses(userId)

    try {
      const documentLabel = getDocumentTypeLabel(normalizedDocumentType)
      const notificationMessage = requestedStatus === 'Approved'
        ? `${documentLabel} has been approved by admin.`
        : `${documentLabel} was rejected by admin.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`

      await supabase
        .from('notifications')
        .insert([{ user_id: userId, message: notificationMessage }])
    } catch (notificationErr) {
      console.warn('Failed to insert document review notification:', notificationErr?.message || notificationErr)
    }

    const rows = await getUserVerificationRows(userId)
    const documents = await mapVerificationRowsWithSignedUrls(rows, 3600)
    const verificationStatus = computeVerificationStatusFromRows(rows)

    return res.json({
      success: true,
      user_is_verified: userIsVerified,
      verification_status: verificationStatus,
      documents
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/api/admin/managers/:managerId/verification-documents', requireAdminKey, async (req, res) => {
  try {
    const managerId = String(req.params.managerId || '').trim()
    if (!managerId) {
      return res.status(400).json({ error: 'managerId is required' })
    }

    const manager = await getManagerById(managerId)
    const profile = await ensureManagerProfileRow(manager)
    const rows = await getManagerVerificationRows(managerId)
    const documents = await mapManagerVerificationRowsWithUrls(rows)
    const verificationStatus = computeManagerVerificationStatusFromRows(rows)

    return res.json({
      manager: {
        id: manager.id,
        email: manager.email,
        full_name: manager.full_name,
        phone: manager.phone,
        is_active: Boolean(manager.is_verified),
        account_status: manager.is_verified ? 'active' : 'inactive'
      },
      profile: {
        personal_email: profile?.personal_email || null,
        personal_email_verified: Boolean(profile?.personal_email_verified),
        profile_photo_url: profile?.profile_photo_url || profile?.profile_photo_path || null,
        profile_verification_status: verificationStatus
      },
      verification_status: verificationStatus,
      required_documents: MANAGER_REQUIRED_DOCUMENT_TYPES.map((type) => ({
        document_type: type,
        document_name: getManagerDocumentTypeLabel(type),
        optional: MANAGER_OPTIONAL_DOCUMENT_TYPES.has(type)
      })),
      documents
    })
  } catch (err) {
    return res.status(500).json({ error: getManagerProfileSetupErrorMessage(err) })
  }
})

app.patch('/api/admin/managers/:managerId/verification-documents/:documentType/status', requireAdminKey, async (req, res) => {
  try {
    const managerId = String(req.params.managerId || '').trim()
    const normalizedDocumentType = normalizeManagerDocumentType(req.params.documentType)
    const requestedStatus = String(req.body?.status || '').trim()
    const rejectionReason = String(req.body?.rejection_reason || '').trim()

    if (!managerId) {
      return res.status(400).json({ error: 'managerId is required' })
    }

    if (!MANAGER_REQUIRED_DOCUMENT_TYPES.includes(normalizedDocumentType)) {
      return res.status(400).json({ error: 'Invalid document type' })
    }

    if (requestedStatus !== 'Approved' && requestedStatus !== 'Rejected') {
      return res.status(400).json({ error: 'status must be Approved or Rejected' })
    }

    if (requestedStatus === 'Rejected' && !rejectionReason) {
      return res.status(400).json({ error: 'rejection_reason is required when rejecting a document' })
    }

    const { data: existingRow, error: existingError } = await supabase
      .from('manager_verification_documents')
      .select('*')
      .eq('manager_id', managerId)
      .eq('document_type', normalizedDocumentType)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    if (!existingRow) {
      return res.status(404).json({ error: 'Document not found for this manager' })
    }

    const { error: updateError } = await supabase
      .from('manager_verification_documents')
      .update({
        status: requestedStatus,
        rejection_reason: requestedStatus === 'Rejected' ? rejectionReason : null,
        reviewed_at: new Date().toISOString()
      })
      .eq('manager_id', managerId)
      .eq('document_type', normalizedDocumentType)

    if (updateError) {
      throw new Error(updateError.message)
    }

    const verificationStatus = await syncManagerProfileVerificationStatus(managerId)
    const rows = await getManagerVerificationRows(managerId)
    const documents = await mapManagerVerificationRowsWithUrls(rows)

    return res.json({
      success: true,
      verification_status: verificationStatus,
      documents
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.patch('/api/admin/users/:userId/verify', requireAdminKey, async (req, res) => {
  try {
    const { is_verified } = req.body
    const userId = req.params.userId

    if (typeof is_verified !== 'boolean') {
      return res.status(400).json({ error: 'is_verified must be boolean' })
    }

    // Ensure a profile row exists. If missing, hydrate from auth user.
    const { data: existingProfile, error: profileErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (profileErr) {
      return res.status(500).json({ error: profileErr.message })
    }

    const wasVerified = Boolean(existingProfile?.is_verified)

    if (!existingProfile) {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (authErr || !authUser?.user) {
        return res.status(404).json({ error: 'User not found in auth or profile' })
      }

      const email = authUser.user.email
      const fullName = authUser.user.user_metadata?.full_name || (email ? email.split('@')[0] : 'User')

      const { error: upsertErr } = await supabase
        .from('users')
        .upsert([{ id: userId, email, full_name: fullName, role: 'user', is_verified }], { onConflict: 'id' })

      if (upsertErr) {
        return res.status(500).json({ error: upsertErr.message })
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update({ is_verified })
      .eq('id', userId)
      .select()

    if (error) throw error

    const updatedUser = Array.isArray(data) ? data[0] : data
    const becameVerified = Boolean(is_verified) && !wasVerified
    const becameUnverified = !Boolean(is_verified) && wasVerified

    // Notify user when verification status changes.
    try {
      if (becameVerified && updatedUser) {
        await notifyUserAccountApproved(updatedUser)
      } else if (becameUnverified) {
        await supabase
          .from('notifications')
          .insert([{
            user_id: userId,
            message: 'Your account verification has been revoked by admin. Please contact support or resubmit verification documents.'
          }])
      }
    } catch (notifyErr) {
      console.warn('Error handling post-verify notifications:', notifyErr?.message || notifyErr)
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/admin/notifications/recent', requireAdminKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, message, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    const normalized = (data || []).map((n) => ({
      ...n,
      title: String(n.message || '').split('\n')[0] || 'Notification',
      status: 'SENT'
    }))

    res.json(normalized)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/manager/notifications', requireManagerAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, message, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/manager/notifications/recent', requireManagerAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, message, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    const normalized = (data || []).map((n) => ({
      ...n,
      title: String(n.message || '').split('\n')[0] || 'Notification',
      status: 'SENT'
    }))

    res.json(normalized)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/manager/notifications', requireManagerAuth, async (req, res) => {
  try {
    const { user_id, message } = req.body

    if (!user_id || !message) {
      return res.status(400).json({ error: 'user_id and message are required' })
    }

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .single()

    if (userError || !userRow) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert([{ user_id, message }])
      .select()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/admin/notifications', requireAdminKey, async (req, res) => {
  try {
    const { user_id, message } = req.body

    if (!user_id || !message) {
      return res.status(400).json({ error: 'user_id and message are required' })
    }

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .single()

    if (userError || !userRow) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert([{ user_id, message }])
      .select()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create user profile with service role (used after auth sign-up)
// Uses upsert to handle re-registration attempts gracefully
app.post('/api/auth/profile', async (req, res) => {
  try {
    const { id, email, full_name } = req.body
    if (!id || !email || !full_name) {
      return res.status(400).json({ error: 'id, email, and full_name are required' })
    }

    // Use upsert: if user already exists, update their profile
    const { data, error } = await supabase
      .from('users')
      .upsert([{ id, email, full_name, role: 'user', is_verified: false }], {
        onConflict: 'id'
      })
      .select()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/admin/orders', requireAdminKey, async (req, res) => {
  try {
    const baseOrderSelect = `
      id,
      status,
      delivery_status,
      created_at,
      user_id,
      items,
      total_amount,
      payment_method,
      delivery_partner_id,
      approved_by_manager_id,
      shipping_fee,
      subtotal,
      discount_total,
      coupon_discount,
      Slab_discount,
      offer_discount,
      gst_amount,
      coupon_code,
      offer_id,
      users(full_name,email,profile_photo_url),
      approving_manager:approved_by_manager_id(full_name,email)
    `
    const pickupAwareOrderSelect = `${baseOrderSelect}, shipping_method, pickup_order, pickup_available_from, pickup_available_until, pickup_warehouse_id`

    let { data, error } = await supabase
      .from('orders')
      .select(pickupAwareOrderSelect)
      .order('created_at', { ascending: false })

    if (error && isMissingSchemaReferenceError(error)) {
      const fallbackResult = await supabase
        .from('orders')
        .select(baseOrderSelect)
        .order('created_at', { ascending: false })

      data = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) throw error

    const partnerIds = [...new Set((data || []).map((order) => order.delivery_partner_id).filter(Boolean))]
    let partnerMap = new Map()

    if (partnerIds.length > 0) {
      const { data: partners, error: partnerError } = await supabase
        .from('delivery_partners')
        .select('id, delivery_partner_id, name, assigned_area, status')
        .in('id', partnerIds)

      if (partnerError) {
        console.warn('Failed to fetch delivery partners for admin orders:', partnerError?.message || partnerError)
      } else {
        for (const partner of partners || []) {
          partnerMap.set(partner.id, partner)
        }
      }
    }

    // Gather all product_ids from all orders' items
    const allItems = (data || []).flatMap(order => Array.isArray(order.items) ? order.items : [])
    const allProductIds = [...new Set(allItems.map(item => item.product_id).filter(Boolean))]

    // Fetch product details (names and prices) for all product_ids
    let productDetailsMap = new Map()
    if (allProductIds.length > 0) {
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name, price')
        .in('id', allProductIds)
      if (!prodError && Array.isArray(products)) {
        for (const p of products) {
          productDetailsMap.set(p.id, { name: p.name, price: p.price })
        }
      }
    }

    const pickupWarehouseIds = [...new Set((data || []).map((order) => order.pickup_warehouse_id).filter(Boolean))]
    const warehouseMap = new Map()

    if (pickupWarehouseIds.length > 0) {
      const { data: warehouses, error: warehouseError } = await supabase
        .from('warehouses')
        .select('id,name,address,contact_number')
        .in('id', pickupWarehouseIds)

      if (warehouseError) {
        if (!isMissingSchemaReferenceError(warehouseError, 'warehouses')) {
          console.warn('Failed to fetch pickup warehouses for admin orders:', warehouseError?.message || warehouseError)
        }
      } else {
        for (const warehouse of warehouses || []) {
          warehouseMap.set(warehouse.id, warehouse)
        }
      }
    }

    const enriched = (data || []).map((order) => {
      const normalizedShippingMethod = normalizeShippingMethod(
        order?.shipping_method,
        Number(order?.shipping_fee || 0) > 0 ? 'express' : 'standard'
      )

      return {
        ...order,
        shipping_method: normalizedShippingMethod,
        pickup_order: Boolean(order?.pickup_order) || normalizedShippingMethod === 'pickup_drive',
        pickup_warehouse: order?.pickup_warehouse_id ? (warehouseMap.get(order.pickup_warehouse_id) || null) : null,
        items: Array.isArray(order.items)
          ? order.items.map(item => {
              const details = productDetailsMap.get(item.product_id)
              return {
                ...item,
                name: item.name || details?.name || `ID ${item.product_id}`,
                price: item.price !== undefined ? item.price : (details?.price || 0)
              }
            })
          : order.items,
        delivery_partner: partnerMap.get(order.delivery_partner_id) || null
      }
    })

    res.json(enriched)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/admin/orders/:orderId', requireAdminKey, async (req, res) => {
  try {
    const baseOrderSelect = `
      id,
      status,
      delivery_status,
      created_at,
      user_id,
      items,
      total_amount,
      payment_method,
      delivery_partner_id,
      approved_by_manager_id,
      shipping_fee,
      subtotal,
      discount_total,
      coupon_discount,
      Slab_discount,
      offer_discount,
      gst_amount,
      coupon_code,
      offer_id,
      users(full_name,email,profile_photo_url),
      approving_manager:approved_by_manager_id(full_name,email)
    `
    const pickupAwareOrderSelect = `${baseOrderSelect}, shipping_method, pickup_order, pickup_available_from, pickup_available_until, pickup_warehouse_id`

    let { data, error } = await supabase
      .from('orders')
      .select(pickupAwareOrderSelect)
      .eq('id', req.params.orderId)
      .maybeSingle()

    if (error && isMissingSchemaReferenceError(error)) {
      const fallbackResult = await supabase
        .from('orders')
        .select(baseOrderSelect)
        .eq('id', req.params.orderId)
        .maybeSingle()

      data = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Order not found' })

    let partner = null
    if (data.delivery_partner_id) {
      const { data: partnerData } = await supabase
        .from('delivery_partners')
        .select('id, delivery_partner_id, name, assigned_area, status')
        .eq('id', data.delivery_partner_id)
        .maybeSingle()
      partner = partnerData
    }

    let warehouse = null
    if (data.pickup_warehouse_id) {
      const { data: warehouseData } = await supabase
        .from('warehouses')
        .select('id,name,address,contact_number')
        .eq('id', data.pickup_warehouse_id)
        .maybeSingle()
      warehouse = warehouseData
    }

    // Fetch product details for items
    const productIds = (data.items || []).map(i => i.product_id).filter(Boolean)
    let productMap = new Map()
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price')
        .in('id', productIds)
      if (Array.isArray(products)) {
        products.forEach(p => productMap.set(p.id, p))
      }
    }

    const normalizedShippingMethod = normalizeShippingMethod(
      data.shipping_method,
      Number(data.shipping_fee || 0) > 0 ? 'express' : 'standard'
    )

    const enriched = {
      ...data,
      shipping_method: normalizedShippingMethod,
      pickup_order: Boolean(data.pickup_order) || normalizedShippingMethod === 'pickup_drive',
      pickup_warehouse: warehouse,
      items: (data.items || []).map(item => {
        const prod = productMap.get(item.product_id)
        return {
          ...item,
          name: item.name || prod?.name || `ID ${item.product_id}`,
          price: item.price !== undefined ? item.price : (prod?.price || 0)
        }
      }),
      delivery_partner: partner
    }

    res.json(enriched)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================
// Admin Transactions & Reports
// ============================================

function parseDateRange(query) {
  const { startDate, endDate } = query || {}
  const toStartOfDay = (d) => {
    const parts = String(d).split('-')
    if (parts.length === 3) {
      return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00.000`)
    }
    return new Date(d)
  }
  const toEndOfDay = (d) => {
    const parts = String(d).split('-')
    if (parts.length === 3) {
      return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T23:59:59.999`)
    }
    return new Date(d)
  }

  let start = startDate ? toStartOfDay(startDate) : null
  let end = endDate ? toEndOfDay(endDate) : null
  if (start && isNaN(start.getTime())) start = null
  if (end && isNaN(end.getTime())) end = null
  return { start, end }
}

async function fetchTransactions({ start, end, mode, status, page = 1, perPage = 100, includeAll = false }) {
  // Try transactions table first
  try {
    let q = supabase
      .from('transactions')
      .select(`
        id,
        order_id,
        user_id,
        mode,
        status,
        amount,
        reference_id,
        created_at,
        users(full_name,email)
      `)
      .order('created_at', { ascending: false })

    if (start) q = q.gte('created_at', start.toISOString())
    if (end) q = q.lte('created_at', end.toISOString())
    if (mode && ['prepaid', 'cod'].includes(String(mode).toLowerCase())) q = q.eq('mode', String(mode).toLowerCase())
    if (status) q = q.eq('status', status)
    if (!includeAll && perPage) q = q.range((page - 1) * perPage, (page * perPage) - 1)

    const { data, error } = await q
    if (error) {
      console.warn('Transactions query error:', error)
      throw error
    }
    
    // Fetch delivery partner info separately for each transaction
    const transactionsWithPartners = await Promise.all(
      (Array.isArray(data) ? data : []).map(async (tx) => {
        if (tx.order_id) {
          try {
            const { data: orderData } = await supabase
              .from('orders')
              .select('delivery_partner_id, payment_method, delivery_partners(name)')
              .eq('id', tx.order_id)
              .single()
            
            return {
              ...tx,
              mode: tx.mode || orderData?.payment_method || tx.mode,
              delivery_partner: orderData?.delivery_partners || null
            }
          } catch (err) {
            return { ...tx, delivery_partner: null }
          }
        }
        return { ...tx, delivery_partner: null }
      })
    )
    
    return transactionsWithPartners
  } catch (err) {
    // Fallback: derive transactions from orders when transactions table is absent
    console.warn('Transactions table unavailable, deriving from orders:', err?.message || err)
    let q = supabase
      .from('orders')
      .select('id,status,created_at,user_id,total_amount,delivery_partner_id, users(full_name,email)')
      .order('created_at', { ascending: false })

    if (start) q = q.gte('created_at', start.toISOString())
    if (end) q = q.lte('created_at', end.toISOString())
    if (status) q = q.eq('status', status)
    if (!includeAll && perPage) q = q.range((page - 1) * perPage, (page * perPage) - 1)

    const { data, error } = await q
    if (error) throw error
    
    // Fetch delivery partner info separately for each order
    const ordersWithPartners = await Promise.all(
      (Array.isArray(data) ? data : []).map(async (o) => {
        let deliveryPartner = null
        if (o.delivery_partner_id) {
          try {
            const { data: partnerData } = await supabase
              .from('delivery_partners')
              .select('name')
              .eq('id', o.delivery_partner_id)
              .single()
            deliveryPartner = partnerData
          } catch (err) {
            // Partner not found, leave as null
          }
        }
        
        return {
          id: o.id,
          order_id: o.id,
          user_id: o.user_id,
          mode: 'cod',
          status: o.status,
          amount: o.total_amount || 0,
          reference_id: null,
          created_at: o.created_at,
          users: o.users,
          delivery_partner: deliveryPartner
        }
      })
    )
    
    // If mode filter is prepaid, none will match in fallback
    if (mode && String(mode).toLowerCase() === 'prepaid') return []
    return ordersWithPartners
  }
}

function summarizeTransactions(rows) {
  const normalizedMode = (row) => String(row?.mode || '').toLowerCase().replace(/[\s_-]+/g, '')
  const isCod = (row) => {
    const mode = normalizedMode(row)
    return mode === 'cod' || mode === 'cashondelivery'
  }
  const isDelivered = (row) => /\bdelivered\b/.test(String(row?.status || '').trim().toLowerCase())
  const revenueAmountForRow = (row) => {
    const amount = Number(row?.amount || 0)
    if (!isCod(row)) return amount
    return isDelivered(row) ? amount : 0
  }

  const summary = {
    totalCount: rows.length,
    totalAmount: rows.reduce((s, r) => s + revenueAmountForRow(r), 0),
    prepaidCount: rows.filter(r => (r.mode || '').toLowerCase() === 'prepaid').length,
    prepaidAmount: rows.filter(r => (r.mode || '').toLowerCase() === 'prepaid').reduce((s, r) => s + Number(r.amount || 0), 0),
    codCount: rows.filter(r => isCod(r)).length,
    codAmount: rows.reduce((s, r) => s + (isCod(r) ? revenueAmountForRow(r) : 0), 0),
    byStatus: {}
  }
  for (const r of rows) {
    const st = r.status || 'Unknown'
    summary.byStatus[st] = (summary.byStatus[st] || 0) + 1
  }
  return summary
}

// ── Manager Transaction Endpoints ─────────────────────────────────────────────
app.get('/api/manager/transactions', requireManagerAuth, async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query)
    const { mode, status } = req.query
    const page = Number(req.query.page || 1)
    const perPage = Number(req.query.perPage || 100)
    const rows = await fetchTransactions({ start, end, mode, status, page, perPage })
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/manager/transactions/summary', requireManagerAuth, async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query)
    const { mode, status } = req.query
    const rows = await fetchTransactions({ start, end, mode, status })
    const summary = summarizeTransactions(rows)
    res.json(summary)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/manager/transactions/settlement', requireManagerAuth, async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query)
    const { partnerId } = req.query

    let q = supabase
      .from('orders')
      .select('id,total_amount,cod_amount_received,delivery_partner_id,created_at,payment_method, users(full_name)')
      .not('delivery_partner_id', 'is', null)
      .order('created_at', { ascending: false })

    if (start) q = q.gte('created_at', start.toISOString())
    if (end) q = q.lte('created_at', end.toISOString())
    if (partnerId && partnerId !== 'all') q = q.eq('delivery_partner_id', partnerId)

    const { data, error } = await q
    if (error) throw error

    const codOrders = (Array.isArray(data) ? data : []).filter(
      (order) => String(order.payment_method || '').toLowerCase() === 'cod'
    )

    const partnerIds = Array.from(new Set(codOrders.map((o) => o.delivery_partner_id).filter(Boolean)))
    let partnerMap = {}
    if (partnerIds.length > 0) {
      const { data: partners, error: partnersError } = await supabase
        .from('delivery_partners')
        .select('id,name')
        .in('id', partnerIds)
      if (partnersError) throw partnersError
      partnerMap = (Array.isArray(partners) ? partners : []).reduce((acc, p) => {
        acc[p.id] = p
        return acc
      }, {})
    }

    const settlements = codOrders.map((order) => ({
      id: order.id,
      order_id: order.id,
      delivery_partner_id: order.delivery_partner_id || null,
      delivery_partner_name: partnerMap[order.delivery_partner_id]?.name || 'Not Assigned',
      user_name: order.users?.full_name || null,
      amount_assigned: order.total_amount || 0,
      amount_collected: order.cod_amount_received || 0,
      amount_settled: order.cod_amount_received || 0,
      collection_date: order.created_at,
      created_at: order.created_at
    }))

    res.json(settlements)
  } catch (err) {
    console.error('Manager settlement fetch error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/manager/transactions/settlement/history', requireManagerAuth, async (req, res) => {
  try {
    const { partnerId, limit } = req.query
    let q = supabase
      .from('settlement_receipts')
      .select('*')
      .order('created_at', { ascending: false })

    if (partnerId && partnerId !== 'all') q = q.eq('delivery_partner_id', partnerId)
    if (limit) q = q.limit(Number(limit))

    const { data, error } = await q
    if (error) throw error

    res.json(Array.isArray(data) ? data : [])
  } catch (err) {
    console.error('Manager settlement history error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/manager/transactions/settlement/complete', requireManagerAuth, async (req, res) => {
  try {
    const {
      delivery_partner_id, delivery_partner_name,
      items, total_assigned, total_collected, total_settled,
      cash_received, difference, note
    } = req.body || {}

    if (!delivery_partner_id) return res.status(400).json({ error: 'delivery_partner_id is required' })
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items are required' })

    const receipt = {
      id: `SET-${Date.now()}`,
      delivery_partner_id,
      delivery_partner_name: delivery_partner_name || null,
      total_assigned: Number(total_assigned || 0),
      total_collected: Number(total_collected || 0),
      total_settled: Number(total_settled || 0),
      cash_received: Number(cash_received || 0),
      difference: Number(difference || 0),
      note: note || null,
      items,
      created_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('settlement_receipts')
      .insert([receipt])
      .select('*')
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    console.error('Manager settlement completion error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/manager/transactions/settlement/discrepancy', requireManagerAuth, async (req, res) => {
  try {
    const {
      delivery_partner_id, delivery_partner_name,
      expected_amount, received_amount, discrepancy_amount,
      discrepancy_type, description, items
    } = req.body || {}

    if (!delivery_partner_id) return res.status(400).json({ error: 'delivery_partner_id is required' })

    const report = {
      id: `DISC-${Date.now()}`,
      delivery_partner_id,
      delivery_partner_name: delivery_partner_name || null,
      expected_amount: Number(expected_amount || 0),
      received_amount: Number(received_amount || 0),
      discrepancy_amount: Number(Math.abs(discrepancy_amount || 0)),
      discrepancy_type: discrepancy_amount < 0 ? 'shortage' : 'overage',
      description: description || null,
      items: items || [],
      status: 'reported',
      created_at: new Date().toISOString()
    }

    const { data: discData, error: discError } = await supabase
      .from('settlement_discrepancies')
      .insert([report])
      .select('*')
      .single()

    if (!discError) return res.status(201).json({ success: true, data: discData })

    const { data: fallbackData, error: fallbackError } = await supabase
      .from('settlement_receipts')
      .insert([{ ...report, is_discrepancy: true }])
      .select('*')
      .single()

    if (fallbackError) throw fallbackError
    res.status(201).json({ success: true, data: fallbackData })
  } catch (err) {
    console.error('Manager settlement discrepancy error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── Admin Transaction Endpoints ────────────────────────────────────────────────
app.get('/api/admin/transactions', requireAdminKey, async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query)
    const { mode, status } = req.query
    const page = Number(req.query.page || 1)
    const perPage = Number(req.query.perPage || 100)
    const rows = await fetchTransactions({ start, end, mode, status, page, perPage })
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/admin/transactions/summary', requireAdminKey, async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query)
    const { mode, status } = req.query
    const rows = await fetchTransactions({ start, end, mode, status })
    const summary = summarizeTransactions(rows)
    res.json(summary)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/admin/transactions/settlement', requireAdminKey, async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query)
    const { partnerId } = req.query

    let q = supabase
      .from('orders')
      .select('id,total_amount,cod_amount_received,delivery_partner_id,created_at,payment_method, users(full_name)')
      .not('delivery_partner_id', 'is', null)
      .order('created_at', { ascending: false })

    if (start) q = q.gte('created_at', start.toISOString())
    if (end) q = q.lte('created_at', end.toISOString())
    if (partnerId && partnerId !== 'all') q = q.eq('delivery_partner_id', partnerId)

    const { data, error } = await q
    if (error) throw error

    const codOrders = (Array.isArray(data) ? data : []).filter((order) => {
      return String(order.payment_method || '').toLowerCase() === 'cod'
    })

    const partnerIds = Array.from(
      new Set(codOrders.map((o) => o.delivery_partner_id).filter(Boolean))
    )
    let partnerMap = {}
    if (partnerIds.length > 0) {
      const { data: partners, error: partnersError } = await supabase
        .from('delivery_partners')
        .select('id,name')
        .in('id', partnerIds)
      if (partnersError) throw partnersError
      partnerMap = (Array.isArray(partners) ? partners : []).reduce((acc, p) => {
        acc[p.id] = p
        return acc
      }, {})
    }

    // Transform data to settlement format
    const settlements = codOrders.map(order => ({
      id: order.id,
      order_id: order.id,
      delivery_partner_id: order.delivery_partner_id || null,
      delivery_partner_name: partnerMap[order.delivery_partner_id]?.name || 'Not Assigned',
      user_name: order.users?.full_name || null,
      amount_assigned: order.total_amount || 0,
      amount_collected: order.cod_amount_received || 0,
      amount_settled: order.cod_amount_received || 0, // For now, assume collected = settled
      collection_date: order.created_at,
      created_at: order.created_at
    }))

    res.json(settlements)
  } catch (err) {
    console.error('Settlement fetch error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/admin/transactions/settlement/history', requireAdminKey, async (req, res) => {
  try {
    const { partnerId, limit } = req.query
    let q = supabase
      .from('settlement_receipts')
      .select('*')
      .order('created_at', { ascending: false })

    if (partnerId && partnerId !== 'all') q = q.eq('delivery_partner_id', partnerId)
    if (limit) q = q.limit(Number(limit))

    const { data, error } = await q
    if (error) throw error

    res.json(Array.isArray(data) ? data : [])
  } catch (err) {
    console.error('Settlement history fetch error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/admin/transactions/settlement/complete', requireAdminKey, async (req, res) => {
  try {
    const {
      delivery_partner_id,
      delivery_partner_name,
      items,
      total_assigned,
      total_collected,
      total_settled,
      cash_received,
      difference,
      note
    } = req.body || {}

    if (!delivery_partner_id) {
      return res.status(400).json({ error: 'delivery_partner_id is required' })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items are required' })
    }

    const receipt = {
      id: `SET-${Date.now()}`,
      delivery_partner_id,
      delivery_partner_name: delivery_partner_name || null,
      total_assigned: Number(total_assigned || 0),
      total_collected: Number(total_collected || 0),
      total_settled: Number(total_settled || 0),
      cash_received: Number(cash_received || 0),
      difference: Number(difference || 0),
      note: note || null,
      items,
      created_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('settlement_receipts')
      .insert([receipt])
      .select('*')
      .single()

    if (error) throw error

    res.status(201).json(data)
  } catch (err) {
    console.error('Settlement completion error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/admin/transactions/settlement/discrepancy', requireAdminKey, async (req, res) => {
  try {
    const {
      delivery_partner_id,
      delivery_partner_name,
      expected_amount,
      received_amount,
      discrepancy_amount,
      discrepancy_type,
      description,
      items
    } = req.body || {}

    if (!delivery_partner_id) {
      return res.status(400).json({ error: 'delivery_partner_id is required' })
    }
    if (!discrepancy_type) {
      return res.status(400).json({ error: 'discrepancy_type is required' })
    }

    const discrepancyType = discrepancy_amount < 0 ? 'shortage' : 'overage'
    const report = {
      id: `DISC-${Date.now()}`,
      delivery_partner_id,
      delivery_partner_name: delivery_partner_name || null,
      expected_amount: Number(expected_amount || 0),
      received_amount: Number(received_amount || 0),
      discrepancy_amount: Number(Math.abs(discrepancy_amount || 0)),
      discrepancy_type: discrepancyType,
      description: description || null,
      items: items || [],
      status: 'reported',
      created_at: new Date().toISOString()
    }

    // Try settlement_discrepancies table first, fall back to settlement_receipts
    let result
    const { data: discData, error: discError } = await supabase
      .from('settlement_discrepancies')
      .insert([report])
      .select('*')
      .single()

    if (!discError) {
      result = discData
    } else {
      // Fallback: store in settlement_receipts
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('settlement_receipts')
        .insert([{ ...report, is_discrepancy: true }])
        .select('*')
        .single()
      
      if (fallbackError) throw fallbackError
      result = fallbackData
    }

    res.status(201).json({ success: true, data: result })
  } catch (err) {
    console.error('Settlement discrepancy reporting error:', err)
    res.status(500).json({ error: err.message })
  }
})

function mapWarehouseSettlementStorageRecord(record) {
  if (!record || typeof record !== 'object') return record

  return {
    ...record,
    warehouse_id: record.warehouse_id || record.delivery_partner_id || null,
    warehouse_name: record.warehouse_name || record.delivery_partner_name || null
  }
}

// ── Warehouse Settlement Endpoints (Manager) ──────────────────────────────────
app.get('/api/manager/transactions/warehouse-settlement', requireManagerAuth, async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query)
    const { warehouseId } = req.query

    let q = supabase
      .from('orders')
      .select('id,total_amount,cod_amount_received,pickup_warehouse_id,created_at,payment_method,users(full_name)')
      .not('pickup_warehouse_id', 'is', null)
      .eq('pickup_order', true)
      .order('created_at', { ascending: false })

    if (start) q = q.gte('created_at', start.toISOString())
    if (end) q = q.lte('created_at', end.toISOString())
    if (warehouseId && warehouseId !== 'all') q = q.eq('pickup_warehouse_id', warehouseId)

    const { data, error } = await q
    if (error) throw error

    const codOrders = (Array.isArray(data) ? data : []).filter(
      (order) => String(order.payment_method || '').toLowerCase() === 'cod'
    )

    const warehouseIds = Array.from(new Set(codOrders.map((o) => o.pickup_warehouse_id).filter(Boolean)))
    let warehouseMap = {}
    if (warehouseIds.length > 0) {
      const { data: warehouses, error: warehousesError } = await supabase
        .from('warehouses')
        .select('id,name')
        .in('id', warehouseIds)
      if (warehousesError) throw warehousesError
      warehouseMap = (Array.isArray(warehouses) ? warehouses : []).reduce((acc, w) => {
        acc[w.id] = w
        return acc
      }, {})
    }

    const settlements = codOrders.map((order) => ({
      id: order.id,
      order_id: order.id,
      warehouse_id: order.pickup_warehouse_id || null,
      warehouse_name: warehouseMap[order.pickup_warehouse_id]?.name || 'Not Assigned',
      user_name: order.users?.full_name || null,
      amount_assigned: order.total_amount || 0,
      amount_collected: order.cod_amount_received || 0,
      amount_settled: order.cod_amount_received || 0,
      collection_date: order.created_at,
      created_at: order.created_at
    }))

    res.json(settlements)
  } catch (err) {
    console.error('Manager warehouse settlement fetch error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/manager/transactions/warehouse-settlement/history', requireManagerAuth, async (req, res) => {
  try {
    const { warehouseId, limit } = req.query
    let q = supabase
      .from('settlement_receipts')
      .select('*')
      .like('id', 'WAR-%')
      .order('created_at', { ascending: false })

    if (warehouseId && warehouseId !== 'all') q = q.eq('delivery_partner_id', warehouseId)
    if (limit) q = q.limit(Number(limit))

    const { data, error } = await q
    if (error) throw error

    res.json(Array.isArray(data) ? data.map(mapWarehouseSettlementStorageRecord) : [])
  } catch (err) {
    console.error('Manager warehouse settlement history error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/manager/transactions/warehouse-settlement/complete', requireManagerAuth, async (req, res) => {
  try {
    const {
      warehouse_id, warehouse_name,
      items, total_assigned, total_collected, total_settled,
      cash_received, difference, note
    } = req.body || {}

    if (!warehouse_id) return res.status(400).json({ error: 'warehouse_id is required' })
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items are required' })

    const receipt = {
      id: `WAR-SET-${Date.now()}`,
      delivery_partner_id: warehouse_id,
      delivery_partner_name: warehouse_name || null,
      total_assigned: Number(total_assigned || 0),
      total_collected: Number(total_collected || 0),
      total_settled: Number(total_settled || 0),
      cash_received: Number(cash_received || 0),
      difference: Number(difference || 0),
      note: note || null,
      items,
      created_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('settlement_receipts')
      .insert([receipt])
      .select('*')
      .single()

    if (error) throw error
    res.status(201).json(mapWarehouseSettlementStorageRecord(data))
  } catch (err) {
    console.error('Manager warehouse settlement completion error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/manager/transactions/warehouse-settlement/discrepancy', requireManagerAuth, async (req, res) => {
  try {
    const {
      warehouse_id, warehouse_name,
      expected_amount, received_amount, discrepancy_amount,
      discrepancy_type, description, items
    } = req.body || {}

    if (!warehouse_id) return res.status(400).json({ error: 'warehouse_id is required' })

    const report = {
      id: `WAR-DISC-${Date.now()}`,
      delivery_partner_id: warehouse_id,
      delivery_partner_name: warehouse_name || null,
      expected_amount: Number(expected_amount || 0),
      received_amount: Number(received_amount || 0),
      discrepancy_amount: Number(Math.abs(discrepancy_amount || 0)),
      discrepancy_type: discrepancy_amount < 0 ? 'shortage' : 'overage',
      description: description || null,
      items: items || [],
      status: 'reported',
      created_at: new Date().toISOString()
    }

    const { data: discData, error: discError } = await supabase
      .from('settlement_discrepancies')
      .insert([report])
      .select('*')
      .single()

    if (!discError) return res.status(201).json({ success: true, data: mapWarehouseSettlementStorageRecord(discData) })

    const { data: fallbackData, error: fallbackError } = await supabase
      .from('settlement_receipts')
      .insert([{ ...report, is_discrepancy: true }])
      .select('*')
      .single()

    if (fallbackError) throw fallbackError
    res.status(201).json({ success: true, data: mapWarehouseSettlementStorageRecord(fallbackData) })
  } catch (err) {
    console.error('Manager warehouse settlement discrepancy error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── Warehouse Settlement Endpoints (Admin) ────────────────────────────────────
app.get('/api/admin/transactions/warehouse-settlement', requireAdminKey, async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query)
    const { warehouseId } = req.query

    let q = supabase
      .from('orders')
      .select('id,total_amount,cod_amount_received,pickup_warehouse_id,created_at,payment_method,users(full_name)')
      .not('pickup_warehouse_id', 'is', null)
      .eq('pickup_order', true)
      .order('created_at', { ascending: false })

    if (start) q = q.gte('created_at', start.toISOString())
    if (end) q = q.lte('created_at', end.toISOString())
    if (warehouseId && warehouseId !== 'all') q = q.eq('pickup_warehouse_id', warehouseId)

    const { data, error } = await q
    if (error) throw error

    const codOrders = (Array.isArray(data) ? data : []).filter(
      (order) => String(order.payment_method || '').toLowerCase() === 'cod'
    )

    const warehouseIds = Array.from(new Set(codOrders.map((o) => o.pickup_warehouse_id).filter(Boolean)))
    let warehouseMap = {}
    if (warehouseIds.length > 0) {
      const { data: warehouses, error: warehousesError } = await supabase
        .from('warehouses')
        .select('id,name')
        .in('id', warehouseIds)
      if (warehousesError) throw warehousesError
      warehouseMap = (Array.isArray(warehouses) ? warehouses : []).reduce((acc, w) => {
        acc[w.id] = w
        return acc
      }, {})
    }

    const settlements = codOrders.map((order) => ({
      id: order.id,
      order_id: order.id,
      warehouse_id: order.pickup_warehouse_id || null,
      warehouse_name: warehouseMap[order.pickup_warehouse_id]?.name || 'Not Assigned',
      user_name: order.users?.full_name || null,
      amount_assigned: order.total_amount || 0,
      amount_collected: order.cod_amount_received || 0,
      amount_settled: order.cod_amount_received || 0,
      collection_date: order.created_at,
      created_at: order.created_at
    }))

    res.json(settlements)
  } catch (err) {
    console.error('Admin warehouse settlement fetch error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/admin/transactions/warehouse-settlement/history', requireAdminKey, async (req, res) => {
  try {
    const { warehouseId, limit } = req.query
    let q = supabase
      .from('settlement_receipts')
      .select('*')
      .like('id', 'WAR-%')
      .order('created_at', { ascending: false })

    if (warehouseId && warehouseId !== 'all') q = q.eq('delivery_partner_id', warehouseId)
    if (limit) q = q.limit(Number(limit))

    const { data, error } = await q
    if (error) throw error

    res.json(Array.isArray(data) ? data.map(mapWarehouseSettlementStorageRecord) : [])
  } catch (err) {
    console.error('Admin warehouse settlement history error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/admin/transactions/warehouse-settlement/complete', requireAdminKey, async (req, res) => {
  try {
    const {
      warehouse_id, warehouse_name,
      items, total_assigned, total_collected, total_settled,
      cash_received, difference, note
    } = req.body || {}

    if (!warehouse_id) return res.status(400).json({ error: 'warehouse_id is required' })
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items are required' })

    const receipt = {
      id: `WAR-SET-${Date.now()}`,
      delivery_partner_id: warehouse_id,
      delivery_partner_name: warehouse_name || null,
      total_assigned: Number(total_assigned || 0),
      total_collected: Number(total_collected || 0),
      total_settled: Number(total_settled || 0),
      cash_received: Number(cash_received || 0),
      difference: Number(difference || 0),
      note: note || null,
      items,
      created_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('settlement_receipts')
      .insert([receipt])
      .select('*')
      .single()

    if (error) throw error
    res.status(201).json(mapWarehouseSettlementStorageRecord(data))
  } catch (err) {
    console.error('Admin warehouse settlement completion error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/admin/transactions/warehouse-settlement/discrepancy', requireAdminKey, async (req, res) => {
  try {
    const {
      warehouse_id, warehouse_name,
      expected_amount, received_amount, discrepancy_amount,
      discrepancy_type, description, items
    } = req.body || {}

    if (!warehouse_id) return res.status(400).json({ error: 'warehouse_id is required' })

    const report = {
      id: `WAR-DISC-${Date.now()}`,
      delivery_partner_id: warehouse_id,
      delivery_partner_name: warehouse_name || null,
      expected_amount: Number(expected_amount || 0),
      received_amount: Number(received_amount || 0),
      discrepancy_amount: Number(Math.abs(discrepancy_amount || 0)),
      discrepancy_type: discrepancy_amount < 0 ? 'shortage' : 'overage',
      description: description || null,
      items: items || [],
      status: 'reported',
      created_at: new Date().toISOString()
    }

    const { data: discData, error: discError } = await supabase
      .from('settlement_discrepancies')
      .insert([report])
      .select('*')
      .single()

    if (!discError) return res.status(201).json({ success: true, data: mapWarehouseSettlementStorageRecord(discData) })

    const { data: fallbackData, error: fallbackError } = await supabase
      .from('settlement_receipts')
      .insert([{ ...report, is_discrepancy: true }])
      .select('*')
      .single()

    if (fallbackError) throw fallbackError
    res.status(201).json({ success: true, data: mapWarehouseSettlementStorageRecord(fallbackData) })
  } catch (err) {
    console.error('Admin warehouse settlement discrepancy error:', err)
    res.status(500).json({ error: err.message })
  }
})

async function generatePdfFromTransactions(rows, { title = 'Transactions Report', periodLabel = '' } = {}) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 })
  const chunks = []

  const rupee = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const formatDateTime = (d) => (d ? `${formatDate(d)} ${formatTime(d)}` : '—')
  const truncate = (value, max = 40) => {
    const text = String(value || '')
    return text.length > max ? `${text.slice(0, max - 1)}...` : text
  }

  const sortedRows = [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const summary = summarizeTransactions(sortedRows)

  return await new Promise((resolve, reject) => {
    doc.on('data', (d) => chunks.push(d))
    doc.on('error', reject)
    doc.on('end', () => resolve(Buffer.concat(chunks)))

    const left = doc.page.margins.left
    const right = doc.page.width - doc.page.margins.right
    const top = doc.page.margins.top
    const bottom = doc.page.height - doc.page.margins.bottom
    const contentWidth = right - left

    const columns = [
      { key: 'transactionId', title: 'Transaction ID', width: 72 },
      { key: 'orderId', title: 'Order ID', width: 72 },
      { key: 'userDetails', title: 'User Details', width: 140 },
      { key: 'mode', title: 'Mode', width: 50 },
      { key: 'status', title: 'Status', width: 74 },
      { key: 'deliveryPartner', title: 'Delivery Partner', width: 104 },
      { key: 'amount', title: 'Amount', width: 74 },
      { key: 'dateTime', title: 'Date & Time', width: 118 }
    ]

    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0)
    let currentX = left
    columns.forEach((col) => {
      col.x = currentX
      currentX += col.width
    })

    const drawPageHeader = () => {
      doc.save()
      doc.rect(left, top, Math.min(contentWidth, tableWidth), 58).fill('#0b5fff')
      doc.fill('#ffffff').font('Helvetica-Bold').fontSize(18).text(title || 'Transactions & Revenue Report', left + 12, top + 10)
      doc.font('Helvetica').fontSize(10).text('Ashirwad Enterprises • Accounting Transaction Report', left + 12, top + 34)
      doc.restore()

      doc.fillColor('#374151').font('Helvetica').fontSize(10)
      doc.text(periodLabel || 'Period: All Time', left, top + 66)
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, left, top + 80)

      doc.font('Helvetica-Bold').fillColor('#111827').fontSize(11)
      doc.text(`Total Daily Revenue: ${rupee(summary.totalAmount)}`, left, top + 95)
      doc.font('Helvetica').fillColor('#4b5563').fontSize(10)
      doc.text(`Transactions: ${summary.totalCount} | Prepaid: ${summary.prepaidCount} (${rupee(summary.prepaidAmount)}) | COD: ${summary.codCount} (${rupee(summary.codAmount)})`, left, top + 110)

      const breakdown = Object.entries(summary.byStatus || {}).map(([k, v]) => `${k}: ${v}`).join(' | ') || 'No data'
      doc.text(`Status Mix: ${breakdown}`, left, top + 124)
    }

    const drawTableHeader = (y) => {
      doc.save()
      doc.rect(left, y, tableWidth, 24).fill('#111827')
      doc.restore()

      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
      for (const col of columns) {
        doc.text(col.title, col.x + 5, y + 7, { width: col.width - 10, ellipsis: true })
      }
      return y + 24
    }

    drawPageHeader()
    let y = drawTableHeader(top + 146)

    let stripe = false
    for (const row of sortedRows) {
      const rowHeight = 24
      if (y + rowHeight > bottom - 24) {
        doc.addPage()
        drawPageHeader()
        y = drawTableHeader(top + 146)
      }

      if (stripe) {
        doc.save()
        doc.rect(left, y, tableWidth, rowHeight).fill('#f9fafb')
        doc.restore()
      }
      stripe = !stripe

      const userName = row.users?.full_name || 'Unknown'
      const userEmail = row.users?.email || ''
      const userDetails = userEmail ? `${userName} | ${userEmail}` : userName
      const deliveryPartnerName = row.delivery_partner?.name || row.delivery_partner_name || 'Not Assigned'

      const mapped = {
        transactionId: String(row.id || '').slice(0, 12),
        orderId: String(row.order_id || row.id || '').slice(0, 12),
        userDetails,
        mode: (row.mode || '').toUpperCase() || '—',
        status: row.status || '—',
        deliveryPartner: deliveryPartnerName,
        amount: rupee(row.amount),
        dateTime: formatDateTime(row.created_at)
      }

      doc.fillColor('#111827').font('Helvetica').fontSize(9)
      for (const col of columns) {
        const alignRight = col.key === 'amount'
        doc.text(truncate(mapped[col.key], col.key === 'userDetails' ? 46 : 28), col.x + 5, y + 7, {
          width: col.width - 10,
          align: alignRight ? 'right' : 'left',
          ellipsis: true
        })
      }

      doc.save()
      doc.moveTo(left, y + rowHeight).lineTo(left + tableWidth, y + rowHeight).stroke('#e5e7eb')
      doc.restore()

      y += rowHeight
    }

    if (!sortedRows.length) {
      doc.fillColor('#6b7280').font('Helvetica').fontSize(11)
      doc.text('No transactions found for the selected period.', left, y + 18)
      y += 36
    }

    let totalRowY = y + 10
    if (totalRowY + 24 > bottom - 8) {
      doc.addPage()
      drawPageHeader()
      totalRowY = drawTableHeader(top + 146) + 6
    }

    const amountColumn = columns.find((col) => col.key === 'amount')
    const labelWidth = amountColumn ? (amountColumn.x - left - 10) : (tableWidth - 120)

    doc.save()
    doc.rect(left, totalRowY, tableWidth, 24).fill('#e0e7ff')
    doc.restore()

    doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(10)
    doc.text('TOTAL DAILY REVENUE', left + 5, totalRowY + 7, {
      width: Math.max(60, labelWidth),
      align: 'left'
    })

    if (amountColumn) {
      doc.text(rupee(summary.totalAmount), amountColumn.x + 5, totalRowY + 7, {
        width: amountColumn.width - 10,
        align: 'right'
      })
    }

    doc.end()
  })
}

app.get('/api/admin/transactions/report', requireAdminKey, requireAdminReportPassword, async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query)
    const { mode, status } = req.query
    const rows = await fetchTransactions({ start, end, mode, status, includeAll: true })
    const labelParts = []
    if (start) labelParts.push(new Date(start).toLocaleDateString('en-IN'))
    if (end) labelParts.push(new Date(end).toLocaleDateString('en-IN'))
    const periodLabel = labelParts.length ? `Period: ${labelParts.join(' → ')}` : 'All Time'
    const pdf = await generatePdfFromTransactions(rows, { title: 'Transactions & Revenue Report', periodLabel })
    const filename = `transactions-${(start || new Date()).toISOString().slice(0,10)}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdf)
  } catch (err) {
    console.error('Report generation error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/admin/orders/:orderId/status', requireAdminKey, async (req, res) => {
  try {
    const { status, pickup_warehouse_id } = req.body || {}
    const allowed = ['Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled']
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' })
    }

    const baseExistingOrderSelect = 'id, user_id, status, total_amount, payment_method, delivery_partner_id, shipping_fee, pickup_warehouse_id, pickup_available_from, pickup_available_until'
    const pickupAwareExistingOrderSelect = `${baseExistingOrderSelect}, shipping_method, pickup_order`

    let { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select(pickupAwareExistingOrderSelect)
      .eq('id', req.params.orderId)
      .maybeSingle()

    if (existingOrderError && isMissingSchemaReferenceError(existingOrderError)) {
      const fallbackResult = await supabase
        .from('orders')
        .select(baseExistingOrderSelect)
        .eq('id', req.params.orderId)
        .maybeSingle()
      existingOrder = fallbackResult.data
      existingOrderError = fallbackResult.error
    }

    if (existingOrderError) throw existingOrderError
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' })
    }

    const wasApproved = String(existingOrder.status || '').trim() === 'Approved'
    const pickupOrder = isPickupOrderRecord(existingOrder)
    const resolvedWarehouseId = pickup_warehouse_id || existingOrder.pickup_warehouse_id || null
    let assignedWarehouse = null

    if (status === 'Approved' && pickupOrder) {
      if (!resolvedWarehouseId) {
        return res.status(400).json({ error: 'pickup_warehouse_id is required for Pickup & Drive orders' })
      }

      assignedWarehouse = await getWarehouseDetails(resolvedWarehouseId)
      if (!assignedWarehouse) {
        return res.status(404).json({ error: 'Selected pickup warehouse was not found. Please create warehouses first.' })
      }
    }

    const updatePayload = { status }
    if (status === 'Approved' && pickupOrder && resolvedWarehouseId) {
      updatePayload.pickup_warehouse_id = resolvedWarehouseId
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', req.params.orderId)
      .select()

    if (error) {
      if (status === 'Approved' && pickupOrder && isMissingSchemaReferenceError(error)) {
        return res.status(500).json({ error: 'Pickup assignment columns are missing. Run ADD_PICKUP_WAREHOUSE_SUPPORT.sql.' })
      }
      throw error
    }

    const updatedOrder = Array.isArray(data) ? data[0] : data
    if (status === 'Approved' && !wasApproved && updatedOrder) {
      if (pickupOrder) {
        await notifyUserPickupOrderApproved(updatedOrder, assignedWarehouse)
      } else {
        await notifyUserOrderApproved(updatedOrder)
      }
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Convenience endpoints used by the frontend
app.patch('/api/admin/orders/:orderId/approve', requireAdminKey, async (req, res) => {
  try {
    const { pickup_warehouse_id } = req.body || {}

    const baseExistingOrderSelect = 'id, user_id, status, total_amount, payment_method, delivery_partner_id, shipping_fee, pickup_warehouse_id, pickup_available_from, pickup_available_until'
    const pickupAwareExistingOrderSelect = `${baseExistingOrderSelect}, shipping_method, pickup_order`

    let { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select(pickupAwareExistingOrderSelect)
      .eq('id', req.params.orderId)
      .maybeSingle()

    if (existingOrderError && isMissingSchemaReferenceError(existingOrderError)) {
      const fallbackResult = await supabase
        .from('orders')
        .select(baseExistingOrderSelect)
        .eq('id', req.params.orderId)
        .maybeSingle()
      existingOrder = fallbackResult.data
      existingOrderError = fallbackResult.error
    }

    if (existingOrderError) throw existingOrderError
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' })
    }

    const wasApproved = String(existingOrder.status || '').trim() === 'Approved'
    const pickupOrder = isPickupOrderRecord(existingOrder)
    const resolvedWarehouseId = pickup_warehouse_id || existingOrder.pickup_warehouse_id || null
    let assignedWarehouse = null

    if (pickupOrder) {
      if (!resolvedWarehouseId) {
        return res.status(400).json({ error: 'pickup_warehouse_id is required for Pickup & Drive orders' })
      }

      assignedWarehouse = await getWarehouseDetails(resolvedWarehouseId)
      if (!assignedWarehouse) {
        return res.status(404).json({ error: 'Selected pickup warehouse was not found. Please create warehouses first.' })
      }
    }

    const updatePayload = { status: 'Approved' }
    if (pickupOrder && resolvedWarehouseId) {
      updatePayload.pickup_warehouse_id = resolvedWarehouseId
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', req.params.orderId)
      .select()

    if (error) {
      if (pickupOrder && isMissingSchemaReferenceError(error)) {
        return res.status(500).json({ error: 'Pickup assignment columns are missing. Run ADD_PICKUP_WAREHOUSE_SUPPORT.sql.' })
      }
      throw error
    }

    const approvedOrder = Array.isArray(data) ? data[0] : data
    if (!wasApproved && approvedOrder) {
      if (pickupOrder) {
        await notifyUserPickupOrderApproved(approvedOrder, assignedWarehouse)
      } else {
        await notifyUserOrderApproved(approvedOrder)
      }
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/admin/orders/:orderId/cancel', requireAdminKey, async (req, res) => {
  try {
    const { reason } = req.body || {}
    const rejectionReason = reason || 'Order could not be processed at this time'

    // Mark order as Cancelled
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'Cancelled' })
      .eq('id', req.params.orderId)
      .select()
    if (error) throw error

    // Send order rejection email to user
    try {
      if (data && data[0]) {
        const order = data[0]
        const { data: user } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', order.user_id)
          .single()

        if (user?.email) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
          const dashboardUrl = `${frontendUrl}/dashboard/orders`

          await sendOrderRejectionEmail(user.email, {
            userName: user.full_name || 'Customer',
            orderId: order.id.slice(0, 8).toUpperCase(),
            orderDate: new Date(order.created_at).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            }),
            rejectionReason: rejectionReason,
            totalAmount: (order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            dashboardUrl: dashboardUrl,
            supportEmail: process.env.Email_User || 'support@ashirwadenterprises.com'
          })
          console.log(`Order rejection email sent to ${user.email} for order ${order.id}`)
        }
      }
    } catch (emailErr) {
      console.warn('Failed to send order rejection email:', emailErr?.message || emailErr)
      // Don't fail the cancellation if email fails
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Assign delivery partner to order (Admin)
app.patch('/api/admin/orders/:orderId/assign', requireAdminKey, async (req, res) => {
  try {
    const { orderId } = req.params
    const { delivery_partner_id } = req.body

    if (!delivery_partner_id) {
      return res.status(400).json({ error: 'delivery_partner_id is required' })
    }

    // Verify order exists
    const baseOrderSelect = 'id, status, delivery_partner_id, shipping_fee'
    const pickupAwareOrderSelect = `${baseOrderSelect}, shipping_method, pickup_order`

    let { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(pickupAwareOrderSelect)
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr && isMissingSchemaReferenceError(orderErr)) {
      const fallbackResult = await supabase
        .from('orders')
        .select(baseOrderSelect)
        .eq('id', orderId)
        .maybeSingle()
      order = fallbackResult.data
      orderErr = fallbackResult.error
    }

    if (orderErr || !order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Only allow assignment when order is Approved
    if (order.status !== 'Approved') {
      return res.status(400).json({ error: 'Order must be Approved before assigning a delivery partner' })
    }

    if (order.delivery_partner_id) {
      return res.status(400).json({ error: 'Delivery partner already assigned to this order' })
    }

    if (isPickupOrderRecord(order)) {
      return res.status(400).json({ error: 'Pickup orders do not require delivery partner assignment.' })
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
      .update({ 
        delivery_partner_id: dp.id, 
        delivery_status: 'assigned'
      })
      .eq('id', orderId)
      .select()

    if (updateErr) throw updateErr

    // Log the assignment
    try {
      await supabase
        .from('delivery_logs')
        .insert([{ 
          order_id: orderId, 
          delivery_partner_id: dp.id, 
          event_type: 'assigned', 
          event_details: { 
            assigned_to: dp.delivery_partner_id, 
            timestamp: new Date().toISOString() 
          } 
        }])
    } catch (logErr) {
      console.warn('Failed to log assignment:', logErr?.message)
      // Don't fail the assignment if logging fails
    }

    // Send notification to user about delivery partner assignment
    try {
      const { data: fullOrder } = await supabase
        .from('orders')
        .select('id, user_id, total_amount, payment_method')
        .eq('id', orderId)
        .single()
      if (fullOrder) {
        await notifyUserDeliveryPartnerAssigned(fullOrder, dp.id)
      }
    } catch (notifErr) {
      console.warn('Failed to send assignment notification:', notifErr?.message)
    }

    res.json({ message: 'Order assigned to delivery partner', order: updated?.[0] || null })
  } catch (err) {
    console.error('Assign order error:', err)
    res.status(500).json({ error: err.message || 'Failed to assign delivery partner' })
  }
})

// Admin endpoint to manually confirm user email
app.post('/api/admin/confirm-user-email', requireAdminKey, async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) {
      return res.status(400).json({ error: 'userId required' })
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirmed_at: new Date().toISOString()
    })

    if (error) throw error
    res.json({ success: true, message: 'Email confirmed for user', data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Support contact endpoint (sends inquiry to admin email)
app.post('/api/support/contact', async (req, res) => {
  try {
    const transporter = ensureTransporter()
    if (!transporter) {
      return res.status(503).json({ error: 'Email service not available. Please try later.' })
    }

    const { name, email, subject, message, userId } = req.body || {}
    const trimmedName = (name || '').trim()
    const trimmedEmail = (email || '').trim().toLowerCase()
    const trimmedSubject = (subject || '').trim()
    const trimmedMessage = (message || '').trim()

    if (!trimmedName || !trimmedEmail || !trimmedSubject || !trimmedMessage) {
      return res.status(400).json({ error: 'All fields are required.' })
    }

    const adminEmail = process.env.Email_User
    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 12px;">
        <h2 style="margin: 0 0 8px; color: #0b5fff;">New Support Inquiry</h2>
        <p style="margin: 0 0 12px; color: #4b5563;">Received from logged-in user.</p>
        <div style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; background: #f8fafc; margin-bottom: 12px;">
          <div><strong>Name:</strong> ${trimmedName}</div>
          <div><strong>Email:</strong> ${trimmedEmail}</div>
          ${userId ? `<div><strong>User ID:</strong> ${userId}</div>` : ''}
          <div><strong>Subject:</strong> ${trimmedSubject}</div>
        </div>
        <div style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; background: #fff; white-space: pre-wrap; line-height: 1.6; color: #111827;">
          ${trimmedMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </div>
        <p style="margin-top: 14px; color: #6b7280;">Please respond within 2-3 business days.</p>
      </div>
    `

    await transporter.sendMail({
      from: `"ASHIRWAD ENTERPRISES" <${adminEmail}>`,
      to: adminEmail,
      replyTo: trimmedEmail,
      subject: `Support Inquiry: ${trimmedSubject}`,
      html
    })

    res.json({ success: true, message: 'Inquiry sent. We will reply within 2-3 working days.' })
  } catch (err) {
    console.error('Support contact error:', err)
    res.status(500).json({ error: 'Failed to send inquiry. Please try later.' })
  }
})

// Admin endpoint: confirm email by email (helps when userId unknown)
app.post('/api/admin/confirm-user-email-by-email', requireAdminKey, async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'email required' })
    const target = email.trim().toLowerCase()

    // list users (paginate once; adjust perPage if many users)
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) throw error

    const user = data.users.find((u) => (u.email || '').toLowerCase() === target)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const { data: updated, error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email_confirmed_at: new Date().toISOString()
    })
    if (updErr) throw updErr

    return res.json({ success: true, user: { id: updated.user.id, email: updated.user.email, email_confirmed_at: updated.user.email_confirmed_at } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================
// Admin Coupon Management Endpoints
// ============================================

// Get all coupons (Admin)
app.get('/api/admin/coupons', requireAdminKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('code', { ascending: true })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create coupon (Admin)
app.post('/api/admin/coupons', requireAdminKey, async (req, res) => {
  try {
    const { code, type, value, min_amount, active, valid_from, valid_to, headline, product_id, auto_apply } = req.body
    
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Coupon code is required' })
    }
    if (!type || !['flat', 'percent'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "flat" or "percent"' })
    }
    if (!value || Number(value) <= 0) {
      return res.status(400).json({ error: 'Value must be greater than 0' })
    }

    const normalizedCode = code.trim().toUpperCase()
    
    const { data, error } = await supabase
      .from('coupons')
      .insert([{
        code: normalizedCode,
        type,
        value: Number(value),
        min_amount: Number(min_amount) || 0,
        active: active !== false,
        valid_from: valid_from || new Date().toISOString(),
        valid_to: valid_to || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        headline: headline?.trim() || null,
        product_id: product_id || null,
        auto_apply: Boolean(auto_apply)
      }])
      .select()
    
    if (error) {
      if (error.code === '23505') { // Duplicate key
        return res.status(409).json({ error: 'Coupon code already exists' })
      }
      throw error
    }
    
    res.status(201).json(data[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update coupon (Admin)
app.put('/api/admin/coupons/:code', requireAdminKey, async (req, res) => {
  try {
    const { type, value, min_amount, active, valid_from, valid_to, headline, product_id, auto_apply } = req.body
    const code = req.params.code.toUpperCase()
    
    const updateData = {}
    if (type !== undefined) {
      if (!['flat', 'percent'].includes(type)) {
        return res.status(400).json({ error: 'Type must be either "flat" or "percent"' })
      }
      updateData.type = type
    }
    if (value !== undefined) {
      if (Number(value) <= 0) {
        return res.status(400).json({ error: 'Value must be greater than 0' })
      }
      updateData.value = Number(value)
    }
    if (min_amount !== undefined) updateData.min_amount = Number(min_amount)
    if (active !== undefined) updateData.active = active
    if (valid_from !== undefined) updateData.valid_from = valid_from
    if (valid_to !== undefined) updateData.valid_to = valid_to
    if (headline !== undefined) updateData.headline = headline?.trim() || null
    if (product_id !== undefined) updateData.product_id = product_id || null
    if (auto_apply !== undefined) updateData.auto_apply = Boolean(auto_apply)
    
    const { data, error } = await supabase
      .from('coupons')
      .update(updateData)
      .eq('code', code)
      .select()
    
    if (error) throw error
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' })
    }
    
    res.json(data[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete coupon (Admin)
app.delete('/api/admin/coupons/:code', requireAdminKey, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase()
    
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('code', code)
    
    if (error) throw error
    res.json({ success: true, message: 'Coupon deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================
// Manager Coupon Management Endpoints
// ============================================

// Get all coupons (Manager)
app.get('/api/manager/coupons', requireManagerAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('code', { ascending: true })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create coupon (Manager)
app.post('/api/manager/coupons', requireManagerAuth, async (req, res) => {
  try {
    const { code, type, value, min_amount, active, valid_from, valid_to, headline, product_id, auto_apply } = req.body

    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Coupon code is required' })
    }
    if (!type || !['flat', 'percent'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "flat" or "percent"' })
    }
    if (!value || Number(value) <= 0) {
      return res.status(400).json({ error: 'Value must be greater than 0' })
    }

    const normalizedCode = code.trim().toUpperCase()

    const { data, error } = await supabase
      .from('coupons')
      .insert([{
        code: normalizedCode,
        type,
        value: Number(value),
        min_amount: Number(min_amount) || 0,
        active: active !== false,
        valid_from: valid_from || new Date().toISOString(),
        valid_to: valid_to || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        headline: headline?.trim() || null,
        product_id: product_id || null,
        auto_apply: Boolean(auto_apply)
      }])
      .select()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Coupon code already exists' })
      }
      throw error
    }

    res.status(201).json(data[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update coupon (Manager)
app.put('/api/manager/coupons/:code', requireManagerAuth, async (req, res) => {
  try {
    const { type, value, min_amount, active, valid_from, valid_to, headline, product_id, auto_apply } = req.body
    const code = req.params.code.toUpperCase()

    const updateData = {}
    if (type !== undefined) {
      if (!['flat', 'percent'].includes(type)) {
        return res.status(400).json({ error: 'Type must be either "flat" or "percent"' })
      }
      updateData.type = type
    }
    if (value !== undefined) {
      if (Number(value) <= 0) {
        return res.status(400).json({ error: 'Value must be greater than 0' })
      }
      updateData.value = Number(value)
    }
    if (min_amount !== undefined) updateData.min_amount = Number(min_amount)
    if (active !== undefined) updateData.active = active
    if (valid_from !== undefined) updateData.valid_from = valid_from
    if (valid_to !== undefined) updateData.valid_to = valid_to
    if (headline !== undefined) updateData.headline = headline?.trim() || null
    if (product_id !== undefined) updateData.product_id = product_id || null
    if (auto_apply !== undefined) updateData.auto_apply = Boolean(auto_apply)

    const { data, error } = await supabase
      .from('coupons')
      .update(updateData)
      .eq('code', code)
      .select()

    if (error) throw error
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    res.json(data[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete coupon (Manager)
app.delete('/api/manager/coupons/:code', requireManagerAuth, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase()

    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('code', code)

    if (error) throw error
    res.json({ success: true, message: 'Coupon deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================
// Public Coupon Validation Endpoint
// ============================================

app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, total, items, user_id } = req.body || {}
    const normalizedCode = (code || '').trim().toUpperCase()

    if (!normalizedCode) {
      return res.status(400).json({ error: 'Coupon code is required' })
    }
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required to validate coupon' })
    }

    // Check if user has already used this coupon
    const { data: usageRows, error: usageError } = await supabase
      .from('coupon_usages')
      .select('id')
      .eq('user_id', user_id)
      .eq('coupon_code', normalizedCode)
      .limit(1)

    if (usageError) throw usageError
    if (Array.isArray(usageRows) && usageRows.length > 0) {
      return res.json({ valid: false, reason: 'COUPON_ALREADY_USED' })
    }

    const orderTotal = Number(total) || 0
    const cartItems = Array.isArray(items) ? items : []

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', normalizedCode)
      .eq('active', true)
      .limit(1)

    if (error) throw error

    const coupon = Array.isArray(data) ? data[0] : null
    if (!coupon) {
      return res.json({ valid: false, reason: 'NOT_FOUND' })
    }

    const now = new Date()
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return res.json({ valid: false, reason: 'NOT_STARTED', validFrom: coupon.valid_from })
    }
    if (coupon.valid_to && new Date(coupon.valid_to) < now) {
      return res.json({ valid: false, reason: 'EXPIRED', validTo: coupon.valid_to })
    }

    const minimumAmount = Number(coupon.min_amount || 0)
    if (orderTotal < minimumAmount) {
      return res.json({ valid: false, reason: 'MIN_AMOUNT_NOT_MET', minimumAmount })
    }

    if (coupon.product_id) {
      const matchesProduct = cartItems.some((item) => {
        const candidate = item?.product_id || item?.productId || item?.product?.id || item?.id
        return candidate && String(candidate).toLowerCase() === String(coupon.product_id).toLowerCase()
      })
      if (!matchesProduct) {
        return res.json({ valid: false, reason: 'PRODUCT_NOT_IN_CART', productId: coupon.product_id })
      }
    }

    const couponValue = Number(coupon.value || 0)
    let discountValue = 0
    if (coupon.type === 'percent') {
      discountValue = (orderTotal * couponValue) / 100
    } else {
      discountValue = couponValue
    }

    discountValue = Math.min(orderTotal, Math.max(0, discountValue))

    if (discountValue <= 0) {
      return res.json({ valid: false, reason: 'NO_DISCOUNT' })
    }

    return res.json({
      valid: true,
      discount: Number(discountValue.toFixed(2)),
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: couponValue,
        minimumAmount,
        headline: coupon.headline || null,
        productId: coupon.product_id || null,
        autoApply: Boolean(coupon.auto_apply)
      }
    })
  } catch (err) {
    console.error('Coupon validation failed:', err)
    res.status(500).json({ error: err.message || 'Coupon validation failed' })
  }
})

// ============================================
// Admin Offer Management Endpoints
// ============================================

app.get('/api/admin/offers', requireAdminKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('offers')
      .select('id, title, message, active, start_at, end_at, product_id, created_at, updated_at, discount_type, discount_value, minimum_amount, product:products(id, name, category, price)')
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code === '42P01') {
        console.warn('Offers table not found. Returning empty list. Run ADD_OFFERS_TABLE.sql to enable offers module.')
        return res.json([])
      }
      if (error.code === '42703' || /discount_/.test(error.message || '')) {
        console.warn('Offers table missing discount columns. Returning guidance to run migration.')
        return res.status(500).json({ error: 'Offers table is missing discount fields. Run database/ADD_OFFERS_DISCOUNT_COLUMNS.sql in Supabase SQL editor.' })
      }
      throw error
    }

    res.json((Array.isArray(data) ? data : []).map(normalizeOfferRow))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/admin/offers', requireAdminKey, async (req, res) => {
  try {
    const { title, message, productId, startAt, endAt, active, discountType, discountValue, minimumAmount } = req.body || {}

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' })
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }
    const normalizedDiscountType = (discountType || 'flat').toLowerCase()
    if (!['flat', 'percent'].includes(normalizedDiscountType)) {
      return res.status(400).json({ error: 'Discount type must be flat or percent' })
    }
    const numericDiscountValue = Number(discountValue)
    if (!Number.isFinite(numericDiscountValue) || numericDiscountValue <= 0) {
      return res.status(400).json({ error: 'Discount value must be greater than 0' })
    }
    const numericMinimumAmount = Number(minimumAmount || 0)
    if (!Number.isFinite(numericMinimumAmount) || numericMinimumAmount < 0) {
      return res.status(400).json({ error: 'Minimum amount cannot be negative' })
    }
    if (normalizedDiscountType === 'percent' && numericDiscountValue > 100) {
      return res.status(400).json({ error: 'Percentage discount cannot exceed 100' })
    }

    const startIso = startAt ? new Date(startAt).toISOString() : new Date().toISOString()
    const endIso = endAt ? new Date(endAt).toISOString() : null

    if (endIso && new Date(endIso) <= new Date(startIso)) {
      return res.status(400).json({ error: 'End time must be after start time' })
    }

    const nowIso = new Date().toISOString()
    const insertData = {
      title: title.trim(),
      message: message.trim(),
      discount_type: normalizedDiscountType,
      discount_value: numericDiscountValue,
      minimum_amount: numericMinimumAmount,
      product_id: productId || null,
      start_at: startIso,
      end_at: endIso,
      active: active === undefined ? true : !!active,
      created_at: nowIso,
      updated_at: nowIso
    }

    const { data, error } = await supabase
      .from('offers')
      .insert([insertData])
      .select('id, title, message, active, start_at, end_at, product_id, created_at, updated_at, discount_type, discount_value, minimum_amount, product:products(id, name, category, price)')
      .single()

    if (error) throw error

    res.status(201).json(normalizeOfferRow(data))
  } catch (err) {
    if (err?.code === '42P01') {
      console.warn('Offers table missing during offer creation.')
      return res.status(500).json({ error: 'Offers table not found. Run database/ADD_OFFERS_TABLE.sql in Supabase SQL editor.' })
    }
    if (err?.code === '42703' || /discount_/.test(err?.message || '')) {
      console.warn('Offers table missing discount columns during offer creation.')
      return res.status(500).json({ error: 'Offers table missing discount columns. Run database/ADD_OFFERS_DISCOUNT_COLUMNS.sql in Supabase SQL editor.' })
    }
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/admin/offers/:id', requireAdminKey, async (req, res) => {
  try {
    const offerId = req.params.id
    const { title, message, productId, startAt, endAt, active, discountType, discountValue, minimumAmount } = req.body || {}

    const { data: existing, error: fetchError } = await supabase
      .from('offers')
      .select('id, start_at, end_at, discount_type')
      .eq('id', offerId)
      .single()

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Offer not found' })
    }

    const updates = {}
    if (title !== undefined) {
      if (!title || !title.trim()) return res.status(400).json({ error: 'Title cannot be empty' })
      updates.title = title.trim()
    }
    if (message !== undefined) {
      if (!message || !message.trim()) return res.status(400).json({ error: 'Message cannot be empty' })
      updates.message = message.trim()
    }
    if (discountType !== undefined) {
      const normalizedDiscountType = (discountType || 'flat').toLowerCase()
      if (!['flat', 'percent'].includes(normalizedDiscountType)) {
        return res.status(400).json({ error: 'Discount type must be flat or percent' })
      }
      updates.discount_type = normalizedDiscountType
    }
    if (discountValue !== undefined) {
      const numericDiscountValue = Number(discountValue)
      if (!Number.isFinite(numericDiscountValue) || numericDiscountValue <= 0) {
        return res.status(400).json({ error: 'Discount value must be greater than 0' })
      }
      if ((updates.discount_type || existing.discount_type) === 'percent' && numericDiscountValue > 100) {
        return res.status(400).json({ error: 'Percentage discount cannot exceed 100' })
      }
      updates.discount_value = numericDiscountValue
    }
    if (minimumAmount !== undefined) {
      const numericMinimumAmount = Number(minimumAmount)
      if (!Number.isFinite(numericMinimumAmount) || numericMinimumAmount < 0) {
        return res.status(400).json({ error: 'Minimum amount cannot be negative' })
      }
      updates.minimum_amount = numericMinimumAmount
    }
    if (productId !== undefined) updates.product_id = productId || null
    if (startAt !== undefined) updates.start_at = startAt ? new Date(startAt).toISOString() : null
    if (endAt !== undefined) updates.end_at = endAt ? new Date(endAt).toISOString() : null
    if (active !== undefined) updates.active = !!active

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    const startValue = updates.start_at !== undefined ? updates.start_at : existing.start_at
    const endValue = updates.end_at !== undefined ? updates.end_at : existing.end_at
    if (startValue && endValue && new Date(endValue) <= new Date(startValue)) {
      return res.status(400).json({ error: 'End time must be after start time' })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('offers')
      .update(updates)
      .eq('id', offerId)
      .select('id, title, message, active, start_at, end_at, product_id, created_at, updated_at, discount_type, discount_value, minimum_amount, product:products(id, name, category, price)')
      .single()

    if (error) throw error

    res.json(normalizeOfferRow(data))
  } catch (err) {
    if (err?.code === '42P01') {
      console.warn('Offers table missing during offer update.')
      return res.status(500).json({ error: 'Offers table not found. Run database/ADD_OFFERS_TABLE.sql in Supabase SQL editor.' })
    }
    if (err?.code === '42703' || /discount_/.test(err?.message || '')) {
      console.warn('Offers table missing discount columns during offer update.')
      return res.status(500).json({ error: 'Offers table missing discount columns. Run database/ADD_OFFERS_DISCOUNT_COLUMNS.sql in Supabase SQL editor.' })
    }
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/admin/offers/:id', requireAdminKey, async (req, res) => {
  try {
    const offerId = req.params.id
    const { error } = await supabase
      .from('offers')
      .delete()
      .eq('id', offerId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================
// Public Offers Endpoint
// ============================================

app.get('/api/offers', async (req, res) => {
  try {
    const now = new Date()
    const userId = req.query.user_id // Optional: filter out already-used offers for this user

    const { data, error } = await supabase
      .from('offers')
      .select('id, title, message, active, start_at, end_at, product_id, discount_type, discount_value, minimum_amount, product:products(id, name, category, price)')
      .eq('active', true)
      .order('start_at', { ascending: true })

    if (error) throw error

    let usedOfferIds = []
    // If user_id provided, check which offers they've already used
    if (userId) {
      try {
        const { data: usageData, error: usageError } = await supabase
          .from('offer_usages')
          .select('offer_id')
          .eq('user_id', userId)
        
        if (!usageError && Array.isArray(usageData)) {
          usedOfferIds = usageData.map(row => row.offer_id)
        }
      } catch (err) {
        // If offer_usages table doesn't exist yet, continue without filtering
        console.warn('Offer usage check failed (table may not exist):', err.message)
      }
    }

    const offers = (Array.isArray(data) ? data : [])
      .filter((row) => {
        // Filter out offers user has already used
        if (usedOfferIds.includes(row.id)) {
          return false
        }
        const startsOk = !row.start_at || new Date(row.start_at) <= now
        const endsOk = !row.end_at || new Date(row.end_at) >= now
        return startsOk && endsOk
      })
      .sort((a, b) => {
        const aDate = a.end_at ? new Date(a.end_at).getTime() : Infinity
        const bDate = b.end_at ? new Date(b.end_at).getTime() : Infinity
        return aDate - bDate
      })
      .map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        productId: row.product_id,
        productName: row.product?.name || null,
        productCategory: row.product?.category || null,
        productPrice: row.product?.price || null,
        discountType: row.discount_type,
        discountValue: row.discount_value,
        minimumAmount: row.minimum_amount,
        startAt: row.start_at,
        endAt: row.end_at,
        active: row.active
      }))

    res.json(offers)
  } catch (err) {
    if (err?.code === '42P01' || /relation "offers" does not exist/i.test(err?.message || '')) {
      console.warn('Offers table missing; returning empty list for public endpoint.')
      return res.json([])
    }
    console.error('Offers endpoint error:', err)
    res.status(500).json({ error: 'Failed to load offers.' })
  }
})

// ============================================
// Admin Warehouse Management
// ============================================

const WAREHOUSE_ADMIN_SELECT_FIELDS = 'id, name, address, contact_number, password_set_at, created_at, updated_at'

app.get('/api/admin/warehouses', requireAdminKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select(WAREHOUSE_ADMIN_SELECT_FIELDS)
      .order('created_at', { ascending: false })

    if (error) {
      if (isMissingSchemaReferenceError(error, 'warehouses')) {
        return res.status(500).json({ error: 'Warehouse management table is missing. Please run ADD_PICKUP_WAREHOUSE_SUPPORT.sql.' })
      }
      throw error
    }

    res.json(Array.isArray(data) ? data : [])
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch warehouses' })
  }
})

app.post('/api/admin/warehouses', requireAdminKey, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim()
    const address = String(req.body?.address || '').trim()
    const contactNumber = String(req.body?.contact_number || req.body?.contact || '').trim()

    if (!name || !address) {
      return res.status(400).json({ error: 'name and address are required' })
    }

    const { data: existingWarehouse, error: existingWarehouseError } = await supabase
      .from('warehouses')
      .select('id, name')
      .ilike('name', name)

    if (existingWarehouseError) {
      if (isMissingSchemaReferenceError(existingWarehouseError, 'warehouses')) {
        return res.status(500).json({ error: 'Warehouse management table is missing. Please run ADD_PICKUP_WAREHOUSE_SUPPORT.sql.' })
      }
      throw existingWarehouseError
    }

    if (Array.isArray(existingWarehouse) && existingWarehouse.some((row) => String(row?.name || '').trim().toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ error: 'A warehouse with this name already exists. Warehouse names must be unique for portal login.' })
    }

    const { data, error } = await supabase
      .from('warehouses')
      .insert([{
        name,
        address,
        contact_number: contactNumber || null
      }])
      .select(WAREHOUSE_ADMIN_SELECT_FIELDS)
      .single()

    if (error) {
      if (isMissingSchemaReferenceError(error, 'warehouses')) {
        return res.status(500).json({ error: 'Warehouse management table is missing. Please run ADD_PICKUP_WAREHOUSE_SUPPORT.sql.' })
      }
      throw error
    }

    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create warehouse' })
  }
})

app.put('/api/admin/warehouses/:id', requireAdminKey, async (req, res) => {
  try {
    const warehouseId = String(req.params.id || '').trim()
    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse id is required' })
    }

    const updateData = {}
    if (req.body?.name !== undefined) {
      const nextName = String(req.body.name || '').trim()
      if (!nextName) return res.status(400).json({ error: 'name cannot be empty' })

      const { data: conflictingWarehouses, error: conflictingWarehousesError } = await supabase
        .from('warehouses')
        .select('id, name')
        .ilike('name', nextName)

      if (conflictingWarehousesError) {
        if (isMissingSchemaReferenceError(conflictingWarehousesError, 'warehouses')) {
          return res.status(500).json({ error: 'Warehouse management table is missing. Please run ADD_PICKUP_WAREHOUSE_SUPPORT.sql.' })
        }
        throw conflictingWarehousesError
      }

      const hasConflict = Array.isArray(conflictingWarehouses) && conflictingWarehouses.some((row) => row.id !== warehouseId && String(row?.name || '').trim().toLowerCase() === nextName.toLowerCase())
      if (hasConflict) {
        return res.status(400).json({ error: 'A warehouse with this name already exists. Warehouse names must be unique for portal login.' })
      }

      updateData.name = nextName
    }
    if (req.body?.address !== undefined) {
      const nextAddress = String(req.body.address || '').trim()
      if (!nextAddress) return res.status(400).json({ error: 'address cannot be empty' })
      updateData.address = nextAddress
    }
    if (req.body?.contact_number !== undefined || req.body?.contact !== undefined) {
      const nextContact = String(req.body?.contact_number || req.body?.contact || '').trim()
      updateData.contact_number = nextContact || null
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No updates provided' })
    }

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('warehouses')
      .update(updateData)
      .eq('id', warehouseId)
      .select(WAREHOUSE_ADMIN_SELECT_FIELDS)
      .maybeSingle()

    if (error) {
      if (isMissingSchemaReferenceError(error, 'warehouses')) {
        return res.status(500).json({ error: 'Warehouse management table is missing. Please run ADD_PICKUP_WAREHOUSE_SUPPORT.sql.' })
      }
      throw error
    }

    if (!data) {
      return res.status(404).json({ error: 'Warehouse not found' })
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update warehouse' })
  }
})

app.delete('/api/admin/warehouses/:id', requireAdminKey, async (req, res) => {
  try {
    const warehouseId = String(req.params.id || '').trim()
    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse id is required' })
    }

    const { data: linkedOrders, error: linkedOrdersError } = await supabase
      .from('orders')
      .select('id')
      .eq('pickup_warehouse_id', warehouseId)
      .in('status', ['Pending', 'Approved'])
      .limit(1)

    if (linkedOrdersError && !isMissingSchemaReferenceError(linkedOrdersError, 'pickup_warehouse_id')) {
      throw linkedOrdersError
    }

    if (!linkedOrdersError && Array.isArray(linkedOrders) && linkedOrders.length > 0) {
      return res.status(400).json({ error: 'Warehouse is assigned to active pickup orders and cannot be deleted.' })
    }

    const { error } = await supabase
      .from('warehouses')
      .delete()
      .eq('id', warehouseId)

    if (error) {
      if (isMissingSchemaReferenceError(error, 'warehouses')) {
        return res.status(500).json({ error: 'Warehouse management table is missing. Please run ADD_PICKUP_WAREHOUSE_SUPPORT.sql.' })
      }
      throw error
    }

    res.json({ success: true, message: 'Warehouse deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete warehouse' })
  }
})

// ============================================
// Admin Financials, Salaries & Refunds Management
// ============================================

// 1) Update manager's base salary and payroll schedule
app.put('/api/admin/managers/:id/salary-config', requireAdminKey, async (req, res) => {
  try {
    const { id } = req.params
    const baseSalary = parseFloat(req.body.base_salary)
    const payrollSchedule = String(req.body.payroll_schedule || 'monthly').trim()

    if (isNaN(baseSalary) || baseSalary < 0) {
      return res.status(400).json({ error: 'Please enter a valid non-negative base salary.' })
    }

    const { data, error } = await supabase
      .from('managers')
      .update({ base_salary: baseSalary, payroll_schedule: payrollSchedule })
      .eq('id', id)
      .select()

    if (error) throw error
    res.json({ success: true, manager: data[0] })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update manager salary configuration' })
  }
})

// 2) Calculate Delivery Partner salary details dynamically for a pay period
app.get('/api/admin/salaries/calculate-delivery-partner', requireAdminKey, async (req, res) => {
  try {
    const { delivery_partner_id, start_date, end_date } = req.query
    if (!delivery_partner_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'delivery_partner_id, start_date, and end_date are required' })
    }

    // Fetch delivery partner details
    const { data: partner, error: partnerError } = await supabase
      .from('delivery_partners')
      .select('*')
      .eq('id', delivery_partner_id)
      .maybeSingle()

    if (partnerError || !partner) {
      return res.status(404).json({ error: 'Delivery partner not found' })
    }

    // Fetch approved bank account
    const { data: bankAccount, error: bankError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('delivery_partner_id', delivery_partner_id)
      .eq('approval_status', 'approved')
      .maybeSingle()

    // Query attendance records in date range
    const { data: attendance, error: attendanceError } = await supabase
      .from('delivery_partner_attendance')
      .select('attendance_date, day_fraction, working_status')
      .eq('delivery_partner_id', delivery_partner_id)
      .gte('attendance_date', start_date)
      .lte('attendance_date', end_date)

    if (attendanceError) throw attendanceError

    let payableDays = 0
    let daysPresent = 0
    if (Array.isArray(attendance)) {
      attendance.forEach(row => {
        const val = parseFloat(row.day_fraction || 0)
        payableDays += val
        if (row.working_status === 'present' || row.working_status === 'manual' || val > 0) {
          daysPresent++
        }
      })
    }

    // Query completed deliveries in date range (delivered_at between start_date 00:00:00 and end_date 23:59:59)
    const startTimestamp = `${start_date}T00:00:00.000Z`
    const endTimestamp = `${end_date}T23:59:59.999Z`

    const { data: completedOrders, error: orderError } = await supabase
      .from('orders')
      .select('id, total_amount, delivered_at')
      .eq('delivery_partner_id', delivery_partner_id)
      .eq('delivery_status', 'delivered')
      .gte('delivered_at', startTimestamp)
      .lte('delivered_at', endTimestamp)

    if (orderError) throw orderError

    const completedCount = Array.isArray(completedOrders) ? completedOrders.length : 0
    const baseSalaryRate = parseFloat(partner.salary_per_day || 0)
    const payPerDeliveryRate = parseFloat(partner.pay_per_delivery || 50.00)

    const baseSalaryCalculated = payableDays * baseSalaryRate
    const deliveryIncentiveCalculated = completedCount * payPerDeliveryRate

    res.json({
      success: true,
      partner,
      payable_days: payableDays,
      days_present: daysPresent,
      completed_deliveries: completedCount,
      base_salary: baseSalaryCalculated,
      delivery_incentives: deliveryIncentiveCalculated,
      salary_per_day: baseSalaryRate,
      pay_per_delivery: payPerDeliveryRate,
      approved_bank_account: bankAccount || null
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to calculate salary' })
  }
})

// 3) Initiate Salary Payment
app.post('/api/admin/salaries/initiate', requireAdminKey, async (req, res) => {
  try {
    const {
      manager_id,
      delivery_partner_id,
      pay_period_start,
      pay_period_end,
      working_days,
      days_present,
      completed_deliveries,
      base_salary,
      incentives,
      deductions,
      net_salary,
      remarks,
      payment_status
    } = req.body

    if (!pay_period_start || !pay_period_end) {
      return res.status(400).json({ error: 'pay_period_start and pay_period_end are required.' })
    }

    if (new Date(pay_period_end) < new Date(pay_period_start)) {
      return res.status(400).json({ error: 'Pay period end date cannot be before start date.' })
    }

    // Ensure recipient has approved bank account
    let bankQuery = supabase.from('bank_accounts').select('id').eq('approval_status', 'approved')
    if (manager_id) {
      bankQuery = bankQuery.eq('manager_id', manager_id)
    } else if (delivery_partner_id) {
      bankQuery = bankQuery.eq('delivery_partner_id', delivery_partner_id)
    } else {
      return res.status(400).json({ error: 'Either manager_id or delivery_partner_id must be provided' })
    }

    const { data: approvedBank, error: bankError } = await bankQuery.maybeSingle()
    if (bankError || !approvedBank) {
      return res.status(400).json({ error: 'Salary payout cannot be initiated. A bank account must be added and approved by Admin for this profile first.' })
    }

    // ── Duplicate period check ─────────────────────────────────────────────
    // Block if any existing salary record for this recipient overlaps the
    // requested pay period (i.e. existing.start <= new.end AND existing.end >= new.start).
    let dupQuery = supabase
      .from('salaries')
      .select('id, pay_period_start, pay_period_end, payment_status')
      .lte('pay_period_start', pay_period_end)   // existing start <= new end
      .gte('pay_period_end',   pay_period_start)  // existing end   >= new start

    if (manager_id) {
      dupQuery = dupQuery.eq('manager_id', manager_id)
    } else {
      dupQuery = dupQuery.eq('delivery_partner_id', delivery_partner_id)
    }

    const { data: existing, error: dupError } = await dupQuery
    if (dupError) throw dupError

    if (existing && existing.length > 0) {
      const dup = existing[0]
      return res.status(409).json({
        error: `A salary record for this period already exists (${dup.pay_period_start} → ${dup.pay_period_end}, status: ${dup.payment_status}). Please choose a different date range or update the existing record.`
      })
    }
    // ──────────────────────────────────────────────────────────────────────

    const insertData = {
      manager_id: manager_id || null,
      delivery_partner_id: delivery_partner_id || null,
      pay_period_start,
      pay_period_end,
      working_days: parseFloat(working_days || 0),
      days_present: parseFloat(days_present || 0),
      completed_deliveries: parseInt(completed_deliveries || 0, 10),
      base_salary: parseFloat(base_salary || 0),
      incentives: parseFloat(incentives || 0),
      deductions: parseFloat(deductions || 0),
      net_salary: parseFloat(net_salary || 0),
      remarks: remarks || '',
      payment_status: payment_status || 'pending',
      bank_account_id: approvedBank.id
    }

    if (insertData.payment_status === 'paid') {
      insertData.payment_date = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('salaries')
      .insert(insertData)
      .select()

    if (error) throw error
    res.json({ success: true, salary: data[0] })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to initiate salary' })
  }
})

// 4) Get Salary History
app.get('/api/admin/salaries/history', requireAdminKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('salaries')
      .select(`
        *,
        managers (full_name, email),
        delivery_partners (name, email, delivery_partner_id),
        bank_accounts (bank_name, account_number, account_holder_name, ifsc_code)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(Array.isArray(data) ? data : [])
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch salary history' })
  }
})

// 5) Update Salary Status
app.patch('/api/admin/salaries/:id/status', requireAdminKey, async (req, res) => {
  try {
    const { id } = req.params
    const { payment_status, transaction_id, remarks } = req.body

    const updateData = {
      payment_status,
      updated_at: new Date().toISOString()
    }
    if (transaction_id !== undefined) updateData.transaction_id = transaction_id
    if (remarks !== undefined) updateData.remarks = remarks

    if (payment_status === 'paid') {
      updateData.payment_date = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('salaries')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) throw error
    res.json({ success: true, salary: data[0] })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update salary status' })
  }
})

// 6) Initiate Refund
app.post('/api/admin/refunds/initiate', requireAdminKey, async (req, res) => {
  try {
    const { order_id, amount, remarks } = req.body
    if (!order_id || !amount) {
      return res.status(400).json({ error: 'order_id and amount are required' })
    }

    // Fetch order to get user_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, total_amount')
      .eq('id', order_id)
      .maybeSingle()

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Ensure customer has approved bank account
    const { data: approvedBank, error: bankError } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('user_id', order.user_id)
      .eq('approval_status', 'approved')
      .maybeSingle()

    if (bankError || !approvedBank) {
      return res.status(400).json({ error: 'Refund cannot be initiated. The customer must have a bank account added and approved by Admin first.' })
    }

    const insertData = {
      user_id: order.user_id,
      order_id: order.id,
      amount: parseFloat(amount),
      remarks: remarks || '',
      payment_status: 'pending',
      bank_account_id: approvedBank.id
    }

    const { data, error } = await supabase
      .from('refunds')
      .insert(insertData)
      .select()

    if (error) throw error
    res.json({ success: true, refund: data[0] })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to initiate refund' })
  }
})

// 7) Get Refund History
app.get('/api/admin/refunds/history', requireAdminKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('refunds')
      .select(`
        *,
        users (full_name, email),
        orders (total_amount, payment_method),
        bank_accounts (bank_name, account_number, account_holder_name, ifsc_code)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(Array.isArray(data) ? data : [])
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch refund history' })
  }
})

// 8) Update Refund Status
app.patch('/api/admin/refunds/:id/status', requireAdminKey, async (req, res) => {
  try {
    const { id } = req.params
    const { payment_status, transaction_id, remarks } = req.body

    const updateData = {
      payment_status,
      updated_at: new Date().toISOString()
    }
    if (transaction_id !== undefined) updateData.transaction_id = transaction_id
    if (remarks !== undefined) updateData.remarks = remarks

    if (payment_status === 'completed') {
      updateData.payment_date = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('refunds')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) throw error
    res.json({ success: true, refund: data[0] })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update refund status' })
  }
})

// 9) Consolidated Financial Records (consolidated payout log)
app.get('/api/admin/financials/records', requireAdminKey, async (req, res) => {
  try {
    const { data: salaries, error: sErr } = await supabase
      .from('salaries')
      .select(`
        *,
        managers (full_name, email),
        delivery_partners (name, email, delivery_partner_id),
        bank_accounts (bank_name, account_number, account_holder_name, ifsc_code)
      `)

    if (sErr) throw sErr

    const { data: refunds, error: rErr } = await supabase
      .from('refunds')
      .select(`
        *,
        users (full_name, email),
        bank_accounts (bank_name, account_number, account_holder_name, ifsc_code)
      `)

    if (rErr) throw rErr

    const unified = []

    if (Array.isArray(salaries)) {
      salaries.forEach(s => {
        let recipientName = 'N/A'
        let recipientEmail = 'N/A'
        if (s.managers) {
          recipientName = s.managers.full_name
          recipientEmail = s.managers.email
        } else if (s.delivery_partners) {
          recipientName = s.delivery_partners.name
          recipientEmail = s.delivery_partners.email
        }

        unified.push({
          id: s.id,
          type: 'Salary',
          recipient_name: recipientName,
          recipient_email: recipientEmail,
          amount: parseFloat(s.net_salary || 0),
          date: s.payment_date || s.created_at,
          status: s.payment_status,
          transaction_id: s.transaction_id || '',
          remarks: s.remarks || '',
          bank_name: s.bank_accounts?.bank_name || '',
          account_number: s.bank_accounts?.account_number || ''
        })
      })
    }

    if (Array.isArray(refunds)) {
      refunds.forEach(r => {
        unified.push({
          id: r.id,
          type: 'Refund',
          recipient_name: r.users?.full_name || 'N/A',
          recipient_email: r.users?.email || 'N/A',
          amount: parseFloat(r.amount || 0),
          date: r.payment_date || r.created_at,
          status: r.payment_status,
          transaction_id: r.transaction_id || '',
          remarks: r.remarks || '',
          bank_name: r.bank_accounts?.bank_name || '',
          account_number: r.bank_accounts?.account_number || ''
        })
      })
    }

    // Sort unified chronologically, descending
    unified.sort((a, b) => new Date(b.date) - new Date(a.date))

    res.json(unified)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch consolidated records' })
  }
})

// ============================================
// Admin Delivery Partners Management
// ============================================

function sanitizeDeliveryPartnerPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10)
}

// Get all delivery partners (Admin)
app.get('/api/admin/delivery-partners', requireAdminKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('delivery_partners')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create delivery partner (Admin)
app.post('/api/admin/delivery-partners', requireAdminKey, async (req, res) => {
  try {
    const { name, email, password, mobile_number, assigned_area, delivery_partner_id } = req.body
    
    if (!name || !email || !password || !mobile_number || !assigned_area) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    const normalizedMobileNumber = sanitizeDeliveryPartnerPhone(mobile_number)
    if (!/^\d{10}$/.test(normalizedMobileNumber)) {
      return res.status(400).json({ error: 'Mobile number must be exactly 10 digits' })
    }

    // Generate delivery_partner_id if not provided
    const dpId = delivery_partner_id || `DP${Date.now().toString().slice(-6)}`
    
    // For now, store password as plain text (should use bcrypt in production)
    // TODO: Replace with bcrypt.hash(password, 10)
    const passwordHash = password
    
    const { data, error } = await supabase
      .from('delivery_partners')
      .insert([{
        delivery_partner_id: dpId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        mobile_number: normalizedMobileNumber,
        assigned_area: assigned_area.trim(),
        status: 'active'
      }])
      .select()
    
    if (error) {
      if (error.code === '23505') { // Duplicate key
        return res.status(409).json({ error: 'Email or delivery partner ID already exists' })
      }
      throw error
    }
    
    res.status(201).json(data[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update delivery partner (Admin)
app.put('/api/admin/delivery-partners/:id', requireAdminKey, async (req, res) => {
  try {
    const { name, email, mobile_number, assigned_area, status, password } = req.body
    const partnerId = req.params.id
    
    // Fetch the old record BEFORE updating (for change tracking)
    const { data: oldData, error: oldError } = await supabase
      .from('delivery_partners')
      .select('*')
      .eq('id', partnerId)
      .maybeSingle()
    
    if (oldError) throw oldError
    const oldPartner = oldData || {}
    
    const updateData = {}
    if (name !== undefined) updateData.name = name.trim()
    if (email !== undefined) updateData.email = email.trim().toLowerCase()
    if (mobile_number !== undefined) {
      const normalizedMobileNumber = sanitizeDeliveryPartnerPhone(mobile_number)
      if (!/^\d{10}$/.test(normalizedMobileNumber)) {
        return res.status(400).json({ error: 'Mobile number must be exactly 10 digits' })
      }
      updateData.mobile_number = normalizedMobileNumber
    }
    if (assigned_area !== undefined) updateData.assigned_area = assigned_area.trim()
    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ error: 'Status must be either "active" or "inactive"' })
      }
      updateData.status = status
    }
    if (password !== undefined && password.trim()) {
      // TODO: Replace with bcrypt.hash(password, 10)
      updateData.password_hash = password.trim()
    }
    
    updateData.updated_at = new Date().toISOString()
    
    const { data, error } = await supabase
      .from('delivery_partners')
      .update(updateData)
      .eq('id', partnerId)
      .select()
    
    if (error) throw error
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Delivery partner not found' })
    }
    const updated = data[0]

    // Build change log for email
    const changes = {}
    if (name !== undefined && oldPartner.name !== updated.name) {
      changes.name = { before: oldPartner.name, after: updated.name }
    }
    if (email !== undefined && oldPartner.email !== updated.email) {
      changes.email = { before: oldPartner.email, after: updated.email }
    }
    if (mobile_number !== undefined && oldPartner.mobile_number !== updated.mobile_number) {
      changes.mobile_number = { before: oldPartner.mobile_number, after: updated.mobile_number }
    }
    if (assigned_area !== undefined && oldPartner.assigned_area !== updated.assigned_area) {
      changes.assigned_area = { before: oldPartner.assigned_area, after: updated.assigned_area }
    }
    if (status !== undefined && oldPartner.status !== updated.status) {
      changes.status = { before: oldPartner.status, after: updated.status }
    }

    // Attempt to send an update email to the partner (best-effort)
    try {
      if (updated.email) {
        console.log('📧 [UPDATE HANDLER] Triggering partner update email to:', updated.email)
        console.log('   Changes:', Object.keys(changes).length, 'field(s) updated')
        await sendPartnerUpdateEmail(updated.email, {
          name: updated.name,
          email: updated.email,
          mobile: updated.mobile_number,
          assigned_area: updated.assigned_area,
          status: updated.status,
          changes: changes
        })
        console.log('✅ [UPDATE HANDLER] Email sent successfully')
      } else {
        console.warn('⚠️ [UPDATE HANDLER] Partner has no email address, skipping email')
      }
    } catch (emailErr) {
      console.error('❌ [UPDATE HANDLER] Email send failed:', emailErr?.message || emailErr)
      // Do not fail the request because of email issues
    }

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete delivery partner (Admin)
app.delete('/api/admin/delivery-partners/:id', requireAdminKey, async (req, res) => {
  try {
    const partnerId = req.params.id

    try {
      await supabase
        .from('delivery_partner_access_keys')
        .delete()
        .eq('partner_id', partnerId)
    } catch (accessKeyErr) {
      console.warn('Failed to delete delivery partner access keys:', accessKeyErr?.message || accessKeyErr)
    }
    
    const { error } = await supabase
      .from('delivery_partners')
      .delete()
      .eq('id', partnerId)
    
    if (error) throw error
    res.json({ success: true, message: 'Delivery partner deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Store OTP in memory (in production, use Redis or database)
const otpStore = new Map()

// Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Send OTP endpoint
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const trimmedEmail = email.trim().toLowerCase()
    const otp = generateOTP()
    const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes

    // Store OTP
    otpStore.set(trimmedEmail, { otp, expiresAt, attempts: 0 })

    // Send OTP via configured emailer (with graceful fallback)
    try {
      const sent = await sendOtpEmail(trimmedEmail, otp)
      if (!sent) {
        console.warn('❌ Email service not configured or failed to send OTP')
        const payload = {
          success: true,
          message: 'Verification code generated. Email sending is temporarily unavailable.',
          email: trimmedEmail,
          emailSend: false
        }
        if (process.env.NODE_ENV !== 'production') {
          payload.devHint = 'Check server logs for OTP in development.'
          console.log(`DEV OTP for ${trimmedEmail}: ${otp}`)
        }
        return res.json(payload)
      }
      console.log(`✅ OTP verification email sent to ${trimmedEmail} from ASHIRWAD ENTERPRISES`)
    } catch (emailErr) {
      console.error('Failed to send OTP email:', emailErr?.message || emailErr)
      const payload = {
        success: true,
        message: 'Verification code generated. Email sending encountered an issue.',
        email: trimmedEmail,
        emailSend: false
      }
      if (process.env.NODE_ENV !== 'production') {
        payload.devHint = 'Check server logs for OTP in development.'
        console.log(`DEV OTP for ${trimmedEmail}: ${otp}`)
      }
      return res.json(payload)
    }

    res.json({ 
      success: true, 
      message: 'Verification code sent to your email. Check your inbox and spam folder.',
      email: trimmedEmail
    })
  } catch (err) {
    console.error('Send OTP error:', err.message)
    res.status(500).json({ error: 'Failed to send verification email: ' + err.message })
  }
})

// Verify OTP endpoint
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' })
    }

    const trimmedEmail = email.trim().toLowerCase()
    const storedData = otpStore.get(trimmedEmail)

    if (!storedData) {
      return res.status(400).json({ error: 'OTP not found. Please request a new OTP.' })
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(trimmedEmail)
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' })
    }

    if (storedData.attempts >= 3) {
      otpStore.delete(trimmedEmail)
      return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new OTP.' })
    }

    if (storedData.otp !== otp.toString()) {
      storedData.attempts++
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' })
    }

    // OTP verified successfully
    otpStore.delete(trimmedEmail)
    res.json({ 
      success: true, 
      message: 'Email verified successfully',
      email: trimmedEmail
    })
  } catch (err) {
    console.error('Verify OTP error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Auto-confirm user email after registration
app.post('/api/auth/confirm-email', async (req, res) => {
  try {
    const { userId, email } = req.body
    if (!userId && !email) {
      return res.status(400).json({ error: 'userId or email required' })
    }

    let targetUserId = userId

    // If email provided instead of userId, find the auth user
    if (!targetUserId && email) {
      const target = (email || '').trim().toLowerCase()
      try {
        const listResp = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const found = listResp.data.users.find(u => (u.email || '').toLowerCase() === target)
        if (!found) {
          return res.status(404).json({ error: 'Auth user not found for provided email' })
        }
        targetUserId = found.id
      } catch (e) {
        console.error('Failed to lookup user by email:', e?.message || e)
        return res.status(500).json({ error: 'Failed to lookup auth user by email' })
      }
    }

    console.log('Confirming email for user:', targetUserId)

    // Update user with email_confirmed_at to enable login
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      email_confirmed_at: new Date().toISOString()
    })

    if (error) {
      console.error('Email confirmation error:', error)
      throw error
    }

    console.log('Email confirmed successfully for user:', targetUserId)
    // Ensure a profile row exists (upsert) so the users table is populated
    try {
      const authEmail = data?.user?.email
      const fullName = data?.user?.user_metadata?.full_name || (authEmail ? authEmail.split('@')[0] : 'User')
      if (targetUserId && authEmail) {
        try {
          await supabase
            .from('users')
            .upsert([{ id: targetUserId, email: authEmail, full_name: fullName, role: 'user', is_verified: false }], { onConflict: 'id' })
        } catch (upsertErr) {
          console.warn('Failed to upsert profile after email confirm:', upsertErr?.message || upsertErr)
        }
      }
    } catch (upsertErr) {
      console.warn('Profile upsert check failed:', upsertErr?.message || upsertErr)
    }

    // Send a welcome/account-created email to the user (notes admin approval needed)
    try {
      const userEmail = data?.user?.email
      const userName = data?.user?.user_metadata?.full_name || (userEmail ? userEmail.split('@')[0] : 'User')
      const sent = await sendWelcomeEmail(userEmail, userName).catch(e => { console.warn('sendWelcomeEmail failed:', e); return false })
      if (sent) {
        console.log(`✅ Sent account-created email to ${userEmail}`)
      } else {
        console.warn('Emailer not configured or failed; skipping welcome email')
      }
    } catch (mailErr) {
      console.warn('Failed to send welcome email:', mailErr?.message || mailErr)
    }

    res.json({ 
      success: true, 
      message: 'Email confirmed successfully', 
      user: {
        id: data.user.id,
        email: data.user.email,
        email_confirmed_at: data.user.email_confirmed_at
      }
    })
  } catch (err) {
    console.error('Confirm email failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Payments config (frontend needs key_id)
app.get('/api/payments/config', (req, res) => {
  if (!process.env.RAZORPAY_KEY_ID) return res.status(200).json({ key_id: null })
  res.json({ key_id: process.env.RAZORPAY_KEY_ID })
})

// Create Razorpay order
app.post('/api/payments/create-order', async (req, res) => {
  try {
    const { amount } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' })
    if (isMockRazorpay) {
      const mockOrder = {
        id: `order_mock_${Date.now()}`,
        amount: Math.round(amt * 100),
        amount_paid: 0,
        currency: 'INR',
        status: 'created',
        receipt: null,
        notes: { mock: true }
      }
      return res.json(mockOrder)
    }
    if (!razorpay) return res.status(500).json({ error: 'Razorpay not configured' })
    const order = await razorpay.orders.create({ amount: Math.round(amt * 100), currency: 'INR' })
    res.json(order)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Generate bill as HTML (can be converted to PDF on frontend)
app.get('/api/orders/:id/bill', async (req, res) => {
  try {
    const orderId = req.params.id
    
    // Get order details
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    
    if (orderError || !orderData) {
      return res.status(404).json({ error: 'Order not found' })
    }
    
    // Get user details
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', orderData.user_id)
      .single()
    
    // Get product details for each item
    const rawItems = Array.isArray(orderData.items)
      ? orderData.items
      : (typeof orderData.items === 'string' ? JSON.parse(orderData.items || '[]') : [])
    const items = rawItems.map((item) => ({
      ...item,
      product_id: item?.product_id || item?.productId || item?.product?.id || item?.id,
      quantity: Number(item?.quantity ?? item?.qty ?? 1)
    }))
    const productsData = []

    for (const item of items) {
      if (!item.product_id) continue

      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.product_id)
        .single()
      
      if (productData) {
        productsData.push({
          ...productData,
          quantity: item.quantity || 1,
          subtotal: (productData.price || 0) * (item.quantity || 1)
        })
      }

      if (!item.slab && item.product_id) {
        const { data: slabs } = await supabase
          .from('product_slabs')
          .select('*')
          .eq('product_id', item.product_id)
          .order('min_quantity', { ascending: false })

        const orderDate = new Date(orderData.created_at || Date.now())
        item.slab = resolveApplicableSlab(Array.isArray(slabs) ? slabs : [], item.quantity, orderDate)
      }
    }
    
    // Owner/Company details
    const ownerDetails = {
      name: 'Ashirwad Enterprises',
      gst: 'GJKLJW23NJ128JH',
      contact: '6204938006',
      email: 'info@ashirwadenterprises.com',
      address: 'Gujarat, India'
    }

    let offerTitle = null
    if (orderData.offer_id) {
      try {
        const { data: offerRow } = await supabase
          .from('offers')
          .select('title')
          .eq('id', orderData.offer_id)
          .single()
        offerTitle = offerRow?.title || null
      } catch (err) {
        offerTitle = null
      }
    }
    
    // Calculate totals with 5% GST and align invoice total with stored order total
    const gstRate = 0.05
    const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

    const rawSubtotal = productsData.reduce((sum, p) => sum + (p.subtotal || 0), 0)
    const orderTotal = Number(orderData.total_amount || 0)

    const storedSubtotal = Number(orderData.subtotal || 0)
    const storedDiscount = Number(orderData.discount_total || 0)
    const storedCouponDiscount = Number(orderData.coupon_discount || 0)
    const storedOfferDiscount = Number(orderData.offer_discount || 0)
    const storedSlabDiscount = Number(orderData.Slab_discount || orderData.slab_discount || 0)
    const storedShipping = Number(orderData.shipping_fee || 0)
    const storedGst = Number(orderData.gst_amount || 0)

    const subtotal = round2(storedSubtotal > 0 ? storedSubtotal : rawSubtotal)
    const couponDiscount = round2(storedCouponDiscount > 0 ? storedCouponDiscount : 0)
    const offerDiscount = round2(storedOfferDiscount > 0 ? storedOfferDiscount : 0)
    const slabDiscountFromColumn = round2(storedSlabDiscount > 0 ? storedSlabDiscount : 0)
    let discountTotal = round2(storedDiscount > 0 ? storedDiscount : (couponDiscount + offerDiscount + slabDiscountFromColumn))

    if (discountTotal < couponDiscount + offerDiscount + slabDiscountFromColumn) {
      discountTotal = round2(couponDiscount + offerDiscount + slabDiscountFromColumn)
    }

    let shippingFee = round2(Number.isFinite(storedShipping) ? storedShipping : 0)
    let gstAmount = round2(storedGst > 0 ? storedGst : 0)

    if (!storedDiscount && !storedShipping && !storedGst && orderTotal > 0) {
      // Infer discount and shipping so invoice matches stored order total
      const candidates = [0, 500]
      let inferred = false

      for (const candidateShipping of candidates) {
        const baseBeforeGst = (orderTotal - candidateShipping) / (1 + gstRate)
        const inferredDiscount = subtotal - baseBeforeGst
        if (inferredDiscount >= -0.01 && inferredDiscount <= subtotal + 0.01) {
          discountTotal = round2(Math.max(0, inferredDiscount))
          shippingFee = round2(candidateShipping)
          inferred = true
          break
        }
      }

      if (!inferred) {
        discountTotal = 0
        shippingFee = round2(Math.max(0, orderTotal - subtotal - (subtotal * gstRate)))
      }

      gstAmount = round2(Math.max(0, (subtotal - discountTotal) * gstRate))
    } else if (!storedGst) {
      gstAmount = round2(Math.max(0, (subtotal - discountTotal) * gstRate))
    }

    let expectedTotal = round2(subtotal - discountTotal + shippingFee + gstAmount)
    let totalWithGST = orderTotal > 0 ? round2(orderTotal) : expectedTotal

    if (orderTotal > 0 && Math.abs(totalWithGST - expectedTotal) > 0.01) {
      gstAmount = round2(Math.max(0, totalWithGST - (subtotal - discountTotal + shippingFee)))
      expectedTotal = round2(subtotal - discountTotal + shippingFee + gstAmount)
    }

    const subtotalAfterDiscount = round2(Math.max(0, subtotal - discountTotal))

    const couponLabel = orderData.coupon_code ? `Coupon Discount (${orderData.coupon_code})` : 'Coupon Discount'
    const offerLabel = offerTitle ? `Offer Discount (${offerTitle})` : 'Offer Discount'

    let displayCouponDiscount = couponDiscount
    let displayOfferDiscount = offerDiscount
    if (discountTotal > 0 && displayCouponDiscount <= 0 && displayOfferDiscount <= 0) {
      if (orderData.coupon_code) {
        displayCouponDiscount = discountTotal
      } else if (orderData.offer_id) {
        displayOfferDiscount = discountTotal
      }
    }

    let slabDiscount = slabDiscountFromColumn > 0
      ? slabDiscountFromColumn
      : round2(Math.max(0, discountTotal - displayCouponDiscount - displayOfferDiscount))
    let totalSavings = round2(slabDiscount + displayOfferDiscount + displayCouponDiscount)

    if (Math.abs(totalSavings - discountTotal) > 0.01) {
      slabDiscount = round2(Math.max(0, slabDiscount + (discountTotal - totalSavings)))
      totalSavings = round2(slabDiscount + displayOfferDiscount + displayCouponDiscount)
    }

    const productMap = new Map(productsData.map((p) => [String(p.id), p]))
    const slabDetails = []

    for (const item of items) {
      const quantity = Number(item?.quantity ?? item?.qty ?? 0)
      if (quantity <= 0) continue

      const productId = item?.product_id || item?.productId || item?.product?.id || item?.id
      const productNameHint = item?.product?.name || item?.name || item?.product_name || null
      let product = productMap.get(String(productId))

      if (!product && productNameHint) {
        product = productsData.find((entry) => String(entry.name || '').toLowerCase() === String(productNameHint).toLowerCase()) || null
      }

      const productName = product?.name || productNameHint || 'Product'
      const productPrice = Number(product?.price || item?.price || item?.product?.price || 0)

      let slab = item?.slab || null
      const resolvedProductId = product?.id || productId
      if (!slab && resolvedProductId) {
        const { data: slabs } = await supabase
          .from('product_slabs')
          .select('*')
          .eq('product_id', resolvedProductId)
          .order('min_quantity', { ascending: false })

        slab = resolveApplicableSlab(Array.isArray(slabs) ? slabs : [], quantity, new Date(orderData.created_at || Date.now()))
      }

      if (!slab) continue

      const minQty = Number(slab.min_quantity || 0)
      if (!minQty || quantity < minQty) continue

      let detailAmount = round2(Number(item?.slab_discount || 0))
      if (detailAmount <= 0) {
        detailAmount = round2(calculateSlabDiscountAmount({ price: productPrice, quantity, slab }))
      }

      if (detailAmount <= 0) continue

      slabDetails.push({
        name: productName,
        qty: quantity,
        minQty,
        discountLabel: slab.discount_type === 'percent'
          ? `${Number(slab.discount_value || 0)}%`
          : `₹${Number(slab.discount_value || 0).toFixed(2)}`,
        ruleText: formatSlabRuleText(slab),
        amount: detailAmount
      })
    }

    if (slabDiscount > 0 && slabDetails.length === 0) {
      for (const item of items) {
        const quantity = Number(item?.quantity ?? item?.qty ?? 0)
        if (quantity <= 0) continue

        const productId = item?.product_id || item?.productId || item?.product?.id || item?.id
        const productNameHint = item?.product?.name || item?.name || item?.product_name || null
        const product = productMap.get(String(productId))
          || productsData.find((entry) => String(entry.name || '').toLowerCase() === String(productNameHint || '').toLowerCase())
          || null

        const amount = round2(Number(item?.slab_discount || 0))
        if (amount <= 0) continue

        slabDetails.push({
          name: product?.name || productNameHint || 'Product',
          qty: quantity,
          minQty: Number(item?.slab?.min_quantity || 0) || null,
          discountLabel: item?.slab?.discount_type === 'percent'
            ? `${Number(item?.slab?.discount_value || 0)}%`
            : item?.slab
              ? `₹${Number(item.slab.discount_value || 0).toFixed(2)}`
              : null,
          ruleText: item?.slab ? formatSlabRuleText(item.slab) : `₹${amount.toFixed(2)} slab applied`,
          amount
        })
      }

      if (slabDetails.length === 0) {
        // If we still have no per-item details, avoid showing a blank Qty placeholder — show a single summary line
        slabDetails.push({
          name: 'Slab Discount',
          qty: null,
          minQty: null,
          discountLabel: null,
          ruleText: 'Applied on eligible quantities',
          amount: slabDiscount
        })
      }
    }

    const slabDetailLines = slabDetails
      .map((detail) => {
        const qtyPart = typeof detail.qty === 'number' && detail.qty > 0 ? ` (Qty: ${detail.qty})` : ''
        const detailText = `${detail.name}${qtyPart}${detail.ruleText ? ` - ${detail.ruleText}` : ''}`
        return `<div class="total-line" style="font-size:11px;color:#334155;padding-left:12px;"><span>• ${detailText}</span><span class="text-right">-₹${detail.amount.toFixed(2)}</span></div>`
      })
      .join('')

    const discountLines = totalSavings > 0
      ? `
            ${slabDiscount > 0 ? `<div class="total-line"><span>Slab Discount:</span><span class="text-right">-₹${slabDiscount.toFixed(2)}</span></div>` : ''}
            ${slabDetails.length > 0 ? `<div class="total-line" style="font-size:11px;color:#334155;padding-left:12px;"><span>Slab Discount Details:</span><span></span></div>${slabDetailLines}` : ''}
            ${displayOfferDiscount > 0 ? `<div class="total-line"><span>${offerLabel}:</span><span class="text-right">-₹${displayOfferDiscount.toFixed(2)}</span></div>` : ''}
            ${displayCouponDiscount > 0 ? `<div class="total-line"><span>${couponLabel}:</span><span class="text-right">-₹${displayCouponDiscount.toFixed(2)}</span></div>` : ''}
            <div class="total-line"><span style="font-weight:700;">Total Savings:</span><span class="text-right" style="font-weight:700;">-₹${totalSavings.toFixed(2)}</span></div>
          `
      : ''
    
    // Generate HTML bill with professional styling
    const billHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice #${orderId.slice(0, 8)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            padding: 20px; 
            background: #fff;
            line-height: 1.4;
            color: #000;
          }
          .container { max-width: 900px; margin: 0 auto; }
          .header-box { 
            border: 2px solid #000;
            padding: 15px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .company-title { 
            font-size: 18px; 
            font-weight: bold;
          }
          .invoice-label { 
            text-align: right;
            font-weight: bold;
          }
          .info-box {
            border: 1px solid #000;
            padding: 15px;
            margin-bottom: 10px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
          }
          .info-block {
            font-size: 12px;
          }
          .info-block h4 {
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .info-block p {
            margin: 3px 0;
            font-size: 12px;
          }
          .table-box {
            border: 1px solid #000;
            margin: 15px 0;
            overflow: hidden;
          }
          .table-header {
            border-bottom: 2px solid #000;
            display: grid;
            grid-template-columns: 2fr 0.8fr 1.2fr 1.2fr;
            gap: 10px;
            padding: 10px;
            font-weight: bold;
            background: #f5f5f5;
            font-size: 12px;
          }
          .table-row {
            border-bottom: 1px solid #ddd;
            display: grid;
            grid-template-columns: 2fr 0.8fr 1.2fr 1.2fr;
            gap: 10px;
            padding: 10px;
            font-size: 12px;
          }
          .table-row:last-child {
            border-bottom: 2px solid #000;
          }
          .desc { font-size: 11px; color: #666; margin-top: 2px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .totals {
            margin: 15px 0;
            border: 1px solid #000;
            padding: 15px;
          }
          .total-line {
            display: grid;
            grid-template-columns: 3fr 1fr;
            gap: 10px;
            margin-bottom: 8px;
            font-size: 12px;
          }
          .divider-line {
            border-top: 1px solid #000;
            margin: 8px 0;
          }
          .final-total {
            display: grid;
            grid-template-columns: 3fr 1fr;
            gap: 10px;
            font-weight: bold;
            font-size: 14px;
            padding: 10px;
            background: #f9f9f9;
            border: 1px solid #000;
          }
          .footer-box {
            border: 1px solid #000;
            padding: 12px;
            margin-top: 10px;
            font-size: 11px;
            text-align: center;
          }
          .footer-box p { margin: 4px 0; }
          @media print { 
            body { padding: 0; background: white; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header-box">
            <div class="company-title">🥤 ${ownerDetails.name}</div>
            <div class="invoice-label">
              INVOICE #${orderId.slice(0, 8).toUpperCase()}<br>
              ${new Date(orderData.created_at).toLocaleDateString('en-IN')}<br>
              Status: ${orderData.status}
            </div>
          </div>

          <!-- Details Section -->
          <div class="info-box">
            <div class="info-block">
              <h4>📍 Seller Details</h4>
              <p><strong>${ownerDetails.name}</strong></p>
              <p>GST: ${ownerDetails.gst}</p>
              <p>Phone: ${ownerDetails.contact}</p>
              <p>Email: ${ownerDetails.email}</p>
              <p>Location: ${ownerDetails.address}</p>
            </div>
            <div class="info-block">
              <h4>👤 Bill To</h4>
              <p><strong>${userData?.full_name || 'Customer'}</strong></p>
              <p>Email: ${userData?.email || 'N/A'}</p>
              <p>Phone: ${userData?.phone || 'N/A'}</p>
            </div>
            <div class="info-block">
              <h4>📦 Order Info</h4>
              <p>Order Date: ${new Date(orderData.created_at).toLocaleDateString('en-IN')}</p>
              <p>Order ID: ${orderId.slice(0, 8)}</p>
              <p>Items: ${items.length}</p>
              <p>Status: ${orderData.status}</p>
            </div>
          </div>

          <!-- Products Table -->
          <div class="table-box">
            <div class="table-header">
              <div>Item Description</div>
              <div class="text-center">Qty</div>
              <div class="text-right">Unit Price</div>
              <div class="text-right">Amount (₹)</div>
            </div>
            ${productsData.map((product) => `
              <div class="table-row">
                <div>
                  <strong>${product.name}</strong>
                  ${product.description ? `<div class="desc">${product.description}</div>` : ''}
                </div>
                <div class="text-center">${product.quantity}</div>
                <div class="text-right">₹${product.price?.toFixed(2) || '0.00'}</div>
                <div class="text-right"><strong>₹${product.subtotal?.toFixed(2) || '0.00'}</strong></div>
              </div>
            `).join('')}
          </div>

          <!-- Totals Section -->
          <div class="totals">
            <div class="total-line">
              <span>Subtotal:</span>
              <span class="text-right">₹${subtotal.toFixed(2)}</span>
            </div>
            ${discountLines}
            <div class="total-line">
              <span>Subtotal after discount:</span>
              <span class="text-right">₹${subtotalAfterDiscount.toFixed(2)}</span>
            </div>
            <div class="total-line">
              <span>Shipping Charges:</span>
              <span class="text-right">₹${shippingFee.toFixed(2)}</span>
            </div>
            <div class="total-line">
              <span>GST (5%):</span>
              <span class="text-right">₹${gstAmount.toFixed(2)}</span>
            </div>
            <div class="divider-line"></div>
            <div class="final-total">
              <span>INVOICE TOTAL:</span>
              <span class="text-right">₹${totalWithGST.toFixed(2)}</span>
            </div>
            <div style="font-size: 11px; margin-top: 8px; text-align: right;">
              Total GST (5%): ₹${gstAmount.toFixed(2)}
            </div>
          </div>

          <!-- Footer -->
          <div class="footer-box">
            <p>✓ This is an electronically generated invoice and is valid without signature or seal</p>
            <p>✓ For any queries, please contact ${ownerDetails.name} at ${ownerDetails.contact}</p>
            <p>✓ All amounts in Indian Rupees (₹)</p>
            <p style="margin-top: 8px; border-top: 1px solid #000; padding-top: 8px;">
              Generated on ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')} | © ${ownerDetails.name}
            </p>
          </div>
        </div>
      </body>
      </html>
    `
    
    // Prevent caching so clients always fetch latest invoice
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `inline; filename="invoice-${orderId.slice(0, 8)}.html"`)
    res.send(billHTML)
  } catch (err) {
    console.error('Bill generation error:', err)
    res.status(500).json({ error: 'Failed to generate bill: ' + err.message })
  }
})

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  // Schedule daily report generation at 06:00 local time
  try {
    const reportsDir = path.join(baseDir, 'reports')
    const reportTimezone = process.env.REPORT_CRON_TIMEZONE || 'Asia/Kolkata'
    const dailyReportRecipient = process.env.DAILY_REPORT_EMAIL || 'ashirwadenetrprisesbihar@gmail.com'
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    cron.schedule('0 6 * * *', async () => {
      try {
        const today = new Date()
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
        const start = new Date(yesterday.toISOString().slice(0,10) + 'T00:00:00.000Z')
        const end = new Date(yesterday.toISOString().slice(0,10) + 'T23:59:59.999Z')
        const rows = await fetchTransactions({ start, end, includeAll: true })
        const pdf = await generatePdfFromTransactions(rows, { title: 'Daily Transactions Report', periodLabel: `Period: ${start.toLocaleDateString('en-IN')} → ${end.toLocaleDateString('en-IN')}` })
        const filePath = path.join(reportsDir, `transactions-${yesterday.toISOString().slice(0,10)}.pdf`)
        fs.writeFileSync(filePath, pdf)
        console.log(`Generated daily transactions report: ${filePath}`)
      } catch (e) {
        console.warn('Daily report generation failed:', e?.message || e)
      }
    }, { timezone: reportTimezone })

    // Send daily transactions email at 23:59 local time
    cron.schedule('59 23 * * *', async () => {
      try {
        const transporter = ensureTransporter()
        if (!transporter) {
          console.warn('Daily transactions email not sent: email service unavailable')
          return
        }

        // Build date range for current day (local time)
        const today = new Date()
        const start = new Date(today)
        start.setHours(0, 0, 0, 0)
        const end = new Date(today)
        end.setHours(23, 59, 59, 999)

        const rows = await fetchTransactions({ start, end, includeAll: true })
        const pdf = await generatePdfFromTransactions(rows, {
          title: 'Daily Transactions Report',
          periodLabel: `Period: ${start.toLocaleDateString('en-IN')} → ${end.toLocaleDateString('en-IN')}`
        })

        const summary = summarizeTransactions(rows)
        const dateLabel = start.toISOString().slice(0, 10)
        const rupee = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

        await transporter.sendMail({
          from: `"ASHIRWAD ENTERPRISES" <${process.env.Email_User}>`,
          to: dailyReportRecipient,
          subject: `Daily Transactions Report - ${dateLabel}`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #111827; padding: 16px;">
              <h2 style="margin: 0 0 12px; color: #0b5fff;">Daily Transactions Report</h2>
              <p style="margin: 0 0 16px; color: #4b5563;">${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              <div style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; background: #f9fafb; margin-bottom: 14px;">
                <div style="font-weight: 700; margin-bottom: 8px;">Summary</div>
                <div style="line-height: 1.6; color: #374151;">
                  Total Transactions: <strong>${summary.totalCount}</strong><br />
                  Total Amount: <strong>${rupee(summary.totalAmount)}</strong><br />
                  Prepaid: <strong>${summary.prepaidCount}</strong> (${rupee(summary.prepaidAmount)}) | COD: <strong>${summary.codCount}</strong> (${rupee(summary.codAmount)})<br />
                  Status: ${Object.entries(summary.byStatus || {}).map(([k,v]) => `${k}: ${v}`).join(' | ') || 'No data'}
                </div>
              </div>
              <p style="margin: 0; color: #6b7280;">The detailed PDF report is attached.</p>
            </div>
          `,
          attachments: [
            {
              filename: `transactions-${dateLabel}.pdf`,
              content: pdf,
              contentType: 'application/pdf'
            }
          ]
        })

        console.log(`Daily transactions email sent for ${dateLabel} to ${dailyReportRecipient}`)
      } catch (e) {
        console.warn('Daily transactions email failed:', e?.message || e)
      }
    }, { timezone: reportTimezone })
  } catch (schedErr) {
    console.warn('Failed to schedule daily report cron:', schedErr?.message || schedErr)
  }

  // Inject supabase client into delivery routes
  setSupabaseClient(supabase)
  setWarehouseSupabaseClient(supabase)

  // Middleware to inject supabase into requests for dashboard blocking routes
  app.use((req, res, next) => {
    req.supabase = supabase
    next()
  })

  // Register delivery partner routes
  app.use('/api/delivery', deliveryRoutes)
  app.use('/api/warehouse', warehouseRoutes)

  // Register dashboard blocking routes
  app.use('/api/dashboard-blocking', dashboardBlockingRoutes)


  // Register product slab routes
  app.use('/api/products/:productId/slabs', createProductSlabRouter({ supabase, requireAdminKey: (req, res, next) => next() }));
  app.use('/api/admin/products/:productId/slabs', createProductSlabRouter({ supabase, requireAdminKey }));
  app.use('/api/manager/products/:productId/slabs', createProductSlabRouter({ supabase, requireAdminKey: requireManagerAuth }));



  // ============================================================
  // Express Delivery Serviceable Locations Management
  // ============================================================

  // GET all locations (admin)
  app.get('/api/admin/express-locations', requireAdminKey, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('express_serviceable_locations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        if (isMissingSchemaReferenceError(error, 'express_serviceable_locations')) {
          return res.status(500).json({ error: 'Express locations table not found. Please run CREATE_EXPRESS_SERVICEABLE_LOCATIONS.sql in Supabase SQL Editor.' })
        }
        throw error
      }
      res.json(Array.isArray(data) ? data : [])
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to fetch express locations' })
    }
  })

  // POST create a new location (admin)
  app.post('/api/admin/express-locations', requireAdminKey, async (req, res) => {
    try {
      const { state, district, sub_district, city_town_village, pincode, is_enabled } = req.body
      if (!state || !district || !pincode) {
        return res.status(400).json({ error: 'state, district, and pincode are required' })
      }
      const cleanPincode = String(pincode).replace(/\D/g, '').slice(0, 10)
      if (!cleanPincode) return res.status(400).json({ error: 'Invalid pincode' })

      // Delete existing matching pincode to avoid duplicate row
      await supabase
        .from('express_serviceable_locations')
        .delete()
        .eq('pincode', cleanPincode)

      const { data, error } = await supabase
        .from('express_serviceable_locations')
        .insert([{
          state: String(state).trim(),
          district: String(district).trim(),
          sub_district: sub_district ? String(sub_district).trim() : null,
          city_town_village: city_town_village ? String(city_town_village).trim() : null,
          pincode: cleanPincode,
          is_enabled: is_enabled !== false
        }])
        .select()
        .single()

      if (error) throw error
      res.status(201).json(data)
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to create express location' })
    }
  })

  // POST create multiple locations in bulk (admin)
  app.post('/api/admin/express-locations/bulk', requireAdminKey, async (req, res) => {
    try {
      const { state, district, pincodes, is_enabled } = req.body
      if (!state || !district || !Array.isArray(pincodes) || pincodes.length === 0) {
        return res.status(400).json({ error: 'state, district, and a non-empty array of pincodes are required' })
      }

      // Format clean pincodes and create records
      const records = pincodes.map(pin => {
        const cleanPincode = String(pin).replace(/\D/g, '').slice(0, 10)
        return {
          state: String(state).trim(),
          district: String(district).trim(),
          pincode: cleanPincode,
          is_enabled: is_enabled !== false
        }
      }).filter(r => r.pincode.length > 0)

      if (records.length === 0) {
        return res.status(400).json({ error: 'No valid pincodes provided' })
      }

      const pinsToInsert = records.map(r => r.pincode)

      // Delete existing to prevent duplicate rows
      await supabase
        .from('express_serviceable_locations')
        .delete()
        .in('pincode', pinsToInsert)

      // Insert new ones
      const { data, error } = await supabase
        .from('express_serviceable_locations')
        .insert(records)
        .select()

      if (error) throw error
      res.status(201).json({ success: true, count: data?.length || 0, data })
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to bulk create express locations' })
    }
  })

  // GET pincodes in a district of a state using the India Post Office API proxy
  app.get('/api/geo/pincodes-by-district', async (req, res) => {
    try {
      const state = String(req.query.state || '').trim()
      const district = String(req.query.district || '').trim()
      if (!state || !district) {
        return res.status(400).json({ error: 'state and district are required' })
      }

      // Query by post office name matching district name (which returns all post offices in that district)
      const resp = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(district)}`)
      const data = await resp.json()
      if (!Array.isArray(data) || !data[0] || data[0].Status !== 'Success') {
        return res.json([])
      }
      
      const offices = data[0].PostOffice || []
      const matching = offices.filter(o => 
        String(o.State).toLowerCase() === state.toLowerCase() &&
        String(o.District).toLowerCase() === district.toLowerCase()
      )

      const uniquePins = [...new Set(matching.map(o => o.Pincode))].sort()
      res.json(uniquePins)
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to fetch pincodes for district' })
    }
  })

  // PUT update a location (admin)
  app.put('/api/admin/express-locations/:id', requireAdminKey, async (req, res) => {
    try {
      const { id } = req.params
      const { state, district, sub_district, city_town_village, pincode, is_enabled } = req.body
      if (!state || !district || !pincode) {
        return res.status(400).json({ error: 'state, district, and pincode are required' })
      }
      const cleanPincode = String(pincode).replace(/\D/g, '').slice(0, 10)

      const { data, error } = await supabase
        .from('express_serviceable_locations')
        .update({
          state: String(state).trim(),
          district: String(district).trim(),
          sub_district: sub_district ? String(sub_district).trim() : null,
          city_town_village: city_town_village ? String(city_town_village).trim() : null,
          pincode: cleanPincode,
          is_enabled: is_enabled !== false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Location not found' })
      res.json(data)
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to update express location' })
    }
  })

  // PATCH toggle is_enabled (admin)
  app.patch('/api/admin/express-locations/:id/toggle', requireAdminKey, async (req, res) => {
    try {
      const { id } = req.params
      const { is_enabled } = req.body

      const { data, error } = await supabase
        .from('express_serviceable_locations')
        .update({ is_enabled: Boolean(is_enabled), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Location not found' })
      res.json(data)
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to toggle express location' })
    }
  })

  // DELETE a location (admin)
  app.delete('/api/admin/express-locations/:id', requireAdminKey, async (req, res) => {
    try {
      const { id } = req.params
      const { error } = await supabase
        .from('express_serviceable_locations')
        .delete()
        .eq('id', id)

      if (error) throw error
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to delete express location' })
    }
  })

  // Public check: is this address eligible for Express Delivery?
  // Checks pincode (exact match) or state+district (case-insensitive) against enabled locations
  app.get('/api/express-locations/check', async (req, res) => {
    try {
      const pincode = String(req.query.pincode || '').trim()
      const state = String(req.query.state || '').trim()
      const district = String(req.query.district || '').trim()

      if (!pincode && !state && !district) {
        return res.json({ eligible: false, message: 'No address provided' })
      }

      let query = supabase
        .from('express_serviceable_locations')
        .select('id, state, district, sub_district, city_town_village, pincode, is_enabled')
        .eq('is_enabled', true)

      // Pincode match is most specific — use if provided
      if (pincode.length === 6) {
        query = query.eq('pincode', pincode)
      } else if (state && district) {
        query = query.ilike('state', state).ilike('district', district)
      } else {
        return res.json({ eligible: false, message: 'Insufficient address details for serviceability check' })
      }

      const { data, error } = await query.limit(1)

      if (error) {
        if (isMissingSchemaReferenceError(error, 'express_serviceable_locations')) {
          // Table doesn't exist yet — fall back to hardcoded Patna check
          const patnaEligible = /patna/i.test(district) && /bihar/i.test(state)
          return res.json({
            eligible: patnaEligible,
            message: patnaEligible ? 'Eligible for Express Delivery' : "Express Delivery is not yet available in your location. We're expanding our service coverage and will be available in your area soon. Please choose another available delivery option for now.",
            fallback: true
          })
        }
        throw error
      }

      const match = Array.isArray(data) && data.length > 0 ? data[0] : null
      res.json({
        eligible: Boolean(match),
        location: match || null,
        message: match
          ? `Express Delivery available — ${match.city_town_village || match.district}, ${match.state}`
          : "Express Delivery is not yet available in your location. We're expanding our service coverage and will be available in your area soon. Please choose another available delivery option for now."
      })
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to check express serviceability' })
    }
  })


  // ============================================================
  // Bank Account Management Endpoints
  // ============================================================

  // 1. Public IFSC verification proxy
  app.get('/api/bank/verify-ifsc', async (req, res) => {
    try {
      const { ifsc } = req.query
      if (!ifsc) {
        return res.status(400).json({ error: 'IFSC code is required' })
      }
      const cleanIfsc = String(ifsc).trim().toUpperCase()
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
      if (!ifscRegex.test(cleanIfsc)) {
        return res.status(400).json({ error: 'Invalid IFSC Code. Please enter a valid IFSC Code.' })
      }

      // Fetch from Razorpay IFSC API
      const response = await fetch(`https://ifsc.razorpay.com/${cleanIfsc}`)
      if (response.status === 404) {
        return res.status(400).json({ error: 'Invalid IFSC Code. Please enter a valid IFSC Code.' })
      }
      if (!response.ok) {
        return res.status(502).json({ error: 'Unable to verify the IFSC Code at the moment. Please try again later.' })
      }

      const data = await response.json()
      res.json({
        success: true,
        bankName: data.BANK,
        branchName: data.BRANCH,
        branchAddress: data.ADDRESS,
        state: data.STATE,
        district: data.DISTRICT,
        ifsc: cleanIfsc
      })
    } catch (err) {
      console.error('IFSC verification failed:', err)
      res.status(500).json({ error: 'Unable to verify the IFSC Code at the moment. Please try again later.' })
    }
  })

  // 1b. Public mock endpoint to resolve account holder name from account number
  app.get('/api/bank/resolve-account-holder', async (req, res) => {
    try {
      const { account_number, ifsc } = req.query
      if (!account_number) {
        return res.status(400).json({ error: 'Account number is required' })
      }
      
      const cleanAcc = String(account_number).trim()
      
      // Let's do some validation on length (9 to 18 digits)
      if (!/^\d{9,18}$/.test(cleanAcc)) {
        return res.status(400).json({ error: 'Please enter a valid account number.' })
      }

      let resolvedName = ''

      // 1. Check if caller is a Delivery Partner (has x-delivery-partner-id header)
      const dpId = req.headers['x-delivery-partner-id']
      if (dpId) {
        const { data: partner, error: dpErr } = await supabase
          .from('delivery_partners')
          .select('name')
          .eq('id', dpId)
          .maybeSingle()
        if (partner && partner.name) {
          resolvedName = partner.name
        }
      }

      // 2. Check if caller is a Manager (has x-manager-token header)
      const managerToken = req.headers['x-manager-token']
      if (!resolvedName && managerToken) {
        const { data: manager, error: mgrErr } = await supabase
          .from('managers')
          .select('full_name')
          .eq('id', managerToken)
          .maybeSingle()
        if (manager && manager.full_name) {
          resolvedName = manager.full_name
        }
      }

      // 3. Check if caller is a User/Customer (has Authorization token header)
      const authorization = String(req.headers.authorization || '')
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
      if (!resolvedName && token) {
        try {
          const { data, error } = await supabaseAdmin.auth.getUser(token)
          if (data?.user) {
            const { data: userRow, error: usrErr } = await supabase
              .from('users')
              .select('full_name')
              .eq('id', data.user.id)
              .maybeSingle()
            resolvedName = userRow?.full_name || data.user.user_metadata?.full_name || ''
          }
        } catch (authErr) {
          console.error('Auth verification failed during name resolution:', authErr)
        }
      }

      // Pre-mapped mock bank account holder names for demonstration and testing, 
      // or fall back to generating one dynamically
      if (!resolvedName) {
        const mockNames = {
          '123456789': 'Ashirwad Kumar',
          '987654321': 'PepsiCo Distributor Admin',
          '555555555': 'John Doe',
          '111122223333': 'Jane Smith',
          '999999999': 'Priya Patel',
          '888888888': 'Rohan Sharma'
        }
        resolvedName = mockNames[cleanAcc]
      }

      if (!resolvedName) {
        // Dynamic name generator based on digits sum so it's deterministic and realistic
        const names = [
          'Aditya Sharma', 'Rahul Verma', 'Sneha Patel', 'Priya Singh', 
          'Vikram Malhotra', 'Amit Joshi', 'Rohan Gupta', 'Neha Kapoor',
          'Suresh Kumar', 'Deepak Reddy', 'Ananya Iyer', 'Karan Johar'
        ]
        const digitSum = cleanAcc.split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0)
        resolvedName = names[digitSum % names.length]
      }

      res.json({
        success: true,
        accountHolderName: resolvedName
      })
    } catch (err) {
      console.error('Resolve account holder failed:', err)
      res.status(500).json({ error: 'Failed to resolve account holder name' })
    }
  })

  // Reusable helper to insert/update bank accounts
  async function saveBankAccountHelper(req, res, queryField, idValue) {
    try {
      const { account_holder_name, bank_name, account_number, ifsc_code, branch_name, upi_id } = req.body
      if (!account_holder_name || !bank_name || !account_number || !ifsc_code) {
        return res.status(400).json({ error: 'All required fields must be filled' })
      }

      const cleanIfsc = String(ifsc_code).trim().toUpperCase()
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
      if (!ifscRegex.test(cleanIfsc)) {
        return res.status(400).json({ error: 'Invalid IFSC Code. Please enter a valid IFSC Code.' })
      }

      // Verify IFSC Code via Razorpay
      let fetchedDetails = null
      try {
        const response = await fetch(`https://ifsc.razorpay.com/${cleanIfsc}`)
        if (response.status === 200) {
          fetchedDetails = await response.json()
        } else if (response.status === 404) {
          return res.status(400).json({ error: 'Invalid IFSC Code. Please enter a valid IFSC Code.' })
        } else {
          return res.status(502).json({ error: 'Unable to verify the IFSC Code at the moment. Please try again later.' })
        }
      } catch (err) {
        console.error('External IFSC API check failed:', err)
        return res.status(502).json({ error: 'Unable to verify the IFSC Code at the moment. Please try again later.' })
      }

      // Check existing bank account rows for this owner
      const { data: existingRows, error: fetchError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq(queryField, idValue)

      if (fetchError) throw fetchError

      const approvedRow = existingRows.find(r => r.approval_status === 'approved')
      const pendingRow = existingRows.find(r => ['pending', 'changes_requested', 'rejected'].includes(r.approval_status))

      const newRecord = {
        [queryField]: idValue,
        account_holder_name: String(account_holder_name).trim(),
        bank_name: fetchedDetails?.BANK || String(bank_name).trim(),
        account_number: String(account_number).trim(),
        ifsc_code: cleanIfsc,
        branch_name: fetchedDetails?.BRANCH || (branch_name ? String(branch_name).trim() : null),
        branch_address: fetchedDetails?.ADDRESS || null,
        state: fetchedDetails?.STATE || null,
        district: fetchedDetails?.DISTRICT || null,
        upi_id: upi_id ? String(upi_id).trim() : null,
        approval_status: 'pending',
        is_verified: true,
        updated_at: new Date().toISOString()
      }

      if (pendingRow) {
        // Update existing pending/rejected/changes_requested row
        const { data, error } = await supabase
          .from('bank_accounts')
          .update(newRecord)
          .eq('id', pendingRow.id)
          .select()
          .single()
        if (error) throw error
        return res.json({ success: true, data })
      } else {
        // No pending request. Create a new row
        const { data, error } = await supabase
          .from('bank_accounts')
          .insert({
            ...newRecord,
            created_at: new Date().toISOString()
          })
          .select()
          .single()
        if (error) throw error
        return res.json({ success: true, data })
      }
    } catch (err) {
      console.error('Failed to save bank account details:', err)
      res.status(500).json({ error: err.message || 'Failed to save bank account details' })
    }
  }

  // 2. User (customer) bank account endpoints
  app.get('/api/user/bank-account', requireUserAuth, async (req, res) => {
    try {
      const { data: accounts, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', req.user.id)

      if (error) throw error

      const approvedAccount = accounts.find(r => r.approval_status === 'approved') || null
      const pendingRequest = accounts.find(r => ['pending', 'changes_requested', 'rejected'].includes(r.approval_status)) || null

      res.json({
        success: true,
        approvedAccount,
        pendingRequest
      })
    } catch (err) {
      console.error('Failed to fetch user bank account:', err)
      res.status(500).json({ error: 'Failed to retrieve bank account details' })
    }
  })

  app.post('/api/user/bank-account', requireUserAuth, async (req, res) => {
    await saveBankAccountHelper(req, res, 'user_id', req.user.id)
  })

  app.delete('/api/user/bank-account', requireUserAuth, async (req, res) => {
    try {
      const { data: existingRows, error: fetchError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', req.user.id)

      if (fetchError) throw fetchError

      const approvedRow = existingRows.find(r => r.approval_status === 'approved')
      const pendingRow = existingRows.find(r => ['pending', 'changes_requested', 'rejected'].includes(r.approval_status))

      if (!pendingRow && approvedRow) {
        return res.status(400).json({ error: 'Approved bank accounts cannot be removed.' })
      }

      if (pendingRow) {
        const { error } = await supabase
          .from('bank_accounts')
          .delete()
          .eq('id', pendingRow.id)

        if (error) throw error
        return res.json({ success: true, message: 'Bank account details removed successfully.' })
      }

      res.json({ success: true, message: 'No bank account details to remove.' })
    } catch (err) {
      console.error('Failed to delete user bank account:', err)
      res.status(500).json({ error: 'Failed to remove bank account details' })
    }
  })

  // 3. Manager bank account endpoints
  app.get('/api/manager/bank-account', requireManagerAuth, async (req, res) => {
    try {
      const { data: accounts, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('manager_id', req.manager.id)

      if (error) throw error

      const approvedAccount = accounts.find(r => r.approval_status === 'approved') || null
      const pendingRequest = accounts.find(r => ['pending', 'changes_requested', 'rejected'].includes(r.approval_status)) || null

      res.json({
        success: true,
        approvedAccount,
        pendingRequest
      })
    } catch (err) {
      console.error('Failed to fetch manager bank account:', err)
      res.status(500).json({ error: 'Failed to retrieve bank account details' })
    }
  })

  app.post('/api/manager/bank-account', requireManagerAuth, async (req, res) => {
    await saveBankAccountHelper(req, res, 'manager_id', req.manager.id)
  })

  app.delete('/api/manager/bank-account', requireManagerAuth, async (req, res) => {
    try {
      const { data: existingRows, error: fetchError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('manager_id', req.manager.id)

      if (fetchError) throw fetchError

      const approvedRow = existingRows.find(r => r.approval_status === 'approved')
      const pendingRow = existingRows.find(r => ['pending', 'changes_requested', 'rejected'].includes(r.approval_status))

      if (!pendingRow && approvedRow) {
        return res.status(400).json({ error: 'Approved bank accounts cannot be removed.' })
      }

      if (pendingRow) {
        const { error } = await supabase
          .from('bank_accounts')
          .delete()
          .eq('id', pendingRow.id)

        if (error) throw error
        return res.json({ success: true, message: 'Bank account details removed successfully.' })
      }

      res.json({ success: true, message: 'No bank account details to remove.' })
    } catch (err) {
      console.error('Failed to delete manager bank account:', err)
      res.status(500).json({ error: 'Failed to remove bank account details' })
    }
  })

  // 4. Admin Bank Accounts List and Action routes
  app.get('/api/admin/bank-accounts', requireAdminKey, async (req, res) => {
    try {
      const { data: accounts, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Retrieve User, Manager, and Delivery Partner profiles to manually enrich
      const [usersRes, managersRes, partnersRes] = await Promise.all([
        supabase.from('users').select('id, full_name, email'),
        supabase.from('managers').select('id, full_name, email'),
        supabase.from('delivery_partners').select('id, name, email')
      ])

      const usersMap = new Map((usersRes.data || []).map(u => [u.id, u]))
      const managersMap = new Map((managersRes.data || []).map(m => [m.id, m]))
      const partnersMap = new Map((partnersRes.data || []).map(p => [p.id, p]))

      const enriched = accounts.map(acc => {
        let owner = null
        let role = 'User'
        if (acc.user_id && usersMap.has(acc.user_id)) {
          const u = usersMap.get(acc.user_id)
          owner = { name: u.full_name, email: u.email }
          role = 'User'
        } else if (acc.manager_id && managersMap.has(acc.manager_id)) {
          const m = managersMap.get(acc.manager_id)
          owner = { name: m.full_name, email: m.email }
          role = 'Manager'
        } else if (acc.delivery_partner_id && partnersMap.has(acc.delivery_partner_id)) {
          const p = partnersMap.get(acc.delivery_partner_id)
          owner = { name: p.name, email: p.email }
          role = 'Delivery Partner'
        }
        return {
          ...acc,
          owner,
          role
        }
      })

      res.json(enriched)
    } catch (err) {
      console.error('Failed to list bank accounts for admin:', err)
      res.status(500).json({ error: 'Failed to retrieve bank accounts list' })
    }
  })

  app.post('/api/admin/bank-accounts/:id/approve', requireAdminKey, async (req, res) => {
    try {
      const { id } = req.params
      const { notes } = req.body

      const { data: targetAccount, error: fetchErr } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (fetchErr) throw fetchErr
      if (!targetAccount) {
        return res.status(404).json({ error: 'Bank account request not found' })
      }

      const queryField = targetAccount.user_id ? 'user_id' : (targetAccount.manager_id ? 'manager_id' : 'delivery_partner_id')
      const idValue = targetAccount[queryField]

      // Delete other existing approved bank accounts for this owner
      const { data: otherApproved, error: otherErr } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq(queryField, idValue)
        .eq('approval_status', 'approved')
        .neq('id', id)

      if (otherErr) throw otherErr

      if (otherApproved && otherApproved.length > 0) {
        const idsToDelete = otherApproved.map(r => r.id)
        const { error: delErr } = await supabase
          .from('bank_accounts')
          .delete()
          .in('id', idsToDelete)
        if (delErr) throw delErr
      }

      // Mark this account as approved
      const { data: approvedAccount, error: approveErr } = await supabase
        .from('bank_accounts')
        .update({
          approval_status: 'approved',
          admin_notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (approveErr) throw approveErr
      res.json({ success: true, data: approvedAccount })
    } catch (err) {
      console.error('Failed to approve bank account:', err)
      res.status(500).json({ error: err.message || 'Failed to approve bank account' })
    }
  })

  app.post('/api/admin/bank-accounts/:id/reject', requireAdminKey, async (req, res) => {
    try {
      const { id } = req.params
      const { notes } = req.body

      const { data, error } = await supabase
        .from('bank_accounts')
        .update({
          approval_status: 'rejected',
          admin_notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      res.json({ success: true, data })
    } catch (err) {
      console.error('Failed to reject bank account:', err)
      res.status(500).json({ error: err.message || 'Failed to reject bank account' })
    }
  })

  app.post('/api/admin/bank-accounts/:id/request-changes', requireAdminKey, async (req, res) => {
    try {
      const { id } = req.params
      const { notes } = req.body
      if (!notes) {
        return res.status(400).json({ error: 'Please provide details of the changes requested.' })
      }

      const { data, error } = await supabase
        .from('bank_accounts')
        .update({
          approval_status: 'changes_requested',
          admin_notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      res.json({ success: true, data })
    } catch (err) {
      console.error('Failed to request bank account changes:', err)
      res.status(500).json({ error: err.message || 'Failed to request changes' })
    }
  })

  // SPA catch-all route - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    const indexPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../frontend/dist/index.html')
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err)
        res.status(404).json({ error: 'Page not found' })
      }
    })
  })

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

export default app
