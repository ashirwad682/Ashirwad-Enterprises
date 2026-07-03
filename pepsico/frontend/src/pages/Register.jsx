import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { motion } from 'framer-motion'
import BrandVideoLogo from '../components/BrandVideoLogo'

const rawApiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5001';
const API_BASE = rawApiBase.replace(/\/$/, ''); // Remove trailing slash if present

export default function Register() {
  const [step, setStep] = useState('form') // 'form', 'otp', 'success'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [resendLoading, setResendLoading] = useState(false)

  // Countdown timer for resend OTP
  useEffect(() => {
    let interval
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown(prev => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [resendCountdown])

  async function sendOTP(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedName = fullName.trim();

    // Basic validation
    if (!trimmedEmail || !trimmedPassword || !trimmedName) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      // Only send OTP, do not create user yet
      const otpRes = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail })
      });

      if (!otpRes.ok) {
        const errorBody = await otpRes.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorBody.error || 'Failed to send OTP');
      }

      setLoading(false);
      setResendCountdown(60);
      setStep('otp');
    } catch (err) {
      console.error('Registration error:', err);
      // Provide a friendly error for common backend connection failures
      if (err.message === 'Failed to fetch') {
        setError('Cannot connect to the server. Please check your internet connection or ensure the backend is running.');
      } else {
        setError(err.message);
      }
      setLoading(false);
    }
  }

  async function resendOTP() {
    if (resendCountdown > 0) return
    
    setResendLoading(true)
    setError(null)

    try {
      const otpRes = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      })

      if (!otpRes.ok) {
        const errorBody = await otpRes.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorBody.error || 'Failed to resend OTP')
      }

      setResendCountdown(60)
      setOtp('')
    } catch (err) {
      console.error('Resend OTP error:', err)
      if (err.message === 'Failed to fetch') {
        setError('Cannot connect to the server to resend OTP.');
      } else {
        setError(err.message);
      }
    } finally {
      setResendLoading(false)
    }
  }

  async function verifyOTPAndComplete(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!otp || otp.length !== 6) {
      setError('OTP must be 6 digits');
      setLoading(false);
      return;
    }

    try {
      // Step 1: Verify OTP
      const otpRes = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp })
      });

      if (!otpRes.ok) {
        const errorBody = await otpRes.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorBody.error || 'Failed to verify OTP');
      }

      // Step 2: Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: undefined
        }
      });

      if (authError) {
        throw new Error(authError.message || 'Failed to create account');
      }

      // Check if user already exists (Supabase returns a user but with empty identities for security reasons)
      if (authData?.user?.identities && authData.user.identities.length === 0) {
        throw new Error('An account with this email already exists. Please log in instead.');
      }

      if (!authData?.user?.id) {
        throw new Error('No user ID returned from auth');
      }

      // Step 3: Create user profile
      const profileRes = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: authData.user.id,
          email: email.trim().toLowerCase(),
          full_name: fullName.trim()
        })
      });

      if (!profileRes.ok) {
        const errorBody = await profileRes.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorBody.error || 'Failed to create profile');
      }

      // Step 4: Confirm email in auth
      const confirmBody = { userId: authData.user.id };
      const confirmRes = await fetch(`${API_BASE}/api/auth/confirm-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmBody)
      });

      if (!confirmRes.ok) {
        const errorBody = await confirmRes.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorBody.error || 'Failed to confirm email');
      }

      setLoading(false);
      setStep('success');
    } catch (err) {
      console.error('OTP verification error:', err);
      if (err.message === 'Failed to fetch') {
        setError('Cannot connect to the server. Please ensure the backend is running.');
      } else {
        setError(err.message);
      }
      setLoading(false);
    }
  }

  // Success screen
  if (step === 'success') {
    return (
      <div style={{ 
        minHeight: 'calc(100vh - 200px)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '24px',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #f5f3ff 100%)'
      }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ width: '100%', maxWidth: 500 }}
        >
          <div className="card" style={{ 
            padding: 48, 
            textAlign: 'center', 
            background: 'white',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative background elements */}
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 200,
              height: 200,
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, transparent 70%)',
              borderRadius: '50%'
            }} />
            
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }} 
              transition={{ type: 'spring', stiffness: 150, damping: 12, delay: 0.2 }}
              style={{ 
                fontSize: 80, 
                marginBottom: 24,
                position: 'relative',
                zIndex: 1
              }}
            >
              ✓
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 style={{ 
                marginBottom: 12, 
                color: '#10b981',
                fontSize: 32,
                fontWeight: 700
              }}>Email Verified Successfully!</h2>
              <p style={{ 
                color: '#6b7280', 
                marginBottom: 28, 
                fontSize: 15, 
                lineHeight: 1.8,
                fontWeight: 500
              }}>Your account has been created and your email has been verified. We've sent a confirmation email — admin approval is still required before ordering is enabled.</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              style={{ background: 'linear-gradient(135deg, #fff9e6 0%, #fffbeb 100%)', border: '2px solid #f59e0b', padding: 18, borderRadius: 12, marginBottom: 24 }}
            >
              <p style={{ margin: '0 0 10px 0', color: '#92400e', fontSize: 14, fontWeight: 700 }}>📋 Next Step Required</p>
              <p style={{ color: '#b45309', fontSize: 13, marginTop: 0, marginBottom: 0, lineHeight: 1.6 }}>Admin will verify your account before you can place orders. This usually takes 24-48 hours.</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #f7fee7 100%)', border: '2px solid #10b981', padding: 18, borderRadius: 12, marginBottom: 28 }}
            >
              <p style={{ margin: '0 0 12px 0', color: '#166534', fontSize: 14, fontWeight: 700 }}>✨ You can now:</p>
              <ul style={{ 
                margin: '0', 
                paddingLeft: 20, 
                color: '#15803d', 
                fontSize: 13,
                lineHeight: 1.8,
                fontWeight: 500
              }}>
                <li>Browse our complete product catalog</li>
                <li>View detailed prices and descriptions</li>
                <li>Check real-time inventory availability</li>
                <li>Wait for admin approval to start ordering</li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Link to="/login" style={{ 
                padding: '14px 32px', 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                color: '#fff', 
                borderRadius: 10, 
                fontWeight: 700, 
                display: 'inline-block',
                textDecoration: 'none',
                marginBottom: 16,
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                boxShadow: '0 10px 25px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.3s',
                marginTop: 8
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                🚀 Go to Login
              </Link>
            </motion.div>

            <p style={{ color: '#999', fontSize: 12, margin: '16px 0 0 0', fontWeight: 500 }}>📬 Check your email for confirmation details</p>
          </div>
        </motion.div>
      </div>
    )
  }

  // OTP verification screen
  if (step === 'otp') {
    return (
      <div style={{ 
        minHeight: 'calc(100vh - 200px)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '24px',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #f5f3ff 100%)'
      }}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }} 
          style={{ width: '100%', maxWidth: 500 }}
        >
          <div className="card" style={{ 
            padding: 48, 
            background: 'white',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative background */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #FF8C00 0%, #FFB347 50%, #FFE4B5 100%)'
            }} />

            <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative', zIndex: 1 }}>
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ fontSize: 56, marginBottom: 16 }}
              >
                📧
              </motion.div>
              <h2 style={{ marginBottom: 12, fontSize: 28, fontWeight: 700, color: '#1f2937' }}>Verify Your Email</h2>
              <p style={{ 
                color: '#6b7280', 
                margin: 0, 
                fontSize: 15, 
                lineHeight: 1.8,
                fontWeight: 500
              }}>
                We've sent a 6-digit verification code from<br />
                <strong style={{ color: '#FF8C00', fontSize: 16, display: 'inline-block', marginTop: 4 }}>✨ Ashirwad Enterprises</strong><br />
                to <strong style={{ color: '#1f2937' }}>{email}</strong>
              </p>
            </div>

            {/* Mandatory Notice */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ 
                background: 'linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%)', 
                border: '2px solid #FF8C00', 
                borderRadius: 12, 
                padding: 16, 
                marginBottom: 28,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 100,
                height: 100,
                background: 'radial-gradient(circle, rgba(11, 95, 255, 0.1) 0%, transparent 70%)',
                borderRadius: '50%'
              }} />
              <p style={{ 
                margin: 0, 
                color: '#0c4a6e', 
                fontSize: 14, 
                fontWeight: 700,
                position: 'relative',
                zIndex: 1
              }}>
                🔐 Email verification is <span style={{ background: '#fbbf24', padding: '2px 8px', borderRadius: 4, color: '#78350f' }}>MANDATORY</span> to complete registration
              </p>
            </motion.div>
            
            <form onSubmit={verifyOTPAndComplete} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="form-group"
              >
                <label className="form-label" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'block' }}>Verification Code</label>
                <input 
                  type="text" 
                  placeholder="000000" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength="6"
                  autoFocus
                  style={{ 
                    fontSize: 36, 
                    letterSpacing: '12px', 
                    textAlign: 'center',
                    fontWeight: 700,
                    padding: '16px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: 10,
                    transition: 'all 0.3s',
                    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#FF8C00'
                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb'
                    e.target.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
                  }}
                  required
                />
                <small style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', display: 'block', marginTop: 10, fontWeight: 500 }}>
                  ⏱️ 6-digit code from your email (expires in 10 minutes)
                </small>
              </motion.div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="alert error"
                  style={{ 
                    background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', 
                    border: '2px solid #f87171', 
                    color: '#991b1b', 
                    padding: 14, 
                    borderRadius: 10,
                    fontWeight: 600
                  }}
                >
                  ⚠️ {error}
                </motion.div>
              )}
              
              <motion.button 
                type="submit" 
                className="btn"
                disabled={loading || otp.length !== 6}
                whileTap={{ scale: 0.98 }}
                style={{ 
                  marginTop: 8,
                  opacity: otp.length !== 6 ? 0.6 : 1,
                  padding: '14px 28px',
                  fontSize: 16,
                  fontWeight: 700,
                  borderRadius: 10,
                  background: otp.length !== 6 ? '#d1d5db' : 'linear-gradient(135deg, #FF8C00 0%, #FFB347 100%)',
                  cursor: otp.length !== 6 ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? (
                  <span>⏳ Verifying...</span>
                ) : (
                  <span>✓ Verify Code</span>
                )}
              </motion.button>
            </form>

            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '2px solid #e5e7eb', position: 'relative', zIndex: 1 }}>
              <p style={{ textAlign: 'center', fontSize: 14, color: '#6b7280', margin: '0 0 14px 0', fontWeight: 600 }}>
                Didn't receive the code?
              </p>
              <motion.button
                onClick={resendOTP}
                disabled={resendCountdown > 0 || resendLoading}
                whileHover={resendCountdown === 0 && !resendLoading ? { y: -2 } : {}}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: resendCountdown > 0 ? '#f3f4f6' : 'linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%)',
                  border: `2px solid ${resendCountdown > 0 ? '#e5e7eb' : '#FF8C00'}`,
                  color: resendCountdown > 0 ? '#9ca3af' : '#FF8C00',
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: resendCountdown > 0 ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  transition: 'all 0.3s',
                  boxShadow: resendCountdown > 0 ? 'none' : '0 4px 12px rgba(11, 95, 255, 0.15)'
                }}
              >
                {resendLoading ? (
                  '⏳ Sending...'
                ) : resendCountdown > 0 ? (
                  `⏲️ Resend Code in ${resendCountdown}s`
                ) : (
                  '📨 Resend Verification Code'
                )}
              </motion.button>
            </div>
            
            <div style={{ marginTop: 20, textAlign: 'center', fontSize: 14, color: '#6b7280', fontWeight: 500 }}>
              Wrong email? <button 
                onClick={() => { setStep('form'); setOtp(''); setError(null); setResendCountdown(0) }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#0b5fff', 
                  cursor: 'pointer', 
                  fontWeight: 700,
                  fontSize: 14,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
              >
                Change email
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  // Registration form screen
  return (
    <div style={{ 
      minHeight: 'calc(100vh - 200px)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '24px',
      background: 'linear-gradient(135deg, #f0f9ff 0%, #f5f3ff 100%)'
    }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }} 
        style={{ width: '100%', maxWidth: 520 }}
      >
        <div className="card" style={{ 
          padding: 48, 
          background: 'white',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Top gradient accent */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #FF8C00 0%, #FFB347 50%, #FFE4B5 100%)'
          }} />

          <div style={{ textAlign: 'center', marginBottom: 36, position: 'relative', zIndex: 1 }}>
            <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <BrandVideoLogo size={92} style={{ marginBottom: 18, boxShadow: '0 26px 70px rgba(10,29,83,0.2)', borderRadius: 20 }} />
              <h2 style={{ 
                marginBottom: 8,
                fontSize: 28,
                fontWeight: 700,
                color: '#FF8C00'
              }}>Ashirwad Enterprises</h2>
            </Link>
            <p style={{ 
              color: '#6b7280', 
              margin: '4px 0 0 0', 
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.6
            }}>Authorized PepsiCo Distributor</p>
            <p style={{ 
              color: '#6b7280', 
              margin: '12px 0 0 0', 
              fontSize: 15,
              fontWeight: 500,
              lineHeight: 1.6
            }}>Create your distributor account</p>
          </div>

          {/* Email Verification Notice */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ 
              background: 'linear-gradient(135deg, #fef3c7 0%, #fef08a 100%)', 
              border: '2px solid #f59e0b', 
              borderRadius: 12, 
              padding: 18, 
              marginBottom: 32,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 120,
              height: 120,
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, transparent 70%)',
              borderRadius: '50%'
            }} />
            <p style={{ 
              margin: '0 0 10px 0', 
              color: '#92400e', 
              fontSize: 14, 
              fontWeight: 700,
              position: 'relative',
              zIndex: 1
            }}>
              📧 Email Verification Required
            </p>
            <p style={{ 
              margin: 0, 
              color: '#b45309', 
              fontSize: 13, 
              lineHeight: 1.7,
              fontWeight: 500,
              position: 'relative',
              zIndex: 1
            }}>
              Email verification is <strong>MANDATORY</strong> for all new users. You'll receive a 6-digit verification code at your email address from <strong>Ashirwad Enterprises</strong>.
            </p>
          </motion.div>
          
          <form onSubmit={sendOTP} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="form-group"
            >
              <label className="form-label" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block', color: '#1f2937' }}>👤 Full Name</label>
              <input 
                type="text" 
                placeholder="Enter your full name" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'all 0.3s',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea'
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb'
                  e.target.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
                }}
                required
              />
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="form-group"
            >
              <label className="form-label" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block', color: '#1f2937' }}>📧 Email Address</label>
              <input 
                type="email" 
                placeholder="you@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'all 0.3s',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea'
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb'
                  e.target.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
                }}
                required
              />
              <small style={{ 
                color: '#6b7280', 
                fontSize: 13,
                marginTop: 8,
                display: 'block',
                fontWeight: 500
              }}>✓ Verification code will be sent from <strong>Ashirwad Enterprises</strong></small>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="form-group"
            >
              <label className="form-label" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block', color: '#1f2937' }}>🔐 Password</label>
              <input 
                type="password" 
                placeholder="Create a strong password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'all 0.3s',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea'
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb'
                  e.target.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
                }}
                required
                minLength={6}
              />
              <small style={{ 
                color: '#6b7280', 
                fontSize: 13,
                marginTop: 8,
                display: 'block',
                fontWeight: 500
              }}>🔒 Minimum 6 characters for security</small>
            </motion.div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="alert error"
                style={{ 
                  background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', 
                  border: '2px solid #f87171', 
                  color: '#991b1b', 
                  padding: 14, 
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                ⚠️ {error}
              </motion.div>
            )}
            
            <motion.button 
              type="submit" 
              className="btn"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              style={{ 
                marginTop: 12,
                padding: '14px 28px',
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 10px 25px rgba(102, 126, 234, 0.3)',
                cursor: 'pointer',
                border: 'none',
                color: 'white',
                transition: 'all 0.3s'
              }}
            >
              {loading ? (
                <span>⏳ Creating account...</span>
              ) : (
                <span>✓ Create Account & Send Verification Code</span>
              )}
            </motion.button>
          </form>
          
          <div style={{ 
            marginTop: 28, 
            textAlign: 'center', 
            fontSize: 15, 
            color: '#6b7280',
            fontWeight: 500
          }}>
            Already have an account? <Link to="/login" style={{ 
              fontWeight: 700, 
              color: '#667eea', 
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}>Sign in here</Link>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{ 
              marginTop: 24, 
              padding: 14, 
              background: 'linear-gradient(135deg, #f0fdf4 0%, #f7fee7 100%)',
              borderRadius: 10, 
              fontSize: 13, 
              color: '#166534', 
              textAlign: 'center',
              fontWeight: 600,
              border: '1px solid #bbf7d0'
            }}
          >
            🔒 Email verification <strong>REQUIRED</strong> | ✅ From <strong>Ashirwad Enterprises</strong> | ⏱️ 2-3 minutes
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
