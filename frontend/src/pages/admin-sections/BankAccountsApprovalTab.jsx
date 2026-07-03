import React, { useState, useEffect } from 'react'
import { fetchAdminBankAccounts, adminApproveBankAccount, adminRejectBankAccount, adminRequestChangesBankAccount } from '../../api/client'
import { motion, AnimatePresence } from 'framer-motion'

export default function BankAccountsApprovalTab({ adminKey }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filter state: 'pending' | 'approved' | 'all'
  const [statusFilter, setStatusFilter] = useState('pending')

  // Search query
  const [searchQuery, setSearchQuery] = useState('')

  // Action state (for note dialogs)
  const [activeAction, setActiveAction] = useState(null) // { account, type: 'approve'|'reject'|'request-changes' }
  const [adminNotes, setAdminNotes] = useState('')
  const [notesError, setNotesError] = useState('')

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await fetchAdminBankAccounts(adminKey)
      setAccounts(data || [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to fetch bank accounts')
    } finally {
      setLoading(false)
    }
  }

  const handleActionClick = (account, type) => {
    setActiveAction({ account, type })
    setAdminNotes('')
    setNotesError('')
  }

  const handleActionSubmit = async () => {
    if (!activeAction) return
    const { account, type } = activeAction

    if (type === 'request-changes' && !adminNotes.trim()) {
      setNotesError('Notes are required when requesting changes.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setLoading(true)

      let res
      if (type === 'approve') {
        res = await adminApproveBankAccount(adminKey, account.id, adminNotes)
      } else if (type === 'reject') {
        res = await adminRejectBankAccount(adminKey, account.id, adminNotes)
      } else if (type === 'request-changes') {
        res = await adminRequestChangesBankAccount(adminKey, account.id, adminNotes)
      }

      if (res.success) {
        setSuccess(`Successfully processed bank account request (${type}d).`)
        setActiveAction(null)
        loadAccounts()
      }
    } catch (err) {
      setError(err.message || 'Action failed')
      setLoading(false)
    }
  }

  const filteredAccounts = accounts.filter(acc => {
    // 1. Status Filter
    if (statusFilter === 'pending' && acc.approval_status !== 'pending') return false
    if (statusFilter === 'approved' && acc.approval_status !== 'approved') return false

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const ownerName = acc.owner?.name?.toLowerCase() || ''
      const ownerEmail = acc.owner?.email?.toLowerCase() || ''
      const bank = acc.bank_name?.toLowerCase() || ''
      const accNum = acc.account_number?.toLowerCase() || ''
      const holder = acc.account_holder_name?.toLowerCase() || ''
      const ifsc = acc.ifsc_code?.toLowerCase() || ''

      return ownerName.includes(q) ||
             ownerEmail.includes(q) ||
             bank.includes(q) ||
             accNum.includes(q) ||
             holder.includes(q) ||
             ifsc.includes(q)
    }

    return true
  })

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: '600' }}>Approved</span>
      case 'rejected':
        return <span style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '4px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: '600' }}>Rejected</span>
      case 'changes_requested':
        return <span style={{ background: '#fef9c3', color: '#a16207', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: '600' }}>Changes Requested</span>
      default:
        return <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: '600' }}>Pending Approval</span>
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>🏦 Bank Account Submissions</h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '4px 0 0' }}>Approve, reject, or request updates on user, manager, and delivery partner bank accounts.</p>
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={loadAccounts} style={{ borderRadius: 8 }}>
          🔄 Refresh List
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          {success}
        </div>
      )}

      {/* Filters and Search */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setStatusFilter('pending')}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: '1px solid',
              borderColor: statusFilter === 'pending' ? '#3b82f6' : '#cbd5e1',
              background: statusFilter === 'pending' ? '#eff6ff' : '#fff',
              color: statusFilter === 'pending' ? '#1d4ed8' : '#334155',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ⏳ Pending
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: '1px solid',
              borderColor: statusFilter === 'approved' ? '#10b981' : '#cbd5e1',
              background: statusFilter === 'approved' ? '#ecfdf5' : '#fff',
              color: statusFilter === 'approved' ? '#047857' : '#334155',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🟢 Approved
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: '1px solid',
              borderColor: statusFilter === 'all' ? '#64748b' : '#cbd5e1',
              background: statusFilter === 'all' ? '#f8fafc' : '#fff',
              color: statusFilter === 'all' ? '#334155' : '#334155',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            📋 All Submissions
          </button>
        </div>

        <div style={{ flex: 1, maxWidth: 360, minWidth: 200 }}>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Search by owner name, bank, account..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ borderRadius: 8, padding: '8px 12px' }}
          />
        </div>
      </div>

      {loading && accounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#f8fafc',
          borderRadius: 16,
          border: '1px dashed #cbd5e1'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
          <h4 style={{ color: '#475569', fontWeight: '600' }}>No submissions found</h4>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Try changing your filter settings or search terms.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {filteredAccounts.map((acc) => (
            <motion.div
              layout
              key={acc.id}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                padding: 20,
                boxShadow: '0 2px 8px rgba(148, 163, 184, 0.05)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: acc.role === 'Manager' ? '#fef3c7' : (acc.role === 'Delivery Partner' ? '#dbeafe' : '#f3f4f6'),
                      color: acc.role === 'Manager' ? '#d97706' : (acc.role === 'Delivery Partner' ? '#1d4ed8' : '#374151'),
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      {acc.role}
                    </span>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                      {acc.owner?.name || 'Unknown User'}
                    </h3>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>{acc.owner?.email}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {getStatusBadge(acc.approval_status)}
                  {acc.is_verified && (
                    <span style={{ background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: 99, fontSize: '0.725rem', fontWeight: '700' }}>
                      ✓ IFSC Verified
                    </span>
                  )}
                </div>
              </div>

              <div style={{
                background: '#f8fafc',
                borderRadius: 12,
                padding: 16,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
                fontSize: '0.875rem'
              }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600' }}>ACCOUNT HOLDER NAME</div>
                  <div style={{ color: '#1e293b', fontWeight: '500', marginTop: 2 }}>{acc.account_holder_name}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600' }}>BANK NAME</div>
                  <div style={{ color: '#1e293b', fontWeight: '500', marginTop: 2 }}>{acc.bank_name}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600' }}>ACCOUNT NUMBER</div>
                  <div style={{ color: '#1e293b', fontWeight: '600', marginTop: 2 }}>{acc.account_number}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600' }}>IFSC CODE</div>
                  <div style={{ color: '#1e293b', fontWeight: '600', marginTop: 2 }}>{acc.ifsc_code}</div>
                </div>
                {acc.branch_name && (
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600' }}>BRANCH NAME</div>
                    <div style={{ color: '#1e293b', fontWeight: '500', marginTop: 2 }}>{acc.branch_name}</div>
                  </div>
                )}
                {acc.upi_id && (
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600' }}>UPI ID</div>
                    <div style={{ color: '#1e293b', fontWeight: '500', marginTop: 2 }}>{acc.upi_id}</div>
                  </div>
                )}
              </div>

              {/* Verified post office address if available */}
              {(acc.branch_address || acc.state) && (
                <div style={{ marginTop: 10, fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: 12 }}>
                  {acc.branch_address && <span>📍 <strong>Address:</strong> {acc.branch_address}</span>}
                  {acc.district && <span>🏙️ <strong>District:</strong> {acc.district}</span>}
                  {acc.state && <span>🗺️ <strong>State:</strong> {acc.state}</span>}
                </div>
              )}

              {/* Admin Notes */}
              {acc.admin_notes && (
                <div style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 8,
                  background: acc.approval_status === 'changes_requested' ? '#fefce8' : '#f8fafc',
                  border: '1px solid',
                  borderColor: acc.approval_status === 'changes_requested' ? '#fef08a' : '#e2e8f0',
                  fontSize: '0.8rem',
                  color: '#475569'
                }}>
                  <strong>Notes:</strong> {acc.admin_notes}
                </div>
              )}

              {/* Action Buttons for Pending */}
              {acc.approval_status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button
                    onClick={() => handleActionClick(acc, 'approve')}
                    className="btn btn-success btn-sm"
                    style={{ borderRadius: 8, fontWeight: '600' }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleActionClick(acc, 'request-changes')}
                    className="btn btn-warning btn-sm"
                    style={{ borderRadius: 8, fontWeight: '600' }}
                  >
                    ⚠️ Request Changes
                  </button>
                  <button
                    onClick={() => handleActionClick(acc, 'reject')}
                    className="btn btn-danger btn-sm"
                    style={{ borderRadius: 8, fontWeight: '600' }}
                  >
                    ❌ Reject
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Action Dialog Modal */}
      <AnimatePresence>
        {activeAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.4)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 1050,
              padding: 16
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#fff',
                borderRadius: 16,
                padding: 24,
                width: '100%',
                maxWidth: 480,
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0, textTransform: 'capitalize' }}>
                {activeAction.type.replace('-', ' ')} Bank Account
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 4 }}>
                For {activeAction.account.owner?.name} ({activeAction.account.role})
              </p>

              {notesError && (
                <div style={{ color: '#dc2626', fontSize: '0.8rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px', marginTop: 12 }}>
                  {notesError}
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: '600', marginBottom: 6, display: 'block' }}>
                  {activeAction.type === 'request-changes' ? 'Requested Changes Description *' : 'Admin Notes (Optional)'}
                </label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={activeAction.type === 'request-changes' ? 'Describe what needs to be changed (e.g. Account number doesn\'t match provided passbook)...' : 'Add internal notes or instructions...'}
                  style={{ borderRadius: 8 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                <button
                  onClick={() => setActiveAction(null)}
                  className="btn btn-light btn-sm"
                  style={{ borderRadius: 8, padding: '8px 16px', fontWeight: '500' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleActionSubmit}
                  className={`btn btn-${activeAction.type === 'approve' ? 'success' : (activeAction.type === 'reject' ? 'danger' : 'warning')} btn-sm`}
                  style={{ borderRadius: 8, padding: '8px 16px', fontWeight: '600', textTransform: 'capitalize' }}
                >
                  Confirm {activeAction.type}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
