import React, { useEffect, useState, useMemo } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { calculateSlabDiscountAmount, formatSlabRuleText, resolveApplicableSlab } from '../lib/slabUtils'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001'

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
        // If no state, try to fetch from backend using orderId from query or state
        if (!details) {
          // Try to get orderId from URL
          const searchParams = new URLSearchParams(window.location.search)
          const orderId = searchParams.get('orderId')
          if (orderId) {
            // Fetch from backend
            const res = await fetch(`${API_BASE}/api/orders/${orderId}`)
            if (res.ok) {
              const orders = await res.json()
              details = Array.isArray(orders) ? orders.find(o => o.id === orderId) : orders
            }
          }
          if (!details) {
            navigate('/dashboard', { replace: true })
            return
          }
        }
        // If details found, reconstruct slab info for each item
        if (details && details.items) {
          // Fetch slabs for each product
          const updatedItems = await Promise.all(details.items.map(async item => {
            let slab = null
            const productId = item.product_id || item.productId || item.product?.id || item.product?.product_id || item.id || null
            if (productId) {
              try {
                const slabRes = await fetch(`${API_BASE}/api/products/${productId}/slabs`)
                if (slabRes.ok) {
                  const slabs = await slabRes.json()
                  const quantity = Number(item.qty ?? item.quantity ?? 0)
                  slab = resolveApplicableSlab(Array.isArray(slabs) ? slabs : [], quantity) || null
                }
              } catch (e) {
                console.warn('Failed to fetch slabs for item', e)
              }
            }
            return {
              ...item,
              product_id: item.product_id || item.productId || item.product?.id || item.product?.product_id || item.id || null,
              slab,
              price: item.price || item.product?.price || 0,
              name: item.name || item.product?.name || ''
            }
          }))
          details.items = updatedItems
        }
        setOrderDetails(details)
      } catch (err) {
        console.error('Error loading order success details:', err)
        if (location.state) {
          setOrderDetails(location.state)
        } else {
          navigate('/dashboard', { replace: true })
        }
      } finally {
        setLoading(false)
      }
    }
    fetchOrderDetails()
  }, [location.state, navigate])

  // Calculate estimated delivery date based on shipping method
  const estimatedDelivery = useMemo(() => {
    if (!orderDetails) return null
    
    const sm = orderDetails.shippingMethod || 'standard'
    // Pickup & Drive orders don't have a delivery estimate
    if (sm === 'pickup_drive') return null
    
    const now = new Date()
    
    if (sm === 'express') {
      // Express: Same day if ordered before 12 PM, otherwise next day
      const currentHour = now.getHours()
      if (currentHour < 12) {
        return {
          date: now,
          text: 'Today by 5:00 PM'
        }
      } else {
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        return {
          date: tomorrow,
          text: tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + ' by 5:00 PM'
        }
      }
    } else {
      // Standard: 3-5 business days
      const deliveryDate = new Date(now)
      deliveryDate.setDate(deliveryDate.getDate() + 5)
      return {
        date: deliveryDate,
        text: deliveryDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + ' by 5:00 PM'
      }
    }
  }, [orderDetails])

  // Format pickup availability window for pickup_drive orders
  const pickupWindowDisplay = useMemo(() => {
    if (!orderDetails) return null
    const sm = orderDetails.shippingMethod || 'standard'
    if (sm !== 'pickup_drive') return null
    const pw = orderDetails.pickupWindow
    if (!pw) return null
    const fmt = (iso) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    return `${fmt(pw.availableFrom)} – ${fmt(pw.availableUntil)}`
  }, [orderDetails])

  // Format order placed timestamp
  const orderPlacedTime = useMemo(() => {
    const now = new Date()
    const date = now.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
    const time = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
    return `${date}, ${time}`
  }, [])

  if (loading || !orderDetails) {
    return (
      <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ textAlign: 'center' }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <p style={{ color: '#6b7280' }}>{loading ? 'Loading bill details...' : 'Redirecting...'}</p>
        </motion.div>
      </div>
    )
  }

  const { payment, address, subtotal, discount, total, items, orderId, shipping, gst, shippingMethod } = orderDetails
  const isPickupOrder = shippingMethod === 'pickup_drive'
  const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const getItemQty = (item) => Number(item?.qty ?? item?.quantity ?? 0)
  const getSlabDiscountAmount = (item) => {
    const qty = getItemQty(item)
    const slab = item?.slab
    if (!slab || qty < Number(slab.min_quantity || 0)) return 0

    const storedDiscount = Number(item?.slab_discount || 0)
    if (storedDiscount > 0) return storedDiscount

    const price = Number(item?.price || 0)
    return calculateSlabDiscountAmount({ price, quantity: qty, slab })
  }
  const slabDiscountDetails = (items || [])
    .filter((item) => Number(item?.slab_discount || 0) > 0 || (item?.slab && getItemQty(item) >= Number(item.slab.min_quantity || 0)))
    .map((item) => ({
      name: item.name || item.product?.name || 'Product',
      qty: getItemQty(item),
      ruleText: item?.slab ? formatSlabRuleText(item.slab) : 'Applied on eligible quantities',
      amount: getSlabDiscountAmount(item) || Number(item?.slab_discount || 0)
    }))
    .filter((detail) => detail.amount > 0)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(180deg, #e0f7e9 0%, #f8fafc 40%)', 
      padding: '40px 20px' 
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Success Header */}
        <motion.div
          className="no-print"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: '#fff',
            borderRadius: 20,
            padding: '48px 32px',
            textAlign: 'center',
            boxShadow: '0 4px 30px rgba(15, 23, 42, 0.08)',
            border: '1px solid #e2e8f0',
            marginBottom: 32
          }}
        >
          {/* Success Checkmark */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: '#10b981',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)'
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{ 
              fontSize: 28, 
              fontWeight: 700, 
              color: '#0f172a',
              margin: '0 0 8px',
              fontFamily: "'Inter', sans-serif"
            }}
          >
            Thank You for Your Order!
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{ 
              fontSize: 14, 
              color: '#64748b',
              margin: 0,
              lineHeight: 1.6
            }}
          >
            Your order has been successfully placed with PepsiCo Distributor.
            <br />
            We've sent a confirmation email to your registered email address.
          </motion.p>
        </motion.div>

        {/* Order ID and Print Receipt */}
        <motion.div
          className="no-print"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: '20px 28px',
            boxShadow: '0 2px 12px rgba(15, 23, 42, 0.06)',
            border: '1px solid #e2e8f0',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              ORDER ID
            </div>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#3b82f6',
              fontFamily: "'Space Grotesk', monospace"
            }}>
              #{orderId || 'N/A'}
            </div>
          </div>
          <button
            className="no-print"
            onClick={handlePrint}
            style={{
              background: '#fff',
              border: '1.5px solid #e2e8f0',
              borderRadius: 10,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 600,
              color: '#0f172a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f8fafc'
              e.target.style.borderColor = '#cbd5e1'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#fff'
              e.target.style.borderColor = '#e2e8f0'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Print Receipt
          </button>
        </motion.div>

        {/* Order Tracking Timeline (delivery orders only) */}
        {!isPickupOrder && (
        <motion.div
          className="no-print"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: '32px 28px',
            boxShadow: '0 2px 12px rgba(15, 23, 42, 0.06)',
            border: '1px solid #e2e8f0',
            marginBottom: 24
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
            {/* Progress Line */}
            <div style={{
              position: 'absolute',
              top: 20,
              left: '12.5%',
              right: '12.5%',
              height: 3,
              background: '#e2e8f0',
              zIndex: 0
            }}>
              <div style={{
                height: '100%',
                width: '0%',
                background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                transition: 'width 0.5s ease'
              }}></div>
            </div>

            {/* Order Placed */}
            <div style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#3b82f6',
                border: '4px solid #fff',
                boxShadow: '0 0 0 2px #3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Order Placed</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{orderPlacedTime}</div>
            </div>

            {/* Processing */}
            <div style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#fff',
                border: '3px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Processing</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>In Progress</div>
            </div>

            {/* In Transit */}
            <div style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#fff',
                border: '3px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>In Transit</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>&nbsp;</div>
            </div>

            {/* Delivered */}
            <div style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#fff',
                border: '3px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Delivered</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>&nbsp;</div>
            </div>
          </div>
        </motion.div>
        )}

        {/* Pickup & Drive status banner */}
        {isPickupOrder && (
          <motion.div
            className="no-print"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '28px 28px',
              boxShadow: '0 2px 12px rgba(15, 23, 42, 0.06)',
              border: '1px solid #fde68a',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 20
            }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 14, background: '#fffbeb', border: '1.5px solid #fcd34d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 26 }}>🏬</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Pickup &amp; Drive Order</div>
              <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
                Your order is pending admin approval. Once approved, you will receive a notification with warehouse address, contact details, and your confirmed pickup window.
              </div>
            </div>
            <div style={{ padding: '6px 14px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#92400e', whiteSpace: 'nowrap' }}>
              Awaiting Approval
            </div>
          </motion.div>
        )}

        {/* Estimated Delivery */}
        {estimatedDelivery && (
          <motion.div
            className="no-print"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            style={{
              background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
              borderRadius: 14,
              padding: '16px 20px',
              marginBottom: 32,
              border: '1.5px solid #93c5fd',
              display: 'flex',
              alignItems: 'center',
              gap: 16
            }}
          >
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600, marginBottom: 4 }}>
                Estimated Delivery
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {estimatedDelivery.text}
              </div>
            </div>
            {shippingMethod === 'express' && (
              <div style={{
                background: '#10b981',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}>
                Express
              </div>
            )}
          </motion.div>
        )}

        {/* Pickup Window Banner (pickup_drive only, shows window from navigate state) */}
        {isPickupOrder && pickupWindowDisplay && (
          <motion.div
            className="no-print"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              borderRadius: 14,
              padding: '16px 20px',
              marginBottom: 32,
              border: '1.5px solid #fcd34d',
              display: 'flex',
              alignItems: 'center',
              gap: 16
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24 }}>🕐</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 4 }}>Estimated Pickup Window</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#78350f' }}>{pickupWindowDisplay}</div>
              <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>Pending admin approval — you'll be notified with warehouse details</div>
            </div>
            <div style={{ padding: '6px 12px', background: '#f59e0b', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pickup
            </div>
          </motion.div>
        )}

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 32 }}>
          {/* Left Column - Order Summary */}
          <motion.div
            className="no-print"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 2px 12px rgba(15, 23, 42, 0.06)',
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Order Summary
              </h2>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                {items?.length || 0} {items?.length === 1 ? 'item' : 'items'}
              </div>
            </div>

            {/* Items List */}
            <div style={{ marginBottom: 24 }}>
              {items && items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: 16,
                    padding: '16px 0',
                    borderBottom: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none'
                  }}
                >
                  {/* Product Image Placeholder */}
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <path d="M16 10a4 4 0 0 1-8 0"></path>
                    </svg>
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 6, fontSize: 14 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                      Qty: {getItemQty(item)}
                    </div>
                  </div>
                  
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>
                    {/* Show slab-adjusted price if available */}
                    {item.slab && getItemQty(item) >= item.slab.min_quantity ? (
                      (() => {
                        const price = Number(item.price);
                        const qty = getItemQty(item);
                        let totalBefore = price * qty;
                        let discount = getSlabDiscountAmount(item);
                        const totalAfter = totalBefore - discount;
                        return (
                          <span>
                            <span style={{ textDecoration: 'line-through', color: '#b91c1c', marginRight: 6 }}>₹{totalBefore.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{totalAfter.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <div style={{ fontSize: 12, color: '#1976d2', marginTop: 2, fontWeight: 500 }}>
                              <b>Slab Applied:</b> {formatSlabRuleText(item.slab)}<br />
                              <span>Unit Price: ₹{price.toLocaleString()} | Total Before: ₹{totalBefore.toLocaleString()} | <b>Discount: ₹{discount.toLocaleString()}</b> | <b>Total After: ₹{totalAfter.toLocaleString()}</b></span>
                            </div>
                          </span>
                        );
                      })()
                    ) : (
                      <span>₹{(item.price * getItemQty(item)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Price Breakdown */}
            <div style={{ 
              borderTop: '2px solid #f1f5f9', 
              paddingTop: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#64748b' }}>
                <span>Subtotal</span>
                <span>₹{subtotal?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
              </div>
              
              {/* Slab Discount Details Section */}
              {slabDiscountDetails.length > 0 && (
                <div style={{ margin: '16px 0', padding: '12px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1976d2', marginBottom: 8 }}>Slab Discount Details</div>
                  {slabDiscountDetails.map((detail, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>
                        {detail.name} <span style={{ color: '#1976d2', fontWeight: 500, fontSize: 13 }}>(Qty: {detail.qty}) - {detail.ruleText}</span>
                      </span>
                      <span style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>-₹{formatCurrency(detail.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#64748b' }}>
                <span>Shipping</span>
                <span>₹{shipping?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
              </div>
              
              {gst > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#64748b' }}>
                  <span>Tax (5%)</span>
                  <span>₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: 18,
                fontWeight: 800,
                color: '#0f172a',
                paddingTop: 16,
                borderTop: '2px solid #e2e8f0',
                marginTop: 8
              }}>
                <span>Total Paid</span>
                <span>₹{total?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Shipping & Payment Info */}
          <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Shipping Address */}
            {address && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: '0 2px 12px rgba(15, 23, 42, 0.06)',
                  border: '1px solid #e2e8f0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    SHIPPING TO
                  </h3>
                </div>
                
                <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    {address.full_name || 'Customer'}
                  </div>
                  <div style={{ color: '#64748b', marginBottom: 4 }}>
                    {address.address}
                  </div>
                  <div style={{ color: '#64748b', marginBottom: 4 }}>
                    {address.district}, {address.state}
                  </div>
                  <div style={{ color: '#64748b', marginBottom: 8 }}>
                    India - {address.pincode}
                  </div>
                  {address.phone && (
                    <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                      {address.phone}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Pickup & Drive Info Card (replaces address for pickup orders) */}
            {isPickupOrder && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                style={{
                  background: '#fffbeb',
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: '0 2px 12px rgba(15, 23, 42, 0.06)',
                  border: '1.5px solid #fcd34d'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20 }}>🏬</span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#92400e', margin: 0 }}>PICKUP & DRIVE</h3>
                </div>
                <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>No delivery address required</div>
                  <div style={{ marginBottom: 4 }}>Your order will be prepared at a warehouse and you can pick it up in person.</div>
                  <div style={{ marginBottom: 4 }}>📋 <strong>Next step:</strong> Admin will review and approve your order.</div>
                  <div>📩 Once approved, you'll receive a notification with the warehouse address, contact number, and confirmed pickup window.</div>
                </div>
              </motion.div>
            )}

            {/* Payment Details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 }}
              style={{
                background: '#fff',
                borderRadius: 16,
                padding: 24,
                boxShadow: '0 2px 12px rgba(15, 23, 42, 0.06)',
                border: '1px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                    <line x1="1" y1="10" x2="23" y2="10"></line>
                  </svg>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  PAYMENT DETAILS
                </h3>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 48,
                  height: 32,
                  borderRadius: 6,
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {payment?.method === 'COD' ? (
                    <span style={{ fontSize: 18 }}>💵</span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>VISA</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                    {payment?.method === 'COD' ? 'Cash on Delivery' : 'Visa ending in 4242'}
                  </div>
                  {payment?.method !== 'COD' && (
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      Exp 12/25
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Need Help */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 }}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                borderRadius: 16,
                padding: 24,
                color: '#fff'
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>
                Need Help?
              </h3>
              <p style={{ fontSize: 13, margin: '0 0 16px', opacity: 0.9, lineHeight: 1.6 }}>
                Contact our distributor support team for any changes to this order.
              </p>
              <button
                onClick={() => navigate('/dashboard/support')}
                style={{
                  width: '100%',
                  background: '#fff',
                  color: '#3b82f6',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                Contact Support
              </button>
            </motion.div>
          </div>
        </div>

        {/* Action Buttons */}
        <motion.div
          className="no-print"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}
        >
          <Link
            to="/dashboard/track-order"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              padding: '14px 32px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            Track Order
          </Link>
          
          <Link
            to="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: '#fff',
              color: '#0f172a',
              padding: '14px 32px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
              border: '2px solid #e2e8f0',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f8fafc'
              e.target.style.borderColor = '#cbd5e1'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#fff'
              e.target.style.borderColor = '#e2e8f0'
            }}
          >
            Return to Dashboard
          </Link>
        </motion.div>

        {/* Back to Products */}
        <motion.div
          className="no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          style={{ textAlign: 'center' }}
        >
          <Link
            to="/dashboard/products"
            style={{
              color: '#64748b',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Continue Shopping
          </Link>
        </motion.div>
      </div>

      {/* Printable Receipt (Hidden on Web) */}
      <div className="print-only" style={{ color: '#000', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '30px' }}>
          <h1 style={{ margin: 0, fontSize: 24, textTransform: 'uppercase', color: '#0f172a' }}>Ashirwad Enterprises</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>Authorized PepsiCo Distributor</p>
          <h2 style={{ margin: '20px 0 0', fontSize: 20, color: '#0f172a' }}>PAYMENT RECEIPT</h2>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', fontSize: 14, lineHeight: 1.6 }}>
          <div>
            <p style={{ margin: 0 }}><strong>Order ID:</strong> #{orderId}</p>
            <p style={{ margin: 0 }}><strong>Date:</strong> {new Date().toLocaleString('en-IN')}</p>
            <p style={{ margin: 0 }}><strong>Payment Method:</strong> {payment?.method === 'COD' ? 'Cash on Delivery' : 'Online (Prepaid)'}</p>
            <p style={{ margin: 0 }}><strong>Payment Status:</strong> {payment?.method === 'COD' ? 'Pending' : 'Success'}</p>
            {payment?.razorpay_payment_id && (
              <p style={{ margin: 0 }}><strong>Transaction ID:</strong> {payment.razorpay_payment_id}</p>
            )}
          </div>
          <div style={{ textAlign: 'right', maxWidth: '250px' }}>
            {isPickupOrder ? (
              <>
                <p style={{ margin: 0 }}><strong>Order Type:</strong></p>
                <p style={{ margin: 0 }}>Pickup & Drive</p>
              </>
            ) : (
              <>
                <p style={{ margin: 0 }}><strong>Billed To:</strong></p>
                <p style={{ margin: 0 }}>{address?.full_name || 'Customer'}</p>
                <p style={{ margin: 0 }}>{address?.address || address?.address_line}</p>
                <p style={{ margin: 0 }}>{address?.district}, {address?.state} - {address?.pincode}</p>
                {address?.phone && <p style={{ margin: 0 }}>Ph: {address.phone}</p>}
              </>
            )}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ padding: '10px 0', textAlign: 'left' }}>Item</th>
              <th style={{ padding: '10px 0', textAlign: 'center' }}>Qty</th>
              <th style={{ padding: '10px 0', textAlign: 'right' }}>Unit Price</th>
              <th style={{ padding: '10px 0', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, idx) => {
              const price = Number(item.price);
              const qty = getItemQty(item);
              let totalBefore = price * qty;
              let discountAmount = getSlabDiscountAmount(item);
              const lineTotal = totalBefore - discountAmount;

              return (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px 0' }}>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    {item.slab && qty >= item.slab.min_quantity && (
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        Slab Discount: {formatSlabRuleText(item.slab)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center' }}>{qty}</td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>₹{price.toFixed(2)}</td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>₹{lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 14 }}>
          <div style={{ width: '250px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span>Subtotal:</span>
              <span>₹{(subtotal || 0).toFixed(2)}</span>
            </div>
            {slabDiscountDetails.length > 0 && (
              <div style={{ padding: '6px 0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', margin: '6px 0' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Slab Discount Details:</div>
                {slabDiscountDetails.map((detail, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '3px 0' }}>
                    <span>• {detail.name} (Qty: {detail.qty}) - {detail.ruleText}</span>
                    <span>-₹{formatCurrency(detail.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#16a34a' }}>
                <span>Total Savings:</span>
                <span>-₹{discount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span>Shipping:</span>
              <span>₹{(shipping || 0).toFixed(2)}</span>
            </div>
            {gst > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>GST (5%):</span>
                <span>₹{gst.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid #0f172a', fontWeight: 700, fontSize: 16, marginTop: '8px' }}>
              <span>Total Paid:</span>
              <span>₹{(total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '60px', textAlign: 'center', fontSize: 12, color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <p style={{ margin: '0 0 4px' }}>Thank you for your business!</p>
          <p style={{ margin: 0 }}>For support, contact ashirwadenterprisesbihar@gmail.com</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; padding: 0 !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          @page { margin: 15mm; }
        }
        
        @media (max-width: 768px) {
          [style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
