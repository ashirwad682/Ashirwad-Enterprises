import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAdminAuth } from '../../context/AdminAuthContext'

const rawBase = (import.meta.env.VITE_API_BASE || '').trim();
const API_BASE = rawBase ? rawBase.replace(/\/$/, '') : 'http://localhost:5001';

export default function NotificationsTab({ managerMode = false }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState(null)
  const [recentNotifications, setRecentNotifications] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [showUserSelector, setShowUserSelector] = useState(false)
  const [form, setForm] = useState({
    notificationType: 'announcement',
    targetAudience: 'all',
    title: '',
    message: '',
    actionLink: '',
    visualTheme: false,
    schedulingType: 'now',
    scheduleDate: ''
  })

  const { adminKey } = useAdminAuth ? useAdminAuth() : { adminKey: null }
  const managerToken = localStorage.getItem('manager_token')
  const authToken = managerMode ? managerToken : adminKey
  const authHeader = managerMode
    ? { 'x-manager-token': managerToken }
    : { 'x-admin-api-key': adminKey }

  useEffect(() => {
    if (!authToken) return
    fetchUsers()
    fetchRecentNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerMode, adminKey, managerToken])

  async function fetchUsers() {
    setLoading(true)
    setError(null)
    try {
      const endpoint = managerMode ? '/api/manager/users' : '/api/admin/users'
      const res = await fetch(`${API_BASE}${endpoint}`, { headers: authHeader })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchRecentNotifications() {
    try {
      const endpoint = managerMode ? '/api/manager/notifications/recent' : '/api/admin/notifications/recent'
      const res = await fetch(`${API_BASE}${endpoint}`, { headers: authHeader })
      if (res.ok) {
        const data = await res.json()
        setRecentNotifications(Array.isArray(data) ? data.slice(0, 5) : [])
      }
    } catch (err) {
      console.error('Failed to fetch recent notifications:', err)
    }
  }

  async function handleFullDelete(userId) {
    if (managerMode) return
    if (!window.confirm('Are you sure you want to permanently delete this user from both Auth and Profile? This cannot be undone.')) return
    setSubmitting(true)
    setStatus(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/full-delete`, {
        method: 'DELETE',
        headers: authHeader
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fully delete user')
      }
      setStatus({ type: 'success', text: 'User fully deleted from Auth and Profile.' })
      await fetchUsers()
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSend() {
    if (!form.title.trim() || !form.message.trim()) {
      setStatus({ type: 'error', text: 'Please fill in title and message fields.' })
      return
    }

    if (form.targetAudience === 'specific' && selectedUsers.length === 0) {
      setStatus({ type: 'error', text: 'Please select at least one user for specific targeting.' })
      return
    }

    setSubmitting(true)
    setStatus(null)

    try {
      let targetUsers = []

      if (form.targetAudience === 'all') {
        targetUsers = users
      } else if (form.targetAudience === 'active') {
        targetUsers = users.filter((u) => u.status === 'active' || !u.status)
      } else if (form.targetAudience === 'premium') {
        targetUsers = users.filter((u) => u.tier === 'premium' || u.plan === 'premium')
      } else if (form.targetAudience === 'specific') {
        targetUsers = users.filter((u) => selectedUsers.includes(u.id))
      }

      const notificationEndpoint = managerMode ? '/api/manager/notifications' : '/api/admin/notifications'

      let successCount = 0
      let failureCount = 0
      let firstFailureReason = ''

      for (const user of targetUsers) {
        try {
          const res = await fetch(`${API_BASE}${notificationEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({
              user_id: user.id,
              message: `${form.title}\n\n${form.message}`
            })
          })
          if (!res.ok) {
            const body = await res.json().catch(() => null)
            const apiError = body?.error || body?.message || ''
            throw new Error(apiError || `HTTP ${res.status}`)
          }
          successCount++
        } catch (err) {
          console.error(`Failed to send to user ${user.id}:`, err)
          failureCount++
          if (!firstFailureReason) {
            firstFailureReason = err?.message || 'Unknown error'
          }
        }
      }

      setForm({
        notificationType: 'announcement',
        targetAudience: 'all',
        title: '',
        message: '',
        actionLink: '',
        visualTheme: false,
        schedulingType: 'now',
        scheduleDate: ''
      })
      setSelectedUsers([])

      if (failureCount === 0) {
        setStatus({
          type: 'success',
          text: `Notification sent to ${successCount} user${successCount !== 1 ? 's' : ''}.`
        })
      } else {
        setStatus({
          type: 'error',
          text: `Sent to ${successCount} user${successCount !== 1 ? 's' : ''}, failed for ${failureCount}.${firstFailureReason ? ` Reason: ${firstFailureReason}` : ''}`
        })
      }

      await fetchRecentNotifications()
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveDraft() {
    setStatus({ type: 'success', text: 'Draft saved successfully.' })
  }

  function getNotificationIcon(type) {
    const icons = {
      announcement: '📢',
      order: '🚚',
      system: '⚙️',
      payment: '💳',
      inventory: '📦'
    }
    return icons[type] || '📢'
  }

  function getNotificationBadge(state) {
    const badges = {
      SCHEDULED: { bg: '#fef3c7', color: '#92400e', label: 'SCHEDULED' },
      SENT: { bg: '#d1fae5', color: '#065f46', label: 'SENT' },
      DRAFT: { bg: '#f1f5f9', color: '#475569', label: 'DRAFT' }
    }
    return badges[state] || badges.SENT
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
  if (error) return (
    <div style={{ padding: 20, background: '#fee', border: '1px solid #fcc', borderRadius: 8 }}>
      <div style={{ fontWeight: 700, color: '#c00', marginBottom: 8 }}>Failed to load users</div>
      <div style={{ color: '#666' }}>{error}</div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb', position: 'sticky', top: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 16 }}>🕐</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Recent Notifications</h3>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {recentNotifications.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No recent notifications
            </div>
          ) : (
            recentNotifications.map((notif, idx) => {
              const badge = getNotificationBadge(notif.status || 'SENT')
              return (
                <div key={idx} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: badge.bg,
                      color: badge.color,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.5px'
                    }}>
                      {badge.label}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      {notif.created_at ? new Date(notif.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                    {notif.title || notif.message?.split('\n')[0] || 'Notification'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                    {(notif.message || '').substring(0, 60)}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <button
          onClick={fetchRecentNotifications}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '8px 12px',
            background: 'transparent',
            border: 0,
            color: '#4f46e5',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          View All History
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: 32, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Compose Notification</h2>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Create updates, alerts, or announcements for distributors.</p>
          </div>
          <button style={{ background: 'transparent', border: 0, fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}>⚙️</button>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                Notification Type
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>
                  {getNotificationIcon(form.notificationType)}
                </span>
                <select
                  value={form.notificationType}
                  onChange={(e) => setForm({ ...form, notificationType: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 14,
                    color: '#0f172a',
                    background: '#fff',
                    cursor: 'pointer',
                    appearance: 'none'
                  }}
                >
                  <option value="announcement">Festive Announcement</option>
                  <option value="order">Order Update</option>
                  <option value="system">System Alert</option>
                  <option value="payment">Payment Notification</option>
                  <option value="inventory">Inventory Update</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                Target Audience
              </label>
              <button
                type="button"
                onClick={() => setShowUserSelector(!showUserSelector)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 14,
                  color: '#0f172a',
                  background: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  justifyContent: 'space-between'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>👥</span>
                  {form.targetAudience === 'specific'
                    ? `${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''} selected`
                    : form.targetAudience === 'all' ? 'All Distributors'
                    : form.targetAudience === 'active' ? 'Active Users Only'
                    : 'Premium Members'
                  }
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>▼</span>
              </button>
            </div>
          </div>

          {showUserSelector && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: 16,
                background: '#f8fafc',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                display: 'grid',
                gap: 12
              }}
            >
              <div>
                <label style={{ display: 'block', marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  Select Audience Mode
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  {['all', 'active', 'premium', 'specific'].map((mode) => {
                    const label = mode === 'all' ? 'All Users' : mode === 'active' ? 'Active Only' : mode === 'premium' ? 'Premium' : 'Specific Users'
                    return (
                      <label key={mode} style={{
                        padding: '10px 12px',
                        border: form.targetAudience === mode ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                        borderRadius: 8,
                        background: form.targetAudience === mode ? '#eef2ff' : '#fff',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: form.targetAudience === mode ? 700 : 500,
                        color: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <input
                          type="radio"
                          name="audience_mode"
                          value={mode}
                          checked={form.targetAudience === mode}
                          onChange={() => {
                            setForm({ ...form, targetAudience: mode })
                            if (mode !== 'specific') {
                              setSelectedUsers([])
                            }
                          }}
                          style={{ accentColor: '#4f46e5', cursor: 'pointer' }}
                        />
                        {label}
                      </label>
                    )
                  })}
                </div>
              </div>

              {form.targetAudience === 'specific' && (
                <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                      SELECT USERS ({selectedUsers.length} of {users.length})
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedUsers(users.map((u) => u.id))}
                        style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 4, color: '#4f46e5', cursor: 'pointer' }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedUsers([])}
                        style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 4, color: '#dc2626', cursor: 'pointer' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div style={{
                    maxHeight: 300,
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#fff',
                    display: 'grid',
                    gap: 0
                  }}>
                    {users.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                        No users available
                      </div>
                    ) : (
                      users.map((user, idx) => (
                        <label
                          key={user.id}
                          style={{
                            padding: '10px 12px',
                            borderBottom: idx < users.length - 1 ? '1px solid #f1f5f9' : 'none',
                            background: selectedUsers.includes(user.id) ? '#f0f9ff' : '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            transition: 'background 0.2s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUsers([...selectedUsers, user.id])
                              } else {
                                setSelectedUsers(selectedUsers.filter((id) => id !== user.id))
                              }
                            }}
                            style={{ accentColor: '#4f46e5', cursor: 'pointer', width: 16, height: 16 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {user.full_name || 'Unknown User'}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {user.email}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div style={{
                padding: 10,
                background: '#f0f9ff',
                border: '1px solid #bfdbfe',
                borderRadius: 6,
                fontSize: 12,
                color: '#1e40af',
                fontWeight: 500
              }}>
                {form.targetAudience === 'all' ? 'All distributors will receive this notification'
                  : form.targetAudience === 'active' ? `Only active users (${users.filter((u) => u.status === 'active').length || '0'} users) will receive this`
                  : form.targetAudience === 'premium' ? 'Only premium members will receive this notification'
                  : `${selectedUsers.length} selected user${selectedUsers.length !== 1 ? 's' : ''} will receive this notification`
                }
              </div>
            </motion.div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Notification Title <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Seasonal Celebration: Special Discounts on Bulk Orders"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 14,
                color: '#0f172a'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Message Content
            </label>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', gap: 8 }}>
                <button style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>B</button>
                <button style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontStyle: 'italic' }}>I</button>
                <button style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>U</button>
                <div style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }}></div>
                <button style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>≡</button>
                <button style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>⋮</button>
                <button style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>🔗</button>
                <button style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>🖼️</button>
              </div>

              <textarea
                rows={5}
                placeholder="Type your detailed notification message here..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: 0,
                  fontSize: 14,
                  color: '#0f172a',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Action Button Link <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>(Optional)</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <span style={{ padding: '10px 12px', background: '#f8fafc', fontSize: 13, color: '#64748b', borderRight: '1px solid #e5e7eb' }}>https://</span>
                <input
                type="text"
                placeholder="ashirwad.en/offers/seasonal-special"
                value={form.actionLink}
                onChange={(e) => setForm({ ...form, actionLink: e.target.value })}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: 0,
                  fontSize: 14,
                  color: '#0f172a'
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
              Adds a call-to-action button like 'View Offer' to the notification card.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🎨</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Visual Accents</span>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.visualTheme}
                    onChange={(e) => setForm({ ...form, visualTheme: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: form.visualTheme ? '#4f46e5' : '#cbd5e1',
                    borderRadius: 24,
                    transition: '0.3s'
                  }}>
                    <span style={{
                      position: 'absolute',
                      height: 18,
                      width: 18,
                      left: form.visualTheme ? 23 : 3,
                      top: 3,
                      background: '#fff',
                      borderRadius: '50%',
                      transition: '0.3s'
                    }}></span>
                  </span>
                </label>
              </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                Apply <strong>Seasonal Celebration Theme</strong><br />
                Adds watercolor splash style and seasonal colors to the recipient's notification view.
              </div>
            </div>

            <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>⏰</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Scheduling</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="scheduling"
                    checked={form.schedulingType === 'now'}
                    onChange={() => setForm({ ...form, schedulingType: 'now' })}
                    style={{ width: 16, height: 16, accentColor: '#4f46e5' }}
                  />
                  <span style={{ fontSize: 13, color: '#0f172a' }}>Send Now</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="scheduling"
                    checked={form.schedulingType === 'schedule'}
                    onChange={() => setForm({ ...form, schedulingType: 'schedule' })}
                    style={{ width: 16, height: 16, accentColor: '#4f46e5' }}
                  />
                  <span style={{ fontSize: 13, color: '#0f172a' }}>Schedule</span>
                </label>
              </div>
            </div>
          </div>

          {!managerMode && (
            <div style={{ padding: 20, background: '#fef2f2', border: '2px dashed #fca5a5', borderRadius: 12, marginTop: 12 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
                ⚠️ Permanently Delete User (Full Delete)
              </label>
              <select
                onChange={(e) => e.target.value && handleFullDelete(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #fca5a5',
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: 'pointer',
                  background: '#fff'
                }}
                defaultValue=""
                disabled={submitting}
              >
                <option value="">Select user to fully delete...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || 'Unknown'} • {u.email}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: '#991b1b', marginTop: 8, fontWeight: 500 }}>
                This will remove the user from both the users table and Supabase Auth. This action cannot be undone.
              </div>
            </div>
          )}

          {status && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: status.type === 'success' ? '#d1fae5' : '#fee2e2',
                color: status.type === 'success' ? '#065f46' : '#991b1b',
                border: `1px solid ${status.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
                fontSize: 14,
                fontWeight: 600
              }}
            >
              {status.text}
            </motion.div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={handleSaveDraft}
              disabled={submitting}
              style={{
                padding: '10px 20px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                color: '#0f172a',
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1
              }}
            >
              Save as Draft
            </button>
            <button
              onClick={() => {}}
              disabled={submitting}
              style={{
                padding: '10px 20px',
                background: '#fff',
                border: '1px solid #4f46e5',
                borderRadius: 8,
                color: '#4f46e5',
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              👁️ Preview
            </button>
            <button
              onClick={handleSend}
              disabled={submitting}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                border: 0,
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(79,70,229,0.3)'
              }}
            >
              {submitting ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
