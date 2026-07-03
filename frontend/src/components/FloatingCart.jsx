import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function FloatingCart() {
  const { state } = useCart();
  const items = Object.values(state.items);
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  // Calculate total using slab logic for display
  const total = items.reduce((sum, { product, qty, slab }) => {
    const price = Number(product.price);
    let totalBefore = price * qty;
    let discount = 0;
    if (slab && qty >= slab.min_quantity) {
      if (slab.discount_type === 'percent') {
        discount = totalBefore * (Number(slab.discount_value) / 100);
      } else {
        discount = Number(slab.discount_value) * qty;
      }
      return sum + (totalBefore - discount);
    }
    return sum + totalBefore;
  }, 0);

  const totalProducts = items.length;
  if (totalProducts === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, y: 80, scale: 0.8 }}
        animate={{ 
          opacity: 1, 
          y: 0, 
          scale: 1,
          boxShadow: isHovered 
            ? '0 20px 35px rgba(255, 103, 31, 0.35)' 
            : '0 8px 24px rgba(10, 29, 83, 0.25)'
        }}
        exit={{ opacity: 0, y: 80, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={() => navigate('/dashboard/cart')}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          background: 'linear-gradient(135deg, #0a1d53 0%, #0f172a 100%)',
          border: '2px solid #ff671f',
          borderRadius: 28,
          height: 54,
          padding: isHovered ? '0 22px 0 16px' : '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          color: '#fff',
          overflow: 'hidden',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          fontFamily: 'inherit',
          boxSizing: 'border-box'
        }}
      >
        {/* Animated Cart Bag Icon */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <motion.div
            animate={{ 
              rotate: [0, -10, 10, -10, 0],
              scale: isHovered ? 1.05 : 1
            }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut', repeatDelay: 1.5 }}
            style={{
              background: 'rgba(255, 103, 31, 0.12)',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 103, 31, 0.25)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" stroke="#ff671f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 6h18M16 10a4 4 0 01-8 0" stroke="#ff671f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
          
          {/* Badge indicator */}
          <motion.div
            layout
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#ff671f',
              color: '#fff',
              borderRadius: '50%',
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 850,
              border: '2px solid #0a1d53',
              boxShadow: '0 2px 4px rgba(255, 103, 31, 0.3)'
            }}
          >
            {totalProducts}
          </motion.div>
        </div>

        {/* Text Container with layout animation */}
        <motion.div 
          layout 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 1, 
            whiteSpace: 'nowrap',
            justifyContent: 'center'
          }}
        >
          {isHovered ? (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <span style={{ fontSize: 9, color: 'rgba(255, 255, 255, 0.65)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                View Cart (₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })})
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#ff671f', display: 'flex', alignItems: 'center', gap: 4 }}>
                Checkout ➔
              </span>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <span style={{ fontSize: 9, color: 'rgba(255, 255, 255, 0.6)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Cart
              </span>
              <span style={{ fontSize: 13, fontWeight: 850, color: '#fff' }}>
                ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
