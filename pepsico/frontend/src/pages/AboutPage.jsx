import React from 'react'
import { motion } from 'framer-motion'
import BrandVideoLogo from '../components/BrandVideoLogo'

export default function AboutPage() {
  const accentFont = "'Space Grotesk', 'Sora', 'Inter', system-ui, -apple-system, sans-serif"

  const cardStyle = {
    background: '#fff',
    borderRadius: 18,
    padding: '28px 28px 32px',
    border: '1px solid #e8edf5',
    boxShadow: '0 18px 60px rgba(15,23,42,0.08)'
  }

  const featureCardStyle = {
    ...cardStyle,
    background: 'linear-gradient(135deg, #f5f7fb 0%, #f8fafc 100%)',
    padding: '24px 24px 28px'
  }

  return (
    <div style={{ background: 'linear-gradient(180deg, #f5f7fb 0%, #ffffff 60%)', minHeight: '100vh', fontFamily: accentFont, paddingBottom: 48 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 22px' }}>
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ textAlign: 'center', marginBottom: 48 }}>
          <BrandVideoLogo size={90} style={{ margin: '0 auto 18px', display: 'block', boxShadow: '0 16px 40px rgba(10,29,83,0.22)' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 999, background: '#FFE4B5', color: '#FF8C00', fontWeight: 700, fontSize: 14, letterSpacing: 0.3, marginBottom: 18 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF8C00' }} />
            <span>Ashirwad Enterprises</span>
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, color: '#FF8C00', marginBottom: 14, letterSpacing: '-0.01em' }}>About Us</h1>
          <p style={{ color: '#556070', fontSize: 18, maxWidth: 700, margin: '0 auto', lineHeight: 1.7, fontWeight: 500 }}>
            Ashirwad Enterprises is a leading PepsiCo distributor, blending tradition with technology to deliver excellence across Bihar and beyond. For over 20 years, we have empowered retailers and communities with reliable, innovative, and people-first distribution solutions.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} style={{ background: 'linear-gradient(135deg, #fffbe6 0%, #f8fafc 100%)', borderRadius: 22, padding: '36px 32px', marginBottom: 48, boxShadow: '0 8px 32px rgba(255,140,0,0.08)' }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Our Mission</h2>
          <p style={{ color: '#6b7280', fontSize: 16, lineHeight: 1.7, marginBottom: 10 }}>
            To revolutionize distribution in India by combining deep local knowledge, advanced digital tools, and a commitment to integrity, unity, and customer success.
          </p>
          <ul style={{ color: '#FF8C00', fontWeight: 600, fontSize: 15, margin: '18px 0 0 18px', lineHeight: 1.7 }}>
            <li>Empowering partners with real-time data and insights</li>
            <li>Ensuring seamless, transparent, and secure operations</li>
            <li>Building lasting relationships with retailers and communities</li>
          </ul>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginBottom: 48 }}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.04 }} style={featureCardStyle}>
            <div style={{ fontSize: 15, color: '#FF8C00', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>Technology</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Cloud-Native Platform</div>
            <p style={{ color: '#556070', fontSize: 15, lineHeight: 1.6 }}>Our operations run on a secure, scalable cloud infrastructure, ensuring 24/7 access and reliability for all partners.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }} style={featureCardStyle}>
            <div style={{ fontSize: 15, color: '#FF8C00', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>Innovation</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>AI-Driven Insights</div>
            <p style={{ color: '#556070', fontSize: 15, lineHeight: 1.6 }}>We leverage artificial intelligence for demand forecasting, route optimization, and personalized partner support.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.12 }} style={featureCardStyle}>
            <div style={{ fontSize: 15, color: '#FF8C00', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>Security</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>End-to-End Encryption</div>
            <p style={{ color: '#556070', fontSize: 15, lineHeight: 1.6 }}>All data and transactions are protected with industry-leading encryption and compliance standards.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.16 }} style={featureCardStyle}>
            <div style={{ fontSize: 15, color: '#FF8C00', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>Support</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>24/7 Partner Assistance</div>
            <p style={{ color: '#556070', fontSize: 15, lineHeight: 1.6 }}>Our dedicated support team is always available to help partners and retailers succeed.</p>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }} style={{ ...cardStyle, background: 'linear-gradient(135deg, #FF8C00 0%, #FFB347 100%)', color: '#fff', textAlign: 'center' }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Join the Future of Distribution</h2>
          <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: 16, marginBottom: 18, fontWeight: 500 }}>
            Discover how Ashirwad Enterprises is setting new standards for efficiency, transparency, and growth in the distribution industry.
          </p>
          <a href="/contact" style={{ background: '#fff', color: '#FF8C00', border: 'none', borderRadius: 12, padding: '14px 32px', fontWeight: 800, fontSize: 17, cursor: 'pointer', textDecoration: 'none', boxShadow: '0 12px 40px rgba(0,0,0,0.13)' }}>
            Contact Us
          </a>
        </motion.div>
      </div>
    </div>
  )
}
