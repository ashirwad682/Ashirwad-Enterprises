import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useSearchParams } from 'react-router-dom'

const rawBase = (import.meta.env.VITE_API_BASE || '').trim();
const API_BASE = rawBase ? rawBase.replace(/\/$/, '') : 'http://localhost:5001';

const FESTIVE = {
  pageBg: '#f7f2e8',
  panelBg: '#fbf5ea',
  cardBg: '#fffdf8',
  border: '#ecdcc4',
  text: '#111827',
  muted: '#6b7280',
  accent: '#ef8e29',
  accentDark: '#dd7415',
  accentSoft: '#fff1dd'
}

export default function TrackOrder() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [orderId, setOrderId] = useState(searchParams.get('id') || '')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState(null)
  const [partner, setPartner] = useState(null)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(false)

  const normalizeDeliveryStatusString = (status) => {
    if (!status) return null
    const normalized = status.toString().toLowerCase().replace(/[-\s]+/g, '_')
    const allowed = ['pending', 'assigned', 'packed', 'dispatched', 'out_for_delivery', 'delivered']
    return allowed.includes(normalized) ? normalized : null
  }

  const mapTrackedOrderPayload = (payload) => {
    if (!payload || !payload.order) return null
    const tracked = payload.order
    return {
      id: tracked.id,
      created_at: tracked.created_at,
      status: tracked.status || 'Pending',
      delivery_status: normalizeDeliveryStatusString(tracked.delivery_status),
      total_amount: tracked.total_amount,
      payment_mode: tracked.payment_method === 'COD' ? 'Cash on Delivery' : 'Prepaid',
      payment_method: tracked.payment_method,
      cod_amount_received: tracked.cod_amount_received,
      delivered_at: tracked.delivered_at,
      updated_at: tracked.updated_at,
      delivery_partner_id: tracked.delivery_partner_id,
      shipping_method: tracked.shipping_method,
      shipping_fee: tracked.shipping_fee,
      pickup_order: tracked.pickup_order,
      timeline: payload.timeline || []
    }
  }

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    // Auto-track if orderId is in URL
    const urlOrderId = searchParams.get('id')
    if (urlOrderId && !order && !loading) {
      setOrderId(urlOrderId)
      // Trigger tracking automatically
      handleTrackOrder(urlOrderId)
    }
  }, [searchParams])

  useEffect(() => {
    if (!order) return

    // Subscribe to real-time order updates
    const subscription = supabase
      .channel(`order:${order.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${order.id}`
      }, (payload) => {
        console.log('Order updated:', payload)
        setOrder(prev => ({ ...prev, ...payload.new }))
      })
      .subscribe()

    // Fallback: poll every 15 seconds
    const interval = setInterval(() => {
      refreshOrder(order.id)
    }, 15000)

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
    }
  }, [order?.id])

  // Load delivery partner details when partner ID is available
  useEffect(() => {
    if (order?.delivery_partner_id) {
      loadDeliveryPartner(order.delivery_partner_id)
    } else {
      setPartner(null)
    }
  }, [order?.delivery_partner_id])

  const loadUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(authUser.id)) {
        setError('User ID is not valid. Please contact support.')
        return null
      }
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      setUser(profile)
      if (profile) {
        fetchRecentOrders(profile.id)
      }
      return profile
    }
    return null
  }

  const fetchRecentOrders = async (userId) => {
    try {
      setLoadingRecent(true)
      const { data, error: recentErr } = await supabase
        .from('orders')
        .select('id, created_at, total_amount, status, delivery_status, shipping_method, shipping_fee, pickup_order')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (!recentErr && data) {
        // Filter out delivered and cancelled orders
        const undelivered = data.filter((o) => {
          const st = (o.status || '').toLowerCase()
          const ds = (o.delivery_status || '').toLowerCase()
          return st !== 'delivered' && ds !== 'delivered' && st !== 'cancelled'
        })
        // Show only the last 3
        setRecentOrders(undelivered.slice(0, 3))
      }
    } catch (err) {
      console.warn('Failed to fetch recent orders:', err)
    } finally {
      setLoadingRecent(false)
    }
  }

  const loadDeliveryPartner = async (partnerId) => {
    try {
      const { data, error: dpErr } = await supabase
        .from('delivery_partners')
        .select('name, mobile_number, email')
        .eq('id', partnerId)
        .single()
      if (!dpErr && data) {
        setPartner(data)
      }
    } catch (err) {
      console.warn('Failed to load partner details:', err)
    }
  }

  const refreshOrder = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/delivery/track/${id}`)
      if (!response.ok) return
      const payload = await response.json()
      const trackedOrder = mapTrackedOrderPayload(payload)
      if (trackedOrder) {
        setOrder(prev => ({ ...prev, ...trackedOrder }))
      }
    } catch (err) {
      console.warn('Failed to refresh order:', err)
    }
  }

  const handleTrackOrder = async (trackingId = null) => {
    const idToTrack = trackingId || orderId
    if (!idToTrack.trim()) {
      setError('Please enter an Order ID')
      return
    }

    setLoading(true)
    setError('')
    setOrder(null)
    setPartner(null)

    const trimmedId = idToTrack.trim()
    setSearchParams({ id: trimmedId })

    try {
      let trackedOrder = null

      try {
        const response = await fetch(`${API_BASE}/api/delivery/track/${trimmedId}`)
        if (response.ok) {
          const payload = await response.json()
          trackedOrder = mapTrackedOrderPayload(payload)
        } else if (response.status === 404) {
          console.log('Public tracking API returned 404, falling back to local database query')
        }
      } catch (apiErr) {
        console.error('Track order API error:', apiErr)
      }

      if (trackedOrder) {
        setOrder(trackedOrder)
        setLoading(false)
        return
      }

      let currentUser = user
      if (!currentUser) {
        currentUser = await loadUser()
      }

      if (!currentUser?.id) {
        setError('No order found with this Order ID.')
        setLoading(false)
        return
      }

      const { data: userOrders, error: supabaseErr } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })

      if (supabaseErr) {
        console.error('Query error:', supabaseErr)
        throw supabaseErr
      }

      const foundOrder = userOrders?.find(o =>
        o.id === trimmedId || o.id.toLowerCase().startsWith(trimmedId.toLowerCase())
      )

      if (!foundOrder) {
        setError('No order found with this Order ID.')
        setLoading(false)
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('full_name, email, phone')
        .eq('id', foundOrder.user_id)
        .single()

      const paymentMode = (foundOrder.payment_method || foundOrder.payment_mode || '').toUpperCase() === 'COD'
        ? 'Cash on Delivery'
        : 'Prepaid'

      const orderWithUser = {
        ...foundOrder,
        users: userData,
        payment_mode: paymentMode,
        delivery_status: normalizeDeliveryStatusString(foundOrder.delivery_status),
        timeline: []
      }

      setOrder(orderWithUser)
      setLoading(false)
    } catch (err) {
      console.error('Track order error:', err)
      setError('Failed to fetch order details. Please try again.')
      setLoading(false)
    }
  }

  const statusSteps = [
    { key: 'Pending', label: 'Order Placed', icon: '📝', desc: 'Your order has been received' },
    { key: 'Approved', label: 'Approved', icon: '✅', desc: 'Confirmed by PepsiCo Distributor' },
    { key: 'Packed', label: 'Packed & Prepared', icon: '📦', desc: 'Items loaded and packaged' },
    { key: 'Dispatched', label: 'Dispatched', icon: '🚚', desc: 'Departed from warehouse transit center' },
    { key: 'Out for Delivery', label: 'Out for Delivery', icon: '🛵', desc: 'Delivery partner is en route' },
    { key: 'Delivered', label: 'Delivered', icon: '🎉', desc: 'OTP code confirmed, order completed' }
  ]

  const getCurrentStepIndex = (status) => {
    if (!status) return 0
    const normalized = status.toString().toLowerCase().replace(/[-\s]+/g, '')
    const index = statusSteps.findIndex(s => s.key.toLowerCase().replace(/[-\s]+/g, '') === normalized)
    return index >= 0 ? index : 0
  }

  const currentStepIndex = order ? getCurrentStepIndex(order.status) : -1
  const isDelivered = order?.status?.toLowerCase() === 'delivered' || order?.delivery_status === 'delivered'
  const isCancelled = order?.status?.toLowerCase() === 'cancelled'
  const isApproved = order && currentStepIndex > 0

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 24 }}>
      {/* Header Banner */}
      <motion.section 
        initial={{ opacity: 0, y: -16 }} 
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, #fdfbfa 0%, #faf6f0 100%)',
          border: '1px solid #ebd2aa',
          borderRadius: 24,
          padding: '32px 28px',
          color: '#0f172a',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 12px 30px rgba(44, 36, 22, 0.05)'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 11, background: '#fff1dd', color: '#ff671f', border: '1px solid rgba(255, 103, 31, 0.25)', borderRadius: 8, padding: '4px 10px', width: 'fit-content', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Real-time tracking
          </span>
          <h1 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Track Your Order</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
            Monitor dispatch updates, warehouse packing milestones, and delivery agent status instantly.
          </p>
        </div>
        {/* Soft Background Accent */}
        <div style={{ position: 'absolute', right: '-40px', bottom: '-40px', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,103,31,0.2) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(30px)' }} />
      </motion.section>

      {/* Tracker Card Search Section */}
      <motion.section 
        initial={{ opacity: 0, y: 16 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.1 }}
        style={{ 
          padding: 24, 
          background: '#fff',
          borderRadius: 20, 
          border: '1px solid #ecdcc4',
          boxShadow: '0 10px 24px rgba(44, 36, 22, 0.03)'
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 12 }}>
          Search by Order ID
        </span>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', minWidth: 280 }}>
            <span style={{ position: 'absolute', left: 14, color: '#94a3b8', fontSize: 16 }}>🔍</span>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder()}
              placeholder="Enter 36-char Order ID (e.g. OD-XXXXXXXX or UUID)"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 14px 12px 40px',
                fontSize: 14,
                borderRadius: 12,
                border: '1px solid #ecdcc4',
                outline: 'none',
                transition: 'all 0.2s',
                background: 'white',
                fontWeight: 500
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#ff671f';
                e.target.style.boxShadow = '0 0 0 3px rgba(255, 103, 31, 0.12)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#ecdcc4';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
          <motion.button
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            onClick={() => handleTrackOrder()}
            disabled={loading}
            style={{
              padding: '12px 28px',
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 12,
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)',
              color: 'white',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 6px 14px rgba(240, 100, 28, 0.16)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Searching...' : 'Locate Order'}
          </motion.button>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }}
            style={{ 
              marginTop: 14, 
              padding: '12px 16px', 
              background: '#fef2f2', 
              color: '#b91c1c', 
              borderRadius: 10, 
              border: '1px solid #fecaca',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>⚠️</span> {error}
          </motion.div>
        )}
      </motion.section>

      {/* Recent Orders Section (Saves time copying UUIDs) */}
      {!order && recentOrders.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: 24,
            background: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid #ecdcc4',
            borderRadius: 20,
            boxShadow: '0 8px 20px rgba(57, 44, 27, 0.02)'
          }}
        >
          <div style={{ borderBottom: '1px solid #ebd2aa', paddingBottom: 10, marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>⚡ Select from Your Recent Orders</h3>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {recentOrders.map((ro) => {
              const roDate = new Date(ro.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
              const activeStatus = ro.status || 'Pending'
              const getStatusStyles = (st) => {
                const key = st.toLowerCase()
                if (key === 'delivered') return { bg: '#dcfce7', text: '#15803d' }
                if (key === 'cancelled') return { bg: '#fee2e2', text: '#b91c1c' }
                if (key === 'pending') return { bg: '#fef3c7', text: '#d97706' }
                return { bg: '#eff6ff', text: '#1d4ed8' }
              }
              const badge = getStatusStyles(activeStatus)

              return (
                <div 
                  key={ro.id} 
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    background: '#fff',
                    padding: '12px 18px',
                    borderRadius: 14,
                    border: '1px solid #ebd2aa',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}>📦</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                        {(() => {
                          const isPickup = Boolean(ro.pickup_order) || ro.shipping_method === 'pickup_drive'
                          const isExpress = ro.shipping_method === 'express' || (!isPickup && Number(ro.shipping_fee || 0) > 0)
                          let prefix = 'SD-'
                          if (isPickup) prefix = 'PD-'
                          else if (isExpress) prefix = 'EX-'
                          return `${prefix}${ro.id.slice(0, 10).toUpperCase()}`
                        })()}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Placing Date: {roDate} • Subtotal: ₹{Number(ro.total_amount || 0).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 800,
                      background: badge.bg,
                      color: badge.text,
                      textTransform: 'uppercase'
                    }}>
                      {activeStatus}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setOrderId(ro.id)
                        handleTrackOrder(ro.id)
                      }}
                      style={{
                        padding: '6px 14px',
                        fontSize: 11,
                        fontWeight: 800,
                        border: '1px solid #ff671f',
                        borderRadius: 8,
                        background: '#fff',
                        color: '#ff671f',
                        cursor: 'pointer'
                      }}
                    >
                      Track Progress
                    </motion.button>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.section>
      )}

      {/* Tracking details */}
      <AnimatePresence mode="wait">
        {order && (
          <motion.div
            key="order-details"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            style={{ display: 'grid', gridTemplateColumns: isApproved ? 'minmax(0, 1.4fr) minmax(0, 1fr)' : '1fr', gap: 24 }}
          >
            {/* Timeline Column */}
            {isApproved && !isCancelled && (
              <section style={{ 
                padding: '28px 24px', 
                borderRadius: 20, 
                border: '1px solid #ecdcc4',
                boxShadow: '0 10px 24px rgba(44, 36, 22, 0.03)',
                background: '#fff'
              }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #ebd2aa', paddingBottom: 10 }}>
                  🚚 Delivery Progress Milestones
                </h3>
                
                <div style={{ position: 'relative', paddingLeft: 12 }}>
                  {statusSteps.map((step, index) => {
                    const isCompleted = index <= currentStepIndex
                    const isCurrent = index === currentStepIndex
                    const isLast = index === statusSteps.length - 1

                    return (
                      <div key={step.key} style={{ position: 'relative', paddingBottom: isLast ? 0 : 36 }}>
                        {/* Connecting tracking line */}
                        {!isLast && (
                          <div style={{
                            position: 'absolute',
                            left: 17,
                            top: 36,
                            width: 2,
                            height: 'calc(100% - 24px)',
                            background: isCompleted ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)' : '#e2e8f0',
                            borderRadius: 1
                          }} />
                        )}

                        <motion.div 
                          initial={{ opacity: 0, x: -8 }} 
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.04 * index }}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'flex-start', 
                            gap: 16,
                            position: 'relative'
                          }}
                        >
                          {/* Step bullet circle */}
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: isCompleted 
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                              : isCurrent 
                                ? 'linear-gradient(135deg, #ff671f 0%, #f9b23d 100%)'
                                : '#f1f5f9',
                            border: isCurrent ? '2px solid rgba(255,103,31,0.2)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            flexShrink: 0,
                            boxShadow: isCompleted || isCurrent ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                          }}>
                            {isCompleted && !isCurrent ? '✓' : step.icon}
                          </div>

                          {/* Detail fields */}
                          <div style={{ flex: 1, paddingTop: 2 }}>
                            <div style={{ 
                              fontSize: 14, 
                              fontWeight: 800, 
                              color: isCompleted ? '#10b981' : isCurrent ? '#ff671f' : '#94a3b8',
                              marginBottom: 2
                            }}>
                              {step.label}
                            </div>
                            <div style={{ 
                              fontSize: 12, 
                              color: isCompleted || isCurrent ? '#64748b' : '#cbd5e1',
                              lineHeight: 1.4
                            }}>
                              {step.desc}
                            </div>
                            {isCurrent && (
                              <span style={{
                                marginTop: 6,
                                padding: '3px 8px',
                                background: '#fff1dd',
                                color: '#d97706',
                                fontSize: 10,
                                fontWeight: 800,
                                borderRadius: 6,
                                display: 'inline-block',
                                border: '1px solid rgba(255, 103, 31, 0.15)'
                              }}>
                                Active Status
                              </span>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Info details column */}
            <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
              {/* Cancelled state card */}
              {isCancelled && (
                <div style={{ 
                  padding: 24, 
                  background: '#fee2e2', 
                  borderRadius: 20, 
                  border: '1px solid #fca5a5',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 44, marginBottom: 8 }}>❌</div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#b91c1c' }}>Order Cancelled</h3>
                  <p style={{ margin: 0, color: '#7f1d1d', fontSize: 13, lineHeight: 1.5 }}>
                    This transaction has been cancelled. Please contact the PepsiCo support helpline if this was an error.
                  </p>
                </div>
              )}

              {/* Awaiting confirmation card */}
              {!isCancelled && !isApproved && (
                <div style={{ 
                  padding: 24, 
                  background: '#fffbeb', 
                  borderRadius: 20, 
                  border: '1px solid #fcd34d',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 44, marginBottom: 8 }}>⏳</div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#d97706' }}>Awaiting Confirmation</h3>
                  <p style={{ margin: 0, color: '#b45309', fontSize: 13, lineHeight: 1.5 }}>
                    Your order details have been stored and are waiting for distributor approval. Tracking stats will load automatically once validated.
                  </p>
                </div>
              )}

              {/* Completed / Delivered check card */}
              {isDelivered && (
                <div style={{ 
                  padding: 20, 
                  background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', 
                  borderRadius: 20, 
                  border: '1px solid #86efac',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 40, marginBottom: 6 }}>🎉</div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#15803d' }}>Order Handed Over!</h3>
                  <p style={{ margin: 0, color: '#166534', fontSize: 12, lineHeight: 1.5 }}>
                    The dispatch team has confirmed receipt and delivery OTP code validation successfully.
                  </p>
                </div>
              )}

              {/* Order receipt summary */}
              {!isCancelled && (
                <section style={{ 
                  padding: 24, 
                  background: '#fff', 
                  borderRadius: 20, 
                  border: '1px solid #ecdcc4',
                  boxShadow: '0 10px 24px rgba(44, 36, 22, 0.03)'
                }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #ebd2aa', paddingBottom: 10 }}>
                    🗒️ Order Receipt Details
                  </h3>
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Order ID</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                        {(() => {
                          const isPickup = Boolean(order.pickup_order) || order.shipping_method === 'pickup_drive'
                          const isExpress = order.shipping_method === 'express' || (!isPickup && Number(order.shipping_fee || 0) > 0)
                          let prefix = 'SD-'
                          if (isPickup) prefix = 'PD-'
                          else if (isExpress) prefix = 'EX-'
                          return `${prefix}${order.id.slice(0, 10).toUpperCase()}`
                        })()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Invoice Date</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Grand Total</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#ff671f' }}>
                        ₹{Number(order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Payment Method</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        {order.payment_mode || 'COD'}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* Delivery Agent contact card */}
              {isApproved && partner && (
                <motion.section 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ 
                    padding: 20, 
                    background: 'linear-gradient(135deg, #fff7ed 0%, #fff 100%)', 
                    borderRadius: 20, 
                    border: '1px dashed #ff671f',
                    display: 'grid',
                    gap: 12,
                    boxShadow: '0 8px 18px rgba(255, 103, 31, 0.04)'
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🛵</span> Delivery Agent Contact
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>
                      {partner.name?.slice(0, 1).toUpperCase() || 'D'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{partner.name || 'Assigned Partner'}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Phone: {partner.mobile_number || 'N/A'}</div>
                    </div>
                  </div>
                  {partner.mobile_number && (
                    <motion.a
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      href={`tel:${partner.mobile_number}`}
                      style={{
                        padding: '10px 14px',
                        background: 'linear-gradient(135deg, #ff671f 0%, #f9b23d 100%)',
                        color: 'white',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 800,
                        textAlign: 'center',
                        display: 'block',
                        boxShadow: '0 4px 10px rgba(255, 103, 31, 0.15)'
                      }}
                    >
                      📞 Call Delivery Agent
                    </motion.a>
                  )}
                </motion.section>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
