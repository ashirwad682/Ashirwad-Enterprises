import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAdminAuth } from '../../context/AdminAuthContext'

const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')

export default function UsersTab({ managerMode }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  const { adminKey } = useAdminAuth ? useAdminAuth() : { adminKey: null }
  const managerToken = localStorage.getItem('manager_token')

  useEffect(() => {
    if (managerMode && !managerToken) return
    if (!managerMode && !adminKey) return
    fetchUsers()
  }, [adminKey, managerToken, managerMode])

  async function fetchUsers() {
    setLoading(true)
    setError(null)
    try {
      let url, headers
      if (managerMode) {
        url = `${API_BASE}/api/manager/users`
        headers = { 'x-manager-token': managerToken }
      } else {
        url = `${API_BASE}/api/admin/users`
        headers = { 'x-admin-key': adminKey }
      }
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Calculate stats
  const totalUsers = users.length
  const pendingVerification = users.filter(u => !u.is_verified).length

  // Filter and search users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (user.id && user.id.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesFilter = filterStatus === 'All' ||
                          (filterStatus === 'Verified' && user.is_verified) ||
                          (filterStatus === 'Pending' && !user.is_verified)
    return matchesSearch && matchesFilter
  })

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIdx = (currentPage - 1) * itemsPerPage
  const endIdx = startIdx + itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIdx, endIdx)

  const StatCard = ({ icon, label, value, delay }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        padding: '24px',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}
    >
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div>
        <div style={{ color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#1f2937' }}>
          {value}
        </div>
      </div>
    </motion.div>
  )

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getAvatarColor = (name) => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']
    let sum = 0
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i)
    }
    return colors[sum % colors.length]
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return '—'
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <div style={{ color: '#6b7280', fontSize: 16 }}>Loading users...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          paddingBottom: 24,
          borderBottom: '1px solid #e5e7eb'
        }}
      >
        <h1 style={{ margin: '0 0 8px 0', fontSize: 28, fontWeight: 800, color: '#0f172a' }}>
          User Management & Approvals
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Manage distributor access and verification status.
        </p>
      </motion.div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        <StatCard
          icon="👥"
          label="Total Users"
          value={totalUsers}
          delay={0.1}
        />
        <StatCard
          icon="⏳"
          label="Pending Verification"
          value={pendingVerification}
          delay={0.15}
        />
      </div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '20px',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by name, email or ID…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              style={{
                width: '100%',
                padding: '12px 16px 12px 40px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'inherit'
              }}
            />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 16 }}>
              🔍
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['All', 'Verified', 'Pending'].map(status => (
            <button
              key={status}
              onClick={() => {
                setFilterStatus(status)
                setCurrentPage(1)
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: filterStatus === status ? '#1d4ed8' : '#f3f4f6',
                color: filterStatus === status ? '#fff' : '#1f2937',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {status}
              {status === 'Pending' && ` ${pendingVerification > 0 ? '⚠' : ''}`}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Users Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
          gap: 20
        }}
      >
        {paginatedUsers.map((user, idx) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + idx * 0.05 }}
            style={{
              padding: '20px',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            {/* Avatar and Header */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: getAvatarColor(user.full_name),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 18
                }}
              >
                {getInitials(user.full_name)}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {user.full_name}
                  <span
                    style={{
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 4,
                      background: user.is_verified ? '#d1fae5' : '#fef3c7',
                      color: user.is_verified ? '#065f46' : '#b45309'
                    }}
                  >
                    {user.is_verified ? '✓ Verified' : '⏳ Pending'}
                  </span>
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                  ID: {user.id?.slice(0, 12).toUpperCase()}...
                </p>
              </div>
            </div>

            {/* User Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, fontSize: 13, color: '#6b7280' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>📧</span>
                <span>{user.email}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🏢</span>
                <span>{user.role || 'Distributor'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>📅</span>
                <span>Active since {formatDate(user.created_at)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              {user.is_verified && (
                <button
                  onClick={() => {
                    if (confirm('Revoke access for this user?')) {
                      // Handle revoke
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#fca5a5'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#fee2e2'
                  }}
                >
                  🚫 Revoke
                </button>
              )}
              {!user.is_verified && (
                <button
                  onClick={() => {
                    if (confirm('Verify this user?')) {
                      // Handle verify
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#dbeafe',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#93c5fd'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#dbeafe'
                  }}
                >
                  ✓ Verify
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm('Delete this user?')) {
                    // Handle delete
                  }
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: '#f3f4f6',
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#e5e7eb'
                  e.target.style.color = '#1f2937'
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f3f4f6'
                  e.target.style.color = '#6b7280'
                }}
              >
                🗑️ Delete
              </button>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {filteredUsers.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            textAlign: 'center',
            padding: '60px 24px',
            background: '#f9fafb',
            borderRadius: 12,
            border: '1px solid #e5e7eb'
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: '#1f2937' }}>
            No users found
          </h3>
          <p style={{ color: '#6b7280', margin: 0 }}>Try adjusting your search or filters</p>
        </motion.div>
      )}

      {/* Pagination */}
      {filteredUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 20,
            borderTop: '1px solid #e5e7eb',
            fontSize: 14,
            color: '#6b7280'
          }}
        >
          <span>
            Showing {startIdx + 1}-{Math.min(endIdx, filteredUsers.length)} of {filteredUsers.length} users
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '8px 12px',
                background: currentPage === 1 ? '#f3f4f6' : '#fff',
                color: currentPage === 1 ? '#9ca3af' : '#1f2937',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                style={{
                  padding: '8px 12px',
                  background: currentPage === page ? '#1d4ed8' : '#f3f4f6',
                  color: currentPage === page ? '#fff' : '#1f2937',
                  border: `1px solid ${currentPage === page ? '#1d4ed8' : '#e5e7eb'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 12px',
                background: currentPage === totalPages ? '#f3f4f6' : '#fff',
                color: currentPage === totalPages ? '#9ca3af' : '#1f2937',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Next
            </button>
          </div>
        </motion.div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#fee2e2',
          color: '#b91c1c',
          border: '1px solid #fecaca',
          borderRadius: 8,
          fontSize: 13
        }}>
          Error: {error}
        </div>
      )}
    </div>
  )
}
