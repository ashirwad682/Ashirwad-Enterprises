import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { motion } from 'framer-motion'
import { useMediaQuery } from '../lib/useMediaQuery'
import { fetchOffers } from '../api/client'

function normalizeOfferForCart(offer) {
  if (!offer) return null
  return {
    ...offer,
    id: offer.id || offer.offer_id || null,
    title: offer.title || offer.name || null,
    message: offer.message || offer.description || null,
    productId: offer.productId || offer.product_id || null,
    discountType: String(offer.discountType || offer.discount_type || '').trim().toLowerCase(),
    discountValue: Number(offer.discountValue ?? offer.discount_value ?? 0) || 0,
    minimumAmount: Number(offer.minimumAmount ?? offer.minimum_amount ?? 0) || 0
  }
}

function calculateOfferSavings(offer, items, subtotal) {
  const normalized = normalizeOfferForCart(offer)
  if (!normalized || subtotal <= 0) return 0
  if (subtotal < normalized.minimumAmount) return 0

  const eligibleItems = normalized.productId
    ? items.filter(({ product }) => String(product?.id || '') === String(normalized.productId))
    : items

  if (!eligibleItems.length) return 0

  const eligibleTotal = eligibleItems.reduce((sum, { product, qty }) => sum + (Number(product?.price || 0) * Number(qty || 0)), 0)
  const discountValue = (normalized.discountType === 'percent' || normalized.discountType === 'percentage')
    ? eligibleTotal * (normalized.discountValue / 100)
    : normalized.discountValue * eligibleItems.reduce((sum, { qty }) => sum + Number(qty || 0), 0)

  return Math.min(subtotal, Math.max(0, discountValue))
}

export default function Cart() {
  const { state, dispatch } = useCart()
  const items = Object.values(state.items)
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [offers, setOffers] = React.useState([])
  const [offerLoadError, setOfferLoadError] = React.useState(null)

  React.useEffect(() => {
    let cancelled = false

    async function loadCartOffers() {
      try {
        const data = await fetchOffers()
        if (!cancelled) {
          setOffers(Array.isArray(data) ? data : [])
          setOfferLoadError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setOffers([])
          setOfferLoadError(err?.message || 'Failed to load offers')
        }
      }
    }

    loadCartOffers()
    return () => {
      cancelled = true
    }
  }, [])

  const subtotal = items.reduce((sum, { product, qty }) => sum + (Number(product?.price || 0) * Number(qty || 0)), 0)
  const bestAutoOffer = React.useMemo(() => {
    let bestOffer = null
    let bestSavings = 0

    for (const offer of offers) {
      const savings = calculateOfferSavings(offer, items, subtotal)
      if (savings > bestSavings) {
        bestSavings = savings
        bestOffer = offer
      }
    }

    return bestOffer ? { offer: normalizeOfferForCart(bestOffer), savings: Number(bestSavings.toFixed(2)) } : null
  }, [offers, items, subtotal])

  if (items.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <button
          onClick={() => navigate('/dashboard/products')}
          style={{
            marginBottom: 18,
            width: isMobile ? '100%' : 'auto',
            padding: '8px 18px',
            borderRadius: 8,
            background: '#f1f5f9',
            color: '#1d4ed8',
            fontWeight: 600,
            fontSize: 14,
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
          }}
        >
          ← Back to Products
        </button>
        <div>Your cart is empty.</div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => navigate('/dashboard/products')}
        style={{
          marginBottom: 18,
          width: isMobile ? '100%' : 'auto',
          padding: '8px 18px',
          borderRadius: 8,
          background: '#f1f5f9',
          color: '#1d4ed8',
          fontWeight: 600,
          fontSize: 14,
          border: '1px solid #e2e8f0',
          cursor: 'pointer',
        }}
      >
        ← Back to Products
      </button>
      <div style={{ marginBottom: 24 }}>
        <h2>Shopping Cart</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>{items.length} {items.length === 1 ? 'item' : 'items'}</p>
      </div>
      {bestAutoOffer && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Automatic offer available</div>
          <div style={{ fontSize: 14 }}>
            <strong>{bestAutoOffer.offer.title || bestAutoOffer.offer.message || 'Best Offer'}</strong> • Savings ₹{bestAutoOffer.savings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      )}
      {offerLoadError && !bestAutoOffer && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b' }}>
          Offer loading issue: {offerLoadError}
        </div>
      )}
      {items.map(({ product, qty, slab }, i) => {
        const price = Number(product.price);
        let totalBefore = price * qty;
        let discount = 0;
        let totalAfter = totalBefore;
        if (slab && qty >= slab.min_quantity) {
          if (slab.discount_type === 'percent') {
            discount = totalBefore * (Number(slab.discount_value) / 100);
          } else {
            discount = Number(slab.discount_value) * qty;
          }
          totalAfter = totalBefore - discount;
        }
        return (
          <motion.div key={product.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="card" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: isMobile ? 'stretch' : 'center', marginBottom: 12, padding: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{product.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>₹{price.toFixed(2)} × {qty}</div>
              {slab && qty >= slab.min_quantity && (
                <div style={{ fontSize: 12, color: '#1976d2', marginTop: 4 }}>
                  <b>Slab Applied:</b> {slab.discount_type === 'percent' ? `${slab.discount_value}% off` : `₹${slab.discount_value} off`}<br />
                  <span>Unit Price: ₹{price.toLocaleString()} | Total Before: ₹{totalBefore.toLocaleString()} | Discount: ₹{discount.toLocaleString()} | <b>Total After: ₹{totalAfter.toLocaleString()}</b></span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'flex-end', minWidth: isMobile ? 0 : 130, gap: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>₹{totalAfter.toFixed(2)}</div>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => dispatch({ type: 'remove_product', id: product.id })}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#dc2626',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Remove 
              </motion.button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: isMobile ? 'space-between' : 'flex-end', width: isMobile ? '100%' : 'auto' }}>
              <motion.button whileTap={{ scale: 0.98 }} onClick={() => dispatch({ type: 'remove', id: product.id })} style={{ padding: '6px 12px', background: 'var(--bg-soft)', color: 'var(--text-primary)', borderRadius: 6 }}>−</motion.button>
              <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{qty}</span>
              <motion.button whileTap={{ scale: 0.98 }} onClick={() => dispatch({ type: 'add', product })} style={{ padding: '6px 12px', background: 'var(--brand-primary)', color: '#fff', borderRadius: 6 }}>+</motion.button>
            </div>
          </motion.div>
        );
      })}
      <div className="card" style={{ marginTop: 24, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', background: 'var(--bg-soft)', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Total</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand-primary)' }}>₹{state.total.toFixed(2)}</div>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          className="btn"
          onClick={() => navigate('/dashboard/checkout')}
          style={{ padding: '10px 16px', width: isMobile ? '100%' : 'auto' }}
        >
          Proceed to Checkout
        </motion.button>
      </div>
    </div>
  )
}
