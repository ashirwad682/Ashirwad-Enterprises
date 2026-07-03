import React, { useState, useEffect } from 'react'
import { fetchAdminFinancialRecords } from '../../api/client'
import { motion } from 'framer-motion'

export default function PayoutRecordsTab({ adminKey }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter States
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'Salary' | 'Refund'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'pending' | 'processing' | 'paid' | 'completed' | 'failed'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await fetchAdminFinancialRecords(adminKey)
      setRecords(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load payout records')
    } finally {
      setLoading(false)
    }
  }

  // Filter Logic
  const filteredRecords = records.filter(row => {
    // 1) Type Filter
    if (typeFilter !== 'all' && row.type !== typeFilter) return false

    // 2) Status Filter
    if (statusFilter !== 'all') {
      const matchStatus = String(row.status || '').toLowerCase() === statusFilter.toLowerCase()
      if (!matchStatus) return false
    }

    // 3) Date Range Filter
    const recordDate = new Date(row.date)
    if (startDate) {
      const start = new Date(`${startDate}T00:00:00`)
      if (recordDate < start) return false
    }
    if (endDate) {
      const end = new Date(`${endDate}T23:59:59`)
      if (recordDate > end) return false
    }

    // 4) Search Query
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim()
      const matchName = String(row.recipient_name || '').toLowerCase().includes(query)
      const matchEmail = String(row.recipient_email || '').toLowerCase().includes(query)
      const matchTxn = String(row.transaction_id || '').toLowerCase().includes(query)
      if (!matchName && !matchEmail && !matchTxn) return false
    }

    return true
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

  // CSV Export Helper
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert('No records found to export.')
      return
    }

    // Define CSV headers
    const headers = [
      'Transaction ID',
      'Payout Type',
      'Recipient Name',
      'Recipient Email',
      'Amount (INR)',
      'Payout Date',
      'Status',
      'Bank Name',
      'Account Number',
      'Remarks'
    ]

    // Convert rows to CSV strings
    const rows = filteredRecords.map(r => [
      r.transaction_id || 'N/A',
      r.type,
      r.recipient_name || 'N/A',
      r.recipient_email || 'N/A',
      r.amount || 0,
      r.date ? new Date(r.date).toLocaleString() : 'N/A',
      r.status,
      r.bank_name || 'N/A',
      r.account_number ? `'${r.account_number}` : 'N/A', // single quote prefix to prevent Excel dropping leading zeroes
      (r.remarks || '').replace(/"/g, '""') // escape double quotes
    ])

    // Construct CSV file content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n')

    // Create download link and trigger click
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Payout_Settlement_Report_${new Date().toISOString().slice(0,10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#1f2937', padding: '24px', background: '#f9fafb', borderRadius: '16px', minHeight: '80vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            Payout & Settlement Ledger
          </h2>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Audit and export all verified salary payments and refund records.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={loadRecords}
            style={{ background: '#f3f4f6', border: '1px solid #d1d5db', padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}
          >
            🔄 Refresh
          </button>
          <button
            onClick={handleExportCSV}
            style={{ background: '#047857', border: 'none', color: '#ffffff', padding: '8px 18px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', fontWeight: '700', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
          >
            📥 Export report (CSV)
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Filters Panel */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Payout Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
            >
              <option value="all">All Transactions</option>
              <option value="Salary">Salaries Only</option>
              <option value="Refund">Refunds Only</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Payment Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="paid">Paid (Salaries)</option>
              <option value="completed">Completed (Refunds)</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
          <span style={{ fontSize: '16px' }}>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Recipient Name, Email, or Transaction ID..."
            style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' }}
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div style={{ background: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading financial ledger...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Reference ID</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Type</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Recipient Name</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Recipient Email</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Amount</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Destination Bank</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(row => {
                  const isSalary = row.type === 'Salary'
                  const statusColors = {
                    pending: { bg: '#fffbeb', text: '#d97706' },
                    processing: { bg: '#eff6ff', text: '#2563eb' },
                    paid: { bg: '#ecfdf5', text: '#059669' },
                    completed: { bg: '#ecfdf5', text: '#059669' },
                    failed: { bg: '#fef2f2', text: '#dc2626' }
                  }
                  const colors = statusColors[row.status] || { bg: '#f3f4f6', text: '#374151' }

                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontWeight: '600' }}>
                        {row.transaction_id || <span style={{ color: '#9ca3af', fontStyle: 'italic', fontWeight: 'normal' }}>No Ref</span>}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          background: isSalary ? '#f5f3ff' : '#fff1f2',
                          color: isSalary ? '#7c3aed' : '#e11d48',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}>
                          {row.type}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: '600', color: '#111827' }}>{row.recipient_name}</td>
                      <td style={{ padding: '14px 20px', color: '#4b5563' }}>{row.recipient_email}</td>
                      <td style={{ padding: '14px 20px', fontWeight: '700', color: isSalary ? '#047857' : '#b91c1c' }}>
                        {formatCurrency(row.amount)}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {row.bank_name ? (
                          <div style={{ fontSize: '11px' }}>
                            <strong>{row.bank_name}</strong> ({maskAccountNumber(row.account_number)})
                          </div>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>N/A</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        {row.date ? new Date(row.date).toLocaleString() : 'N/A'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', background: colors.bg, color: colors.text }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', color: '#6b7280', fontStyle: 'italic', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.remarks ? `"${row.remarks}"` : '-'}
                      </td>
                    </tr>
                  )
                })}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No payout records matches your active filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
