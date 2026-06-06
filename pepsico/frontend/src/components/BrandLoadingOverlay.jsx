import React from 'react'
import { motion } from 'framer-motion'
import BrandVideoLogo from './BrandVideoLogo'

export default function BrandLoadingOverlay({ message = 'Loading…' }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100vh - 160px)', padding: 32, background: 'var(--brand-gradient-soft)' }}>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        style={{
          display: 'grid',
          placeItems: 'center',
          gap: 16,
          padding: '32px 38px',
          borderRadius: 28,
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-light)'
        }}
      >
        <BrandVideoLogo
          size={200}
          style={{
            width: 'clamp(140px, 22vw, 200px)',
            height: 'auto',
            display: 'block',
            objectFit: 'contain',
            borderRadius: 20,
            boxShadow: '0 24px 60px rgba(10,29,83,0.18)'
          }}
        />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>{message}</div>
      </motion.div>
    </div>
  )
}
