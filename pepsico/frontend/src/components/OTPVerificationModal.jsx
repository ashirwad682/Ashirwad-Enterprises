import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001'
const INITIAL_OTP_SEND_THROTTLE_MS = 2500
const initialOtpSendTracker = new Map()

const getOtpSendGuardKey = (orderId, actorId, apiNamespace) => `${apiNamespace || 'delivery'}:${orderId || ''}:${actorId || ''}`

export default function OTPVerificationModal({
  order,
  deliveryPartnerId,
  actorId,
  authHeaders,
  apiNamespace = 'delivery',
  onClose,
  onVerified
}) {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [fallbackOtp, setFallbackOtp] = useState(null)
  const [otpMeta, setOtpMeta] = useState(null)

  const resolvedActorId = actorId || deliveryPartnerId
  const resolvedApiNamespace = apiNamespace || 'delivery'
  const resolvedHeaders = authHeaders || (deliveryPartnerId
    ? { 'x-delivery-partner-id': deliveryPartnerId }
    : {})
  const completionLabel = resolvedApiNamespace === 'warehouse' ? 'pickup' : 'delivery'

  const expiryLabel = (() => {
    if (!otpMeta?.expiresAt) return null
    const parsed = new Date(otpMeta.expiresAt)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  })()

  useEffect(() => {
    if (!order?.id || !resolvedActorId) return

    const guardKey = getOtpSendGuardKey(order.id, resolvedActorId, resolvedApiNamespace)
    const now = Date.now()
    const lastSentAt = Number(initialOtpSendTracker.get(guardKey) || 0)

    if (now - lastSentAt < INITIAL_OTP_SEND_THROTTLE_MS) {
      return
    }

    initialOtpSendTracker.set(guardKey, now)
    sendOTP({ source: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, resolvedActorId, resolvedApiNamespace])

  useEffect(() => {
    let interval
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown(prev => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [resendCountdown])

  const sendOTP = async ({ source = 'manual' } = {}) => {
    try {
      setLoading(true)
      setError(null)
      setMessage(null)
      setFallbackOtp(null)
      setOtpMeta(null)

      if (!order?.id || !resolvedActorId) {
        throw new Error('Missing order or session details')
      }

      const response = await fetch(`${API_BASE}/api/${resolvedApiNamespace}/orders/${encodeURIComponent(order.id)}/otp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...resolvedHeaders
        }
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok || payload.success !== true) {
        throw new Error(payload.error || 'Failed to generate OTP')
      }

      setOtpSent(true)
      setOtp('')
      setFallbackOtp(payload.emailSent === false && payload.otp ? payload.otp : null)
      setOtpMeta({
        expiresAt: payload.expiresAt || null,
        emailSent: payload.emailSent,
        orderReference: payload.orderReference || null,
        fallback: payload.fallback || null
      })
      setMessage(payload.message || `OTP generated. Collect the code from the customer on ${completionLabel}.`)
      setResendCountdown(60)

      if (source === 'manual' && order?.id && resolvedActorId) {
        const guardKey = getOtpSendGuardKey(order.id, resolvedActorId, resolvedApiNamespace)
        initialOtpSendTracker.set(guardKey, Date.now())
      }
    } catch (err) {
      setError(err?.message || 'Failed to send OTP. Please try again.')
      console.error('OTP sending error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setMessage(null)

      const response = await fetch(`${API_BASE}/api/${resolvedApiNamespace}/orders/${encodeURIComponent(order.id)}/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...resolvedHeaders
        },
        body: JSON.stringify({ otp })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok || payload.success !== true) {
        throw new Error(payload.error || 'Failed to verify OTP')
      }

      setMessage(payload.message || 'OTP verified successfully. Completing delivery...')

      if (typeof onVerified === 'function') {
        await onVerified(order)
      }
    } catch (err) {
      const errMsg = err?.message || 'Verification failed. Please try again.'
      setError(errMsg)
      // If OTP expired, clear stale expiry label/fallback OTP and allow immediate resend
      if (errMsg.toLowerCase().includes('expired')) {
        setOtpMeta(null)
        setFallbackOtp(null)
        setOtpSent(false)
        setResendCountdown(0)
      }
      console.error('OTP verification error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card"
        style={{ width: '90%', maxWidth: 420, padding: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ fontSize: 48, marginBottom: 16 }}
          >
            📧
          </motion.div>
          <h2 style={{ marginBottom: 8, color: '#0f172a' }}>Verify OTP</h2>
          <p style={{ color: '#556070', margin: 0, fontSize: 14 }}>
            A 6-digit code has been sent to<br />
            <strong>{order.customer_email}</strong>
          </p>
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: '#d1fae5',
              border: '2px solid #10b981',
              color: '#065f46',
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 14,
              fontWeight: 500
            }}
          >
            ✓ {message}
          </motion.div>
        )}

        {fallbackOtp && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: '#fff7ed',
              border: '2px dashed #f97316',
              color: '#9a3412',
              padding: 16,
              borderRadius: 10,
              marginBottom: 16
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Share this code with the customer</div>
            <div style={{ fontSize: 32, letterSpacing: 8, fontWeight: 800 }}>{fallbackOtp}</div>
            <p style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>
              Email delivery is unavailable. Ask the customer to read this OTP after they receive the products. Confirm the code before marking the order as {completionLabel === 'pickup' ? 'completed' : 'delivered'}.
            </p>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="alert error"
            style={{ marginBottom: 16 }}
          >
            {error}
          </motion.div>
        )}

        <div className="form-group">
          <label className="form-label">Enter 6-Digit OTP</label>
          <input
            type="text"
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.slice(0, 6))}
            disabled={loading}
            maxLength="6"
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 8,
              textAlign: 'center',
              fontFamily: 'monospace'
            }}
          />
        </div>

        <p style={{ fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 16 }}>
          OTP expires {expiryLabel ? `at ${expiryLabel}` : 'in 5 minutes'}
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: '#f3f4f6',
              color: '#0f172a',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleVerifyOTP}
            disabled={loading || otp.length !== 6}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: loading || otp.length !== 6 ? '#ccc' : 'linear-gradient(135deg, #FF8C00 0%, #FFB347 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: loading || otp.length !== 6 ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </div>

        <button
          onClick={sendOTP}
          disabled={resendCountdown > 0 || loading}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'none',
            border: `2px solid ${resendCountdown > 0 ? '#e5e7eb' : '#FF8C00'}`,
            color: resendCountdown > 0 ? '#999' : '#FF8C00',
            borderRadius: 8,
            fontWeight: 600,
            cursor: resendCountdown > 0 ? 'not-allowed' : 'pointer',
            fontSize: 14
          }}
        >
          {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : 'Resend OTP'}
        </button>
      </motion.div>
    </motion.div>
  )
}
