import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, getCachedDataSync } from '../api/client'

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

function isCodAndUnpaid(message) {
  if (typeof message !== 'string') return false
  const msg = message.toLowerCase()
  return msg.includes('cod (unpaid)') || (msg.includes('cod') && msg.includes('unpaid'))
}

function formatProductDescription(value) {
  if (!value) return ''
  let descText = value.trim()
  
  try {
    const parsed = JSON.parse(descText)
    if (parsed && typeof parsed === 'object') {
      descText = parsed.description || parsed.desc || descText
    }
  } catch (e) {
    // Not valid JSON, keep as is
  }
  
  const parts = descText.split('|')
  if (parts.length >= 2) {
    descText = `${parts[0].trim()} | ${parts[1].trim()}`
  }
  
  return descText
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
      paymentMethod: detailMap.get('payment method') || '',
      partnerPhone: detailMap.get('delivery partner phone') || detailMap.get('partner phone') || detailMap.get('phone') || detailMap.get('contact') || ''
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
      productDescription: formatProductDescription(detailMap.get('product description') || ''),
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
      action: { text: 'Track Order', link: '/dashboard/orders' },
      partnerPhone: structured.partnerPhone
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

  const cachedNotifs = getCachedDataSync('notifications_current_user')
  const [notifications, setNotifications] = useState(cachedNotifs || [])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(!cachedNotifs)
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
        if (!cachedNotifs) {
          setError(err.message || 'Failed to fetch notifications')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [cachedNotifs])

  const enhancedNotifications = useMemo(() => {
    return notifications.map((note) => {
      const normalizedMessage = normalizeNotificationMessage(note?.message)
      const meta = getNotificationMeta(normalizedMessage)

      let partnerPhone = meta.partnerPhone || ''
      if (!partnerPhone) {
        const phoneMatch = normalizedMessage.match(/(?:delivery partner phone|partner phone|phone|contact):\s*([+\d\s\-()]+)/i)
        if (phoneMatch) {
          partnerPhone = phoneMatch[1].trim()
        }
      }

      return {
        ...note,
        message: normalizedMessage,
        ...meta,
        partnerPhone
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

  async function handleCallPartner(note) {
    if (note.partnerPhone) {
      window.location.href = `tel:${note.partnerPhone}`
      return
    }

    const msg = note.message || ''
    const orderIdMatch = msg.match(/Order ID:\s*#?([A-Za-z0-9-]+)/i)
    const orderId = orderIdMatch ? orderIdMatch[1].trim() : ''

    const partnerMatch = msg.match(/(?:delivery partner|partner)\s+([^.\n:]+)/i)
    const partnerName = partnerMatch ? partnerMatch[1].trim() : ''

    let phone = ''

    try {
      if (orderId) {
        // Query the order search API on the backend (safe from client RLS and UUID conversion errors)
        // Determine API base: use VITE_BACKEND_URL if set; if not set and not in production, fallback to localhost:5001
        let rawApiBase = (import.meta.env.VITE_BACKEND_URL || '').trim();
        if (!rawApiBase && !import.meta.env.PROD) {
          rawApiBase = 'http://localhost:5001';
        }
        const API_BASE = rawApiBase ? rawApiBase.replace(/\/$/, '') : '';
        const fetchUrl = API_BASE ? `${API_BASE}/api/orders/search/${encodeURIComponent(orderId)}` : `/api/orders/search/${encodeURIComponent(orderId)}`;
        console.log('Fetching order details from', fetchUrl);
        const res = await fetch(fetchUrl);
        if (res.ok) {
          const orderRecord = await res.json();
          if (orderRecord?.delivery_partner?.mobile_number) {
            phone = orderRecord.delivery_partner.mobile_number;
          }
        } else {
          console.warn('Order search API responded with non‑OK status:', res.status);
        }
      }

      if (!phone && partnerName) {
        try {
          const { data: dpData } = await supabase
            .from('delivery_partners')
            .select('mobile_number')
            .eq('name', partnerName)
            .maybeSingle()

          if (dpData?.mobile_number) {
            phone = dpData.mobile_number
          }
        } catch (fallbackErr) {
          console.warn('Frontend fallback partner phone lookup failed:', fallbackErr)
        }
      }

      if (phone) {
        window.location.href = `tel:${phone}`
      } else {
        alert('Could not retrieve delivery partner contact details. Please contact support.')
      }
    } catch (err) {
      console.error('Failed to dynamically fetch delivery partner phone:', err)
      alert('Error connecting call. Please try again.')
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
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 24, paddingBottom: 40 }}>
      {/* Header Banner */}
      <motion.section
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, #fdfbfa 0%, #faf6f0 100%)',
          border: '1px solid #ebd2aa',
          borderRadius: 24,
          padding: '32px 28px',
          color: '#0f172a',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 12px 30px rgba(44, 36, 22, 0.05)'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'grid', gap: 6, flex: 1, minWidth: 280 }}>
            <span style={{ fontSize: 11, background: '#fff1dd', color: '#ff671f', border: '1px solid rgba(255, 103, 31, 0.25)', borderRadius: 8, padding: '4px 10px', width: 'fit-content', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Inbox updates
            </span>
            <h1 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Notifications Center</h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
              Receive important messages regarding account verification status, order updates, payment confirmations, and special offers.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: unreadCount === 0 || markingAllRead ? 1 : 1.03 }}
            whileTap={{ scale: unreadCount === 0 || markingAllRead ? 1 : 0.97 }}
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || markingAllRead}
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              border: 'none',
              background: unreadCount === 0 ? 'rgba(0, 0, 0, 0.05)' : 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)',
              color: unreadCount === 0 ? '#94a3b8' : '#fff',
              fontSize: 13,
              fontWeight: 800,
              cursor: unreadCount === 0 ? 'not-allowed' : 'pointer',
              boxShadow: unreadCount === 0 ? 'none' : '0 4px 12px rgba(240, 100, 28, 0.2)',
              whiteSpace: 'nowrap'
            }}
          >
            {markingAllRead ? 'Marking...' : unreadCount === 0 ? 'All Caught Up ✓' : 'Mark All As Read'}
          </motion.button>
        </div>
        {/* Soft Background Accent */}
        <div style={{ position: 'absolute', right: '-40px', bottom: '-40px', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,103,31,0.2) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(30px)' }} />
      </motion.section>

      {actionError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>⚠️</span> {actionError}
        </motion.div>
      )}

      {/* Filter Tabs Row */}
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 4,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab;
          const count = getFilterCount(tab);
          return (
            <motion.button
              key={tab}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setFilter(tab)}
              style={{
                padding: '10px 18px',
                borderRadius: 24,
                border: isActive ? '1px solid #f0641c' : '1px solid #ecdcc4',
                background: isActive
                  ? 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)'
                  : '#fff',
                color: isActive ? '#fff' : '#64748b',
                fontWeight: isActive ? 800 : 700,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: isActive
                  ? '0 6px 14px rgba(240, 100, 28, 0.2)'
                  : '0 2px 4px rgba(53, 36, 20, 0.01)',
                transition: 'color 0.2s, border 0.2s'
              }}
            >
              <span>{tab}</span>
              {count > 0 && (
                <span style={{
                  background: isActive ? 'rgba(255, 255, 255, 0.25)' : '#fee2e2',
                  color: isActive ? '#fff' : '#dc2626',
                  padding: '2px 6px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 800
                }}>
                  {count}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Notifications List */}
      {displayedNotifications.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: '#fffdf8',
            border: '1px dashed #ecdcc4',
            borderRadius: 20,
            padding: '60px 24px',
            textAlign: 'center',
            boxShadow: '0 8px 20px rgba(57, 44, 27, 0.01)'
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔔</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>No updates in this filter</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>You're fully up to date! Check back later for announcements or account changes.</p>
        </motion.div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {displayedNotifications.map((note, idx) => {
            const isUnread = !note.is_read;
            return (
              <motion.article
                key={note.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                whileHover={{ y: -2, boxShadow: '0 10px 20px rgba(57, 44, 27, 0.04)' }}
                style={{
                  background: '#fff',
                  border: isUnread ? '1px solid #ff671f' : '1px solid #ecdcc4',
                  borderRadius: 20,
                  padding: 20,
                  boxShadow: isUnread ? '0 4px 12px rgba(255, 103, 31, 0.05)' : '0 2px 4px rgba(0,0,0,0.01)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
              >
                {/* Visual line highlight for unread items */}
                {isUnread && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: 'linear-gradient(90deg, #ff671f, #f9b23d)'
                  }} />
                )}

                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Icon Badge */}
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: note.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                  }}>
                    {note.icon}
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        {note.title}
                        {isUnread && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: '#ffe3d3',
                            color: '#e05307',
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase'
                          }}>
                            New
                          </span>
                        )}
                      </h4>
                      <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        ⏱ {getTimeAgo(note.created_at)}
                      </span>
                    </div>

                    {/* Messages Body */}
                    {Array.isArray(note.assignedLines) ? (
                      <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                        {note.assignedLines.map((line, i) => (
                          <p key={i} style={{
                            margin: 0,
                            fontSize: 13,
                            color: i === 0 ? '#334155' : '#64748b',
                            lineHeight: 1.5,
                            fontWeight: i === 0 ? 600 : 400
                          }}>
                            {line}
                          </p>
                        ))}
                      </div>
                    ) : Array.isArray(note.details) && note.details.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 8 }}>
                        {note.details
                          .filter(detail => detail?.value && !String(detail.value).includes('%'))
                          .map((detail) => (
                            <div key={detail.label} style={{ borderRadius: 12, border: '1px solid #ebd2aa', background: '#fffdf8', padding: '10px 14px' }}>
                              <div style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                                {detail.label}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                {detail.value}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.5, marginTop: 4 }}>
                        {note.message}
                      </p>
                    )}

                    {isCodAndUnpaid(note.message) && (
                      <div style={{
                        marginTop: 12,
                        padding: '12px 16px',
                        borderRadius: 12,
                        background: '#fff5f5',
                        border: '1px solid #feb2b2',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start'
                      }}>
                        <span style={{ fontSize: 16, marginTop: 1 }}>⚠️</span>
                        <div style={{ fontSize: 12, color: '#c53030', fontWeight: 500, lineHeight: 1.5 }}>
                          <strong>Acknowledge Needed:</strong> "I acknowledge that if I fail to pay COD at delivery, my distributor privileges will be permanently blocked."
                        </div>
                      </div>
                    )}

                    {/* Interactive Action Buttons */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                      {isUnread && (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleMarkAsRead(note.id)}
                          disabled={updatingIds.includes(note.id)}
                          style={{
                            border: '1px solid #ecdcc4',
                            background: '#fff',
                            color: '#0f172a',
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: updatingIds.includes(note.id) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {updatingIds.includes(note.id) ? 'Syncing...' : 'Mark read'}
                        </motion.button>
                      )}

                      {note.action?.link && (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => navigate(note.action.link)}
                          style={{
                            border: 'none',
                            background: 'rgba(255, 103, 31, 0.1)',
                            color: '#ff671f',
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          {note.action.text}
                        </motion.button>
                      )}

                      {((note.type === 'orders' && (note.title.toLowerCase().includes('delivery partner') || note.message.toLowerCase().includes('delivery partner'))) || note.partnerPhone) && (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleCallPartner(note)}
                          style={{
                            border: '1px solid #bbf7d0',
                            background: '#f0fdf4',
                            color: '#166534',
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          📞 Call Delivery Agent
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* Load More Button */}
      {filteredNotifications.length > visibleCount && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setVisibleCount(prev => prev + 10)}
            style={{
              padding: '10px 24px',
              background: '#fff',
              border: '1px solid #ecdcc4',
              borderRadius: 12,
              color: '#64748b',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
            }}
          >
            ↓ Load older notifications
          </motion.button>
        </div>
      )}
    </div>
  )
}
