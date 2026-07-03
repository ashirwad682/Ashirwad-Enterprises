import React, { useState } from 'react'
import { motion } from 'framer-motion'

const API_BASE = import.meta.env.VITE_API_BASE 
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') 
  : (import.meta.env.PROD ? 'https://pepsico-backend.vercel.app' : 'http://localhost:5001')

export default function DashboardBlockLockModal({ isBlocked, blockTime, onUnlock, partnerId }) {
  const [accessKey, setAccessKey] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const handleUnlock = async () => {
    if (!accessKey.trim()) {
      setError('Please enter an access key')
      return
    }

    try {
      setUnlocking(true)
      setError(null)
      setSuccessMessage(null)

      const res = await fetch(`${API_BASE}/api/dashboard-blocking/check-dashboard-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: partnerId,
          accessKey: accessKey
        })
      })

      const data = await res.json()

      if (!res.ok || !data.canAccess) {
        const errorText = data.error || data.message || ''
        const lowerError = errorText.toLowerCase()

        // Check if it's an "already used" error
        if (lowerError.includes('already used') || lowerError.includes('already been used')) {
          setError('This access key has already been used. Please contact the admin to get a new one.')
        } else if (lowerError.includes('expired')) {
          setError('This access key has expired. Please contact the admin to get a new one.')
        } else if (lowerError.includes('invalid')) {
          setError('Invalid access key. Please check and try again.')
        } else {
          setError(errorText || 'Unable to verify access key')
        }
        return
      }

      // Access granted - Save unlock session to localStorage
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      const sessionKey = `dashboard_unlock_${partnerId}_${today}`
      localStorage.setItem(sessionKey, JSON.stringify({
        unlockedAt: new Date().toISOString(),
        blockTime: blockTime,
        partnerId: partnerId
      }))
      
      setSuccessMessage('Access key verified! Dashboard unlocking...')
      setAccessKey('')
      setError(null)
      
      setTimeout(() => {
        onUnlock()
      }, 1000)
    } catch (err) {
      setError(err.message || 'Failed to verify access key')
    } finally {
      setUnlocking(false)
    }
  }

  if (!isBlocked) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(17, 24, 39, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.4 }}
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '48px',
          maxWidth: '480px',
          width: '90%',
          color: '#111827',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Decorative top border */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #3b82f6 0%, #1e40af 100%)'
        }} />

        {/* Icon Container */}
        <div style={{
          width: '64px',
          height: '64px',
          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: '32px'
        }}>
          🔐
        </div>

        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: '24px',
          fontWeight: '700',
          color: '#111827',
          textAlign: 'center'
        }}>
          Access Restricted
        </h2>

        <p style={{
          margin: '0 0 24px 0',
          fontSize: '14px',
          color: '#6b7280',
          textAlign: 'center',
          lineHeight: '1.6'
        }}>
          The delivery dashboard is temporarily restricted after {blockTime || '5:30 PM'} for settlement of your collected money. <br />Enter your access key to continue.
        </p>

        {/* Time Info Box */}
        <div style={{
          background: '#f3f4f6',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '16px' }}>⏰</span>
          <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
            Daily restriction: {blockTime || '5:30 PM'} onwards
          </span>
        </div>

        {/* Input Field */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#374151',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Access Key
          </label>
          <input
            type="password"
            value={accessKey}
            onChange={(e) => {
              setAccessKey(e.target.value)
              if (error) setError(null)
            }}
            onKeyPress={(e) => e.key === 'Enter' && !unlocking && handleUnlock()}
            placeholder="Enter your access key"
            style={{
              width: '100%',
              padding: '12px 14px',
              border: error ? '2px solid #ef4444' : '2px solid #e5e7eb',
              borderRadius: '8px',
              background: '#f9fafb',
              color: '#111827',
              fontSize: '14px',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.target.style.background = '#fff'
              e.target.style.borderColor = '#3b82f6'
            }}
            onBlur={(e) => {
              e.target.style.background = '#f9fafb'
              e.target.style.borderColor = error ? '#ef4444' : '#e5e7eb'
            }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '13px',
              fontWeight: '500',
              lineHeight: '1.5'
            }}
          >
            ⚠ {error}
          </motion.div>
        )}

        {/* Success Message */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: '#dcfce7',
              border: '1px solid #bbf7d0',
              color: '#166534',
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '13px',
              fontWeight: '500',
              textAlign: 'center'
            }}
          >
            ✓ {successMessage}
          </motion.div>
        )}

        {/* Unlock Button */}
        <button
          onClick={handleUnlock}
          disabled={!accessKey.trim() || unlocking}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: accessKey.trim() && !unlocking 
              ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' 
              : '#d1d5db',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: '600',
            fontSize: '14px',
            cursor: accessKey.trim() && !unlocking ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '16px'
          }}
          onMouseEnter={(e) => {
            if (accessKey.trim() && !unlocking) {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.3)'
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = 'none'
          }}
        >
          {unlocking ? '⏳ Verifying...' : '🔓 Unlock Dashboard'}
        </button>

        {/* Info Box */}
        <motion.div
          style={{
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '14px 16px',
            marginBottom: '16px'
          }}
        >
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start'
          }}>
            <span style={{ fontSize: '16px', marginTop: '2px', flexShrink: 0 }}>ℹ</span>
            <div>
              <div style={{
                fontWeight: '600',
                color: '#92400e',
                marginBottom: '4px',
                fontSize: '13px'
              }}>
                One-Time Unlock for Today
              </div>
              <div style={{
                color: '#b45309',
                fontSize: '12px',
                lineHeight: '1.5'
              }}>
                Once you unlock the dashboard with your access key, you won't be asked again until the next block period. Your access key can only be used once.
              </div>
            </div>
          </div>
        </motion.div>

        {/* Support Text */}
        <p style={{
          margin: '0',
          fontSize: '12px',
          color: '#9ca3af',
          textAlign: 'center',
          lineHeight: '1.6'
        }}>
          Lost your access key? Contact your administrator for assistance.
        </p>
      </motion.div>
    </motion.div>
  )
}
