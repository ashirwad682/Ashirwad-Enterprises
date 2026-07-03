import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { motion } from 'framer-motion'
import BrandVideoLogo from '../components/BrandVideoLogo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const navigate = useNavigate()
  // Forgot password handler
  async function handleForgotPassword(e) {
    e.preventDefault();
    setError(null);
    setResetSent(false);
    setResetLoading(true);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your email to reset password.');
      setResetLoading(false);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: window.location.origin + '/reset-password'
    });
    setResetLoading(false);
    if (error) {
      setError(error.message || 'Failed to send reset email.');
    } else {
      setResetSent(true);
    }
  }

  // Redirect to dashboard if already logged in (e.g., after Google OAuth)
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (data.user) {
        navigate('/dashboard', { replace: true });
      }
    });
    return () => { mounted = false };
  }, [navigate]);

  async function signIn(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()
    
    if (!trimmedEmail || !trimmedPassword) {
      setError('Email and password are required')
      setLoading(false)
      return
    }

    console.log('Attempting login for:', trimmedEmail)
    
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: trimmedEmail, 
      password: trimmedPassword 
    })
    
    console.log('Login response:', { user: data?.user?.id, error: error?.message })
    setLoading(false)
    
    if (error) {
      console.error('Login error:', error.message)
      
      // Parse error message and provide clear feedback
      const msg = error.message.toLowerCase()
      
      if (msg.includes('email not confirmed')) {
        setError('Your email needs to be confirmed. Please contact admin to verify your account.')
      } else if (msg.includes('invalid login credentials') || msg.includes('invalid') || msg.includes('credentials')) {
        setError('Invalid email or password. Please check and try again.')
      } else if (msg.includes('user not found')) {
        setError('No account found with this email. Please register first.')
      } else if (msg.includes('email')) {
        setError('Email issue: ' + error.message)
      } else {
        setError(error.message || 'Login failed. Please try again.')
      }
      return
    }

    if (!data?.user) {
      setError('Login failed. Please try again.')
      return
    }

    console.log('Login successful for user:', data.user.id)
    navigate('/dashboard')
  }

  // Google Sign-In handler
  async function handleGoogleSignIn(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
      // Supabase will redirect, so no need to handle navigation here
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 200px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ width: '100%', maxWidth: 420 }}>
        <div className="card" style={{ padding: 40 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <BrandVideoLogo size={88} style={{ marginBottom: 18, boxShadow: '0 20px 60px rgba(10,29,83,0.2)', borderRadius: 18 }} />
              <h2 style={{ marginBottom: 4, color: 'var(--brand-saffron)' }}>Ashirwad Enterprises</h2>
            </Link>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>Authorized PepsiCo Distributor</p>
            <p style={{ color: 'var(--text-secondary)', margin: '12px 0 0 0' }}>Sign in to your account</p>
          </div>
          <form onSubmit={signIn} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: 38 }}
              />
              <span
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 36,
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: 18,
                  color: '#888'
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
                role="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </span>
              <div style={{ textAlign: 'right', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
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
                  {resetLoading ? 'Sending...' : 'Forgot password?'}
                </button>
              </div>
            </div>
            {error && <div className="alert error">{error}</div>}
            {resetSent && <div className="alert success">Password reset email sent! Check your inbox.</div>}
            <motion.button 
              type="submit" 
              className="btn"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              style={{ marginTop: 8 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </motion.button>
          </form>
          <div style={{ margin: '24px 0', textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #eee', margin: '16px 0 12px 0' }} />
            <div style={{ marginBottom: 10, color: '#1976d2', fontSize: 14, fontWeight: 500 }}>
              If you use <b>Sign in with Google</b>,<br />
              you will be registered first (if new), then can use it to sign in.           
            </div>
            <button
              onClick={handleGoogleSignIn}
              className="btn"
              style={{
                width: '100%',
                background: '#fff',
                color: '#222',
                border: '1px solid #ddd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontWeight: 500,
                fontSize: 16,
                padding: '10px 0',
                marginTop: 0
              }}
              disabled={loading}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 22, height: 22, marginRight: 8 }} />
              Sign in with Google
            </button>
          </div>
          <div style={{ marginTop: 8, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
            Don't have an account? <Link to="/register" style={{ fontWeight: 600 }}>Register</Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
