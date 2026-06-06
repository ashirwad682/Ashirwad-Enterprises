import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { Link } from 'react-router-dom'
import BrandVideoLogo from '../components/BrandVideoLogo'
import BrandLoadingOverlay from '../components/BrandLoadingOverlay'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001'

export default function ContactPage() {
  const accentFont = "'Space Grotesk', 'Sora', 'Inter', system-ui, -apple-system, sans-serif"
  const [formStatus, setFormStatus] = useState(null)
  const [formError, setFormError] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' })
  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const cardStyle = {
    background: '#fff',
    borderRadius: 22,
    padding: 'clamp(20px, 5vw, 32px)',
    border: '1px solid #e8edf5',
    boxShadow: '0 18px 60px rgba(15,23,42,0.10)'
  }

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) console.error("Supabase auth error:", error)
        
        const u = data?.user
        if (u) {
          setUser(u)
          setFormData((f) => ({
            ...f,
            email: u.email || f.email,
            name: u.user_metadata?.full_name || u.email || f.name
          }))
        }
      } catch (err) {
        console.error("Failed to load user workspace:", err)
      } finally {
        setLoadingUser(false)
      }
    }
    loadUser()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormStatus('Sending...')
    setFormError(null)
    try {
      const res = await fetch(`${API_BASE}/api/support/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userId: user?.id })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to send message')
      }
      const body = await res.json()
      setFormStatus(body.message || 'Message received! We will reply within 2-3 working days.')
      setFormData({ name: user?.user_metadata?.full_name || '', email: user?.email || '', subject: '', message: '' })
      setTimeout(() => setFormStatus(null), 5000)
    } catch (err) {
      setFormStatus(null)
      
      const errorMessage = err.message === 'Failed to fetch' ? 'Unable to connect to the server. Please ensure the backend server is running.' : err.message;
      setFormError(errorMessage)
    }
  }

  if (loadingUser) return <BrandLoadingOverlay message="Preparing contact workspace…" />

  if (!user) {
    return (
      <div style={{ background: '#f5f7fb', minHeight: '100vh', fontFamily: accentFont, display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ background: '#fff', padding: 32, borderRadius: 16, boxShadow: '0 16px 50px rgba(0,0,0,0.08)', maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <BrandVideoLogo size={70} style={{ margin: '0 auto 16px', display: 'block', boxShadow: '0 14px 36px rgba(10,29,83,0.25)' }} />
          <h2 style={{ marginBottom: 12, color: '#2b7eb8' }}>Please login to contact support</h2>
          <p style={{ color: '#6b7280', marginBottom: 20 }}>The contact form is available after you login so we can auto-fill your registered email.</p>
          <Link to="/login" style={{ display: 'inline-block', padding: '12px 18px', background: '#2b7eb8', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>Go to Login</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'linear-gradient(180deg, #f5f7fb 0%, #ffffff 60%)', minHeight: '100vh', fontFamily: accentFont, paddingBottom: 64 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(24px, 5vw, 48px) clamp(16px, 4vw, 22px)' }}>
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ textAlign: 'center', marginBottom: 48 }}>
          <BrandVideoLogo size={80} style={{ margin: '0 auto 18px', display: 'block', boxShadow: '0 18px 48px rgba(10,29,83,0.28)' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '7px 16px', borderRadius: 999, background: '#e0e7ff', color: '#4338ca', fontWeight: 700, fontSize: 14, letterSpacing: 0.3, marginBottom: 18 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4338ca' }} />
            <span>Ashirwad Support</span>
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 40px)', fontWeight: 900, color: '#0f172a', marginBottom: 14, letterSpacing: '-0.01em' }}>Contact Us</h1>
          <p style={{ color: '#556070', fontSize: 'clamp(15px, 3vw, 18px)', maxWidth: 700, margin: '0 auto', lineHeight: 1.7, fontWeight: 500 }}>
            Our support team leverages the latest technology to ensure your questions are answered quickly and securely. Reach out for help, onboarding, or business inquiries_powered by real-time notifications.
          </p>
        </motion.div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, marginBottom: 48 }}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }} style={{ ...cardStyle, flex: '1 1 400px' }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: '#556070', letterSpacing: 0.2, marginBottom: 4 }}>Message us</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Send a message</div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>Your name</div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your name"
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #d7deea', outline: 'none', fontSize: 14, fontWeight: 600 }}
                  />
                </div>

                <div style={{ flex: '1 1 200px' }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>Email address</div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #d7deea', outline: 'none', fontSize: 14, fontWeight: 600, background: '#f8fafc' }}
                    readOnly
                  />
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Auto-filled from your login. Replies go here.</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>Subject</div>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="How can we help?"
                  required
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #d7deea', outline: 'none', fontSize: 14, fontWeight: 600 }}
                />
              </div>

              <div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>Message</div>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Tell us about your inquiry..."
                  required
                  rows={4}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #d7deea', outline: 'none', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  background: '#0b5fff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px 16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 12px 30px rgba(11,95,255,0.25)'
                }}
              >
                Send message
              </button>

              {formError && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} style={{ padding: '12px 14px', borderRadius: 12, background: '#fef2f2', color: '#991b1b', fontSize: 14, fontWeight: 600, textAlign: 'center', border: '1px solid #fecdd3' }}>
                  {formError}
                </motion.div>
              )}

              {formStatus && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} style={{ padding: '12px 14px', borderRadius: 12, background: '#f5f8ff', color: '#0b5fff', fontSize: 14, fontWeight: 600, textAlign: 'center', border: '1px solid #cfe3ff' }}>
                  {formStatus}
                </motion.div>
              )}
            </form>
          </motion.div>

          <div style={{ display: 'grid', gap: 16, flex: '1 1 300px', alignContent: 'start' }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', columnGap: 12, marginBottom: 10, alignItems: 'start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f1f5f9', color: '#0b5fff', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 18 }}>
                  <span aria-hidden="true">✉</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#556070', marginBottom: 2 }}>Support</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' }}>ashirwadenterprisesbihar@gmail.com</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Responses in 2-3 working days.</div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.13 }} style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', columnGap: 12, marginBottom: 10, alignItems: 'start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f1f5f9', color: '#0b5fff', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 18 }}>
                  <span aria-hidden="true">📞</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#556070', marginBottom: 2 }}>Access & Onboarding</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}></span>
                    <a href="tel:+916204938006" title="Call" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: '#eef2ff', color: '#0b5fff', textDecoration: 'none' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    </a>
                    <a href="https://wa.me/916204938006" target="_blank" rel="noopener noreferrer" title="WhatsApp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: '#dcf8c6', color: '#16a34a', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437-9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.16 }} style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', columnGap: 12, marginBottom: 10, alignItems: 'start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f1f5f9', color: '#0b5fff', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 18 }}>
                  <span aria-hidden="true">💼</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#556070', marginBottom: 2 }}>Business Inquiries</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' }}>ashirwadenterprisesbihar@gmail.com</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #f8fafc 100%)', border: '1px solid #e1e7f5', borderRadius: 22, padding: 'clamp(20px, 5vw, 32px)', marginBottom: 48, boxShadow: '0 8px 32px rgba(11, 95, 255, 0.05)' }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>How can we help?</h2>
          <p style={{ color: '#6b7280', fontSize: 16, lineHeight: 1.7, marginBottom: 10 }}>
            Our digital-first support system uses smart routing and secure cloud infrastructure to connect you with the right expert, fast.
          </p>
          <ul style={{ color: '#0b5fff', fontWeight: 600, fontSize: 15, margin: '18px 0 0 18px', lineHeight: 1.7 }}>
            {/* <li>AI-powered ticket assignment for faster responses</li> */}
            <li>End-to-end encrypted communication</li>
            <li>24/7 access to your support history</li>
          </ul>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.18 }} style={{ ...cardStyle, background: 'linear-gradient(135deg, #f5f7fb 0%, #f8fafc 100%)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Response time</div>
            <p style={{ color: '#556070', marginBottom: 16 }}>We typically respond to inquiries within 24 hours during business days. For urgent support, please mention it in the subject line.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid #d7deea' }}>
                <div style={{ fontSize: 12, color: '#556070', marginBottom: 2 }}>Support response</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{'< 24hrs'}</div>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid #d7deea' }}>
                <div style={{ fontSize: 12, color: '#556070', marginBottom: 2 }}>Access request</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>1-2 days</div>
              </div>
            </div>
          </div>
        </motion.div>
        

        <div style={{ marginTop: 32, paddingTop: 28, borderTop: '1px solid #e5e7eb', color: '#6b7280', fontSize: 14 }}>
          © PepsiCo Partner – Ashirwad Enterprises. All rights reserved.
        </div>
      </div>
    </div>
  )
}
