import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useMediaQuery } from '../lib/useMediaQuery'

export default function TermsConditions() {
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
          style={{ position: 'absolute', top: '10%', right: '10%', width: isMobile ? '70px' : '130px', height: isMobile ? '70px' : '130px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249, 178, 61, 0.8), rgba(249, 178, 61, 0))', filter: 'blur(20px)' }} 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0 }} 
          animate={{ opacity: 0.5, scale: 1 }} 
          transition={{ duration: 1, delay: 0.4 }}
          className="festive-pulse"
          style={{ position: 'absolute', bottom: '20%', left: '10%', width: isMobile ? '90px' : '160px', height: isMobile ? '90px' : '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(4, 106, 56, 0.8), rgba(4, 106, 56, 0))', filter: 'blur(25px)', animationDelay: '0.5s' }} 
        />
        
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 700, marginBottom: 24, textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            📜 Legal Agreement
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            style={{ fontSize: isMobile ? 'clamp(2rem, 6vw, 3rem)' : 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 900, marginBottom: 16, letterSpacing: '-0.02em' }}
          >
            Terms & Conditions
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            style={{ fontSize: isMobile ? 16 : 18, opacity: 0.9, maxWidth: 700, margin: '0 auto 20px' }}
          >
            Please read these terms carefully before using our distribution management platform.
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
          <Section title="1. Agreement to Terms">
            <p>
              By accessing or using the Ashirwad Enterprises distribution management platform ("Platform"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you may not access or use our services.
            </p>
            <p style={{ marginTop: 12 }}>
              These Terms constitute a legally binding agreement between you and Ashirwad Enterprises ("Company," "we," "our," or "us").
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>You must meet the following requirements to use our Platform:</p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Be at least 18 years of age</li>
              <li>Have the legal capacity to enter into binding contracts</li>
              <li>Be authorized to act on behalf of your business entity (if applicable)</li>
              <li>Comply with all applicable laws and regulations in your jurisdiction</li>
            </ul>
          </Section>

          <Section title="3. User Accounts">
            <h4 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: 'var(--brand-saffron)' }}>3.1 Account Registration</h4>
            <p>To access certain features, you must create an account by providing:</p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Accurate and complete registration information</li>
              <li>Valid business credentials and documentation</li>
              <li>Contact information for communication purposes</li>
            </ul>

            <h4 style={{ fontSize: 17, fontWeight: 700, marginTop: 24, marginBottom: 12, color: 'var(--brand-saffron)' }}>3.2 Account Security</h4>
            <p>You are responsible for:</p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Maintaining the confidentiality of your login credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized access</li>
              <li>Ensuring your account information remains accurate and up-to-date</li>
            </ul>
          </Section>

          <Section title="4. Authorized Use">
            <p>You agree to use the Platform only for lawful purposes and in accordance with these Terms. You agree NOT to:</p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Violate any applicable laws, regulations, or third-party rights</li>
              <li>Use the Platform for fraudulent or malicious purposes</li>
              <li>Attempt to gain unauthorized access to our systems or networks</li>
              <li>Interfere with or disrupt the Platform's operation</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Platform</li>
              <li>Use automated tools to access the Platform without authorization</li>
              <li>Transmit viruses, malware, or harmful code</li>
              <li>Impersonate others or misrepresent your affiliation</li>
            </ul>
          </Section>

          <Section title="5. Services and Features">
            <h4 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: 'var(--brand-saffron)' }}>5.1 Distribution Services</h4>
            <p>Our Platform provides the following services:</p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Order management and processing</li>
              <li>Inventory tracking and management</li>
              <li>Delivery coordination and tracking</li>
              <li>Reporting and analytics tools</li>
              <li>Partner and customer management</li>
            </ul>

            <h4 style={{ fontSize: 17, fontWeight: 700, marginTop: 24, marginBottom: 12, color: 'var(--brand-saffron)' }}>5.2 Service Modifications</h4>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Platform at any time, with or without notice. We are not liable for any modification, suspension, or discontinuation of services.
            </p>
          </Section>

          <Section title="6. Orders and Transactions">
            <h4 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: 'var(--brand-saffron)' }}>6.1 Order Placement</h4>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>All orders are subject to acceptance and availability</li>
              <li>We reserve the right to refuse or cancel any order</li>
              <li>Prices and product availability are subject to change</li>
            </ul>

            <h4 style={{ fontSize: 17, fontWeight: 700, marginTop: 24, marginBottom: 12, color: 'var(--brand-saffron)' }}>6.2 Payment Terms</h4>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Payment must be made according to agreed terms</li>
              <li>All prices are subject to applicable taxes and fees</li>
              <li>Late payments may incur additional charges</li>
              <li>You are responsible for all payment processing fees</li>
            </ul>

            <h4 style={{ fontSize: 17, fontWeight: 700, marginTop: 24, marginBottom: 12, color: 'var(--brand-saffron)' }}>6.3 Delivery</h4>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Delivery timelines are estimates and not guaranteed</li>
              <li>Risk of loss transfers to you upon delivery</li>
              <li>You must inspect deliveries and report discrepancies within 24 hours</li>
            </ul>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              All content, features, and functionality of the Platform, including but not limited to text, graphics, logos, images, software, and design, are the exclusive property of Ashirwad Enterprises or its licensors and are protected by copyright, trademark, and other intellectual property laws.
            </p>
            <p style={{ marginTop: 12 }}>
              You may not copy, modify, distribute, sell, or lease any part of our Platform without our express written permission.
            </p>
          </Section>

          <Section title="8. User Content">
            <p>
              You retain ownership of any content you submit to the Platform. However, by submitting content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and display such content for the purpose of operating and improving our services.
            </p>
          </Section>

          <Section title="9. Privacy and Data Protection">
            <p>
              Your use of the Platform is also governed by our Privacy Policy. By using our services, you consent to the collection, use, and disclosure of your information as described in our Privacy Policy.
            </p>
            <p style={{ marginTop: 12 }}>
              Please review our <a href="/privacy-policy" style={{ color: 'var(--brand-saffron)', fontWeight: 600 }}>Privacy Policy</a> for detailed information.
            </p>
          </Section>

          <Section title="10. Disclaimers and Limitations">
            <h4 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: 'var(--brand-saffron)' }}>10.1 Service Availability</h4>
            <p>
              The Platform is provided "as is" and "as available." We do not guarantee uninterrupted, secure, or error-free operation. We may experience downtime for maintenance, updates, or unforeseen technical issues.
            </p>

            <h4 style={{ fontSize: 17, fontWeight: 700, marginTop: 24, marginBottom: 12, color: 'var(--brand-saffron)' }}>10.2 Warranty Disclaimer</h4>
            <p>
              We disclaim all warranties, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Platform will meet your requirements or that defects will be corrected.
            </p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Ashirwad Enterprises shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities, arising from:
            </p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Your use or inability to use the Platform</li>
              <li>Unauthorized access to your account or data</li>
              <li>Errors, interruptions, or delays in service</li>
              <li>Third-party conduct or content</li>
            </ul>
            <p style={{ marginTop: 16 }}>
              Our total liability for any claim arising from these Terms shall not exceed the amount you paid us in the twelve (12) months preceding the claim.
            </p>
          </Section>

          <Section title="12. Indemnification">
            <p>
              You agree to indemnify, defend, and hold harmless Ashirwad Enterprises, its affiliates, officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses (including reasonable attorneys' fees) arising from:
            </p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Your use of the Platform</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any third-party rights</li>
              <li>Your negligence or willful misconduct</li>
            </ul>
          </Section>

          <Section title="13. Termination">
            <p>
              We reserve the right to suspend or terminate your account and access to the Platform at our sole discretion, without notice, for:
            </p>
            <ul style={{ marginLeft: 24, lineHeight: 2 }}>
              <li>Violation of these Terms</li>
              <li>Fraudulent, abusive, or illegal activity</li>
              <li>Non-payment or breach of payment terms</li>
              <li>Any other reason we deem appropriate</li>
            </ul>
            <p style={{ marginTop: 16 }}>
              Upon termination, your right to use the Platform immediately ceases. We are not liable for any loss or damage resulting from termination.
            </p>
          </Section>

          <Section title="14. Governing Law and Dispute Resolution">
            <h4 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: 'var(--brand-saffron)' }}>14.1 Governing Law</h4>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India, without regard to conflict of law principles.
            </p>

            <h4 style={{ fontSize: 17, fontWeight: 700, marginTop: 24, marginBottom: 12, color: 'var(--brand-saffron)' }}>14.2 Dispute Resolution</h4>
            <p>
              Any disputes arising from these Terms shall first be resolved through good-faith negotiations. If negotiations fail, disputes shall be resolved through binding arbitration in accordance with Indian arbitration laws.
            </p>
          </Section>

          <Section title="15. Changes to Terms">
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on our Platform and updating the "Last Updated" date. Your continued use of the Platform after changes constitutes acceptance of the modified Terms.
            </p>
          </Section>

          <Section title="16. Severability">
            <p>
              If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.
            </p>
          </Section>

          <Section title="17. Entire Agreement">
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and Ashirwad Enterprises regarding your use of the Platform and supersede all prior agreements and understandings.
            </p>
          </Section>

          <Section title="18. Contact Information">
            <p>
              For questions or concerns regarding these Terms, please contact us:
            </p>
            <div style={{ padding: '24px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border-light)', marginTop: 20 }}>
              <p style={{ margin: 0, lineHeight: 1.8 }}>
                <strong>Ashirwad Enterprises</strong><br />
                Email: <a href="mailto:ashirwadenterprisesbihar@gmail.com" style={{ color: 'var(--brand-saffron)', fontWeight: 600 }}>ashirwadenterprisesbihar@gmail.com</a><br />
                Support: Available 24/7
              </p>
            </div>
          </Section>

          {/* Acceptance Notice */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            style={{ padding: '28px', borderRadius: 20, background: 'linear-gradient(135deg, rgba(255, 103, 31, 0.1), rgba(4, 106, 56, 0.1))', border: '2px solid var(--brand-saffron)', textAlign: 'center' }}
          >
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              By using our Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions.
            </p>
          </motion.div>

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
