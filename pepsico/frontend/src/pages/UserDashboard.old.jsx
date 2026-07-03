import React, { useState, useEffect, useCallback } from 'react'
import { Link, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useCart } from '../context/CartContext'
import BrandLoadingOverlay from '../components/BrandLoadingOverlay'
import BrandVideoLogo from '../components/BrandVideoLogo'
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

export default function UserDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const { state, dispatch } = useCart()
  const itemCount = Object.keys(state?.items || {}).length
  const [user, setUser] = useState(null)
  const [greeting, setGreeting] = useState('')
  const [loading, setLoading] = useState(true)
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page, #f5f6fb)' }}>
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.92)', backdropFilter: 'saturate(180%) blur(18px)', boxShadow: '0 20px 46px rgba(15,23,42,0.08)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <BrandVideoLogo size={52} style={{ borderRadius: 14, boxShadow: '0 16px 38px rgba(10,29,83,0.18)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: 0.3, color: 'var(--text-primary)' }}>PepsiCo Distributor</span>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ashirwad Enterprises</span>
            </div>
          </Link>
          <nav style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginLeft: 16 }}>
            {headerLinks.map((item, index) => {
              const isActiveHeader = item.to === '/dashboard'
                ? normalisedPath.startsWith('/dashboard')
                : normalisedPath === item.to
              return (
                <motion.div
                  key={item.label}
                  whileHover={{ y: -2 }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    to={item.to}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      fontWeight: 600,
                      fontSize: 14,
                      color: isActiveHeader ? 'var(--brand-navy)' : 'var(--text-secondary)',
                      textDecoration: 'none',
                      border: isActiveHeader ? '1px solid rgba(10,29,83,0.2)' : '1px solid transparent',
                      background: isActiveHeader ? 'rgba(10,29,83,0.08)' : 'transparent',
                      transition: 'all 0.25s ease'
                    }}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              )
            })}
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border-light)',
                background: 'rgba(255,255,255,0.72)',
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                boxShadow: '0 12px 24px rgba(15,23,42,0.08)'
              }}
            >
              {sidebarCollapsed ? 'Expand Menu' : 'Collapse Menu'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderRadius: 14, border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.86)', boxShadow: '0 18px 42px rgba(15,23,42,0.12)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16, color: '#fff', background: 'linear-gradient(135deg, var(--brand-saffron) 0%, rgba(10,29,83,0.9) 100%)' }}>
                {avatarInitial}
              </div>
              <div style={{ display: 'grid', gap: 2, lineHeight: 1.3 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{displayName}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{truncatedPrimaryEmail || 'ashirwad682@gmail.co...'}</span>
              </div>
              <span style={{ padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, ...verificationBadgeStyle }}>
                {verificationLabel}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,103,31,0.25)',
                  background: 'rgba(255,103,31,0.12)',
                  color: 'var(--brand-saffron)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '120px 24px 60px', display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        <aside
          style={{
            width: sidebarCollapsed ? 88 : 260,
            transition: 'width 0.3s ease',
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid var(--border-light)',
            borderRadius: 22,
            boxShadow: '0 24px 48px rgba(15,23,42,0.08)',
            padding: sidebarCollapsed ? '20px 14px' : '24px 18px',
            position: 'sticky',
            top: 110,
            alignSelf: 'flex-start'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {navItems.map((item, index) => {
              const isActive = item.path === 'home'
                ? isHomeView
                : normalisedPath.includes(`/${item.path}`)
              return (
                <motion.div key={item.path} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                  <Link
                    to={item.disabled ? '#' : item.path}
                    onClick={(event) => { if (item.disabled) event.preventDefault() }}
                    aria-disabled={item.disabled}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                      gap: sidebarCollapsed ? 0 : 12,
                      padding: '12px 14px',
                      borderRadius: 14,
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: sidebarCollapsed ? 0 : 14,
                      color: item.disabled ? '#cbd5f5' : (isActive ? '#fff' : '#1f2937'),
                      background: isActive ? 'linear-gradient(135deg, var(--brand-saffron) 0%, rgba(10,29,83,0.85) 100%)' : 'rgba(15,23,42,0.04)',
                      border: isActive ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(15,23,42,0.06)',
                      boxShadow: isActive ? '0 16px 32px rgba(15,23,42,0.18)' : 'none',
                      pointerEvents: item.disabled ? 'none' : 'auto',
                      opacity: item.disabled ? 0.5 : 1,
                      transition: 'all 0.25s ease'
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </aside>
        <main style={{ flex: 1, display: 'grid', gap: 24 }}>
          <motion.section
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              padding: '32px',
              borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(10,29,83,0.92) 0%, rgba(4,106,56,0.78) 100%)',
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 28px 60px rgba(10,29,83,0.25)'
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.18), transparent 45%), radial-gradient(circle at 85% 60%, rgba(255,255,255,0.12), transparent 55%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 12, letterSpacing: 1.2, fontWeight: 700, textTransform: 'uppercase', opacity: 0.85 }}>Welcome back</span>
              <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', fontWeight: 800 }}>
                {greeting}, {firstName || 'Ashirwad'}! 👋
              </h1>
              <p style={{ margin: 0, fontSize: 15, opacity: 0.88 }}>
                Ashirwad Enterprises – Authorized PepsiCo Distributor
              </p>
            </div>
          </motion.section>
          <div style={{ display: 'grid', gap: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
                padding: '18px 24px',
                borderRadius: 18,
                background: '#fff',
                border: '1px solid var(--border-light)',
                boxShadow: '0 16px 32px rgba(15,23,42,0.05)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, color: '#1f2937', fontSize: 14 }}>
                <span style={{ fontSize: 18 }}>{breadcrumbPrimary}</span>
                <span style={{ opacity: 0.45 }}>·</span>
                <span style={{ fontWeight: 600, color: '#475569' }}>{breadcrumbSecondary}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, ...verificationBadgeStyle }}>
                  {canOrder ? 'Verified for ordering' : 'Awaiting verification'}
                </span>
                <span style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: 'rgba(15,23,42,0.06)', color: '#0f172a', border: '1px solid rgba(15,23,42,0.1)' }}>
                  {cartLabel}
                </span>
              </div>
            </div>
            {logoutError && (
              <div style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>
                {logoutError}
              </div>
            )}
            {!canOrder && (
              <div style={{ background: '#fff8e1', border: '1px solid #ffe0a3', color: '#8a5a00', padding: '12px 16px', borderRadius: 12, fontSize: 13 }}>
                Your account is awaiting admin verification. Browsing is available, but ordering, cart, and checkout remain disabled until approval.
              </div>
            )}
            {isHomeView && (
              <section style={{ display: 'grid', gap: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>📊</span>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Dashboard Overview</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
                  {overviewCards.map((card, idx) => (
                    <motion.div
                      key={card.title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * idx }}
                      whileHover={{ y: -4, boxShadow: '0 20px 32px rgba(15,23,42,0.12)' }}
                      style={{
                        padding: '24px 24px',
                        borderRadius: 20,
                        background: '#fff',
                        border: '1px solid var(--border-light)',
                        boxShadow: '0 12px 28px rgba(15,23,42,0.06)',
                        display: 'grid',
                        gap: 10
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{card.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{card.title}</span>
                      <span style={{ fontSize: 32, fontWeight: 800, color: card.accent }}>{card.value}</span>
                    </motion.div>
                  ))}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28 }}
                    style={{
                      padding: '24px 24px',
                      borderRadius: 20,
                      background: '#fff',
                      border: '1px solid var(--border-light)',
                      boxShadow: '0 12px 28px rgba(15,23,42,0.06)',
                      display: 'grid',
                      gap: 14
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Recent Activity</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>Latest updates</span>
                    </div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {recentActivity.length > 0 ? recentActivity.map((activity) => (
                        <div
                          key={activity.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '10px 12px',
                            borderRadius: 12,
                            background: 'rgba(15,23,42,0.04)',
                            border: '1px solid rgba(15,23,42,0.08)'
                          }}
                        >
                          <div style={{ display: 'grid', gap: 2 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>{activity.status}</span>
                            <span style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 0.6 }}>
                              #{(activity.id || '').slice(0, 8).toUpperCase()}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                            {formatTimestamp(activity.timestamp)}
                          </span>
                        </div>
                      )) : (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>No recent activity yet. Orders and status updates will appear here.</div>
                      )}
                    </div>
                  </motion.div>
                </div>
              </section>
            )}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 32,
                boxShadow: '0 18px 36px rgba(15,23,42,0.08)',
                border: '1px solid var(--border-light)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 10% 15%, rgba(10,29,83,0.05), transparent 40%), radial-gradient(circle at 90% 10%, rgba(4,106,56,0.05), transparent 40%)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative' }}>
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
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
        return pendingStatuses.includes(status) ? count + 1 : count
      }

      const { data: profile } = await supabase
        .from('users')
        .select('id,email,full_name,phone,is_verified,created_at,updated_at,role')
        .eq('id', authUser.id)
        .single()

      setUser(profile)
      setCanOrder(!!profile?.is_verified)

       await loadOverviewStats(profile?.id, { silent })

      if (!silent) setLoading(false)
        // UUID validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(authUser.id)) {
          setUser(null)
          setCanOrder(false)
          setLoading(false)
          setStatsLoading(false)
          return
        }
    } catch (err) {
      console.error('Error loading user data:', err)
      if (!silent) setLoading(false)
      if (!silent) setStatsLoading(false)
    }
  }, [loadOverviewStats])

  const navItems = [
    { path: 'home', label: 'Home', icon: '🏠', desc: 'Overview' },
    { path: 'products', label: 'Products', icon: '🛍️', desc: 'Browse catalog' },
    { path: 'orders', label: 'Orders', icon: '📦', desc: 'Status & bills' },
    { path: 'track', label: 'Track Order', icon: '📍', desc: 'Live tracking' },
    { path: 'analytics', label: 'Analytics', icon: '📊', desc: 'Business insights' },
    { path: 'cart', label: 'Cart', icon: '🛒', desc: 'View items', disabled: !canOrder },
    { path: 'profile', label: 'Profile', icon: '👤', desc: 'Your account' },
    { path: 'notifications', label: 'Notifications', icon: '🔔', desc: 'Updates' },
  ]

  const normalisedPath = location.pathname.replace(/\/+$/, '')
  const activeNav = navItems.find((item) => {
    if (item.path === 'home') {
      return normalisedPath === '/dashboard' || normalisedPath.endsWith('/home')
    }
    return normalisedPath.includes(`/${item.path}`)
  }) || navItems[0]
  const isHomeView = activeNav.path === 'home'

  const headerLinks = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
    { to: '/dashboard', label: 'Dashboard' }
  ]
  const displayName = (user?.full_name || 'Ashirwad').trim()
  const firstName = displayName.split(' ')[0] || 'Ashirwad'
  const primaryEmail = user?.email || ''
  const truncatedPrimaryEmail = truncateEmail(primaryEmail)
  const avatarInitial = (displayName.charAt(0) || primaryEmail.charAt(0) || 'U').toUpperCase()
  const verificationLabel = canOrder ? 'Verified' : 'Pending Approval'
  const verificationBadgeStyle = {
    background: canOrder ? 'rgba(4,106,56,0.12)' : 'rgba(255,103,31,0.14)',
    color: canOrder ? 'var(--brand-green)' : 'var(--brand-saffron)',
    border: canOrder ? '1px solid rgba(4,106,56,0.25)' : '1px solid rgba(255,103,31,0.25)'
  }
  const cartLabel = `Cart: ${itemCount} item${itemCount === 1 ? '' : 's'}`
  const breadcrumbPrimary = '🏠 Home'
  const breadcrumbSecondary = isHomeView ? 'Overview' : activeNav.label
  const overviewCards = [
    { title: 'Total Orders', value: statsLoading ? '—' : overviewStats.totalOrders, icon: '📦', accent: 'var(--brand-navy)' },
    { title: 'Pending Deliveries', value: statsLoading ? '—' : overviewStats.pendingDeliveries, icon: '🚚', accent: 'var(--brand-saffron)' },
    { title: 'Completed Orders', value: statsLoading ? '—' : overviewStats.completedOrders, icon: '✅', accent: 'var(--brand-green)' }
  ]
  const recentActivity = overviewStats.recentActivity || []

  const BlockedOrder = () => (
    <div style={{ textAlign: 'center', padding: '40px 16px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
      <h3 style={{ margin: 0, marginBottom: 8 }}>Ordering is locked</h3>
      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Your account is pending admin verification. Once approved, ordering and checkout will be enabled.</p>
    </div>
  )

  if (loading) return <BrandLoadingOverlay message="Loading your dashboard…" />

  return (
    <div style={{ background: '#f8fafb', minHeight: 'calc(100vh - 200px)' }}>
      {/* Header Section */}
      <div style={{ background: 'linear-gradient(135deg, #FF8C00 0%, #FFB347 60%, #FFA500 100%)', color: 'white', padding: '56px 24px 40px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 35%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.06), transparent 30%)' }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <BrandVideoLogo
                  size={78}
                  style={{ boxShadow: '0 26px 70px rgba(10,29,83,0.18)', borderRadius: 18, background: 'rgba(255,255,255,0.12)' }}
                />
                <div>
                  <p style={{ margin: 0, opacity: 0.85, letterSpacing: 0.6, fontSize: 12, textTransform: 'uppercase' }}>Welcome back</p>
                  <h1 style={{ margin: '4px 0 8px', fontSize: 34, fontWeight: 800 }}>
                    {greeting}, {user?.full_name || 'User'}! 👋
                  </h1>
                  <p style={{ margin: 0, opacity: 0.9, fontSize: 15 }}>
                    Ashirwad Enterprises - Authorized PepsiCo Distributor
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={handleLogout}
                  className="btn outline"
                  style={{ padding: '9px 14px', fontSize: 13, borderColor: '#ffe4e6', color: '#fecdd3', background: 'rgba(255,255,255,0.1)' }}
                >
                  Logout
                </button>
                <span style={{ padding: '8px 12px', borderRadius: 999, fontWeight: 700, fontSize: 13, background: canOrder ? 'rgba(255,255,255,0.15)' : 'rgba(255,193,7,0.18)', color: canOrder ? '#e8f5e9' : '#fff3cd', border: '1px solid rgba(255,255,255,0.15)' }}>
                  {canOrder ? 'Verified' : 'Pending approval'}
                </span>
              </div>
            </div>
          </motion.div>

          {logoutError && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 8, border: '1px solid #fecaca', fontSize: 13 }}>
              {logoutError}
            </div>
          )}

        </div>
      </div>

      {!canOrder && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe0a3', color: '#8a5a00', padding: '12px 16px', margin: '16px 24px 0', borderRadius: 10 }}>
          Your account is awaiting admin verification. Browsing is available, but ordering, cart, and checkout are disabled until approval.
        </div>
      )}

      {/* Navigation Bar */}
      <div style={{ maxWidth: 1200, margin: '-28px auto 0', padding: '0 24px 40px', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 20%, rgba(15,118,110,0.08), transparent 40%), radial-gradient(circle at 80% 30%, rgba(13,59,53,0.06), transparent 35%)', pointerEvents: 'none' }} />
        <div style={{ background: 'white', borderRadius: 14, padding: '10px 12px', boxShadow: '0 8px 20px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', position: 'relative' }}>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {navItems.map((item, idx) => {
              const isActive = location.pathname.includes(item.path)
              return (
                <motion.div key={item.path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * idx }}>
                  <Link
                    to={item.disabled ? '#' : item.path}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: isActive ? 'linear-gradient(135deg, #FF8C00 0%, #FFB347 100%)' : '#f3f5fb',
                      color: item.disabled ? '#9ca3af' : (isActive ? 'white' : '#1f2937'),
                      border: isActive ? '1px solid rgba(255,255,255,0.3)' : '1px solid #e5e7eb',
                      boxShadow: isActive ? '0 10px 24px rgba(15,118,110,0.25)' : 'none',
                      textDecoration: 'none',
                      fontWeight: 700,
                      fontSize: 14,
                      whiteSpace: 'nowrap',
                      pointerEvents: item.disabled ? 'none' : 'auto',
                      opacity: item.disabled ? 0.6 : 1
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            style={{ background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', marginTop: 16, border: '1px solid #e5e7eb', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 15% 20%, rgba(15,118,110,0.05), transparent 35%), radial-gradient(circle at 90% 10%, rgba(13,59,53,0.05), transparent 30%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 13 }}>
                  <span style={{ fontSize: 18 }}>{activeNav.icon}</span>
                  <span>{activeNav.label}</span>
                  <span style={{ opacity: 0.6 }}>·</span>
                  <span>{activeNav.desc}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: '#0f172a' }}>{activeNav.label}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ padding: '6px 12px', borderRadius: 999, background: canOrder ? '#e8f5e9' : '#fff4e5', color: canOrder ? '#1b5e20' : '#8a5a00', fontWeight: 700, fontSize: 12, border: '1px solid rgba(0,0,0,0.05)' }}>
                  {canOrder ? 'Verified for ordering' : 'Awaiting verification'}
                </span>
                <span style={{ padding: '6px 10px', borderRadius: 999, background: '#f3f4f6', color: '#1f2937', fontWeight: 700, fontSize: 12, border: '1px solid #e5e7eb' }}>
                  Cart: {itemCount} item{itemCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
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
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
