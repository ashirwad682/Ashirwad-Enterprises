import React, { useEffect, useState, useMemo } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { calculateSlabDiscountAmount, formatSlabRuleText, resolveApplicableSlab } from '../lib/slabUtils'

const rawBase = (import.meta.env.VITE_API_BASE || '').trim();
const API_BASE = rawBase ? rawBase.replace(/\/$/, '') : 'http://localhost:5001';

/* ─── Animated confetti particles ─── */
function Confetti() {
  const particles = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 3,
    size: 4 + Math.random() * 8,
    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][Math.floor(Math.random() * 6)],
    rotation: Math.random() * 360,
  })), [])

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, y: -20, x: `${p.x}vw`, rotate: 0 }}
          animate={{ opacity: 0, y: 300, rotate: p.rotation + 360 }}
          transition={{ delay: p.delay, duration: p.duration, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: p.size > 8 ? 2 : '50%',
            background: p.color,
          }}
        />
      ))}
    </div>
  )
}

/* ─── Pulsing success ring ─── */
function SuccessCheckmark() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 180, damping: 12 }}
      style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 28px' }}
    >
      {/* Outer pulse ring */}
      <motion.div
        animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: -8, borderRadius: '50%',
          border: '3px solid #10b981',
        }}
      />
      {/* Inner circle */}
      <div style={{
        width: 96, height: 96, borderRadius: '50%',
        background: 'linear-gradient(145deg, #10b981 0%, #059669 100%)',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 12px 40px rgba(16, 185, 129, 0.35)',
      }}>
        <motion.svg
          width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <polyline points="20 6 9 17 4 12" />
        </motion.svg>
      </div>
    </motion.div>
  )
}

/* ─── Glass card wrapper ─── */
function GlassCard({ children, delay = 0, style = {}, className = '', ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`os-glass-card ${className}`}
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.45)',
        boxShadow: '0 8px 32px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)',
        padding: '28px 28px',
        ...style,
      }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/* ─── Timeline step ─── */
function TimelineStep({ icon, label, sub, active, completed, isLast }) {
  const bg = completed ? 'linear-gradient(145deg, #3b82f6, #2563eb)' : active ? 'linear-gradient(145deg, #60a5fa, #3b82f6)' : '#f1f5f9'
  const borderColor = completed ? '#3b82f6' : active ? '#93c5fd' : '#e2e8f0'
  const textColor = completed || active ? '#0f172a' : '#94a3b8'
  return (
    <div className="os-timeline-step" style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', background: bg,
        border: `3px solid ${borderColor}`, display: 'grid', placeItems: 'center',
        margin: '0 auto 10px',
        boxShadow: completed ? '0 4px 16px rgba(59,130,246,0.3)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        {completed ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <span style={{ fontSize: 18, filter: completed || active ? 'none' : 'grayscale(1) opacity(0.5)' }}>{icon}</span>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: textColor, marginBottom: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#94a3b8' }}>{sub}</div>}
    </div>
  )
}

export default function OrderSuccess() {
  const location = useLocation()
  const navigate = useNavigate()
  const [orderDetails, setOrderDetails] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchOrderDetails() {
      setLoading(true)
      try {
        let details = location.state ? { ...location.state } : null

        // Fallback: read from sessionStorage when location.state is null.
        // This happens because UserDashboard's loading overlay prevents
        // OrderSuccess from mounting during the initial navigation, causing
        // React Router to lose the navigation state by the time this component mounts.
        if (!details) {
          try {
            const saved = sessionStorage.getItem('order_success_state')
            if (saved) {
              details = JSON.parse(saved)
              // Clear immediately after reading so it doesn't affect future visits
              sessionStorage.removeItem('order_success_state')
            }
          } catch (_) { /* sessionStorage unavailable — ignore */ }
        }

        if (!details) {
          const searchParams = new URLSearchParams(window.location.search)
          const orderId = searchParams.get('orderId')
          if (orderId) {
            const res = await fetch(`${API_BASE}/api/orders/${orderId}`)
            if (res.ok) {
              const orders = await res.json()
              details = Array.isArray(orders) ? orders.find(o => o.id === orderId) : orders
            }
          }
          if (!details) { navigate('/dashboard', { replace: true }); return }
        }
        if (details && details.items) {
          const updatedItems = await Promise.all(details.items.map(async item => {
            let slab = null
            const productId = item.product_id || item.productId || item.product?.id || item.product?.product_id || item.id || null
            if (productId) {
              try {
                const ctrl = new AbortController()
                const timer = setTimeout(() => ctrl.abort(), 3000)
                const slabRes = await fetch(`${API_BASE}/api/products/${productId}/slabs`, { signal: ctrl.signal })
                clearTimeout(timer)
                if (slabRes.ok) {
                  const slabs = await slabRes.json()
                  const quantity = Number(item.qty ?? item.quantity ?? 0)
                  slab = resolveApplicableSlab(Array.isArray(slabs) ? slabs : [], quantity) || null
                }
              } catch (_) { /* slab fetch is optional — page works fine without it */ }
            }
            return {
              ...item,
              product_id: productId, slab,
              price: item.price || item.product?.price || 0,
              name: item.name || item.product?.name || ''
            }
          }))
          details.items = updatedItems
        }
        setOrderDetails(details)
      } catch (err) {
        console.error('Error loading order success details:', err)
        if (location.state) setOrderDetails(location.state)
        else navigate('/dashboard', { replace: true })
      } finally { setLoading(false) }
    }
    fetchOrderDetails()
  }, [location.state, navigate])

  const estimatedDelivery = useMemo(() => {
    if (!orderDetails) return null
    const sm = orderDetails.shippingMethod || 'standard'
    if (sm === 'pickup_drive') return null
    const now = new Date()
    if (sm === 'express') {
      if (now.getHours() < 12) return { text: 'Today by 5:00 PM' }
      const tmr = new Date(now); tmr.setDate(tmr.getDate() + 1)
      return { text: tmr.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + ' by 5:00 PM' }
    }
    const dd = new Date(now); dd.setDate(dd.getDate() + 5)
    return { text: dd.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + ' by 5:00 PM' }
  }, [orderDetails])

  const pickupWindowDisplay = useMemo(() => {
    if (!orderDetails) return null
    if ((orderDetails.shippingMethod || 'standard') !== 'pickup_drive') return null
    const pw = orderDetails.pickupWindow
    if (!pw) return null
    const fmt = (iso) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    return `${fmt(pw.availableFrom)} – ${fmt(pw.availableUntil)}`
  }, [orderDetails])

  const orderPlacedTime = useMemo(() => {
    const now = new Date()
    return `${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`
  }, [])

  // ⚠️ MUST be before the early return — React Rules of Hooks requires hooks to always
  // be called in the same order every render. Moving here so the hook count is stable.
  const formattedOrderId = useMemo(() => {
    const orderId = orderDetails?.orderId
    const shippingMethod = orderDetails?.shippingMethod
    if (!orderId) return 'N/A'
    let prefix = 'SD-'
    if (shippingMethod === 'pickup_drive') {
      prefix = 'PD-'
    } else if (shippingMethod === 'express') {
      prefix = 'EX-'
    }
    return `${prefix}${String(orderId).slice(0, 10).toUpperCase()}`
  }, [orderDetails?.orderId, orderDetails?.shippingMethod])

  /* ─── Loading ─── */
  if (loading || !orderDetails) {
    return (
      <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            style={{ width: 48, height: 48, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', margin: '0 auto 20px' }}
          />
          <p style={{ color: '#64748b', fontFamily: "'Inter', sans-serif", fontSize: 14 }}>
            {loading ? 'Preparing your receipt…' : 'Redirecting…'}
          </p>
        </motion.div>
      </div>
    )
  }

  const { payment, address, subtotal, discount, total, items, orderId, shipping, gst, shippingMethod } = orderDetails
  const isPickupOrder = shippingMethod === 'pickup_drive'
  const formatCurrency = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const getItemQty = (item) => Number(item?.qty ?? item?.quantity ?? 0)
  const getSlabDiscountAmount = (item) => {
    const qty = getItemQty(item)
    const slab = item?.slab
    if (!slab || qty < Number(slab.min_quantity || 0)) return 0
    const stored = Number(item?.slab_discount || 0)
    if (stored > 0) return stored
    return calculateSlabDiscountAmount({ price: Number(item?.price || 0), quantity: qty, slab })
  }
  const slabDiscountDetails = (items || [])
    .filter(i => Number(i?.slab_discount || 0) > 0 || (i?.slab && getItemQty(i) >= Number(i.slab.min_quantity || 0)))
    .map(i => ({
      name: i.name || i.product?.name || 'Product',
      qty: getItemQty(i),
      ruleText: i?.slab ? formatSlabRuleText(i.slab) : 'Applied on eligible quantities',
      amount: getSlabDiscountAmount(i) || Number(i?.slab_discount || 0)
    }))
    .filter(d => d.amount > 0)

  return (
    <div className="os-page">
      {/* Confetti */}
      <Confetti />

      <div className="os-container">
        {/* ─── Success Header ─── */}
        <GlassCard delay={0.1} className="no-print os-header-card" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          {/* Decorative gradient blob */}
          <div style={{
            position: 'absolute', top: -60, right: -60, width: 200, height: 200,
            background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
            borderRadius: '50%', pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute', bottom: -40, left: -40, width: 160, height: 160,
            background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)',
            borderRadius: '50%', pointerEvents: 'none'
          }} />

          <SuccessCheckmark />

          <motion.h1
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="os-title"
          >
            Order Placed Successfully! 🎉
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="os-subtitle"
          >
            Thank you for ordering with PepsiCo Distributor.
            <br />A confirmation has been sent to your registered email.
          </motion.p>
        </GlassCard>

        {/* ─── Order ID + Print Bar ─── */}
        <GlassCard delay={0.25} className="no-print os-id-bar">
          <div className="os-id-bar-inner">
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Order ID
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1e40af', fontFamily: "'Space Grotesk', 'Inter', monospace", letterSpacing: -0.5 }}>
                {formattedOrderId}
              </div>
            </div>
            <div className="os-id-bar-actions">
              <div style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                background: payment?.method === 'COD' ? '#fef3c7' : '#d1fae5',
                color: payment?.method === 'COD' ? '#92400e' : '#065f46',
                border: `1px solid ${payment?.method === 'COD' ? '#fde68a' : '#6ee7b7'}`,
              }}>
                {payment?.method === 'COD' ? '💵 Cash on Delivery' : '✓ Paid Online'}
              </div>
              <button
                className="no-print os-print-btn"
                onClick={() => window.print()}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print Receipt
              </button>
            </div>
          </div>
        </GlassCard>

        {/* ─── Tracking Timeline ─── */}
        {!isPickupOrder && (
          <GlassCard delay={0.35} className="no-print">
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📦</span> Order Tracking
            </div>
            <div className="os-timeline">
              {/* Progress bar bg */}
              <div className="os-timeline-track">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '25%' }}
                  transition={{ delay: 0.8, duration: 1, ease: 'easeOut' }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: 4 }}
                />
              </div>
              <TimelineStep icon="🛒" label="Placed" sub={orderPlacedTime} active={false} completed={true} />
              <TimelineStep icon="⚙️" label="Processing" sub="In Progress" active={true} completed={false} />
              <TimelineStep icon="🚚" label="In Transit" sub="" active={false} completed={false} />
              <TimelineStep icon="🏠" label="Delivered" sub="" active={false} completed={false} isLast />
            </div>
          </GlassCard>
        )}

        {/* ─── Pickup & Drive Banner ─── */}
        {isPickupOrder && (
          <GlassCard delay={0.35} className="no-print" style={{ background: 'rgba(255,251,235,0.9)', border: '1.5px solid #fde68a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
                boxShadow: '0 4px 12px rgba(245,158,11,0.25)'
              }}>
                <span style={{ fontSize: 26 }}>🏬</span>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#92400e', marginBottom: 4 }}>Pickup & Drive Order</div>
                <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
                  Pending admin approval. You'll be notified with warehouse address and pickup window once approved.
                </div>
              </div>
              <div style={{
                padding: '8px 16px', background: '#fef3c7', border: '1.5px solid #fcd34d',
                borderRadius: 10, fontSize: 11, fontWeight: 800, color: '#92400e', whiteSpace: 'nowrap',
                textTransform: 'uppercase', letterSpacing: 0.5
              }}>
                ⏳ Awaiting Approval
              </div>
            </div>
          </GlassCard>
        )}

        {/* ─── Pickup Window ─── */}
        {isPickupOrder && pickupWindowDisplay && (
          <GlassCard delay={0.45} className="no-print" style={{ background: 'rgba(255,251,235,0.85)', border: '1.5px solid #fde68a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fff', display: 'grid', placeItems: 'center', border: '1.5px solid #fde68a' }}>
                <span style={{ fontSize: 24 }}>🕐</span>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 12, color: '#92400e', fontWeight: 700, marginBottom: 2 }}>Estimated Pickup Window</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#78350f' }}>{pickupWindowDisplay}</div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* ─── Estimated Delivery ─── */}
        {estimatedDelivery && (
          <GlassCard delay={0.45} className="no-print" style={{
            background: 'linear-gradient(135deg, rgba(219,234,254,0.85) 0%, rgba(191,219,254,0.85) 100%)',
            border: '1.5px solid #93c5fd'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: '#fff',
                display: 'grid', placeItems: 'center', border: '1.5px solid #bfdbfe',
                boxShadow: '0 2px 8px rgba(59,130,246,0.1)'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Estimated Delivery
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{estimatedDelivery.text}</div>
              </div>
              {shippingMethod === 'express' && (
                <div style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                  padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                }}>⚡ Express</div>
              )}
            </div>
          </GlassCard>
        )}

        {/* ─── Main Grid: Order Summary + Details ─── */}
        <div className="os-main-grid">
          {/* Left: Order Summary */}
          <GlassCard delay={0.55} className="no-print">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🛍️</span> Order Summary
              </h2>
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#3b82f6',
                background: '#eff6ff', padding: '4px 12px', borderRadius: 20,
                border: '1px solid #bfdbfe'
              }}>
                {items?.length || 0} {items?.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Items */}
            <div style={{ marginBottom: 20 }}>
              {items && items.map((item, idx) => {
                const price = Number(item.price)
                const qty = getItemQty(item)
                const hasSlab = item.slab && qty >= item.slab.min_quantity
                const slabDisc = hasSlab ? getSlabDiscountAmount(item) : 0
                const lineTotal = price * qty - slabDisc
                return (
                  <div key={idx} className="os-item-row" style={{
                    display: 'flex', gap: 14, padding: '14px 0',
                    borderBottom: idx < items.length - 1 ? '1px solid rgba(226,232,240,0.6)' : 'none'
                  }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                      background: `hsl(${(idx * 67) % 360}, 65%, 92%)`,
                      display: 'grid', placeItems: 'center',
                      border: '1px solid rgba(0,0,0,0.05)'
                    }}>
                      <span style={{ fontSize: 24 }}>📦</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Qty: {qty} × ₹{formatCurrency(price)}</div>
                      {hasSlab && (
                        <div style={{
                          marginTop: 4, fontSize: 11, color: '#059669', fontWeight: 600,
                          background: '#ecfdf5', padding: '2px 8px', borderRadius: 6, display: 'inline-block'
                        }}>
                          🏷️ {formatSlabRuleText(item.slab)} — Save ₹{formatCurrency(slabDisc)}
                        </div>
                      )}
                    </div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15, whiteSpace: 'nowrap', alignSelf: 'center' }}>
                      {hasSlab ? (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'line-through' }}>₹{formatCurrency(price * qty)}</div>
                          <div>₹{formatCurrency(lineTotal)}</div>
                        </div>
                      ) : (
                        <span>₹{formatCurrency(lineTotal)}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)', margin: '4px 0 16px' }} />

            {/* Price Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="os-price-row">
                <span style={{ color: '#64748b' }}>Subtotal</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>₹{formatCurrency(subtotal)}</span>
              </div>

              {slabDiscountDetails.length > 0 && (
                <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#166534', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🏷️</span> Slab Discounts Applied
                  </div>
                  {slabDiscountDetails.map((d, i) => (
                    <div key={i} className="os-price-row" style={{ fontSize: 12, padding: '2px 0' }}>
                      <span style={{ color: '#166534' }}>{d.name} (×{d.qty})</span>
                      <span style={{ color: '#059669', fontWeight: 700 }}>−₹{formatCurrency(d.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="os-price-row">
                <span style={{ color: '#64748b' }}>Shipping</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>
                  {Number(shipping || 0) === 0 ? <span style={{ color: '#10b981', fontWeight: 700 }}>FREE</span> : `₹${formatCurrency(shipping)}`}
                </span>
              </div>

              {gst > 0 && (
                <div className="os-price-row">
                  <span style={{ color: '#64748b' }}>Tax (GST 5%)</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>₹{formatCurrency(gst)}</span>
                </div>
              )}

              {discount > 0 && (
                <div className="os-price-row">
                  <span style={{ color: '#10b981', fontWeight: 600 }}>💰 Total Savings</span>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>−₹{formatCurrency(discount)}</span>
                </div>
              )}

              {/* Total */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 0 0', borderTop: '2px solid #0f172a', marginTop: 4
              }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Total Amount</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
                  ₹{formatCurrency(total)}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Right Column */}
          <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Shipping Address */}
            {address && !isPickupOrder && (
              <GlassCard delay={0.6}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
                    display: 'grid', placeItems: 'center',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.25)'
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Shipping To
                  </h3>
                </div>
                <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: '#0f172a' }}>{address.full_name || 'Customer'}</div>
                  <div style={{ color: '#64748b' }}>{address.address}</div>
                  <div style={{ color: '#64748b' }}>{address.district}, {address.state}</div>
                  <div style={{ color: '#64748b' }}>India — {address.pincode}</div>
                </div>
              </GlassCard>
            )}

            {/* Pickup Info */}
            {isPickupOrder && (
              <GlassCard delay={0.6} style={{ background: 'rgba(255,251,235,0.85)', border: '1.5px solid #fde68a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f59e0b', display: 'grid', placeItems: 'center' }}>
                    <span style={{ fontSize: 20 }}>🏬</span>
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#92400e', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Pickup & Drive
                  </h3>
                </div>
                <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>No delivery address required</div>
                  <div>📋 Admin will review and approve your order.</div>
                  <div>📩 You'll be notified with warehouse details and pickup window.</div>
                </div>
              </GlassCard>
            )}

            {/* Payment */}
            <GlassCard delay={0.7}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'linear-gradient(135deg, #34d399, #10b981)',
                  display: 'grid', placeItems: 'center',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.25)'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Payment Info
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 52, height: 36, borderRadius: 8,
                  background: '#f8fafc', border: '1.5px solid #e2e8f0',
                  display: 'grid', placeItems: 'center'
                }}>
                  {payment?.method === 'COD' ? (
                    <span style={{ fontSize: 20 }}>💵</span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6' }}>VISA</span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    {payment?.method === 'COD' ? 'Cash on Delivery' : 'Online Payment'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {payment?.method === 'COD' ? 'Pay when you receive your order' : 'Payment completed successfully'}
                  </div>
                </div>
              </div>
              {payment?.razorpay_payment_id && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b' }}>
                  <strong>Transaction ID:</strong> {payment.razorpay_payment_id}
                </div>
              )}
            </GlassCard>

            {/* Need Help */}
            <GlassCard delay={0.8} style={{
              background: 'linear-gradient(145deg, #1e40af 0%, #3b82f6 100%)',
              border: 'none', color: '#fff'
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>💬</span> Need Help?
              </h3>
              <p style={{ fontSize: 13, margin: '0 0 16px', opacity: 0.85, lineHeight: 1.6 }}>
                Our support team is ready to assist with any questions about your order.
              </p>
              <button
                onClick={() => navigate('/support/chat')}
                className="os-support-btn"
              >
                Contact Support →
              </button>
            </GlassCard>
          </div>
        </div>

        {/* ─── Action Buttons ─── */}
        <motion.div
          className="no-print os-action-buttons"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Link to="/dashboard/track-order" className="os-btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            Track Your Order
          </Link>
          <Link to="/dashboard/products" className="os-btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            Continue Shopping
          </Link>
          <Link to="/dashboard" className="os-btn-ghost">
            Return to Dashboard
          </Link>
        </motion.div>
      </div>

      {/* ─── Print Receipt (hidden on screen) ─── */}
      <div className="print-only" style={{ color: '#000', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '30px' }}>
          <h1 style={{ margin: 0, fontSize: 24, textTransform: 'uppercase', color: '#0f172a' }}>Ashirwad Enterprises</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>Authorized PepsiCo Distributor</p>
          <h2 style={{ margin: '20px 0 0', fontSize: 20, color: '#0f172a' }}>PAYMENT RECEIPT</h2>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', fontSize: 14, lineHeight: 1.6 }}>
          <div>
            <p style={{ margin: 0 }}><strong>Order ID:</strong> {formattedOrderId}</p>
            <p style={{ margin: 0 }}><strong>Date:</strong> {new Date().toLocaleString('en-IN')}</p>
            <p style={{ margin: 0 }}><strong>Payment Method:</strong> {payment?.method === 'COD' ? 'Cash on Delivery' : 'Online (Prepaid)'}</p>
            <p style={{ margin: 0 }}><strong>Payment Status:</strong> {payment?.method === 'COD' ? 'Pending' : 'Success'}</p>
            {payment?.razorpay_payment_id && <p style={{ margin: 0 }}><strong>Transaction ID:</strong> {payment.razorpay_payment_id}</p>}
          </div>
          <div style={{ textAlign: 'right', maxWidth: 250 }}>
            {isPickupOrder ? (
              <><p style={{ margin: 0 }}><strong>Order Type:</strong></p><p style={{ margin: 0 }}>Pickup & Drive</p></>
            ) : (
              <><p style={{ margin: 0 }}><strong>Billed To:</strong></p>
                <p style={{ margin: 0 }}>{address?.full_name || 'Customer'}</p>
                <p style={{ margin: 0 }}>{address?.address || address?.address_line}</p>
                <p style={{ margin: 0 }}>{address?.district}, {address?.state} - {address?.pincode}</p></>
            )}
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30 }}>
          <thead><tr style={{ borderBottom: '2px solid #cbd5e1' }}>
            <th style={{ padding: '10px 0', textAlign: 'left' }}>Item</th>
            <th style={{ padding: '10px 0', textAlign: 'center' }}>Qty</th>
            <th style={{ padding: '10px 0', textAlign: 'right' }}>Unit Price</th>
            <th style={{ padding: '10px 0', textAlign: 'right' }}>Total</th>
          </tr></thead>
          <tbody>
            {items?.map((item, idx) => {
              const price = Number(item.price), qty = getItemQty(item)
              const disc = getSlabDiscountAmount(item), lineTotal = price * qty - disc
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px 0' }}>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    {item.slab && qty >= item.slab.min_quantity && <div style={{ fontSize: 11, color: '#64748b' }}>Slab: {formatSlabRuleText(item.slab)}</div>}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center' }}>{qty}</td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>₹{price.toFixed(2)}</td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>₹{lineTotal.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 14 }}>
          <div style={{ width: 250 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}><span>Subtotal:</span><span>₹{(subtotal || 0).toFixed(2)}</span></div>
            {slabDiscountDetails.length > 0 && (
              <div style={{ padding: '6px 0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', margin: '6px 0' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Slab Discounts:</div>
                {slabDiscountDetails.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '3px 0' }}>
                    <span>• {d.name} (×{d.qty})</span><span>−₹{formatCurrency(d.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#16a34a' }}><span>Total Savings:</span><span>−₹{discount.toFixed(2)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}><span>Shipping:</span><span>₹{(shipping || 0).toFixed(2)}</span></div>
            {gst > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}><span>GST (5%):</span><span>₹{gst.toFixed(2)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid #0f172a', fontWeight: 700, fontSize: 16, marginTop: 8 }}>
              <span>Total Paid:</span><span>₹{(total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 60, textAlign: 'center', fontSize: 12, color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
          <p style={{ margin: '0 0 4px' }}>Thank you for your business!</p>
          <p style={{ margin: 0 }}>For support, contact ashirwadenterprisesbihar@gmail.com</p>
        </div>
      </div>

      {/* ─── Styles ─── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@600;700;800&display=swap');

        .os-page {
          min-height: 100vh;
          background: linear-gradient(165deg, #eef2ff 0%, #e0f2fe 25%, #f0fdf4 50%, #fefce8 75%, #fef2f2 100%);
          padding: 32px 20px 60px;
          position: relative;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .os-container {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .os-title {
          font-size: 28px;
          font-weight: 900;
          color: #0f172a;
          margin: 0 0 10px;
          letter-spacing: -0.5px;
          line-height: 1.2;
        }
        .os-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0;
          line-height: 1.7;
        }

        /* ID Bar */
        .os-id-bar-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .os-id-bar-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .os-print-btn {
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        .os-print-btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(15,23,42,0.08);
        }

        /* Timeline */
        .os-timeline {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          position: relative;
        }
        .os-timeline-track {
          position: absolute;
          top: 22px;
          left: 12%;
          right: 12%;
          height: 3px;
          background: #e2e8f0;
          border-radius: 4px;
          z-index: 0;
        }

        /* Main Grid */
        .os-main-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 20px;
        }

        /* Price rows */
        .os-price-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }

        /* Action buttons */
        .os-action-buttons {
          display: flex;
          gap: 14px;
          justify-content: center;
          flex-wrap: wrap;
          padding: 10px 0;
        }
        .os-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          color: #fff;
          padding: 14px 32px;
          border-radius: 14px;
          font-weight: 800;
          font-size: 14px;
          text-decoration: none;
          box-shadow: 0 8px 28px rgba(59,130,246,0.35);
          transition: all 0.25s ease;
          font-family: inherit;
        }
        .os-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 36px rgba(59,130,246,0.45);
        }
        .os-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.8);
          backdrop-filter: blur(8px);
          color: #1e40af;
          padding: 14px 28px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          border: 1.5px solid #bfdbfe;
          transition: all 0.25s ease;
          font-family: inherit;
        }
        .os-btn-secondary:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          transform: translateY(-1px);
        }
        .os-btn-ghost {
          display: inline-flex;
          align-items: center;
          color: #64748b;
          padding: 14px 20px;
          font-weight: 600;
          font-size: 13px;
          text-decoration: none;
          transition: color 0.2s;
          font-family: inherit;
        }
        .os-btn-ghost:hover { color: #0f172a; }

        /* Support button */
        .os-support-btn {
          width: 100%;
          background: rgba(255,255,255,0.18);
          backdrop-filter: blur(8px);
          color: #fff;
          border: 1.5px solid rgba(255,255,255,0.3);
          border-radius: 12px;
          padding: 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          font-family: inherit;
        }
        .os-support-btn:hover {
          background: rgba(255,255,255,0.28);
          transform: translateY(-1px);
        }

        /* Print */
        @media screen { .print-only { display: none !important; } }
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; padding: 0 !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .os-page { background: white !important; padding: 0 !important; }
          @page { margin: 15mm; }
        }

        /* ─── Tablet (≤ 900px) ─── */
        @media (max-width: 900px) {
          .os-main-grid {
            grid-template-columns: 1fr !important;
          }
          .os-page { padding: 24px 16px 48px; }
        }

        /* ─── Phone (≤ 540px) ─── */
        @media (max-width: 540px) {
          .os-page { padding: 16px 10px 40px; }
          .os-container { gap: 14px; }
          .os-glass-card { padding: 18px 16px !important; border-radius: 16px !important; }
          .os-title { font-size: 22px !important; }
          .os-subtitle { font-size: 13px !important; }
          .os-id-bar-inner { flex-direction: column; align-items: flex-start; }
          .os-id-bar-actions { width: 100%; }
          .os-print-btn { flex: 1; justify-content: center; }
          .os-timeline { gap: 2px; }
          .os-timeline-step { }
          .os-timeline-step div:first-child { width: 36px !important; height: 36px !important; }
          .os-timeline-step div:first-child svg { width: 16px; height: 16px; }
          .os-action-buttons { flex-direction: column; align-items: stretch; gap: 10px; }
          .os-btn-primary, .os-btn-secondary, .os-btn-ghost { justify-content: center; width: 100%; text-align: center; }
          .os-item-row { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  )
}
