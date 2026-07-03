import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useDeliveryPartnerAuth } from '../context/DeliveryPartnerAuthContext'
import BrandVideoLogo from '../components/BrandVideoLogo'

export default function DeliveryPartnerLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [forgotStatus, setForgotStatus] = useState(null)
  const [forgotLoading, setForgotLoading] = useState(false)
    // Handler for forgot password
  const handleForgotPassword = async () => {
    setForgotStatus(null);
    if (!email) {
      setForgotStatus({ type: 'error', msg: 'Please enter your registered email address to receive a password reset link.' });
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch('/api/delivery/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      let data = {};
      try {
        data = await res.json();
      } catch {}
      if (res.ok) {
        setForgotStatus({ type: 'success', msg: data.message || 'If this email is registered, a password reset link has been sent. Please check your inbox.' });
      } else if (data && data.error) {
        // Show a more user-friendly error for common backend errors
        if (data.error.toLowerCase().includes('not registered')) {
          setForgotStatus({ type: 'error', msg: 'This email is not registered as a Delivery Partner.' });
        } else {
          setForgotStatus({ type: 'error', msg: 'Sorry, we could not process your request at this time. Please try again later or contact support.' });
        }
      } else {
        setForgotStatus({ type: 'error', msg: 'Sorry, we could not process your request at this time. Please try again later or contact support.' });
      }
    } catch (err) {
      setForgotStatus({ type: 'error', msg: 'Unable to connect to the server. Please check your internet connection and try again.' });
    }
    setForgotLoading(false);
  }
  const navigate = useNavigate()
  const { login } = useDeliveryPartnerAuth()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await login(email.trim().toLowerCase(), password.trim())
    
    if (result.success) {
      navigate('/delevery')
    } else {
      setError(result.error || 'Login failed')
    }
    
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(180deg, #fbeaff 0%, #eaf6ff 100%)' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ width: '100%', maxWidth: 420 }}>
        <div className="card" style={{ padding: 40 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <BrandVideoLogo size={88} style={{ marginBottom: 18, boxShadow: '0 20px 60px rgba(10,29,83,0.2)', borderRadius: 18 }} />
              <h2 style={{ marginBottom: 4, color: 'var(--brand-saffron)' }}>Ashirwad Enterprises</h2>
            </Link>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>Delivery Partner Login</p>
            <p style={{ color: 'var(--text-secondary)', margin: '12px 0 0 0' }}>Sign in to your delivery account</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                placeholder="you@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Password</label>
              <input 
                type="password" 
                placeholder="Enter your password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: 38 }}
              />
            </div>
            {error && <div className="alert error">{error}</div>}
            <motion.button 
              type="submit" 
              className="btn"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              style={{ marginTop: 8 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </motion.button>
            <div style={{ textAlign: 'right', marginTop: 4 }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1976d2',
                  cursor: 'pointer',
                  fontSize: 13,
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                {forgotLoading ? 'Sending...' : 'Forgot password?'}
              </button>
            </div>
            {forgotStatus && (
              <div style={{
                background: forgotStatus.type === 'error' ? '#fee2e2' : '#dcfce7',
                color: forgotStatus.type === 'error' ? '#be123c' : '#166534',
                borderLeft: forgotStatus.type === 'error' ? '6px solid #be123c' : '6px solid #22c55e',
                borderRadius: 16,
                padding: '16px 20px',
                marginTop: 12,
                fontWeight: 500,
                fontSize: 16
              }}>
                {forgotStatus.msg}
              </div>
            )}
          </form>
          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            Not a delivery partner? Contact admin to request access.
          </div>
        </div>
      </motion.div>
    </div>
  )
}
