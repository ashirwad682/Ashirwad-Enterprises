import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import CashValidationModal from '../components/CashValidationModal'
import OTPVerificationModal from '../components/OTPVerificationModal'
import DeliveryJourneyModal from '../components/DeliveryJourneyModal'
import { useWarehouseAuth } from '../context/WarehouseAuthContext'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001'
const STATUS_SEQUENCE = ['pending', 'assigned', 'packed', 'delivered']

const normalizeStatus = (status) => {
  if (!status) return 'pending'
  const normalized = status.toString().toLowerCase().replace(/[-\s]+/g, '_')
  // Legacy pickup statuses are collapsed into packed for the new simplified pickup flow.
  if (normalized === 'dispatched' || normalized === 'out_for_delivery') return 'packed'
  return STATUS_SEQUENCE.includes(normalized) ? normalized : 'pending'
}

const getNextStatusKey = (status) => {
  const current = normalizeStatus(status)
  if (current === 'pending' || current === 'assigned') return 'packed'
  if (current === 'packed') return 'delivered'
  return null
}

const getStatusActionLabel = (status) => {
  const nextKey = getNextStatusKey(status)
  if (!nextKey) return null
  if (nextKey === 'delivered') return 'Complete Pickup'
  return `Mark as ${nextKey.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}`
}

const isCodOrder = (order) => ((order?.payment_method || order?.order_type || '')).toString().toUpperCase() === 'COD'

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const formatPickupWindow = (order) => {
  if (!order?.pickup_available_from || !order?.pickup_available_until) return 'Pickup window not available yet'
  const start = new Date(order.pickup_available_from)
  const end = new Date(order.pickup_available_until)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Pickup window not available yet'
  return `${start.toLocaleString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
}

const parseOrderItems = (rawItems) => {
  let source = rawItems
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source)
    } catch {
      return []
    }
  }

  if (!Array.isArray(source)) return []

  return source.map((item, index) => {
    const quantityRaw = Number(item?.quantity ?? item?.qty ?? item?.count ?? 1)
    const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1

    const unitPriceRaw = Number(item?.price ?? item?.unit_price ?? item?.mrp ?? item?.rate ?? 0)
    const unitPrice = Number.isFinite(unitPriceRaw) ? unitPriceRaw : 0

    const lineTotalRaw = Number(item?.line_total ?? item?.total_price ?? item?.amount ?? unitPrice * quantity)
    const lineTotal = Number.isFinite(lineTotalRaw) ? lineTotalRaw : unitPrice * quantity

    return {
      key: String(item?.id || item?.product_id || item?.sku || index),
      name: item?.product_name || item?.name || item?.title || `Item ${index + 1}`,
      quantity,
      unitPrice,
      lineTotal
    }
  })
}

export default function WarehouseDashboard() {
  const { warehouse, authToken, logout } = useWarehouseAuth()
  const [orders, setOrders] = useState([])
  const [stats, setStats] = useState({ total: 0, pending: 0, deliveredToday: 0, codCollected: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState(null)
  const [showCashModal, setShowCashModal] = useState(false)
  const [showOTPModal, setShowOTPModal] = useState(false)
  const [currentOrderForValidation, setCurrentOrderForValidation] = useState(null)
  const [journeyOrder, setJourneyOrder] = useState(null)
  const [deliveredFilter, setDeliveredFilter] = useState('all')
  const [showPackChecklistModal, setShowPackChecklistModal] = useState(false)
  const [packChecklistOrder, setPackChecklistOrder] = useState(null)
  const [packSubmitting, setPackSubmitting] = useState(false)

  const authHeaders = useMemo(() => {
    if (!warehouse?.id || !authToken) return {}
    return {
      'x-warehouse-id': warehouse.id,
      'x-warehouse-auth': authToken
    }
  }, [warehouse?.id, authToken])

  const activeOrders = useMemo(
    () => orders.filter((order) => normalizeStatus(order.delivery_status) !== 'delivered'),
    [orders]
  )

  const deliveredOrders = useMemo(
    () => orders.filter((order) => normalizeStatus(order.delivery_status) === 'delivered'),
    [orders]
  )

  const deliveredTodayOrders = useMemo(() => {
    const today = new Date().toDateString()
    return deliveredOrders.filter((order) => order.delivered_at && new Date(order.delivered_at).toDateString() === today)
  }, [deliveredOrders])

  const visibleDeliveredOrders = deliveredFilter === 'today' ? deliveredTodayOrders : deliveredOrders

  useEffect(() => {
    if (!warehouse?.id || !authToken) {
      setLoading(false)
      setOrders([])
      return
    }

    loadAssignedOrders()
    loadStats()

    const interval = setInterval(() => {
      loadAssignedOrders(true)
      loadStats()
    }, 10000)

    return () => clearInterval(interval)
  }, [warehouse?.id, authToken])

  const loadAssignedOrders = async (silent = false) => {
    if (!warehouse?.id) return
    if (!silent) setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/warehouse/assigned-orders/${warehouse.id}`, { headers: authHeaders })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to load warehouse orders')

      const nextOrders = Array.isArray(payload.orders) ? payload.orders : []
      setOrders(nextOrders.map((order) => ({
        ...order,
        delivery_status: normalizeStatus(order.delivery_status)
      })))
      setError(null)
    } catch (err) {
      console.error('Warehouse order load failed:', err)
      setError(err.message || 'Failed to load warehouse orders')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const loadStats = async () => {
    if (!warehouse?.id) return
    try {
      const res = await fetch(`${API_BASE}/api/warehouse/stats/${warehouse.id}`, { headers: authHeaders })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to load warehouse stats')
      setStats({
        total: payload?.stats?.total || 0,
        pending: payload?.stats?.pending || 0,
        deliveredToday: payload?.stats?.deliveredToday || 0,
        codCollected: payload?.stats?.codCollected || 0
      })
    } catch (err) {
      console.error('Warehouse stats load failed:', err)
    }
  }

  const handleStatusAdvance = async (order) => {
    if (statusUpdatingId === order?.id) return

    const currentStatus = normalizeStatus(order.delivery_status)
    const nextStatus = getNextStatusKey(currentStatus)
    if (!nextStatus) {
      setSuccessMessage('This pickup order is already complete.')
      setTimeout(() => setSuccessMessage(null), 3500)
      return
    }

    if (nextStatus === 'delivered') {
      setStatusUpdatingId(order.id)
      setCurrentOrderForValidation({ ...order, delivery_status: currentStatus })
      if (isCodOrder(order)) {
        setShowCashModal(true)
      } else {
        setShowOTPModal(true)
      }
      return
    }

    if (nextStatus === 'packed') {
      setPackChecklistOrder({ ...order, delivery_status: currentStatus })
      setShowPackChecklistModal(true)
      return
    }

    try {
      setError(null)
      setStatusUpdatingId(order.id)
      const res = await fetch(`${API_BASE}/api/warehouse/status/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ status: nextStatus })
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to update pickup status')

      setSuccessMessage(`${getStatusActionLabel(currentStatus)} recorded.`)
      setTimeout(() => setSuccessMessage(null), 3500)
      await loadAssignedOrders(true)
      await loadStats()
    } catch (err) {
      console.error('Warehouse status advance failed:', err)
      setError(err.message || 'Failed to update pickup status')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const handlePackChecklistSubmit = async ({ checklistSummary, notes }) => {
    if (!packChecklistOrder?.id) return

    try {
      setPackSubmitting(true)
      setError(null)

      const noteParts = []
      if (checklistSummary) noteParts.push(`Items verified: ${checklistSummary}`)
      if (notes) noteParts.push(`Notes: ${notes}`)
      const checklistNote = noteParts.join(' | ') || 'Packing checklist completed by warehouse'

      const res = await fetch(`${API_BASE}/api/warehouse/status/${packChecklistOrder.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ status: 'packed', note: checklistNote })
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to mark order as packed')

      setShowPackChecklistModal(false)
      setPackChecklistOrder(null)
      setSuccessMessage('Order marked as packed successfully.')
      setTimeout(() => setSuccessMessage(null), 3500)

      await loadAssignedOrders(true)
      await loadStats()
    } catch (err) {
      console.error('Warehouse packing checklist submit failed:', err)
      setError(err.message || 'Failed to mark order as packed')
    } finally {
      setPackSubmitting(false)
    }
  }

  const handleCashValidation = async (cashReceived, order) => {
    const receivedAmount = Number(cashReceived)
    const billAmount = Number(order.total_amount || 0)

    if (Number.isNaN(receivedAmount)) {
      return { success: false, error: 'Enter the exact amount collected from the customer' }
    }

    if (Math.abs(receivedAmount - billAmount) > 0.01) {
      return { success: false, error: `Cash received (₹${receivedAmount.toFixed(2)}) must match the invoice total (₹${billAmount.toFixed(2)})` }
    }

    setCurrentOrderForValidation({ ...order, cod_amount_received: Number(receivedAmount.toFixed(2)) })
    setShowCashModal(false)
    setShowOTPModal(true)
    return { success: true }
  }

  const handleOTPVerified = async (order) => {
    try {
      setError(null)
      const res = await fetch(`${API_BASE}/api/warehouse/mark-delivered/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ codAmountReceived: isCodOrder(order) ? Number(order.cod_amount_received || 0) : null })
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to complete pickup order')

      setShowOTPModal(false)
      setCurrentOrderForValidation(null)
      setStatusUpdatingId(null)
      setSuccessMessage('Pickup order completed successfully!')
      setTimeout(() => setSuccessMessage(null), 5000)
      setDeliveredFilter('today')

      await loadAssignedOrders(true)
      await loadStats()
    } catch (err) {
      console.error('Warehouse completion failed:', err)
      setError(err.message || 'Failed to complete pickup order')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #fffaf0 0%, #f8fafc 42%, #ffffff 100%)', paddingBottom: 48 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 48px' }}>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert error" style={{ marginBottom: 16 }}>
            {error}
            <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
          </motion.div>
        )}

        {successMessage && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert" style={{ marginBottom: 16, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>
            ✓ {successMessage}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'relative',
            background: 'rgba(255,255,255,0.92)',
            borderRadius: 24,
            padding: 28,
            color: '#0f172a',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
            marginBottom: 24,
            border: '1px solid rgba(226, 232, 240, 0.9)',
            overflow: 'hidden'
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(900px circle at 10% 10%, rgba(251, 191, 36, 0.18), transparent 55%), radial-gradient(900px circle at 90% 30%, rgba(59, 130, 246, 0.12), transparent 55%)' }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, color: '#fff', boxShadow: '0 14px 30px rgba(245, 158, 11, 0.24)' }}>
                {(warehouse?.name || 'W').charAt(0)}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: '#fffbeb', color: '#92400e', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', width: 'fit-content', border: '1px solid #fde68a' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#92400e' }} />
                  Warehouse Pickup Portal
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a' }}>
                  {warehouse?.name || 'Warehouse'}
                </div>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                  <span>📍 {warehouse?.address || 'Address unavailable'}</span>
                  {warehouse?.contact_number && <span>📞 {warehouse.contact_number}</span>}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              style={{ padding: '10px 16px', background: '#fff', color: '#111827', borderRadius: 12, border: '1px solid #e2e8f0', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)' }}
            >
              ⤴️ Logout
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 18, marginTop: 24, position: 'relative' }}>
            <StatCard label="Assigned Pickup Orders" value={stats.total} icon="📋" color="#4f46e5" />
            <StatCard label="Active Pickup Queue" value={stats.pending} icon="🏬" color="#f97316" />
            <StatCard label="Completed Today" value={stats.deliveredToday} icon="✓" color="#ec4899" />
            <StatCard label="COD Collected" value={`₹${formatCurrency(stats.codCollected)}`} icon="₹" color="#059669" />
          </div>
        </motion.div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ margin: 0, color: '#0f172a', fontSize: 20, fontWeight: 800 }}>Assigned Pickup Orders</div>
            <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>Only orders assigned to this warehouse appear here.</div>
          </div>
          <button
            onClick={() => loadAssignedOrders()}
            style={{ padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', fontWeight: 700, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)' }}
          >
            🔄 Refresh List
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>⏳ Loading pickup orders...</div>
          </div>
        ) : activeOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999', border: '1px dashed #ddd', borderRadius: 12, background: '#f9fafb' }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>📭 No pickup orders assigned</div>
            <div style={{ fontSize: 14 }}>Orders will appear here once an admin assigns this warehouse.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {activeOrders.map((order) => (
              <WarehouseOrderCard
                key={order.id}
                order={order}
                onAdvanceStatus={() => handleStatusAdvance(order)}
                onShowJourney={() => setJourneyOrder(order)}
                statusUpdating={statusUpdatingId === order.id}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 40 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: '#0f172a' }}>✓ Completed Pickup Orders</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <FilterChip label={`All (${deliveredOrders.length})`} active={deliveredFilter === 'all'} onClick={() => setDeliveredFilter('all')} />
              <FilterChip label={`Today (${deliveredTodayOrders.length})`} active={deliveredFilter === 'today'} onClick={() => setDeliveredFilter('today')} />
            </div>
          </div>

          {visibleDeliveredOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, border: '1px dashed #e5e7eb', borderRadius: 12, color: '#6b7280' }}>
              {deliveredFilter === 'today' ? 'No pickup orders completed today yet.' : 'Completed pickup orders will appear here.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {visibleDeliveredOrders.map((order) => (
                <WarehouseOrderCard
                  key={order.id}
                  order={order}
                  onAdvanceStatus={() => {}}
                  onShowJourney={() => setJourneyOrder(order)}
                  statusUpdating={false}
                />
              ))}
            </div>
          )}
        </div>

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

        {showPackChecklistModal && packChecklistOrder && (
          <PackChecklistModal
            order={packChecklistOrder}
            submitting={packSubmitting}
            onClose={() => {
              if (packSubmitting) return
              setShowPackChecklistModal(false)
              setPackChecklistOrder(null)
            }}
            onSubmit={handlePackChecklistSubmit}
          />
        )}

        {showOTPModal && currentOrderForValidation && (
          <OTPVerificationModal
            order={currentOrderForValidation}
            actorId={warehouse?.id}
            authHeaders={authHeaders}
            apiNamespace="warehouse"
            onClose={() => {
              setShowOTPModal(false)
              setCurrentOrderForValidation(null)
              setStatusUpdatingId(null)
            }}
            onVerified={handleOTPVerified}
          />
        )}

        {journeyOrder && (
          <DeliveryJourneyModal order={journeyOrder} onClose={() => setJourneyOrder(null)} />
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '22px 20px', borderRadius: 18, background: 'rgba(255,255,255,0.92)', color: '#0f172a', border: '1px solid rgba(226, 232, 240, 0.9)', boxShadow: '0 10px 20px rgba(15, 23, 42, 0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: color, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 22, boxShadow: `0 6px 14px ${color}33` }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>{value}</div>
    </motion.div>
  )
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{ padding: '6px 14px', borderRadius: 999, border: active ? '1px solid rgba(245,158,11,0.65)' : '1px solid #e5e7eb', background: active ? 'rgba(245,158,11,0.12)' : '#f9fafb', color: active ? '#b45309' : '#4b5563', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' }}
    >
      {label}
    </button>
  )
}

function PackChecklistModal({ order, submitting, onClose, onSubmit }) {
  const checklistItems = useMemo(() => {
    const parsed = parseOrderItems(order?.items)
    if (parsed.length > 0) return parsed
    return [{
      key: 'manual-verification',
      name: 'All products in this order are physically verified',
      quantity: 1,
      unitPrice: 0,
      lineTotal: 0
    }]
  }, [order?.id, order?.items])

  const [checkedMap, setCheckedMap] = useState({})
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const defaults = {}
    checklistItems.forEach((item) => {
      defaults[item.key] = false
    })
    setCheckedMap(defaults)
    setNotes('')
  }, [order?.id, checklistItems])

  const allChecked = checklistItems.length > 0 && checklistItems.every((item) => Boolean(checkedMap[item.key]))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!allChecked || submitting) return

    const checklistSummary = checklistItems
      .map((item) => `${item.name} x${item.quantity}`)
      .join(', ')

    await onSubmit({
      checklistSummary,
      notes: notes.trim()
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card"
        style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a' }}>📦 Packing Checklist</h3>
            <div style={{ marginTop: 6, fontSize: 13, color: '#64748b' }}>
              Order #{String(order?.id || '').slice(0, 8).toUpperCase()} • {order?.customer_name || 'Customer'}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ background: 'none', border: 'none', fontSize: 24, color: '#94a3b8', cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 14, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
          Check each product after physical verification, then submit to mark this order as Packed.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            {checklistItems.map((item) => (
              <label
                key={item.key}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '12px 14px',
                  background: checkedMap[item.key] ? '#f0fdf4' : '#fff',
                  cursor: submitting ? 'default' : 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(checkedMap[item.key])}
                  disabled={submitting}
                  onChange={() => setCheckedMap((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                  style={{ marginTop: 3 }}
                />
                <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Qty: {item.quantity}
                    {item.unitPrice > 0 && ` • Unit: ₹${formatCurrency(item.unitPrice)}`}
                    {item.lineTotal > 0 && ` • Total: ₹${formatCurrency(item.lineTotal)}`}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">Packing Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add notes like damaged box replaced, quantity rechecked, etc."
              rows={3}
              disabled={submitting}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#0f172a',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!allChecked || submitting}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: !allChecked || submitting ? '#cbd5e1' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff',
                fontWeight: 700,
                cursor: !allChecked || submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? 'Submitting...' : 'Submit & Mark as Packed'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function WarehouseOrderCard({ order, onAdvanceStatus, onShowJourney, statusUpdating }) {
  const normalizedStatus = normalizeStatus(order.delivery_status)
  const nextStatus = getNextStatusKey(normalizedStatus)
  const actionLabel = getStatusActionLabel(normalizedStatus)
  const items = parseOrderItems(order?.items)
  const statusConfig = {
    pending: { color: '#fbbf24', label: '⏳ Pending' },
    assigned: { color: '#3b82f6', label: '📍 Assigned' },
    packed: { color: '#38bdf8', label: '📦 Packed' },
    delivered: { color: '#10b981', label: '✅ Delivered' }
  }
  const status = statusConfig[normalizedStatus] || statusConfig.pending

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 20, borderRadius: 12, border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0b5fff', fontFamily: 'monospace' }}>
              #{String(order.id || '').slice(0, 8).toUpperCase()}
            </div>
            <span style={{ padding: '8px 14px', borderRadius: 8, background: status.color, color: '#fff', fontSize: 13, fontWeight: 700 }}>
              {status.label}
            </span>
            <span style={{ padding: '6px 12px', borderRadius: 999, background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d', fontWeight: 700, fontSize: 12 }}>
              Pickup & Drive
            </span>
          </div>

          <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
            <div style={{ color: '#555' }}>
              <strong>Customer:</strong> {order.customer_name || order.users?.full_name || 'Unknown'}
              {order.customer_email ? ` (${order.customer_email})` : ''}
            </div>
            {order.customer_phone && (
              <div style={{ color: '#555' }}>
                <strong>Phone:</strong> {order.customer_phone}
              </div>
            )}
            <div style={{ color: '#92400e', fontWeight: 600 }}>
              <strong>Pickup Window:</strong> {formatPickupWindow(order)}
            </div>
            <div style={{ color: '#555' }}>
              <strong>Items:</strong> {items.length} product{items.length !== 1 ? 's' : ''}
            </div>
            <div style={{ color: '#777', fontSize: 13 }}>
              Ordered: {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220, alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0b5fff' }}>₹{formatCurrency(order.total_amount)}</div>
            <div style={{ fontSize: 12, color: '#999' }}>Total</div>
          </div>

          <button
            onClick={onShowJourney}
            style={{ padding: '10px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontWeight: 700, color: '#334155', cursor: 'pointer', width: '100%' }}
          >
            View Journey
          </button>

          {actionLabel && (
            <motion.button
              whileHover={{ scale: statusUpdating ? 1 : 1.03 }}
              whileTap={{ scale: statusUpdating ? 1 : 0.97 }}
              onClick={onAdvanceStatus}
              disabled={statusUpdating}
              style={{ padding: '10px 16px', background: statusUpdating ? '#cbd5e1' : 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', borderRadius: 8, fontWeight: 700, border: 0, cursor: statusUpdating ? 'not-allowed' : 'pointer', fontSize: 13, width: '100%' }}
            >
              {statusUpdating ? 'Updating...' : actionLabel}
            </motion.button>
          )}

          {isCodOrder(order) && (
            <div style={{ width: '100%', fontSize: 12, color: order.cod_amount_received ? '#065f46' : '#b45309', background: order.cod_amount_received ? '#d1fae5' : '#fffbeb', border: `1px solid ${order.cod_amount_received ? '#6ee7b7' : '#fcd34d'}`, borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>
              {order.cod_amount_received
                ? `COD received: ₹${formatCurrency(order.cod_amount_received)}`
                : `Collect COD: ₹${formatCurrency(order.total_amount)}`}
            </div>
          )}

          {!nextStatus && (
            <div style={{ fontSize: 12, color: '#065f46', fontWeight: 700 }}>Pickup completed</div>
          )}
        </div>
      </div>
    </motion.div>
  )
}