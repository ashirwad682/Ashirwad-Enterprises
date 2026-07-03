import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import BrandVideoLogo from '../components/BrandVideoLogo'
import { useWarehouseAuth } from '../context/WarehouseAuthContext'

export default function WarehouseLogin() {
  const navigate = useNavigate()
  const { login, setupPassword } = useWarehouseAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [setupWarehouse, setSetupWarehouse] = useState(null)
  const [setupPasswordValue, setSetupPasswordValue] = useState('')
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('')

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const result = await login(username.trim(), password.trim())
    if (result.success) {
      navigate('/warehouse-dashboard')
    } else if (result.requiresPasswordSetup) {
      setSetupWarehouse(result.warehouse)
      setSetupPasswordValue('')
      setConfirmPasswordValue('')
      setError(null)
    } else {
      setError(result.error || 'Warehouse login failed')
    }

    setLoading(false)
  }

  const handleSetupPassword = async (event) => {
    event.preventDefault()
    setError(null)

    if (!setupWarehouse?.id) {
      setError('Missing warehouse details. Return to the login form and try again.')
      return
    }

    if (setupPasswordValue.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (setupPasswordValue !== confirmPasswordValue) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const result = await setupPassword(setupWarehouse.id, setupPasswordValue)
    if (result.success) {
      navigate('/warehouse-dashboard')
    } else {
      setError(result.error || 'Failed to set warehouse password')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(180deg, #fff7ed 0%, #eef2ff 100%)' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ width: '100%', maxWidth: 460 }}>
        <div className="card" style={{ padding: 40 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <BrandVideoLogo size={88} style={{ marginBottom: 18, boxShadow: '0 20px 60px rgba(15,23,42,0.18)', borderRadius: 18 }} />
              <h2 style={{ marginBottom: 4, color: '#b45309' }}>Ashirwad Enterprises</h2>
            </Link>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>Warehouse Portal</p>
            <p style={{ color: 'var(--text-secondary)', margin: '12px 0 0 0' }}>
              {setupWarehouse ? 'Set your password to activate warehouse access' : 'Sign in with your warehouse name'}
            </p>
          </div>

          {!setupWarehouse ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="form-group">
                <label className="form-label">Warehouse Name</label>
                <input
                  type="text"
                  placeholder="Enter warehouse name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  placeholder="Leave blank for first login"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && <div className="alert error">{error}</div>}

              <motion.button type="submit" className="btn" disabled={loading} whileTap={{ scale: 0.98 }} style={{ marginTop: 8 }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </motion.button>

              <div style={{ padding: 14, borderRadius: 12, background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', fontSize: 13, lineHeight: 1.6 }}>
                <strong>First login:</strong> enter only the warehouse name and submit. If no password is set yet, the portal will prompt the warehouse to create one.
              </div>
            </form>
          ) : (
            <form onSubmit={handleSetupPassword} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Warehouse Username</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{setupWarehouse.name}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>{setupWarehouse.address}</div>
              </div>

              <div className="form-group">
                <label className="form-label">Create Password</label>
                <input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={setupPasswordValue}
                  onChange={(e) => setSetupPasswordValue(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPasswordValue}
                  onChange={(e) => setConfirmPasswordValue(e.target.value)}
                  required
                />
              </div>

              {error && <div className="alert error">{error}</div>}

              <motion.button type="submit" className="btn" disabled={loading} whileTap={{ scale: 0.98 }}>
                {loading ? 'Saving...' : 'Activate Warehouse Portal'}
              </motion.button>

              <button
                type="button"
                onClick={() => {
                  setSetupWarehouse(null)
                  setPassword('')
                  setSetupPasswordValue('')
                  setConfirmPasswordValue('')
                  setError(null)
                }}
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
              >
                Back to login
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}