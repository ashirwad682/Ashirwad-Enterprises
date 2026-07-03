import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'
import { motion } from 'framer-motion'

export default function AdminLogin() {
  const [accessKey, setAccessKey] = useState('')
  const [error, setError] = useState(null)
  const { login } = useAdminAuth()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)
    if (login(accessKey)) {
      navigate('/admin/dashboard')
    } else {
      setError('Invalid access key. Use the secure admin key shared offline.')
    }
  }

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 440, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
          <h2 style={{ margin: 0 }}>Secure Admin Access</h2>
          <p style={{ color: '#555', marginTop: 8 }}>
            Enter the confidential admin access key shared through secure channels.
          </p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14, background: '#fff', padding: 28, borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: 'var(--shadow-md)' }}>
          <label style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Access Key</label>
          <input
            type="password"
            placeholder="Enter 12+ character admin key"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            style={{ padding: 12, border: '1px solid #d0d5dd', borderRadius: 10, fontSize: 15 }}
            autoFocus
          />
          <div style={{ fontSize: 13, color: '#667085' }}>
            Tips: use a password manager, never reuse keys, and rotate keys periodically.
          </div>
          <motion.button whileTap={{ scale: 0.98 }} type="submit" style={{ padding: 12, background: '#0b5fff', color: '#fff', border: 0, borderRadius: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.2 }}>
            Continue to Admin
          </motion.button>
          {error && <div style={{ color: '#d32f2f', fontSize: 14, textAlign: 'center', background: '#ffebee', borderRadius: 10, padding: 10 }}>{error}</div>}
          <div style={{ fontSize: 12, color: '#9aa0aa', textAlign: 'center' }}>
            If you lost access, contact the platform owner to issue a new key.
          </div>
        </form>
      </motion.div>
    </div>
  )
}
