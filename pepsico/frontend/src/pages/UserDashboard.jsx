import React, { useState, useEffect, useCallback } from 'react'
import { Link, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import BrandLoadingOverlay from '../components/BrandLoadingOverlay'
import Products from './Products'
import Cart from './Cart'
import Checkout from './Checkout'
import DashboardHome from './DashboardHome'
import Notifications from './Notifications'
import Profile from './Profile'
import Orders from './Orders'
import TrackOrder from './TrackOrder'
import OrderSuccess from './OrderSuccess'
import Analytics from './Analytics'
import { useMediaQuery } from '../lib/useMediaQuery'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001'

function truncateEmail(value) {
  if (!value) return ''
  if (value.length <= 26) return value
  const [local, domain = ''] = value.split('@')
  return `${local.slice(0, 12)}…@${domain}`
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch (err) {
    console.warn('Failed to format date:', err)
    return '—'
  }
}

function HomeOverview({ displayName, email, canOrder, createdAt, profilePhotoUrl, refreshing, onRefresh }) {
  const status = canOrder
    ? { label: 'Verified account', tone: '#1f8a49', bg: '#d9f4e3', border: '#bfe8ce' }
    : { label: 'Awaiting verification', tone: '#92400e', bg: '#fef3c7', border: '#fde68a' }

  const avatarInitial = (displayName || 'U').trim().slice(0, 1).toUpperCase()

  return (
    <section
      style={{
        background: 'linear-gradient(100deg, #fcfbf7 0%, #f9f6ef 100%)',
        borderRadius: 28,
        border: '1px solid #eee2d3',
        padding: '28px 30px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 26,
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 20px 40px rgba(44, 36, 22, 0.06)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: '3px solid #edf1f5',
              background: profilePhotoUrl ? `url(${profilePhotoUrl}) center/cover no-repeat` : 'linear-gradient(135deg, #f3f5f8 0%, #dde4ed 100%)',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              fontWeight: 700,
              boxShadow: '0 12px 24px rgba(15,23,42,0.08)'
            }}
          >
            {!profilePhotoUrl ? avatarInitial : null}
          </div>
          {canOrder && (
            <span
              style={{
                position: 'absolute',
                right: 2,
                bottom: 6,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#22c55e',
                border: '3px solid #ffffff',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 12,
                fontWeight: 800,
                boxShadow: '0 8px 18px rgba(34,197,94,0.38)'
              }}
            >
              ✓
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.15 }}>
            Welcome back,{' '}
            <span style={{ color: '#f0641c' }}>{displayName}</span>
          </h2>
          {email && (
            <span style={{ fontSize: 13, color: '#64748b' }}>{truncateEmail(email)}</span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '7px 16px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                background: status.bg,
                color: status.tone,
                border: `1px solid ${status.border}`,
                width: 'fit-content'
              }}
            >
              {status.label}
            </span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Member since {formatDate(createdAt)}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link
          to="profile"
          style={{
            padding: '12px 28px',
            borderRadius: 16,
            border: '1px solid #d7dee7',
            fontSize: 14,
            fontWeight: 700,
            color: '#22324a',
            textDecoration: 'none',
            background: '#f8fafc',
            boxShadow: '0 8px 16px rgba(15,23,42,0.05)'
          }}
        >
          View profile
        </Link>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            padding: '12px 28px',
            borderRadius: 16,
            border: '1px solid #0a1437',
            background: refreshing ? '#2d3f73' : '#0a1437',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: refreshing ? 'wait' : 'pointer',
            transition: 'background 0.2s ease',
            boxShadow: '0 10px 18px rgba(10,20,55,0.25)'
          }}
        >
          {refreshing ? 'Refreshing…' : '↻ Refresh data'}
        </button>
      </div>
    </section>
  )
}
function DesktopNavBar({ navItems, isHomeView, normalisedPath, isMobile, onLinkClick, unreadNotifCount }) {
  if (isMobile) return null

  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 14,
        padding: '11px 14px',
        background: 'rgba(250, 245, 236, 0.95)',
        borderRadius: 16,
        border: '1px solid #ecdcc4',
        boxShadow: '0 14px 28px rgba(53, 36, 20, 0.06)'
      }}
    >
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flex: 1 }}>
        {navItems.map((item) => {
        const isActive = item.path === 'home'
          ? isHomeView
          : normalisedPath.includes(`/${item.path}`)
        const disabled = Boolean(item.disabled)
        const hasNotifDot = item.path === 'notifications' && unreadNotifCount > 0

        return (
          <Link
            key={item.path}
            to={disabled ? '#' : item.path}
            aria-disabled={disabled}
            onClick={(event) => {
              if (disabled) {
                event.preventDefault()
                return
              }
              if (typeof onLinkClick === 'function') {
                onLinkClick(item.path)
              }
            }}
            style={{
              padding: '10px 22px',
              borderRadius: 12,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
              background: isActive ? 'linear-gradient(135deg, #f7a938 0%, #f08a25 100%)' : 'transparent',
              color: isActive ? '#fff' : '#334155',
              border: isActive ? '1px solid #ef962f' : '1px solid transparent',
              pointerEvents: disabled ? 'none' : 'auto',
              opacity: disabled ? 0.45 : 1,
              whiteSpace: 'nowrap',
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {item.label}
            {hasNotifDot && (
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ef4444',
                display: 'inline-block',
                flexShrink: 0
              }} />
            )}
          </Link>
        )
      })}
      </div>
      <div
        style={{
          padding: '9px 18px',
          borderRadius: 999,
          border: '1px solid #ebd2aa',
          background: '#f9efe0',
          color: '#d66022',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          whiteSpace: 'nowrap'
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#d6b341', display: 'inline-block' }} />
        Ashirwad Enterprises
      </div>
    </nav>
  )
}

export default function UserDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [canOrder, setCanOrder] = useState(false)
  const [logoutError, setLogoutError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)

  const loadUser = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setLogoutError(null)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      let authUser = sessionData?.session?.user ?? null
      if (!authUser) {
        const { data: userData, error: authError } = await supabase.auth.getUser()
        if (authError) {
          const msg = String(authError.message || '').toLowerCase()
          if (!msg.includes('auth session missing')) {
            throw authError
          }
        }
        authUser = userData?.user ?? null
      }

      if (!authUser) {
        if (!silent) {
          setLoading(false)
        }
        navigate('/login', { replace: true })
        return
      }

      let { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, email, full_name, phone, is_verified, created_at, updated_at, role, profile_photo_url')
        .eq('id', authUser.id)
        .maybeSingle()

      if (profileError) throw profileError

      if (!profile) {
        const fallbackName = (
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          (authUser.email || 'User').split('@')[0] ||
          'User'
        ).trim()

        try {
          await fetch(`${API_BASE}/api/auth/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: authUser.id,
              email: (authUser.email || '').toLowerCase(),
              full_name: fallbackName || 'User'
            })
          })

          const retry = await supabase
            .from('users')
            .select('id, email, full_name, phone, is_verified, created_at, updated_at, role, profile_photo_url')
            .eq('id', authUser.id)
            .maybeSingle()

          if (retry.error) throw retry.error
          profile = retry.data || null
        } catch (profileSyncErr) {
          console.warn('User profile recovery failed:', profileSyncErr)
        }
      }

      if (!profile) {
        profile = {
          id: authUser.id,
          email: authUser.email || '',
          full_name: (authUser.user_metadata?.full_name || authUser.user_metadata?.name || (authUser.email || 'User').split('@')[0] || 'User').trim(),
          phone: null,
          is_verified: false,
          created_at: authUser.created_at || new Date().toISOString(),
          updated_at: authUser.updated_at || null,
          role: 'user',
          profile_photo_url: null
        }
      }

      setUser(profile)
      setCanOrder(Boolean(profile?.is_verified))

      // Fetch unread notification count (merge with localStorage read-state)
      try {
        const { data: notifItems } = await supabase
          .from('notifications')
          .select('id, is_read')
          .eq('user_id', profile.id)
        const localKey = `notifications_read_${profile.id}`
        let localReadIds = new Set()
        try {
          const raw = localStorage.getItem(localKey)
          if (raw) {
            const arr = JSON.parse(raw)
            if (Array.isArray(arr)) arr.forEach((id) => localReadIds.add(String(id)))
          }
        } catch { /* ignore */ }
        const unread = (notifItems || []).filter(
          (n) => !Boolean(n.is_read) && !localReadIds.has(String(n.id))
        ).length
        setUnreadNotifCount(unread)
      } catch { /* non-critical: badge just won't show */ }
    } catch (err) {
      console.error('Error loading user data:', err)
      if (!silent) {
        setLogoutError('Unable to load your profile. Please try again.')
      }
    } finally {
      if (silent) {
        setRefreshing(false)
      } else {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [navigate])

  useEffect(() => {
    loadUser(false)
  }, [loadUser])

  const navItems = [
    { path: 'home', label: 'Overview' },
    { path: 'products', label: 'Products' },
    { path: 'orders', label: 'Orders' },
    { path: 'track', label: 'Track Order' },
    { path: 'analytics', label: 'Analytics' },
    // { path: 'cart', label: 'Cart', disabled: !canOrder },
    { path: 'notifications', label: 'Notifications' }
  ]

  const isMobile = useMediaQuery('(max-width: 900px)')

  const normalisedPath = location.pathname.replace(/\/+$/, '')
  const activeNav = navItems.find((item) => {
    if (item.path === 'home') {
      return normalisedPath === '/dashboard' || normalisedPath.endsWith('/home')
    }
    return normalisedPath.includes(`/${item.path}`)
  }) || navItems[0]

  const isHomeView = activeNav.path === 'home'
  const isCheckoutView = normalisedPath.includes('/checkout')
  const displayName = (user?.full_name || 'Ashirwad').trim()
  const BlockedOrder = () => (
    <div style={{ textAlign: 'center', padding: '36px 16px' }}>
      <h3 style={{ margin: 0, marginBottom: 10, fontSize: 18, color: '#0f172a' }}>Ordering temporarily unavailable</h3>
      <p style={{ color: '#64748b', margin: 0, fontSize: 13, maxWidth: 380, marginInline: 'auto' }}>
        Once your profile is verified by the PepsiCo team, you will be able to place orders and access checkout from this dashboard.
      </p>
    </div>
  )

  if (loading) {
    return <BrandLoadingOverlay message="Loading your dashboard…" />
  }

  const isCartView = normalisedPath.includes('/cart');
  const showBareSection = isCheckoutView || isCartView || isHomeView

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f7f2e9 0%, #f4efe6 100%)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '24px 16px 48px' : '22px 24px 56px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {!isCheckoutView && !isCartView && (
          <DesktopNavBar
            navItems={navItems}
            isHomeView={isHomeView}
            normalisedPath={normalisedPath}
            isMobile={isMobile}
            onLinkClick={() => {}}
            unreadNotifCount={unreadNotifCount}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'stretch' }}>
          <main style={{ flex: 1, display: 'grid', gap: isCheckoutView || isCartView ? 12 : 20 }}>
            {isMobile && !isCheckoutView && !isCartView && (
              <nav style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 4px', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 12px 24px rgba(15,23,42,0.05)' }}>
                {navItems.map((item) => {
                  const isActive = item.path === 'home'
                    ? isHomeView
                    : normalisedPath.includes(`/${item.path}`)
                  const disabled = Boolean(item.disabled)
                  const hasNotifDot = item.path === 'notifications' && unreadNotifCount > 0
                  return (
                    <Link
                      key={item.path}
                      to={disabled ? '#' : item.path}
                      aria-disabled={disabled}
                      onClick={(event) => { if (disabled) event.preventDefault() }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: 'none',
                        background: isActive ? '#1d4ed8' : '#e2e8f0',
                        color: isActive ? '#fff' : '#1f2937',
                        pointerEvents: disabled ? 'none' : 'auto',
                        opacity: disabled ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {item.label}
                      {hasNotifDot && (
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#ef4444',
                          display: 'inline-block',
                          flexShrink: 0
                        }} />
                      )}
                    </Link>
                  )
                })}
              </nav>
            )}
            {logoutError && !isCheckoutView && !isCartView && (
              <div style={{ background: '#fff', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 16px', borderRadius: 12, fontSize: 13, boxShadow: '0 12px 24px rgba(248,113,113,0.16)' }}>
                {logoutError}
              </div>
            )}
            {!isCheckoutView && !isCartView && !canOrder && (
              <div style={{ background: '#fff', border: '1px solid #fde68a', color: '#92400e', padding: '12px 16px', borderRadius: 12, fontSize: 13, boxShadow: '0 12px 24px rgba(251,191,36,0.18)' }}>
                Ordering will unlock once your profile is verified. You can continue browsing products and tracking deliveries.
              </div>
            )}
            {isHomeView && !isCheckoutView && !isCartView && (
              <HomeOverview
                displayName={displayName}
                email={user?.email}
                canOrder={canOrder}
                createdAt={user?.created_at}
                profilePhotoUrl={user?.profile_photo_url}
                refreshing={refreshing}
                onRefresh={() => loadUser(true)}
              />
            )}
            <section
              style={{
                background: showBareSection ? 'transparent' : '#fff',
                borderRadius: showBareSection ? 0 : 18,
                border: showBareSection ? 'none' : '1px solid #e2e8f0',
                padding: showBareSection ? 0 : (isMobile ? 16 : 28),
                boxShadow: showBareSection ? 'none' : '0 18px 36px rgba(15,23,42,0.05)'
              }}
            >
              <Routes>
                <Route index element={<Navigate to="home" replace />} />
                <Route path="home" element={<DashboardHome />} />
                <Route path="products" element={<Products />} />
                <Route path="orders" element={<Orders />} />
                <Route path="track" element={<TrackOrder />} />
                <Route path="track-order" element={<TrackOrder />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="order-success" element={<OrderSuccess />} />
                <Route path="cart" element={canOrder ? <Cart /> : <BlockedOrder />} />
                <Route path="profile" element={<Profile />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="checkout" element={canOrder ? <Checkout /> : <BlockedOrder />} />
              </Routes>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
