import React from 'react'
import { motion } from 'framer-motion'

const glows = [
  { id: 1, color: 'var(--brand-saffron)', top: '-18%', left: '-12%', size: 420, duration: 16 },
  { id: 2, color: 'var(--brand-green)', top: '65%', left: '-8%', size: 360, duration: 18 },
  { id: 3, color: 'var(--brand-amber)', top: '30%', left: '65%', size: 380, duration: 22 },
  { id: 4, color: 'var(--brand-navy)', top: '80%', left: '58%', size: 440, duration: 26 }
]

export default function PatrioticGlow() {
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {glows.map((glow) => (
        <motion.div
          key={glow.id}
          initial={{ opacity: 0.45, scale: 0.9 }}
          animate={{ opacity: [0.32, 0.48, 0.36], scale: [0.92, 1.04, 0.98] }}
          transition={{ duration: glow.duration, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: glow.id * 0.4 }}
          style={{
            position: 'absolute',
            top: glow.top,
            left: glow.left,
            width: glow.size,
            height: glow.size,
            background: `radial-gradient(circle, ${glow.color} 0%, transparent 70%)`,
            filter: 'blur(120px)'
          }}
        />
      ))}
    </div>
  )
}
