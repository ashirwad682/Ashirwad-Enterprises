import React, { useState, useEffect } from 'react'
import {
  adminInitiateRefund,
  fetchAdminRefundsHistory,
  adminUpdateRefundStatus
} from '../../api/client'
import { motion, AnimatePresence } from 'framer-motion'

const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')

export default function RefundManagementTab({ adminKey }) {
  const [activeSubTab, setActiveSubTab] = useState('orders') // 'orders' | 'history'

  // Common UI states
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Orders State (for refund initiation selection)
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)

  // Refund Form State
  const [refundForm, setRefundForm] = useState({
    amount: '',
    remarks: ''
  })
  const [initiating, setInitiating] = useState(false)

  // History State
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all') // 'all' | 'pending' | 'processing' | 'completed' | 'failed'
  const [activeHistoryAction, setActiveHistoryAction] = useState(null) // { refund, action: 'complete' | 'fail' | 'processing' }
  const [actionForm, setActionForm] = useState({ transaction_id: '', remarks: '' })

  // Bank Accounts mapping
  const [bankAccounts, setBankAccounts] = useState([])

  useEffect(() => {
    loadBankAccounts()
    if (activeSubTab === 'orders') {
      loadOrders()
    } else if (activeSubTab === 'history') {
      loadHistory()
    }
  }, [activeSubTab])

  const loadBankAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/bank-accounts`, {
        headers: { 'x-admin-api-key': adminKey }
      })
      if (res.ok) {
        const data = await res.json()
        setBankAccounts(data || [])
      }
    } catch (err) {
      console.error('Failed to load bank accounts', err)
    }
  }

  const loadOrders = async () => {
    try {
      setLoadingOrders(true)
      setError('')
      const res = await fetch(`${API_BASE}/api/admin/orders`, {
        headers: { 'x-admin-api-key': adminKey }
      })
      if (!res.ok) throw new Error('Failed to fetch orders list')
      const data = await res.json()
      setOrders(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingOrders(false)
    }
  }

  const loadHistory = async () => {
    try {
      setLoadingHistory(true)
      setError('')
      const data = await fetchAdminRefundsHistory(adminKey)
      setHistory(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Get Approved Bank for customer (user)
  const getUserApprovedBank = (userId) => {
    return bankAccounts.find(account => account.user_id === userId && account.approval_status === 'approved')
  }

  // Handle Initiate Refund
  const handleInitiateRefundSubmit = async (e) => {
    e.preventDefault()
    if (!selectedOrder) return

    try {
      setInitiating(true)
      setError('')
      setSuccess('')

      const approvedBank = getUserApprovedBank(selectedOrder.user_id)
      if (!approvedBank) {
        throw new Error('This customer does not have an Admin-approved bank account. Refund cannot be initiated.')
      }

      const refundAmount = parseFloat(refundForm.amount)
      if (isNaN(refundAmount) || refundAmount <= 0) {
        throw new Error('Please enter a valid positive refund amount.')
      }

      if (refundAmount > parseFloat(selectedOrder.total_amount)) {
        throw new Error(`Refund amount cannot exceed order total amount of ${formatCurrency(selectedOrder.total_amount)}.`)
      }

      await adminInitiateRefund(adminKey, selectedOrder.id, refundAmount, refundForm.remarks)

      setSuccess(`Refund of ${formatCurrency(refundAmount)} initiated successfully for Order ID: ${selectedOrder.id}`)
      setSelectedOrder(null)
      setRefundForm({ amount: '', remarks: '' })
      setActiveSubTab('history')
    } catch (err) {
      setError(err.message)
    } finally {
      setInitiating(false)
    }
  }

  // Handle History Update
  const handleHistoryActionSubmit = async (e) => {
    e.preventDefault()
    try {
      setError('')
      setSuccess('')
      const { refund, action } = activeHistoryAction
      let status = 'pending'
      if (action === 'processing') status = 'processing'
      else if (action === 'complete') status = 'completed'
      else if (action === 'fail') status = 'failed'

      await adminUpdateRefundStatus(
        adminKey,
        refund.id,
        status,
        actionForm.transaction_id,
        actionForm.remarks
      )

      setSuccess(`Refund payout status updated successfully`)
      setActiveHistoryAction(null)
      setActionForm({ transaction_id: '', remarks: '' })
      loadHistory()
    } catch (err) {
      setError(err.message)
    }
  }

  // Filter orders by search query
  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase().trim()
    return (
      String(order.id).toLowerCase().includes(query) ||
      String(order.email || order.user?.email || '').toLowerCase().includes(query) ||
      String(order.full_name || order.user?.full_name || '').toLowerCase().includes(query) ||
      String(order.transaction_id || '').toLowerCase().includes(query)
    )
  })

  const filteredHistory = history.filter(row => {
    if (historyFilter === 'all') return true
    return row.payment_status === historyFilter
  })

  // Format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0)
  }

  // Mask Account Number
  const maskAccountNumber = (accountNumber) => {
    if (!accountNumber) return 'N/A'
    const clean = String(accountNumber).trim()
    if (clean.length < 4) return clean
    return 'XXXX-XXXX-' + clean.slice(-4)
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#1f2937', padding: '24px', background: '#f9fafb', borderRadius: '16px', minHeight: '80vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            User Refund Management
          </h2>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Initiate order refunds to verified user bank accounts and track settlement history.
          </p>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', background: '#f3f4f6', padding: '4px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          {[
            { id: 'orders', label: '🔍 Orders Lookup', icon: '🔍' },
            { id: 'history', label: '🔄 Refund Logs', icon: '🔄' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id)
                setError('')
                setSuccess('')
                setSelectedOrder(null)
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                background: activeSubTab === tab.id ? '#ffffff' : 'transparent',
                color: activeSubTab === tab.id ? '#1e3a8a' : '#4b5563',
                boxShadow: activeSubTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #fca5a5' }}>
          <span>⚠️</span> {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', background: '#dcfce7', color: '#15803d', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #86efac' }}>
          <span>✅</span> {success}
        </div>
      )}

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        {activeSubTab === 'orders' && (
          <motion.div key="orders" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
              
              {/* Search Bar */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '18px' }}>🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Order ID, Customer Name, Email, or Transaction ID..."
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Order Grid */}
              <div style={{ background: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Select Order to Initiate Refund</h3>
                </div>

                {loadingOrders ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading orders...</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                          <th style={{ padding: '12px 20px', fontWeight: '600' }}>Order ID</th>
                          <th style={{ padding: '12px 20px', fontWeight: '600' }}>Customer</th>
                          <th style={{ padding: '12px 20px', fontWeight: '600' }}>Date</th>
                          <th style={{ padding: '12px 20px', fontWeight: '600' }}>Payment Mode</th>
                          <th style={{ padding: '12px 20px', fontWeight: '600' }}>Total Amount</th>
                          <th style={{ padding: '12px 20px', fontWeight: '600' }}>Status</th>
                          <th style={{ padding: '12px 20px', fontWeight: '600' }}>Approved Bank</th>
                          <th style={{ padding: '12px 20px', fontWeight: '600', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.slice(0, 20).map(order => {
                          const approvedBank = getUserApprovedBank(order.user_id)
                          return (
                            <tr key={order.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '16px 20px', fontWeight: '700', color: '#111827', fontFamily: 'monospace' }}>{order.id.slice(0, 8)}...</td>
                              <td style={{ padding: '16px 20px' }}>
                                <div style={{ fontWeight: '600' }}>{order.full_name || order.user?.full_name || 'N/A'}</div>
                                <div style={{ fontSize: '11px', color: '#6b7280' }}>{order.email || order.user?.email || 'N/A'}</div>
                              </td>
                              <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                                {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                              </td>
                              <td style={{ padding: '16px 20px', fontWeight: '600', color: '#4b5563' }}>
                                {order.payment_method || 'COD'}
                              </td>
                              <td style={{ padding: '16px 20px', fontWeight: '700', color: '#1f2937' }}>
                                {formatCurrency(order.total_amount)}
                              </td>
                              <td style={{ padding: '16px 20px' }}>
                                <span style={{
                                  background: order.status === 'Delivered' ? '#dcfce7' : '#fef3c7',
                                  color: order.status === 'Delivered' ? '#166534' : '#92400e',
                                  padding: '4px 8px',
                                  borderRadius: '999px',
                                  fontSize: '11px',
                                  fontWeight: '700'
                                }}>
                                  {order.status}
                                </span>
                              </td>
                              <td style={{ padding: '16px 20px' }}>
                                {approvedBank ? (
                                  <div style={{ color: '#16a34a', fontSize: '12px' }}>
                                    ✓ {approvedBank.bank_name} ({maskAccountNumber(approvedBank.account_number)})
                                  </div>
                                ) : (
                                  <span style={{ color: '#d97706', fontSize: '12px', fontWeight: '600' }}>
                                    ⚠️ No Approved Bank
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                <button
                                  disabled={!approvedBank}
                                  onClick={() => {
                                    setSelectedOrder(order)
                                    setRefundForm({ amount: order.total_amount, remarks: '' })
                                  }}
                                  style={{
                                    background: approvedBank ? '#ef4444' : '#9ca3af',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    cursor: approvedBank ? 'pointer' : 'not-allowed',
                                    fontWeight: '600'
                                  }}
                                >
                                  🔄 Refund
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                        {filteredOrders.length === 0 && (
                          <tr>
                            <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No matching orders found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div style={{ background: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Refund Settlement Ledger</h3>
                
                {/* Filter */}
                <div style={{ display: 'flex', gap: '8px', background: '#f3f4f6', padding: '2px', borderRadius: '6px' }}>
                  {['all', 'pending', 'processing', 'completed', 'failed'].map(f => (
                    <button
                      key={f}
                      onClick={() => setHistoryFilter(f)}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'capitalize',
                        cursor: 'pointer',
                        background: historyFilter === f ? '#ffffff' : 'transparent',
                        color: historyFilter === f ? '#1f2937' : '#4b5563',
                        boxShadow: historyFilter === f ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {loadingHistory ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading refund logs...</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Customer</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Order ID</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Refund Date</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Refunded Amount</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Bank Destination</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Status</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Transaction Reference</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map(row => {
                        const bank = row.bank_accounts
                        const statusColors = {
                          pending: { bg: '#fffbeb', text: '#d97706' },
                          processing: { bg: '#eff6ff', text: '#2563eb' },
                          completed: { bg: '#ecfdf5', text: '#059669' },
                          failed: { bg: '#fef2f2', text: '#dc2626' }
                        }
                        const colors = statusColors[row.payment_status] || { bg: '#f3f4f6', text: '#374151' }

                        return (
                          <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '16px 20px', fontWeight: '600', color: '#111827' }}>
                              <div>{row.users?.full_name || 'N/A'}</div>
                              <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>{row.users?.email || 'N/A'}</div>
                            </td>
                            <td style={{ padding: '16px 20px', fontFamily: 'monospace' }}>
                              {row.order_id ? row.order_id.slice(0, 8) + '...' : 'N/A'}
                            </td>
                            <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                              {row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td style={{ padding: '16px 20px', fontWeight: '700', color: '#b91c1c' }}>
                              {formatCurrency(row.amount)}
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              {bank ? (
                                <div style={{ fontSize: '11px', color: '#4b5563' }}>
                                  <div><strong>{bank.bank_name}</strong></div>
                                  <div>Acc: {maskAccountNumber(bank.account_number)}</div>
                                  <div>IFSC: {bank.ifsc_code}</div>
                                </div>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>No bank info</span>
                              )}
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', background: colors.bg, color: colors.text }}>
                                {row.payment_status}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', maxWidth: '180px', wordBreak: 'break-all' }}>
                              {row.transaction_id ? (
                                <div style={{ fontSize: '11px' }}>
                                  <div><strong>Ref:</strong> {row.transaction_id}</div>
                                  <div style={{ color: '#9ca3af' }}>Date: {row.payment_date ? new Date(row.payment_date).toLocaleDateString() : 'N/A'}</div>
                                </div>
                              ) : (
                                <span style={{ color: '#9ca3af', fontSize: '11px' }}>No reference</span>
                              )}
                              {row.remarks && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', fontStyle: 'italic' }}>"{row.remarks}"</div>}
                            </td>
                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                              {(row.payment_status === 'pending' || row.payment_status === 'processing') ? (
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                  {row.payment_status === 'pending' && (
                                    <button
                                      onClick={() => {
                                        setActiveHistoryAction({ refund: row, action: 'processing' })
                                      }}
                                      style={{ background: '#3b82f6', color: '#ffffff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                      ⏳ Process
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setActiveHistoryAction({ refund: row, action: 'complete' })
                                    }}
                                    style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                                  >
                                    ✓ Complete
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveHistoryAction({ refund: row, action: 'fail' })
                                    }}
                                    style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                                  >
                                    ✗ Fail
                                  </button>
                                </div>
                              ) : (
                                <span style={{ color: '#9ca3af', fontSize: '11px' }}>Locked</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {filteredHistory.length === 0 && (
                        <tr>
                          <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No refunds in history matching selection.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 1: Refund Setup form */}
      {selectedOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#111827' }}>
              Setup Order Refund
            </h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
              Order ID: <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{selectedOrder.id}</span>
            </p>

            <form onSubmit={handleInitiateRefundSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#4b5563' }}>Refund Amount (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedOrder.total_amount}
                  value={refundForm.amount}
                  onChange={(e) => setRefundForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  placeholder={`Max amount ${formatCurrency(selectedOrder.total_amount)}`}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                />
                <span style={{ fontSize: '11px', color: '#6b7280' }}>Order Total Value: {formatCurrency(selectedOrder.total_amount)}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#4b5563' }}>Remarks / Refund Reason</label>
                <input
                  type="text"
                  value={refundForm.remarks}
                  onChange={(e) => setRefundForm(prev => ({ ...prev, remarks: e.target.value }))}
                  required
                  placeholder="e.g. Double payment / Order cancelled by customer"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                />
              </div>

              {/* Destination Bank Account Verification */}
              {(() => {
                const bank = getUserApprovedBank(selectedOrder.user_id)
                return (
                  <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #dcfce7', fontSize: '12px' }}>
                    <div style={{ fontWeight: 'bold', color: '#166534', marginBottom: '4px' }}>Destination Account (Approved Bank):</div>
                    {bank ? (
                      <div style={{ color: '#14532d' }}>
                        <div><strong>Holder:</strong> {bank.account_holder_name}</div>
                        <div><strong>Bank:</strong> {bank.bank_name}</div>
                        <div><strong>Account:</strong> {maskAccountNumber(bank.account_number)}</div>
                        <div><strong>IFSC:</strong> {bank.ifsc_code}</div>
                      </div>
                    ) : (
                      <div style={{ color: '#b91c1c', fontWeight: 'bold' }}>
                        ⚠️ Warning: Customer has no verified/approved bank account!
                      </div>
                    )}
                  </div>
                )
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  style={{ background: '#f3f4f6', border: 'none', padding: '8px 16px', borderRadius: '6px', color: '#4b5563', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={initiating || !getUserApprovedBank(selectedOrder.user_id)}
                  style={{
                    background: '#1e3a8a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: (initiating || !getUserApprovedBank(selectedOrder.user_id)) ? 'not-allowed' : 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {initiating ? 'Initiating...' : '🚀 Initiate Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Complete Payout Status Form */}
      {activeHistoryAction && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#111827' }}>
              {activeHistoryAction.action === 'complete' && '💳 Record Refund Success'}
              {activeHistoryAction.action === 'processing' && '⏳ Mark Refund Processing'}
              {activeHistoryAction.action === 'fail' && '❌ Record Refund Failure'}
            </h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
              Refund value: <strong>{formatCurrency(activeHistoryAction.refund.amount)}</strong>
            </p>

            <form onSubmit={handleHistoryActionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {activeHistoryAction.action === 'complete' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#4b5563' }}>Bank Transaction ID / Ref</label>
                  <input
                    type="text"
                    value={actionForm.transaction_id}
                    onChange={(e) => setActionForm(prev => ({ ...prev, transaction_id: e.target.value }))}
                    required
                    placeholder="e.g. RFD9872938172"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#4b5563' }}>
                  {activeHistoryAction.action === 'complete' ? 'Remarks (Optional)' : 'Remarks / Reason'}
                </label>
                <input
                  type="text"
                  value={actionForm.remarks}
                  onChange={(e) => setActionForm(prev => ({ ...prev, remarks: e.target.value }))}
                  required={activeHistoryAction.action === 'fail'}
                  placeholder={activeHistoryAction.action === 'complete' ? 'Refund processed successfully' : 'Enter memo / explanation'}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveHistoryAction(null)
                    setActionForm({ transaction_id: '', remarks: '' })
                  }}
                  style={{ background: '#f3f4f6', border: 'none', padding: '8px 16px', borderRadius: '6px', color: '#4b5563', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: activeHistoryAction.action === 'complete' ? '#10b981' : activeHistoryAction.action === 'processing' ? '#3b82f6' : '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
