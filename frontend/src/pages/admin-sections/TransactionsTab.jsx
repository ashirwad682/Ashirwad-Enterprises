import React, { useState, useEffect, useMemo, useContext } from 'react'
import { motion } from 'framer-motion'
import { AdminAuthContext } from '../../context/AdminAuthContext'

const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')

// Safe hook — returns { adminKey: null } when used outside AdminAuthProvider (e.g., ManagerDashboard)
function useSafeAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  return ctx || { adminKey: null }
}

// ─── Transaction Revenue Sub-tab ──────────────────────────────────────────────
function TransactionRevenueContent({ managerMode }) {
  const { adminKey } = useSafeAdminAuth()
  const managerToken = localStorage.getItem('manager_token')
  const apiHeaders = managerMode ? { 'x-manager-token': managerToken } : { 'x-admin-api-key': adminKey }
  const apiPrefix = managerMode ? '/api/manager' : '/api/admin'

  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState({ totalCount: 0, totalAmount: 0, prepaidCount: 0, prepaidAmount: 0, codCount: 0, codAmount: 0, byStatus: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const todayLocal = new Date().toLocaleDateString('en-CA')
  const [filters, setFilters] = useState({ startDate: todayLocal, endDate: todayLocal, mode: 'all', status: 'all' })
  const [password, setPassword] = useState('')
  const [managerPassword, setManagerPassword] = useState('')
  const [gateError, setGateError] = useState(null)
  const [customUnlocked, setCustomUnlocked] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const pageSize = 10

  function isHistoricalDateRange(startDate, endDate) {
    const effectiveStart = startDate || todayLocal
    const effectiveEnd = endDate || todayLocal
    return effectiveStart < todayLocal || effectiveEnd < todayLocal
  }

  const managerNeedsPastAccessPassword = managerMode && isHistoricalDateRange(filters.startDate, filters.endDate)

  useEffect(() => {
    if (managerMode && !managerToken) return
    if (!managerMode && !adminKey) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, managerToken, managerMode])

  useEffect(() => {
    if (!managerMode || managerNeedsPastAccessPassword) return
    setGateError(null)
    setManagerPassword('')
  }, [managerMode, managerNeedsPastAccessPassword])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const effectiveStart = filters.startDate || todayLocal
      const effectiveEnd = filters.endDate || todayLocal
      const params = new URLSearchParams()
      params.append('startDate', effectiveStart)
      params.append('endDate', effectiveEnd)
      if (filters.mode && filters.mode !== 'all') params.append('mode', filters.mode)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)

      const [txRes, sumRes] = await Promise.all([
        fetch(`${API_BASE}${apiPrefix}/transactions?${params.toString()}`, { headers: apiHeaders }),
        fetch(`${API_BASE}${apiPrefix}/transactions/summary?${params.toString()}`, { headers: apiHeaders })
      ])
      if (!txRes.ok) { const b = await txRes.json().catch(() => ({})); throw new Error(b.error || 'Failed to fetch transactions') }
      if (!sumRes.ok) { const b = await sumRes.json().catch(() => ({})); throw new Error(b.error || 'Failed to fetch summary') }
      const [tx, sum] = await Promise.all([txRes.json(), sumRes.json()])
      setTransactions(Array.isArray(tx) ? tx : [])
      setSummary(sum || {})
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleFilterChange(field, value) { setFilters((f) => ({ ...f, [field]: value })) }

  async function verifyManagerPassword() {
    const enteredPassword = String(managerPassword ?? '')
    if (!enteredPassword) {
      throw new Error('Enter the manager password to view yesterday or older transactions.')
    }

    const res = await fetch(`${API_BASE}/api/manager/verify-password`, {
      method: 'POST',
      headers: { ...apiHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: enteredPassword })
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Invalid manager password')
    }
  }

  async function handleApplyFilters() {
    if (!filters.startDate || !filters.endDate) { setGateError('Select start and end date to view transactions.'); return }
    const isCustomRange = filters.startDate !== filters.endDate
    if (managerNeedsPastAccessPassword) {
      try {
        await verifyManagerPassword()
      } catch (err) {
        setGateError(err.message || 'Manager password verification failed.')
        return
      }
    }
    if (!managerMode && isCustomRange && password !== 'ASHI2005') {
      setGateError('Enter the admin password to unlock historical transactions.')
      setCustomUnlocked(false)
      return
    }
    setGateError(null)
    setCustomUnlocked(true)
    setPage(1)
    fetchData()
  }

  async function handleDownloadPdf() {
    try {
      if (!filters.startDate || !filters.endDate) { alert('Select start and end date first.'); return }
      const isCustomRange = filters.startDate !== filters.endDate
      if (isCustomRange && !customUnlocked) { alert('Enter the admin password (ASHI2005) and apply filters before downloading.'); return }
      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.mode && filters.mode !== 'all') params.append('mode', filters.mode)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      const res = await fetch(`${API_BASE}/api/admin/transactions/report?${params.toString()}`, { headers: { 'x-admin-api-key': adminKey } })
      if (!res.ok) throw new Error('Failed to generate PDF')
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `transactions-${(filters.startDate || new Date().toISOString().slice(0, 10))}.pdf`
      document.body.appendChild(link); link.click(); link.remove()
    } catch (err) { alert(err.message) }
  }

  const filteredTransactions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const base = Array.isArray(transactions) ? transactions : []
    const filtered = term
      ? base.filter((t) => [String(t.id || ''), String(t.order_id || ''), String(t.users?.full_name || ''), String(t.mode || ''), String(t.status || ''), String(t.amount || '')].join(' ').toLowerCase().includes(term))
      : base
    return [...filtered].sort((a, b) => {
      if (sortBy === 'amount') { const d = Number(a.amount || 0) - Number(b.amount || 0); return sortDir === 'asc' ? d : -d }
      const d = new Date(a.created_at) - new Date(b.created_at)
      return sortDir === 'asc' ? d : -d
    })
  }, [transactions, searchTerm, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedTransactions = useMemo(() => filteredTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredTransactions, currentPage])

  const { codDisplayAmount, prepaidDisplayAmount } = useMemo(() => {
    const rows = Array.isArray(transactions) ? transactions : []
    return rows.reduce((acc, tx) => {
      const mode = String(tx?.mode || '').toLowerCase().replace(/[\s_-]+/g, '')
      if (mode === 'cod' || mode === 'cashondelivery') {
        acc.codDisplayAmount += Number(tx?.amount || 0)
      } else {
        acc.prepaidDisplayAmount += Number(tx?.amount || 0)
      }
      return acc
    }, { codDisplayAmount: 0, prepaidDisplayAmount: 0 })
  }, [transactions])

  const paymentSplitTotal = codDisplayAmount + prepaidDisplayAmount
  const codPct = paymentSplitTotal > 0 ? ((codDisplayAmount / paymentSplitTotal) * 100).toFixed(0) : 0
  const prepaidPct = paymentSplitTotal > 0 ? ((prepaidDisplayAmount / paymentSplitTotal) * 100).toFixed(0) : 0

  if (loading) return <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>Loading transactions…</div>
  if (error) return <div style={{ color: '#d32f2f', background: '#fee', border: '1px solid #fcc', padding: '16px', borderRadius: '8px' }}>{error}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ paddingBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: 28, fontWeight: 800, color: '#0f172a' }}>Transactions &amp; Revenue</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>Manage financial records and payment statuses.</p>
      </motion.div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Total Revenue</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>₹{Number(summary.totalAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
            <div><div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>COD Total</div><div style={{ fontSize: 18, fontWeight: 700 }}>₹{Number(codDisplayAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div></div>
            <div><div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>Prepaid Total</div><div style={{ fontSize: 18, fontWeight: 700 }}>₹{Number(prepaidDisplayAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div></div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>{summary.totalCount} transactions processed</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700, color: '#1f2937' }}>Payment Split</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: '#e0f2fe', color: '#0369a1' }}>{codPct}% COD</span>
            <span style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: '#f8fafc', color: '#475569' }}>{prepaidPct}% Prepaid</span>
          </div>
          <div style={{ display: 'flex', gap: 8, height: 8, borderRadius: 4, overflow: 'hidden', background: '#f3f4f6', marginBottom: 16 }}>
            <div style={{ flex: Number(codPct), background: 'linear-gradient(90deg, #3b82f6, #0369a1)', transition: 'flex 0.5s ease' }} />
            <div style={{ flex: Number(prepaidPct), background: '#9ca3af', transition: 'flex 0.5s ease' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, background: '#f0f9ff', borderRadius: 8 }}><div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, marginBottom: 4 }}>Cash on Delivery</div><div style={{ fontSize: 16, fontWeight: 700, color: '#0369a1' }}>₹{Number(codDisplayAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div></div>
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}><div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 4 }}>Prepaid</div><div style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>₹{Number(prepaidDisplayAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div></div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1f2937' }}>Filter Records</h3>
          <button onClick={() => { setFilters({ startDate: todayLocal, endDate: todayLocal, mode: 'all', status: 'all' }); setSearchTerm(''); setPassword(''); setManagerPassword(''); setGateError(null); setCustomUnlocked(false) }}
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#1d4ed8', background: 'transparent', border: 'none', cursor: 'pointer' }}>Reset All</button>
        </div>
        {gateError && <div style={{ padding: '12px 16px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#92400e', fontWeight: 600 }}>🔒 {gateError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div><label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: 13 }}>Start Date</label><input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} /></div>
          <div><label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: 13 }}>End Date</label><input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} /></div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: 13 }}>Payment Mode</label>
            <select value={filters.mode} onChange={(e) => handleFilterChange('mode', e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
              <option value="all">All Modes</option><option value="prepaid">Prepaid</option><option value="cod">COD</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: 13 }}>Transaction Status</label>
            <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
              <option value="all">All Statuses</option><option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Amount Collected">Amount Collected</option><option value="Out for Collection">Out for Collection</option><option value="Assigned to Delivery">Assigned to Delivery</option>
            </select>
          </div>
          {!managerMode && (
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: 13 }}>Admin Password</label><input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} /></div>
          )}
          {managerMode && managerNeedsPastAccessPassword && (
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: 13 }}>Manager Password</label><input type="password" placeholder="Required for previous dates" value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} /></div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!managerMode && <button onClick={handleDownloadPdf} style={{ padding: '10px 16px', background: '#fff', color: '#5b21b6', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📊 PDF</button>}
          <button onClick={handleApplyFilters} style={{ padding: '10px 20px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Apply</button>
        </div>
      </motion.div>

      {/* Search */}
      <input type="text" placeholder="Search by customer, txn ID, mode…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
        style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#1f2937' }}>Recent Transactions</h3>
        {paginatedTransactions.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#999', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>📭 No transactions found for the selected period.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {['TRANSACTION ID', 'CUSTOMER', 'MODE', 'STATUS', 'DELIVERY PARTNER'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 0', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px' }}>{h}</th>)}
                  <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', fontSize: 11 }}>AMOUNT</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', fontSize: 11 }}>DATE &amp; TIME</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx, idx) => {
                  const sc = { 'Amount Collected': { bg: '#ecfdf5', color: '#065f46' }, 'Out for Collection': { bg: '#fef3c7', color: '#92400e' }, 'Assigned to Delivery': { bg: '#dbeafe', color: '#1e40af' }, 'Pending': { bg: '#f3f4f6', color: '#6b7280' } }
                  const cfg = sc[tx.status] || { bg: '#f0f0f0', color: '#444' }
                  return (
                    <motion.tr key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + idx * 0.04 }}
                      style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.2s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 0', fontWeight: 600, color: '#0b5fff', fontFamily: 'monospace' }}>{String(tx.id).slice(0, 8)}</td>
                      <td style={{ padding: '12px 0', color: '#1f2937', fontWeight: 600 }}>{tx.users?.full_name || 'Unknown'}</td>
                      <td style={{ padding: '12px 0' }}><span style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: tx.mode === 'prepaid' ? '#eff6ff' : '#f0fdf4', color: tx.mode === 'prepaid' ? '#1e40af' : '#065f46' }}>{(tx.mode || '').toUpperCase() === 'PREPAID' ? 'Prepaid' : 'COD'}</span></td>
                      <td style={{ padding: '12px 0' }}><span style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color }}>{tx.status === 'Amount Collected' ? '✓ Amount Collected' : tx.status}</span></td>
                      <td style={{ padding: '12px 0', color: '#6b7280' }}>{tx.delivery_partner?.name || 'Not Assigned'}</td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700 }}>₹{Number(tx.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px 0', color: '#6b7280', fontSize: 12 }}>{new Date(tx.created_at).toLocaleDateString('en-IN')} {new Date(tx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Showing {Math.min(pageSize, paginatedTransactions.length)} of {filteredTransactions.length} results</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} style={{ padding: '8px 12px', background: currentPage === 1 ? '#f3f4f6' : '#fff', border: '1px solid #e5e7eb', borderRadius: 6, color: currentPage === 1 ? '#9ca3af' : '#1f2937', fontSize: 13, fontWeight: 600, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
                <button onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} style={{ padding: '8px 12px', background: currentPage === totalPages ? '#f3f4f6' : '#fff', border: '1px solid #e5e7eb', borderRadius: 6, color: currentPage === totalPages ? '#9ca3af' : '#1f2937', fontSize: 13, fontWeight: 600, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── Collection Settlement Sub-tab ────────────────────────────────────────────
function CollectionSettlementContent({ managerMode }) {
  const { adminKey } = useSafeAdminAuth()
  const managerToken = localStorage.getItem('manager_token')
  const apiHeaders = managerMode ? { 'x-manager-token': managerToken } : { 'x-admin-api-key': adminKey }
  const apiPrefix = managerMode ? '/api/manager' : '/api/admin'

  const [settlements, setSettlements] = useState([])
  const [settledOrders, setSettledOrders] = useState(() => { try { return JSON.parse(localStorage.getItem('settledOrders') || '[]') } catch (_) { return [] } })
  const [deliveryPartners, setDeliveryPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPartner, setSelectedPartner] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [cashReceived, setCashReceived] = useState('')
  const [settlementNote, setSettlementNote] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [viewSettledTab, setViewSettledTab] = useState(false)

  useEffect(() => { localStorage.setItem('settledOrders', JSON.stringify(settledOrders)) }, [settledOrders])

  useEffect(() => {
    if (managerMode && !managerToken) return
    if (!managerMode && !adminKey) return
    fetchDeliveryPartners()
    fetchSettlements(settledOrders)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, managerToken, managerMode])

  useEffect(() => { setSelectedIds([]); setCashReceived('') }, [selectedPartner, startDate, endDate])

  useEffect(() => {
    const auth = managerMode ? managerToken : adminKey
    if (auth && settledOrders.length > 0) fetchSettlements(settledOrders)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledOrders])

  async function fetchDeliveryPartners() {
    try {
      const res = await fetch(`${API_BASE}${apiPrefix}/delivery-partners`, { headers: apiHeaders })
      if (!res.ok) return
      const data = await res.json()
      setDeliveryPartners(Array.isArray(data) ? data : [])
    } catch (_) {}
  }

  async function fetchSettlements(currentSettled = settledOrders) {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (selectedPartner !== 'all') params.append('partnerId', selectedPartner)
      const res = await fetch(`${API_BASE}${apiPrefix}/transactions/settlement?${params.toString()}`, { headers: apiHeaders })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Failed to fetch settlements') }
      const data = await res.json()
      const settledIds = currentSettled.map((s) => s.id)
      setSettlements(Array.isArray(data) ? data.filter((item) => !settledIds.includes(item.id)) : [])
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  async function fetchHistory() {
    setHistoryLoading(true); setHistoryError(null)
    try {
      const params = new URLSearchParams()
      if (selectedPartner !== 'all') params.append('partnerId', selectedPartner)
      params.append('limit', '20')
      const res = await fetch(`${API_BASE}${apiPrefix}/transactions/settlement/history?${params.toString()}`, { headers: apiHeaders })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Failed to fetch history') }
      const data = await res.json()
      setHistoryItems(Array.isArray(data) ? data : [])
    } catch (err) { setHistoryError(err.message) } finally { setHistoryLoading(false) }
  }

  const isVerified = managerMode ? true : adminPassword === 'ASHI2005'
  const visibleSettlements = selectedPartner === 'all' ? settlements : settlements.filter((s) => s.delivery_partner_id === selectedPartner)
  const visibleSettledOrders = selectedPartner === 'all' ? settledOrders : settledOrders.filter((s) => s.delivery_partner_id === selectedPartner)
  const totalAssigned = visibleSettlements.reduce((sum, s) => sum + Number(s.amount_assigned || 0), 0)
  const pendingRemittance = totalAssigned
  const totalSettledAmount = visibleSettledOrders.reduce((sum, s) => sum + Number(s.amount_assigned || 0), 0)
  const todayKey = new Date().toLocaleDateString('en-CA')
  const todaysCollections = visibleSettlements.filter((s) => new Date(s.collection_date || s.created_at).toLocaleDateString('en-CA') === todayKey).reduce((sum, s) => sum + Number(s.amount_collected || 0), 0)
  const progressPct = pendingRemittance > 0 ? Math.min(100, Math.round((todaysCollections / pendingRemittance) * 100)) : 0
  const remainingToCollect = Math.max(0, pendingRemittance - todaysCollections)

  const isAmountEqual = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.01
  const getOrderAmount = (order) => Number(order?.amount_assigned || order?.amount || 0)
  const getOrderCollectedAmount = (order) => Number(order?.amount_collected || 0)
  const getOrderTodaysCollection = (order) => {
    const orderDateKey = new Date(order?.collection_date || order?.created_at).toLocaleDateString('en-CA')
    return orderDateKey === todayKey ? getOrderCollectedAmount(order) : 0
  }

  // Settlement unlock is evaluated per-order (not against overall assigned totals).
  const isSettlementUnlockedForOrder = (order) => {
    const orderAmount = getOrderAmount(order)
    if (orderAmount <= 0) return false
    const collectedAmount = getOrderCollectedAmount(order)
    const todaysCollectionForOrder = getOrderTodaysCollection(order)
    return isAmountEqual(collectedAmount, orderAmount) || isAmountEqual(todaysCollectionForOrder, orderAmount)
  }

  const unlockableVisibleSettlements = visibleSettlements.filter((s) => isSettlementUnlockedForOrder(s))
  const selectedItems = visibleSettlements.filter((s) => selectedIds.includes(s.id) && isSettlementUnlockedForOrder(s))
  const selectedUnlockableIds = selectedItems.map((s) => s.id)
  const selectedTotal = selectedItems.reduce((sum, s) => sum + Number(s.amount_assigned || 0), 0)
  const cashReceivedValue = Number(cashReceived || 0)
  const difference = cashReceivedValue - selectedTotal

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => {
        const order = visibleSettlements.find((s) => s.id === id)
        return order && isSettlementUnlockedForOrder(order)
      })
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) return prev
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSettlements, todayKey])

  async function handleCompleteSettlement() {
    if (!isVerified || selectedItems.length === 0 || selectedPartner === 'all') return
    try {
      const payload = {
        delivery_partner_id: selectedPartner,
        delivery_partner_name: deliveryPartners.find((dp) => dp.id === selectedPartner)?.name,
        items: selectedItems.map((s) => ({ order_id: s.order_id, user_name: s.user_name || null, amount_assigned: s.amount_assigned || 0, amount_collected: s.amount_collected || 0, collection_date: s.collection_date || s.created_at })),
        total_assigned: selectedTotal,
        total_collected: selectedItems.reduce((sum, s) => sum + Number(s.amount_collected || 0), 0),
        total_settled: selectedTotal, cash_received: cashReceivedValue, difference, note: settlementNote
      }
      const res = await fetch(`${API_BASE}${apiPrefix}/transactions/settlement/complete`, { method: 'POST', headers: { ...apiHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Failed to complete settlement') }
      alert('✅ Settlement completed successfully!')
      const settled = selectedItems.map((s) => ({ ...s, settled_at: new Date().toISOString() }))
      setSettledOrders((prev) => [...prev, ...settled])
      setSettlements((prev) => prev.filter((s) => !selectedUnlockableIds.includes(s.id)))
      await fetchHistory()
      setSelectedIds([]); setCashReceived(''); setSettlementNote(''); setAdminPassword(''); setHistoryOpen(true)
    } catch (err) { alert(err.message) }
  }

  async function handleReportDiscrepancy() {
    if (!isVerified || selectedItems.length === 0 || selectedPartner === 'all' || difference === 0) return
    try {
      const payload = {
        delivery_partner_id: selectedPartner,
        delivery_partner_name: deliveryPartners.find((dp) => dp.id === selectedPartner)?.name,
        expected_amount: selectedTotal, received_amount: cashReceivedValue,
        discrepancy_amount: Math.abs(difference), discrepancy_type: difference > 0 ? 'overage' : 'shortage',
        description: settlementNote || `${difference > 0 ? 'overage' : 'shortage'} of ₹${Math.abs(difference).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        items: selectedItems.map((s) => ({ order_id: s.order_id, user_name: s.user_name || null, amount_assigned: s.amount_assigned || 0, amount_collected: s.amount_collected || 0, collection_date: s.collection_date || s.created_at }))
      }
      const res = await fetch(`${API_BASE}${apiPrefix}/transactions/settlement/discrepancy`, { method: 'POST', headers: { ...apiHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Failed to report discrepancy') }
      alert('✅ Discrepancy reported successfully!')
      await fetchHistory()
      setSelectedIds([]); setCashReceived(''); setSettlementNote(''); setAdminPassword(''); setHistoryOpen(true)
    } catch (err) { alert(err.message) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>Loading settlement data…</div>
  if (error) return <div style={{ color: '#d32f2f', background: '#fee', border: '1px solid #fcc', padding: '16px', borderRadius: '8px' }}>{error}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Collection Settlement &amp; Reconciliation</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Reconcile COD payments from delivery partners.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { const next = !historyOpen; setHistoryOpen(next); if (next) fetchHistory() }}
            style={{ padding: '8px 14px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>History</button>
          {settledOrders.length > 0 && <button
            onClick={() => { if (confirm('Clear all settled orders?')) { setSettledOrders([]); localStorage.removeItem('settledOrders'); fetchSettlements([]) } }}
            style={{ padding: '8px 14px', border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#991b1b', cursor: 'pointer' }}>Reset Settled ({settledOrders.length})</button>}
        </div>
      </motion.div>

      {/* History panel */}
      {historyOpen && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Settlement History</div>
          {historyLoading && <div style={{ color: '#64748b', fontSize: 12 }}>Loading history…</div>}
          {historyError && <div style={{ color: '#b91c1c', fontSize: 12 }}>{historyError}</div>}
          {!historyLoading && !historyError && historyItems.length === 0 && <div style={{ color: '#94a3b8', fontSize: 12 }}>No settlement receipts found.</div>}
          {!historyLoading && !historyError && historyItems.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ borderBottom: '1px solid #e5e7eb', color: '#64748b' }}>
                  {['Receipt ID', 'Partner', 'Pending Remittance', 'Cash Received', 'Difference', 'Date'].map((h, i) => <th key={h} style={{ textAlign: i >= 2 && i <= 4 ? 'right' : 'left', padding: '8px 6px' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {historyItems.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 700, color: '#0f172a' }}>{r.id}</td>
                      <td style={{ padding: '10px 6px' }}>{r.delivery_partner_name || 'Unknown'}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700 }}>₹{Number(r.total_assigned || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>₹{Number(r.cash_received || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: Number(r.difference || 0) === 0 ? '#16a34a' : '#f59e0b' }}>₹{Number(r.difference || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* Summary stats */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)', border: '1px solid #e5e7eb', borderRadius: 16, padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Select Delivery Partner</div>
          <select value={selectedPartner} onChange={(e) => setSelectedPartner(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, background: '#fff' }}>
            <option value="all">All Partners</option>
            {deliveryPartners.map((dp) => <option key={dp.id} value={dp.id}>{dp.name}{dp.delivery_partner_id ? ` (ID: ${dp.delivery_partner_id})` : ''}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: '#10b981', fontSize: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#10b981', display: 'inline-block' }} />
            Active Shift
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Pending Remittance</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 6 }}>₹{Number(pendingRemittance).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Total amount to be collected</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Today's Collections</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>₹{Number(todaysCollections).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: 999 }}>{progressPct}%</span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Progress towards target</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Remaining to Collect</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: remainingToCollect === 0 ? '#10b981' : '#f59e0b' }}>₹{Number(remainingToCollect).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            {remainingToCollect === 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: 999 }}>✓ Complete</span>}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Pending from delivery dashboard</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>
            Assigned: ₹{Number(pendingRemittance).toLocaleString('en-IN', { maximumFractionDigits: 2 })} - Collected: ₹{Number(todaysCollections).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Settlement Status</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '4px 8px', background: totalSettledAmount > 0 ? '#ecfdf5' : '#fff7ed', color: totalSettledAmount > 0 ? '#065f46' : '#9a3412', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
            {totalSettledAmount > 0 ? '✓ Partially Settled' : 'Pending Settlement'}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{visibleSettledOrders.length > 0 ? `${visibleSettledOrders.length} batches settled` : 'No batch settled yet'}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Total Settled Amount</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', marginTop: 6 }}>₹{Number(totalSettledAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{visibleSettledOrders.length} orders settled</div>
        </div>
      </motion.div>

      {/* Pending Collection Tasks */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', borderRadius: 6, background: '#f3f4f6', fontSize: 12 }}>📋</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Pending Collection Tasks</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Orders assigned for collection ({visibleSettlements.length} tasks)</div>
          </div>
        </div>
        {visibleSettlements.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10 }}>No pending collection tasks.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
                  {['ORDER ID', 'RETAILER', 'ASSIGNMENT DATE', 'AMOUNT ASSIGNED', 'STATUS'].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 3 ? 'right' : i === 4 ? 'center' : 'left', padding: '10px 6px', fontSize: 11, fontWeight: 700, color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleSettlements.map((s, idx) => (
                  <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 6px', fontWeight: 700, color: '#0f172a' }}>#ORD-{String(s.order_id || '').slice(0, 6)}</td>
                    <td style={{ padding: '12px 6px' }}>
                      <div style={{ color: '#1f2937', fontWeight: 600 }}>{s.user_name || 'Unknown'}</div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Partner: {s.delivery_partner_id || 'Not Assigned'}</div>
                    </td>
                    <td style={{ padding: '12px 6px', color: '#64748b' }}>{new Date(s.collection_date || s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                    <td style={{ padding: '12px 6px', textAlign: 'right', fontWeight: 700 }}>₹{Number(s.amount_assigned || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '12px 6px', textAlign: 'center' }}><span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>⏳ Pending</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Settlement workspace */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
        style={{ display: 'grid', gridTemplateColumns: !viewSettledTab ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setViewSettledTab(false)} style={{ padding: '6px 12px', background: !viewSettledTab ? '#1d4ed8' : 'transparent', color: !viewSettledTab ? '#fff' : '#64748b', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Unsettled ({visibleSettlements.length})</button>
              <button onClick={() => setViewSettledTab(true)} style={{ padding: '6px 12px', background: viewSettledTab ? '#10b981' : 'transparent', color: viewSettledTab ? '#fff' : '#64748b', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Settled ({visibleSettledOrders.length})</button>
            </div>
            <span style={{ fontSize: 12, color: '#64748b', padding: '4px 8px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 999 }}>{visibleSettlements.length} Total Assigned Orders</span>
          </div>

          {!viewSettledTab && visibleSettlements.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>✓ All Collections Completed</div>
              <div style={{ fontSize: 12 }}>No pending collection tasks.</div>
            </div>
          ) : viewSettledTab && visibleSettledOrders.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>No settled collections yet.</div>
          ) : !viewSettledTab ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
                    <th style={{ padding: '10px 6px', textAlign: 'left' }}>
                      <input
                        type="checkbox"
                        checked={unlockableVisibleSettlements.length > 0 && selectedItems.length === unlockableVisibleSettlements.length}
                        onChange={(e) => setSelectedIds(e.target.checked ? unlockableVisibleSettlements.map((s) => s.id) : [])}
                      />
                    </th>
                    {['ORDER ID', 'RETAILER NAME', 'COLLECTION DATE', 'ORDER AMOUNT'].map((h, i) => <th key={h} style={{ textAlign: i === 3 ? 'right' : 'left', padding: '10px 6px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visibleSettlements.map((s, idx) => {
                    const orderAmount = getOrderAmount(s)
                    const collectedAmount = getOrderCollectedAmount(s)
                    const todaysCollectionForOrder = getOrderTodaysCollection(s)
                    const isUnlocked = isSettlementUnlockedForOrder(s)

                    return (
                      <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: isUnlocked ? '#ffffff' : '#fcfcfd' }}>
                        <td style={{ padding: '12px 6px' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(s.id)}
                            disabled={!isUnlocked}
                            onChange={(e) => setSelectedIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id))}
                            style={{ cursor: isUnlocked ? 'pointer' : 'not-allowed', opacity: isUnlocked ? 1 : 0.45 }}
                          />
                        </td>
                        <td style={{ padding: '12px 6px', fontWeight: 700, color: '#0f172a' }}>#ORD-{String(s.order_id || '').slice(0, 4)}</td>
                        <td style={{ padding: '12px 6px' }}>
                          <div style={{ color: '#1f2937', fontWeight: 600 }}>{s.user_name || 'Unknown'}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11 }}>Sector 14</div>
                        </td>
                        <td style={{ padding: '12px 6px', color: '#64748b' }}>{new Date(s.collection_date || s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, {new Date(s.collection_date || s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).toLowerCase()}</td>
                        <td style={{ padding: '12px 6px', textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: '#111827' }}>₹{Number(orderAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Collected: ₹{Number(collectedAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                          <div style={{ fontSize: 12, marginTop: 3, color: isUnlocked ? '#16a34a' : '#d97706', fontWeight: 600 }}>
                            {isUnlocked ? '🔓 Settlement Unlocked' : `🔒 Locked (Today: ₹${Number(todaysCollectionForOrder).toLocaleString('en-IN', { maximumFractionDigits: 2 })})`}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ borderBottom: '1px solid #e5e7eb', color: '#64748b' }}>
                  {['Order ID', 'Retailer', 'Settlement Date', 'Amount Settled', 'Status'].map((h, i) => <th key={h} style={{ textAlign: i === 3 ? 'right' : i === 4 ? 'center' : 'left', padding: '10px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {visibleSettledOrders.map((s, idx) => (
                    <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: '#f9fafb' }}>
                      <td style={{ padding: '12px 6px', fontWeight: 700 }}>#ORD-{String(s.order_id || '').slice(0, 6)}</td>
                      <td style={{ padding: '12px 6px' }}>{s.user_name || 'Unknown'}</td>
                      <td style={{ padding: '12px 6px', color: '#64748b' }}>{new Date(s.settled_at || s.collection_date || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                      <td style={{ padding: '12px 6px', textAlign: 'right', fontWeight: 700 }}>₹{Number(s.amount_assigned || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px 6px', textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#10b981', padding: '4px 8px', borderRadius: 4 }}>✓ Settled</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!viewSettledTab && (
          <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {selectedItems.length === 0 ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 24 }}>🔒</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#7f1d1d', marginBottom: 6 }}>Settlement Locked</div>
                </div>
                <div style={{ fontSize: 20, color: '#991b1b', marginBottom: 12 }}>Please select at least one unlocked order to proceed with settlement.</div>
                <div style={{ fontSize: 20, color: '#dc2626', fontWeight: 600 }}>📦 Selected Orders: {selectedItems.length} • 🔓 Unlock-ready Orders: {unlockableVisibleSettlements.length}</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>✅ Settlement Details</div>
                <div style={{ fontSize: 14, color: '#10b981', marginBottom: 14, fontWeight: 600 }}>Ready to finalize — {selectedItems.length} order(s) selected</div>
                <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#475569' }}><span>Total to Settle ({selectedItems.length} items)</span><span style={{ fontWeight: 700, color: '#0f172a' }}>₹{Number(selectedTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Cash Received Amount</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 12 }}>₹</div>
                    <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="0" style={{ flex: 1, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                    <div style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8fafc', fontSize: 11, color: '#64748b' }}>INR</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13 }}><span style={{ color: '#64748b' }}>Difference</span><span style={{ fontWeight: 700, color: difference === 0 ? '#10b981' : '#f59e0b' }}>₹{Number(difference).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Settlement Note (Optional)</div>
                <textarea value={settlementNote} onChange={(e) => setSettlementNote(e.target.value)} rows={2} placeholder="e.g. Received in 2 bundles of 500s…"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, resize: 'vertical', marginBottom: 12, boxSizing: 'border-box' }} />

                {!managerMode && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Admin Password Verification</div>
                    <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Required to authorize settlement"
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, marginBottom: 14, boxSizing: 'border-box' }} />
                  </>
                )}

                <button onClick={handleCompleteSettlement} disabled={!isVerified || selectedItems.length === 0 || selectedPartner === 'all'}
                  style={{ width: '100%', padding: '10px 14px', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: (!isVerified || selectedItems.length === 0 || selectedPartner === 'all') ? 'not-allowed' : 'pointer', background: (!isVerified || selectedItems.length === 0 || selectedPartner === 'all') ? '#e2e8f0' : 'linear-gradient(135deg, #2563eb, #7c3aed)', color: (!isVerified || selectedItems.length === 0 || selectedPartner === 'all') ? '#94a3b8' : '#fff' }}>
                  Complete Settlement &amp; Issue Receipt
                </button>
                <button onClick={handleReportDiscrepancy} disabled={!isVerified || selectedItems.length === 0 || selectedPartner === 'all' || difference === 0}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid', borderRadius: 8, fontSize: 11, fontWeight: 600, marginTop: 8, cursor: (!isVerified || difference === 0) ? 'not-allowed' : 'pointer', background: (!isVerified || difference === 0) ? '#e2e8f0' : '#fef3c7', borderColor: (!isVerified || difference === 0) ? '#cbd5e1' : '#fcd34d', color: (!isVerified || difference === 0) ? '#94a3b8' : '#92400e' }}>
                  Report a Discrepancy
                </button>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── Warehouse Settlement Sub-tab ─────────────────────────────────────────────
function WarehouseSettlementContent({ managerMode }) {
  const { adminKey } = useSafeAdminAuth()
  const managerToken = localStorage.getItem('manager_token')
  const apiHeaders = managerMode ? { 'x-manager-token': managerToken } : { 'x-admin-api-key': adminKey }
  const apiPrefix = managerMode ? '/api/manager' : '/api/admin'

  const [settlements, setSettlements] = useState([])
  const [settledOrders, setSettledOrders] = useState(() => { try { return JSON.parse(localStorage.getItem('settledWarehouseOrders') || '[]') } catch (_) { return [] } })
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [cashReceived, setCashReceived] = useState('')
  const [settlementNote, setSettlementNote] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [viewSettledTab, setViewSettledTab] = useState(false)

  useEffect(() => { localStorage.setItem('settledWarehouseOrders', JSON.stringify(settledOrders)) }, [settledOrders])

  useEffect(() => {
    if (managerMode && !managerToken) return
    if (!managerMode && !adminKey) return
    fetchWarehouses()
    fetchSettlements(settledOrders)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, managerToken, managerMode])

  useEffect(() => { setSelectedIds([]); setCashReceived('') }, [selectedWarehouse, startDate, endDate])

  useEffect(() => {
    const auth = managerMode ? managerToken : adminKey
    if (auth && settledOrders.length > 0) fetchSettlements(settledOrders)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledOrders])

  async function fetchWarehouses() {
    try {
      const res = await fetch(`${API_BASE}${apiPrefix}/warehouses`, { headers: apiHeaders })
      if (!res.ok) return
      const data = await res.json()
      setWarehouses(Array.isArray(data) ? data : [])
    } catch (_) {}
  }

  async function fetchSettlements(currentSettled = settledOrders) {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (selectedWarehouse !== 'all') params.append('warehouseId', selectedWarehouse)
      const res = await fetch(`${API_BASE}${apiPrefix}/transactions/warehouse-settlement?${params.toString()}`, { headers: apiHeaders })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Failed to fetch warehouse settlements') }
      const data = await res.json()
      const settledIds = currentSettled.map((s) => s.id)
      setSettlements(Array.isArray(data) ? data.filter((item) => !settledIds.includes(item.id)) : [])
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  async function fetchHistory() {
    setHistoryLoading(true); setHistoryError(null)
    try {
      const params = new URLSearchParams()
      if (selectedWarehouse !== 'all') params.append('warehouseId', selectedWarehouse)
      params.append('limit', '20')
      const res = await fetch(`${API_BASE}${apiPrefix}/transactions/warehouse-settlement/history?${params.toString()}`, { headers: apiHeaders })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Failed to fetch history') }
      const data = await res.json()
      setHistoryItems(Array.isArray(data) ? data : [])
    } catch (err) { setHistoryError(err.message) } finally { setHistoryLoading(false) }
  }

  const isVerified = managerMode ? true : adminPassword === 'ASHI2005'
  const visibleSettlements = selectedWarehouse === 'all' ? settlements : settlements.filter((s) => s.warehouse_id === selectedWarehouse)
  const visibleSettledOrders = selectedWarehouse === 'all' ? settledOrders : settledOrders.filter((s) => s.warehouse_id === selectedWarehouse)
  const totalAssigned = visibleSettlements.reduce((sum, s) => sum + Number(s.amount_assigned || 0), 0)
  const pendingRemittance = totalAssigned
  const totalSettledAmount = visibleSettledOrders.reduce((sum, s) => sum + Number(s.amount_assigned || 0), 0)
  const todayKey = new Date().toLocaleDateString('en-CA')
  const todaysCollections = visibleSettlements.filter((s) => new Date(s.collection_date || s.created_at).toLocaleDateString('en-CA') === todayKey).reduce((sum, s) => sum + Number(s.amount_collected || 0), 0)
  const progressPct = pendingRemittance > 0 ? Math.min(100, Math.round((todaysCollections / pendingRemittance) * 100)) : 0
  const remainingToCollect = Math.max(0, pendingRemittance - todaysCollections)

  const isAmountEqual = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.01
  const getOrderAmount = (order) => Number(order?.amount_assigned || order?.amount || 0)
  const getOrderCollectedAmount = (order) => Number(order?.amount_collected || 0)
  const getOrderTodaysCollection = (order) => {
    const orderDateKey = new Date(order?.collection_date || order?.created_at).toLocaleDateString('en-CA')
    return orderDateKey === todayKey ? getOrderCollectedAmount(order) : 0
  }

  const isSettlementUnlockedForOrder = (order) => {
    const orderAmount = getOrderAmount(order)
    if (orderAmount <= 0) return false
    const collectedAmount = getOrderCollectedAmount(order)
    const todaysCollectionForOrder = getOrderTodaysCollection(order)
    return isAmountEqual(collectedAmount, orderAmount) || isAmountEqual(todaysCollectionForOrder, orderAmount)
  }

  const unlockableVisibleSettlements = visibleSettlements.filter((s) => isSettlementUnlockedForOrder(s))
  const selectedItems = visibleSettlements.filter((s) => selectedIds.includes(s.id) && isSettlementUnlockedForOrder(s))
  const selectedUnlockableIds = selectedItems.map((s) => s.id)
  const selectedTotal = selectedItems.reduce((sum, s) => sum + Number(s.amount_assigned || 0), 0)
  const cashReceivedValue = Number(cashReceived || 0)
  const difference = cashReceivedValue - selectedTotal

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => {
        const order = visibleSettlements.find((s) => s.id === id)
        return order && isSettlementUnlockedForOrder(order)
      })
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) return prev
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSettlements, todayKey])

  async function handleCompleteSettlement() {
    if (!isVerified || selectedItems.length === 0 || selectedWarehouse === 'all') return
    try {
      const payload = {
        warehouse_id: selectedWarehouse,
        warehouse_name: warehouses.find((w) => w.id === selectedWarehouse)?.name,
        items: selectedItems.map((s) => ({ order_id: s.order_id, user_name: s.user_name || null, amount_assigned: s.amount_assigned || 0, amount_collected: s.amount_collected || 0, collection_date: s.collection_date || s.created_at })),
        total_assigned: selectedTotal,
        total_collected: selectedItems.reduce((sum, s) => sum + Number(s.amount_collected || 0), 0),
        total_settled: selectedTotal, cash_received: cashReceivedValue, difference, note: settlementNote
      }
      const res = await fetch(`${API_BASE}${apiPrefix}/transactions/warehouse-settlement/complete`, { method: 'POST', headers: { ...apiHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Failed to complete settlement') }
      alert('✅ Warehouse settlement completed successfully!')
      const settled = selectedItems.map((s) => ({ ...s, settled_at: new Date().toISOString() }))
      setSettledOrders((prev) => [...prev, ...settled])
      setSettlements((prev) => prev.filter((s) => !selectedUnlockableIds.includes(s.id)))
      await fetchHistory()
      setSelectedIds([]); setCashReceived(''); setSettlementNote(''); setAdminPassword(''); setHistoryOpen(true)
    } catch (err) { alert(err.message) }
  }

  async function handleReportDiscrepancy() {
    if (!isVerified || selectedItems.length === 0 || selectedWarehouse === 'all' || difference === 0) return
    try {
      const payload = {
        warehouse_id: selectedWarehouse,
        warehouse_name: warehouses.find((w) => w.id === selectedWarehouse)?.name,
        expected_amount: selectedTotal, received_amount: cashReceivedValue,
        discrepancy_amount: Math.abs(difference), discrepancy_type: difference > 0 ? 'overage' : 'shortage',
        description: settlementNote || `${difference > 0 ? 'overage' : 'shortage'} of ₹${Math.abs(difference).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        items: selectedItems.map((s) => ({ order_id: s.order_id, user_name: s.user_name || null, amount_assigned: s.amount_assigned || 0, amount_collected: s.amount_collected || 0, collection_date: s.collection_date || s.created_at }))
      }
      const res = await fetch(`${API_BASE}${apiPrefix}/transactions/warehouse-settlement/discrepancy`, { method: 'POST', headers: { ...apiHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Failed to report discrepancy') }
      alert('✅ Discrepancy reported successfully!')
      await fetchHistory()
      setSelectedIds([]); setCashReceived(''); setSettlementNote(''); setAdminPassword(''); setHistoryOpen(true)
    } catch (err) { alert(err.message) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>Loading warehouse settlement data…</div>
  if (error) return <div style={{ color: '#d32f2f', background: '#fee', border: '1px solid #fcc', padding: '16px', borderRadius: '8px' }}>{error}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Collection Settlement from Warehouse</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Reconcile COD payments collected by warehouse pickup orders.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { const next = !historyOpen; setHistoryOpen(next); if (next) fetchHistory() }}
            style={{ padding: '8px 14px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>History</button>
          {settledOrders.length > 0 && <button
            onClick={() => { if (confirm('Clear all settled warehouse orders?')) { setSettledOrders([]); localStorage.removeItem('settledWarehouseOrders'); fetchSettlements([]) } }}
            style={{ padding: '8px 14px', border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#991b1b', cursor: 'pointer' }}>Reset Settled ({settledOrders.length})</button>}
        </div>
      </motion.div>

      {/* History panel */}
      {historyOpen && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Warehouse Settlement History</div>
          {historyLoading && <div style={{ color: '#64748b', fontSize: 12 }}>Loading history…</div>}
          {historyError && <div style={{ color: '#b91c1c', fontSize: 12 }}>{historyError}</div>}
          {!historyLoading && !historyError && historyItems.length === 0 && <div style={{ color: '#94a3b8', fontSize: 12 }}>No warehouse settlement receipts found.</div>}
          {!historyLoading && !historyError && historyItems.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ borderBottom: '1px solid #e5e7eb', color: '#64748b' }}>
                  {['Receipt ID', 'Warehouse', 'Pending Remittance', 'Cash Received', 'Difference', 'Date'].map((h, i) => <th key={h} style={{ textAlign: i >= 2 && i <= 4 ? 'right' : 'left', padding: '8px 6px' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {historyItems.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 700, color: '#0f172a' }}>{r.id}</td>
                      <td style={{ padding: '10px 6px' }}>{r.warehouse_name || 'Unknown'}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700 }}>₹{Number(r.total_assigned || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>₹{Number(r.cash_received || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: Number(r.difference || 0) === 0 ? '#16a34a' : '#f59e0b' }}>₹{Number(r.difference || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* Summary stats */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)', border: '1px solid #e5e7eb', borderRadius: 16, padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Select Warehouse</div>
          <select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, background: '#fff' }}>
            <option value="all">All Warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: '#10b981', fontSize: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#10b981', display: 'inline-block' }} />
            Active Shift
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Pending Remittance</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 6 }}>₹{Number(pendingRemittance).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Total amount to be collected</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Today's Collections</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>₹{Number(todaysCollections).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: 999 }}>{progressPct}%</span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Progress towards target</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Remaining to Collect</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: remainingToCollect === 0 ? '#10b981' : '#f59e0b' }}>₹{Number(remainingToCollect).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            {remainingToCollect === 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: 999 }}>✓ Complete</span>}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Pending from warehouse portal</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Settlement Status</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '4px 8px', background: totalSettledAmount > 0 ? '#ecfdf5' : '#fff7ed', color: totalSettledAmount > 0 ? '#065f46' : '#9a3412', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
            {totalSettledAmount > 0 ? '✓ Partially Settled' : 'Pending Settlement'}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{visibleSettledOrders.length > 0 ? `${visibleSettledOrders.length} batches settled` : 'No batch settled yet'}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Total Settled Amount</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', marginTop: 6 }}>₹{Number(totalSettledAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{visibleSettledOrders.length} orders settled</div>
        </div>
      </motion.div>

      {/* Pending Collection Tasks */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', borderRadius: 6, background: '#f3f4f6', fontSize: 12 }}>🏬</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Pending Warehouse Collection Tasks</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Pickup orders pending COD collection ({visibleSettlements.length} tasks)</div>
          </div>
        </div>
        {visibleSettlements.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10 }}>No pending warehouse collection tasks.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
                  {['ORDER ID', 'CUSTOMER', 'PICKUP DATE', 'AMOUNT ASSIGNED', 'STATUS'].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 3 ? 'right' : i === 4 ? 'center' : 'left', padding: '10px 6px', fontSize: 11, fontWeight: 700, color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleSettlements.map((s, idx) => (
                  <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 6px', fontWeight: 700, color: '#0f172a' }}>#ORD-{String(s.order_id || '').slice(0, 6)}</td>
                    <td style={{ padding: '12px 6px' }}>
                      <div style={{ color: '#1f2937', fontWeight: 600 }}>{s.user_name || 'Unknown'}</div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Warehouse: {s.warehouse_name || 'Not Assigned'}</div>
                    </td>
                    <td style={{ padding: '12px 6px', color: '#64748b' }}>{new Date(s.collection_date || s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                    <td style={{ padding: '12px 6px', textAlign: 'right', fontWeight: 700 }}>₹{Number(s.amount_assigned || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '12px 6px', textAlign: 'center' }}><span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>⏳ Pending</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Settlement workspace */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
        style={{ display: 'grid', gridTemplateColumns: !viewSettledTab ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setViewSettledTab(false)} style={{ padding: '6px 12px', background: !viewSettledTab ? '#1d4ed8' : 'transparent', color: !viewSettledTab ? '#fff' : '#64748b', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Unsettled ({visibleSettlements.length})</button>
              <button onClick={() => setViewSettledTab(true)} style={{ padding: '6px 12px', background: viewSettledTab ? '#10b981' : 'transparent', color: viewSettledTab ? '#fff' : '#64748b', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Settled ({visibleSettledOrders.length})</button>
            </div>
            <span style={{ fontSize: 12, color: '#64748b', padding: '4px 8px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 999 }}>{visibleSettlements.length} Total Pickup Orders</span>
          </div>

          {!viewSettledTab && visibleSettlements.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>✓ All Warehouse Collections Completed</div>
              <div style={{ fontSize: 12 }}>No pending collection tasks.</div>
            </div>
          ) : viewSettledTab && visibleSettledOrders.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>No settled warehouse collections yet.</div>
          ) : !viewSettledTab ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
                    <th style={{ padding: '10px 6px', textAlign: 'left' }}>
                      <input
                        type="checkbox"
                        checked={unlockableVisibleSettlements.length > 0 && selectedItems.length === unlockableVisibleSettlements.length}
                        onChange={(e) => setSelectedIds(e.target.checked ? unlockableVisibleSettlements.map((s) => s.id) : [])}
                      />
                    </th>
                    {['ORDER ID', 'CUSTOMER NAME', 'PICKUP DATE', 'ORDER AMOUNT'].map((h, i) => <th key={h} style={{ textAlign: i === 3 ? 'right' : 'left', padding: '10px 6px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visibleSettlements.map((s, idx) => {
                    const orderAmount = getOrderAmount(s)
                    const collectedAmount = getOrderCollectedAmount(s)
                    const todaysCollectionForOrder = getOrderTodaysCollection(s)
                    const isUnlocked = isSettlementUnlockedForOrder(s)

                    return (
                      <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: isUnlocked ? '#ffffff' : '#fcfcfd' }}>
                        <td style={{ padding: '12px 6px' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(s.id)}
                            disabled={!isUnlocked}
                            onChange={(e) => setSelectedIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id))}
                            style={{ cursor: isUnlocked ? 'pointer' : 'not-allowed', opacity: isUnlocked ? 1 : 0.45 }}
                          />
                        </td>
                        <td style={{ padding: '12px 6px', fontWeight: 700, color: '#0f172a' }}>#ORD-{String(s.order_id || '').slice(0, 4)}</td>
                        <td style={{ padding: '12px 6px' }}>
                          <div style={{ color: '#1f2937', fontWeight: 600 }}>{s.user_name || 'Unknown'}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11 }}>{s.warehouse_name || 'Unknown Warehouse'}</div>
                        </td>
                        <td style={{ padding: '12px 6px', color: '#64748b' }}>{new Date(s.collection_date || s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, {new Date(s.collection_date || s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).toLowerCase()}</td>
                        <td style={{ padding: '12px 6px', textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: '#111827' }}>₹{Number(orderAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Collected: ₹{Number(collectedAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                          <div style={{ fontSize: 12, marginTop: 3, color: isUnlocked ? '#16a34a' : '#d97706', fontWeight: 600 }}>
                            {isUnlocked ? '🔓 Settlement Unlocked' : `🔒 Locked (Today: ₹${Number(todaysCollectionForOrder).toLocaleString('en-IN', { maximumFractionDigits: 2 })})`}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ borderBottom: '1px solid #e5e7eb', color: '#64748b' }}>
                  {['Order ID', 'Customer', 'Settlement Date', 'Amount Settled', 'Status'].map((h, i) => <th key={h} style={{ textAlign: i === 3 ? 'right' : i === 4 ? 'center' : 'left', padding: '10px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {visibleSettledOrders.map((s, idx) => (
                    <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: '#f9fafb' }}>
                      <td style={{ padding: '12px 6px', fontWeight: 700 }}>#ORD-{String(s.order_id || '').slice(0, 6)}</td>
                      <td style={{ padding: '12px 6px' }}>{s.user_name || 'Unknown'}</td>
                      <td style={{ padding: '12px 6px', color: '#64748b' }}>{new Date(s.settled_at || s.collection_date || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                      <td style={{ padding: '12px 6px', textAlign: 'right', fontWeight: 700 }}>₹{Number(s.amount_assigned || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px 6px', textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#10b981', padding: '4px 8px', borderRadius: 4 }}>✓ Settled</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!viewSettledTab && (
          <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {selectedItems.length === 0 ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 24 }}>🔒</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#7f1d1d', marginBottom: 6 }}>Settlement Locked</div>
                </div>
                <div style={{ fontSize: 20, color: '#991b1b', marginBottom: 12 }}>Please select at least one unlocked order to proceed with settlement.</div>
                <div style={{ fontSize: 20, color: '#dc2626', fontWeight: 600 }}>📦 Selected Orders: {selectedItems.length} • 🔓 Unlock-ready Orders: {unlockableVisibleSettlements.length}</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>✅ Settlement Details</div>
                <div style={{ fontSize: 14, color: '#10b981', marginBottom: 14, fontWeight: 600 }}>Ready to finalize — {selectedItems.length} order(s) selected</div>
                <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#475569' }}><span>Total to Settle ({selectedItems.length} items)</span><span style={{ fontWeight: 700, color: '#0f172a' }}>₹{Number(selectedTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Cash Received Amount</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 12 }}>₹</div>
                    <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="0" style={{ flex: 1, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                    <div style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8fafc', fontSize: 11, color: '#64748b' }}>INR</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13 }}><span style={{ color: '#64748b' }}>Difference</span><span style={{ fontWeight: 700, color: difference === 0 ? '#10b981' : '#f59e0b' }}>₹{Number(difference).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Settlement Note (Optional)</div>
                <textarea value={settlementNote} onChange={(e) => setSettlementNote(e.target.value)} rows={2} placeholder="e.g. Received in 2 bundles of 500s…"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, resize: 'vertical', marginBottom: 12, boxSizing: 'border-box' }} />

                {!managerMode && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Admin Password Verification</div>
                    <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Required to authorize settlement"
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, marginBottom: 14, boxSizing: 'border-box' }} />
                  </>
                )}

                <button onClick={handleCompleteSettlement} disabled={!isVerified || selectedItems.length === 0 || selectedWarehouse === 'all'}
                  style={{ width: '100%', padding: '10px 14px', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: (!isVerified || selectedItems.length === 0 || selectedWarehouse === 'all') ? 'not-allowed' : 'pointer', background: (!isVerified || selectedItems.length === 0 || selectedWarehouse === 'all') ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9, #0369a1)', color: (!isVerified || selectedItems.length === 0 || selectedWarehouse === 'all') ? '#94a3b8' : '#fff' }}>
                  Complete Warehouse Settlement &amp; Issue Receipt
                </button>
                <button onClick={handleReportDiscrepancy} disabled={!isVerified || selectedItems.length === 0 || selectedWarehouse === 'all' || difference === 0}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid', borderRadius: 8, fontSize: 11, fontWeight: 600, marginTop: 8, cursor: (!isVerified || difference === 0) ? 'not-allowed' : 'pointer', background: (!isVerified || difference === 0) ? '#e2e8f0' : '#fef3c7', borderColor: (!isVerified || difference === 0) ? '#cbd5e1' : '#fcd34d', color: (!isVerified || difference === 0) ? '#94a3b8' : '#92400e' }}>
                  Report a Discrepancy
                </button>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── Main exported wrapper ────────────────────────────────────────────────────
export default function TransactionsTab({ managerMode = false, initialSubTab = 'revenue', lockToInitialSubTab = false }) {
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab)

  useEffect(() => { setActiveSubTab(initialSubTab) }, [initialSubTab])

  if (lockToInitialSubTab) {
    return (
      <div>
        {initialSubTab === 'settlement' && <CollectionSettlementContent managerMode={managerMode} />}
        {initialSubTab === 'warehouse-settlement' && <WarehouseSettlementContent managerMode={managerMode} />}
        {initialSubTab !== 'settlement' && initialSubTab !== 'warehouse-settlement' && <TransactionRevenueContent managerMode={managerMode} />}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid #e5e7eb', paddingBottom: 0 }}>
        <button onClick={() => setActiveSubTab('revenue')}
          style={{ padding: '12px 24px', background: 'transparent', border: 'none', borderBottom: activeSubTab === 'revenue' ? '3px solid #1d4ed8' : '3px solid transparent', color: activeSubTab === 'revenue' ? '#1d4ed8' : '#6b7280', fontWeight: activeSubTab === 'revenue' ? 700 : 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s', marginBottom: -2 }}>
          💰 Transaction and Revenue
        </button>
        <button onClick={() => setActiveSubTab('settlement')}
          style={{ padding: '12px 24px', background: 'transparent', border: 'none', borderBottom: activeSubTab === 'settlement' ? '3px solid #1d4ed8' : '3px solid transparent', color: activeSubTab === 'settlement' ? '#1d4ed8' : '#6b7280', fontWeight: activeSubTab === 'settlement' ? 700 : 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s', marginBottom: -2 }}>
          🚚 Collection Settlement from Delivery Partner
        </button>
        <button onClick={() => setActiveSubTab('warehouse-settlement')}
          style={{ padding: '12px 24px', background: 'transparent', border: 'none', borderBottom: activeSubTab === 'warehouse-settlement' ? '3px solid #0ea5e9' : '3px solid transparent', color: activeSubTab === 'warehouse-settlement' ? '#0ea5e9' : '#6b7280', fontWeight: activeSubTab === 'warehouse-settlement' ? 700 : 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s', marginBottom: -2 }}>
          🏬 Collection Settlement from Warehouse
        </button>
      </div>
      {activeSubTab === 'revenue' && <TransactionRevenueContent managerMode={managerMode} />}
      {activeSubTab === 'settlement' && <CollectionSettlementContent managerMode={managerMode} />}
      {activeSubTab === 'warehouse-settlement' && <WarehouseSettlementContent managerMode={managerMode} />}
    </div>
  )
}
