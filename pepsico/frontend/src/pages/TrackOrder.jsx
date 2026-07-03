import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useSearchParams } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001'

export default function TrackOrder() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [orderId, setOrderId] = useState(searchParams.get('id') || '')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)

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
      setTimeout(() => handleTrackOrder(urlOrderId), 500)
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

  const loadUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        // Validate UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(authUser.id)) {
          setError('User ID is not valid. Please contact support.')
          return
        }
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        setUser(profile)
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
          setError('No order found with this Order ID.')
          setLoading(false)
          return
        }
      } catch (apiErr) {
        console.error('Track order API error:', apiErr)
      }

      if (trackedOrder) {
        setOrder(trackedOrder)
        setLoading(false)
        return
      }

      if (!user?.id) {
        setError('No order found with this Order ID.')
        setLoading(false)
        return
      }

      const { data: userOrders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Query error:', error)
        throw error
      }

      const foundOrder = userOrders?.find(order =>
        order.id === trimmedId || order.id.toLowerCase().startsWith(trimmedId.toLowerCase())
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
    { key: 'Approved', label: 'Approved', icon: '✅', desc: 'Order confirmed by admin' },
    { key: 'Packed', label: 'Packed', icon: '📦', desc: 'Order is being prepared' },
    { key: 'Dispatched', label: 'Dispatched', icon: '🚚', desc: 'Order shipped from warehouse' },
    { key: 'Out for Delivery', label: 'Out for Delivery', icon: '🛵', desc: 'On the way to you' },
    { key: 'Delivered', label: 'Delivered', icon: '�', desc: 'Order successfully delivered' }
  ]

  const getCurrentStepIndex = (status) => {
    const index = statusSteps.findIndex(s => s.key === status)
    return index >= 0 ? index : 0
  }

  const currentStepIndex = order ? getCurrentStepIndex(order.status) : -1
  const isDelivered = order?.status === 'Delivered'
  const isCancelled = order?.status === 'Cancelled'
  const isApproved = order && currentStepIndex > 0

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: '#0f172a' }}>Track Your Order</h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: 15 }}>
          Enter your Order ID to view real-time delivery status
        </p>
      </motion.div>

      {/* Search Section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.1 }}
        style={{ 
          marginTop: 24, 
          padding: 24, 
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
          borderRadius: 16, 
          border: '1px solid #bae6fd',
          boxShadow: '0 4px 16px rgba(14, 165, 233, 0.1)'
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder()}
            placeholder="Enter Order ID (full or first 8 characters)"
            disabled={loading}
            style={{
              flex: 1,
              minWidth: 280,
              padding: '14px 18px',
              fontSize: 15,
              borderRadius: 12,
              border: '2px solid #bae6fd',
              outline: 'none',
              transition: 'all 0.2s',
              background: 'white'
            }}
            onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
            onBlur={(e) => e.target.style.borderColor = '#bae6fd'}
          />
          <button
            onClick={handleTrackOrder}
            disabled={loading}
            className="btn"
            style={{
              padding: '14px 28px',
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 12,
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              color: 'white',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 6px 20px rgba(14, 165, 233, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Searching...' : '🔍 Track Order'}
          </button>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }}
            style={{ 
              marginTop: 12, 
              padding: '12px 16px', 
              background: '#fef2f2', 
              color: '#b91c1c', 
              borderRadius: 10, 
              border: '1px solid #fecaca',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            ⚠️ {error}
          </motion.div>
        )}
      </motion.div>

      {/* Order Details */}
      <AnimatePresence mode="wait">
        {order && (
          <motion.div
            key="order-details"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ marginTop: 24 }}
          >
            {/* Cancelled State */}
            {isCancelled && (
              <div style={{ 
                padding: 24, 
                background: '#fef2f2', 
                borderRadius: 16, 
                border: '2px solid #fca5a5',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#991b1b' }}>Order Cancelled</h3>
                <p style={{ margin: 0, color: '#7f1d1d', fontSize: 15 }}>
                  This order has been cancelled. Please contact support for more information.
                </p>
              </div>
            )}

            {/* Not Approved State */}
            {!isCancelled && !isApproved && (
              <div style={{ 
                padding: 24, 
                background: '#fffbeb', 
                borderRadius: 16, 
                border: '2px solid #fde68a',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#92400e' }}>Awaiting Admin Approval</h3>
                <p style={{ margin: 0, color: '#78350f', fontSize: 15 }}>
                  Your order has been placed and is awaiting admin approval.<br />
                  Tracking will be available once the order is approved.
                </p>
              </div>
            )}

            {/* Delivered State */}
            {isDelivered && (
              <div style={{ 
                padding: 24, 
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', 
                borderRadius: 16, 
                border: '2px solid #86efac',
                textAlign: 'center',
                marginBottom: 20
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#14532d' }}>Order Delivered Successfully!</h3>
                <p style={{ margin: 0, color: '#166534', fontSize: 15 }}>
                  Your order has been delivered. Thank you for your business!
                </p>
              </div>
            )}

            {/* Order Summary Card */}
            {!isCancelled && (
              <div style={{ 
                padding: 24, 
                background: 'white', 
                borderRadius: 16, 
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                marginTop: isCancelled ? 0 : 20
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Order Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>Order ID</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{order.id.slice(0, 12)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>Order Date</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                      {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>Total Amount</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0ea5e9' }}>
                      ₹{Number(order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>Payment Mode</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                      {order.payment_mode || 'COD'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status Timeline */}
            {!isCancelled && isApproved && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{ 
                  marginTop: 24, 
                  padding: 32, 
                  background: 'white', 
                  borderRadius: 16, 
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
                }}
              >
                <h3 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Delivery Status</h3>
                
                {/* Timeline */}
                <div style={{ position: 'relative' }}>
                  {statusSteps.map((step, index) => {
                    const isCompleted = index <= currentStepIndex
                    const isCurrent = index === currentStepIndex
                    const isLast = index === statusSteps.length - 1

                    return (
                      <div key={step.key} style={{ position: 'relative', paddingBottom: isLast ? 0 : 40 }}>
                        {/* Connector Line */}
                        {!isLast && (
                          <div style={{
                            position: 'absolute',
                            left: 20,
                            top: 42,
                            width: 3,
                            height: 40,
                            background: isCompleted ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)' : '#e5e7eb',
                            borderRadius: 2
                          }} />
                        )}

                        {/* Step */}
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }} 
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * index }}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'flex-start', 
                            gap: 16,
                            position: 'relative'
                          }}
                        >
                          {/* Icon Circle */}
                          <div style={{
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            background: isCompleted 
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                              : isCurrent 
                                ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
                                : '#f3f4f6',
                            border: isCurrent ? '3px solid #bae6fd' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            flexShrink: 0,
                            boxShadow: isCompleted || isCurrent ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                            animation: isCurrent ? 'pulse 2s infinite' : 'none'
                          }}>
                            {step.icon}
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, paddingTop: 4 }}>
                            <div style={{ 
                              fontSize: 16, 
                              fontWeight: 800, 
                              color: isCompleted ? '#10b981' : isCurrent ? '#0ea5e9' : '#9ca3af',
                              marginBottom: 4
                            }}>
                              {step.label}
                            </div>
                            <div style={{ 
                              fontSize: 14, 
                              color: isCompleted || isCurrent ? '#6b7280' : '#d1d5db'
                            }}>
                              {step.desc}
                            </div>
                            {isCurrent && (
                              <div style={{
                                marginTop: 8,
                                padding: '6px 12px',
                                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                                color: '#0369a1',
                                fontSize: 13,
                                fontWeight: 700,
                                borderRadius: 8,
                                display: 'inline-block'
                              }}>
                                Current Status
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}
