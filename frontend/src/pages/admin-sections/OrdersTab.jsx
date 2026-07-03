
import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useMediaQuery } from '../../lib/useMediaQuery'

const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')

const statusStyles = {
  Pending: { bg: '#fff7e6', color: '#ad6800' },
  Approved: { bg: '#FFE4B5', color: '#FF8C00' },
  Dispatched: { bg: '#FFE4B5', color: '#FF8C00' },
  Delivered: { bg: '#f6ffed', color: '#237804' },
  Cancelled: { bg: '#fee2e2', color: '#b91c1c' }
}

export default function OrdersTab({ managerMode = false, filterStatus = null }) {
  const { adminKey } = useAdminAuth()
  const managerToken = managerMode ? localStorage.getItem('manager_token') : null

  const managerText = managerMode
    ? {
        statusFilter: 13,
        orderId: 22,
        statusBadge: 11,
        detailBase: 13,
        itemLine: 12,
        infoChip: 12,
        orderedAt: 12,
        amount: 17,
        totalLabel: 11,
        buttonText: 12,
        assignedInfo: 11
      }
    : {
        statusFilter: 14,
        orderId: 40,
        statusBadge: 12,
        detailBase: 14,
        itemLine: 13,
        infoChip: 13,
        orderedAt: 13,
        amount: 20,
        totalLabel: 12,
        buttonText: 13,
        assignedInfo: 12
      }

  const [orders, setOrders] = useState([])
  const [partners, setPartners] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [assignSelections, setAssignSelections] = useState({})
  const [warehouseSelections, setWarehouseSelections] = useState({})
  const [statusFilter, setStatusFilter] = useState(filterStatus || 'All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const autoRefreshIntervalRef = useRef(null)
  const isTablet = useMediaQuery('(max-width: 1024px)')
  const isMobile = useMediaQuery('(max-width: 640px)')

  const authHeaders = managerMode
    ? { 'x-manager-token': managerToken }
    : { 'x-admin-api-key': adminKey, 'x-admin-key': adminKey }

  useEffect(() => {
    if (managerMode && !managerToken) return
    if (!managerMode && !adminKey) return
    fetchOrders()
    fetchPartners()
    if (!managerMode) fetchWarehouses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, managerToken, managerMode])

  useEffect(() => {
    if (!filterStatus) return
    setStatusFilter(filterStatus)
  }, [filterStatus])

  useEffect(() => {
    if (managerMode && !managerToken) return
    if (!managerMode && !adminKey) return
    if (!isAutoRefresh) return

    autoRefreshIntervalRef.current = setInterval(() => {
      fetchOrders(true)
    }, 1000)

    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerMode, managerToken, adminKey, isAutoRefresh])

  async function fetchOrders(silent = false) {
    if (!silent) {
      setLoading(true)
      setError(null)
    }

    try {
      const url = managerMode
        ? `${API_BASE}/api/manager/orders`
        : `${API_BASE}/api/admin/orders`
      const res = await fetch(url, { headers: authHeaders })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch orders')
      }

      const data = await res.json()
      const normalized = Array.isArray(data) ? data : []
      setOrders(normalized)

      setAssignSelections((prev) => {
        const next = { ...prev }
        normalized.forEach((order) => {
          if (order.delivery_partner_id) {
            delete next[order.id]
          }
        })
        return next
      })
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to fetch orders')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function fetchPartners() {
    try {
      const url = managerMode
        ? `${API_BASE}/api/manager/delivery-partners`
        : `${API_BASE}/api/admin/delivery-partners`
      const res = await fetch(url, { headers: authHeaders })
      if (!res.ok) return
      const data = await res.json()
      setPartners(Array.isArray(data) ? data : [])
    } catch {
      setPartners([])
    }
  }

  async function fetchWarehouses() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/warehouses`, { headers: authHeaders })
      if (!res.ok) return
      const data = await res.json()
      setWarehouses(Array.isArray(data) ? data : [])
    } catch {
      setWarehouses([])
    }
  }

  async function handlePickupApprove(orderId) {
    const selectedWarehouse = warehouseSelections[orderId]
    if (!selectedWarehouse) {
      alert('Please select a warehouse to assign for pickup')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/approve`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup_warehouse_id: selectedWarehouse })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to approve pickup order')
      }
      await fetchOrders()
      alert('Pickup order approved! Customer notified with warehouse details.')
    } catch (err) {
      alert(err.message || 'Failed to approve pickup order')
    }
  }

  async function handleApprove(orderId) {
    try {
      const url = managerMode
        ? `${API_BASE}/api/manager/orders/${orderId}/approve`
        : `${API_BASE}/api/admin/orders/${orderId}/approve`
      const res = await fetch(url, {
        method: 'PATCH',
        headers: authHeaders
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to approve order')
      }
      await fetchOrders()
    } catch (err) {
      alert(err.message || 'Failed to approve order')
    }
  }

  async function handleCancel(orderId) {
    if (managerMode) return
    if (!window.confirm('Are you sure? This will restore stock and cancel the order.')) return

    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: authHeaders
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to cancel order')
      }
      await fetchOrders()
    } catch (err) {
      alert(err.message || 'Failed to cancel order')
    }
  }

  async function handleAssign(orderId) {
    const selected = assignSelections[orderId]
    if (!selected) {
      alert('Please select a delivery partner to assign')
      return
    }

    try {
      const url = managerMode
        ? `${API_BASE}/api/manager/orders/${orderId}/assign`
        : `${API_BASE}/api/admin/orders/${orderId}/assign`
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ delivery_partner_id: selected })
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to assign delivery partner')
      }

      await fetchOrders()
      await fetchPartners()
      alert('Order assigned to delivery partner')
    } catch (err) {
      alert(err.message || 'Assign failed')
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>Loading orders…</div>
  }

  if (error) {
    return (
      <div style={{ color: '#d32f2f', background: '#fee', border: '1px solid #fcc', padding: '16px', borderRadius: 8 }}>
        {error}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={isAutoRefresh}
              onChange={(e) => setIsAutoRefresh(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            🔄 Auto-refresh orders (every second)
          </label>
        </div>
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#999', background: '#f9f9f9', borderRadius: 12, border: '2px dashed #ddd' }}>
          📦 No orders yet.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: isTablet ? 'stretch' : 'center', justifyContent: 'space-between', flexDirection: isTablet ? 'column' : 'row', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, flex: 1, width: '100%' }}>
          {['Today Total Orders', 'Pending', 'Approved', 'Cancelled', 'Delivered'].map((status) => {
            let count = 0
            if (status === 'Today Total Orders') {
              const today = new Date()
              const yyyy = today.getFullYear()
              const mm = String(today.getMonth() + 1).padStart(2, '0')
              const dd = String(today.getDate()).padStart(2, '0')
              const todayStr = `${yyyy}-${mm}-${dd}`
              count = orders.filter((o) => o.created_at && o.created_at.startsWith(todayStr)).length
            } else {
              count = orders.filter((o) => o.status === status).length
            }

            return (
              <motion.button
                key={status}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setStatusFilter(status)}
                style={{
                  background: statusFilter === status ? (statusStyles[status]?.bg || '#e0e7ef') : '#f8fafc',
                  color: statusFilter === status ? (statusStyles[status]?.color || '#0f172a') : '#555',
                  padding: '12px 16px',
                  borderRadius: 10,
                  fontWeight: 700,
                  textAlign: 'center',
                  fontSize: managerText.statusFilter,
                  border: statusFilter === status ? '2px solid #0b5fff' : '1px solid #e5e7eb',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.15s'
                }}
              >
                {status}: {count}
              </motion.button>
            )
          })}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, marginLeft: isTablet ? 0 : 16, whiteSpace: 'nowrap', alignSelf: isTablet ? 'flex-start' : 'auto' }}>
          <input
            type="checkbox"
            checked={isAutoRefresh}
            onChange={(e) => setIsAutoRefresh(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
          🔄 Auto-refresh
        </label>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {orders
          .filter((order) => {
            if (statusFilter === 'Today Total Orders') {
              const today = new Date()
              const yyyy = today.getFullYear()
              const mm = String(today.getMonth() + 1).padStart(2, '0')
              const dd = String(today.getDate()).padStart(2, '0')
              const todayStr = `${yyyy}-${mm}-${dd}`
              return order.created_at && order.created_at.startsWith(todayStr)
            }
            return statusFilter === 'All' ? true : order.status === statusFilter
          })
          .map((order, idx) => {
            const pill = statusStyles[order.status] || { bg: '#f0f0f0', color: '#444' }
            const items = Array.isArray(order.items) ? order.items : []
            const assignedPartnerRecord = order.delivery_partner || partners.find((p) => p.id === order.delivery_partner_id || p.delivery_partner_id === order.delivery_partner_id)
            const assignedPartnerLabel = assignedPartnerRecord
              ? `${assignedPartnerRecord.name}${assignedPartnerRecord.delivery_partner_id ? ` (${assignedPartnerRecord.delivery_partner_id})` : ''}`
              : (order.delivery_partner_id ? `Partner ID ${order.delivery_partner_id}` : null)
            const isPickup = order.pickup_order === true || order.shipping_method === 'pickup_drive'
            const pickupWarehouseRecord = order.pickup_warehouse
            const fmtPickupTime = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : ''

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 20,
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: 4,
                    width: `${order.status === 'Approved' ? 50 : order.status === 'Cancelled' ? 0 : 25}%`,
                    background: pill.color,
                    transition: 'width 0.3s ease'
                  }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr auto', gap: 20, alignItems: 'start' }}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: managerText.orderId, fontWeight: 800, color: '#0b5fff', fontFamily: 'monospace' }}>
                        #{String(order.id || '').slice(0, 8)}
                      </div>
                      <span style={{ padding: '6px 12px', borderRadius: 8, background: pill.bg, color: pill.color, fontWeight: 700, fontSize: managerText.statusBadge }}>
                        {order.status}
                      </span>
                      {isPickup && (
                        <span style={{ padding: '6px 12px', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontWeight: 700, fontSize: managerText.statusBadge, border: '1px solid #fcd34d' }}>
                          🏬 Pickup &amp; Drive
                        </span>
                      )}
                      {assignedPartnerLabel && !isPickup && (
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: 999,
                          background: '#ecfdf5',
                          color: '#047857',
                          fontWeight: 700,
                          fontSize: managerText.statusBadge,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <span role="img" aria-label="assigned">🔒</span>
                          {assignedPartnerLabel}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gap: 6, fontSize: managerText.detailBase }}>
                      <div style={{ color: '#555' }}>
                        <strong>Customer:</strong> {order.users?.full_name || 'Unknown'} ({order.users?.email || 'N/A'})
                      </div>
                      <div style={{ color: '#555' }}>
                        <strong>Items:</strong> {items.length} product{items.length !== 1 ? 's' : ''}
                        {items.length > 0 && (
                          <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: '2px solid #e5e7eb' }}>
                            {items.map((item, i) => (
                              <div key={i} style={{ fontSize: managerText.itemLine, color: '#666', marginTop: 4 }}>
                                Product: {item.name || item.product_name || `ID ${item.product_id}`} • Qty: {item.quantity || 1}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {assignedPartnerLabel && !isPickup && (
                        <div style={{ color: '#047857', fontWeight: 600 }}>
                          <strong style={{ color: '#047857' }}>Delivery Partner:</strong> {assignedPartnerLabel}
                        </div>
                      )}
                      {isPickup && order.pickup_available_from && (
                        <div style={{ color: '#92400e', fontWeight: 600, background: '#fffbeb', padding: '6px 10px', borderRadius: 6, border: '1px solid #fde68a', fontSize: managerText.infoChip }}>
                          🕐 <strong>Pickup window:</strong> {fmtPickupTime(order.pickup_available_from)} – {fmtPickupTime(order.pickup_available_until)}
                        </div>
                      )}
                      {isPickup && pickupWarehouseRecord && (
                        <div style={{ color: '#065f46', fontWeight: 600, background: '#ecfdf5', padding: '6px 10px', borderRadius: 6, border: '1px solid #a7f3d0', fontSize: managerText.infoChip }}>
                          🏬 <strong>Warehouse:</strong> {pickupWarehouseRecord.name} — {pickupWarehouseRecord.address}
                          {pickupWarehouseRecord.contact_number && <span> · 📞 {pickupWarehouseRecord.contact_number}</span>}
                        </div>
                      )}
                      <div style={{ color: '#777', fontSize: managerText.orderedAt }}>
                        Ordered: {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: isTablet ? 0 : 180, alignItems: isTablet ? 'stretch' : 'flex-end' }}>
                    <div style={{ textAlign: isTablet ? 'left' : 'right' }}>
                      <div style={{ fontSize: managerText.amount, fontWeight: 800, color: '#0b5fff' }}>₹{Number(order.total_amount || 0).toFixed(2)}</div>
                      <div style={{ fontSize: managerText.totalLabel, color: '#999' }}>Total</div>
                    </div>

                    {order.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                        {isPickup && !managerMode ? (
                          <>
                            <select
                              value={warehouseSelections[order.id] || ''}
                              onChange={(e) => setWarehouseSelections({ ...warehouseSelections, [order.id]: e.target.value })}
                              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #fcd34d', background: '#fffbeb', minWidth: 0, width: '100%', fontSize: managerText.buttonText }}
                            >
                              <option value="">🏬 Select warehouse…</option>
                              {warehouses.map((w) => (
                                <option key={w.id} value={w.id}>{w.name} — {w.address}</option>
                              ))}
                            </select>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handlePickupApprove(order.id)}
                              style={{
                                padding: '10px 16px',
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                color: '#fff',
                                borderRadius: 8,
                                fontWeight: 700,
                                border: 0,
                                cursor: 'pointer',
                                fontSize: managerText.buttonText,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              🏬 Approve Pickup
                            </motion.button>
                          </>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleApprove(order.id)}
                            style={{
                              padding: '10px 16px',
                              background: 'linear-gradient(135deg, #FF8C00, #4CAF50)',
                              color: '#fff',
                              borderRadius: 8,
                              fontWeight: 700,
                              border: 0,
                              cursor: 'pointer',
                              fontSize: managerText.buttonText,
                              boxShadow: 'var(--shadow-sm)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ✓ Approve
                          </motion.button>
                        )}

                        {!managerMode && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleCancel(order.id)}
                            style={{
                              padding: '10px 16px',
                              background: 'linear-gradient(135deg, #ef4444, #f87171)',
                              color: '#fff',
                              borderRadius: 8,
                              fontWeight: 700,
                              border: 0,
                              cursor: 'pointer',
                              fontSize: managerText.buttonText,
                              boxShadow: 'var(--shadow-sm)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ✕ Cancel
                          </motion.button>
                        )}
                      </div>
                    )}

                    {order.status === 'Approved' && (
                      <div style={{ display: 'flex', gap: 8, flexDirection: 'column', alignItems: isTablet ? 'stretch' : 'flex-end' }}>
                        {isPickup ? (
                          <div style={{ fontSize: managerText.statusBadge, color: '#92400e', fontWeight: 600, background: '#fffbeb', padding: '6px 10px', borderRadius: 6, border: '1px solid #fde68a' }}>
                            🏬 Awaiting customer pickup
                          </div>
                        ) : (
                          <>
                            {!order.delivery_partner_id && (
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
                                <select
                                  value={assignSelections[order.id] || ''}
                                  onChange={(e) => setAssignSelections({ ...assignSelections, [order.id]: e.target.value })}
                                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', minWidth: 0, width: '100%', fontSize: managerText.buttonText }}
                                >
                                  <option value="">⇢ Assign to partner...</option>
                                  {partners.map((p) => (
                                    <option key={p.id} value={p.id}>{p.delivery_partner_id} • {p.name} • {p.assigned_area}</option>
                                  ))}
                                </select>

                                <button
                                  onClick={() => handleAssign(order.id)}
                                  style={{ padding: '10px 14px', background: 'linear-gradient(135deg, #FF8C00, #FFB347)', color: '#fff', borderRadius: 8, border: 0, fontWeight: 700, cursor: 'pointer', fontSize: managerText.buttonText }}
                                >
                                  Assign
                                </button>
                              </div>
                            )}
                            {order.delivery_partner_id && assignedPartnerLabel && (
                              <div style={{ fontSize: managerText.assignedInfo, color: '#047857', marginTop: 6, fontWeight: 600 }}>Assigned to {assignedPartnerLabel}</div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {order.status !== 'Approved' && order.delivery_partner_id && assignedPartnerLabel && !isPickup && (
                      <div style={{ fontSize: managerText.assignedInfo, color: '#047857', marginTop: 6, textAlign: isTablet ? 'left' : 'right', fontWeight: 600 }}>Assigned to {assignedPartnerLabel}</div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
      </div>
    </div>
  )
}
