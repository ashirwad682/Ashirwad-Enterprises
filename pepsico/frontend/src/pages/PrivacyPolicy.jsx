import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useMediaQuery } from '../lib/useMediaQuery'

export default function PrivacyPolicy() {
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')

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
        50% { transform: scale(1.1); opacity: 1; }
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', paddingTop: 80 }}>
      {/* Hero Section */}
      <section className="festive-animated-bg" style={{ position: 'relative', padding: isMobile ? '60px 20px' : '80px 24px', color: 'var(--brand-white)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--brand-gradient-night)', opacity: 0.9 }} />
        
        {/* Festive Color Patches */}
        <motion.div 
          initial={{ opacity: 0, scale: 0 }} 
          animate={{ opacity: 0.4, scale: 1 }} 
          transition={{ duration: 1, delay: 0.2 }}
          className="festive-pulse"
          style={{ position: 'absolute', top: '10%', left: '5%', width: isMobile ? '60px' : '120px', height: isMobile ? '60px' : '120px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 103, 31, 0.8), rgba(255, 103, 31, 0))', filter: 'blur(20px)' }} 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0 }} 
          animate={{ opacity: 0.5, scale: 1 }} 
          transition={{ duration: 1, delay: 0.4 }}
          className="festive-pulse"
          style={{ position: 'absolute', top: '60%', right: '8%', width: isMobile ? '80px' : '150px', height: isMobile ? '80px' : '150px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(4, 106, 56, 0.8), rgba(4, 106, 56, 0))', filter: 'blur(25px)', animationDelay: '0.5s' }} 
        />
        
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 700, marginBottom: 24, textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            🔒 Legal Document
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            style={{ fontSize: isMobile ? 'clamp(2rem, 6vw, 3rem)' : 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 900, marginBottom: 16, letterSpacing: '-0.02em' }}
          >
            Privacy Policy
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            style={{ fontSize: isMobile ? 16 : 18, opacity: 0.9, maxWidth: 700, margin: '0 auto 20px' }}
          >
            Your privacy is our priority. Learn how we collect, use, and protect your information.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            style={{ fontSize: 14, opacity: 0.8 }}
          >
            Last Updated: February 12, 2026
          </motion.div>
        </div>
      </section>

      {/* Content Section */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '60px 20px' : '80px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ display: 'grid', gap: 40 }}
        >
          <Section title="1. Introduction">
            <p>
              Welcome to Ashirwad Enterprises ("we," "our," or "us"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our distribution management platform. By accessing or using our services, you agree to this Privacy Policy.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <h4 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: 'var(--brand-saffron)' }}>2.1 Personal Information</h4>
            <p>We may collect personal information that you provide directly to us, including:</p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Name, email address, and phone number</li>
              <li>Business information and company details</li>
              <li>Account credentials and authentication data</li>
              <li>Delivery addresses and location information</li>
              <li>Payment and transaction information</li>
            </ul>

            <h4 style={{ fontSize: 17, fontWeight: 700, marginTop: 24, marginBottom: 12, color: 'var(--brand-saffron)' }}>2.2 Usage Information</h4>
            <p>We automatically collect certain information when you use our platform:</p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Device information (IP address, browser type, operating system)</li>
              <li>Usage patterns and interaction data</li>
              <li>Log files and analytics data</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect for the following purposes:</p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li><strong>Service Delivery:</strong> To provide, maintain, and improve our distribution management services</li>
              <li><strong>Order Processing:</strong> To process orders, manage deliveries, and handle transactions</li>
              <li><strong>Communication:</strong> To send you updates, notifications, and customer support responses</li>
              <li><strong>Analytics:</strong> To analyze usage patterns and optimize our platform performance</li>
              <li><strong>Security:</strong> To protect against fraud, unauthorized access, and security threats</li>
              <li><strong>Compliance:</strong> To comply with legal obligations and regulatory requirements</li>
            </ul>
          </Section>

          <Section title="4. Information Sharing and Disclosure">
            <p>We may share your information in the following circumstances:</p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li><strong>With PepsiCo:</strong> As an authorized distributor, we share necessary information with PepsiCo for order fulfillment and compliance</li>
              <li><strong>Service Providers:</strong> With third-party vendors who assist in operating our platform (cloud hosting, payment processing, analytics)</li>
              <li><strong>Delivery Partners:</strong> With authorized delivery partners to facilitate order fulfillment</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or governmental request</li>
              <li><strong>Business Transfers:</strong> In connection with any merger, sale, or transfer of our business assets</li>
            </ul>
            <p style={{ marginTop: 16 }}>
              We do <strong>not</strong> sell, rent, or trade your personal information to third parties for marketing purposes.
            </p>
          </Section>

          <Section title="5. Data Security">
            <p>
              We implement industry-standard security measures to protect your information, including:
            </p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Encryption of data in transit and at rest (SSL/TLS)</li>
              <li>Secure authentication and access controls</li>
              <li>Regular security audits and monitoring</li>
              <li>Employee training on data protection</li>
              <li>Firewall and intrusion detection systems</li>
            </ul>
            <p style={{ marginTop: 16 }}>
              However, no method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="6. Your Rights and Choices">
            <p>You have the following rights regarding your personal information:</p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li><strong>Access:</strong> Request access to your personal information</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal obligations)</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Data Portability:</strong> Request a copy of your data in a portable format</li>
            </ul>
            <p style={{ marginTop: 16 }}>
              To exercise these rights, please contact us at <a href="mailto:ashirwadenterprisesbihar@gmail.com" style={{ color: 'var(--brand-saffron)', fontWeight: 600 }}>ashirwadenterprisesbihar@gmail.com</a>
            </p>
          </Section>

          <Section title="7. Cookies and Tracking Technologies">
            <p>
              We use cookies and similar technologies to enhance your experience. You can control cookies through your browser settings. However, disabling cookies may limit certain features of our platform.
            </p>
          </Section>

          <Section title="8. Third-Party Links">
            <p>
              Our platform may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies.
            </p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>
              Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children.
            </p>
          </Section>

          <Section title="10. Changes to This Privacy Policy">
            <p>
              We may update this Privacy Policy periodically. We will notify you of significant changes by posting the updated policy on our platform and updating the "Last Updated" date. Your continued use of our services after changes indicates your acceptance of the updated policy.
            </p>
          </Section>

          <Section title="11. Contact Us">
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy, please contact us:
            </p>
            <div style={{ padding: '24px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border-light)', marginTop: 20 }}>
              <p style={{ margin: 0, lineHeight: 1.8 }}>
                <strong>Ashirwad Enterprises</strong><br />
                Email: <a href="mailto:ashirwadenterprisesbihar@gmail.com" style={{ color: 'var(--brand-saffron)', fontWeight: 600 }}>ashirwadenterprisesbihar@gmail.com</a><br />
                Support: Available 24/7
              </p>
            </div>
          </Section>

          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginTop: 40 }}
          >
            <button
              onClick={() => navigate(-1)}
              className="btn outline"
              style={{ padding: '14px 32px', fontSize: 16, fontWeight: 600 }}
            >
              ← Go Back
            </button>
          </motion.div>
        </motion.div>
      </section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      style={{ padding: '28px', borderRadius: 20, background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}
    >
      <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="festive-pulse" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-saffron)' }} />
        {title}
      </h3>
      <div style={{ fontSize: 15, lineHeight: 1.9, color: 'var(--text-secondary)' }}>
        {children}
      </div>
    </motion.div>
  )
}
