import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function ManagerPasswordReset() {
  const [params] = useSearchParams()
  const token = String(params.get('token') || '').trim()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!token) {
      setError('Invalid or missing reset token.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must include at least one letter and one number.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/manager/password-reset/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to reset password')
      }

      setSuccess(payload.message || 'Password updated successfully. Redirecting to manager login...')
      setTimeout(() => navigate('/manager-login'), 1800)
    } catch (err) {
      setError(err.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: '#991b1b' }}>
        Invalid or missing reset token.
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: '#f8fafc' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 28 }}>
        <h2 style={{ margin: 0, marginBottom: 8, color: '#0f172a' }}>Manager Password Reset</h2>
        <p style={{ margin: 0, marginBottom: 18, color: '#64748b', fontSize: 13 }}>
          Set a new secure password for your manager account.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: '11px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
          />

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{ padding: '11px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
          />

          <div style={{ fontSize: 11, color: '#64748b' }}>
            Use at least 8 characters with letters and numbers.
          </div>

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 600 }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: '11px 12px',
              borderRadius: 8,
              border: 0,
              background: '#0b5fff',
              color: '#fff',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
