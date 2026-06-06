import React from 'react'
import { useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import BrandVideoLogo from './BrandVideoLogo'

const SOCIAL_LINKS = [
  { key: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com' },
  { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com' },
  { key: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/916204938006' },
  { key: 'twitter', label: 'Twitter', href: 'https://twitter.com' },
  { key: 'email', label: 'Email', href: 'mailto:ashirwadenterprisesbihar@gmail.com' },
  { key: 'facebook', label: 'Facebook', href: 'https://www.facebook.com' }
]

export default function Footer() {
  const { pathname } = useLocation()
  const hideFooter = pathname.startsWith('/admin/dashboard')
    || pathname.startsWith('/delivery-dashboard')
    || pathname.startsWith('/delevery')
    || pathname.startsWith('/manager-dashboard')
    || pathname.startsWith('/warehouse-dashboard')
    || pathname === '/warehouse'
    || pathname === '/warehouse-login'
    || pathname === '/dashboard/order-success'

  if (hideFooter) return null

  return (
    <footer className="site-footer">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="site-footer__inner"
      >
        <div className="site-footer__grid">
          {/* Brand Section */}
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BrandVideoLogo size={64} style={{ boxShadow: '0 26px 70px rgba(0,0,0,0.36)', borderRadius: 18 }} />
              <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', lineHeight: 1.1 }}>ASHIRWAD</div>
                  <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', lineHeight: 1.1, opacity: 0.92 }}>ENTERPRISES</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '4px 0 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.36)' }} />
                    <span style={{ fontSize: 7, lineHeight: 1, color: 'rgba(255,255,255,0.62)' }}>◆</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.36)' }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PepsiCo Distributor</div>
              </div>
            </div>
            <p style={{ margin: 0, opacity: 0.9, fontSize: 13, lineHeight: 1.7 }}>
              Premium distribution technology to plan releases, push orders, and deliver a unified PepsiCo experience across every territory.
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {SOCIAL_LINKS.map((item) => (
                <SocialIconLink key={item.key} platform={item.key} href={item.href} label={item.label} />
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9 }}>Quick Links</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <FooterLink label="Home" href="/" />
              <FooterLink label="Dashboard" href="/dashboard" />
              <FooterLink label="About" href="/about" />
              <FooterLink label="Contact" href="/contact" />
            </div>
          </div>

          {/* Support */}
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9 }}>Support</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <FooterLink label="🎫 Raise Ticket" href="/support/ticket" />
              <FooterLink label="💬 Chat Assistance" href="/support/chat" />
              <FooterAnchor href="mailto:ashirwadenterprisesbihar@gmail.com">📧 Email Support</FooterAnchor>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>🕐 Support window: 24/7</div>
            </div>
          </div>

          {/* Legal */}
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9 }}>Legal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <FooterLink label="Terms & Conditions" href="/terms-conditions" />
              <FooterLink label="Privacy Policy" href="/privacy-policy" />
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="site-footer__base">
          <div>
            © {new Date().getFullYear()} Ashirwad Enterprises. Authorized PepsiCo Distributor.
          </div>
          {/* <div>
            Powered by React, Node.js & Supabase
          </div> */}
        </div>
      </motion.div>
    </footer>
  )
}

function FooterLink({ label, href }) {
  return (
    <Link
      to={href}
      style={{
        color: 'rgba(255,255,255,0.8)',
        textDecoration: 'none',
        transition: 'color 0.2s ease'
      }}
      onMouseEnter={(event) => { event.target.style.color = '#fff' }}
      onMouseLeave={(event) => { event.target.style.color = 'rgba(255,255,255,0.8)' }}
    >
      {label}
    </Link>
  )
}

function FooterAnchor({ href, children }) {
  return (
    <a
      href={href}
      style={{
        color: 'rgba(255,255,255,0.8)',
        textDecoration: 'none',
        transition: 'color 0.2s ease'
      }}
      onMouseEnter={(event) => { event.target.style.color = '#fff' }}
      onMouseLeave={(event) => { event.target.style.color = 'rgba(255,255,255,0.8)' }}
    >
      {children}
    </a>
  )
}

function SocialIconLink({ platform, href, label }) {
  return (
    <a
      href={href}
      target={href.startsWith('mailto:') ? undefined : '_blank'}
      rel={href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
      aria-label={label}
      title={label}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.26)',
        background: 'rgba(238, 242, 248, 0.12)',
        color: '#d9e1ee',
        display: 'grid',
        placeItems: 'center',
        textDecoration: 'none',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(2px)'
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = 'rgba(238, 242, 248, 0.24)'
        event.currentTarget.style.color = '#ffffff'
        event.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'rgba(238, 242, 248, 0.12)'
        event.currentTarget.style.color = '#d9e1ee'
        event.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <SocialGlyph platform={platform} />
    </a>
  )
}

function SocialGlyph({ platform }) {
  if (platform === 'linkedin') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M5.34 3.5a1.84 1.84 0 1 1 0 3.68 1.84 1.84 0 0 1 0-3.68zM3.75 8.25h3.2v12h-3.2zm5.2 0h3.06v1.64h.04c.43-.81 1.48-1.66 3.05-1.66 3.26 0 3.86 2.14 3.86 4.92v7.1h-3.2v-6.3c0-1.5-.03-3.43-2.09-3.43-2.1 0-2.42 1.63-2.42 3.32v6.41h-3.2z" />
      </svg>
    )
  }

  if (platform === 'instagram') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (platform === 'whatsapp') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.52 3.48A11.8 11.8 0 0 0 12.06 0C5.43 0 .03 5.4.02 12.03a11.9 11.9 0 0 0 1.61 6L0 24l6.2-1.62a12 12 0 0 0 5.86 1.5h.01c6.63 0 12.03-5.4 12.03-12.03a11.9 11.9 0 0 0-3.58-8.37zm-8.45 18.3h-.01a9.9 9.9 0 0 1-5.02-1.37l-.36-.21-3.68.97.98-3.6-.24-.37a9.9 9.9 0 0 1-1.52-5.3c0-5.45 4.43-9.88 9.88-9.88a9.8 9.8 0 0 1 6.99 2.9 9.8 9.8 0 0 1 2.9 6.98c0 5.45-4.43 9.88-9.88 9.88zm5.42-7.39c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.29-.77.96-.94 1.16-.17.2-.35.22-.65.08-.3-.15-1.25-.47-2.39-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.29-.02-.45.13-.6.13-.13.3-.35.45-.52.15-.17.2-.29.3-.49.1-.2.05-.37-.03-.52-.07-.15-.66-1.61-.91-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.34z" />
      </svg>
    )
  }

  if (platform === 'twitter') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22 5.9c-.74.33-1.54.55-2.37.65a4.1 4.1 0 0 0 1.8-2.27 8.3 8.3 0 0 1-2.62 1 4.14 4.14 0 0 0-7.06 3.77A11.76 11.76 0 0 1 3.2 4.7a4.14 4.14 0 0 0 1.28 5.53c-.64-.02-1.24-.2-1.76-.48v.05c0 2 1.42 3.67 3.3 4.05a4.2 4.2 0 0 1-1.86.07 4.15 4.15 0 0 0 3.87 2.87A8.33 8.33 0 0 1 2 18.5 11.75 11.75 0 0 0 8.36 20c7.64 0 11.82-6.33 11.82-11.82v-.54c.8-.58 1.5-1.3 2.05-2.12z" />
      </svg>
    )
  }

  if (platform === 'facebook') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.87.24-1.46 1.5-1.46h1.6V4.9c-.28-.04-1.23-.1-2.35-.1-2.32 0-3.91 1.42-3.91 4.02V11H8v3h2.8v8h2.7z" />
      </svg>
    )
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 2v.2l8 4.8 8-4.8V8l-8 4.8L4 8z" />
    </svg>
  )
}
