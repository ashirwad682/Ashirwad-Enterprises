import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import BrandVideoLogo from '../components/BrandVideoLogo'
import OrdersTab from './admin-sections/OrdersTab'
import ProductsTab from './admin-sections/ProductsTab'
import OffersTab from './admin-sections/OffersTab'
import UsersTab from './admin-sections/UsersTab'
import CouponsTab from './admin-sections/CouponsTab'
import TransactionsTab from './admin-sections/TransactionsTab'
import NotificationsTab from './admin-sections/NotificationsTab'
import DeliveryPartnersTab from './admin-sections/DeliveryPartnersTab'
import ManagerProfileTab from './admin-sections/ManagerProfileTab'
import GrowthSlabTab from './admin-sections/GrowthSlabTab'
import { useMediaQuery } from '../lib/useMediaQuery'

const DEFAULT_MANAGER_TABS = [
  'profile',
  'orders',
  'products',
  'offers',
  'users',
  'coupons',
  'slabs',
  'transactions-revenue',
  'transactions-settlement',
  'transactions-warehouse-settlement',
  'notifications',
  'delivery'
]

const TAB_META = {
  profile: { label: 'Profile', icon: '👤' },
  orders: { label: 'Orders', icon: '🛒' },
  products: { label: 'Products', icon: '📦' },
  offers: { label: 'Offers', icon: '🎁' },
  users: { label: 'Users', icon: '👥' },
  coupons: { label: 'Coupons', icon: '🎟️' },
  slabs: { label: 'Product Slabs', icon: '📊' },
  'transactions-revenue': { label: 'Transaction and Revenue', icon: '💰' },
  'transactions-settlement': { label: 'Collection Settlement from Delivery Partner', icon: '🚚' },
  'transactions-warehouse-settlement': { label: 'Collection Settlement from Warehouse', icon: '🏬' },
  transactions: { label: 'Transaction and Revenue', icon: '💰' },
  notifications: { label: 'Notifications', icon: '🔔' },
  delivery: { label: 'Delivery Partners', icon: '🚚' }
}

const PERMISSION_TO_TAB = {
  orders: 'orders',
  products: 'products',
  offers: 'offers',
  users: 'users',
  coupons: 'coupons',
  slabs: 'slabs',
  'transactions-revenue': 'transactions-revenue',
  transactions_revenue: 'transactions-revenue',
  'transactions-settlement': 'transactions-settlement',
  transactions_settlement: 'transactions-settlement',
  'transactions-warehouse-settlement': 'transactions-warehouse-settlement',
  transactions_warehouse_settlement: 'transactions-warehouse-settlement',
  transactions: 'transactions-revenue',
  notifications: 'notifications',
  delivery: 'delivery',
  'delivery-partners': 'delivery',
  delivery_partners: 'delivery'
}

function getManagerActiveSafe() {
  const raw = localStorage.getItem('manager_is_active')
  if (raw === null) return true
  return raw === 'true'
}

function getManagerNameSafe() {
  return String(localStorage.getItem('manager_name') || '').trim()
}

function getManagerPermissionsSafe() {
  try {
    const raw = localStorage.getItem('manager_permissions') || '[]'
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn('Invalid manager_permissions payload:', err)
    return []
  }
}

function getHeaderButtonStyle({ isActive, isOpen, isHovered }) {
  const isEmphasized = isActive || isOpen
  const isHighlighted = isEmphasized || isHovered

  return {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '9px 14px',
    borderRadius: 9,
    border: `1px solid ${isHighlighted ? '#efd5b0' : 'transparent'}`,
    background: isHighlighted ? '#f5ebdf' : 'transparent',
    color: isHighlighted ? '#ef4d00' : '#253547',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.1px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: isEmphasized
      ? '0 4px 10px rgba(199, 128, 53, 0.12)'
      : isHovered
        ? '0 2px 8px rgba(15, 23, 42, 0.06)'
        : 'none'
  }
}

export default function ManagerDashboard() {
  const navigate = useNavigate()
  const isTablet = useMediaQuery('(max-width: 1024px)')
  const isMobile = useMediaQuery('(max-width: 640px)')
  const permissions = getManagerPermissionsSafe()
  const managerIsActive = getManagerActiveSafe()
  const managerName = getManagerNameSafe()

  const mappedTabs = permissions
    .map((permission) => PERMISSION_TO_TAB[String(permission || '').trim().toLowerCase()])
    .filter((tab) => Boolean(tab))

  const baseAllowedTabs = mappedTabs.length > 0
    ? [...new Set(mappedTabs)]
    : DEFAULT_MANAGER_TABS.filter((tabKey) => tabKey !== 'profile')

  const allowedTabs = managerIsActive
    ? ['profile', ...baseAllowedTabs.filter((tabKey) => tabKey !== 'profile')]
    : ['profile']

  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem('managerCurrentTab') || 'dashboard'
    if (saved === 'dashboard') return saved
    return allowedTabs.includes(saved) ? saved : allowedTabs[0]
  })

  const [openMenu, setOpenMenu] = useState(null)
  const [hoveredMenu, setHoveredMenu] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const headerNavRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('managerCurrentTab', tab)
  }, [tab])

  useEffect(() => {
    if (tab === 'dashboard') return
    if (!allowedTabs.includes(tab)) {
      setTab(allowedTabs[0] || 'dashboard')
    }
  }, [allowedTabs, tab])

  useEffect(() => {
    if (!openMenu) return

    const handleClickOutside = (event) => {
      if (headerNavRef.current && !headerNavRef.current.contains(event.target)) {
        setOpenMenu(null)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openMenu])

  useEffect(() => {
    if (!isMobile) {
      setMobileMenuOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    if (isMobile) {
      setMobileMenuOpen(false)
    }
  }, [tab, isMobile])

  const sectionComponents = {
    profile: <ManagerProfileTab />,
    orders: <OrdersTab managerMode={true} />,
    products: <ProductsTab managerMode={true} />,
    offers: <OffersTab managerMode={true} />,
    users: <UsersTab managerMode={true} />,
    coupons: <CouponsTab managerMode={true} />,
    slabs: <GrowthSlabTab managerMode={true} />,
    'transactions-revenue': <TransactionsTab managerMode={true} initialSubTab="revenue" lockToInitialSubTab={true} />,
    'transactions-settlement': <TransactionsTab managerMode={true} initialSubTab="settlement" lockToInitialSubTab={true} />,
    'transactions-warehouse-settlement': <TransactionsTab managerMode={true} initialSubTab="warehouse-settlement" lockToInitialSubTab={true} />,
    transactions: <TransactionsTab managerMode={true} initialSubTab="revenue" lockToInitialSubTab={true} />,
    notifications: <NotificationsTab managerMode={true} />,
    delivery: <DeliveryPartnersTab managerMode={true} />
  }

  const makeItem = (tabKey) => ({
    tab: tabKey,
    label: TAB_META[tabKey].label,
    icon: TAB_META[tabKey].icon
  })

  const headerSections = [
    {
      key: 'operations',
      label: 'Operations',
      items: ['products', 'users', 'orders'].filter((tabKey) => allowedTabs.includes(tabKey)).map(makeItem)
    },
    {
      key: 'growth',
      label: 'Growth',
      items: ['offers', 'coupons', 'slabs', 'transactions-revenue', 'transactions-settlement', 'transactions-warehouse-settlement']
        .filter((tabKey) => allowedTabs.includes(tabKey))
        .map(makeItem)
    },
    {
      key: 'configuration',
      label: 'Configuration',
      items: ['notifications', 'delivery'].filter((tabKey) => allowedTabs.includes(tabKey)).map(makeItem)
    }
  ]
    .filter((section) => section.items.length > 0)
    .map((section) => ({
      ...section,
      tabs: section.items.map((item) => item.tab)
    }))

  const isSectionActive = (tabs) => tabs.includes(tab)

  function handleManagerLogout() {
    localStorage.removeItem('manager_token')
    localStorage.removeItem('manager_permissions')
    localStorage.removeItem('managerCurrentTab')
    localStorage.removeItem('manager_is_active')
    localStorage.removeItem('manager_name')
    localStorage.removeItem('manager_profile_verification_status')
    navigate('/manager-login')
  }

  const quickTabs = ['profile', 'orders', 'products', 'users'].filter((tabKey) => allowedTabs.includes(tabKey))

  const iconTileStyle = {
    profile: { bg: '#e7efff', color: '#0f72d4' },
    orders: { bg: '#e8f1ff', color: '#5f8ec7' },
    products: { bg: '#f4ebdf', color: '#9a6b2a' },
    offers: { bg: '#ffeadd', color: '#ea5d1d' },
    users: { bg: '#eaf1ff', color: '#0b6cdb' },
    coupons: { bg: '#ffe6e6', color: '#d24646' },
    slabs: { bg: '#e8f5ef', color: '#1f8a63' },
    'transactions-revenue': { bg: '#fff4ce', color: '#b88600' },
    transactions: { bg: '#fff4ce', color: '#b88600' },
    'transactions-settlement': { bg: '#fff1e3', color: '#d47a12' },
    'transactions-warehouse-settlement': { bg: '#e8f7ff', color: '#0c7fb0' },
    notifications: { bg: '#fff4cc', color: '#b98a06' },
    delivery: { bg: '#f7f0e5', color: '#d24a1a' }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f6f2e9 0%, #f4efe4 100%)', display: 'flex', flexDirection: 'column' }}>
      <div
        ref={headerNavRef}
        style={{
          background: 'rgba(255, 255, 255, 0.88)',
          borderBottom: '1px solid #f0d8bc',
          padding: isMobile ? '10px 14px' : '10px 18px',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backdropFilter: 'blur(14px)',
          boxShadow: '0 8px 22px rgba(131, 93, 45, 0.07)'
        }}
      >
        <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BrandVideoLogo size={36} style={{ borderRadius: '50%', border: '1px solid #f0c992' }} />
            <div>
              <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#5c3217' }}>ASHIRWAD ENTERPRISES</div>
              <div style={{ fontSize: 11, color: '#ba6a2d', fontWeight: 700, letterSpacing: '0.7px' }}></div>
              <div style={{ fontSize: 11, color: '#ba6a2d', fontWeight: 700, letterSpacing: '0.7px' }}>Manager Portal</div>
            </div>
            </div>
          </div>

          {isMobile && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen((prev) => !prev)
                setOpenMenu(null)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #efd5b0',
                background: '#fdf7ee',
                color: '#e85d0c',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            </button>
          )}

          {(!isMobile || mobileMenuOpen) && (
          <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: 10, flexWrap: 'wrap', overflow: 'visible', width: isMobile ? '100%' : 'auto', rowGap: isMobile ? 8 : 0 }}>
            <button
              type="button"
              onClick={() => {
                setTab('dashboard')
                setOpenMenu(null)
              }}
              onMouseEnter={() => setHoveredMenu('dashboard')}
              onMouseLeave={() => setHoveredMenu(null)}
              style={{
                ...getHeaderButtonStyle({
                  isActive: tab === 'dashboard',
                  isOpen: false,
                  isHovered: hoveredMenu === 'dashboard'
                }),
                ...(isMobile ? { width: '100%', justifyContent: 'space-between' } : null)
              }}
            >
              📊 Dashboard
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('profile')
                setOpenMenu(null)
              }}
              onMouseEnter={() => setHoveredMenu('profile')}
              onMouseLeave={() => setHoveredMenu(null)}
              style={{
                ...getHeaderButtonStyle({
                  isActive: tab === 'profile',
                  isOpen: false,
                  isHovered: hoveredMenu === 'profile'
                }),
                ...(isMobile ? { width: '100%', justifyContent: 'space-between' } : null)
              }}
            >
              👤 Profile
            </button>

            {managerIsActive && headerSections.map((section) => {
              const isActive = isSectionActive(section.tabs)
              const isOpen = openMenu === section.key
              const isHovered = hoveredMenu === section.key

              return (
                <div key={section.key} style={{ position: 'relative', flexShrink: 0, width: isMobile ? '100%' : 'auto' }}>
                  <button
                    type="button"
                    onClick={() => setOpenMenu(isOpen ? null : section.key)}
                    onMouseEnter={() => setHoveredMenu(section.key)}
                    onMouseLeave={() => setHoveredMenu(null)}
                    style={{
                      ...getHeaderButtonStyle({ isActive, isOpen, isHovered }),
                      ...(isMobile ? { width: '100%', justifyContent: 'space-between' } : null)
                    }}
                  >
                    {section.label} <span style={{ fontSize: 12, opacity: 0.7 }}>▾</span>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.18 }}
                        style={{
                          position: isMobile ? 'static' : 'absolute',
                          top: isMobile ? 'auto' : 'calc(100% + 8px)',
                          left: 0,
                          right: 'auto',
                          width: isMobile ? '100%' : 250,
                          marginTop: isMobile ? 8 : 0,
                          background: isMobile ? '#fff8ef' : 'rgba(255, 251, 244, 0.98)',
                          border: '1px solid #ecd2af',
                          borderRadius: 12,
                          padding: 8,
                          boxShadow: '0 14px 30px rgba(96, 68, 35, 0.14)',
                          backdropFilter: isMobile ? 'none' : 'blur(12px)',
                          zIndex: 30
                        }}
                      >
                        {section.items.map((item) => {
                          const isItemActive = tab === item.tab
                          return (
                            <button
                              key={item.tab}
                              type="button"
                              onClick={() => {
                                setTab(item.tab)
                                setOpenMenu(null)
                                setMobileMenuOpen(false)
                              }}
                              onMouseEnter={(event) => {
                                event.currentTarget.style.background = '#fdf1e1'
                                event.currentTarget.style.borderColor = '#ecc79a'
                              }}
                              onMouseLeave={(event) => {
                                event.currentTarget.style.background = isItemActive ? '#fceddd' : 'rgba(255, 255, 255, 0.5)'
                                event.currentTarget.style.borderColor = isItemActive ? '#efceaa' : 'transparent'
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: `1px solid ${isItemActive ? '#efceaa' : 'transparent'}`,
                                background: isItemActive ? '#fceddd' : 'rgba(255, 255, 255, 0.5)',
                                color: isItemActive ? '#e85d0c' : '#28384b',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                marginBottom: 6
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 16 }}>{item.icon}</span>
                                {item.label}
                              </span>
                            </button>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
            <span style={{
              padding: '7px 14px',
              borderRadius: 999,
              border: `1px solid ${managerIsActive ? '#b9e8c5' : '#fed7aa'}`,
              background: managerIsActive ? '#def8e4' : '#fff7ed',
              color: managerIsActive ? '#0f8b35' : '#9a3412',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.5px'
            }}>
              {managerIsActive ? 'MANAGER ACTIVE' : 'MANAGER INACTIVE'}
            </span>
            <button
              onClick={handleManagerLogout}
              style={{ padding: '8px 16px', background: '#fff7ed', border: '1px solid #f3caa0', borderRadius: 9, color: '#eb5a0c', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 14 : 18 }}>
          {tab === 'dashboard' ? (
            <>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'linear-gradient(130deg, #fbf4e2 0%, #f7efdc 55%, #f4e9d5 100%)',
                  border: '1px solid #f0d6af',
                  borderRadius: 20,
                  padding: isMobile ? '18px 18px' : '22px 24px',
                  marginBottom: 18,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: 8, left: '12%', color: '#efbe58', fontSize: 20, opacity: 0.8 }}>✺</div>
                <div style={{ position: 'absolute', top: 8, left: '37%', color: '#efbe58', fontSize: 20, opacity: 0.8 }}>✺</div>
                <div style={{ position: 'absolute', top: 8, left: '62%', color: '#efbe58', fontSize: 20, opacity: 0.8 }}>✺</div>
                <div style={{ position: 'absolute', top: 8, left: '87%', color: '#efbe58', fontSize: 20, opacity: 0.8 }}>✺</div>
                <div style={{ position: 'absolute', right: 24, top: 18, fontSize: isMobile ? 64 : 92, lineHeight: 1, color: 'rgba(243, 203, 140, 0.3)' }}>☀</div>

                <h2 style={{ margin: 0, fontSize: isMobile ? 28 : 34, fontWeight: 700, color: '#101828', fontFamily: '"Georgia", "Times New Roman", serif' }}>
                  Welcome, <span style={{ color: '#ef5b11' }}>{managerName || 'Manager'}</span>
                </h2>
                <p style={{ margin: '12px 0 24px', fontSize: 14, color: '#334155', maxWidth: 760, lineHeight: 1.6 }}>
                  {managerIsActive
                    ? 'Welcome to Ashirwad Enterprises. Keep your profile and documents updated for admin verification while managing your operations.'
                    : 'Your account is inactive. You can only access Dashboard and Profile until admin reactivates your account.'}
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {quickTabs.map((tabKey) => (
                    <button
                      key={tabKey}
                      onClick={() => setTab(tabKey)}
                      style={{
                        padding: '10px 18px',
                        background: '#fff',
                        color: '#1f2937',
                        border: '1px solid #e6d3b8',
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)'
                      }}
                    >
                      {TAB_META[tabKey].icon} {TAB_META[tabKey].label}
                    </button>
                  ))}
                </div>
              </motion.div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: 18 }}>
                {allowedTabs.map((tabKey) => (
                  <motion.button
                    key={tabKey}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setTab(tabKey)}
                    style={{
                      border: '1px solid #e7d8c1',
                      background: '#fff',
                      borderRadius: 14,
                      padding: 18,
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: '0 10px 20px rgba(25, 29, 38, 0.06)',
                      minHeight: 134
                    }}
                  >
                    <div style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: (iconTileStyle[tabKey] || iconTileStyle.profile).bg,
                      color: (iconTileStyle[tabKey] || iconTileStyle.profile).color,
                      fontSize: 14,
                      display: 'grid',
                      placeItems: 'center',
                      marginBottom: 12
                    }}>
                      {TAB_META[tabKey].icon}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{TAB_META[tabKey].label}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.35 }}>Open {TAB_META[tabKey].label} section</div>
                  </motion.button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 8, marginTop: 26, marginBottom: 14 }}>
                <div style={{ color: '#da8e2b', letterSpacing: 10, fontSize: 13 }}>🪔 🪔 🪔</div>
                <div style={{ color: '#f27a25', fontSize: 14, fontStyle: 'italic' }}>Wishing you a prosperous festival season!</div>
              </div>
            </>
          ) : (
            <motion.div initial={{ opacity: 0.95 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              {sectionComponents[tab] || (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, color: '#64748b' }}>
                  Section unavailable.
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
