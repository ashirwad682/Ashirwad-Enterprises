import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function ManagerPersonalEmailVerify() {
  const [params] = useSearchParams()
  const token = String(params.get('token') || '').trim()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function verify() {
      if (!token) {
        setError('Verification token is missing.')
        setLoading(false)
        return
      }

      // In React StrictMode (dev), effects can run twice. Cache by token to avoid
      // consuming a one-time verification token twice in the same browser session.
      const cacheKey = `manager_personal_email_verify:${token}`
      const cachedResult = sessionStorage.getItem(cacheKey)
      if (cachedResult === 'success') {
        setMessage('Your account is verified successfully.')
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/manager/personal-email/verify?token=${encodeURIComponent(token)}`)
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(payload.error || 'Verification failed')
        }

        setMessage('Your account is verified successfully.')
        sessionStorage.setItem(cacheKey, 'success')
      } catch (err) {
        setError(err.message || 'Verification failed')
      } finally {
        setLoading(false)
      }
    }

    verify()
  }, [token])

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: '#f8fafc' }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 28, textAlign: 'center' }}>
        <h2 style={{ margin: 0, marginBottom: 12, color: '#0f172a' }}>Manager Email Verification</h2>

        {loading && <div style={{ color: '#64748b' }}>Verifying your personal email...</div>}

        {!loading && error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, padding: 12, fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', borderRadius: 8, padding: 12, fontSize: 13, fontWeight: 600 }}>
            {message}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/manager-login')}
            style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#0b5fff', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Go To Manager Login
          </button>
          <button
            onClick={() => navigate('/manager-dashboard')}
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer' }}
          >
            Open Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
