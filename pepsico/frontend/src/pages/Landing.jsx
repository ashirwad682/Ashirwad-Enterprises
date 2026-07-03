import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import BrandVideoLogo from '../components/BrandVideoLogo'
import { useMediaQuery } from '../lib/useMediaQuery'

const FALLBACK_PALETTE = {
  saffron: { r: 255, g: 103, b: 31 },
  white: { r: 255, g: 255, b: 255 },
  green: { r: 4, g: 106, b: 56 },
  navy: { r: 10, g: 29, b: 83 },
  amber: { r: 249, g: 178, b: 61 }
}

const CLUSTER_TARGETS = {
  saffron: [250, 125, 60],
  white: [240, 240, 240],
  green: [25, 120, 75],
  navy: [30, 55, 120]
}

const SECTION_LINKS = [
  { label: 'About', hash: '#about' },
  { label: 'Services', hash: '#services' },
  { label: 'Why Us', hash: '#why' },
  { label: 'Brand Story', hash: '#brand-story' },
  { label: 'Contact', hash: '#contact' }
]

export default function Landing() {
  const heroVideoRef = useRef(null)
  useDynamicPalette(heroVideoRef)
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
        50% { transform: scale(1.15); opacity: 1; }
      }
      @keyframes festiveFloat {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        33% { transform: translateY(-20px) rotate(5deg); }
        66% { transform: translateY(-10px) rotate(-5deg); }
      }
      @keyframes colorShift {
        0% { filter: hue-rotate(0deg) saturate(1); }
        25% { filter: hue-rotate(45deg) saturate(1.2); }
        50% { filter: hue-rotate(90deg) saturate(1.3); }
        75% { filter: hue-rotate(45deg) saturate(1.2); }
        100% { filter: hue-rotate(0deg) saturate(1); }
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
      .festive-float {
        animation: festiveFloat 4s ease-in-out infinite;
      }
      .color-shift {
        animation: colorShift 6s ease-in-out infinite;
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  return (
    <div style={{ position: 'relative', background: 'var(--bg-page)' }}>
      <Hero videoRef={heroVideoRef} isMobile={isMobile} />
      <ExperienceRibbon isMobile={isMobile} />
      <AboutSection isMobile={isMobile} />
      <ServicesSection isMobile={isMobile} />
      <WhyChooseSection isMobile={isMobile} />
      <BrandStorySection isMobile={isMobile} />
      <CallToActionSection isMobile={isMobile} />
    </div>
  )
}

function Hero({ videoRef, isMobile }) {
  return (
    <section style={{
      position: 'relative',
      padding: isMobile ? '60px 12px 60px' : '80px 16px 80px',
      background: 'var(--brand-gradient-night)',
      color: 'var(--brand-white)',
      overflow: 'hidden'
    }}>
      <div className="festive-animated-bg" style={{ position: 'absolute', inset: 0, opacity: 0.55 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 15% 30%, rgba(255,255,255,0.18), transparent 55%)' }} />
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: isMobile ? 32 : 56, position: 'relative', zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ textAlign: 'center', padding: isMobile ? '0 6px' : 0 }}>
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.6 }} className="festive-float" style={{ marginBottom: 28, display: 'grid', placeItems: 'center', gap: 16 }}>
            <div style={{ display: 'inline-flex', gap: 10, fontSize: 13, fontWeight: 600, background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '10px 20px', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}>
              Ashirwad Enterprises
            </div>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div className="festive-animated-bg" style={{ position: 'absolute', inset: '-26px', borderRadius: 40, filter: 'blur(30px)', opacity: 0.9 }} />
              <BrandVideoLogo ref={videoRef} size={200} style={{ width: 'clamp(140px, 20vw, 200px)', height: 'auto', borderRadius: 30, boxShadow: '0 28px 90px rgba(10,29,83,0.35)' }} />
            </div>
            <div style={{ display: 'inline-flex', gap: 10, fontSize: 13, fontWeight: 600, background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '10px 20px', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}>
              Authorized PepsiCo Distributor
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.7 }} style={{ fontSize: isMobile ? 'clamp(2.2rem, 6vw, 3.2rem)' : 'clamp(2.6rem, 4vw, 4rem)', lineHeight: 1.1, marginBottom: 12, fontWeight: 900, letterSpacing: '-0.02em' }}>
            Ashirwad Enterprises
          </motion.h1>
          <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.7 }} style={{ fontSize: isMobile ? 'clamp(1.2rem, 4vw, 1.6rem)' : 'clamp(1.4rem, 2.6vw, 2rem)', fontWeight: 600, marginBottom: 16 }}>
            Distribution Excellence, Powered by Motion Branding
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36, duration: 0.7 }} style={{ fontSize: isMobile ? 16 : 18, opacity: 0.9, marginBottom: isMobile ? 28 : 34 }}>
            A modern PepsiCo distribution platform built for speed, trust, and retail growth across every route.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.7 }} style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: 16, justifyContent: 'center', alignItems: 'center' }}>
            <Link to="/register" className="btn" style={{ padding: '16px 32px', fontSize: 16, fontWeight: 700, background: 'linear-gradient(135deg, var(--brand-saffron) 0%, var(--brand-amber) 100%)', color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.22)', minWidth: 160, width: isMobile ? '100%' : 'auto' }}>
              Get Started
            </Link>
            <Link to="/contact" className="btn outline" style={{ padding: '14px 30px', fontSize: 16, fontWeight: 600, color: 'var(--brand-white)', borderColor: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(14px)', boxShadow: '0 18px 36px rgba(0,0,0,0.18)', minWidth: 160, width: isMobile ? '100%' : 'auto' }}>
              Contact Team
            </Link>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48, duration: 0.6 }} style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: isMobile ? 24 : 36 }}>
            {SECTION_LINKS.map((item) => (
              <a key={item.hash} href={item.hash} style={{ padding: '10px 18px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', fontSize: 13, fontWeight: 600, color: 'var(--brand-white)', transition: 'all 0.25s ease' }}>
                {item.label}
              </a>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function ExperienceRibbon({ isMobile }) {
  const items = [
    'Premium distributor experiences led by admin control',
    'Seamless fulfilment with verified partner journeys',
    'Proudly serving communities with integrity and trust'
  ]

  return (
    <section className="festive-animated-bg" style={{ color: 'var(--brand-white)', padding: isMobile ? '18px 14px' : '22px 16px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: isMobile ? 12 : 18, fontWeight: 600, letterSpacing: 0.2 }}>
        {items.map((item) => (
          <motion.div key={item} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }} style={{ textAlign: 'center', padding: '12px 20px', borderRadius: 18, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}>
            {item}
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function AboutSection({ isMobile }) {
  return (
    <section id="about" style={{ background: '#fff', scrollMarginTop: 90 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '72px 20px' : '100px 24px', display: 'grid', gap: isMobile ? 28 : 40, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'center' }}>
        <motion.div initial={{ opacity: 0, x: isMobile ? 0 : -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ position: 'relative', borderRadius: 28, padding: isMobile ? 22 : 28, background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.75) 100%)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-light)' }}>
          <div style={{ position: 'absolute', inset: '-14px', borderRadius: 36, background: 'var(--gradient-secondary)', opacity: 0.35, filter: 'blur(12px)' }} />
          <div style={{ position: 'relative' }}>
            <SectionHeading title="About Ashirwad Enterprises" subtitle="Heritage blended with forward-looking technology" align="left" isMobile={isMobile} />
            <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              For over two decades, Ashirwad Enterprises has served as a trusted PepsiCo distributor, orchestrating last-mile excellence with reliability and empathy. Our teams combine operational discipline with a strong brand experience to deliver premium beverages to every neighbourhood we serve.
            </p>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 18, lineHeight: 1.8 }}>
              We combine seasoned relationships, data-backed planning, and a people-first approach to ensure every Ashirwad Enterprises delivery feels seamless for retailers and communities alike.
            </p>
            <div style={{ marginTop: 24, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span className="festive-pulse" style={{ padding: '10px 18px', borderRadius: 999, background: 'rgba(255,103,31,0.12)', border: '1px solid rgba(255,103,31,0.2)', fontWeight: 600, fontSize: 13, color: 'var(--brand-saffron)' }}>PepsiCo Partner</span>
              <span className="festive-pulse" style={{ padding: '10px 18px', borderRadius: 999, background: 'rgba(4,106,56,0.12)', border: '1px solid rgba(4,106,56,0.24)', fontWeight: 600, fontSize: 13, color: 'var(--brand-green)', animationDelay: '0.5s' }}>Nationwide Reach</span>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }} style={{ display: 'grid', gap: 18 }}>
          {[
            { title: 'Distribution Heritage', description: 'Legacy distributor with deep knowledge of regional demand patterns and retailer needs.' },
            { title: 'People-first Leadership', description: 'Empowering field partners with real-time updates, consistent training, and transparent communication.' },
            { title: 'Nationwide Compliance', description: 'Aligned with PepsiCo’s compliance and sustainability guidelines across every route.' }
          ].map((item) => (
            <motion.div key={item.title} whileHover={{ y: -4 }} style={{ padding: '22px 24px', borderRadius: 20, background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 8 }}>{item.title}</div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.description}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function ServicesSection({ isMobile }) {
  const services = [
    {
      icon: '⚙️',
      title: 'Smart Order Pushes',
      description: 'Admin teams launch curated assortments directly to partner dashboards with scheduled visibility.'
    },
    {
      icon: '🚚',
      title: 'Delivery Enablement',
      description: 'Route intelligence, proof-of-delivery workflows, and cash validation keep the last mile accountable.'
    },
    {
      icon: '📊',
      title: 'Operations Command',
      description: 'Centralized platform for approvals, inventory alignment, and compliance-ready reporting.'
    }
  ]

  return (
    <section id="services" style={{ background: 'var(--bg-page)', scrollMarginTop: 90 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '70px 20px' : '90px 24px', display: 'grid', gap: isMobile ? 28 : 32 }}>
        <SectionHeading title="Our Services" subtitle="Purpose-built for India’s most dynamic distribution teams" isMobile={isMobile} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: isMobile ? 18 : 24 }}>
          {services.map((service, index) => (
            <motion.div key={service.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.08 }} whileHover={{ y: -6, boxShadow: 'var(--shadow-lg)' }} className="color-shift" style={{ padding: '32px 28px', borderRadius: 24, background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}>
              <div className="festive-pulse" style={{ width: 58, height: 58, borderRadius: 18, display: 'grid', placeItems: 'center', fontSize: 28, background: 'rgba(255,103,31,0.12)', color: 'var(--brand-saffron)', marginBottom: 18, animationDelay: `${index * 0.3}s` }}>
                {service.icon}
              </div>
              <div style={{ fontWeight: 700, fontSize: 19, marginBottom: 10, color: 'var(--text-primary)' }}>{service.title}</div>
              <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{service.description}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function WhyChooseSection({ isMobile }) {
  const reasons = [
    {
      title: 'Brand-led Operations',
      description: 'Every interaction reflects a consistent visual identity and a professional customer experience.'
    },
    {
      title: 'Adaptive Color Intelligence',
      description: 'Our interface dynamically mirrors the animated logo palette, creating a cohesive and memorable brand feel.'
    },
    {
      title: 'Trusted Partnership',
      description: 'PepsiCo and retailers rely on our transparent service standards and people-first ethos.'
    }
  ]

  return (
    <section id="why" style={{ background: '#fff', scrollMarginTop: 90 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '70px 20px' : '90px 24px', display: 'grid', gap: isMobile ? 28 : 32 }}>
        <SectionHeading title="Why Choose Us" subtitle="Strategic partners with a distinctive brand experience" isMobile={isMobile} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: isMobile ? 18 : 24 }}>
          {reasons.map((reason, index) => (
            <motion.div key={reason.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.08 }} style={{ padding: '26px 24px', borderRadius: 22, border: '1px solid var(--border-medium)', background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.9) 100%)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10, color: 'var(--text-primary)' }}>{reason.title}</div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{reason.description}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function BrandStorySection({ isMobile }) {
  return (
    <section id="brand-story" className="festive-animated-bg" style={{ color: 'var(--brand-white)', scrollMarginTop: 90, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--brand-gradient-night)', opacity: 0.85 }} />
      
      {/* Brand color patches */}
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        whileInView={{ opacity: 0.4, scale: 1 }} 
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.2 }}
        className="festive-pulse"
        style={{ position: 'absolute', top: '10%', left: '5%', width: isMobile ? '80px' : '150px', height: isMobile ? '80px' : '150px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 103, 31, 0.8), rgba(255, 103, 31, 0))', filter: 'blur(20px)', animationDelay: '0s' }} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        whileInView={{ opacity: 0.5, scale: 1 }} 
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.4 }}
        className="festive-pulse"
        style={{ position: 'absolute', top: '60%', right: '8%', width: isMobile ? '100px' : '180px', height: isMobile ? '100px' : '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(4, 106, 56, 0.8), rgba(4, 106, 56, 0))', filter: 'blur(25px)', animationDelay: '0.5s' }} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        whileInView={{ opacity: 0.45, scale: 1 }} 
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.6 }}
        className="festive-pulse"
        style={{ position: 'absolute', bottom: '15%', left: '15%', width: isMobile ? '70px' : '120px', height: isMobile ? '70px' : '120px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249, 178, 61, 0.9), rgba(249, 178, 61, 0))', filter: 'blur(18px)', animationDelay: '1s' }} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        whileInView={{ opacity: 0.35, scale: 1 }} 
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.3 }}
        className="festive-pulse"
        style={{ position: 'absolute', top: '30%', right: '20%', width: isMobile ? '60px' : '100px', height: isMobile ? '60px' : '100px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 103, 31, 0.7), rgba(255, 103, 31, 0))', filter: 'blur(15px)', animationDelay: '1.5s' }} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        whileInView={{ opacity: 0.4, scale: 1 }} 
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.5 }}
        className="festive-pulse"
        style={{ position: 'absolute', bottom: '25%', right: '12%', width: isMobile ? '90px' : '140px', height: isMobile ? '90px' : '140px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(4, 106, 56, 0.7), rgba(4, 106, 56, 0))', filter: 'blur(22px)', animationDelay: '2s' }} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        whileInView={{ opacity: 0.5, scale: 1 }} 
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.7 }}
        className="festive-pulse"
        style={{ position: 'absolute', top: '20%', left: '25%', width: isMobile ? '50px' : '80px', height: isMobile ? '50px' : '80px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249, 178, 61, 0.8), rgba(249, 178, 61, 0))', filter: 'blur(12px)', animationDelay: '2.5s' }} 
      />
      
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '80px 20px' : '100px 24px', display: 'grid', gap: isMobile ? 26 : 32, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div>
          <motion.h2 
            initial={{ opacity: 0, y: -20 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{ fontSize: isMobile ? 'clamp(1.8rem, 5vw, 2.4rem)' : 'clamp(2.1rem, 3vw, 3rem)', fontWeight: 800, marginBottom: 20, color: 'var(--brand-white)' }}
          >
            Brand Story
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, scale: 0.95 }} 
            whileInView={{ opacity: 1, scale: 1 }} 
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="festive-pulse"
            style={{ 
              fontSize: isMobile ? 20 : 26, 
              fontWeight: 700,
              color: 'var(--brand-white)',
              lineHeight: 1.4,
              textShadow: '0 2px 12px rgba(0,0,0,0.3), 0 4px 24px rgba(255,103,31,0.4)',
              padding: '16px 24px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 16,
              border: '2px solid rgba(255,255,255,0.3)',
              backdropFilter: 'blur(10px)',
              display: 'inline-block',
              letterSpacing: '0.02em'
            }}
          >
            🎬 One identity. One experience. Every screen.
          </motion.p>
        </div>
        <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="festive-float" style={{ fontSize: isMobile ? 16 : 18, lineHeight: 1.9, opacity: 0.92 }}>
          The new motion logo is more than a visual update. It represents dependable supply, premium service quality, and a digital-first distribution system that keeps teams aligned from warehouse to storefront.
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }} className="festive-pulse" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, margin: '0 auto', padding: '12px 22px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', fontWeight: 600 }}>
          Consistent branding across every touchpoint
        </motion.div>
      </div>
    </section>
  )
}

function CallToActionSection({ isMobile }) {
  return (
    <section id="contact" style={{ background: '#fff', scrollMarginTop: 90 }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isMobile ? '70px 20px' : '90px 24px', textAlign: 'center', display: 'grid', gap: isMobile ? 22 : 26 }}>
        <SectionHeading title="Partner With Us" subtitle="Ready to grow with a stronger brand identity?" isMobile={isMobile} />
        <motion.p initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} style={{ fontSize: isMobile ? 15 : 17, color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: 680, margin: '0 auto 16px' }}>
          Let’s design the next phase of your distribution journey together — from intelligent order pushes to on-ground excellence.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.08 }} style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center' }}>
          <Link to="/contact" className="btn" style={{ padding: '16px 32px', fontSize: 18, fontWeight: 800, background: 'linear-gradient(135deg, var(--brand-saffron) 0%, var(--brand-amber) 50%, var(--brand-green) 100%)', color: 'var(--brand-navy)', textShadow: '0 2px 8px #fff, 0 1px 0 var(--brand-amber)', letterSpacing: '0.03em', boxShadow: '0 18px 38px rgba(10,29,83,0.18)', width: isMobile ? '100%' : 'auto', minWidth: 180, border: '2px solid var(--brand-saffron)', borderRadius: 14 }}>
            Contact Us
          </Link>
          <a href="mailto:ashirwadenterprisesbihar@gmail.com" className="btn outline" style={{ padding: '14px 30px', fontSize: 16, fontWeight: 600, color: 'var(--brand-navy)', borderColor: 'var(--brand-saffron)', background: 'rgba(255,103,31,0.08)', width: isMobile ? '100%' : 'auto', minWidth: 180, marginTop: isMobile ? 8 : 0 }}>
            Email Leadership
          </a>
        </motion.div>
      </div>
    </section>
  )
}

function SectionHeading({ title, subtitle, align = 'center', color = 'var(--text-primary)', isMobile }) {
  return (
    <div style={{ textAlign: align, margin: '0 auto', maxWidth: align === 'center' ? 720 : 'initial', padding: isMobile && align === 'center' ? '0 6px' : 0 }}>
      <h2 style={{ fontSize: isMobile ? 'clamp(1.8rem, 5vw, 2.4rem)' : 'clamp(2.1rem, 3vw, 3rem)', fontWeight: 800, marginBottom: 12, color }}>{title}</h2>
      <p style={{ fontSize: isMobile ? 15 : 17, color: 'var(--text-secondary)', opacity: 0.9 }}>{subtitle}</p>
    </div>
  )
}

function useDynamicPalette(videoRef) {
  useEffect(() => {
    const video = videoRef.current

    const applyPalette = (palette) => {
      const root = document.documentElement
      root.style.setProperty('--brand-saffron', toRgb(palette.saffron))
      root.style.setProperty('--brand-green', toRgb(palette.green))
      root.style.setProperty('--brand-white', toRgb(palette.white))
      root.style.setProperty('--brand-navy', toRgb(palette.navy))
      root.style.setProperty('--brand-accent', toRgb(palette.accent))
      root.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${toRgb(palette.saffron)} 0%, ${toRgb(palette.green)} 100%)`)
      root.style.setProperty('--brand-gradient-soft', `linear-gradient(180deg, ${toRgba(palette.saffron, 0.12)} 0%, ${toRgba(palette.green, 0.16)} 100%)`)
      root.style.setProperty('--brand-gradient-night', `linear-gradient(135deg, ${toRgba(palette.navy, 0.94)} 0%, ${toRgba(palette.green, 0.9)} 100%)`)
      root.style.setProperty('--gradient-secondary', `linear-gradient(135deg, ${toRgba(palette.saffron, 0.18)} 0%, ${toRgba(palette.white, 0.3)} 45%, ${toRgba(palette.green, 0.18)} 100%)`)
      root.style.setProperty('--gradient-accent', `linear-gradient(135deg, ${toRgba(palette.green, 0.2)} 0%, ${toRgba(palette.navy, 0.2)} 100%)`)
      root.style.setProperty('--brand-glow', toRgba(palette.saffron, 0.18))
      const pageTint = mixColors(palette.white, palette.green, 0.12)
      const cardTint = mixColors(palette.white, palette.saffron, 0.06)
      const textPrimary = mixColors(palette.navy, palette.white, 0.12)
      const textSecondary = mixColors(palette.navy, palette.white, 0.28)
      const textMuted = mixColors(palette.navy, palette.white, 0.4)
      root.style.setProperty('--bg-page', toRgb(pageTint))
      root.style.setProperty('--bg-card', toRgb(cardTint))
      root.style.setProperty('--text-primary', toRgb(textPrimary))
      root.style.setProperty('--text-secondary', toRgb(textSecondary))
      root.style.setProperty('--text-muted', toRgb(textMuted))
      root.style.setProperty('--border-light', toRgba(palette.navy, 0.09))
      root.style.setProperty('--border-medium', toRgba(palette.navy, 0.18))
    }

    applyPalette(buildPaletteFromFallback())

    if (!video) return

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return

    let intervalId = null

    const updatePalette = () => {
      if (!video.videoWidth || !video.videoHeight) return
      const width = Math.min(320, video.videoWidth)
      const height = Math.min(320, video.videoHeight)
      canvas.width = width
      canvas.height = height
      context.drawImage(video, 0, 0, width, height)
      const imageData = context.getImageData(0, 0, width, height)
      const buckets = buildEmptyBuckets()
      const step = Math.max(12, Math.floor(imageData.data.length / (4 * 9000)))
      for (let index = 0; index < imageData.data.length; index += 4 * step) {
        const alpha = imageData.data[index + 3]
        if (alpha < 150) continue
        const pixel = [imageData.data[index], imageData.data[index + 1], imageData.data[index + 2]]
        const clusterKey = getClosestCluster(pixel)
        const bucket = buckets[clusterKey]
        bucket.r += pixel[0]
        bucket.g += pixel[1]
        bucket.b += pixel[2]
        bucket.count += 1
      }
      const palette = normaliseBuckets(buckets)
      applyPalette(palette)
    }

    const startSampling = () => {
      updatePalette()
      if (!intervalId) intervalId = window.setInterval(updatePalette, 1800)
    }

    if (video.readyState >= 2) startSampling()

    video.addEventListener('loadeddata', startSampling)
    video.addEventListener('play', startSampling)
    video.addEventListener('timeupdate', updatePalette)

    // Sampling loop keeps palette in sync with the animated video logo.
    return () => {
      video.removeEventListener('loadeddata', startSampling)
      video.removeEventListener('play', startSampling)
      video.removeEventListener('timeupdate', updatePalette)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [videoRef])
}

function buildEmptyBuckets() {
  return {
    saffron: { ...FALLBACK_PALETTE.saffron, r: 0, g: 0, b: 0, count: 0 },
    white: { ...FALLBACK_PALETTE.white, r: 0, g: 0, b: 0, count: 0 },
    green: { ...FALLBACK_PALETTE.green, r: 0, g: 0, b: 0, count: 0 },
    navy: { ...FALLBACK_PALETTE.navy, r: 0, g: 0, b: 0, count: 0 }
  }
}

function normaliseBuckets(buckets) {
  const palette = {}
  Object.keys(buckets).forEach((key) => {
    const bucket = buckets[key]
    palette[key] = bucket.count > 0
      ? {
          r: Math.round(bucket.r / bucket.count),
          g: Math.round(bucket.g / bucket.count),
          b: Math.round(bucket.b / bucket.count)
        }
      : FALLBACK_PALETTE[key]
  })
  palette.accent = mixColors(palette.saffron, FALLBACK_PALETTE.amber, 0.35)
  return palette
}

function buildPaletteFromFallback() {
  return {
    saffron: FALLBACK_PALETTE.saffron,
    white: FALLBACK_PALETTE.white,
    green: FALLBACK_PALETTE.green,
    navy: FALLBACK_PALETTE.navy,
    accent: mixColors(FALLBACK_PALETTE.saffron, FALLBACK_PALETTE.amber, 0.35)
  }
}

function getClosestCluster(pixel) {
  let closestKey = 'saffron'
  let closestDistance = Number.POSITIVE_INFINITY
  Object.entries(CLUSTER_TARGETS).forEach(([key, target]) => {
    const distance = (pixel[0] - target[0]) ** 2 + (pixel[1] - target[1]) ** 2 + (pixel[2] - target[2]) ** 2
    if (distance < closestDistance) {
      closestDistance = distance
      closestKey = key
    }
  })
  return closestKey
}

function mixColors(colorA, colorB, weight = 0.5) {
  const w = Math.min(Math.max(weight, 0), 1)
  return {
    r: Math.round(colorA.r * (1 - w) + colorB.r * w),
    g: Math.round(colorA.g * (1 - w) + colorB.g * w),
    b: Math.round(colorA.b * (1 - w) + colorB.b * w)
  }
}

function toRgb({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`
}

function toRgba({ r, g, b }, alpha) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
