import React from 'react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function FloatingCart() {
  const { state } = useCart();
  const items = Object.values(state.items);
  const navigate = useNavigate();
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

  const totalItems = items.length;
  if (totalItems === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 80 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.7, y: 80 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      style={{
        position: 'fixed',
        bottom: 18,
        right: 18,
        zIndex: 1000,
        background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
        border: '4px solid #fff',
        borderRadius: '50%',
        boxShadow: '0 8px 32px rgba(139,92,246,0.18)',
        width: 64,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => navigate('/dashboard/cart')}
      aria-label="View Cart"
    >
      <motion.div
        animate={{ y: [0, -10, 0], scale: [1, 1.15, 1] }}
        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
        style={{ position: 'relative', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Shopping bag SVG icon */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="7" width="14" height="12" rx="3" fill="#fff"/>
          <path d="M9 10V7a3 3 0 0 1 6 0v3" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {/* Bouncing quantity badge */}
        {totalItems > 0 && (
          <motion.div
            animate={{ y: [0, -8, 0], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              background: '#fff',
              color: '#ec4899',
              borderRadius: '50%',
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 13,
              boxShadow: '0 2px 8px rgba(236,72,153,0.15)',
              border: '2px solid #ec4899',
            }}
          >
            {totalItems}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
