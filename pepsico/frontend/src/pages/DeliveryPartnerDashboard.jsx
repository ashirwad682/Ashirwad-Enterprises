import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useDeliveryPartnerAuth } from '../context/DeliveryPartnerAuthContext'
import { supabase } from '../lib/supabaseClient'
import { AnimatePresence, motion } from 'framer-motion'
import CashValidationModal from '../components/CashValidationModal'
import OTPVerificationModal from '../components/OTPVerificationModal'
import DeliveryProgressTracker from '../components/DeliveryProgressTracker'
import DeliveryJourneyModal from '../components/DeliveryJourneyModal'
import DashboardBlockLockModal from '../components/DashboardBlockLockModal'
import DeliveryAttendanceCard from '../components/DeliveryAttendanceCard'
import { useMediaQuery } from '../lib/useMediaQuery'

const API_BASE = import.meta.env.VITE_API_BASE 
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') 
  : (import.meta.env.PROD ? 'https://pepsico-backend.vercel.app' : 'http://localhost:5001')

const isCodOrder = (order) => {
  return ((order?.payment_method || order?.order_type || '')).toString().toUpperCase() === 'COD'
}

const DELIVERY_STAGES = [
  { key: 'packed', label: 'Packed', description: 'Order is being prepared', icon: '📦' },
  { key: 'dispatched', label: 'Dispatched', description: 'Order shipped from warehouse', icon: '🚚' },
  { key: 'out_for_delivery', label: 'Out for Delivery', description: 'On the way to you', icon: '🛵' },
  { key: 'delivered', label: 'Delivered', description: 'Delivery confirmed via OTP', icon: '🎉' }
]

const STATUS_SEQUENCE = ['pending', 'assigned', 'packed', 'dispatched', 'out_for_delivery', 'delivered']

const STATUS_LABEL_MAP = DELIVERY_STAGES.reduce((acc, stage) => {
  acc[stage.key] = stage.label
  return acc
}, {})

const normalizeDeliveryStatus = (status) => {
  if (!status) return 'pending'
  const normalized = status
    .toString()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
  return STATUS_SEQUENCE.includes(normalized) ? normalized : 'pending'
}

const getStatusRank = (status) => STATUS_SEQUENCE.indexOf(normalizeDeliveryStatus(status))

const getNextStatusKey = (status) => {
  const current = normalizeDeliveryStatus(status)
  if (current === 'pending' || current === 'assigned') return 'packed'
  if (current === 'packed') return 'dispatched'
  if (current === 'dispatched') return 'out_for_delivery'
  if (current === 'out_for_delivery') return 'delivered'
  return null
}

const getStatusActionLabel = (status) => {
  const nextKey = getNextStatusKey(status)
  if (!nextKey) return null
  if (nextKey === 'delivered') return 'Complete Delivery'
  return `Mark as ${STATUS_LABEL_MAP[nextKey]}`
}

const getStatusDisplay = (status) => STATUS_LABEL_MAP[normalizeDeliveryStatus(status)] || 'Pending'

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const getShippingMethod = (order) => {
  if (!order) return 'standard'
  if (order.shipping_method) return String(order.shipping_method).toLowerCase()
  const fee = Number(order.shipping_fee || 0)
  return fee > 0 ? 'express' : 'standard'
}

const getExpectedDelivery = (order) => {
  const createdAt = order?.created_at ? new Date(order.created_at) : new Date()
  if (Number.isNaN(createdAt.getTime())) return null

  const method = getShippingMethod(order)
  if (method === 'express') {
    const sameDay = createdAt.getHours() < 12
    const deliveryDate = new Date(createdAt)
    deliveryDate.setDate(deliveryDate.getDate() + (sameDay ? 0 : 1))
    return {
      methodLabel: 'Express',
      date: deliveryDate,
      text: `${deliveryDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} by 5:00 PM`
    }
  }

  const deliveryDate = new Date(createdAt)
  deliveryDate.setDate(deliveryDate.getDate() + 5)
  return {
    methodLabel: 'Standard',
    date: deliveryDate,
    text: `${deliveryDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} by 5:00 PM`
  }
}

const isOrderDeliveredToday = (order) => {
  const source = order?.delivered_at || order?.updated_at
  if (!source) return false
  const deliveredDate = new Date(source)
  if (Number.isNaN(deliveredDate.getTime())) return false
  const today = new Date()
  return deliveredDate.toDateString() === today.toDateString()
}

export default function DeliveryPartnerDashboard() {
  const { deliveryPartner, logout } = useDeliveryPartnerAuth()
  const [orders, setOrders] = useState([])
  const [stats, setStats] = useState({ total: 0, pending: 0, deliveredToday: 0, codCollected: 0, codSettled: 0, codOutstanding: 0 })
  const [loading, setLoading] = useState(true)
  const [showCashModal, setShowCashModal] = useState(false)
  const [showOTPModal, setShowOTPModal] = useState(false)
  const [currentOrderForValidation, setCurrentOrderForValidation] = useState(null)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState(null)
  const [showJourneyModal, setShowJourneyModal] = useState(null)
  const [showAttendanceOverlay, setShowAttendanceOverlay] = useState(false)
  const [deliveredFilter, setDeliveredFilter] = useState('all')
  const isMobile = useMediaQuery('(max-width: 900px)')
  
  // Dashboard Blocking State
  const [dashboardBlocked, setDashboardBlocked] = useState(false)
  const [isBlockingEnabled, setIsBlockingEnabled] = useState(true)
  const [blockTime, setBlockTime] = useState('17:30')
  const [dashboardLocked, setDashboardLocked] = useState(false)
  const [showBlockingInfo, setShowBlockingInfo] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const deliveredSectionRef = useRef(null)

  // Calculate remaining time until blocking
  const getRemainingTime = () => {
    if (!blockTime) return { hours: 0, minutes: 0, isPassed: false }
    
    // Handle both HH:MM and HH:MM:SS formats
    const timeParts = blockTime.split(':')
    const hours = parseInt(timeParts[0])
    const minutes = parseInt(timeParts[1])
    
    const blockDate = new Date(currentTime)
    blockDate.setHours(hours, minutes, 0, 0)
    
    let diff = blockDate - currentTime
    let isPassed = false
    
    if (diff < 0) {
      isPassed = true
      // Timer starts counting down to the next day's block time
      blockDate.setDate(blockDate.getDate() + 1)
      diff = blockDate - currentTime
    }
    
    const remainingHours = Math.floor(diff / (1000 * 60 * 60))
    const remainingMinutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    return { hours: remainingHours, minutes: remainingMinutes, isPassed }
  }

  const formatBlockTime = (time24) => {
    if (!time24) return ''
    // Handle both HH:MM and HH:MM:SS formats
    const timeParts = time24.split(':')
    const hour = parseInt(timeParts[0])
    const minute = timeParts[1]
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minute} ${ampm}`
  }

  const remainingTime = getRemainingTime()

  // Cleanup old unlock sessions on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    // Remove unlock sessions from previous days
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('dashboard_unlock_')) {
        const sessionDate = key.split('_').pop() // Extract date from key
        if (sessionDate !== today) {
          localStorage.removeItem(key)
        }
      }
    })
  }, [])

  // Update current time every second for real-time countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Enforce local blocking if time passes and no valid unlock session exists
  useEffect(() => {
    if (isBlockingEnabled && remainingTime.isPassed && !dashboardLocked) {
      if (deliveryPartner?.id) {
        const today = new Date().toISOString().split('T')[0]
        const sessionKey = `dashboard_unlock_${deliveryPartner.id}_${today}`
        const unlockSession = localStorage.getItem(sessionKey)
        if (unlockSession) {
          try {
            const session = JSON.parse(unlockSession)
            const sessionDate = new Date(session.unlockedAt).toISOString().split('T')[0]
            if (sessionDate === today && (session.blockTime === blockTime || session.blockTime === blockTime + ':00')) {
              return; // Already unlocked validly
            }
          } catch (e) {}
        }
      }
      setDashboardLocked(true);
    }
  }, [currentTime, isBlockingEnabled, remainingTime.isPassed, dashboardLocked, deliveryPartner?.id, blockTime]);

  // Close blocking info popup when clicking outside
  useEffect(() => {
    if (!showBlockingInfo) return
    
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-blocking-info]')) {
        setShowBlockingInfo(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBlockingInfo])

  const activeOrders = useMemo(
    () => orders.filter(order => normalizeDeliveryStatus(order.delivery_status) !== 'delivered'),
    [orders]
  )

  const deliveredOrders = useMemo(
    () => orders.filter(order => normalizeDeliveryStatus(order.delivery_status) === 'delivered'),
    [orders]
  )

  const deliveredTodayOrders = useMemo(
    () => deliveredOrders.filter(isOrderDeliveredToday),
    [deliveredOrders]
  )

  const displayedDeliveredOrders = deliveredFilter === 'today' ? deliveredTodayOrders : deliveredOrders

  useEffect(() => {
    loadAssignedOrders()
    loadStats()
    checkDashboardBlocking()
    const interval = setInterval(() => {
      loadAssignedOrders()
      loadStats()
      checkDashboardBlocking()
    }, 10000) // Check every 10 seconds for faster updates
    return () => clearInterval(interval)
  }, [deliveryPartner?.id])

  const checkDashboardBlocking = async () => {
    try {
      const API_BASE_LOCAL = import.meta.env.VITE_API_BASE 
        ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') 
        : (import.meta.env.PROD ? 'https://pepsico-backend.vercel.app' : 'http://localhost:5001')
      // Add cache busting to ensure fresh data
      const timestamp = new Date().getTime()
      const res = await fetch(`${API_BASE_LOCAL}/api/dashboard-blocking/dashboard-blocking?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      if (!res.ok) return
      const data = await res.json()
      
      // Normalize time format (strip seconds if present)
      const normalizedBlockTime = data.blockTime?.split(':').slice(0, 2).join(':') || '17:30'
      
      console.log('Dashboard blocking response:', data)
      console.log('Current blockTime state:', blockTime)
      console.log('Normalized blockTime from API:', normalizedBlockTime)
      
      setDashboardBlocked(data.isBlocked)
      setBlockTime(normalizedBlockTime)
      setIsBlockingEnabled(data.isEnabled !== false)
      
      // Check if partner has already unlocked for today
      if (data.isBlocked && deliveryPartner?.id) {
        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
        const sessionKey = `dashboard_unlock_${deliveryPartner.id}_${today}`
        const unlockSession = localStorage.getItem(sessionKey)
        
        if (unlockSession) {
          try {
            const session = JSON.parse(unlockSession)
            // Verify session is for current block time and same day
            const sessionDate = new Date(session.unlockedAt).toISOString().split('T')[0]
            if (sessionDate === today && session.blockTime === normalizedBlockTime) {
              // Valid unlock session exists - don't show lock modal
              setDashboardLocked(false)
              setDashboardBlocked(true) // Ensure it shows as "Unlocked"
              return
            }
          } catch (err) {
            // Invalid session data, remove it
            localStorage.removeItem(sessionKey)
          }
        }
      }
      
      setDashboardLocked(data.isBlocked)
    } catch (err) {
      console.error('Failed to check dashboard blocking:', err)
    }
  }

  const loadAssignedOrders = async () => {
    if (!deliveryPartner?.id) {
      setLoading(false)
      setOrders([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/delivery/assigned-orders/${deliveryPartner.id}`, {
        headers: {
          'x-delivery-partner-id': deliveryPartner.id
        }
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load assigned orders')
      }

      const payload = await res.json()
      const ordersData = Array.isArray(payload.orders) ? payload.orders : []

      const enrichedOrders = ordersData.map((order) => {
        const users = order?.users || {}
        const addresses = Array.isArray(order?.addresses) ? order.addresses : []
        const primaryAddress = addresses[0] || {}
        const normalizedStatus = normalizeDeliveryStatus(order.delivery_status)

        const customerName = users.full_name
          || order.customer_name
          || order.customer_full_name
          || order.customerName
          || order.contact_name
          || order.name
          || null

        const customerEmail = users.email
          || order.customer_email
          || order.email
          || order.contact_email
          || null

        const customerPhone = users.phone
          || order.customer_phone
          || order.phone
          || order.mobile_number
          || order.contact_number
          || null

        const deliveryAddress = order.delivery_address
          || primaryAddress.address_line
          || order.shipping_address
          || order.customer_address
          || order.address_line
          || null

        return {
          ...order,
          users,
          addresses,
          delivery_status: normalizedStatus,
          status_label: getStatusDisplay(normalizedStatus),
          status_rank: getStatusRank(normalizedStatus),
          status: getStatusDisplay(normalizedStatus),
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          delivery_address: deliveryAddress || 'Address not available',
          delivery_pincode: order.delivery_pincode || primaryAddress.pincode || null,
          delivery_district: order.delivery_district || primaryAddress.district || null,
          delivery_state: order.delivery_state || primaryAddress.state || null
        }
      })

      setOrders(enrichedOrders)
      setError(null)
    } catch (err) {
      console.error('Failed to load orders:', err)
      setError('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    if (!deliveryPartner?.id) {
      setStats({ total: 0, pending: 0, deliveredToday: 0, codCollected: 0, codSettled: 0, codOutstanding: 0 })
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/delivery/stats/${deliveryPartner.id}`, {
        headers: {
          'x-delivery-partner-id': deliveryPartner.id
        }
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load stats')
      }

      const payload = await res.json()
      const statsPayload = payload?.stats || {}

      setStats({
        total: statsPayload.total || 0,
        pending: statsPayload.pending || 0,
        deliveredToday: statsPayload.deliveredToday || 0,
        codCollected: statsPayload.codCollected || 0,
        codSettled: statsPayload.codSettled || 0,
        codOutstanding: statsPayload.codOutstanding || 0
      })
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  const handleStatusAdvance = async (order) => {
    if (statusUpdatingId === order?.id) {
      return
    }

    const currentStatus = normalizeDeliveryStatus(order.delivery_status)
    const nextStatus = getNextStatusKey(currentStatus)

    if (!nextStatus) {
      setSuccessMessage('This delivery has already been completed.')
      setTimeout(() => setSuccessMessage(null), 3500)
      return
    }

    if (nextStatus === 'delivered') {
      const refreshedOrder = { ...order, delivery_status: currentStatus }
      setStatusUpdatingId(order.id)
      setCurrentOrderForValidation(refreshedOrder)
      if (isCodOrder(order)) {
        setShowCashModal(true)
      } else {
        setShowOTPModal(true)
      }
      return
    }

    try {
      setError(null)
      setStatusUpdatingId(order.id)

      const res = await fetch(`${API_BASE}/api/delivery/status/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-delivery-partner-id': deliveryPartner?.id
        },
        body: JSON.stringify({ status: nextStatus })
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to update status')
      }

      const statusLabel = getStatusDisplay(nextStatus)
      setSuccessMessage(`${statusLabel} status recorded.`)
      setTimeout(() => setSuccessMessage(null), 4000)

      await loadAssignedOrders()
      await loadStats()
    } catch (err) {
      console.error('Status advance error:', err)
      setError('Failed to update status: ' + err.message)
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const handleCashValidation = async (cashReceived, order) => {
    try {
      const billAmount = Number(order.total_amount || 0)
      const receivedAmount = Number(cashReceived)
      const normalizedReceived = Number(receivedAmount.toFixed(2))

      if (Number.isNaN(receivedAmount)) {
        return { success: false, error: 'Enter the exact amount collected from the customer' }
      }

      const isMismatch = Math.abs(normalizedReceived - billAmount) > 0.01

      if (isMismatch) {
        return { success: false, error: `Cash received (₹${normalizedReceived.toFixed(2)}) must match the invoice total (₹${billAmount.toFixed(2)})` }
      }

      // Update order with cash amount
      await supabase
        .from('orders')
        .update({ cod_amount_received: normalizedReceived })
        .eq('id', order.id)

      setCurrentOrderForValidation({ ...order, cod_amount_received: normalizedReceived })
      await loadAssignedOrders()
      setShowCashModal(false)
      setShowOTPModal(true)
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Failed to record cash amount: ' + err.message }
    }
  }

  const handleOTPVerified = async (order) => {
    try {
      setError(null)
      if (isCodOrder(order) && (order.cod_amount_received === undefined || order.cod_amount_received === null)) {
        setError('Please record the COD cash amount before completing delivery.')
        return
      }
      const codAmount = isCodOrder(order)
        ? Number(order.cod_amount_received ?? order.total_amount ?? 0)
        : null

      const response = await fetch(`${API_BASE}/api/delivery/mark-delivered/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-delivery-partner-id': deliveryPartner?.id
        },
        body: JSON.stringify({ codAmountReceived: codAmount })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to mark as delivered')
      }

      setShowOTPModal(false)
      setCurrentOrderForValidation(null)
      setStatusUpdatingId(null)
      setSuccessMessage('Order delivered successfully!')
      setTimeout(() => setSuccessMessage(null), 5000)
      setDeliveredFilter('today')
      if (deliveredSectionRef.current) {
        setTimeout(() => {
          deliveredSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 150)
      }

      await loadAssignedOrders()
      await loadStats()
    } catch (err) {
      setError('Failed to mark as delivered: ' + err.message)
      console.error('Mark delivered error:', err)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #fff6f5 0%, #fdf7ff 40%, #ffffff 100%)',
      fontFamily: "'Space Grotesk', 'Sora', 'Montserrat', sans-serif",
      paddingBottom: 48
    }}>
      {/* Dashboard Block Lock Modal */}
      <DashboardBlockLockModal 
        isBlocked={dashboardLocked}
        blockTime={blockTime}
        onUnlock={() => {
          setDashboardLocked(false);
          setDashboardBlocked(true);
        }}
        partnerId={deliveryPartner?.id}
      />

      <div
        style={{
          maxWidth: 1220,
          margin: '0 auto',
          padding: isMobile ? '20px 14px 36px' : '32px 24px 56px',
          filter: showAttendanceOverlay ? 'blur(6px)' : 'none',
          transition: 'filter 0.25s ease'
        }}
      >
      {/* Error & Success Messages */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="alert error"
          style={{ marginBottom: 16 }}
        >
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
        </motion.div>
      )}
      
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="alert"
          style={{ marginBottom: 16, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}
        >
          ✓ {successMessage}
        </motion.div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          position: 'relative',
          background: 'rgba(255,255,255,0.88)',
          borderRadius: 24,
          padding: isMobile ? 20 : 28,
          color: '#0f172a',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
          marginBottom: 24,
          border: '1px solid rgba(226, 232, 240, 0.9)',
          overflow: 'hidden'
        }}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(900px circle at 10% 10%, rgba(255, 228, 225, 0.6), transparent 55%), radial-gradient(900px circle at 90% 30%, rgba(255, 214, 165, 0.45), transparent 55%)'
        }} />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{
              width: isMobile ? 64 : 76,
              height: isMobile ? 64 : 76,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff7a59 0%, #ff3d77 100%)',
              display: 'grid',
              placeItems: 'center',
              fontSize: isMobile ? 28 : 34,
              fontWeight: 800,
              color: '#fff',
              boxShadow: '0 14px 30px rgba(255, 77, 121, 0.25)'
            }}>
              {(deliveryPartner?.name || 'Partner').charAt(0)}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 999,
                background: '#fff1f2',
                color: '#be123c',
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                width: 'fit-content'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#be123c' }} />
                Festive Partner Portal
              </div>
              <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, color: '#0f172a' }}>
                Welcome back,{' '}
                <span style={{
                  background: 'linear-gradient(135deg, #ff7a59 0%, #ff3d77 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  {deliveryPartner?.name || 'Partner'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                <span>🆔 ID: {deliveryPartner?.delivery_partner_id}</span>
                <span>📍 {deliveryPartner?.assigned_area}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            {/* Blocking Time Indicator */}
            <div style={{ position: 'relative' }} data-blocking-info>
              <div
                onClick={() => {
                  setShowBlockingInfo(!showBlockingInfo)
                  checkDashboardBlocking() // Refresh blocking time when clicked
                }}
                style={{
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  color: '#92400e',
                  borderRadius: 12,
                  border: '1px solid #fbbf24',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 8px rgba(251, 191, 36, 0.15)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)'
                  e.target.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.25)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)'
                  e.target.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.15)'
                }}
              >
                <span style={{ fontSize: 16 }}>⏰</span>
                <span>
                {!isBlockingEnabled
                  ? `Not Enabled`
                  : dashboardLocked
                    ? `Blocked` 
                    : dashboardBlocked && !dashboardLocked
                      ? `Unlocked (${remainingTime.hours}h ${remainingTime.minutes}m)`
                      : remainingTime.hours > 0 
                        ? `Block in ${remainingTime.hours}h ${remainingTime.minutes}m`
                        : `Block in ${remainingTime.minutes}m`
                  }
                </span>
              </div>
              
              {/* Info Popup */}
              {showBlockingInfo && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    background: '#fff',
                    border: '2px solid #fbbf24',
                    borderRadius: 12,
                    padding: 16,
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                    zIndex: 1000,
                    minWidth: 280,
                    maxWidth: 320
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                    💰 Settlement Required
                  </div>
                  <div style={{ fontSize: 12, color: '#78716c', lineHeight: 1.6, marginBottom: 8 }}>
                    Dashboard blocks at <strong>{formatBlockTime(blockTime)}</strong> (in {remainingTime.hours}h {remainingTime.minutes}m) for settlement of collected money.
                  </div>
                  <div style={{ fontSize: 11, color: '#a8a29e', borderTop: '1px solid #fef3c7', paddingTop: 8 }}>
                    Contact admin for access key after settlement.
                  </div>
                  <button
                    onClick={() => setShowBlockingInfo(false)}
                    style={{
                      marginTop: 8,
                      width: '100%',
                      padding: '6px 12px',
                      background: '#fbbf24',
                      border: 'none',
                      borderRadius: 6,
                      color: '#78350f',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Got it
                  </button>
                </motion.div>
              )}
            </div>
            
            <button
              onClick={() => setShowAttendanceOverlay(true)}
              style={{
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                borderRadius: 12,
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
                alignSelf: isMobile ? 'flex-end' : 'center',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 8px 20px rgba(37, 99, 235, 0.25)'
              }}
            >
              📍 Attendance
            </button>

            <button
              onClick={logout}
              style={{
                padding: '10px 16px',
                background: '#fff',
                color: '#111827',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
                alignSelf: isMobile ? 'flex-end' : 'center',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)'
              }}
            >
              ⤴️ Logout
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 18, marginTop: 24, position: 'relative' }}>
          <StatCard label="Total Assigned" categoryLabel="Live Status" value={stats.total} icon="📋" color="#4f46e5" isCompact={isMobile} />
          <StatCard label="Pending Deliveries" categoryLabel="Priority" value={stats.pending} icon="⏳" color="#f97316" isCompact={isMobile} />
          <StatCard
            label="Delivered Today"
            categoryLabel="Performance"
            value={stats.deliveredToday}
            icon="✓"
            color="#ec4899"
            isCompact={isMobile}
            onClick={() => {
              setDeliveredFilter('today')
              if (deliveredSectionRef.current) {
                deliveredSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
            active={deliveredFilter === 'today'}
          />
          <StatCard
            label="COD Collected"
            categoryLabel="Finance"
            value={`₹${formatCurrency(stats.codCollected)}`}
            icon="₹"
            color="#059669"
            isCompact={isMobile}
            meta={`Settled ₹${formatCurrency(stats.codSettled)} | Balance ₹${formatCurrency(stats.codOutstanding)}`}
          />
        </div>
      </motion.div>

      {/* Orders List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              background: '#fff1f2',
              color: '#be123c',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700
            }}>
              ☰
            </div>
            <div>
              <div style={{ margin: 0, color: '#0f172a', fontSize: isMobile ? 18 : 20, fontWeight: 800 }}>Assigned Orders</div>
              <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>Managing your current delivery queue for the festive season.</div>
            </div>
          </div>
          <button
            onClick={loadAssignedOrders}
            style={{
              padding: '8px 14px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 700,
              color: '#0f172a',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)'
            }}
          >
            🔄 Refresh List
          </button>
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>⏳ Loading orders...</div>
          </div>
          ) : activeOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>📭 No orders assigned yet</div>
            <div style={{ fontSize: 14 }}>Orders will appear here once assigned by admin</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
              {activeOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onAdvanceStatus={() => handleStatusAdvance(order)}
                statusUpdating={statusUpdatingId === order.id}
                onShowJourney={() => setShowJourneyModal(order)}
                isCompact={isMobile}
              />
            ))}
          </div>
        )}
      </div>

      <div ref={deliveredSectionRef} style={{ marginTop: 40 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#0f172a' }}>✅ Delivered Orders</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <FilterChip
              label={`All (${deliveredOrders.length})`}
              active={deliveredFilter === 'all'}
              onClick={() => setDeliveredFilter('all')}
            />
            <FilterChip
              label={`Today (${deliveredTodayOrders.length})`}
              active={deliveredFilter === 'today'}
              onClick={() => setDeliveredFilter('today')}
            />
          </div>
        </div>

        {displayedDeliveredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed #e5e7eb', borderRadius: 12, color: '#6b7280' }}>
            {deliveredFilter === 'today'
              ? 'No orders delivered today yet.'
              : 'Delivered orders will appear here once you complete deliveries.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {displayedDeliveredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onAdvanceStatus={() => {}}
                statusUpdating={false}
                onShowJourney={() => setShowJourneyModal(order)}
                isCompact={isMobile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCashModal && currentOrderForValidation && (
        <CashValidationModal
          order={currentOrderForValidation}
          onClose={() => {
            setShowCashModal(false)
            setCurrentOrderForValidation(null)
            setStatusUpdatingId(null)
          }}
          onValidate={handleCashValidation}
        />
      )}

      {showOTPModal && currentOrderForValidation && (
        <OTPVerificationModal
          order={currentOrderForValidation}
          deliveryPartnerId={deliveryPartner?.id}
          onClose={() => {
            setShowOTPModal(false)
            setCurrentOrderForValidation(null)
            setStatusUpdatingId(null)
          }}
          onVerified={handleOTPVerified}
        />
      )}

      {showJourneyModal && (
        <DeliveryJourneyModal
          order={showJourneyModal}
          onClose={() => setShowJourneyModal(null)}
        />
      )}
      </div>

      <AnimatePresence>
        {showAttendanceOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAttendanceOverlay(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              background: 'rgba(15, 23, 42, 0.36)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: isMobile ? 10 : 18
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 980,
                maxHeight: '88vh',
                overflowY: 'auto',
                borderRadius: 18
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button
                  onClick={() => setShowAttendanceOverlay(false)}
                  style={{
                    border: 'none',
                    borderRadius: 10,
                    padding: '7px 12px',
                    background: '#fff',
                    color: '#334155',
                    cursor: 'pointer',
                    fontWeight: 700,
                    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.15)'
                  }}
                >
                  Close
                </button>
              </div>
              <DeliveryAttendanceCard deliveryPartnerId={deliveryPartner?.id} modalView />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ label, value, accent, icon, isCompact, onClick, active, meta, categoryLabel, color }) {
  const tone = color || (accent === 'warning' ? '#f97316' : '#6366f1')
  const clickable = typeof onClick === 'function'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={clickable ? { scale: 1.04 } : undefined}
      onClick={onClick}
      style={{ 
        padding: isCompact ? '18px 16px' : '22px 20px', 
        borderRadius: 18, 
        background: 'rgba(255,255,255,0.92)', 
        color: '#0f172a', 
        border: active ? `1px solid ${tone}` : '1px solid rgba(226, 232, 240, 0.9)',
        boxShadow: active ? `0 0 0 4px ${tone}22` : '0 10px 20px rgba(15, 23, 42, 0.06)',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s ease, border 0.2s ease',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: tone,
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          fontSize: isCompact ? 20 : 22,
          boxShadow: `0 6px 14px ${tone}33`
        }}>
          {icon}
        </div>
        <div style={{ fontSize: 10, color: tone, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
          {categoryLabel}
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: isCompact ? 24 : 30, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>{value}</div>
      {meta && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, fontWeight: 600 }}>{meta}</div>
      )}
    </motion.div>
  )
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        padding: '6px 14px',
        borderRadius: 999,
        border: active ? '1px solid rgba(255,140,0,0.65)' : '1px solid #e5e7eb',
        background: active ? 'rgba(255,140,0,0.12)' : '#f9fafb',
        color: active ? '#b45309' : '#4b5563',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      {label}
    </button>
  )
}

function OrderCard({ order, onAdvanceStatus, statusUpdating, onShowJourney, isCompact }) {
    // Modal for viewing products (no checkboxes)
    const [showProductView, setShowProductView] = useState(false);
  const [showProductChecklist, setShowProductChecklist] = useState(false);
  const [checkedProducts, setCheckedProducts] = useState([]);
  const [checklistSubmitted, setChecklistSubmitted] = useState(false);
  const [productList, setProductList] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Fetch product details for order.items
  useEffect(() => {
    const fetchProducts = async () => {
      if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
        setProductList([]);
        return;
      }
      setLoadingProducts(true);
      try {
        const productIds = order.items.map(item => item.product_id).filter(Boolean);
        if (productIds.length === 0) {
          setProductList([]);
          return;
        }
        // Fetch all products in one query
        const { data, error } = await supabase
          .from('products')
          .select('id, name, description')
          .in('id', productIds);
        if (error) {
          setProductList([]);
        } else {
          // Merge quantity from order.items
          const productsWithQty = data.map(prod => {
            const item = order.items.find(i => i.product_id === prod.id);
            return {
              ...prod,
              quantity: item?.quantity || 1,
              description: prod.description || item?.description || ''
            };
          });
          setProductList(productsWithQty);
        }
      } catch (e) {
        setProductList([]);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, [order.items]);

  const handleProductCheck = (id) => {
    setCheckedProducts((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const handleChecklistSubmit = () => {
    setChecklistSubmitted(true);
    setShowProductChecklist(false);
  };
  const statusConfig = {
    pending: { color: '#fbbf24', label: '⏳ Pending', icon: '⏱️' },
    assigned: { color: '#3b82f6', label: '📍 Assigned', icon: '📌' },
    packed: { color: '#38bdf8', label: '📦 Packed', icon: '📦' },
    dispatched: { color: '#f97316', label: '🚚 Dispatched', icon: '🚚' },
    out_for_delivery: { color: '#8b5cf6', label: '🛵 Out for Delivery', icon: '🛵' },
    delivered: { color: '#10b981', label: '✅ Delivered', icon: '✅' }
  }

  const normalizedStatus = normalizeDeliveryStatus(order.delivery_status)
  const status = statusConfig[normalizedStatus] || statusConfig.pending
  const nextStatus = getNextStatusKey(normalizedStatus)
  const actionLabel = getStatusActionLabel(normalizedStatus)
  const isFinalAction = nextStatus === 'delivered'
  const nextStage = DELIVERY_STAGES.find(stage => stage.key === nextStatus)

  const isCOD = isCodOrder(order)

  // Get address - try multiple sources
  const orderIdDisplay = (order?.id || '').toString().slice(0, 8).toUpperCase() || 'N/A'
  const customerName = order.customer_name || order.users?.full_name || 'Customer not available'
  const customerEmail = order.customer_email || order.users?.email || null
  const customerPhone = order.customer_phone || order.users?.phone || null
  const address = order.delivery_address || order.address_line || 'Address not available'
  const locationMeta = [order.delivery_pincode, order.delivery_district, order.delivery_state]
    .filter(Boolean)
    .join(' • ')
  const expectedDelivery = getExpectedDelivery(order)

  // Show checklist if status is assigned/pending and next is packed
  const showPackedChecklist =
    (normalizedStatus === 'assigned' || normalizedStatus === 'pending') && nextStatus === 'packed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
      style={{
        padding: isCompact ? 16 : 20,
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        boxShadow: ['dispatched', 'out_for_delivery'].includes(normalizedStatus)
          ? '0 0 0 3px rgba(139, 92, 246, 0.12)'
          : 'none'
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isCompact ? '1fr' : '1fr auto',
          gap: isCompact ? 16 : 20,
          alignItems: 'start'
        }}
      >
        {/* Left Content */}
        <div>
          {/* First Row - IDs and Type */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: isCompact ? 12 : 16,
              marginBottom: isCompact ? 12 : 16
            }}
          >
            <div style={{ cursor: 'pointer' }} onClick={() => setShowProductView(true)}>
              <InfoBlock label="ORDER ID" value={orderIdDisplay} />
            </div>
            <InfoBlock label="CUSTOMER" value={customerName} />
            <InfoBlock label="TYPE" value={isCOD ? '💵 COD' : '✓ Prepaid'} highlight={isCOD} />
          </div>
            {/* Product View Modal (no checkboxes) */}
            {showProductView && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.32)',
                zIndex: 1100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{
                  background: '#fff',
                  borderRadius: 16,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                  padding: 32,
                  minWidth: 340,
                  maxWidth: '95vw',
                  minHeight: 160,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  border: '1.5px solid #e0e7ef',
                }}>
                  <button
                    onClick={() => setShowProductView(false)}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 18,
                      background: 'none',
                      border: 'none',
                      fontSize: 26,
                      color: '#64748b',
                      cursor: 'pointer',
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                    aria-label="Close"
                  >×</button>
                  <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 18, color: '#1e293b', letterSpacing: 0.2, textAlign: 'center' }}>Order Products</div>
                  {loadingProducts ? (
                    <div style={{ color: '#888', marginBottom: 14, textAlign: 'center' }}>Loading products...</div>
                  ) : productList.length === 0 ? (
                    <div style={{ color: '#dc2626', fontWeight: 600, marginBottom: 14, textAlign: 'center' }}>No products found for this order.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
                      {productList.map((prod) => (
                        <div key={prod.id} style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 14,
                          fontSize: 16,
                          background: '#f8fafc',
                          border: '1.5px solid #e5e7eb',
                          borderRadius: 9,
                          padding: '10px 14px',
                          fontWeight: 500,
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{prod.name}</span>
                            <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.35 }}>
                              {prod.description || 'No description available'}
                            </span>
                          </div>
                          <span style={{
                            background: '#f1f5f9',
                            color: '#2563eb',
                            fontWeight: 700,
                            fontSize: 15,
                            borderRadius: 6,
                            padding: '2px 10px',
                            marginLeft: 6,
                            minWidth: 32,
                            textAlign: 'center',
                            border: '1px solid #cbd5e1',
                          }}>Qty: {prod.quantity || 1}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Customer Contact */}
          {(customerEmail || customerPhone) && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 14,
              padding: '12px 14px',
              background: '#f8fafc',
              borderRadius: 10,
              border: '1px solid #e2e8f0'
            }}>
              {customerEmail && (
                <div style={{ fontSize: 13, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fce7f3',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: '#ec4899'
                  }}>
                    @
                  </span>
                  <span>{customerEmail}</span>
                </div>
              )}
              {customerPhone && (
                <div style={{ fontSize: 13, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15 }}>📞</span>
                  <span>{customerPhone}</span>
                </div>
              )}
            </div>
          )}

          {/* Address */}
          <div
            style={{
              fontSize: 14,
              color: '#556070',
              marginBottom: isCompact ? 10 : 12,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8
            }}
          >
            <span style={{ fontSize: 16, marginTop: 2 }}>📍</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{address}</div>
              {locationMeta && (
                <div style={{ fontSize: 12, color: '#999' }}>
                  {locationMeta}
                </div>
              )}
            </div>
          </div>

          {/* Amount Row */}
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#0f172a',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap'
            }}
          >
            <span>₹{Number(order.total_amount || 0).toFixed(2)}</span>
            {isCOD && !order.cod_amount_received && (
              <span style={{ fontSize: 12, color: '#dc2626', background: '#fee2e2', padding: '4px 8px', borderRadius: 6 }}>
                Collect ₹{Number(order.total_amount || 0).toFixed(2)} COD
              </span>
            )}
            {isCOD && order.cod_amount_received && (
              <span style={{ fontSize: 12, color: '#10b981', background: '#d1fae5', padding: '4px 8px', borderRadius: 6 }}>
                ✓ Cash: ₹{order.cod_amount_received.toFixed(2)}
              </span>
            )}
          </div>

          {expectedDelivery && (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center'
              }}
            >
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#0f172a',
                background: '#f1f5f9',
                padding: '4px 8px',
                borderRadius: 999,
                textTransform: 'uppercase',
                letterSpacing: 0.4
              }}>
                {expectedDelivery.methodLabel}
              </span>
              <span style={{ fontSize: 12, color: '#475569' }}>
                Expected delivery: {expectedDelivery.text}
              </span>
            </div>
          )}

          {/* Order Info */}
          <div style={{ fontSize: 12, color: '#999', marginTop: isCompact ? 10 : 12 }}>
            Ordered: {new Date(order.created_at).toLocaleDateString('en-IN')} at {new Date(order.created_at).toLocaleTimeString('en-IN')}
          </div>
        </div>

        {/* Right Side - Status & Actions */}
        <div
          style={{
            textAlign: isCompact ? 'left' : 'right',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isCompact ? 'stretch' : 'flex-end',
            gap: 12
          }}
        >
          <div style={{
            alignSelf: isCompact ? 'flex-start' : 'flex-end',
            display: 'inline-block',
            padding: '8px 14px',
            borderRadius: 8,
            background: status.color,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 14,
            whiteSpace: 'nowrap'
          }}>
            {status.icon} {status.label}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Packed checklist logic */}
            {showPackedChecklist && !showProductChecklist && !checklistSubmitted && (
              <motion.button
                whileHover={{ scale: statusUpdating ? 1 : 1.05 }}
                whileTap={{ scale: statusUpdating ? 1 : 0.95 }}
                onClick={() => setShowProductChecklist(true)}
                disabled={statusUpdating}
                style={{
                  padding: '10px 16px',
                  background: '#38bdf8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: statusUpdating ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  boxShadow: statusUpdating ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.15)',
                  width: isCompact ? '100%' : 'auto'
                }}
              >
                📦 Packed
              </motion.button>
            )}

            {showProductChecklist && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.32)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{
                  background: '#fff',
                  borderRadius: 16,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                  padding: 32,
                  minWidth: 360,
                  maxWidth: '95vw',
                  minHeight: 200,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  border: '1.5px solid #e0e7ef',
                }}>
                  <button
                    onClick={() => setShowProductChecklist(false)}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 18,
                      background: 'none',
                      border: 'none',
                      fontSize: 26,
                      color: '#64748b',
                      cursor: 'pointer',
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                    aria-label="Close"
                  >×</button>
                  <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 20, color: '#1e293b', letterSpacing: 0.2, textAlign: 'center' }}>Product Packing Checklist</div>
                  {loadingProducts ? (
                    <div style={{ color: '#888', marginBottom: 14, textAlign: 'center' }}>Loading products...</div>
                  ) : productList.length === 0 ? (
                    <div style={{ color: '#dc2626', fontWeight: 600, marginBottom: 14, textAlign: 'center' }}>No products found for this order.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
                      {productList.map((prod) => (
                        <label key={prod.id} style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 14,
                          fontSize: 16,
                          background: checkedProducts.includes(prod.id) ? '#e0f2fe' : '#f8fafc',
                          border: checkedProducts.includes(prod.id) ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
                          borderRadius: 9,
                          padding: '10px 14px',
                          transition: 'all 0.15s',
                          cursor: 'pointer',
                          fontWeight: 500,
                          boxShadow: checkedProducts.includes(prod.id) ? '0 2px 8px #2563eb22' : 'none',
                        }}>
                          <input
                            type="checkbox"
                            checked={checkedProducts.includes(prod.id)}
                            onChange={() => handleProductCheck(prod.id)}
                            style={{ accentColor: '#2563eb', width: 20, height: 20, marginRight: 8 }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{prod.name}</span>
                            <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.35 }}>
                              {prod.description || 'No description available'}
                            </span>
                          </div>
                          <span style={{
                            background: '#f1f5f9',
                            color: '#2563eb',
                            fontWeight: 700,
                            fontSize: 15,
                            borderRadius: 6,
                            padding: '2px 10px',
                            marginLeft: 6,
                            minWidth: 32,
                            textAlign: 'center',
                            border: '1px solid #cbd5e1',
                          }}>Qty: {prod.quantity || 1}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleChecklistSubmit}
                    disabled={checkedProducts.length !== productList.length || productList.length === 0}
                    style={{
                      padding: '12px 0',
                      background: checkedProducts.length === productList.length && productList.length > 0 ? '#2563eb' : '#d1d5db',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 800,
                      fontSize: 17,
                      marginTop: 8,
                      boxShadow: checkedProducts.length === productList.length && productList.length > 0 ? '0 2px 8px #2563eb33' : 'none',
                      cursor: checkedProducts.length === productList.length && productList.length > 0 ? 'pointer' : 'not-allowed',
                      transition: 'all 0.15s',
                      letterSpacing: 0.2,
                    }}
                  >
                    Confirm Packed
                  </button>
                </div>
              </div>
            )}

            {/* After checklist is submitted, show Mark as Dispatched */}
            {showPackedChecklist && checklistSubmitted && (
              <motion.button
                whileHover={{ scale: statusUpdating ? 1 : 1.05 }}
                whileTap={{ scale: statusUpdating ? 1 : 0.95 }}
                onClick={statusUpdating ? undefined : onAdvanceStatus}
                disabled={statusUpdating}
                style={{
                  padding: '10px 16px',
                  background: '#f97316',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: statusUpdating ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  boxShadow: statusUpdating ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.15)',
                  width: isCompact ? '100%' : 'auto',
                  marginTop: 8
                }}
              >
                🚚 Mark as Dispatched
              </motion.button>
            )}

            {/* Default action for other statuses */}
            {!showPackedChecklist && actionLabel && (
              <motion.button
                whileHover={{ scale: statusUpdating ? 1 : 1.05 }}
                whileTap={{ scale: statusUpdating ? 1 : 0.95 }}
                onClick={statusUpdating ? undefined : onAdvanceStatus}
                disabled={statusUpdating}
                style={{
                  padding: '10px 16px',
                  background: statusUpdating
                    ? '#d1d5db'
                    : isFinalAction
                      ? 'linear-gradient(135deg, #FF8C00 0%, #FFB347 100%)'
                      : 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: statusUpdating ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  boxShadow: statusUpdating ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.25)',
                  width: isCompact ? '100%' : 'auto'
                }}
              >
                {statusUpdating
                  ? 'Updating...'
                  : isFinalAction
                    ? '🎉 Complete Delivery (OTP)'
                    : `${nextStage?.icon || '➡️'} ${actionLabel}`}
              </motion.button>
            )}

            {normalizedStatus === 'delivered' && (
              <div
                style={{
                  padding: '10px 16px',
                  background: '#d1fae5',
                  color: '#065f46',
                  border: '1px solid #6ee7b7',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  textAlign: 'center'
                }}
              >
                ✓ Delivered
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Delivery Progress Tracker */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <DeliveryProgressTracker order={order} />
      </motion.div>
    </motion.div>
  )
}

function InfoBlock({ label, value, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </div>
      <div style={{ 
        fontWeight: 700, 
        color: highlight ? '#dc2626' : '#0f172a',
        fontSize: 15
      }}>
        {value}
      </div>
    </div>
  )
}
