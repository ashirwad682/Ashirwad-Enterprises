import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api/client'

const FILTER_TABS = ['All', 'Unread', 'Account', 'Orders', 'Payments', 'Announcements', 'System']

function getLocalReadStorageKey(userId) {
  return `notifications_read_${userId}`
}

function getLocallyReadNotificationIds(userId) {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(getLocalReadStorageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((value) => String(value))
  } catch {
    return []
  }
}

function saveLocallyReadNotificationIds(userId, ids) {
  if (!userId) return
  const uniqueIds = [...new Set((ids || []).map((value) => String(value)).filter(Boolean))]
  try {
    localStorage.setItem(getLocalReadStorageKey(userId), JSON.stringify(uniqueIds))
  } catch {
    // Ignore storage failures and continue with server-driven state.
  }
}

function normalizeNotificationMessage(message) {
  if (typeof message !== 'string') return 'You have a new update from the admin team.'
  const trimmed = message.trim()
  return trimmed || 'You have a new update from the admin team.'
}

function parseStructuredNotification(message) {
  if (typeof message !== 'string') return null

  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const titleLine = (lines[0] || '').toLowerCase()

  if (titleLine === 'delivery partner assigned' && lines.length >= 3) {
    const bodyLine = lines[1] || ''
    const detailMap = new Map()
    for (const line of lines.slice(1)) {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex === -1) continue
      const key = line.slice(0, separatorIndex).trim().toLowerCase()
      const value = line.slice(separatorIndex + 1).trim()
      if (value) detailMap.set(key, value)
    }
    const partnerMatch = bodyLine.match(/delivery partner\s+(.+?)\.$/)
    const partnerName = partnerMatch
      ? partnerMatch[1].trim()
      : (detailMap.get('delivery partner') || '')
    return {
      heading: 'Delivery Partner Assigned',
      partnerName,
      bodyLine,
      orderId: detailMap.get('order id') || '',
      amount: detailMap.get('amount') || '',
      paymentMethod: detailMap.get('payment method') || ''
    }
  }

  if (titleLine === 'order approved' && lines.length >= 2) {
    const bodyLine = lines[1] || ''
    return { heading: 'Order Approved', bodyLine }
  }

  if (titleLine === 'stock update notification' && lines.length >= 5) {
    const bodyLine = lines[1] || ''
    const detailMap = new Map()
    for (const line of lines.slice(2)) {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex === -1) continue
      const key = line.slice(0, separatorIndex).trim().toLowerCase()
      const value = line.slice(separatorIndex + 1).trim()
      if (value) detailMap.set(key, value)
    }
    const nameMatch = bodyLine.match(/\*\*(.+?)\*\*/)
    const productName = nameMatch ? nameMatch[1] : ''
    return {
      heading: 'Stock Update Notification',
      bodyLine,
      productName,
      productDescription: detailMap.get('product description') || '',
      previousStock: detailMap.get('previous stock') || '',
      updatedStock: detailMap.get('updated stock') || ''
    }
  }

  return null
}

function getNotificationMeta(message) {
  const msg = message.toLowerCase()
  const structured = parseStructuredNotification(message)

  if (structured && structured.heading.toLowerCase() === 'order approved') {
    return {
      type: 'orders',
      title: 'Order Approved',
      icon: '📦',
      iconBg: '#dbeafe',
      iconColor: '#1d4ed8',
      assignedLines: [structured.bodyLine],
      action: { text: 'View Orders', link: '/dashboard/orders' }
    }
  }

  if (structured && structured.heading === 'Stock Update Notification') {
    const titleText = structured.productName
      ? `Stock Updated — ${structured.productName}`
      : 'Stock Update Notification'
    return {
      type: 'promotions',
      title: titleText,
      icon: '📦',
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      assignedLines: [
        structured.bodyLine.replace(/\*\*(.+?)\*\*/g, '$1'),
        `Product Description: ${structured.productDescription}`,
        `Previous Stock: ${structured.previousStock}`,
        `Updated Stock: ${structured.updatedStock}`
      ],
      action: { text: 'View Product', link: '/dashboard/products' }
    }
  }

  if (structured && structured.heading === 'Delivery Partner Assigned') {
    const titleText = structured.partnerName
      ? `Delivery Partner Assigned `
      : 'Delivery Partner Assigned'
    const hasSentenceBody = structured.bodyLine.toLowerCase().includes('delivery partner')
    const textLines = hasSentenceBody
      ? [
          structured.bodyLine,
          `Amount: ${structured.amount}`,
          `Payment Method: ${structured.paymentMethod}`
        ]
      : [
          `Your order (Order ID: ${structured.orderId || structured.bodyLine}) has assigned to the delivery partner ${structured.partnerName || 'N/A'}.`,
          `Amount: ${structured.amount}`,
          `Payment Method: ${structured.paymentMethod}`
        ]
    return {
      type: 'orders',
      title: titleText,
      icon: '🚚',
      iconBg: '#d1fae5',
      iconColor: '#059669',
      assignedLines: textLines,
      action: { text: 'Track Order', link: '/dashboard/orders' }
    }
  }

  if (
    msg.includes('account')
    || msg.includes('verify')
    || msg.includes('verification')
    || msg.includes('approved by admin')
    || msg.includes('rejected by admin')
    || msg.includes('document')
  ) {
    const isApproved = msg.includes('approved') || msg.includes('verified')
    const isRejected = msg.includes('rejected') || msg.includes('revoked')

    return {
      type: 'account',
      title: isApproved
        ? 'Account Approved'
        : isRejected
          ? 'Verification Action Needed'
          : 'Account Verification Update',
      icon: isApproved ? '✅' : isRejected ? '🛡️' : '📄',
      iconBg: isApproved ? '#dcfce7' : '#fee2e2',
      iconColor: isApproved ? '#166534' : '#b91c1c',
      action: {
        text: isApproved ? 'Start Ordering' : 'Open Profile',
        link: isApproved ? '/dashboard/products' : '/dashboard/profile'
      }
    }
  }

  if (
    msg.includes('order')
    || msg.includes('dispatch')
    || msg.includes('shipped')
    || msg.includes('delivery')
    || msg.includes('tracking')
  ) {
    return {
      type: 'orders',
      title: 'Order Status Update',
      icon: '🚚',
      iconBg: '#dbeafe',
      iconColor: '#1d4ed8',
      action: { text: 'Track Orders', link: '/dashboard/track-order' }
    }
  }

  if (
    msg.includes('payment')
    || msg.includes('invoice')
    || msg.includes('receipt')
    || msg.includes('settlement')
  ) {
    return {
      type: 'payments',
      title: 'Payment Notification',
      icon: '💳',
      iconBg: '#dcfce7',
      iconColor: '#166534',
      action: { text: 'View Orders', link: '/dashboard/orders' }
    }
  }

  if (
    msg.includes('offer')
    || msg.includes('discount')
    || msg.includes('promotion')
    || msg.includes('festival')
    || msg.includes('festive')
    || msg.includes('seasonal')
  ) {
    return {
      type: 'announcement',
      title: 'Offer & Promotion Update',
      icon: '📢',
      iconBg: '#fce7f3',
      iconColor: '#be185d',
      action: { text: 'Browse Offers', link: '/dashboard/products' }
    }
  }

  return {
    type: 'system',
    title: 'System Update',
    icon: '⚙️',
    iconBg: '#e2e8f0',
    iconColor: '#334155',
    action: null
  }
}

function getTimeAgo(dateString) {
  if (!dateString) return 'Just now'

  const now = new Date()
  const past = new Date(dateString)

  if (Number.isNaN(past.getTime())) return 'Just now'

  const diffMs = now - past
  const diffMins = Math.max(Math.floor(diffMs / 60000), 0)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays === 1) {
    return 'Yesterday, ' + past.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', '
    + past.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function filterToType(filter) {
  if (filter === 'Announcements') return 'announcement'
  return filter.toLowerCase()
}

export default function Notifications() {
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('All')
  const [visibleCount, setVisibleCount] = useState(10)
  const [updatingIds, setUpdatingIds] = useState([])
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        if (!user) {
          setError('You need to sign in to view notifications.')
          setLoading(false)
          return
        }

        setUserId(user.id)
        const items = await fetchNotifications(user.id)
        const localReadIds = new Set(getLocallyReadNotificationIds(user.id))
        const normalizedItems = Array.isArray(items)
          ? items.map((item) => ({
              ...item,
              is_read: Boolean(item?.is_read) || localReadIds.has(String(item?.id || ''))
            }))
          : []

        setNotifications(normalizedItems)
      } catch (err) {
        console.error('Failed to fetch notifications:', err)
        setError(err.message || 'Failed to fetch notifications')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const enhancedNotifications = useMemo(() => {
    return notifications.map((note) => {
      const normalizedMessage = normalizeNotificationMessage(note?.message)
      const meta = getNotificationMeta(normalizedMessage)

      return {
        ...note,
        message: normalizedMessage,
        ...meta
      }
    })
  }, [notifications])

  const unreadCount = enhancedNotifications.filter((note) => !Boolean(note.is_read)).length

  const filteredNotifications = enhancedNotifications.filter((note) => {
    if (filter === 'All') return true
    if (filter === 'Unread') return !Boolean(note.is_read)
    return note.type === filterToType(filter)
  })

  const displayedNotifications = filteredNotifications.slice(0, visibleCount)

  const getFilterCount = (tab) => {
    if (tab === 'All') return enhancedNotifications.length
    if (tab === 'Unread') return unreadCount
    const tabType = filterToType(tab)
    return enhancedNotifications.filter((note) => note.type === tabType).length
  }

  async function handleMarkAsRead(notificationId) {
    if (!notificationId || updatingIds.includes(notificationId)) return

    setActionError('')

    // Optimistic update keeps UX responsive even on slower connections.
    setNotifications((prev) => prev.map((item) => (
      String(item.id) === String(notificationId)
        ? { ...item, is_read: true }
        : item
    )))

    const localReadIds = new Set(getLocallyReadNotificationIds(userId))
    localReadIds.add(String(notificationId))
    saveLocallyReadNotificationIds(userId, [...localReadIds])

    setUpdatingIds((prev) => [...prev, notificationId])
    try {
      await markNotificationRead(notificationId, true)
    } catch (err) {
      // Fallback to direct Supabase update if backend route is unavailable.
      try {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId)

        if (updateError) {
          throw updateError
        }
      } catch (fallbackErr) {
        console.error('Failed to mark notification as read:', fallbackErr)
        setActionError('Could not sync read status to server. Showing it as read locally.')
      }
    } finally {
      setUpdatingIds((prev) => prev.filter((id) => id !== notificationId))
    }
  }

  async function handleMarkAllAsRead() {
    if (!userId || unreadCount === 0 || markingAllRead) return

    setActionError('')

    const currentIds = notifications
      .map((item) => String(item?.id || ''))
      .filter(Boolean)
    saveLocallyReadNotificationIds(userId, currentIds)

    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })))

    setMarkingAllRead(true)
    try {
      await markAllNotificationsRead(userId)
    } catch (err) {
      try {
        const unreadIds = notifications
          .filter((item) => !Boolean(item?.is_read))
          .map((item) => item.id)

        if (unreadIds.length > 0) {
          const { error: fallbackErr } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds)

          if (fallbackErr) {
            throw fallbackErr
          }
        }
      } catch (fallbackErr) {
        console.error('Failed to mark all notifications as read:', fallbackErr)
        setActionError('Could not sync all read statuses to server. Updates saved locally for now.')
      }
    } finally {
      setMarkingAllRead(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>Loading notifications...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#dc2626', fontSize: 16 }}>{error}</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700, color: '#0f172a' }}>Notifications</h2>
        <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
          Stay updated on account verification, order progress, payment updates, and announcements from Ashirwad HQ.
        </p>
      </div>



      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <button
          onClick={handleMarkAllAsRead}
          disabled={unreadCount === 0 || markingAllRead}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: unreadCount === 0 ? '#f8fafc' : '#fff',
            color: unreadCount === 0 ? '#94a3b8' : '#0f172a',
            fontSize: 13,
            fontWeight: 600,
            cursor: unreadCount === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          {markingAllRead ? 'Marking...' : unreadCount === 0 ? 'All Caught Up' : 'Mark All As Read'}
        </button>
      </div>

      {actionError ? (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          {actionError}
        </div>
      ) : null}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              border: filter === tab ? '2px solid #4f46e5' : '1px solid #e5e7eb',
              background: filter === tab ? '#4f46e5' : '#fff',
              color: filter === tab ? '#fff' : '#64748b',
              fontWeight: filter === tab ? 600 : 500,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {tab}
            {getFilterCount(tab) > 0 && (
              <span style={{
                background: filter === tab ? 'rgba(255,255,255,0.3)' : '#fecaca',
                color: filter === tab ? '#fff' : '#dc2626',
                padding: '2px 6px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700
              }}>
                {getFilterCount(tab)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {displayedNotifications.length === 0 ? (
        <div style={{
          background: '#fef3f2',
          border: '2px dashed #fca5a5',
          borderRadius: 16,
          padding: 60,
          textAlign: 'center',
          color: '#64748b'
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>No notifications in this filter</div>
          <div style={{ fontSize: 14 }}>Try switching to another tab or check back later for new updates</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {displayedNotifications.map((note, idx) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              style={{
                background: '#fff',
                border: !note.is_read ? '2px solid #fce7f3' : '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 20,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Top accent border for unread */}
              {!note.is_read && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: 'linear-gradient(90deg, #ec4899, #f472b6)'
                }} />
              )}

              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Icon */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: note.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0
                }}>
                  {note.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: '#0f172a' }}>
                        {note.title}
                        {!Boolean(note.is_read) && (
                          <span style={{
                            marginLeft: 8,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: '#fecaca',
                            color: '#dc2626',
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.5px'
                          }}>
                            NEW
                          </span>
                        )}
                      </h4>
                      {Array.isArray(note.assignedLines) ? (
                        <div style={{ marginTop: 6 }}>
                          {note.assignedLines.map((line, i) => (
                            <p key={i} style={{
                              margin: i === 0 ? '0 0 6px' : '0 0 4px',
                              fontSize: 14,
                              color: i === 0 ? '#334155' : '#64748b',
                              lineHeight: 1.6,
                              fontWeight: i === 0 ? 500 : 400
                            }}>
                              {line}
                            </p>
                          ))}
                        </div>
                      ) : Array.isArray(note.details) && note.details.length > 0 ? (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                            gap: 10,
                            marginTop: 8
                          }}
                        >
                          {note.details.map((detail) => (
                            <div
                              key={detail.label}
                              style={{
                                borderRadius: 10,
                                border: '1px solid #dbeafe',
                                background: '#f8fbff',
                                padding: '10px 12px'
                              }}
                            >
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                                {detail.label}
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', lineHeight: 1.4 }}>
                                {detail.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
                          {note.message}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      ⏱ {getTimeAgo(note.created_at)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    {!Boolean(note.is_read) && (
                      <button
                        onClick={() => handleMarkAsRead(note.id)}
                        disabled={updatingIds.includes(note.id)}
                        style={{
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#0f172a',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: updatingIds.includes(note.id) ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {updatingIds.includes(note.id) ? 'Saving...' : 'Mark as Read'}
                      </button>
                    )}

                    {note.action?.link && (
                      <button
                        onClick={() => navigate(note.action.link)}
                        style={{
                          border: '1px solid #c7d2fe',
                          background: '#eef2ff',
                          color: '#4338ca',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {note.action.text}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {filteredNotifications.length > visibleCount && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button
            onClick={() => setVisibleCount(prev => prev + 10)}
            style={{
              padding: '10px 24px',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              color: '#64748b',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4f46e5'
              e.currentTarget.style.color = '#4f46e5'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.color = '#64748b'
            }}
          >
            ↓ Load older notifications
          </button>
        </div>
      )}
    </div>
  )
}
