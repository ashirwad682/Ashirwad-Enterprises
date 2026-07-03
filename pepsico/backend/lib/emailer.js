export async function sendDeliveryResetPasswordEmail(to, resetLink) {
  const t = ensureTransporter()
  if (!t) {
    console.warn('Email transporter not configured; skipping delivery reset password email')
    return false
  }
  let html
  if (templates.deliveryResetPassword) {
    html = templates.deliveryResetPassword({ resetLink })
  } else {
    html = `<p>Reset your password: <a href="${resetLink}">${resetLink}</a></p>`
  }
  await t.sendMail({
    from: `"ASHIRWAD ENTERPRISES" <${process.env.Email_User}>`,
    to,
    subject: 'Reset Your Delivery Partner Password',
    html
  })
  return true
}
export async function sendOrderDeliveredEmail(to, context = {}, billPdf = null) {
  const t = ensureTransporter()
  if (!t) {
    console.warn('⚠️ Email transporter not configured; skipping delivered email')
    return false
  }
  
  console.log('📧 Preparing delivery confirmation email...')
  console.log('   To:', to)
  console.log('   Bill PDF attached:', billPdf ? `Yes (${billPdf.length} bytes)` : 'No')
  
  const {
    orderReference,
    customerName,
    deliveryAddress,
    supportEmail
  } = context
  const resolvedOrderRef = orderReference || 'ORDER'
  const resolvedSupportEmail = supportEmail || process.env.SUPPORT_EMAIL || process.env.Email_User
  const templatePayload = {
    orderReference: resolvedOrderRef,
    customerName: customerName || 'Valued Customer',
    deliveryAddress: deliveryAddress || 'your address',
    supportEmail: resolvedSupportEmail || 'support@example.com'
  }
  const htmlRenderer = templates.delivered || ((ctx) => `<p>Your order ${ctx.orderReference} has been delivered.</p>`)
  const html = htmlRenderer(templatePayload)
  
  const mailOptions = {
    from: `"ASHIRWAD ENTERPRISES" <${process.env.Email_User}>`,
    to,
    subject: `Order Delivered Successfully - ${resolvedOrderRef}`,
    html
  }
  
  // Attach bill PDF if provided
  if (billPdf) {
    mailOptions.attachments = [
      {
        filename: `invoice-${resolvedOrderRef}.pdf`,
        content: billPdf,
        contentType: 'application/pdf'
      }
    ]
  }
  
  try {
    await t.sendMail(mailOptions)
    console.log('✅ Delivery email sent successfully to:', to)
    return true
  } catch (err) {
    console.error('❌ Failed to send delivery email:', err?.message || err)
    throw err
  }
}

export async function sendEarlyDeliveryEmail(to, context = {}) {
  const t = ensureTransporter()
  if (!t) {
    console.warn('⚠️ Email transporter not configured; skipping early delivery email')
    return false
  }
  
  console.log('📧 Preparing early delivery email...')
  console.log('   To:', to)
  
  const {
    orderReference,
    customerName,
    expectedBy,
    deliveredAt,
    supportEmail
  } = context
  const resolvedOrderRef = orderReference || 'ORDER'
  const resolvedSupportEmail = supportEmail || process.env.SUPPORT_EMAIL || process.env.Email_User
  const templatePayload = {
    orderReference: resolvedOrderRef,
    customerName: customerName || 'Valued Customer',
    expectedBy: expectedBy || 'Scheduled date',
    deliveredAt: deliveredAt || 'Delivered',
    supportEmail: resolvedSupportEmail || 'support@example.com'
  }
  const htmlRenderer = templates.earlyDelivery || ((ctx) => `<p>Your order ${ctx.orderReference} was delivered early.</p>`)
  const html = htmlRenderer(templatePayload)
  
  try {
    await t.sendMail({
      from: `"ASHIRWAD ENTERPRISES" <${process.env.Email_User}>`,
      to,
      subject: `Delivered Ahead of Schedule - ${resolvedOrderRef}`,
      html
    })
    console.log('✅ Early delivery email sent successfully to:', to)
    return true
  } catch (err) {
    console.error('❌ Failed to send early delivery email:', err?.message || err)
    throw err
  }
}
import fs from 'fs/promises'
import Handlebars from 'handlebars'
import nodemailer from 'nodemailer'

const templates = {}

async function loadTemplates() {
  try {
    const welcomeRaw = await fs.readFile(new URL('../email-templates/welcome.html', import.meta.url), 'utf8')
    templates.welcome = Handlebars.compile(welcomeRaw)
  } catch (e) {
    console.warn('Failed to load welcome template:', e?.message || e)
    templates.welcome = (ctx) => `<p>Welcome ${ctx.userName}</p>`
  }

  try {
    const resetRaw = await fs.readFile(new URL('../email-templates/delivery-reset-password.html', import.meta.url), 'utf8')
    templates.deliveryResetPassword = Handlebars.compile(resetRaw)
  } catch (e) {
    console.warn('Failed to load delivery reset password template:', e?.message || e)
    templates.deliveryResetPassword = (ctx) => `<p>Reset your password: <a href="${ctx.resetLink}">${ctx.resetLink}</a></p>`
  }

  try {
    const approvalRaw = await fs.readFile(new URL('../email-templates/approval.html', import.meta.url), 'utf8')
    templates.approval = Handlebars.compile(approvalRaw)
  } catch (e) {
    console.warn('Failed to load approval template:', e?.message || e)
    templates.approval = (ctx) => `<p>Your account ${ctx.userEmail} is approved</p>`
  }

  try {
    const partnerUpdateRaw = await fs.readFile(new URL('../email-templates/partner-update.html', import.meta.url), 'utf8')
    templates.partnerUpdate = Handlebars.compile(partnerUpdateRaw)
  } catch (e) {
    // optional template; fall back to a simple message when missing
    templates.partnerUpdate = (ctx) => `
      <p>Hello ${ctx.name || 'Partner'},</p>
      <p>Your delivery partner profile has been updated with the following details:</p>
      <ul>
        <li><strong>Name:</strong> ${ctx.name || '—'}</li>
        <li><strong>Email:</strong> ${ctx.email || '—'}</li>
        <li><strong>Mobile:</strong> ${ctx.mobile || '—'}</li>
        <li><strong>Assigned area:</strong> ${ctx.assigned_area || '—'}</li>
        <li><strong>Status:</strong> ${ctx.status || '—'}</li>
      </ul>
      <p>If you did not request these changes, please contact support.</p>
    `
  }

  try {
    const otpRaw = await fs.readFile(new URL('../email-templates/otp.html', import.meta.url), 'utf8')
    templates.otp = Handlebars.compile(otpRaw)
  } catch (e) {
    console.warn('Failed to load otp template:', e?.message || e)
    templates.otp = (ctx) => `<p>Your OTP is ${ctx.otp}</p>`
  }

  try {
    const orderConfirmRaw = await fs.readFile(new URL('../email-templates/order-confirmation.html', import.meta.url), 'utf8')
    templates.orderConfirmation = Handlebars.compile(orderConfirmRaw)
  } catch (e) {
    console.warn('Failed to load order confirmation template:', e?.message || e)
    templates.orderConfirmation = (ctx) => `<p>Your order ${ctx.orderId} has been placed</p>`
  }

  try {
    const orderRejectionRaw = await fs.readFile(new URL('../email-templates/order-rejection.html', import.meta.url), 'utf8')
    templates.orderRejection = Handlebars.compile(orderRejectionRaw)
  } catch (e) {
    console.warn('Failed to load order rejection template:', e?.message || e)
    templates.orderRejection = (ctx) => `<p>Your order ${ctx.orderId} has been cancelled</p>`
  }

  try {
    const deliveryOtpRaw = await fs.readFile(new URL('../email-templates/delivery-otp.html', import.meta.url), 'utf8')
    templates.deliveryOtp = Handlebars.compile(deliveryOtpRaw)
  } catch (e) {
    console.warn('Failed to load delivery OTP template:', e?.message || e)
    templates.deliveryOtp = (ctx) => `<p>Your delivery confirmation code is ${ctx.otp}</p>`
  }

  try {
    const earlyDeliveryRaw = await fs.readFile(new URL('../email-templates/early-delivery.html', import.meta.url), 'utf8')
    templates.earlyDelivery = Handlebars.compile(earlyDeliveryRaw)
  } catch (e) {
    console.warn('Failed to load early delivery template:', e?.message || e)
    templates.earlyDelivery = (ctx) => `<p>Your order ${ctx.orderReference} was delivered early.</p>`
  }

  try {
    const deliveredRaw = await fs.readFile(new URL('../email-templates/delivered.html', import.meta.url), 'utf8')
    templates.delivered = Handlebars.compile(deliveredRaw)
  } catch (e) {
    console.warn('Failed to load delivered template:', e?.message || e)
    templates.delivered = (ctx) => `<p>Your order ${ctx.orderReference} has been delivered.</p>`
  }
}

await loadTemplates()

let transporter = null

export function ensureTransporter() {
  if (transporter) return transporter
  const user = process.env.Email_User
  const pass = process.env.Email_Pass
  if (user && pass) {
    try {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      })
    } catch (e) {
      console.warn('Failed to create mail transporter:', e?.message || e)
      transporter = null
    }
  }
  return transporter
}

// Initialize transporter once during module load so downstream routes can detect availability.
ensureTransporter()

export async function sendOtpEmail(to, otp) {
  const t = ensureTransporter()
  if (!t) {
    console.warn('Email transporter not configured; skipping OTP send')
    return false
  }
  const html = templates.otp({ otp })
  await t.sendMail({
    from: `"ASHIRWAD ENTERPRISES" <${process.env.Email_User}>`,
    to,
    subject: '🔐 Email Verification Required - Ashirwad Enterprises',
    html
  })
  return true
}

export async function sendWelcomeEmail(to, userName) {
  const t = ensureTransporter()
  if (!t) {
    console.warn('Email transporter not configured; skipping welcome email')
    return false
  }
  const html = templates.welcome({ userName })
  await t.sendMail({
    from: `"ASHIRWAD ENTERPRISES" <${process.env.Email_User}>`,
    to,
    subject: '🎉 Account Created — Ashirwad Enterprises',
    html
  })
  return true
}

export async function sendApprovalEmail(to, userName, userEmail) {
  const t = ensureTransporter()
  if (!t) {
    console.warn('Email transporter not configured; skipping approval email')
    return false
  }
  const html = templates.approval({ userName, userEmail })
  await t.sendMail({
    from: `"ASHIRWAD ENTERPRISES" <${process.env.Email_User}>`,
    to,
    subject: '✅ Account Approved — You can place orders now',
    html
  })
  return true
}

export async function sendOrderConfirmationEmail(to, orderData) {
  const t = ensureTransporter()
  if (!t) {
    console.warn('Email transporter not configured; skipping order confirmation email')
    return false
  }
  const html = templates.orderConfirmation(orderData)
  await t.sendMail({
    from: `"ASHIRWAD ENTERPRISES" <${process.env.Email_User}>`,
    to,
    subject: `🎉 Order Confirmed - ${orderData.orderId.slice(0, 8).toUpperCase()}`,
    html
  })
  return true
}

export async function sendOrderRejectionEmail(to, rejectionData) {
  const t = ensureTransporter()
  if (!t) {
    console.warn('Email transporter not configured; skipping order rejection email')
    return false
  }
  const html = templates.orderRejection(rejectionData)
  await t.sendMail({
    from: `"ASHIRWAD ENTERPRISES" <${process.env.Email_User}>`,
    to,
    subject: `⚠️ Order Cancelled - ${rejectionData.orderId}`,
    html
  })
  return true
}

export function isMailerConfigured() {
  return !!ensureTransporter()
}

export async function sendDeliveryOtpEmail(to, context = {}) {
  const t = ensureTransporter()
  if (!t) {
    console.warn('Email transporter not configured; skipping delivery OTP email')
    return false
  }

  const {
    otp,
    orderReference,
    orderId,
    partnerName,
    customerName,
    expiresAt,
    supportEmail,
    supportPhone
  } = context

  const resolvedOrderRef = orderReference
    || (orderId ? orderId.toString().slice(0, 8).toUpperCase() : 'ORDER')
  const resolvedSupportEmail = supportEmail || process.env.SUPPORT_EMAIL || process.env.Email_User

  const templatePayload = {
    otp: otp || '000000',
    orderReference: resolvedOrderRef,
    partnerName: partnerName || 'PepsiCo Delivery Partner',
    customerName: customerName || 'Valued Customer',
    expiresAt: expiresAt || '5 minutes',
    supportEmail: resolvedSupportEmail || 'support@example.com',
    supportPhone: supportPhone || null
  }

  const htmlRenderer = templates.deliveryOtp || ((ctx) => `<p>Your delivery confirmation code is ${ctx.otp}</p>`)
  const html = htmlRenderer(templatePayload)

  await t.sendMail({
    from: `"ASHIRWAD ENTERPRISES" <${process.env.Email_User}>`,
    to,
    subject: `Delivery Confirmation Code - ${resolvedOrderRef}`,
    html
  })

  return true
}

export async function sendPartnerUpdateEmail(to, context = {}) {
  const t = ensureTransporter()
  if (!t) {
    console.error('❌ Email transporter NOT configured! Email NOT sent to', to)
    console.error('   Email_User:', process.env.Email_User ? '✓ Set' : '✗ NOT SET')
    console.error('   Email_Pass:', process.env.Email_Pass ? '✓ Set' : '✗ NOT SET')
    return false
  }

  console.log('📧 [PARTNER UPDATE EMAIL] Preparing email...')
  console.log('   To:', to)
  console.log('   Partner Name:', context.name)
  console.log('   Assigned Area:', context.assigned_area)
  console.log('   Status:', context.status)
  if (context.changes && Object.keys(context.changes).length > 0) {
    console.log('   Changes:', Object.keys(context.changes).join(', '))
  }

  const { name, email, mobile, assigned_area, status, supportEmail, changes } = context
  const resolvedSupport = supportEmail || process.env.SUPPORT_EMAIL || process.env.Email_User
  const templatePayload = { 
    name, 
    email, 
    mobile, 
    assigned_area, 
    status, 
    supportEmail: resolvedSupport,
    changes: changes || {}
  }
  const htmlRenderer = templates.partnerUpdate || ((ctx) => `<p>Your account was updated.</p>`)
  const html = htmlRenderer(templatePayload)

  try {
    console.log('📧 [PARTNER UPDATE EMAIL] Sending email via Gmail transporter...')
    await t.sendMail({
      from: `"ASHIRWAD ENTERPRISES" <${process.env.Email_User}>`,
      to,
      subject: 'Your Delivery Partner Profile Was Updated',
      html
    })
    console.log('✅ [PARTNER UPDATE EMAIL] Email sent successfully to', to)
    return true
  } catch (err) {
    console.error('❌ [PARTNER UPDATE EMAIL] Failed to send:', err?.message || err)
    console.error('   Full error:', err)
    throw err
  }
}