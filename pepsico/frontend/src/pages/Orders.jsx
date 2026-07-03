import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { fetchUserOrders } from '../api/client'
import { motion } from 'framer-motion'
import { useMediaQuery } from '../lib/useMediaQuery'

const rawApiBase = (import.meta.env.VITE_API_BASE || '').trim()
const API_BASE = rawApiBase ? rawApiBase.replace(/\/$/, '') : 'http://localhost:5001'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
})

function formatCurrency(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return currencyFormatter.format(0)
  }
  return currencyFormatter.format(Math.max(numeric, 0))
}

function formatDateTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  } catch (err) {
    console.warn('Failed to format order timestamp:', err)
    return '—'
  }
}

function getEstimatedDelivery(order) {
  if (!order?.created_at) return '—'
  const createdAt = new Date(order.created_at)
  const shippingFee = Number(order.shipping_fee || 0)
  const isExpress = shippingFee > 0

  if (isExpress) {
    const sameDay = createdAt.getHours() < 12
    const target = new Date(createdAt)
    if (!sameDay) {
      target.setDate(target.getDate() + 1)
    }
    return `${target.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} by 5:00 PM`
  }

  const target = new Date(createdAt)
  target.setDate(target.getDate() + 5)
  return `${target.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} by 5:00 PM`
}

function formatPickupWindow(from, until) {
  if (!from && !until) return null
  const fmt = (d) => {
    try {
      const parsed = new Date(d)
      if (Number.isNaN(parsed.getTime())) return null
      return parsed.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
    } catch { return null }
  }
  const a = from ? fmt(from) : null
  const b = until ? fmt(until) : null
  if (a && b) return `${a} – ${b}`
  return a || b || null
}

const statusSummary = {
  Pending: { title: 'Order placed', note: 'Awaiting approval' },
  Approved: { title: 'Packed', note: 'Order is being prepared' },
  Dispatched: { title: 'In transit', note: 'Out for delivery' },
  Delivered: { title: 'Delivered', note: 'Order delivered successfully' },
  Cancelled: { title: 'Cancelled', note: 'Order was cancelled' }
}

const statusStyles = {
  Pending: {
    label: 'Pending approval',
    background: '#fef6e4',
    border: '#fbbf24',
    color: '#92400e'
  },
  Approved: {
    label: 'Approved',
    background: '#e1effe',
    border: '#2563eb',
    color: '#1d4ed8'
  },
  Dispatched: {
    label: 'Dispatched',
    background: '#e9f8ef',
    border: '#22c55e',
    color: '#166534'
  },
  Delivered: {
    label: 'Delivered',
    background: '#ecfdf5',
    border: '#10b981',
    color: '#047857'
  },
  Cancelled: {
    label: 'Cancelled',
    background: '#fef2f2',
    border: '#ef4444',
    color: '#b91c1c'
  }
}

const paymentStyles = {
  cod: {
    label: 'Cash on delivery',
    background: '#fef3c7',
    border: '#fbbf24',
    color: '#92400e'
  },
  prepaid: {
    label: 'Prepaid',
    background: '#e0f2fe',
    border: '#38bdf8',
    color: '#0369a1'
  }
}

const FESTIVE = {
  panelBg: '#fbf5ea',
  cardBg: '#fffdf8',
  border: '#ecdcc4',
  text: '#0f172a',
  muted: '#64748b',
  accent: '#ef8e29',
  accentDark: '#dd7415',
  accentSoft: '#fff1dd'
}

export default function Orders({ canApprove = false }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [notice, setNotice] = useState(null)
  const isMobile = useMediaQuery('(max-width: 768px)')

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
      try {
        setLoading(true)
        setError(null)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setError('Please login to view orders.')
          setLoading(false)
          return
        }
        // Validate user.id is a UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(user.id)) {
          setError('User ID is not valid. Please contact support.')
          setLoading(false)
          return
        }
        const data = await fetchUserOrders(user.id)
        setNotice(null)
        setOrders(Array.isArray(data) ? data : [])
        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch orders:', err)
        setError(err.message || 'Failed to fetch orders')
        setLoading(false)
      }
  }

  const statusInfo = useMemo(() => statusStyles, [])

  const filteredOrders = useMemo(() => {
    const cloned = Array.isArray(orders) ? [...orders] : []
    const narrowed = cloned.filter((o) =>
      filterStatus === 'All' ? true : o.status === filterStatus
    )
    return narrowed.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (sortBy === 'amount-high') return Number(b.total_amount || 0) - Number(a.total_amount || 0)
      if (sortBy === 'amount-low') return Number(a.total_amount || 0) - Number(b.total_amount || 0)
      return 0
    })
  }, [orders, filterStatus, sortBy])

  const statuses = useMemo(() => ['All', ...new Set(orders.map((o) => o.status))], [orders])

  const summary = useMemo(() => {
    if (!Array.isArray(orders) || orders.length === 0) {
      return {
        totalOrders: 0,
        inProgress: 0,
        delivered: 0,
        totalValue: 0,
        lastOrderOn: null
      }
    }
    const totalValue = orders.reduce((acc, item) => acc + Number(item.total_amount || 0), 0)
    const delivered = orders.filter((item) => item.status === 'Delivered').length
    const inProgress = orders.filter((item) => ['Pending', 'Approved', 'Dispatched'].includes(item.status)).length
    const sortedByDate = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return {
      totalOrders: orders.length,
      inProgress,
      delivered,
      totalValue,
      lastOrderOn: sortedByDate[0]?.created_at || null
    }
  }, [orders])

  async function downloadBill(order) {
    try {
      // Force fresh fetch (no cache) and add timestamp to bypass any intermediate caching
      const url = `${API_BASE}/api/orders/${order.id}/bill?_ts=${Date.now()}`
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to generate bill')
      
      const html = await response.text()
      // Use a unique window name so repeated opens don't reuse stale content
      const printWindow = window.open('', `_invoice_${order.id}_${Date.now()}`)
      printWindow.document.write(html)
      printWindow.document.close()
      
      setTimeout(() => {
        printWindow.print()
      }, 500)
    } catch (err) {
      console.error('Download bill failed:', err)
      setNotice({ type: 'error', message: 'Unable to prepare the invoice right now. Please try again later.' })
    }
  }

  async function updateOrderStatus(orderId, newStatus) {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('manager_token');
      const isManager = !!token;
      const url = isManager
        ? `${API_BASE}/api/manager/orders/${orderId}/status`
        : `${API_BASE}/api/admin/orders/${orderId}/status`;
      const headers = { 'Content-Type': 'application/json' };
      if (isManager) headers['x-manager-token'] = token;
      const res = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order status');
      await loadOrders();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
      <div style={{ color: '#6b7280', fontSize: 14 }}>Loading orders…</div>
    </div>
  )

  if (error) return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        padding: 24,
        background: '#fef2f2',
        color: '#d32f2f',
        borderRadius: 12,
        border: '1px solid #fecaca',
        fontSize: 14
      }}
    >
      {error}
    </motion.div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: FESTIVE.panelBg,
          color: FESTIVE.text,
          borderRadius: 16,
          padding: isMobile ? '24px 20px' : '28px 32px',
          border: `1px solid ${FESTIVE.border}`,
          boxShadow: '0 12px 30px rgba(57, 44, 27, 0.06)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? 22 : 26, fontWeight: 700, fontFamily: '"Georgia", "Times New Roman", serif' }}>Orders & Billing</h2>
            <p style={{ margin: '8px 0 0 0', fontSize: 13, color: FESTIVE.muted, maxWidth: 520 }}>
              Monitor your order activity, track shipments, and download invoices in one streamlined workspace.
            </p>
          </div>
          <Link
            to="/dashboard/products"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 10,
              background: FESTIVE.accent,
              color: '#fff',
              fontWeight: 600,
              fontSize: 12,
              textDecoration: 'none',
              boxShadow: '0 10px 24px rgba(239,142,41,0.28)'
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            New Order
          </Link>
        </div>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16
        }}
      >
        {[
          { label: 'Total orders', value: summary.totalOrders.toString(), accent: '#6366f1', icon: '🛒' },
          { label: 'In progress', value: summary.inProgress.toString(), accent: '#f59e0b', icon: '🕘' },
          { label: 'Delivered', value: summary.delivered.toString(), accent: '#10b981', icon: '✅' },
          {
            label: 'Lifetime spend',
            value: formatCurrency(summary.totalValue),
            accent: '#0f172a',
            icon: '💳'
          },
          summary.lastOrderOn
            ? {
                label: 'Last order',
                value: formatDateTime(summary.lastOrderOn),
                accent: '#3b82f6',
                icon: '📅'
              }
            : null
        ]
          .filter(Boolean)
          .map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.04 }}
              style={{
                background: FESTIVE.cardBg,
                border: `1px solid ${card.accent}20`,
                borderRadius: 14,
                padding: isMobile ? 16 : 20,
                boxShadow: '0 12px 24px rgba(57, 44, 27, 0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                display: 'grid',
                placeItems: 'center',
                background: `${card.accent}14`,
                color: card.accent,
                fontSize: 16
              }}>
                {card.icon}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
                  {card.label}
                </span>
                <span style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: card.accent }}>
                  {card.value}
                </span>
              </div>
            </motion.div>
          ))}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        style={{
          background: FESTIVE.panelBg,
          borderRadius: 16,
          border: `1px solid ${FESTIVE.border}`,
          padding: isMobile ? 16 : 24,
          boxShadow: '0 12px 24px rgba(57, 44, 27, 0.05)'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#1f2937', fontSize: 13 }}>
              Status filter
            </label>
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${FESTIVE.border}`,
                borderRadius: 10,
                fontSize: 13,
                fontFamily: 'inherit',
                background: '#fff'
              }}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#1f2937', fontSize: 13 }}>
              Sort by
            </label>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${FESTIVE.border}`,
                borderRadius: 10,
                fontSize: 13,
                fontFamily: 'inherit',
                background: '#fff'
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount-high">Amount (high to low)</option>
              <option value="amount-low">Amount (low to high)</option>
            </select>
          </div>
          <div style={{ alignSelf: 'end' }}>
            <div style={{
              padding: '10px 14px',
              background: '#fff',
              borderRadius: 10,
              border: `1px solid ${FESTIVE.border}`,
              fontWeight: 600,
              color: FESTIVE.text,
              fontSize: 13,
              textAlign: 'center'
            }}>
              {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        {notice && (
          <div
            style={{
              marginTop: 16,
              padding: '12px 14px',
              borderRadius: 10,
              border: notice.type === 'error' ? '1px solid #fecaca' : '1px solid #bfdbfe',
              background: notice.type === 'error' ? '#fef2f2' : '#eff6ff',
              color: notice.type === 'error' ? '#b91c1c' : '#1d4ed8',
              fontSize: 13
            }}
          >
            {notice.message}
          </div>
        )}
      </motion.section>

      {filteredOrders.length > 0 ? (
        <div style={{ display: 'grid', gap: 20 }}>
          {filteredOrders.map((order, idx) => {
            const palette = statusInfo[order.status] || {
              label: order.status || 'Status pending',
              background: '#f3f4f6',
              border: '#cbd5f5',
              color: '#1f2937'
            }
            const items = Array.isArray(order.items) ? order.items : []
            const singleProduct = Array.isArray(order.products)
              ? order.products[0] || null
              : order.products || null
            const canDownloadBill = ['Approved', 'Dispatched', 'Delivered'].includes(order.status)
            const paymentKey = (order.payment_method || 'prepaid').toLowerCase()
            const paymentPalette = paymentStyles[paymentKey] || paymentStyles.prepaid
            const amountNumber = Number(order.total_amount ?? 0)
            const formattedAmount = formatCurrency(amountNumber)
            const paymentStatusLabel = paymentPalette.label
            const isPickupOrder = Boolean(order.pickup_order) || order.shipping_method === 'pickup_drive'
            const pickupWarehouse = order.pickup_warehouse || null
            const pickupWindow = isPickupOrder ? formatPickupWindow(order.pickup_available_from, order.pickup_available_until) : null
            const deliveryEstimate = getEstimatedDelivery(order)
            const statusDetail = statusSummary[order.status] || { title: 'Order update', note: 'Status updated' }

            return (
              <motion.article
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * idx }}
                whileHover={{ y: -2, boxShadow: '0 16px 32px rgba(15,23,42,0.08)' }}
                style={{
                  background: FESTIVE.cardBg,
                  borderRadius: 16,
                  border: `1px solid ${FESTIVE.border}`,
                  padding: isMobile ? 18 : 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>Order ID</div>
                    <div style={{ fontSize: isMobile ? 17 : 18, fontWeight: 700, color: '#0f172a' }}>#{(order.id || '').slice(0, 10).toUpperCase()}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>{formatDateTime(order.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                      <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>Order value</div>
                      <div style={{ fontSize: isMobile ? 17 : 19, fontWeight: 700, color: '#0f172a' }}>{formattedAmount}</div>
                    </div>
                    <span
                      style={{
                        padding: '6px 14px',
                        borderRadius: 999,
                        border: `1px solid ${palette.border}`,
                        background: palette.background,
                        color: palette.color,
                        fontWeight: 600,
                        fontSize: 13
                      }}
                    >
                      {palette.label}
                    </span>
                    <span
                      style={{
                        padding: '6px 14px',
                        borderRadius: 999,
                        border: `1px solid ${paymentPalette.border}`,
                        background: paymentPalette.background,
                        color: paymentPalette.color,
                        fontWeight: 600,
                        fontSize: 13
                      }}
                    >
                      {paymentStatusLabel}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr', gap: 16 }}>
                  <div style={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    padding: 16,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center'
                  }}>
                    <div style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: palette.background,
                      color: palette.color,
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700
                    }}>
                      {order.status === 'Approved' ? '✓' : order.status === 'Dispatched' ? '↗' : order.status === 'Delivered' ? '✔' : '•'}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>Current status</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{statusDetail.title}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{statusDetail.note}</div>
                      {isPickupOrder
                        ? (pickupWindow && <div style={{ fontSize: 12, color: '#92400e', marginTop: 8, fontWeight: 600 }}>🕐 Pickup Window: {pickupWindow}</div>)
                        : <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 8, fontWeight: 600 }}>Estimated delivery: {deliveryEstimate}</div>
                      }
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center', alignItems: isMobile ? 'flex-start' : 'flex-end' }}>
                    {canDownloadBill && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => downloadBill(order)}
                        style={{
                          padding: '10px 16px',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          color: '#1f2937',
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        Invoice
                      </motion.button>
                    )}
                    <Link
                      to={`/dashboard/track-order?id=${order.id}`}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        background: FESTIVE.accent,
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 12,
                        textDecoration: 'none',
                        textAlign: 'center',
                        boxShadow: '0 10px 24px rgba(239,142,41,0.28)'
                      }}
                    >
                      View Full Tracking
                    </Link>
                  </div>
                </div>

                {isPickupOrder && (
                  <div style={{
                    borderRadius: 12,
                    border: '1px solid #fde68a',
                    background: '#fffbeb',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>🏬 Pickup &amp; Drive Details</div>
                    {pickupWindow ? (
                      <div style={{ fontSize: 13, color: '#78350f' }}>
                        <strong>🕐 Pickup Window:</strong> {pickupWindow}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#92400e' }}>Pickup window will be confirmed after order approval.</div>
                    )}
                    {pickupWarehouse ? (
                      <>
                        <div style={{ fontSize: 13, color: '#78350f' }}>
                          <strong>🏬 Warehouse:</strong> {pickupWarehouse.name}{pickupWarehouse.address ? ` — ${pickupWarehouse.address}` : ''}
                        </div>
                        {pickupWarehouse.contact_number && (
                          <div style={{ fontSize: 13, color: '#78350f' }}>
                            <strong>📞 Phone:</strong> {pickupWarehouse.contact_number}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: '#92400e' }}>Warehouse will be assigned upon admin approval.</div>
                    )}
                  </div>
                )}

                {(items.length > 0 || singleProduct) && (
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'grid', gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>Order breakdown</div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 12
                    }}>
                      {items.length > 0
                        ? items.map((item, index) => {
                            const label = item.name || item.product_name || singleProduct?.name || ''
                            const quantity = item.quantity || 1
                            const price = Number(item.price || singleProduct?.price || 0)
                            const lineTotal = price ? formatCurrency(price * quantity) : null
                            return (
                              <div
                                key={`${order.id}-${index}`}
                                style={{
                                  padding: 12,
                                  borderRadius: 12,
                                  border: '1px solid #e2e8f0',
                                  background: '#f8fafc',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 6
                                }}
                              >
                                <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{label}</span>
                                <span style={{ fontSize: 13, color: '#475569' }}>Quantity: {quantity}</span>
                                {lineTotal && (
                                  <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>Line total: {lineTotal}</span>
                                )}
                              </div>
                            )
                          })
                        : (
                          <div
                            style={{
                              padding: 12,
                              borderRadius: 12,
                              border: '1px solid #e2e8f0',
                              background: '#f8fafc'
                            }}
                          >
                            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>
                              {singleProduct?.name || 'Single product order'}
                            </span>
                            {singleProduct?.price && (
                              <span style={{ display: 'block', marginTop: 4, fontSize: 13, color: '#475569' }}>
                                Unit price: {formatCurrency(singleProduct.price)}
                              </span>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {order.status === 'Pending' && canApprove && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                    <button
                      onClick={() => updateOrderStatus(order.id, 'Approved')}
                      style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateOrderStatus(order.id, 'Rejected')}
                      style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Reject
                    </button>
                  </div>
                )}
                <div style={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  padding: 12,
                  fontSize: 13,
                  color: '#475569'
                }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Payment details</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <span>Method: <strong style={{ color: '#0f172a' }}>{paymentKey === 'cod' ? 'Cash on delivery' : 'Prepaid (online)'}</strong></span>
                    <span>Amount billed: <strong style={{ color: '#1d4ed8' }}>{formattedAmount}</strong></span>
                  </div>
                </div>
              </motion.article>
            )
          })}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            borderRadius: 16,
            border: `1px solid ${FESTIVE.border}`,
            padding: isMobile ? '48px 18px' : '64px 24px',
            textAlign: 'center',
            background: FESTIVE.cardBg,
            color: '#475569'
          }}
        >
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>No orders yet</h3>
          <p style={{ margin: '12px 0 0 0', fontSize: 13 }}>Once you place an order it will appear here with full tracking details.</p>
        </motion.div>
      )}
    </div>
  )
}
