import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useMediaQuery } from '../lib/useMediaQuery'

export default function SupportTicket() {
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [formData, setFormData] = useState({
    subject: '',
    category: 'Order Issue',
    priority: 'Medium',
    description: '',
    attachments: []
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @keyframes festiveGradient {
        0% { background-position: 0% 50%; }
        25% { background-position: 50% 100%; }
        50% { background-position: 100% 50%; }
        75% { background-position: 50% 0%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes festivePulse {
        0%, 100% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.05); opacity: 1; }
      }
      .festive-animated-bg {
        background: linear-gradient(45deg, 
          rgba(255, 103, 31, 0.3), 
          rgba(249, 178, 61, 0.3), 
          rgba(4, 106, 56, 0.3), 
          rgba(10, 29, 83, 0.3),
          rgba(255, 103, 31, 0.3));
        background-size: 400% 400%;
        animation: festiveGradient 8s ease infinite;
      }
      .festive-pulse {
        animation: festivePulse 3s ease-in-out infinite;
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    setFormData(prev => ({ ...prev, attachments: files }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate API call
    setTimeout(() => {
      const ticketId = `ASHR-TKT-${Math.floor(1000 + Math.random() * 9000)}`
      
      // Store ticket data
      const ticket = {
        id: ticketId,
        ...formData,
        status: 'Open',
        createdAt: new Date().toISOString(),
        agentActive: true
      }
      localStorage.setItem(`ticket_${ticketId}`, JSON.stringify(ticket))
      
      setIsSubmitting(false)
      
      // Navigate to chat with ticket ID
      navigate(`/support/chat?ticket=${ticketId}`)
    }, 1500)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', paddingTop: 80, position: 'relative', overflow: 'hidden' }}>
      {/* Festive Color Patches - Background */}
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        animate={{ opacity: 0.08, scale: 1 }} 
        transition={{ duration: 1.2, delay: 0.2 }}
        className="festive-pulse"
        style={{ position: 'fixed', top: '5%', right: '8%', width: isMobile ? '120px' : '200px', height: isMobile ? '120px' : '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 103, 31, 0.9), rgba(255, 103, 31, 0))', filter: 'blur(40px)', zIndex: 0, pointerEvents: 'none' }} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        animate={{ opacity: 0.1, scale: 1 }} 
        transition={{ duration: 1.2, delay: 0.4 }}
        className="festive-pulse"
        style={{ position: 'fixed', top: '40%', left: '5%', width: isMobile ? '140px' : '220px', height: isMobile ? '140px' : '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(4, 106, 56, 0.9), rgba(4, 106, 56, 0))', filter: 'blur(45px)', zIndex: 0, pointerEvents: 'none', animationDelay: '0.5s' }} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        animate={{ opacity: 0.09, scale: 1 }} 
        transition={{ duration: 1.2, delay: 0.6 }}
        className="festive-pulse"
        style={{ position: 'fixed', bottom: '10%', right: '20%', width: isMobile ? '100px' : '180px', height: isMobile ? '100px' : '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249, 178, 61, 0.9), rgba(249, 178, 61, 0))', filter: 'blur(35px)', zIndex: 0, pointerEvents: 'none', animationDelay: '1s' }} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        animate={{ opacity: 0.07, scale: 1 }} 
        transition={{ duration: 1.2, delay: 0.8 }}
        className="festive-pulse"
        style={{ position: 'fixed', top: '60%', right: '12%', width: isMobile ? '80px' : '150px', height: isMobile ? '80px' : '150px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 103, 31, 0.8), rgba(255, 103, 31, 0))', filter: 'blur(30px)', zIndex: 0, pointerEvents: 'none', animationDelay: '1.5s' }} 
      />

      {/* Hero Section */}
      <section style={{ position: 'relative', padding: isMobile ? '50px 20px 40px' : '70px 24px 50px', zIndex: 1 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 999, background: 'rgba(255,103,31,0.08)', border: '1px solid rgba(255,103,31,0.2)', fontSize: 13, fontWeight: 700, marginBottom: 20, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--brand-saffron)' }}
          >
            🎫 Support Center
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            style={{ fontSize: isMobile ? 'clamp(2rem, 6vw, 2.8rem)' : 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 900, marginBottom: 16, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
          >
            Create Support Ticket
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            style={{ fontSize: isMobile ? 15 : 18, color: 'var(--text-secondary)', maxWidth: 700, margin: '0 auto' }}
          >
            Hi Distributor, fill in the details below to get assistance with your orders or account.
          </motion.p>
        </div>
      </section>

      {/* Ticket Form */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: isMobile ? '0 20px 60px' : '0 24px 80px', position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div style={{ padding: isMobile ? '32px 24px' : '48px 56px', borderRadius: 24, background: '#fff', boxShadow: '0 24px 80px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
            {/* Gradient border top */}
            <div className="festive-animated-bg" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, opacity: 0.8 }} />
            
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 28 }}>
              {/* Subject */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 16, marginBottom: 12, color: 'var(--text-primary)' }}>
                  Subject
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: 'var(--brand-saffron)' }}>📝</span>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="e.g., Delay in Order #6920 Delivery"
                    required
                    style={{ width: '100%', padding: '16px 18px 16px 54px', borderRadius: 14, border: '2px solid rgba(0,0,0,0.08)', fontSize: 16, outline: 'none', transition: 'all 0.3s ease', background: '#fff' }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--brand-saffron)'; e.target.style.boxShadow = '0 4px 20px rgba(255,103,31,0.15)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
              </div>

              {/* Category & Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: 16, marginBottom: 12, color: 'var(--text-primary)' }}>
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '16px 18px', borderRadius: 14, border: '2px solid rgba(0,0,0,0.08)', fontSize: 16, outline: 'none', background: '#fff', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}
                  >
                    <option>Order Issue</option>
                    <option>Delivery Problem</option>
                    <option>Payment Issue</option>
                    <option>Account Problem</option>
                    <option>Technical Support</option>
                    <option>Product Inquiry</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: 16, marginBottom: 12, color: 'var(--text-primary)' }}>
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '16px 18px', borderRadius: 14, border: '2px solid rgba(0,0,0,0.08)', fontSize: 16, outline: 'none', background: '#fff', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>
              </div>

              {/* Detailed Description */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 16, marginBottom: 12, color: 'var(--text-primary)' }}>
                  Detailed Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Please provide as much detail as possible to help us resolve your case faster..."
                  required
                  rows={6}
                  style={{ width: '100%', padding: '16px 18px', borderRadius: 14, border: '2px solid rgba(0,0,0,0.08)', fontSize: 16, outline: 'none', resize: 'vertical', fontFamily: 'inherit', transition: 'all 0.3s ease', background: '#fff', lineHeight: 1.6 }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--brand-saffron)'; e.target.style.boxShadow = '0 4px 20px rgba(255,103,31,0.15)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              {/* Attachments */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 16, marginBottom: 12, color: 'var(--text-primary)' }}>
                  Attachments
                </label>
                <div style={{ border: '3px dashed rgba(255,103,31,0.2)', borderRadius: 16, padding: '40px 28px', textAlign: 'center', background: 'rgba(255,103,31,0.03)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--brand-saffron)'; e.currentTarget.style.background = 'rgba(255,103,31,0.1)' }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,103,31,0.2)'; e.currentTarget.style.background = 'rgba(255,103,31,0.03)' }}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,103,31,0.2)'; e.currentTarget.style.background = 'rgba(255,103,31,0.03)' }}
                >
                  <div style={{ fontSize: 56, marginBottom: 16 }}>☁️</div>
                  <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
                    <span style={{ color: 'var(--brand-saffron)', fontWeight: 700, textDecoration: 'underline', fontSize: 16 }}>Upload a file</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 16 }}> or drag and drop</span>
                  </label>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 10, fontWeight: 500 }}>PNG, JPG, PDF up to 10MB</div>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.pdf"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  {formData.attachments.length > 0 && (
                    <div style={{ marginTop: 18, fontSize: 15, color: 'var(--brand-green)', fontWeight: 700 }}>
                      ✓ {formData.attachments.length} file(s) selected
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: isSubmitting ? 1 : 1.02, y: isSubmitting ? 0 : -2 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                style={{
                  width: '100%',
                  padding: '18px 36px',
                  borderRadius: 14,
                  border: 'none',
                  background: isSubmitting 
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(236,72,153,0.5))' 
                    : 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                  color: '#fff',
                  fontSize: 17,
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                  boxShadow: isSubmitting ? 'none' : '0 16px 48px rgba(99, 102, 241, 0.35)',
                  transition: 'all 0.3s ease',
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase'
                }}
              >
                {isSubmitting ? (
                  <>
                    <div style={{ width: 22, height: 22, border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Creating Ticket...
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 20 }}>▶</span> Submit Case & Start Chat
                  </>
                )}
              </motion.button>
            </form>
          </div>

          {/* Info Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 20, marginTop: 40 }}>
            <InfoCard icon="⚡" title="Fast Response" description="Average response time: 2-5 minutes" />
            <InfoCard icon="🤖" title="AI Assistance" description="Instant AI support with human backup" />
            <InfoCard icon="🕐" title="24/7 Support" description="We're here whenever you need us" />
          </div>
        </motion.div>
      </section>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function InfoCard({ icon, title, description }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -6, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
      style={{
        padding: '28px 24px',
        borderRadius: 18,
        background: '#fff',
        border: '2px solid rgba(0,0,0,0.06)',
        textAlign: 'center',
        transition: 'all 0.3s ease',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
      }}
    >
      <div style={{ fontSize: 42, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{description}</div>
    </motion.div>
  )
}
