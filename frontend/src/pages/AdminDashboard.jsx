import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useAdminAuth } from '../context/AdminAuthContext'
import { AnimatePresence, motion } from 'framer-motion'
import BrandVideoLogo from '../components/BrandVideoLogo'
import { useMediaQuery } from '../lib/useMediaQuery'
import GrowthSlabTab from './admin-sections/GrowthSlabTab'
import DeliveryAttendanceTab from './admin-sections/DeliveryAttendanceTab'
import DeliveryPartnersTab from './admin-sections/DeliveryPartnersTab'
import ProductsTab from './admin-sections/ProductsTab'
import ExpressLocationsTab from './admin-sections/ExpressLocationsTab'
import BankAccountsApprovalTab from './admin-sections/BankAccountsApprovalTab'
import SalaryManagementTab from './admin-sections/SalaryManagementTab'
import RefundManagementTab from './admin-sections/RefundManagementTab'
import PayoutRecordsTab from './admin-sections/PayoutRecordsTab'
import { supabase } from '../lib/supabaseClient'
import { fetchAdminOffers, createAdminOffer, updateAdminOffer, deleteAdminOffer } from '../api/client'
import { calculateSlabDiscountAmount, formatSlabRuleText } from '../lib/slabUtils'


const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')
const LOCAL_API_BASE = 'http://localhost:5001'
const STATUS_FLOW = ['Pending', 'Approved', 'Dispatched', 'Delivered']

function buildAdminApiUrl(baseUrl, path) {
  const cleanBase = String(baseUrl || '').replace(/\/$/, '')
  const cleanPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`
  return `${cleanBase}${cleanPath}`
}

function getAdminApiBaseCandidates() {
  const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
  if (isLocalBrowser) {
    return [...new Set([LOCAL_API_BASE, API_BASE])]
  }
  return [API_BASE]
}

async function fetchAdminApi(path, options = {}) {
  const candidates = getAdminApiBaseCandidates()
  let lastError = null

  for (const baseUrl of candidates) {
    try {
      return await fetch(buildAdminApiUrl(baseUrl, path), options)
    } catch (err) {
      lastError = err
    }
  }

  throw (lastError || new Error('Unable to connect to server.'))
}

const statusStyles = {
  Pending: { bg: '#fff7e6', color: '#ad6800' },
  Approved: { bg: '#FFE4B5', color: '#FF8C00' },
  Dispatched: { bg: '#FFE4B5', color: '#FF8C00' },
  Delivered: { bg: '#f6ffed', color: '#237804' }
};

export default function AdminDashboard() {
  const [tab, setTab] = useState(() => localStorage.getItem('adminCurrentTab') || 'dashboard')
  const { logout, adminKey } = useAdminAuth()
  const [stats, setStats] = useState({ products: 0, newProducts: 0, users: 0, orders: 0, activeOrders: 0, pending: 0 })
  const [loadingStats, setLoadingStats] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [openMenu, setOpenMenu] = useState(null)
  const [hoveredMenu, setHoveredMenu] = useState(null)
  const [openTransactionsMenu, setOpenTransactionsMenu] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const headerNavRef = useRef(null)
  const isTablet = useMediaQuery('(max-width: 1024px)')
  const isMobile = useMediaQuery('(max-width: 640px)')

  const [realtimePopups, setRealtimePopups] = useState([])
  const [activeOrderModal, setActiveOrderModal] = useState(null)
  const [warehouses, setWarehouses] = useState([])
  const [deliveryPartners, setDeliveryPartners] = useState([])
  const tabRef = useRef(tab)
  const knownOrderIdsRef = useRef(new Set())

  useEffect(() => {
    tabRef.current = tab
  }, [tab])

  // Load warehouses in AdminDashboard
  useEffect(() => {
    if (!adminKey) return
    async function loadWarehouses() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/warehouses`, { headers: { 'x-admin-api-key': adminKey } })
        if (res.ok) {
          const data = await res.json()
          setWarehouses(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('Failed to load warehouses in AdminDashboard', err)
      }
    }
    loadWarehouses()
  }, [adminKey])

  // Load delivery partners in AdminDashboard
  useEffect(() => {
    if (!adminKey) return
    async function loadDeliveryPartners() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/delivery-partners`, { headers: { 'x-admin-key': adminKey } })
        if (res.ok) {
          const data = await res.json()
          setDeliveryPartners(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('Failed to load delivery partners in AdminDashboard', err)
      }
    }
    loadDeliveryPartners()
  }, [adminKey])

  // Save current tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('adminCurrentTab', tab)
  }, [tab])

  useEffect(() => {
    if (!adminKey) return
    loadStats()
    loadRecentOrders()
  }, [adminKey])

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
    if (openMenu !== 'growth') {
      setOpenTransactionsMenu(false)
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

  async function loadStats() {
    setLoadingStats(true)
    try {
      const headers = { 'x-admin-api-key': adminKey }
      const [productsRes, usersRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/products`, { headers }),
        fetch(`${API_BASE}/api/admin/users`, { headers }),
        fetch(`${API_BASE}/api/admin/orders`, { headers })
      ])
      const [products, users, orders] = await Promise.all([
        productsRes.json(),
        usersRes.json(),
        ordersRes.json()
      ])
      const productList = Array.isArray(products) ? products : []
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
      const newProductCount = productList.filter((product) => {
        const rawCreatedAt = product?.created_at
          || product?.createdAt
          || product?.created_on
          || product?.createdOn
          || product?.date_added
          || product?.dateAdded

        if (!rawCreatedAt) return false

        const createdDate = new Date(rawCreatedAt)
        const createdTimestamp = createdDate.getTime()
        return Number.isFinite(createdTimestamp) && createdTimestamp >= sevenDaysAgo
      }).length

      const orderList = Array.isArray(orders) ? orders : []
      const activeOrderCount = orderList.filter((o) => String(o?.status || '').toLowerCase() !== 'delivered').length
      setStats({
        products: productList.length,
        newProducts: newProductCount,
        users: Array.isArray(users) ? users.length : 0,
        orders: orderList.length,
        activeOrders: activeOrderCount,
        pending: orderList.filter((o) => o.status === 'Pending').length
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingStats(false)
    }
  }

  async function loadRecentOrders() {
    setLoadingOrders(true)
    try {
      const headers = { 'x-admin-api-key': adminKey }
      const res = await fetch(`${API_BASE}/api/admin/orders`, { headers })
      const data = await res.json()
      if (Array.isArray(data)) {
        setOrders(data.slice(0, 4))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingOrders(false)
    }
  }

  // Popup & Modal actions handlers
  const handlePopupApprove = async (orderId, warehouseId = null) => {
    try {
      const requestOptions = {
        method: 'PATCH',
        headers: { 'x-admin-api-key': adminKey }
      }

      if (warehouseId) {
        requestOptions.headers = {
          ...requestOptions.headers,
          'Content-Type': 'application/json'
        }
        requestOptions.body = JSON.stringify({ pickup_warehouse_id: warehouseId })
      }

      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/approve`, requestOptions)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to approve order')
      }

      const popupOrder = realtimePopups.find(p => p.id === orderId)
      const isPickup = popupOrder?.shipping_method === 'pickup_drive' || popupOrder?.pickup_order

      if (isPickup) {
        setRealtimePopups(prev => prev.filter(p => p.id !== orderId))
        alert('Order approved successfully!')
      } else {
        setRealtimePopups(prev => prev.map(p => p.id === orderId ? { ...p, status: 'Approved' } : p))
        alert('Order approved! Please assign a delivery partner.')
      }

      loadStats()
      loadRecentOrders()
    } catch (err) {
      alert(err.message || 'Failed to approve order')
    }
  }

  const handlePopupReview = (order) => {
    setRealtimePopups(prev => prev.filter(p => p.id !== order.id))
    setActiveOrderModal(order)
  }

  const handlePopupViewDetails = (order) => {
    setRealtimePopups(prev => prev.filter(p => p.id !== order.id))
    setActiveOrderModal(order)
  }

  const handlePopupAssign = async (orderId, partnerId) => {
    if (!partnerId) {
      alert('Please select a delivery partner to assign')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
        body: JSON.stringify({ delivery_partner_id: partnerId })
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to assign delivery partner')
      }

      setRealtimePopups(prev => prev.filter(p => p.id !== orderId))
      if (activeOrderModal && activeOrderModal.id === orderId) {
        setActiveOrderModal(null)
      }
      loadStats()
      loadRecentOrders()
      alert('Order assigned to delivery partner successfully!')
    } catch (err) {
      alert(err.message || 'Failed to assign delivery partner')
    }
  }

  const handleModalApprove = async (orderId, warehouseId = null) => {
    try {
      const requestOptions = {
        method: 'PATCH',
        headers: { 'x-admin-api-key': adminKey }
      }

      if (warehouseId) {
        requestOptions.headers = {
          ...requestOptions.headers,
          'Content-Type': 'application/json'
        }
        requestOptions.body = JSON.stringify({ pickup_warehouse_id: warehouseId })
      }

      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/approve`, requestOptions)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to approve order')
      }

      const modalOrder = activeOrderModal || realtimePopups.find(p => p.id === orderId)
      const isPickup = modalOrder?.shipping_method === 'pickup_drive' || modalOrder?.pickup_order

      if (isPickup) {
        setActiveOrderModal(null)
        setRealtimePopups(prev => prev.filter(p => p.id !== orderId))
        alert('Order approved successfully!')
      } else {
        // Keep modal open but update status to 'Approved'
        if (activeOrderModal && activeOrderModal.id === orderId) {
          setActiveOrderModal(prev => prev ? { ...prev, status: 'Approved' } : null)
        }
        setRealtimePopups(prev => prev.map(p => p.id === orderId ? { ...p, status: 'Approved' } : p))
        alert('Order approved! Please assign a delivery partner.')
      }

      loadStats()
      loadRecentOrders()
    } catch (err) {
      alert(err.message || 'Failed to approve order')
    }
  }

  const handleModalCancel = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel/reject this order? This will restore stock.')) return
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: { 'x-admin-api-key': adminKey }
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to cancel order')
      }

      setActiveOrderModal(null)
      setRealtimePopups(prev => prev.filter(p => p.id !== orderId))
      loadStats()
      loadRecentOrders()
      alert('Order cancelled successfully!')
    } catch (err) {
      alert(err.message || 'Failed to cancel order')
    }
  }

  // Real-time listener for new orders (INSERT)
  useEffect(() => {
    if (!adminKey) return

    // Real-time listener for new orders

    const channel = supabase
      .channel('admin-new-orders')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders'
      }, async (payload) => {
        const newOrder = payload.new
        console.log('📦 Real-time order received:', newOrder)

        if (newOrder.id) {
          knownOrderIdsRef.current.add(newOrder.id)
        }

        // If the admin is currently viewing the Orders tab, don't show the popup
        if (tabRef.current === 'orders' || tabRef.current === 'pending') {
          return
        }

        try {
          const [userResult, productsResult] = await Promise.all([
            supabase.from('users').select('full_name, email').eq('id', newOrder.user_id).single(),
            supabase.from('products').select('id, name, price').in('id', newOrder.items?.map(i => i.product_id) || [])
          ])

          const full_name = userResult.data?.full_name || 'Valued Customer'
          const email = userResult.data?.email || ''

          const itemsWithNames = (newOrder.items || []).map(item => {
            const prod = productsResult.data?.find(p => p.id === item.product_id)
            return {
              ...item,
              name: prod?.name || 'Pepsi Product',
              price: item.price !== undefined ? item.price : (prod?.price || 0)
            }
          })

          const enrichedOrder = {
            ...newOrder,
            customer_name: full_name,
            customer_email: email,
            items: itemsWithNames
          }

          setRealtimePopups(prev => {
            if (prev.some(p => p.id === enrichedOrder.id)) return prev
            return [...prev, enrichedOrder]
          })
        } catch (err) {
          console.error('Error enriching realtime order details:', err)
          setRealtimePopups(prev => {
            if (prev.some(p => p.id === newOrder.id)) return prev
            return [...prev, {
              ...newOrder,
              customer_name: 'Customer',
              items: (newOrder.items || []).map(i => ({ ...i, name: 'Pepsi Product' }))
            }]
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [adminKey])

  // Polling fallback to check for new orders and trigger notifications
  useEffect(() => {
    if (!adminKey) return

    let isMounted = true
    let firstRun = true

    // Initialize knownOrderIdsRef with existing order IDs
    async function initializeKnownOrders() {
      try {
        const headers = { 'x-admin-api-key': adminKey }
        const res = await fetch(`${API_BASE}/api/admin/orders`, { headers })
        if (res.ok && isMounted) {
          const data = await res.json()
          if (Array.isArray(data)) {
            data.forEach(o => {
              if (o && o.id) {
                knownOrderIdsRef.current.add(o.id)
              }
            })
          }
        }
      } catch (err) {
        console.error('Failed to initialize known orders in polling:', err)
      } finally {
        firstRun = false
      }
    }

    initializeKnownOrders()

    const interval = setInterval(async () => {
      if (firstRun) return
      try {
        const headers = { 'x-admin-api-key': adminKey }
        const res = await fetch(`${API_BASE}/api/admin/orders`, { headers })
        if (res.ok && isMounted) {
          const data = await res.json()
          if (Array.isArray(data)) {
            const newOrdersDetected = []

            data.forEach(order => {
              if (order && order.id && !knownOrderIdsRef.current.has(order.id)) {
                knownOrderIdsRef.current.add(order.id)
                newOrdersDetected.push(order)
              }
            })

            if (newOrdersDetected.length > 0) {
              console.log('⚡ Polling detected new orders:', newOrdersDetected)

              // Refresh recent orders list and stats in the dashboard
              loadRecentOrders()
              loadStats()

              // If admin is viewing the orders tab, we do not show popups
              if (tabRef.current !== 'orders' && tabRef.current !== 'pending') {
                // Enrich and add to popups
                for (const newOrder of newOrdersDetected) {
                  try {
                    const [userResult, productsResult] = await Promise.all([
                      supabase.from('users').select('full_name, email').eq('id', newOrder.user_id).single(),
                      supabase.from('products').select('id, name, price').in('id', newOrder.items?.map(i => i.product_id) || [])
                    ])

                    const full_name = userResult.data?.full_name || 'Valued Customer'
                    const email = userResult.data?.email || ''

                    const itemsWithNames = (newOrder.items || []).map(item => {
                      const prod = productsResult.data?.find(p => p.id === item.product_id)
                      return {
                        ...item,
                        name: prod?.name || 'Pepsi Product',
                        price: item.price !== undefined ? item.price : (prod?.price || 0)
                      }
                    })

                    const enrichedOrder = {
                      ...newOrder,
                      customer_name: full_name,
                      customer_email: email,
                      items: itemsWithNames
                    }

                    setRealtimePopups(prev => {
                      if (prev.some(p => p.id === enrichedOrder.id)) return prev
                      return [...prev, enrichedOrder]
                    })
                  } catch (err) {
                    console.error('Error enriching polled order details:', err)
                    setRealtimePopups(prev => {
                      if (prev.some(p => p.id === newOrder.id)) return prev
                      return [...prev, {
                        ...newOrder,
                        customer_name: 'Customer',
                        items: (newOrder.items || []).map(i => ({ ...i, name: 'Pepsi Product' }))
                      }]
                    })
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Error in order polling:', err)
      }
    }, 8000) // Poll every 8 seconds

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [adminKey])

  const orderStatusBreakdown = useMemo(() => {
    if (!orders.length) return { Delivered: 0, Processing: 0, Pending: 0 }
    const breakdown = { Delivered: 0, Processing: 0, Pending: 0 }
    orders.forEach(order => {
      if (order.status === 'Delivered') breakdown.Delivered++
      else if (order.status === 'Dispatched' || order.status === 'Approved') breakdown.Processing++
      else breakdown.Pending++
    })
    return breakdown
  }, [orders])

  const operationsTabs = ['products', 'users', 'orders', 'pending']
  const growthTabs = ['offers', 'coupons', 'transactions-revenue', 'transactions-settlement', 'transactions-warehouse-settlement', 'slabs']
  const configurationTabs = ['notifications', 'delivery', 'delivery-attendance', 'managers', 'warehouses', 'express-locations', 'bank-accounts']
  const financialsTabs = ['salary-management', 'refund-management', 'payout-records']

  const headerSections = [
    {
      key: 'operations',
      label: 'Operations',
      tabs: operationsTabs,
      items: [
        { tab: 'products', label: 'Products', icon: '📦', badge: stats.products },
        { tab: 'users', label: 'Users', icon: '👥', badge: stats.users },
        { tab: 'orders', label: 'Orders', icon: '🛒', badge: stats.orders },
        { tab: 'pending', label: 'Pending', icon: '⏳' }
      ]
    },
    {
      key: 'growth',
      label: 'Growth',
      tabs: growthTabs,
      items: [
        { tab: 'offers', label: 'Offers', icon: '🎁' },
        { tab: 'coupons', label: 'Coupons', icon: '🎟️' },
        { tab: 'slabs', label: 'Product Slabs', icon: '📊' },
        {
          tab: 'transactions',
          label: 'Transactions',
          icon: '💳',
          children: [
            { tab: 'transactions-revenue', label: 'Transaction and Revenue', icon: '💰' },
            { tab: 'transactions-settlement', label: 'Collection Settlement from Delivery Partner', icon: '🚚' },
            { tab: 'transactions-warehouse-settlement', label: 'Collection Settlement from Warehouse', icon: '🏬' }
          ]
        }
      ]
    },
    {
      key: 'financials',
      label: 'Financials',
      tabs: financialsTabs,
      items: [
        { tab: 'salary-management', label: 'Salary Management', icon: '💸' },
        { tab: 'refund-management', label: 'Refund Management', icon: '🔄' },
        { tab: 'payout-records', label: 'Payment Records', icon: '📝' }
      ]
    },
    {
      key: 'configuration',
      label: 'Configuration',
      tabs: configurationTabs,
      items: [
        { tab: 'notifications', label: 'Notifications', icon: '🔔' },
        { tab: 'delivery', label: 'Delivery Partners', icon: '🚚' },
        { tab: 'delivery-attendance', label: 'Delivery Attendance', icon: '📍' },
        { tab: 'managers', label: 'Managers', icon: '👔' },
        { tab: 'warehouses', label: 'Warehouses', icon: '🏬' },
        { tab: 'express-locations', label: 'Express Locations', icon: '⚡' },
        { tab: 'bank-accounts', label: 'Bank Accounts', icon: '🏦' }
      ]
    }
  ]


  const isSectionActive = (tabs) => tabs.includes(tab)

  const openTabFromDashboardCard = (nextTab) => {
    setTab(nextTab)
    setOpenMenu(null)
    setOpenTransactionsMenu(false)
  }

  const getHeaderButtonStyle = ({ isActive, isOpen, isHovered }) => {
    const isEmphasized = isActive || isOpen
    const isHighlighted = isEmphasized || isHovered

    return {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '8px 13px',
      borderRadius: 999,
      border: `1px solid ${isHighlighted ? 'rgba(211, 153, 94, 0.45)' : 'transparent'}`,
      background: isHighlighted ? 'rgba(255, 242, 223, 0.92)' : 'transparent',
      color: isHighlighted ? '#7e3d11' : '#8a5b34',
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: '0.2px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: isEmphasized
        ? '0 4px 14px rgba(184, 106, 30, 0.15)'
        : isHovered
          ? '0 2px 8px rgba(122, 63, 18, 0.1)'
          : 'none'
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f8f3e9 0%, #f5efe3 100%)', display: 'flex', flexDirection: 'column', color: '#4b2b17', fontFamily: '"Nunito Sans", "Segoe UI", sans-serif' }}>
      {/* Header Navigation */}
      <div
        ref={headerNavRef}
        style={{
          background: 'rgba(248, 242, 230, 0.96)',
          borderBottom: '1px solid #eadcc6',
          padding: isMobile ? '12px 14px' : isTablet ? '12px 18px' : '12px 30px',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backdropFilter: 'blur(14px)',
          boxShadow: '0 8px 20px rgba(133, 89, 45, 0.08)',
          transition: 'background 0.2s ease, border-color 0.2s ease, backdrop-filter 0.2s ease, box-shadow 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BrandVideoLogo size={42} style={{ borderRadius: 12, boxShadow: '0 6px 16px rgba(255, 103, 31, 0.22)' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#5c3217' }}>ASHIRWAD ENTERPRISES</div>
              <div style={{ fontSize: 11, color: '#ba6a2d', fontWeight: 700, letterSpacing: '0.7px' }}></div>
              <div style={{ fontSize: 11, color: '#ba6a2d', fontWeight: 700, letterSpacing: '0.7px' }}>Admin Portal</div>
            </div>
          </div>

          {isMobile && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen((prev) => !prev)
                setOpenMenu(null)
                setOpenTransactionsMenu(false)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(211, 153, 94, 0.45)',
                background: 'rgba(255, 248, 236, 0.96)',
                color: '#7e3d11',
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
                  setOpenTransactionsMenu(false)
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

              {headerSections.map((section) => {
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
                            width: isMobile ? '100%' : 240,
                            marginTop: isMobile ? 8 : 0,
                            background: isMobile ? '#fff8ef' : 'rgba(255, 247, 234, 0.96)',
                            border: '1px solid rgba(226, 195, 155, 0.7)',
                            borderRadius: 12,
                            padding: 8,
                            boxShadow: '0 18px 34px rgba(137, 93, 45, 0.14)',
                            backdropFilter: isMobile ? 'none' : 'blur(14px)',
                            zIndex: 30
                          }}
                        >
                          {section.items.map((item) => {
                            const isItemActive = tab === item.tab
                            const hasChildren = Array.isArray(item.children) && item.children.length > 0
                            const isSubmenuOpen = hasChildren && (openTransactionsMenu || (openMenu === 'growth' && tab === 'transactions'))
                            return (
                              <div key={item.tab} style={{ display: 'grid', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (hasChildren) {
                                      setOpenTransactionsMenu(!openTransactionsMenu)
                                      return
                                    }
                                    setTab(item.tab)
                                    setOpenMenu(null)
                                  }}
                                  onMouseEnter={(event) => {
                                    event.currentTarget.style.background = 'rgba(255, 237, 210, 0.6)'
                                    event.currentTarget.style.borderColor = 'rgba(212, 156, 90, 0.45)'
                                  }}
                                  onMouseLeave={(event) => {
                                    event.currentTarget.style.background = isItemActive ? 'rgba(255, 226, 188, 0.58)' : 'rgba(255, 255, 255, 0.42)'
                                    event.currentTarget.style.borderColor = isItemActive ? 'rgba(199, 129, 61, 0.58)' : 'transparent'
                                  }}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: `1px solid ${isItemActive ? 'rgba(199, 129, 61, 0.58)' : 'transparent'}`,
                                    background: isItemActive ? 'rgba(255, 226, 188, 0.58)' : 'rgba(255, 255, 255, 0.42)',
                                    color: isItemActive ? '#7e3d11' : '#5e381d',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                                    {item.label}
                                  </span>
                                  {hasChildren ? (
                                    <span style={{ fontSize: 12, opacity: 0.7 }}>{isSubmenuOpen ? '▴' : '▾'}</span>
                                  ) : (
                                    item.badge !== undefined && (
                                      <span
                                        style={{
                                          minWidth: 24,
                                          padding: '2px 8px',
                                          borderRadius: 999,
                                          background: 'rgba(255, 236, 210, 0.82)',
                                          color: '#8a511f',
                                          fontSize: 11,
                                          fontWeight: 700
                                        }}
                                      >
                                        {item.badge}
                                      </span>
                                    )
                                  )}
                                </button>
                                {hasChildren && isSubmenuOpen && (
                                  <div style={{ display: 'grid', gap: 6, paddingLeft: isMobile ? 0 : 12 }}>
                                    {item.children.map((child) => {
                                      const isChildActive = tab === child.tab
                                      return (
                                        <button
                                          key={child.tab}
                                          type="button"
                                          onClick={() => {
                                            setTab(child.tab)
                                            setOpenTransactionsMenu(false)
                                            setOpenMenu(null)
                                            setMobileMenuOpen(false)
                                          }}
                                          onMouseEnter={(event) => {
                                            event.currentTarget.style.background = 'rgba(255, 237, 210, 0.58)'
                                            event.currentTarget.style.borderColor = 'rgba(212, 156, 90, 0.45)'
                                          }}
                                          onMouseLeave={(event) => {
                                            event.currentTarget.style.background = isChildActive ? 'rgba(255, 226, 188, 0.56)' : 'rgba(255, 255, 255, 0.38)'
                                            event.currentTarget.style.borderColor = isChildActive ? 'rgba(199, 129, 61, 0.58)' : 'transparent'
                                          }}
                                          style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 10,
                                            padding: '9px 12px',
                                            borderRadius: 10,
                                            border: `1px solid ${isChildActive ? 'rgba(199, 129, 61, 0.58)' : 'transparent'}`,
                                            background: isChildActive ? 'rgba(255, 226, 188, 0.56)' : 'rgba(255, 255, 255, 0.38)',
                                            color: isChildActive ? '#7e3d11' : '#5e381d',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                          }}
                                        >
                                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 15 }}>{child.icon}</span>
                                            {child.label}
                                          </span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
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

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 999, background: '#fff5e7', border: '1px solid #f0d7b8' }}>
              <span style={{ fontSize: 11, color: '#a6642e', fontWeight: 700, letterSpacing: '0.4px' }}>SECURE KEY</span>
              <div style={{ background: 'rgba(255,255,255,0.9)', padding: '5px 10px', borderRadius: 999, border: '1px solid #efd7b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontFamily: 'monospace', letterSpacing: '0.5px' }}>{showKey ? adminKey : '••••••••••••'}</span>
                <button onClick={() => setShowKey(!showKey)} style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 2 }}>👁️</button>
              </div>
            </div>
            <button onClick={logout} style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', padding: 0, background: '#fff', border: '1px solid #eed8bd', borderRadius: '50%', color: '#9b5928', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 3px 10px rgba(133,89,45,0.08)' }} title="Log out" aria-label="Log out">
              ⎋
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        {/* <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 32px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Dashboard Overview</h1>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              Ashirwad Enterprises · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div> */}

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 14 : 22 }}>
          {tab === 'dashboard' ? (
            <>
              {/* Greeting Section */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'linear-gradient(100deg, #f8efcc 0%, #f3e6c3 60%, #f0debd 100%)',
                  borderRadius: 28,
                  border: '1px solid #e9d8bc',
                  boxShadow: '0 14px 28px rgba(168, 122, 72, 0.09)',
                  padding: isMobile ? '74px 20px 24px' : isTablet ? '50px 30px 34px' : '54px 42px 40px',
                  marginBottom: 20,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: -22, left: '8%', width: 30, height: 72, borderRadius: 999, background: 'linear-gradient(180deg, #f1c35f 0%, #dfad45 100%)', opacity: 0.75 }} />
                <div style={{ position: 'absolute', top: -18, left: '34%', width: 26, height: 66, borderRadius: 999, background: 'linear-gradient(180deg, #f2c96e 0%, #e1b050 100%)', opacity: 0.78 }} />
                <div style={{ position: 'absolute', top: -20, right: '18%', width: 28, height: 70, borderRadius: 999, background: 'linear-gradient(180deg, #f1c35f 0%, #dfad45 100%)', opacity: 0.72 }} />

                <div style={{ position: 'absolute', top: isMobile ? 18 : 26, left: isMobile ? 18 : 28, fontSize: 11, fontWeight: 700, color: '#cb6f23', display: 'flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 999, border: '1px solid #efcf9b', background: 'rgba(255, 247, 230, 0.85)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }}></span>
                  Auspicious Day
                </div>

                <div style={{ position: 'absolute', right: isMobile ? 16 : 28, top: isMobile ? 18 : 60, width: isMobile ? 46 : 66, height: isMobile ? 46 : 66, borderRadius: '50%', border: '3px solid rgba(239, 177, 76, 0.6)', opacity: 0.72 }}>
                  <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', background: 'rgba(242, 191, 94, 0.35)' }} />
                </div>

                <h2 style={{ margin: 0, fontSize: isMobile ? 30 : isTablet ? 36 : 42, lineHeight: 1.06, fontWeight: 700, color: '#4f210f', maxWidth: 640, fontFamily: '"Georgia", "Times New Roman", serif' }}>
                  Ashirwad
                  <br />
                  <span style={{ background: 'linear-gradient(90deg, #cc2f1f 0%, #e45e17 45%, #d9861b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Enterprises</span>
                </h2>
                <p style={{ margin: '14px 0 24px', fontSize: isMobile ? 14 : 16, color: '#7e4d2a', maxWidth: 660, lineHeight: 1.6, fontFamily: '"Nunito Sans", "Segoe UI", sans-serif' }}>
                  Welcome to the Ashirwad Enterprises admin dashboard. Manage operations, users, and reports from one central workspace.
                </p>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <button onClick={() => openTabFromDashboardCard('transactions-revenue')} style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #ff5a1f 0%, #ee7f13 55%, #df9a2b 100%)', color: '#fff', border: 0, borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 16px rgba(217, 98, 24, 0.22)' }}>
                    View Reports
                  </button>
                  <button onClick={() => openTabFromDashboardCard('users')} style={{ padding: '12px 28px', background: '#fff6e8', color: '#5f381d', border: '1px solid #ecd3b3', borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Manage Users
                  </button>
                </div>
              </motion.div>

              {/* Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 18 }}>
                <StatsCard icon="📦" label="Total Products" value={stats.products} badge={stats.newProducts > 0 ? `+${stats.newProducts} NEW` : null} badgeColor="#f79a48" iconBg="linear-gradient(135deg, #f59e0b 0%, #f97316 100%)" onClick={() => openTabFromDashboardCard('products')} />
                <StatsCard icon="👥" label="Total Users" value={stats.users} iconBg="linear-gradient(135deg, #f97316 0%, #ef4444 100%)" onClick={() => openTabFromDashboardCard('users')} />
                <StatsCard icon="🛒" label="Active Orders" value={stats.activeOrders} badge="ACTION" badgeColor="#f2a53b" iconBg="linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)" onClick={() => openTabFromDashboardCard('orders')} />
                <StatsCard icon="🛡️" label="Pending Verifications" value={stats.pending} badge="SYNCED" badgeColor="#9f9f9f" iconBg="linear-gradient(135deg, #6b3f24 0%, #4b2f1a 100%)" onClick={() => openTabFromDashboardCard('pending')} />
              </div>

              {/* Two Column Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 2fr) minmax(240px, 1fr)', gap: 16 }}>
                {/* Recent Transactions */}
                <div
                  onClick={() => openTabFromDashboardCard('transactions-revenue')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openTabFromDashboardCard('transactions-revenue')
                    }
                  }}
                  style={{ background: 'rgba(255, 253, 248, 0.95)', borderRadius: 24, padding: isMobile ? '18px 18px 14px' : '22px 22px 16px', border: '1px solid #ecdcc4', boxShadow: '0 10px 22px rgba(157, 111, 58, 0.08)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0, marginBottom: 20 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#4b2411', fontFamily: '"Georgia", "Times New Roman", serif' }}>Recent Transactions</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#c98956', letterSpacing: '0.2px' }}>Latest financial activity during this festive period.</p>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        openTabFromDashboardCard('transactions-revenue')
                      }}
                      style={{ background: 'transparent', border: 0, fontSize: 22, color: '#d08d52', cursor: 'pointer', padding: '2px 8px' }}
                    >
                      ⋯
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #efdfca' }}>
                          <th style={{ padding: '11px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#cf9a64', letterSpacing: '0.5px' }}>TRANSACTION ID</th>
                          <th style={{ padding: '11px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#cf9a64', letterSpacing: '0.5px' }}>USER NAME</th>
                          <th style={{ padding: '11px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#cf9a64', letterSpacing: '0.5px' }}>DATE</th>
                          <th style={{ padding: '11px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#cf9a64', letterSpacing: '0.5px' }}>AMOUNT</th>
                          <th style={{ padding: '11px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#cf9a64', letterSpacing: '0.5px' }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingOrders ? (
                          <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#b78a5a' }}>Loading...</td></tr>
                        ) : orders.length === 0 ? (
                          <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#b78a5a' }}>No recent transactions</td></tr>
                        ) : (
                          orders.map((order, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f5e8d5' }}>
                              <td style={{ padding: '15px 0', fontSize: 12, fontWeight: 700, color: '#4a2613' }}>{order.order_id || `#TRX-${order.id?.slice(0, 5)}`}</td>
                              <td style={{ padding: '15px 0', fontSize: 12, fontWeight: 600, color: '#4a2613' }}>{order.users?.full_name || order.customer_name || 'Unknown'}</td>
                              <td style={{ padding: '15px 0', fontSize: 12, color: '#be8250' }}>{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                              <td style={{ padding: '15px 0', fontSize: 14, fontWeight: 700, color: '#3f2214' }}>₹ {order.total_amount?.toLocaleString('en-IN') || '0'}</td>
                              <td style={{ padding: '14px 0' }}>
                                <span style={{
                                  padding: '4px 11px',
                                  borderRadius: 999,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  border: '1px solid #f2caa4',
                                  background: order.status === 'Delivered' ? '#fff2e6' : order.status === 'Pending' ? '#fff7ec' : '#fff0df',
                                  color: order.status === 'Delivered' ? '#cd5a1f' : order.status === 'Pending' ? '#d17d1f' : '#a0501a',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5
                                }}>
                                  {order.status === 'Delivered' ? '✓ COMPLETED' : order.status === 'Pending' ? '⊙ PROCESSING' : '⊙ ' + order.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Order Distribution */}
                <div
                  onClick={() => openTabFromDashboardCard('orders')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openTabFromDashboardCard('orders')
                    }
                  }}
                  style={{ background: 'rgba(255, 253, 248, 0.95)', borderRadius: 24, padding: isMobile ? 18 : 22, border: '1px solid #ecdcc4', boxShadow: '0 10px 22px rgba(157, 111, 58, 0.08)', cursor: 'pointer' }}
                >
                  <h3 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700, color: '#4b2411', fontFamily: '"Georgia", "Times New Roman", serif' }}>Order Distribution</h3>
                  <p style={{ margin: '0 0 24px', fontSize: 12, color: '#c98956' }}>Breakdown of current order statuses.</p>

                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                    <div style={{ position: 'relative', width: 180, height: 180 }}>
                      <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#f3e5d2" strokeWidth="8" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#f0641c" strokeWidth="8" strokeDasharray={`${(orderStatusBreakdown.Delivered / stats.orders * 251.2) || 0} 251.2`} strokeDashoffset="0" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#f2a712" strokeWidth="8" strokeDasharray={`${(orderStatusBreakdown.Processing / stats.orders * 251.2) || 0} 251.2`} strokeDashoffset={`-${(orderStatusBreakdown.Delivered / stats.orders * 251.2) || 0}`} />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#efc431" strokeWidth="8" strokeDasharray={`${(orderStatusBreakdown.Pending / stats.orders * 251.2) || 0} 251.2`} strokeDashoffset={`-${((orderStatusBreakdown.Delivered + orderStatusBreakdown.Processing) / stats.orders * 251.2) || 0}`} />
                      </svg>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', width: 96, height: 96, borderRadius: '50%', border: '1px solid #efdac0', display: 'grid', alignContent: 'center', background: '#fff8ee' }}>
                        <div style={{ fontSize: 32, lineHeight: 1, fontWeight: 700, color: '#4a2511', fontFamily: '"Georgia", "Times New Roman", serif' }}>{stats.orders}</div>
                        <div style={{ fontSize: 10, color: '#c0854f', fontWeight: 700, letterSpacing: '1px' }}>TOTAL</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#f0641c' }}></div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#875128' }}>Delivered</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#4b2411' }}>{stats.orders > 0 ? Math.round(orderStatusBreakdown.Delivered / stats.orders * 100) : 0}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#f2a712' }}></div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#875128' }}>In Transit</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#4b2411' }}>{stats.orders > 0 ? Math.round(orderStatusBreakdown.Processing / stats.orders * 100) : 0}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#efc431' }}></div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#875128' }}>Processing</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#4b2411' }}>{stats.orders > 0 ? Math.round(orderStatusBreakdown.Pending / stats.orders * 100) : 0}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                  marginTop: 18
                }}
              >
                <button
                  onClick={() => setTab('managers')}
                  style={{
                    padding: '16px 18px',
                    background: 'rgba(255, 252, 246, 0.95)',
                    border: '1px solid #ecdcc4',
                    borderRadius: 16,
                    color: '#4b2411',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: 700,
                    fontSize: 14,
                    boxShadow: '0 8px 20px rgba(157, 111, 58, 0.08)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fff8ed'
                    e.currentTarget.style.borderColor = '#e0c49f'
                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(157, 111, 58, 0.14)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 252, 246, 0.95)'
                    e.currentTarget.style.borderColor = '#ecdcc4'
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(157, 111, 58, 0.08)'
                  }}
                >
                  <div style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 21,
                    color: '#fff'
                  }}>
                    👔
                  </div>
                  <span style={{ fontSize: 18, lineHeight: 1.2, fontFamily: '"Georgia", "Times New Roman", serif', color: '#5a2d14' }}>Add New Manager</span>
                  <span style={{ fontSize: 13, lineHeight: 1.35, color: '#bd8553', maxWidth: 240 }}>Create a new profile with custom access permissions for management.</span>
                </button>

                <button
                  onClick={() => setTab('notifications')}
                  style={{
                    padding: '16px 18px',
                    background: 'rgba(255, 252, 246, 0.95)',
                    border: '1px solid #ecdcc4',
                    borderRadius: 16,
                    color: '#4b2411',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: 700,
                    fontSize: 14,
                    boxShadow: '0 8px 20px rgba(157, 111, 58, 0.08)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fff8ed'
                    e.currentTarget.style.borderColor = '#e0c49f'
                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(157, 111, 58, 0.14)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 252, 246, 0.95)'
                    e.currentTarget.style.borderColor = '#ecdcc4'
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(157, 111, 58, 0.08)'
                  }}
                >
                  <div style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 21,
                    color: '#fff'
                  }}>
                    📢
                  </div>
                  <span style={{ fontSize: 18, lineHeight: 1.2, fontFamily: '"Georgia", "Times New Roman", serif', color: '#5a2d14' }}>New Announcement</span>
                  <span style={{ fontSize: 13, lineHeight: 1.35, color: '#bd8553', maxWidth: 240 }}>Broadcast a festive message or update to all system users and customers.</span>
                </button>

                <button
                  onClick={() => setTab('coupons')}
                  style={{
                    padding: '16px 18px',
                    background: 'rgba(255, 252, 246, 0.95)',
                    border: '1px solid #ecdcc4',
                    borderRadius: 16,
                    color: '#4b2411',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: 700,
                    fontSize: 14,
                    boxShadow: '0 8px 20px rgba(157, 111, 58, 0.08)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fff8ed'
                    e.currentTarget.style.borderColor = '#e0c49f'
                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(157, 111, 58, 0.14)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 252, 246, 0.95)'
                    e.currentTarget.style.borderColor = '#ecdcc4'
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(157, 111, 58, 0.08)'
                  }}
                >
                  <div style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #f2b018 0%, #d27f1f 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 21,
                    color: '#fff'
                  }}>
                    🎟️
                  </div>
                  <span style={{ fontSize: 18, lineHeight: 1.2, fontFamily: '"Georgia", "Times New Roman", serif', color: '#5a2d14' }}>Create Promo Coupon</span>
                  <span style={{ fontSize: 13, lineHeight: 1.35, color: '#bd8553', maxWidth: 240 }}>Generate a new discount code for Ashirwad Enterprises customers.</span>
                </button>
              </motion.div>

              <div style={{ marginTop: 18, padding: '11px 16px', borderRadius: 999, border: '1px solid #ecd6b5', background: '#f8efe1', textAlign: 'center', color: '#c1844d', fontSize: 10, letterSpacing: '1.2px', fontWeight: 700, textTransform: 'uppercase' }}>
                Ashirwad Enterprises
              </div>
            </>
          ) : (
            <motion.div initial={{ opacity: 0.95 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              {tab === 'orders' && <OrdersTab />}
              {tab === 'pending' && <OrdersTab filterStatus="Pending" />}
              {tab === 'products' && <ProductsTab />}
              {tab === 'offers' && <OffersTab />}
              {tab === 'managers' && <ManagersTab adminKey={adminKey} />}
              {tab === 'users' && <UsersTab />}
              {tab === 'coupons' && <CouponsTab />}
              {tab === 'transactions-revenue' && <TransactionRevenueTab />}
              {tab === 'transactions-settlement' && <CollectionSettlementTab />}
              {tab === 'transactions-warehouse-settlement' && <WarehouseSettlementTab />}
              {tab === 'slabs' && <GrowthSlabTab adminKey={adminKey} />}
              {tab === 'notifications' && <NotificationsTab />}
              {tab === 'delivery' && <DeliveryPartnersTab adminKey={adminKey} />}
              {tab === 'delivery-attendance' && <DeliveryAttendanceTab adminKey={adminKey} />}
              {tab === 'warehouses' && <WarehouseTab adminKey={adminKey} />}
              {tab === 'express-locations' && <ExpressLocationsTab adminKey={adminKey} />}
              {tab === 'bank-accounts' && <BankAccountsApprovalTab adminKey={adminKey} />}
              {tab === 'salary-management' && <SalaryManagementTab adminKey={adminKey} />}
              {tab === 'refund-management' && <RefundManagementTab adminKey={adminKey} />}
              {tab === 'payout-records' && <PayoutRecordsTab adminKey={adminKey} />}
            </motion.div>

          )}
        </div>
      </div>

      {/* Realtime Popup Notifications */}
      <RealtimePopupContainer
        popups={realtimePopups}
        onDismiss={(id) => setRealtimePopups(prev => prev.filter(p => p.id !== id))}
        onApprove={handlePopupApprove}
        onReview={handlePopupReview}
        onViewDetails={handlePopupViewDetails}
        onAssign={handlePopupAssign}
        warehouses={warehouses}
        deliveryPartners={deliveryPartners}
        adminKey={adminKey}
      />

      {/* Realtime Order Detail Modal */}
      <AnimatePresence>
        {activeOrderModal && (
          <OrderDetailModal
            order={activeOrderModal}
            onClose={() => setActiveOrderModal(null)}
            onApprove={handleModalApprove}
            onCancel={handleModalCancel}
            onAssign={handlePopupAssign}
            warehouses={warehouses}
            deliveryPartners={deliveryPartners}
            adminKey={adminKey}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Removed the old inline ManagersTab function definition from AdminDashboard.jsx
// --- ManagersTab component ---
function ManagersTab({ adminKey }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    sections: {
      orders: false,
      products: false,
      offers: false,
      users: false,
      coupons: false,
      slabs: false,
      'transactions-revenue': false,
      'transactions-settlement': false,
      'transactions-warehouse-settlement': false,
      notifications: false,
      delivery: false
    }
  })

  const [managers, setManagers] = useState([])
  const [loadingManagers, setLoadingManagers] = useState(false)
  const [managerActionMsg, setManagerActionMsg] = useState('')
  const [editingManagerId, setEditingManagerId] = useState(null)
  const [editingSections, setEditingSections] = useState({})
  const [savingRoleUpdate, setSavingRoleUpdate] = useState(false)

  // Manager profile / documents modal
  const [profileModal, setProfileModal] = useState(null) // { manager, profile, documents, required_documents, verification_status }
  const [profileModalLoading, setProfileModalLoading] = useState(false)
  const [profileModalError, setProfileModalError] = useState('')
  const [docActionLoading, setDocActionLoading] = useState('') // documentType being actioned
  const [rejectingDocType, setRejectingDocType] = useState('') // which doc is showing rejection input
  const [rejectionReason, setRejectionReason] = useState('')
  const [failedPhotoUrls, setFailedPhotoUrls] = useState({})

  const toManagerPhotoUrl = (value) => {
    const raw = String(value || '').trim()
    if (!raw) return null
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw
    const base = String(API_BASE || '').trim().replace(/\/+$/, '')
    if (!base) return raw.startsWith('/') ? raw : `/${raw}`
    return `${base}${raw.startsWith('/') ? raw : `/${raw}`}`
  }

  const hasPhotoLoadFailed = (url) => Boolean(url && failedPhotoUrls[url])

  const markPhotoLoadFailed = (url) => {
    if (!url) return
    setFailedPhotoUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }))
  }

  // Fetch all managers

  useEffect(() => {
    if (!adminKey) return;
    fetchManagers();
    // eslint-disable-next-line
  }, [adminKey])

  async function fetchManagers() {
    setLoadingManagers(true);
    setManagerActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/managers`, { headers: { 'x-admin-api-key': adminKey } });
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        // If not JSON, show a clear error
        setManagerActionMsg('Server error: Response is not valid JSON. The backend may be down or misconfigured.');
        setLoadingManagers(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to fetch managers');
      setManagers(Array.isArray(data) ? data : []);
    } catch (err) {
      setManagerActionMsg(err.message);
    } finally {
      setLoadingManagers(false);
    }
  }

  async function handleDeleteManager(managerId) {
    if (!window.confirm('Are you sure you want to delete this manager? This cannot be undone.')) return;
    setManagerActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/managers/${managerId}`, {
        method: 'DELETE',
        headers: { 'x-admin-api-key': adminKey }
      });
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        setManagerActionMsg('Server error: Response is not valid JSON. The backend may be down or misconfigured.');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to delete manager');
      setManagerActionMsg('✓ Manager deleted');
      fetchManagers();
    } catch (err) {
      setManagerActionMsg(err.message);
    }
  }

  async function handleToggleActive(manager) {
    setManagerActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/managers/${manager.id}/activate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
        body: JSON.stringify({ is_verified: !manager.is_verified })
      });
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        setManagerActionMsg('Server error: Response is not valid JSON. The backend may be down or misconfigured.');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to update manager status');
      setManagerActionMsg(`✓ Manager ${!manager.is_verified ? 'activated' : 'deactivated'}`);
      fetchManagers();
    } catch (err) {
      setManagerActionMsg(err.message);
    }
  }
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const sectionList = [
    { key: 'orders', label: 'Orders', icon: '🛒', desc: 'View & manage incoming orders' },
    { key: 'products', label: 'Products', icon: '📦', desc: 'Add & edit catalog items' },
    { key: 'offers', label: 'Offers', icon: '🎁', desc: 'Manage sales campaigns' },
    { key: 'users', label: 'Users', icon: '👥', desc: 'Customer database access' },
    { key: 'coupons', label: 'Coupons', icon: '🎟️', desc: 'Generate discount codes' },
    { key: 'slabs', label: 'Product Slabs', icon: '📊', desc: 'Manage quantity slab discounts' },
    { key: 'transactions-revenue', label: 'Transaction and Revenue', icon: '💰', desc: 'Financial records, revenue, and reports' },
    { key: 'transactions-settlement', label: 'Collection Settlement from Delivery Partner', icon: '🚚', desc: 'Partner settlement and reconciliation' },
    { key: 'transactions-warehouse-settlement', label: 'Collection Settlement from Warehouse', icon: '🏬', desc: 'Warehouse settlement and reconciliation' },
    { key: 'notifications', label: 'Notifications', icon: '🔔', desc: 'Push & email settings' },
    { key: 'delivery', label: 'Delivery', icon: '🚚', desc: 'Logistics & partners' }
  ]

  const sectionLabelsByKey = sectionList.reduce((acc, section) => {
    acc[section.key] = section.label
    return acc
  }, {
    transactions: 'Transaction and Revenue'
  })

  async function openManagerProfile(manager) {
    setProfileModal(null)
    setProfileModalError('')
    setProfileModalLoading(true)
    setDocActionLoading('')
    setRejectingDocType('')
    setRejectionReason('')

    // Show skeleton immediately with basic info, then load docs
    setProfileModal({ manager, profile: null, documents: [], required_documents: [], verification_status: '' })

    try {
      const res = await fetch(`${API_BASE}/api/admin/managers/${manager.id}/verification-documents`, {
        headers: { 'x-admin-api-key': adminKey }
      })
      let data
      try { data = await res.json() } catch { throw new Error('Server returned invalid JSON') }
      if (!res.ok) throw new Error(data.error || 'Failed to load manager profile')
      setProfileModal({
        manager,
        profile: data.profile,
        documents: Array.isArray(data.documents) ? data.documents : [],
        required_documents: Array.isArray(data.required_documents) ? data.required_documents : [],
        verification_status: data.verification_status || ''
      })
    } catch (err) {
      setProfileModalError(err.message)
    } finally {
      setProfileModalLoading(false)
    }
  }

  function closeManagerProfile() {
    setProfileModal(null)
    setProfileModalError('')
    setDocActionLoading('')
    setRejectingDocType('')
    setRejectionReason('')
  }

  async function handleDocStatus(managerId, documentType, status, reason) {
    setDocActionLoading(documentType)
    setProfileModalError('')
    try {
      const body = { status }
      if (status === 'Rejected') body.rejection_reason = reason
      const res = await fetch(
        `${API_BASE}/api/admin/managers/${managerId}/verification-documents/${documentType}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
          body: JSON.stringify(body)
        }
      )
      let data
      try { data = await res.json() } catch { throw new Error('Server returned invalid JSON') }
      if (!res.ok) throw new Error(data.error || 'Failed to update document status')
      setProfileModal((prev) => prev ? {
        ...prev,
        documents: Array.isArray(data.documents) ? data.documents : prev.documents,
        verification_status: data.verification_status || prev.verification_status
      } : prev)
      setRejectingDocType('')
      setRejectionReason('')
      fetchManagers()
    } catch (err) {
      setProfileModalError(err.message)
    } finally {
      setDocActionLoading('')
    }
  }

  function openRoleEditor(manager) {
    const next = {}
    const managerPermissions = Array.isArray(manager?.permissions) ? manager.permissions : []

    for (const section of sectionList) {
      next[section.key] = managerPermissions.includes(section.key)
    }

    setEditingSections(next)
    setEditingManagerId(manager.id)
    setManagerActionMsg('')
  }

  function closeRoleEditor() {
    setEditingManagerId(null)
    setEditingSections({})
    setSavingRoleUpdate(false)
  }

  async function handleSaveManagerRole(managerId) {
    setManagerActionMsg('')
    setSavingRoleUpdate(true)

    try {
      const selectedSections = sectionList
        .filter((section) => Boolean(editingSections[section.key]))
        .map((section) => section.key)

      const res = await fetch(`${API_BASE}/api/admin/managers/${managerId}/sections`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': adminKey
        },
        body: JSON.stringify({ sections: selectedSections })
      })

      let data
      try {
        data = await res.json()
      } catch (jsonErr) {
        setManagerActionMsg('Server error: Response is not valid JSON. The backend may be down or misconfigured.')
        return
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update assigned role')
      }

      setManagerActionMsg('✓ Manager assigned role updated')
      closeRoleEditor()
      fetchManagers()
    } catch (err) {
      setManagerActionMsg(err.message)
    } finally {
      setSavingRoleUpdate(false)
    }
  }


  function handleChange(e) {
    const { name, value, checked } = e.target
    if (name.startsWith('section_')) {
      setForm(f => ({ ...f, sections: { ...f.sections, [name.replace('section_', '')]: checked } }))
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      setMessage('Please fill in all required fields')
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      const res = await fetch(`${API_BASE}/api/admin/create-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          sections: Object.entries(form.sections).filter(([k, v]) => v).map(([k]) => k)
        })
      })
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        setMessage('Server error: Response is not valid JSON. The backend may be down or misconfigured.');
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to create manager')
      setMessage('✓ Manager account created successfully!')
      setForm({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        sections: {
          orders: false,
          products: false,
          offers: false,
          users: false,
          coupons: false,
          slabs: false,
          'transactions-revenue': false,
          'transactions-settlement': false,
          'transactions-warehouse-settlement': false,
          notifications: false,
          delivery: false
        }
      })
      setShowPassword(false)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedSections = Object.values(form.sections).filter(Boolean).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: 900, margin: '0 auto' }}
    >
      {/* List of Managers */}
      <div style={{ marginBottom: 40, background: '#fff', borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', padding: 32, border: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: '0 0 18px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Managers</h2>
        {managerActionMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 16, color: managerActionMsg.includes('✓') ? '#065f46' : '#991b1b', background: managerActionMsg.includes('✓') ? '#d1fae5' : '#fee2e2', border: `1px solid ${managerActionMsg.includes('✓') ? '#a7f3d0' : '#fca5a5'}`, borderRadius: 8, padding: 10, fontWeight: 600 }}>{managerActionMsg}</motion.div>
        )}
        {(() => {
          const mgrInitials = (name) => {
            const v = String(name || '').trim()
            if (!v) return 'M'
            return v.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
          }
          const mgrAvatarColor = (name) => {
            const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']
            const v = String(name || 'Manager')
            let s = 0; for (let i = 0; i < v.length; i++) s += v.charCodeAt(i)
            return colors[s % colors.length]
          }
          const mgrDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

          if (loadingManagers) return <div style={{ color: '#888', padding: 20 }}>Loading managers…</div>
          if (managers.length === 0) return <div style={{ color: '#888', padding: 20 }}>No managers found.</div>

          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20, marginBottom: 10 }}>
                {managers.map((m) => {
                  const assignedSections = Array.isArray(m.permissions) ? m.permissions : []
                  const isActive = Boolean(m.is_verified)
                  const cardPhotoUrl = toManagerPhotoUrl(m.profile_photo_url)
                  const showCardPhoto = Boolean(cardPhotoUrl && !hasPhotoLoadFailed(cardPhotoUrl))

                  return (
                    <div
                      key={m.id}
                      style={{
                        padding: 20,
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0
                      }}
                    >
                      {/* Avatar + name row */}
                      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                          background: showCardPhoto ? '#e2e8f0' : mgrAvatarColor(m.full_name),
                          overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 700, fontSize: 18
                        }}>
                          {showCardPhoto ? (
                            <img
                              src={cardPhotoUrl}
                              alt={`${m.full_name || 'Manager'} profile`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={() => markPhotoLoadFailed(cardPhotoUrl)}
                            />
                          ) : mgrInitials(m.full_name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>{m.full_name}</span>
                            <span style={{
                              padding: '2px 7px', fontSize: 11, fontWeight: 600, borderRadius: 4,
                              background: isActive ? '#d1fae5' : '#fee2e2',
                              color: isActive ? '#065f46' : '#991b1b'
                            }}>{isActive ? '✓ Active' : 'Inactive'}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>ID: {String(m.id || '').slice(0, 12).toUpperCase()}…</div>
                        </div>
                      </div>

                      {/* Info rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15 }}>📧</span><span style={{ wordBreak: 'break-all' }}>{m.email}</span>
                        </div>
                        {m.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15 }}>📱</span><span>{m.phone}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15 }}>📅</span><span>Created {mgrDate(m.created_at)}</span>
                        </div>
                      </div>

                      {/* Assigned sections */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned Sections</div>
                        {assignedSections.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {assignedSections.map((key) => (
                              <span key={key} style={{
                                padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                                color: '#4f46e5', background: '#eef2ff', border: '1px solid #c7d2fe'
                              }}>
                                {sectionLabelsByKey[key] || key}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>No sections assigned</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button onClick={() => openManagerProfile(m)} style={{ padding: '8px 10px', background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          View Profile
                        </button>
                        <button onClick={() => openRoleEditor(m)} style={{ padding: '8px 10px', background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          Edit Role
                        </button>
                        <button onClick={() => handleToggleActive(m)} style={{ padding: '8px 10px', background: isActive ? '#fee2e2' : '#dcfce7', color: isActive ? '#b91c1c' : '#166534', border: `1px solid ${isActive ? '#fecaca' : '#bbf7d0'}`, borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          {isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => handleDeleteManager(m.id)} style={{ padding: '8px 10px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Role editor panel — appears below cards */}
              {editingManagerId && (() => {
                const editingManager = managers.find((m) => m.id === editingManagerId)
                return (
                  <div style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 12, padding: 16, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#581c87', marginBottom: 12 }}>
                      Edit Assigned Role — {editingManager?.full_name}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                      {sectionList.map((section) => (
                        <label key={section.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: '1px solid #ddd6fe', background: '#fff', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(editingSections[section.key])}
                            onChange={(e) => setEditingSections((prev) => ({ ...prev, [section.key]: e.target.checked }))}
                            disabled={savingRoleUpdate}
                            style={{ accentColor: '#7c3aed' }}
                          />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{section.icon} {section.label}</span>
                        </label>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button type="button" onClick={closeRoleEditor} disabled={savingRoleUpdate} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                      <button type="button" onClick={() => handleSaveManagerRole(editingManagerId)} disabled={savingRoleUpdate} style={{ padding: '7px 14px', borderRadius: 7, border: 0, background: '#7c3aed', color: '#fff', fontWeight: 700, cursor: savingRoleUpdate ? 'not-allowed' : 'pointer', opacity: savingRoleUpdate ? 0.7 : 1 }}>
                        {savingRoleUpdate ? 'Saving…' : 'Save Role'}
                      </button>
                    </div>
                  </div>
                )
              })()}
            </>
          )
        })()}
      </div>

      {/* Manager Profile + Documents Modal */}
      {profileModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
            display: 'grid', placeItems: 'center', padding: '20px 12px', zIndex: 100, overflowY: 'auto'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeManagerProfile() }}
        >
          <div style={{ width: '100%', maxWidth: 1120, margin: '0 auto', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 8px 40px rgba(0,0,0,0.16)', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '22px 22px 18px', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', minWidth: 0, flex: '1 1 520px' }}>
                {(() => {
                  const ini = (n) => String(n || '').trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || 'M'
                  const clr = (n) => { const c = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']; let s = 0; for (let i = 0; i < (n || '').length; i++) s += (n || '').charCodeAt(i); return c[s % c.length] }
                  const photo = toManagerPhotoUrl(profileModal.profile?.profile_photo_url || profileModal.manager?.profile_photo_url)
                  const showPhoto = Boolean(photo && !hasPhotoLoadFailed(photo))
                  return (
                    <div style={{ width: 64, height: 64, borderRadius: 12, flexShrink: 0, overflow: 'hidden', background: showPhoto ? '#e2e8f0' : clr(profileModal.manager.full_name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 22 }}>
                      {showPhoto ? <img src={photo} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => markPhotoLoadFailed(photo)} /> : ini(profileModal.manager.full_name)}
                    </div>
                  )
                })()}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>{profileModal.manager.full_name}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 2, overflowWrap: 'anywhere' }}>{profileModal.manager.email}{profileModal.manager.phone ? ` · ${profileModal.manager.phone}` : ''}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>User ID: {profileModal.manager.id}</div>
                </div>
              </div>
              <button onClick={closeManagerProfile} style={{ flexShrink: 0, padding: '7px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginLeft: 'auto' }}>Close</button>
            </div>

            <div style={{ padding: '0 22px 22px' }}>
              {profileModal.profile && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 18 }}>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6 }}>ACCOUNT STATUS</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: profileModal.manager.is_verified ? '#059669' : '#dc2626' }}>{profileModal.manager.is_verified ? 'Active' : 'Inactive'}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6 }}>VERIFICATION</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: (profileModal.verification_status || '').toLowerCase().includes('verified') ? '#059669' : '#d97706' }}>{profileModal.verification_status || 'Under Review'}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6 }}>PERSONAL EMAIL</div>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#334155', wordBreak: 'break-all' }}>{profileModal.profile.personal_email || '—'}</div>
                    <div style={{ fontSize: 11, marginTop: 3, fontWeight: 600, color: profileModal.profile.personal_email_verified ? '#059669' : '#d97706' }}>{profileModal.profile.personal_email_verified ? '✓ Verified' : 'Not verified'}</div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 13, color: '#475569', marginBottom: 18 }}>
                Review verification documents. Approve valid files or reject with a reason so the manager can re-upload.
              </div>

              {profileModalLoading && <div style={{ color: '#64748b', padding: '12px 0', fontSize: 13 }}>Loading documents…</div>}
              {profileModalError && (
                <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: 10, color: '#991b1b', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{profileModalError}</div>
              )}

              {!profileModalLoading && profileModal.required_documents.length > 0 && (
                <div style={{ border: '1px solid #e9ecef', borderRadius: 12, overflow: 'auto' }}>
                  <div style={{ minWidth: 980, display: 'grid', gridTemplateColumns: '2fr 2fr 1.3fr 1.6fr 2.2fr', padding: '10px 18px', background: '#f8fafc', borderBottom: '1px solid #e9ecef' }}>
                    {['DOCUMENT', 'UPLOADED FILE', 'UPLOAD DATE', 'STATUS', 'REVIEW ACTION'].map((h) => (
                      <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em' }}>{h}</div>
                    ))}
                  </div>
                  {profileModal.required_documents.map((req, idx) => {
                    const doc = profileModal.documents.find((d) => d.document_type === req.document_type)
                    const status = doc?.status || 'Not Uploaded'
                    const isActioning = docActionLoading === req.document_type
                    const isLast = idx === profileModal.required_documents.length - 1
                    const ss = status === 'Approved' ? { color: '#065f46', bg: '#d1fae5', border: '#6ee7b7' }
                      : status === 'Rejected' ? { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' }
                        : { color: '#92400e', bg: '#fef3c7', border: '#fde68a' }
                    const fileUrl = doc?.download_url ? (doc.download_url.startsWith('http') ? doc.download_url : `${API_BASE}${doc.download_url}`) : null
                    const uploadDate = doc?.uploaded_at || doc?.upload_at
                    const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    return (
                      <div key={req.document_type} style={{ borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}>
                        <div style={{ minWidth: 980, display: 'grid', gridTemplateColumns: '2fr 2fr 1.3fr 1.6fr 2.2fr', padding: '16px 18px', alignItems: 'flex-start', background: '#fff' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{req.document_name}</span>
                              {req.optional && (
                                <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb' }}>Optional</span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{req.document_type}</div>
                          </div>
                          <div>
                            {fileUrl ? (
                              <>
                                <a href={fileUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Open file</a>
                                {doc?.file_name && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{doc.file_name}</div>}
                              </>
                            ) : <span style={{ fontSize: 13, color: '#94a3b8' }}>Not uploaded</span>}
                          </div>
                          <div style={{ fontSize: 13, color: '#475569' }}>{uploadDate ? fmtDate(uploadDate) : '—'}</div>
                          <div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 14px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', color: ss.color, background: ss.bg, border: `1px solid ${ss.border}` }}>
                              {status.toUpperCase()}
                            </span>
                            {doc?.reviewed_at && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Reviewed {fmtDate(doc.reviewed_at)}</div>}
                          </div>
                          <div>
                            {!doc ? (
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>Waiting for user upload.</span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                {status !== 'Approved' ? (
                                  <button onClick={() => handleDocStatus(profileModal.manager.id, req.document_type, 'Approved', '')} disabled={isActioning} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #a7f3d0', background: '#f0fdf4', color: '#059669', fontWeight: 700, fontSize: 12, cursor: isActioning ? 'not-allowed' : 'pointer', opacity: isActioning ? 0.6 : 1 }}>{isActioning ? '…' : 'Approve'}</button>
                                ) : (
                                  <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>Approve</span>
                                )}
                                {status !== 'Rejected' && (
                                  <button onClick={() => { setRejectingDocType(req.document_type); setRejectionReason('') }} disabled={isActioning} style={{ padding: '5px 12px', borderRadius: 6, border: 0, background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 12, cursor: isActioning ? 'not-allowed' : 'pointer', opacity: isActioning ? 0.6 : 1 }}>Reject</button>
                                )}
                                {rejectingDocType === req.document_type && (
                                  <input type="text" placeholder="Rejection reason (required for reject)" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} style={{ marginTop: 6, width: '100%', padding: '6px 10px', borderRadius: 6, border: '1.5px solid #fca5a5', fontSize: 12, boxSizing: 'border-box' }} />
                                )}
                              </div>
                            )}
                            {doc?.rejection_reason && <div style={{ marginTop: 5, fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>Reason: {doc.rejection_reason}</div>}
                          </div>
                        </div>
                        {rejectingDocType === req.document_type && (
                          <div style={{ padding: '8px 18px 12px', background: '#fef9f9', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button onClick={() => handleDocStatus(profileModal.manager.id, req.document_type, 'Rejected', rejectionReason)} disabled={!rejectionReason.trim() || isActioning} style={{ padding: '6px 16px', borderRadius: 7, border: 0, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 12, cursor: (!rejectionReason.trim() || isActioning) ? 'not-allowed' : 'pointer', opacity: (!rejectionReason.trim() || isActioning) ? 0.6 : 1 }}>Confirm Reject</button>
                            <button onClick={() => { setRejectingDocType(''); setRejectionReason('') }} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {!profileModalLoading && !profileModalError && profileModal.required_documents.length === 0 && (
                <div style={{ color: '#64748b', fontSize: 13 }}>No document requirements configured for this manager.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Manager Form */}
      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', padding: 40, border: '1px solid #e5e7eb' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '3px solid', borderImage: 'linear-gradient(135deg, #C026D3 0%, #EC4899 100%) 1' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700, color: '#0f172a' }}>Create Manager Account</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Assign roles and permissions for a new management team member.</p>
        </div>

        {/* Personal Information Section */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 20 }}>👤</div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Personal Information</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Full Name</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ position: 'absolute', left: 12, fontSize: 14 }}>👤</span>
                <input
                  type="text"
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  placeholder="e.g., Rajesh Kumar"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    fontSize: 14,
                    color: '#0f172a',
                    background: '#f8fafc'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Email Address</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ position: 'absolute', left: 12, fontSize: 14 }}>✉️</span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="manager@ashirwad.com"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    fontSize: 14,
                    color: '#0f172a',
                    background: '#f8fafc'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Phone Number</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ position: 'absolute', left: 12, fontSize: 14 }}>📞</span>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    fontSize: 14,
                    color: '#0f172a',
                    background: '#f8fafc'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ position: 'absolute', left: 12, fontSize: 14 }}>🔐</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 44px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    fontSize: 14,
                    color: '#0f172a',
                    background: '#f8fafc'
                  }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, cursor: 'pointer', color: '#64748b', fontSize: 16 }}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Access Section */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 20 }}>🔑</div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Dashboard Access</h3>
            {selectedSections > 0 && (
              <span style={{ padding: '3px 10px', borderRadius: 999, background: '#eef2ff', color: '#4f46e5', fontSize: 12, fontWeight: 700 }}>{selectedSections} section{selectedSections !== 1 ? 's' : ''} selected</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {sectionList.map((section) => (
              <label key={section.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `2px solid ${form.sections[section.key] ? '#c7d2fe' : '#e5e7eb'}`, background: form.sections[section.key] ? '#eef2ff' : '#fff', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name={`section_${section.key}`}
                  checked={Boolean(form.sections[section.key])}
                  onChange={handleChange}
                  style={{ accentColor: '#4f46e5' }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{section.icon} {section.label}</span>
              </label>
            ))}
          </div>
        </div>

        {message && (
          <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontWeight: 600, fontSize: 13, background: message.includes('✓') ? '#d1fae5' : '#fee2e2', color: message.includes('✓') ? '#065f46' : '#991b1b', border: `1px solid ${message.includes('✓') ? '#a7f3d0' : '#fca5a5'}` }}>{message}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            type="button"
            onClick={() => { setForm({ full_name: '', email: '', phone: '', password: '', sections: { orders: false, products: false, offers: false, users: false, coupons: false, slabs: false, 'transactions-revenue': false, 'transactions-settlement': false, 'transactions-warehouse-settlement': false, notifications: false, delivery: false } }); setMessage(''); setShowPassword(false) }}
            disabled={submitting}
            style={{
              padding: '12px 24px',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              background: '#fff',
              color: '#334155',
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !form.full_name.trim() || !form.email.trim() || !form.password.trim()}
            style={{
              padding: '12px 28px',
              background: 'linear-gradient(135deg, #C026D3 0%, #EC4899 100%)',
              border: 0,
              borderRadius: 10,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting || !form.full_name.trim() || !form.email.trim() || !form.password.trim() ? 'not-allowed' : 'pointer',
              opacity: submitting || !form.full_name.trim() || !form.email.trim() || !form.password.trim() ? 0.6 : 1,
              boxShadow: '0 4px 12px rgba(192,38,211,0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            {submitting ? 'Creating Manager...' : 'Create Manager'}
            {!submitting && ' →'}
          </button>
        </div>
      </form>
    </motion.div>
  )
}
// Only use the imported ManagersTab from './ManagersTab'

// Stats Card for Dashboard
function StatsCard({ icon, label, value, badge, badgeColor, iconBg, onClick }) {
  const isClickable = typeof onClick === 'function'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={isClickable ? { y: -2 } : undefined}
      whileTap={isClickable ? { scale: 0.99 } : undefined}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      } : undefined}
      style={{
        background: 'rgba(255, 252, 246, 0.95)',
        borderRadius: 20,
        padding: '16px 16px 14px',
        border: '1px solid #ecdcc4',
        boxShadow: '0 8px 20px rgba(157, 111, 58, 0.08)',
        position: 'relative',
        minHeight: 150,
        cursor: isClickable ? 'pointer' : 'default'
      }}
    >
      {badge && (
        <div style={{
          position: 'absolute',
          top: 12,
          right: 12,
          padding: '3px 8px',
          borderRadius: 999,
          background: badgeColor + '15',
          color: badgeColor,
          border: `1px solid ${badgeColor}55`,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.5px'
        }}>
          {badge}
        </div>
      )}
      <div style={{
        width: 38,
        height: 38,
        borderRadius: 11,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 17,
        marginBottom: 14,
        boxShadow: '0 8px 16px rgba(113, 70, 30, 0.18)'
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 700, color: '#4a2511', marginBottom: 8, fontFamily: '"Georgia", "Times New Roman", serif' }}>{value}</div>
      <div style={{ fontSize: 13, color: '#bf8250', fontWeight: 600 }}>{label}</div>
    </motion.div>
  )
}

function StatPill({ label, value, loading, accent }) {
  const colors = {
    default: { bg: 'rgba(255,255,255,0.92)', color: 'var(--brand-navy)' },
    warning: { bg: 'rgba(255, 211, 144, 0.38)', color: 'var(--brand-saffron)' }
  }
  const palette = colors[accent || 'default']
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ padding: '14px 16px', borderRadius: 14, background: palette.bg, color: palette.color, border: '1px solid var(--brand-yellow, #ffb400)', boxShadow: '0 4px 18px rgba(10,29,83,0.07)' }}
    >
      <div style={{ fontSize: 13, opacity: 0.92, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{loading ? '…' : value}</div>
    </motion.div>
  )
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 18px',
        background: active ? '#0b5fff' : 'transparent',
        color: active ? '#fff' : '#555',
        border: 0,
        borderRadius: '10px 10px 0 0',
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: active ? 'var(--shadow-sm)' : 'none'
      }}
    >
      {children}
    </button>
  )
}

function OrdersTab({ filterStatus } = {}) {
  const [orders, setOrders] = useState([])
  const [statusFilter, setStatusFilter] = useState(filterStatus || 'All')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('priority') // default auto sort by priority
  const [shippingFilter, setShippingFilter] = useState('All')
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const { adminKey } = useAdminAuth()
  const autoRefreshIntervalRef = React.useRef(null)
  const [partners, setPartners] = useState([])
  const [assignSelections, setAssignSelections] = useState({})
  const [warehouses, setWarehouses] = useState([])
  const [warehouseSelections, setWarehouseSelections] = useState({})

  useEffect(() => {
    if (!adminKey) return
    fetchOrders()
    fetchPartners()
    fetchWarehouses()
  }, [adminKey])

  // Real-time subscription for orders
  const ordersChannelRef = React.useRef(null)
  useEffect(() => {
    if (!adminKey || !isAutoRefresh) return
    if (ordersChannelRef.current) return

    const channel = supabase
      .channel('admin-orders-tab-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, () => {
        fetchOrders(true)
      })
      .subscribe()

    ordersChannelRef.current = channel

    return () => {
      if (ordersChannelRef.current) {
        ordersChannelRef.current.unsubscribe()
        ordersChannelRef.current = null
      }
    }
  }, [adminKey, isAutoRefresh])

  // Fallback polling for OrdersTab
  useEffect(() => {
    if (!adminKey || !isAutoRefresh) return

    const interval = setInterval(() => {
      fetchOrders(true)
    }, 8000)

    return () => {
      clearInterval(interval)
    }
  }, [adminKey, isAutoRefresh])

  // Scroll to and highlight new order when redirected from popups
  useEffect(() => {
    if (orders.length === 0) return
    const highlightId = localStorage.getItem('highlightOrderId')
    if (highlightId) {
      setTimeout(() => {
        const element = document.getElementById(`order-card-${highlightId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })

          element.style.transition = 'all 0.5s ease'
          element.style.borderColor = '#3b82f6'
          element.style.boxShadow = '0 0 16px rgba(59, 130, 246, 0.4)'
          element.style.background = '#f0f7ff'

          setTimeout(() => {
            element.style.borderColor = '#cbd5e1'
            element.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.03)'
            element.style.background = '#fff'
            localStorage.removeItem('highlightOrderId')
          }, 3000)
        }
      }, 300)
    }
  }, [orders])

  useEffect(() => {
    if (filterStatus) {
      setStatusFilter(filterStatus)
    }
  }, [filterStatus])

  async function fetchOrders(silent = false) {
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders`, { headers: { 'x-admin-api-key': adminKey } })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch orders')
      }
      const data = await res.json()
      const normalized = Array.isArray(data) ? data : []
      setOrders(normalized)
      setAssignSelections((prev) => {
        const next = { ...prev }
        normalized.forEach((order) => {
          if (order.delivery_partner_id) {
            delete next[order.id]
          }
        })
        return next
      })
    } catch (err) {
      if (!silent) {
        setError(err.message)
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  async function handleApprove(orderId) {
    try {
      const selectedWarehouseId = warehouseSelections[orderId] || null
      const requestOptions = {
        method: 'PATCH',
        headers: { 'x-admin-api-key': adminKey }
      }

      if (selectedWarehouseId) {
        requestOptions.headers = {
          ...requestOptions.headers,
          'Content-Type': 'application/json'
        }
        requestOptions.body = JSON.stringify({ pickup_warehouse_id: selectedWarehouseId })
      }

      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/approve`, requestOptions)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to approve order')
      }
      await fetchOrders()
    } catch (err) {
      alert(err.message || 'Failed to approve order')
    }
  }

  async function handleCancel(orderId) {
    if (!window.confirm('Are you sure? This will restore stock and cancel the order.')) return
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: { 'x-admin-api-key': adminKey }
      })
      if (!res.ok) throw new Error('Failed to cancel order')
      await fetchOrders()
    } catch (err) {
      alert(err.message)
    }
  }

  async function fetchPartners() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/delivery-partners`, { headers: { 'x-admin-api-key': adminKey } })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch partners')
      }
      const data = await res.json()
      setPartners(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load partners', err)
    }
  }

  async function fetchWarehouses() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/warehouses`, { headers: { 'x-admin-api-key': adminKey } })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch warehouses')
      }
      const data = await res.json()
      setWarehouses(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load warehouses', err)
      setWarehouses([])
    }
  }

  async function handleAssign(orderId) {
    const selected = assignSelections[orderId]
    if (!selected) {
      alert('Please select a delivery partner to assign')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
        body: JSON.stringify({ delivery_partner_id: selected })
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to assign delivery partner')
      }

      await fetchOrders()
      await fetchPartners()
      alert('Order assigned to delivery partner')
    } catch (err) {
      alert(err.message || 'Assign failed')
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', fontSize: 15, fontWeight: 600 }}>Loading orders registry…</div>
  if (error) return <div style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fee2e2', padding: '20px', borderRadius: '14px', fontWeight: 600 }}>Error: {error}</div>

  // Filter computations
  const getOrdersCount = (filter) => {
    if (filter === 'Today Total Orders') {
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      const todayStr = `${yyyy}-${mm}-${dd}`
      return orders.filter(o => o.created_at && o.created_at.startsWith(todayStr)).length
    }
    if (filter === 'All') return orders.length
    return orders.filter(o => o.status === filter).length
  }

  const filteredByStatus = orders.filter(order => {
    if (statusFilter === 'Today Total Orders') {
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      const todayStr = `${yyyy}-${mm}-${dd}`
      return order.created_at && order.created_at.startsWith(todayStr)
    }
    return statusFilter === 'All' ? true : order.status === statusFilter
  })

  // Apply Search query & Shipping method filters
  const filteredOrders = filteredByStatus.filter(order => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const orderId = String(order.id || '').toLowerCase()
      const custName = String(order.users?.full_name || '').toLowerCase()
      const custEmail = String(order.users?.email || '').toLowerCase()
      if (!orderId.includes(q) && !custName.includes(q) && !custEmail.includes(q)) {
        return false
      }
    }
    // Shipping type filter
    const isPickup = Boolean(order.pickup_order) || order.shipping_method === 'pickup_drive'
    const isExpress = order.shipping_method === 'express' || (!isPickup && Number(order.shipping_fee || 0) > 0)
    const isStandard = !isExpress && !isPickup

    if (shippingFilter === 'Warehouse' && !isPickup) return false
    if (shippingFilter === 'Express' && !isExpress) return false
    if (shippingFilter === 'Standard' && !isStandard) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'priority') {
      const getPriorityScore = (order) => {
        const isPickup = Boolean(order.pickup_order) || order.shipping_method === 'pickup_drive'
        const isExpress = order.shipping_method === 'express' || (!isPickup && Number(order.shipping_fee || 0) > 0)
        const isPending = order.status === 'Pending'

        if (isExpress) {
          return isPending ? 1 : 2
        }
        if (isPickup) {
          return isPending ? 3 : 4
        }
        // Standard Delivery
        return isPending ? 5 : 6
      }

      const scoreA = getPriorityScore(a)
      const scoreB = getPriorityScore(b)

      if (scoreA !== scoreB) {
        return scoreA - scoreB
      }
      // Secondary sort: date descending (newest first)
      return new Date(b.created_at) - new Date(a.created_at)
    }

    if (sortBy === 'date_desc') {
      return new Date(b.created_at) - new Date(a.created_at)
    }
    if (sortBy === 'date_asc') {
      return new Date(a.created_at) - new Date(b.created_at)
    }
    if (sortBy === 'amount_desc') {
      return Number(b.total_amount || 0) - Number(a.total_amount || 0)
    }
    if (sortBy === 'amount_asc') {
      return Number(a.total_amount || 0) - Number(b.total_amount || 0)
    }
    return 0
  })

  return (
    <div style={{ display: 'grid', gap: 24, color: '#0f172a' }}>
      <style>{`
        @keyframes pulseDot {
          0% { transform: scale(0.9); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.5; }
        }
      `}</style>

      {/* Header section with Auto-refresh toggle */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>Orders Management</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>Approve shipments, allocate warehouses, and assign delivery personnel.</p>
        </div>

        {/* Custom animated switch for auto-refresh */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#fff', padding: '8px 14px', borderRadius: 10, border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={isAutoRefresh}
            onChange={(e) => setIsAutoRefresh(e.target.checked)}
            style={{ display: 'none' }}
          />
          <div style={{
            width: 36,
            height: 20,
            background: isAutoRefresh ? '#10b981' : '#cbd5e1',
            borderRadius: 10,
            padding: 2,
            position: 'relative',
            transition: 'background 0.2s ease',
            display: 'flex',
            alignItems: 'center'
          }}>
            <div style={{
              width: 16,
              height: 16,
              background: '#fff',
              borderRadius: '50%',
              transform: isAutoRefresh ? 'translateX(16px)' : 'translateX(0)',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isAutoRefresh && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulseDot 1.5s infinite' }} />}
            Auto Sync
          </span>
        </label>
      </div>

      {/* Advanced KPI Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {[
          { label: 'All', title: 'All Orders', icon: '📦', color: '#4f46e5', bg: '#f5f3ff' },
          { label: 'Today Total Orders', title: 'Today\'s Orders', icon: '📅', color: '#2563eb', bg: '#eff6ff' },
          { label: 'Pending', title: 'Pending Approval', icon: '⏳', color: '#b45309', bg: '#fffbeb' },
          { label: 'Approved', title: 'Approved & Active', icon: '🚚', color: '#d97706', bg: '#fffbeb' },
          { label: 'Delivered', title: 'Delivered Shipments', icon: '✅', color: '#16a34a', bg: '#f0fdf4' }
        ].map((item) => {
          const isActive = statusFilter === item.label
          const count = getOrdersCount(item.label)
          return (
            <motion.div
              key={item.label}
              whileHover={{ y: -3, scale: 1.01 }}
              onClick={() => setStatusFilter(item.label)}
              style={{
                background: isActive ? '#fff' : '#fff',
                border: isActive ? `2px solid ${item.color}` : '1px solid #e5e7eb',
                borderRadius: 14,
                padding: '16px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                boxShadow: isActive ? `0 8px 20px -6px ${item.color}30` : '0 4px 6px -1px rgba(0,0,0,0.01)',
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: item.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20
              }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{item.title}</div>
                <div style={{ fontSize: 20, fontWeight: 950, color: isActive ? item.color : '#0f172a', marginTop: 2 }}>{count}</div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Advanced Filter / Search Toolbar */}
      <div style={{ display: 'grid', gap: 10, background: '#fff', padding: '10px 14px', borderRadius: 12, border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(15,23,42,0.01)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: '#94a3b8' }}>🔍</span>
          <input
            placeholder="Search by ID, customer name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, border: 0, outline: 'none', fontSize: 12, color: '#334155' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ border: 0, background: 'none', color: '#ef4444', fontSize: 11, fontWeight: 800, cursor: 'pointer', padding: 2 }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Sub-toolbar: Sort & Shipping Method */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
          {/* Shipping Method segment buttons */}
          <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', background: '#fff', flexWrap: 'wrap' }}>
            {[
              { label: 'All', value: 'All' },
              { label: '⚡ Express', value: 'Express' },
              { label: '🏬 Warehouse', value: 'Warehouse' },
              { label: '📦 Standard', value: 'Standard' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setShippingFilter(opt.value)}
                style={{
                  padding: '4px 8px',
                  border: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: shippingFilter === opt.value ? '#4f46e5' : 'transparent',
                  color: shippingFilter === opt.value ? '#fff' : '#475569',
                  transition: 'background 0.15s, color 0.15s'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort Select dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800 }}>SORT:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontSize: 10,
                fontWeight: 700,
                color: '#334155',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="priority">Priority Sort (Default)</option>
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="amount_desc">Highest Value</option>
              <option value="amount_asc">Lowest Value</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders List Container */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 16 }}>
        {filteredOrders.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 16, border: '2px dashed #cbd5e1' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>No Orders Listed</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>There are no orders that match your current search or filter query.</div>
          </div>
        ) : (
          filteredOrders.map((order, idx) => {
            const statusConfig = statusStyles[order.status] || { bg: '#f1f5f9', color: '#475569' }
            const items = order.items || []

            // Resolve assigned delivery partner
            const assignedPartnerRecord = order.delivery_partner || partners.find((p) => p.id === order.delivery_partner_id || p.delivery_partner_id === order.delivery_partner_id)
            const assignedPartnerLabel = assignedPartnerRecord
              ? `${assignedPartnerRecord.name}${assignedPartnerRecord.delivery_partner_id ? ` (${assignedPartnerRecord.delivery_partner_id})` : ''}`
              : (order.delivery_partner_id ? `Partner ID ${order.delivery_partner_id}` : null)
            const isAssigned = Boolean(order.delivery_partner_id)
            const isPickupOrder = Boolean(order.pickup_order) || order.shipping_method === 'pickup_drive'

            // Pickup details
            const pickupWarehouseLabel = order.pickup_warehouse
              ? `${order.pickup_warehouse.name}${order.pickup_warehouse.address ? ` • ${order.pickup_warehouse.address}` : ''}`
              : null
            const pickupWindowLabel = order.pickup_available_from && order.pickup_available_until
              ? `${new Date(order.pickup_available_from).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} - ${new Date(order.pickup_available_until).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
              : null

            return (
              <motion.div
                key={order.id}
                id={`order-card-${order.id}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
                whileHover={{ y: -2 }}
                style={{
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 16,
                  padding: 20,
                  boxShadow: '0 6px 16px rgba(15, 23, 42, 0.02)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16
                }}
              >
                {/* Left side accent indicator */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: 5,
                  background: statusConfig.color
                }} />

                {/* Top Header info */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace', color: '#1e293b' }}>
                      #${order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: statusConfig.bg,
                      color: statusConfig.color,
                      fontWeight: 800,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px'
                    }}>
                      {order.status}
                    </span>
                    {(() => {
                      const isPickup = Boolean(order.pickup_order) || order.shipping_method === 'pickup_drive'
                      const isExpress = order.shipping_method === 'express' || (!isPickup && Number(order.shipping_fee || 0) > 0)

                      if (isExpress) {
                        return (
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                            fontWeight: 800,
                            fontSize: 11
                          }}>
                            ⚡ Express Delivery
                          </span>
                        )
                      }
                      if (isPickup) {
                        return (
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            fontWeight: 800,
                            fontSize: 11
                          }}>
                            🏬 Warehouse Delivery
                          </span>
                        )
                      }
                      return (
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #bbf7d0',
                          fontWeight: 800,
                          fontSize: 11
                        }}>
                          📦 Standard Delivery
                        </span>
                      )
                    })()}
                  </div>

                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📅</span>
                    {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* Grid Split Content */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                  {/* Left Column: Customer & Items */}
                  <div style={{ display: 'grid', gap: 16 }}>
                    {/* Customer Profiler Card */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', padding: '12px 16px', borderRadius: 12 }}>
                      {order.users?.profile_photo_url ? (
                        <img
                          src={order.users.profile_photo_url}
                          alt="profile"
                          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>
                          {String(order.users?.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{order.users?.full_name || 'Registry Customer'}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{order.users?.email || 'No email attached'}</div>
                      </div>
                    </div>

                    {/* Order Items list */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Line Items</div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                        {items.map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i === items.length - 1 ? 0 : '1px solid #e2e8f0', fontSize: 12 }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <span style={{ fontWeight: 800, color: '#0f172a' }}>{item.quantity || 1}x</span>
                              <span style={{ color: '#334155', fontWeight: 600 }}>{item.name || item.product_name || `Product ID ${item.product_id}`}</span>
                            </div>
                            <span style={{ color: '#64748b', fontWeight: 700 }}>
                              {item.price ? `₹${parseFloat(item.price).toFixed(2)}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Invoice Detailed Breakdown Toggle */}
                    <div>
                      <button
                        onClick={() => setExpandedInvoiceId(expandedInvoiceId === order.id ? null : order.id)}
                        style={{
                          background: 'none',
                          border: 0,
                          color: '#4f46e5',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          padding: '4px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          outline: 'none'
                        }}
                      >
                        {expandedInvoiceId === order.id ? 'Hide Price Breakdown ▲' : 'Show Price Breakdown (Subtotal, GST, Discounts) ▼'}
                      </button>

                      {expandedInvoiceId === order.id && (
                        <div
                          style={{
                            marginTop: 10,
                            background: '#f8fafc',
                            border: '1px dashed #cbd5e1',
                            borderRadius: 12,
                            padding: '12px 14px',
                            display: 'grid',
                            gap: 6,
                            fontSize: 12
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                            <span>Subtotal:</span>
                            <span style={{ fontWeight: 600 }}>₹{Number(order.subtotal || 0).toFixed(2)}</span>
                          </div>
                          {Number(order.Slab_discount || 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d' }}>
                              <span>Slab Discount:</span>
                              <span style={{ fontWeight: 700 }}>-₹{Number(order.Slab_discount).toFixed(2)}</span>
                            </div>
                          )}
                          {Number(order.coupon_discount || 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d' }}>
                              <span>Coupon Discount {order.coupon_code ? `(${order.coupon_code})` : ''}:</span>
                              <span style={{ fontWeight: 700 }}>-₹{Number(order.coupon_discount).toFixed(2)}</span>
                            </div>
                          )}
                          {Number(order.gst_amount || 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                              <span>GST / Taxes:</span>
                              <span style={{ fontWeight: 600 }}>₹{Number(order.gst_amount).toFixed(2)}</span>
                            </div>
                          )}
                          {Number(order.shipping_fee || 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                              <span>Shipping Fee:</span>
                              <span style={{ fontWeight: 600 }}>₹{Number(order.shipping_fee).toFixed(2)}</span>
                            </div>
                          )}
                          <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 6, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#0f172a' }}>
                            <span>Final Total:</span>
                            <span>₹{Number(order.total_amount || 0).toFixed(2)}</span>
                          </div>
                          {order.payment_method && (
                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 6, marginTop: 2, fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.4px' }}>
                              Payment Mode: {order.payment_method.replace('_', ' ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Active allocations info */}
                    {(assignedPartnerLabel || pickupWarehouseLabel) && (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Allocations</div>
                        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                          {assignedPartnerLabel && !isPickupOrder && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', padding: '10px 14px', borderRadius: 10, border: '1px solid #bbf7d0', fontSize: 12 }}>
                              <span>🚴</span>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>Delivery Personnel</div>
                                <div style={{ fontWeight: 700, color: '#14532d', marginTop: 2 }}>{assignedPartnerLabel}</div>
                              </div>
                            </div>
                          )}
                          {isPickupOrder && pickupWarehouseLabel && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fffbeb', padding: '10px 14px', borderRadius: 10, border: '1px solid #fde68a', fontSize: 12 }}>
                              <span>🏬</span>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>Pickup Warehouse</div>
                                <div style={{ fontWeight: 700, color: '#78350f', marginTop: 2 }}>{pickupWarehouseLabel}</div>
                              </div>
                            </div>
                          )}
                          {isPickupOrder && pickupWindowLabel && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fffbeb', padding: '10px 14px', borderRadius: 10, border: '1px solid #fde68a', fontSize: 12 }}>
                              <span>⏱️</span>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>Pickup Window</div>
                                <div style={{ fontWeight: 700, color: '#78350f', marginTop: 2 }}>{pickupWindowLabel}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Pricing Summary & Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
                    {/* Price Block */}
                    <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Order Total</div>
                      <div style={{ fontSize: 22, fontWeight: 950, color: '#0f172a', marginTop: 4 }}>₹{Number(order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>

                    {/* Contextual Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {order.status === 'Pending' && (
                        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                          {isPickupOrder && (
                            <div style={{ display: 'grid', gap: 4 }}>
                              <label style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Warehouse Assignment</label>
                              <select
                                value={warehouseSelections[order.id] || ''}
                                onChange={(e) => setWarehouseSelections({ ...warehouseSelections, [order.id]: e.target.value })}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: '1px solid #cbd5e1',
                                  background: '#fff',
                                  fontSize: 12,
                                  width: '100%',
                                  outline: 'none',
                                  color: '#334155'
                                }}
                              >
                                <option value="">Select pickup warehouse...</option>
                                {warehouses.map((warehouse) => (
                                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              if (isPickupOrder && !warehouseSelections[order.id]) {
                                alert('Please select a pickup warehouse before approving this Pickup & Drive order')
                                return
                              }
                              handleApprove(order.id)
                            }}
                            style={{
                              padding: '10px 14px',
                              background: '#10b981',
                              color: '#fff',
                              borderRadius: 8,
                              fontWeight: 800,
                              border: 0,
                              cursor: 'pointer',
                              fontSize: 12,
                              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.1)',
                              transition: 'transform 0.1s, opacity 0.1s'
                            }}
                          >
                            {isPickupOrder ? 'Approve & Allocate' : 'Approve Order'}
                          </button>

                          <button
                            onClick={() => handleCancel(order.id)}
                            style={{
                              padding: '10px 14px',
                              background: '#fff',
                              color: '#ef4444',
                              borderRadius: 8,
                              fontWeight: 800,
                              border: '1px solid #fee2e2',
                              cursor: 'pointer',
                              fontSize: 12
                            }}
                          >
                            Cancel Order
                          </button>
                        </div>
                      )}

                      {order.status === 'Approved' && (
                        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                          {isPickupOrder ? (
                            <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, textAlign: 'center', background: '#fffbeb', border: '1px solid #fde68a', padding: '6px 10px', borderRadius: 8 }}>
                              Waiting for Warehouse Pickup
                            </div>
                          ) : !order.delivery_partner_id ? (
                            <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
                              <label style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Assign Dispatch Rider</label>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <select
                                  value={assignSelections[order.id] || ''}
                                  onChange={(e) => setAssignSelections({ ...assignSelections, [order.id]: e.target.value })}
                                  style={{
                                    flex: 1,
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    background: '#fff',
                                    fontSize: 12,
                                    color: '#334155'
                                  }}
                                >
                                  <option value="">Rider...</option>
                                  {partners.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.assigned_area || 'no area'})</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAssign(order.id)}
                                  style={{
                                    padding: '8px 12px',
                                    background: '#4f46e5',
                                    color: '#fff',
                                    borderRadius: 8,
                                    border: 0,
                                    fontWeight: 800,
                                    fontSize: 11,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Assign
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: '#15803d', fontWeight: 700, textAlign: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 10px', borderRadius: 8 }}>
                              Assigned to Dispatch
                            </div>
                          )}
                        </div>
                      )}

                      {order.status === 'Cancelled' && (
                        <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, textAlign: 'center', background: '#fef2f2', border: '1px solid #fee2e2', padding: '6px 10px', borderRadius: 8 }}>
                          Order Cancelled
                        </div>
                      )}

                      {order.status === 'Delivered' && (
                        <div style={{ fontSize: 11, color: '#15803d', fontWeight: 700, textAlign: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 10px', borderRadius: 8 }}>
                          Completed ✓
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}


/* Legacy ProductsTab removed in favor of imported ProductsTab */

function OffersTab() {
  const { adminKey } = useAdminAuth()
  const [offers, setOffers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ title: '', message: '', discountType: 'flat', discountValue: '', minimumAmount: '', productId: '', startAt: '', endAt: '', active: true })

  useEffect(() => {
    if (!adminKey) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey])

  const toInputValue = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const offsetMs = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
  }

  const resetForm = () => {
    setForm({ title: '', message: '', discountType: 'flat', discountValue: '', minimumAmount: '', productId: '', startAt: '', endAt: '', active: true })
    setEditingId(null)
  }

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const headers = { 'x-admin-api-key': adminKey }
      const [offerList, productsRes] = await Promise.all([
        fetchAdminOffers(adminKey),
        fetch(`${API_BASE}/api/admin/products`, { headers })
      ])

      const productsBody = await productsRes.json().catch(() => ({}))
      if (!productsRes.ok) throw new Error(productsBody.error || 'Failed to load products')

      setOffers(Array.isArray(offerList) ? offerList : [])
      setProducts(Array.isArray(productsBody) ? productsBody : [])
    } catch (err) {
      console.error('Failed to load offers data', err)
      setError(err.message || 'Failed to load offers')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.message.trim()) {
      setStatus({ type: 'error', text: 'Title and message are required.' })
      return
    }

    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      discountType: form.discountType,
      discountValue: form.discountValue ? Number(form.discountValue) : 0,
      minimumAmount: form.minimumAmount ? Number(form.minimumAmount) : 0,
      active: Boolean(form.active)
    }

    if (form.productId) payload.productId = form.productId
    if (form.startAt) payload.startAt = new Date(form.startAt).toISOString()
    if (form.endAt) payload.endAt = new Date(form.endAt).toISOString()

    if (payload.startAt && payload.endAt && new Date(payload.endAt) <= new Date(payload.startAt)) {
      setStatus({ type: 'error', text: 'End time must be after the start time.' })
      return
    }

    if (!Number.isFinite(payload.discountValue) || payload.discountValue <= 0) {
      setStatus({ type: 'error', text: 'Discount value must be greater than zero.' })
      return
    }

    setSubmitting(true)
    setStatus(null)

    try {
      if (editingId) {
        await updateAdminOffer(adminKey, editingId, payload)
      } else {
        await createAdminOffer(adminKey, payload)
      }

      setStatus({ type: 'success', text: editingId ? 'Offer updated successfully.' : 'Offer created successfully.' })
      resetForm()
      setShowForm(false)
      await loadData()
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Unable to save offer.' })
    } finally {
      setSubmitting(false)
    }
  }

  function handleEdit(offer) {
    setShowForm(true)
    setEditingId(offer.id)
    setForm({
      title: offer.title || '',
      message: offer.message || '',
      discountType: offer.discountType || 'flat',
      discountValue: offer.discountValue ? String(offer.discountValue) : '',
      minimumAmount: offer.minimumAmount ? String(offer.minimumAmount) : '',
      productId: offer.productId || '',
      startAt: toInputValue(offer.startAt),
      endAt: toInputValue(offer.endAt),
      active: Boolean(offer.active)
    })
  }

  async function handleToggle(offer) {
    setStatus(null)
    try {
      await updateAdminOffer(adminKey, offer.id, { active: !offer.active })
      await loadData()
      setStatus({ type: 'success', text: `Offer ${offer.active ? 'deactivated' : 'activated'} successfully.` })
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Unable to update offer.' })
    }
  }

  async function handleDelete(offerId) {
    if (!window.confirm('Delete this offer?')) return
    setStatus(null)
    try {
      await deleteAdminOffer(adminKey, offerId)
      await loadData()
      setStatus({ type: 'success', text: 'Offer deleted successfully.' })
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Unable to delete offer.' })
    }
  }

  if (loading) return <div>Loading offers…</div>
  if (error) return <div style={{ padding: 20, background: '#fee', border: '1px solid #fcc', borderRadius: 12, color: '#b91c1c', fontWeight: 600 }}>{error}</div>

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 20, color: '#1f2937' }}>Limited-Time Offers</h3>
        <button
          onClick={() => {
            if (showForm && editingId) {
              resetForm()
            }
            setShowForm((prev) => !prev)
          }}
          style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #0b5fff, #0040d6)', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
        >
          {showForm ? 'Close Form' : '+ Create Offer'}
        </button>
      </div>

      {status && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            fontWeight: 600,
            background: status.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: status.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${status.type === 'success' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`
          }}
        >
          {status.text}
        </motion.div>
      )}

      {showForm && (
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'grid',
            gap: 14,
            padding: 24,
            borderRadius: 14,
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>Offer Title*</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Spring Savings on Pepsi"
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
              required
            />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>Message shown to users*</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Grab 20% off on Pepsi 2L bottles till stocks last!"
              rows={3}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>Discount Type*</label>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
              >
                <option value="flat">Flat Amount</option>
                <option value="percent">Percentage</option>
              </select>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>Discount Value*</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                placeholder={form.discountType === 'percent' ? 'e.g. 20 for 20%' : 'e.g. 50 for ₹50 off'}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
                required
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>Minimum Order Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minimumAmount}
                onChange={(e) => setForm({ ...form, minimumAmount: e.target.value })}
                placeholder="0 for no minimum"
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>Attach to product (optional)</label>
            <select
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
            >
              <option value="">General offer (no product)</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} • ₹{Number(product.price || 0).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>Starts at</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>Ends at</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 28 }}>
              <input
                id="offer-active-toggle"
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <label htmlFor="offer-active-toggle" style={{ fontWeight: 600, fontSize: 13, color: '#1f2937' }}>Active immediately</label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #0b5fff, #0040d6)', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.75 : 1 }}
            >
              {submitting ? 'Saving…' : editingId ? 'Update Offer' : 'Create Offer'}
            </button>
            <button
              type="button"
              onClick={() => { resetForm(); setShowForm(false) }}
              style={{ padding: '10px 16px', background: '#e2e8f0', color: '#1f2937', border: 0, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </motion.form>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {offers.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', borderRadius: '12px', border: '2px dashed #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 600 }}>
            No offers configured yet. Create one to highlight promotions on the user dashboard.
          </div>
        ) : (
          offers.map((offer, idx) => {
            const starts = offer.startAt ? new Date(offer.startAt).toLocaleString() : 'Immediate'
            const ends = offer.endAt ? new Date(offer.endAt).toLocaleString() : 'No end date'
            const discountValueNumber = Number(offer.discountValue || 0)
            const minimumAmountNumber = Number(offer.minimumAmount || 0)
            const discountDisplay = discountValueNumber.toLocaleString('en-IN', { maximumFractionDigits: 2 })
            const discountLabel = offer.discountType === 'percent'
              ? `${discountDisplay}% off`
              : `₹${discountDisplay} off`
            const minimumLabel = minimumAmountNumber > 0
              ? `Minimum spend ₹${minimumAmountNumber.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
              : null
            return (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 16,
                  alignItems: 'start',
                  background: '#fff',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  padding: 20,
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: offer.active ? 'linear-gradient(90deg, #4CAF50, #8BC34A)' : '#ddd'
                }} />

                <div style={{ paddingTop: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: '18px', color: '#1f2937' }}>{offer.title}</h4>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: 11,
                      fontWeight: 700,
                      background: offer.active ? '#dcfce7' : '#fee2e2',
                      color: offer.active ? '#166534' : '#991b1b'
                    }}>
                      {offer.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>{offer.message}</div>
                  <div style={{ fontSize: '13px', color: '#1f2937', fontWeight: 600 }}>
                    {discountLabel}{minimumLabel ? ` • ${minimumLabel}` : ''}
                  </div>
                  {offer.productName && (
                    <div style={{ fontSize: '13px', color: '#1f2937', fontWeight: 600 }}>
                      Product: {offer.productName}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    Starts: {starts}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    Ends: {ends}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
                  <button
                    onClick={() => handleEdit(offer)}
                    style={{ padding: '8px 14px', background: '#0ea5e9', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggle(offer)}
                    style={{ padding: '8px 14px', background: offer.active ? '#f97316' : '#22c55e', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    {offer.active ? 'Pause Offer' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(offer.id)}
                    style={{ padding: '8px 14px', background: '#ef4444', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}

function NotificationsTab() {
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
  const { adminKey } = useAdminAuth()

  useEffect(() => {
    if (!adminKey) return
    fetchUsers()
    fetchRecentNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey])

  async function fetchUsers() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, { headers: { 'x-admin-api-key': adminKey } })
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
      const res = await fetch(`${API_BASE}/api/admin/notifications/recent`, {
        headers: { 'x-admin-api-key': adminKey }
      })
      if (res.ok) {
        const data = await res.json()
        setRecentNotifications(Array.isArray(data) ? data.slice(0, 5) : [])
      }
    } catch (err) {
      console.error('Failed to fetch recent notifications:', err)
    }
  }

  async function handleFullDelete(userId) {
    if (!window.confirm('Are you sure you want to permanently delete this user from both Auth and Profile? This cannot be undone.')) return
    setSubmitting(true)
    setStatus(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/full-delete`, {
        method: 'DELETE',
        headers: { 'x-admin-api-key': adminKey }
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

    // Validate audience selection
    if (form.targetAudience === 'specific' && selectedUsers.length === 0) {
      setStatus({ type: 'error', text: 'Please select at least one user for specific targeting.' })
      return
    }

    setSubmitting(true)
    setStatus(null)

    try {
      // Determine target users based on audience type
      let targetUsers = []

      if (form.targetAudience === 'all') {
        targetUsers = users
      } else if (form.targetAudience === 'active') {
        targetUsers = users.filter(u => u.status === 'active' || !u.status)
      } else if (form.targetAudience === 'premium') {
        targetUsers = users.filter(u => u.tier === 'premium' || u.plan === 'premium')
      } else if (form.targetAudience === 'specific') {
        targetUsers = users.filter(u => selectedUsers.includes(u.id))
      }

      const notificationData = {
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.notificationType,
        action_link: form.actionLink.trim() || null,
        visual_theme: form.visualTheme ? 'festive' : null
      }

      // Send to each user
      let successCount = 0
      let failureCount = 0

      for (const user of targetUsers) {
        try {
          await fetch(`${API_BASE}/api/admin/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
            body: JSON.stringify({
              user_id: user.id,
              message: `${form.title}\n\n${form.message}`
            })
          })
          successCount++
        } catch (err) {
          console.error(`Failed to send to user ${user.id}:`, err)
          failureCount++
        }
      }

      // Reset form
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
          text: `✓ Notification sent to ${successCount} user${successCount !== 1 ? 's' : ''}.`
        })
      } else {
        setStatus({
          type: 'error',
          text: `Sent to ${successCount} user${successCount !== 1 ? 's' : ''}, failed for ${failureCount}.`
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

  const getNotificationIcon = (type) => {
    const icons = {
      'announcement': '📢',
      'order': '🚚',
      'system': '⚙️',
      'payment': '💳',
      'inventory': '📦'
    }
    return icons[type] || '📢'
  }

  const getNotificationBadge = (status) => {
    const badges = {
      'SCHEDULED': { bg: '#fef3c7', color: '#92400e', label: 'SCHEDULED' },
      'SENT': { bg: '#d1fae5', color: '#065f46', label: 'SENT' },
      'DRAFT': { bg: '#f1f5f9', color: '#475569', label: 'DRAFT' }
    }
    return badges[status] || badges.SENT
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
      {/* Left Sidebar - Recent Notifications */}
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
                      {notif.created_at ? new Date(notif.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Oct 28'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                    {notif.title || notif.message?.split('\n')[0] || 'System Maintenance'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                    {notif.message?.substring(0, 60) || 'The ordering portal will be undergoing scheduled maintenance...'}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <button
          onClick={() => window.location.reload()}
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

      {/* Main Content - Compose Notification */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Compose Notification</h2>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Create updates, alerts, or announcements for distributors.</p>
          </div>
          <button style={{ background: 'transparent', border: 0, fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}>⚙️</button>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          {/* Notification Type & Target Audience */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

          {/* Advanced Target Audience Selector */}
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
              {/* Audience Type Selection */}
              <div>
                <label style={{ display: 'block', marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  Select Audience Mode
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  <label style={{
                    padding: '10px 12px',
                    border: form.targetAudience === 'all' ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: form.targetAudience === 'all' ? '#eef2ff' : '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: form.targetAudience === 'all' ? 700 : 500,
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <input
                      type="radio"
                      name="audience_mode"
                      value="all"
                      checked={form.targetAudience === 'all'}
                      onChange={(e) => {
                        setForm({ ...form, targetAudience: 'all' })
                        setSelectedUsers([])
                      }}
                      style={{ accentColor: '#4f46e5', cursor: 'pointer' }}
                    />
                    All Users
                  </label>
                  <label style={{
                    padding: '10px 12px',
                    border: form.targetAudience === 'active' ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: form.targetAudience === 'active' ? '#eef2ff' : '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: form.targetAudience === 'active' ? 700 : 500,
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <input
                      type="radio"
                      name="audience_mode"
                      value="active"
                      checked={form.targetAudience === 'active'}
                      onChange={(e) => {
                        setForm({ ...form, targetAudience: 'active' })
                        setSelectedUsers([])
                      }}
                      style={{ accentColor: '#4f46e5', cursor: 'pointer' }}
                    />
                    Active Only
                  </label>
                  <label style={{
                    padding: '10px 12px',
                    border: form.targetAudience === 'premium' ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: form.targetAudience === 'premium' ? '#eef2ff' : '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: form.targetAudience === 'premium' ? 700 : 500,
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <input
                      type="radio"
                      name="audience_mode"
                      value="premium"
                      checked={form.targetAudience === 'premium'}
                      onChange={(e) => {
                        setForm({ ...form, targetAudience: 'premium' })
                        setSelectedUsers([])
                      }}
                      style={{ accentColor: '#4f46e5', cursor: 'pointer' }}
                    />
                    Premium
                  </label>
                  <label style={{
                    padding: '10px 12px',
                    border: form.targetAudience === 'specific' ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: form.targetAudience === 'specific' ? '#eef2ff' : '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: form.targetAudience === 'specific' ? 700 : 500,
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <input
                      type="radio"
                      name="audience_mode"
                      value="specific"
                      checked={form.targetAudience === 'specific'}
                      onChange={() => setForm({ ...form, targetAudience: 'specific' })}
                      style={{ accentColor: '#4f46e5', cursor: 'pointer' }}
                    />
                    Specific Users
                  </label>
                </div>
              </div>

              {/* User List for Specific Selection */}
              {form.targetAudience === 'specific' && (
                <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                      SELECT USERS ({selectedUsers.length} of {users.length})
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedUsers(users.map(u => u.id))}
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
                                setSelectedUsers(selectedUsers.filter(id => id !== user.id))
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

              {/* Quick Summary */}
              <div style={{
                padding: 10,
                background: '#f0f9ff',
                border: '1px solid #bfdbfe',
                borderRadius: 6,
                fontSize: 12,
                color: '#1e40af',
                fontWeight: 500
              }}>
                📊 {form.targetAudience === 'all' ? '✓ All distributors will receive this notification'
                  : form.targetAudience === 'active' ? `✓ Only active users (${users.filter(u => u.status === 'active').length || '0'} users) will receive this`
                    : form.targetAudience === 'premium' ? '✓ Only premium members will receive this notification'
                      : `✓ ${selectedUsers.length} selected user${selectedUsers.length !== 1 ? 's' : ''} will receive this notification`
                }
              </div>
            </motion.div>
          )}

          {/* Notification Title */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Notification Title <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Ashirwad Enterprises: Special Discounts on Bulk Orders"
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

          {/* Message Content */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Message Content
            </label>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              {/* Toolbar */}
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

          {/* Action Button Link */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Action Button Link <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>(Optional)</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <span style={{ padding: '10px 12px', background: '#f8fafc', fontSize: 13, color: '#64748b', borderRight: '1px solid #e5e7eb' }}>https://</span>
              <input
                type="text"
                placeholder="ashirwad.en/offers/navratri-chhath-special"
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

          {/* Visual Accents & Scheduling */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Visual Accents */}
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
                Apply <strong>Ashirwad Enterprises Theme</strong><br />
                Adds branded accent styling to the recipient's notification view.
              </div>
            </div>

            {/* Scheduling */}
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

          {/* Permanently Delete User Section */}
          <div style={{ padding: 20, background: '#fef2f2', border: '2px dashed #fca5a5', borderRadius: 12, marginTop: 12 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
              ⚠️ Permanently Delete User (Full Delete)
            </label>
            <select
              onChange={e => e.target.value && handleFullDelete(e.target.value)}
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
              <option value="">🗑️ Select user to fully delete...</option>
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

          {/* Status Message */}
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
              {status.type === 'success' ? '✓' : '⚠'} {status.text}
            </motion.div>
          )}

          {/* Action Buttons */}
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
              onClick={() => {/* Preview functionality */ }}
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
              ➤ {submitting ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CouponsTab() {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    type: 'percent',
    value: '',
    min_amount: '0',
    active: true,
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  })
  const { adminKey } = useAdminAuth()

  useEffect(() => {
    if (!adminKey) return
    fetchCoupons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey])

  async function fetchCoupons() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/coupons`, {
        headers: { 'x-admin-api-key': adminKey }
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('Failed to fetch coupons:', body)
        throw new Error(body.error || `Failed to fetch coupons (Status: ${res.status})`)
      }
      const data = await res.json()
      setCoupons(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Fetch coupons error:', err)
      const errorMsg = err.message.includes('relation "coupons" does not exist')
        ? 'Coupons table does not exist. Please run the ADD_COUPONS_TABLE.sql script in Supabase SQL Editor.'
        : err.message
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      code: '',
      type: 'percent',
      value: '',
      min_amount: '0',
      active: true,
      valid_from: new Date().toISOString().split('T')[0],
      valid_to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    })
    setEditingCoupon(null)
    setShowForm(false)
  }

  function handleEdit(coupon) {
    setEditingCoupon(coupon)
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value.toString(),
      min_amount: coupon.min_amount.toString(),
      active: coupon.active,
      valid_from: coupon.valid_from ? new Date(coupon.valid_from).toISOString().split('T')[0] : '',
      valid_to: coupon.valid_to ? new Date(coupon.valid_to).toISOString().split('T')[0] : ''
    })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        type: formData.type,
        value: Number(formData.value),
        min_amount: Number(formData.min_amount),
        active: formData.active,
        valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : undefined,
        valid_to: formData.valid_to ? new Date(formData.valid_to).toISOString() : undefined
      }

      let res
      if (editingCoupon) {
        // Update existing coupon
        res = await fetch(`${API_BASE}/api/admin/coupons/${editingCoupon.code}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-api-key': adminKey
          },
          body: JSON.stringify(payload)
        })
      } else {
        // Create new coupon
        payload.code = formData.code.trim().toUpperCase()
        res = await fetch(`${API_BASE}/api/admin/coupons`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-api-key': adminKey
          },
          body: JSON.stringify(payload)
        })
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('Coupon save error:', body)
        throw new Error(body.error || `Failed to save coupon (Status: ${res.status})`)
      }

      await fetchCoupons()
      resetForm()
    } catch (err) {
      console.error('Coupon submission error:', err)
      setError(err.message || 'Failed to save coupon. Check console for details.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(code) {
    if (!confirm(`Delete coupon ${code}?`)) return

    try {
      const res = await fetch(`${API_BASE}/api/admin/coupons/${code}`, {
        method: 'DELETE',
        headers: { 'x-admin-api-key': adminKey }
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to delete coupon')
      }

      await fetchCoupons()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  async function toggleActive(coupon) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/coupons/${coupon.code}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': adminKey
        },
        body: JSON.stringify({ active: !coupon.active })
      })

      if (!res.ok) throw new Error('Failed to update coupon')
      await fetchCoupons()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  if (loading) return <div>Loading coupons…</div>

  return (
    <div>
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
          padding: 16,
          marginBottom: 16,
          background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
          border: 'none',
          borderRadius: 12,
          color: '#fff',
          fontWeight: 600
        }}>
          ⚠️ {error}
        </motion.div>
      )}

      <div style={{ marginBottom: 20 }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '12px 20px',
            background: showForm ? 'linear-gradient(135deg, #dc3545, #c82333)' : 'linear-gradient(135deg, #FF8C00, #FFB347)',
            color: '#fff',
            border: 0,
            borderRadius: 10,
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {showForm ? '✕ Cancel' : '✨ Create New Coupon'}
        </motion.button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <h3 style={{ marginBottom: 4, fontSize: '20px', color: '#1f2937' }}>
            {editingCoupon ? '✏️ Edit Coupon' : '➕ Create New Coupon'}
          </h3>
          <p style={{ margin: '0 0 20px', color: '#666', fontSize: '14px' }}>
            {editingCoupon ? 'Update the coupon details below.' : 'Create a new discount coupon for your customers.'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '700', color: '#333', fontSize: '13px' }}>
                  Coupon Code* (e.g., SAVE20)
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingCoupon}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., SAVE20"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    fontSize: 14,
                    textTransform: 'uppercase',
                    fontWeight: '600',
                    background: editingCoupon ? '#f0f0f0' : '#fff',
                    cursor: editingCoupon ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '700', color: '#333', fontSize: '13px' }}>
                  Discount Type*
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: '500',
                    background: '#fff'
                  }}
                >
                  <option value="percent">📊 Percentage (%)</option>
                  <option value="flat">💰 Flat Amount (₹)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '700', color: '#333', fontSize: '13px' }}>
                  Discount Value* {formData.type === 'percent' ? '(%)' : '(₹)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={formData.type === 'percent' ? 'e.g., 10' : 'e.g., 50'}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    fontSize: 14
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '700', color: '#333', fontSize: '13px' }}>
                  Minimum Order (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.min_amount}
                  onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    fontSize: 14
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '700', color: '#333', fontSize: '13px' }}>
                  Valid From
                </label>
                <input
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    fontSize: 14
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '700', color: '#333', fontSize: '13px' }}>
                  Valid Until
                </label>
                <input
                  type="date"
                  value={formData.valid_to}
                  onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    fontSize: 14
                  }}
                />
              </div>
            </div>

            <div style={{ background: '#f9fafb', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontWeight: '600', color: '#333' }}>✓ Active (users can use this coupon)</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: 'linear-gradient(135deg, #FF8C00, #FFB347)',
                  color: '#fff',
                  border: 0,
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? '💾 Saving…' : editingCoupon ? '💾 Update Coupon' : '✓ Create Coupon'}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={resetForm}
                style={{
                  padding: '12px 20px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 0,
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ✕ Cancel
              </motion.button>
            </div>
          </form>
        </motion.div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {coupons.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
            padding: 60,
            textAlign: 'center',
            color: '#999',
            background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)',
            borderRadius: 12,
            border: '2px dashed #ddd'
          }}>
            🎟️ No coupons yet. Click "Create New Coupon" to get started!
          </motion.div>
        ) : (
          coupons.map((coupon, idx) => {
            const isExpired = new Date(coupon.valid_to) < new Date()
            const isNotStarted = new Date(coupon.valid_from) > new Date()

            return (
              <motion.div
                key={coupon.code}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 16,
                  alignItems: 'start',
                  background: '#fff',
                  border: `2px solid ${coupon.active && !isExpired ? '#FF8C00' : '#e5e7eb'}`,
                  borderRadius: 12,
                  padding: 20,
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: coupon.active && !isExpired ? 'linear-gradient(90deg, #FF8C00, #FFB347)' : '#ddd'
                }} />

                <div style={{ paddingTop: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: '18px', color: '#1f2937' }}>{coupon.code}</h4>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: 11,
                      fontWeight: 700,
                      background: coupon.active ? '#dcfce7' : '#fee2e2',
                      color: coupon.active ? '#166534' : '#991b1b'
                    }}>
                      {coupon.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', color: '#1a202c', marginBottom: 6, fontWeight: '700' }}>
                    {coupon.type === 'percent'
                      ? `${coupon.value}% off`
                      : `₹${coupon.value} off`}
                  </div>

                  {coupon.min_amount > 0 && (
                    <div style={{ color: '#666', fontSize: 13, marginBottom: '8px' }}>
                      📋 Minimum order: ₹{coupon.min_amount}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: '#475569', display: 'flex', gap: '20px' }}>
                    <span>📅 {new Date(coupon.valid_from).toLocaleDateString()}</span>
                    <span>→</span>
                    <span>{new Date(coupon.valid_to).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleActive(coupon)}
                    style={{
                      padding: '8px 12px',
                      background: coupon.active ? '#ffc107' : '#28a745',
                      color: '#fff',
                      border: 0,
                      borderRadius: 8,
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: 12,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {coupon.active ? '⏸️ Deactivate' : '▶️ Activate'}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleEdit(coupon)}
                    style={{
                      padding: '8px 12px',
                      background: '#0ea5e9',
                      color: '#fff',
                      border: 0,
                      borderRadius: 8,
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: 12
                    }}
                  >
                    ✏️ Edit
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(coupon.code)}
                    style={{
                      padding: '8px 12px',
                      background: '#dc3545',
                      color: '#fff',
                      border: 0,
                      borderRadius: 8,
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: 12
                    }}
                  >
                    🗑️ Delete
                  </motion.button>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState(null)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [requiredDocuments, setRequiredDocuments] = useState([
    { document_type: 'aadhaar', document_name: 'Aadhaar Card' },
    { document_type: 'pan', document_name: 'PAN Card' },
    { document_type: 'gst_certificate', document_name: 'GST Certificate' }
  ])
  const [userDocuments, setUserDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentsError, setDocumentsError] = useState('')
  const [rejectionReasons, setRejectionReasons] = useState({})
  const [reviewSubmittingKey, setReviewSubmittingKey] = useState('')
  const [userActionInFlight, setUserActionInFlight] = useState({})
  const itemsPerPage = 6
  const { adminKey } = useAdminAuth()

  useEffect(() => {
    if (!adminKey) return
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey])

  async function fetchUsers() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, { headers: { 'x-admin-api-key': adminKey } })
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

  async function handleVerificationAction(user, shouldVerify) {
    const userId = String(user?.id || '').trim()
    if (!userId) return

    const action = shouldVerify ? 'verify' : 'revoke'
    const actionText = shouldVerify ? 'verify' : 'revoke'
    const userLabel = user?.full_name || user?.email || 'this user'
    const confirmationMessage = shouldVerify
      ? `Verify ${userLabel}?`
      : `Revoke access for ${userLabel}?`

    if (!window.confirm(confirmationMessage)) return

    setUserActionInFlight((prev) => ({ ...prev, [userId]: action }))
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': adminKey
        },
        body: JSON.stringify({ is_verified: Boolean(shouldVerify) })
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || `Failed to ${actionText} user`)
      }

      const updatedUser = Array.isArray(body) ? body[0] : body
      const resolvedIsVerified = typeof updatedUser?.is_verified === 'boolean'
        ? updatedUser.is_verified
        : Boolean(shouldVerify)

      setUsers((prev) => prev.map((item) => (
        item.id === userId
          ? {
            ...item,
            ...(updatedUser && typeof updatedUser === 'object' ? updatedUser : {}),
            is_verified: resolvedIsVerified
          }
          : item
      )))

      setSelectedUser((prev) => (
        prev && prev.id === userId
          ? {
            ...prev,
            ...(updatedUser && typeof updatedUser === 'object' ? updatedUser : {}),
            is_verified: resolvedIsVerified
          }
          : prev
      ))
    } catch (err) {
      alert(err.message || `Unable to ${actionText} user`)
    } finally {
      setUserActionInFlight((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
    }
  }

  async function handleFullDelete(user) {
    const userId = typeof user === 'string' ? user : String(user?.id || '').trim()
    if (!userId) return

    const userLabel = typeof user === 'string'
      ? user
      : (user?.full_name || user?.email || 'this user')

    if (!window.confirm(`Are you sure you want to permanently delete ${userLabel}? This cannot be undone.`)) return

    setUserActionInFlight((prev) => ({ ...prev, [userId]: 'delete' }))
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}/full-delete`, {
        method: 'DELETE',
        headers: { 'x-admin-api-key': adminKey }
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || 'Failed to delete user')
      }

      setUsers((prev) => prev.filter((item) => item.id !== userId))
      if (selectedUser?.id === userId) {
        setProfileModalOpen(false)
        setSelectedUser(null)
      }
    } catch (err) {
      alert(err.message || 'Unable to delete user')
      await fetchUsers().catch(() => { })
    } finally {
      setUserActionInFlight((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
    }
  }

  async function openUserProfile(user) {
    setSelectedUser(user)
    setProfileModalOpen(true)
    setDocumentsError('')
    setRejectionReasons({})
    await fetchUserDocuments(user.id)
  }

  async function fetchUserDocuments(userId) {
    setDocumentsLoading(true)
    setDocumentsError('')
    try {
      const res = await fetchAdminApi(`/api/admin/users/${userId}/verification-documents`, {
        headers: { 'x-admin-api-key': adminKey }
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || 'Failed to load user documents')
      }

      setRequiredDocuments(Array.isArray(body.required_documents) && body.required_documents.length > 0
        ? body.required_documents
        : [
          { document_type: 'aadhaar', document_name: 'Aadhaar Card' },
          { document_type: 'pan', document_name: 'PAN Card' },
          { document_type: 'gst_certificate', document_name: 'GST Certificate' }
        ])
      setUserDocuments(Array.isArray(body.documents) ? body.documents : [])

      if (body.user) {
        setSelectedUser(body.user)
      }
    } catch (err) {
      setDocumentsError(err.message || 'Failed to load user documents')
      setUserDocuments([])
    } finally {
      setDocumentsLoading(false)
    }
  }

  async function handleDocumentReview(documentType, status) {
    if (!selectedUser) return

    const rejectionReason = String(rejectionReasons[documentType] || '').trim()
    if (status === 'Rejected' && !rejectionReason) {
      setDocumentsError('Please add a rejection reason before rejecting a document.')
      return
    }

    const key = `${documentType}:${status}`
    setReviewSubmittingKey(key)
    setDocumentsError('')

    try {
      const res = await fetchAdminApi(`/api/admin/users/${selectedUser.id}/verification-documents/${documentType}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': adminKey
        },
        body: JSON.stringify({
          status,
          rejection_reason: rejectionReason
        })
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || `Failed to ${status.toLowerCase()} document`)
      }

      setUserDocuments(Array.isArray(body.documents) ? body.documents : [])
      if (typeof body.user_is_verified === 'boolean') {
        setUsers((prev) => prev.map((user) => (
          user.id === selectedUser.id
            ? { ...user, is_verified: body.user_is_verified }
            : user
        )))
        setSelectedUser((prev) => prev ? { ...prev, is_verified: body.user_is_verified } : prev)
      }

      if (status === 'Rejected') {
        setRejectionReasons((prev) => ({ ...prev, [documentType]: '' }))
      }
    } catch (err) {
      setDocumentsError(err.message || 'Unable to review document')
    } finally {
      setReviewSubmittingKey('')
    }
  }

  function closeProfileModal() {
    setProfileModalOpen(false)
    setSelectedUser(null)
    setUserDocuments([])
    setDocumentsError('')
    setRejectionReasons({})
    setReviewSubmittingKey('')
  }

  const totalUsers = users.length
  const pendingVerification = users.filter((u) => !u.is_verified).length

  const filteredUsers = users.filter((user) => {
    const fullName = String(user.full_name || '')
    const email = String(user.email || '')
    const id = String(user.id || '')
    const query = searchTerm.toLowerCase()
    const matchesSearch = fullName.toLowerCase().includes(query) ||
      email.toLowerCase().includes(query) ||
      id.toLowerCase().includes(query)

    const matchesFilter = filterStatus === 'All' ||
      (filterStatus === 'Verified' && user.is_verified) ||
      (filterStatus === 'Pending' && !user.is_verified)

    return matchesSearch && matchesFilter
  })

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage))
  const startIdx = (currentPage - 1) * itemsPerPage
  const endIdx = startIdx + itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIdx, endIdx)

  const documentMap = new Map(userDocuments.map((document) => [document.document_type, document]))

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
    const value = String(name || '').trim()
    if (!value) return 'U'
    return value
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getAvatarColor = (name) => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']
    const value = String(name || 'User')
    let sum = 0
    for (let i = 0; i < value.length; i += 1) {
      sum += value.charCodeAt(i)
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
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
            Review user profiles and approve or reject verification documents.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          <StatCard icon="👥" label="Total Users" value={totalUsers} delay={0.1} />
          <StatCard icon="⏳" label="Pending Verification" value={pendingVerification} delay={0.15} />
        </div>

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
                placeholder="Search by name, email or ID..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value)
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
            {['All', 'Verified', 'Pending'].map((status) => (
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
                  cursor: 'pointer'
                }}
              >
                {status}
                {status === 'Pending' && ` ${pendingVerification > 0 ? '⚠' : ''}`}
              </button>
            ))}
          </div>
        </motion.div>

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
          {paginatedUsers.map((user, idx) => {
            const fullName = String(user.full_name || 'User')
            const email = String(user.email || '—')

            return (
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
              >
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      background: user.profile_photo_url ? `url(${user.profile_photo_url}) center/cover no-repeat` : getAvatarColor(fullName),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 18
                    }}
                  >
                    {!user.profile_photo_url ? getInitials(fullName) : null}
                  </div>

                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {fullName}
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
                      ID: {String(user.id || '').slice(0, 12).toUpperCase()}...
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, fontSize: 13, color: '#6b7280' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📧</span>
                    <span>{email}</span>
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

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 8,
                    paddingTop: 12,
                    borderTop: '1px solid #e5e7eb'
                  }}
                >
                  {(() => {
                    const actionInFlight = userActionInFlight[user.id] || ''
                    const anyActionRunning = Boolean(actionInFlight)
                    const isVerified = Boolean(user.is_verified)

                    return (
                      <>
                        <button
                          onClick={() => openUserProfile(user)}
                          disabled={anyActionRunning}
                          style={{
                            padding: '8px 12px',
                            background: '#dbeafe',
                            color: '#1e40af',
                            border: '1px solid #bfdbfe',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: anyActionRunning ? 'not-allowed' : 'pointer',
                            opacity: anyActionRunning ? 0.65 : 1
                          }}
                        >
                          View Profile
                        </button>

                        <button
                          onClick={() => handleVerificationAction(user, true)}
                          disabled={anyActionRunning || isVerified}
                          style={{
                            padding: '8px 12px',
                            background: '#dcfce7',
                            color: '#166534',
                            border: '1px solid #bbf7d0',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: (anyActionRunning || isVerified) ? 'not-allowed' : 'pointer',
                            opacity: (anyActionRunning || isVerified) ? 0.65 : 1
                          }}
                        >
                          {actionInFlight === 'verify' ? 'Verifying...' : 'Verify'}
                        </button>

                        <button
                          onClick={() => handleVerificationAction(user, false)}
                          disabled={anyActionRunning || !isVerified}
                          style={{
                            padding: '8px 12px',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: (anyActionRunning || !isVerified) ? 'not-allowed' : 'pointer',
                            opacity: (anyActionRunning || !isVerified) ? 0.65 : 1
                          }}
                        >
                          {actionInFlight === 'revoke' ? 'Revoking...' : 'Revoke'}
                        </button>

                        <button
                          onClick={() => handleFullDelete(user)}
                          disabled={anyActionRunning}
                          style={{
                            padding: '8px 12px',
                            background: '#f3f4f6',
                            color: '#6b7280',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: anyActionRunning ? 'not-allowed' : 'pointer',
                            opacity: anyActionRunning ? 0.65 : 1
                          }}
                        >
                          {actionInFlight === 'delete' ? 'Deleting...' : 'Delete'}
                        </button>
                      </>
                    )
                  })()}
                </div>
              </motion.div>
            )
          })}
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
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
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

      {profileModalOpen && selectedUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.55)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 60,
            padding: 16
          }}
          onClick={closeProfileModal}
        >
          <div
            style={{
              width: 'min(980px, 96vw)',
              maxHeight: '92vh',
              overflow: 'auto',
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #e5e7eb',
              boxShadow: '0 20px 50px rgba(15,23,42,0.2)',
              padding: 24,
              display: 'grid',
              gap: 18
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 12,
                    background: selectedUser.profile_photo_url
                      ? `url(${selectedUser.profile_photo_url}) center/cover no-repeat`
                      : getAvatarColor(selectedUser.full_name),
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 18
                  }}
                >
                  {!selectedUser.profile_photo_url ? getInitials(selectedUser.full_name) : null}
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>{selectedUser.full_name || 'User'}</h3>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{selectedUser.email || '—'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>User ID: {selectedUser.id}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeProfileModal}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  color: '#1f2937',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>

            <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
              Review Aadhaar, PAN, and GST documents. Approve valid files or reject with a reason so the user can re-upload.
            </div>

            {documentsLoading ? (
              <div style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#f8fafc', color: '#64748b', fontSize: 13 }}>
                Loading user documents...
              </div>
            ) : (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 1fr 1.4fr', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', minWidth: 880 }}>
                  <CellHeader>Document</CellHeader>
                  <CellHeader>Uploaded File</CellHeader>
                  <CellHeader>Upload Date</CellHeader>
                  <CellHeader>Status</CellHeader>
                  <CellHeader>Review Action</CellHeader>
                </div>

                {requiredDocuments.map((requiredDoc) => {
                  const record = documentMap.get(requiredDoc.document_type)
                  const status = record?.status || 'Pending'
                  const docType = requiredDoc.document_type
                  const reasonValue = rejectionReasons[docType] || ''
                  const isApproving = reviewSubmittingKey === `${docType}:Approved`
                  const isRejecting = reviewSubmittingKey === `${docType}:Rejected`
                  const canReview = Boolean(record)

                  const statusStyle = status === 'Approved'
                    ? { bg: '#dcfce7', color: '#166534' }
                    : status === 'Rejected'
                      ? { bg: '#fee2e2', color: '#991b1b' }
                      : { bg: '#fef3c7', color: '#854d0e' }

                  return (
                    <div key={docType} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 1fr 1.4fr', borderBottom: '1px solid #f1f5f9', minWidth: 880 }}>
                      <CellBody>
                        <div style={{ fontWeight: 700, color: '#1f2937' }}>{requiredDoc.document_name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{docType}</div>
                      </CellBody>

                      <CellBody>
                        {record?.download_url ? (
                          <a href={record.download_url} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                            Open file
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>Not uploaded</span>
                        )}
                        {record?.file_name ? (
                          <div style={{ fontSize: 11, color: '#64748b' }}>{record.file_name}</div>
                        ) : null}
                      </CellBody>

                      <CellBody>
                        <span style={{ fontSize: 12, color: '#334155' }}>
                          {record?.uploaded_at ? formatDate(record.uploaded_at) : '—'}
                        </span>
                      </CellBody>

                      <CellBody>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '5px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            textTransform: 'uppercase'
                          }}
                        >
                          {status}
                        </span>
                        {record?.rejection_reason ? (
                          <div style={{ marginTop: 6, fontSize: 11, color: '#b91c1c' }}>
                            Reason: {record.rejection_reason}
                          </div>
                        ) : null}
                      </CellBody>

                      <CellBody>
                        {!canReview ? (
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>Waiting for user upload.</div>
                        ) : (
                          <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => handleDocumentReview(docType, 'Approved')}
                                disabled={status === 'Approved' || isApproving || isRejecting}
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: 8,
                                  border: '1px solid #bbf7d0',
                                  background: status === 'Approved' ? '#f0fdf4' : '#dcfce7',
                                  color: '#166534',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: status === 'Approved' || isApproving || isRejecting ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {isApproving ? 'Approving...' : 'Approve'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDocumentReview(docType, 'Rejected')}
                                disabled={isApproving || isRejecting}
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: 8,
                                  border: '1px solid #fecaca',
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: isApproving || isRejecting ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {isRejecting ? 'Rejecting...' : 'Reject'}
                              </button>
                            </div>

                            <input
                              type="text"
                              value={reasonValue}
                              onChange={(event) => {
                                const value = event.target.value
                                setRejectionReasons((prev) => ({ ...prev, [docType]: value }))
                              }}
                              placeholder="Rejection reason (required for reject)"
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: '1px solid #e5e7eb',
                                fontSize: 12
                              }}
                            />
                          </div>
                        )}
                      </CellBody>
                    </div>
                  )
                })}
              </div>
            )}

            {documentsError ? (
              <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', fontSize: 12 }}>
                {documentsError}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}

function CellHeader({ children }) {
  return (
    <div style={{ padding: '10px 12px', fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </div>
  )
}

function CellBody({ children }) {
  return (
    <div style={{ padding: '10px 12px', display: 'grid', gap: 6, alignContent: 'start' }}>
      {children}
    </div>
  )
}

function TransactionsTab({ initialSubTab = 'revenue' }) {
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab)

  useEffect(() => {
    setActiveSubTab(initialSubTab)
  }, [initialSubTab])

  return (
    <div>
      {/* Sub-tabs for Transactions */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: 0
      }}>
        <button
          onClick={() => setActiveSubTab('revenue')}
          style={{
            padding: '12px 24px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'revenue' ? '3px solid #1d4ed8' : '3px solid transparent',
            color: activeSubTab === 'revenue' ? '#1d4ed8' : '#6b7280',
            fontWeight: activeSubTab === 'revenue' ? 700 : 600,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: -2
          }}
        >
          💰 Transaction and Revenue
        </button>
        <button
          onClick={() => setActiveSubTab('settlement')}
          style={{
            padding: '12px 24px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'settlement' ? '3px solid #1d4ed8' : '3px solid transparent',
            color: activeSubTab === 'settlement' ? '#1d4ed8' : '#6b7280',
            fontWeight: activeSubTab === 'settlement' ? 700 : 600,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: -2
          }}
        >
          🚚 Collection Settlement from Delivery Partner
        </button>
        <button
          onClick={() => setActiveSubTab('warehouse-settlement')}
          style={{
            padding: '12px 24px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'warehouse-settlement' ? '3px solid #0ea5e9' : '3px solid transparent',
            color: activeSubTab === 'warehouse-settlement' ? '#0ea5e9' : '#6b7280',
            fontWeight: activeSubTab === 'warehouse-settlement' ? 700 : 600,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: -2
          }}
        >
          🏬 Collection Settlement from Warehouse
        </button>
      </div>

      {/* Render active sub-tab */}
      {activeSubTab === 'revenue' && <TransactionRevenueTab />}
      {activeSubTab === 'settlement' && <CollectionSettlementTab />}
      {activeSubTab === 'warehouse-settlement' && <WarehouseSettlementTab />}
    </div>
  )
}

function TransactionRevenueTab() {
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState({ totalCount: 0, totalAmount: 0, prepaidCount: 0, prepaidAmount: 0, codCount: 0, codAmount: 0, byStatus: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const todayLocal = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
  const today = todayLocal
  const [filters, setFilters] = useState({ startDate: today, endDate: today, mode: 'all', status: 'all' })
  const [password, setPassword] = useState('')
  const [gateError, setGateError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('date') // 'date' or 'amount'
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const { adminKey } = useAdminAuth()

  useEffect(() => {
    if (!adminKey) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      // Ensure we always have at least today's dates for daily view
      const effectiveStart = filters.startDate || today
      const effectiveEnd = filters.endDate || today
      if (!filters.startDate || !filters.endDate) {
        setFilters((f) => ({ ...f, startDate: effectiveStart, endDate: effectiveEnd }))
      }

      const params = new URLSearchParams()
      params.append('startDate', effectiveStart)
      params.append('endDate', effectiveEnd)
      if (filters.mode && filters.mode !== 'all') params.append('mode', filters.mode)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)

      const headers = { 'x-admin-api-key': adminKey }
      const [txRes, sumRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/transactions?${params.toString()}`, { headers }),
        fetch(`${API_BASE}/api/admin/transactions/summary?${params.toString()}`, { headers })
      ])
      if (!txRes.ok) {
        const body = await txRes.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch transactions')
      }
      if (!sumRes.ok) {
        const body = await sumRes.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch summary')
      }
      const [tx, sum] = await Promise.all([txRes.json(), sumRes.json()])
      setTransactions(Array.isArray(tx) ? tx : [])
      setSummary(sum || {})
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleFilterChange(field, value) {
    setFilters((f) => ({ ...f, [field]: value }))
  }

  function handleApplyFilters() {
    const missingDates = !filters.startDate || !filters.endDate
    if (missingDates) {
      setGateError('Select start and end date to view transactions.')
      return
    }
    setGateError(null)
    setPage(1)
    fetchData()
  }

  async function handleDownloadPdf() {
    try {
      const missingDates = !filters.startDate || !filters.endDate
      if (missingDates) {
        alert('Select start and end date first.')
        return
      }

      const trimmedPassword = String(password || '').trim()
      if (!trimmedPassword) {
        const message = 'Enter the admin password before generating PDF.'
        setGateError(message)
        alert(message)
        return
      }

      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.mode && filters.mode !== 'all') params.append('mode', filters.mode)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      const url = `${API_BASE}/api/admin/transactions/report?${params.toString()}`
      const res = await fetch(url, {
        headers: {
          'x-admin-api-key': adminKey,
          'x-admin-report-password': trimmedPassword
        }
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to generate PDF')
      }

      setGateError(null)
      const blob = await res.blob()
      const link = document.createElement('a')
      const filename = `transactions-${(filters.startDate || new Date().toISOString().slice(0, 10))}.pdf`
      const blobUrl = URL.createObjectURL(blob)
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      setGateError(err.message)
      alert(err.message)
    }
  }

  // Derived filtered, sorted, paginated rows
  const filteredTransactions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const base = Array.isArray(transactions) ? transactions : []
    const filtered = term
      ? base.filter((t) => {
        const fields = [
          String(t.id || ''),
          String(t.order_id || ''),
          String(t.users?.full_name || ''),
          String(t.mode || ''),
          String(t.status || ''),
          String(t.amount || '')
        ].join(' ').toLowerCase()
        return fields.includes(term)
      })
      : base

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'amount') {
        const diff = Number(a.amount || 0) - Number(b.amount || 0)
        return sortDir === 'asc' ? diff : -diff
      }
      // date
      const diff = new Date(a.created_at) - new Date(b.created_at)
      return sortDir === 'asc' ? diff : -diff
    })
    return sorted
  }, [transactions, searchTerm, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedTransactions = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize
    return filteredTransactions.slice(startIdx, startIdx + pageSize)
  }, [filteredTransactions, currentPage])

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

  // Payment split uses mode-wise totals, independent from delivered-only revenue summary.
  const paymentSplitTotal = codDisplayAmount + prepaidDisplayAmount
  const codPercentage = paymentSplitTotal > 0 ? ((codDisplayAmount / paymentSplitTotal) * 100).toFixed(0) : 0
  const prepaidPercentage = paymentSplitTotal > 0 ? ((prepaidDisplayAmount / paymentSplitTotal) * 100).toFixed(0) : 0

  function toggleSort(field) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>Loading transactions…</div>
  if (error) return <div style={{ color: '#d32f2f', background: '#fee', border: '1px solid #fcc', padding: '16px', borderRadius: '8px' }}>{error}</div>

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
          Transactions & Revenue
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Manage financial records and payment statuses.
        </p>
      </motion.div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Total Revenue Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Total Revenue
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>
                ₹{Number(summary.totalAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>+12.3%</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>COD Total</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>₹{Number(codDisplayAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>Prepaid Total</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>₹{Number(prepaidDisplayAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>
            FY 2026 • {summary.totalCount} transactions processed
          </div>
        </motion.div>

        {/* Payment Split Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700, color: '#1f2937' }}>Payment Split</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <span style={{
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                background: '#e0f2fe',
                color: '#0369a1'
              }}>
                {codPercentage}% COD
              </span>
              <span style={{
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                background: '#f8fafc',
                color: '#475569'
              }}>
                {prepaidPercentage}% Prepaid
              </span>
            </div>

            {/* Progress Bars */}
            <div style={{ display: 'flex', gap: 8, height: 8, borderRadius: 4, overflow: 'hidden', background: '#f3f4f6' }}>
              <div
                style={{
                  flex: Number(codPercentage),
                  background: 'linear-gradient(90deg, #3b82f6 0%, #0369a1 100%)',
                  transition: 'flex 0.5s ease'
                }}
              />
              <div
                style={{
                  flex: Number(prepaidPercentage),
                  background: '#9ca3af',
                  transition: 'flex 0.5s ease'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '12px', background: '#f0f9ff', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, marginBottom: 4 }}>Cash on Delivery</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0369a1' }}>₹{Number(codDisplayAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Collected paysalary</div>
            </div>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 4 }}>Prepaid</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>₹{Number(prepaidDisplayAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>UPI / Net Banking</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filter Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1f2937' }}>Filter Records</h3>
          <button
            onClick={() => {
              setFilters({ startDate: today, endDate: today, mode: 'all', status: 'all' })
              setSearchTerm('')
              setPassword('')
              setGateError(null)
            }}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#1d4ed8',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Reset All
          </button>
        </div>

        {gateError && (
          <div style={{
            padding: '12px 16px',
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            color: '#92400e',
            fontWeight: 600
          }}>
            🔒 {gateError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: 13 }}>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'inherit'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: 13 }}>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'inherit'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: 13 }}>Payment Mode</label>
            <select
              value={filters.mode}
              onChange={(e) => handleFilterChange('mode', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'inherit'
              }}
            >
              <option value="all">All Modes</option>
              <option value="prepaid">Prepaid</option>
              <option value="cod">COD (Cash on Delivery)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: 13 }}>Transaction Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'inherit'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Amount Collected">Amount Collected</option>
              <option value="Out for Collection">Out for Collection</option>
              <option value="Assigned to Delivery">Assigned to Delivery</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: 13 }}>Admin Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'inherit'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleDownloadPdf}
            style={{
              padding: '10px 16px',
              background: '#fff',
              color: '#5b21b6',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            📊 PDF
          </button>
          <button
            onClick={handleApplyFilters}
            style={{
              padding: '10px 20px',
              background: '#1d4ed8',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Apply
          </button>
        </div>
      </motion.div>

      {/* Transactions Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#1f2937' }}>
          Recent Transactions
        </h3>

        {paginatedTransactions.length === 0 ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: '#999',
            background: '#f9fafb',
            borderRadius: 12,
            border: '1px solid #e5e7eb'
          }}>
            📭 No transactions found for the selected period.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px' }}>TRANSACTION ID</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px' }}>CUSTOMER</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px' }}>MODE</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px' }}>STATUS</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px' }}>DELIVERY PARTNER</th>
                  <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px' }}>AMOUNT</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px' }}>DATE & TIME</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx, idx) => {
                  const pill = statusStyles[tx.status] || { bg: '#f0f0f0', color: '#444' }
                  const statusColor = {
                    'Amount Collected': { bg: '#ecfdf5', color: '#065f46' },
                    'Out for Collection': { bg: '#fef3c7', color: '#92400e' },
                    'Assigned to Delivery': { bg: '#dbeafe', color: '#1e40af' },
                    'Pending': { bg: '#f3f4f6', color: '#6b7280' }
                  }
                  const config = statusColor[tx.status] || pill

                  return (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 + idx * 0.05 }}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 0', fontWeight: 600, color: '#0b5fff', fontFamily: 'monospace' }}>
                        {String(tx.id).slice(0, 8)}
                      </td>
                      <td style={{ padding: '12px 0', color: '#1f2937' }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{tx.users?.full_name || 'Unknown'}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Retailer ID: #8045</div>
                      </td>
                      <td style={{ padding: '12px 0', color: '#1f2937' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: tx.mode === 'prepaid' ? '#eff6ff' : '#f0fdf4',
                          color: tx.mode === 'prepaid' ? '#1e40af' : '#065f46'
                        }}>
                          {(tx.mode || '').toUpperCase() === 'PREPAID' ? 'Prepaid' : 'COD'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 0' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: config.bg,
                          color: config.color
                        }}>
                          {tx.status === 'Amount Collected' ? '✓ Amount Collected' : tx.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 0', color: '#6b7280' }}>
                        {tx.delivery_partner?.name || 'Not Assigned'}
                      </td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, color: '#1f2937' }}>
                        ₹{Number(tx.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 0', color: '#6b7280', fontSize: 12 }}>
                        {new Date(tx.created_at).toLocaleDateString('en-IN')} {new Date(tx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                Showing 1 to {Math.min(pageSize, paginatedTransactions.length)} of {filteredTransactions.length} results
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 12px',
                    background: currentPage === 1 ? '#f3f4f6' : '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    color: currentPage === 1 ? '#9ca3af' : '#1f2937',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '8px 12px',
                    background: currentPage === totalPages ? '#f3f4f6' : '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    color: currentPage === totalPages ? '#9ca3af' : '#1f2937',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function CollectionSettlementTab() {
  // Dashboard Blocking Management State
  const [blockingConfig, setBlockingConfig] = useState({ blockTime: '17:30', isEnabled: true })
  const [blockingLoading, setBlockingLoading] = useState(true)
  const [blockingError, setBlockingError] = useState(null)
  const [accessKeys, setAccessKeys] = useState([])
  const [selectedPartnerForKey, setSelectedPartnerForKey] = useState('')
  const [generatingKey, setGeneratingKey] = useState(false)
  const [generatedKeyDisplay, setGeneratedKeyDisplay] = useState(null)
  const [blockingTab, setBlockingTab] = useState('config') // 'config' or 'keys'
  const [blockingSuccess, setBlockingSuccess] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [blockingUpdating, setBlockingUpdating] = useState(false)

  // Load settled orders from localStorage immediately
  const [settlements, setSettlements] = useState([])
  const [settledOrders, setSettledOrders] = useState(() => {
    const storedSettledOrders = localStorage.getItem('settledOrders')
    if (storedSettledOrders) {
      try {
        return JSON.parse(storedSettledOrders)
      } catch (err) {
        console.error('Failed to load settled orders from localStorage:', err)
        return []
      }
    }
    return []
  })
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
  const { adminKey } = useAdminAuth()

  // Helper functions for dashboard blocking
  const getTimeUntilBlock = () => {
    const [blockHours, blockMinutes] = blockingConfig.blockTime.split(':')
    const blockDate = new Date(currentTime)
    blockDate.setHours(parseInt(blockHours), parseInt(blockMinutes), 0)

    // If block time has passed today, calculate until tomorrow
    if (blockDate < currentTime) {
      blockDate.setDate(blockDate.getDate() + 1)
    }

    const diff = blockDate - currentTime
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    return { hours, minutes, seconds, totalMs: diff }
  }

  const isCurrentlyBlocked = () => {
    if (!blockingConfig.isEnabled) return false
    const [blockHours, blockMinutes] = blockingConfig.blockTime.split(':')
    const blockDate = new Date(currentTime)
    blockDate.setHours(parseInt(blockHours), parseInt(blockMinutes), 0)
    return currentTime >= blockDate
  }

  const formatTime = (hours, minutes) => {
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`
  }

  const countdownDisplay = getTimeUntilBlock()

  // Save settled orders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('settledOrders', JSON.stringify(settledOrders))
  }, [settledOrders])

  useEffect(() => {
    if (!adminKey) return
    fetchDeliveryPartners()
    fetchSettlements(settledOrders)
    fetchBlockingConfig()
    fetchAccessKeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey])

  // Update current time every second for real-time display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Dashboard Blocking Functions
  async function fetchBlockingConfig() {
    try {
      setBlockingLoading(true)
      const res = await fetch(`${API_BASE}/api/dashboard-blocking/dashboard-blocking`)
      if (!res.ok) throw new Error('Failed to fetch blocking config')
      const data = await res.json()
      const [hours, minutes] = data.blockTime.split(':')
      setBlockingConfig({
        blockTime: `${hours}:${minutes}`,
        isEnabled: data.isEnabled
      })
    } catch (err) {
      console.error(err)
      setBlockingError(err.message)
    } finally {
      setBlockingLoading(false)
    }
  }

  async function fetchAccessKeys() {
    try {
      const headers = { 'x-admin-api-key': adminKey }
      const res = await fetch(`${API_BASE}/api/dashboard-blocking/admin/access-keys`, { headers })
      if (!res.ok) throw new Error('Failed to fetch access keys')
      const data = await res.json()
      setAccessKeys(data.keys || [])
    } catch (err) {
      console.error(err)
    }
  }

  async function handleUpdateBlockTime() {
    try {
      setBlockingUpdating(true)
      setBlockingSuccess(null)
      const [hours, minutes] = blockingConfig.blockTime.split(':')
      const headers = {
        'x-admin-api-key': adminKey,
        'Content-Type': 'application/json'
      }
      const res = await fetch(`${API_BASE}/api/dashboard-blocking/admin/dashboard-blocking`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          blockTime: `${hours}:${minutes}:00`,
          isEnabled: blockingConfig.isEnabled
        })
      })

      const data = await res.json()

      if (!res.ok) {
        // Check for database not initialized error
        if (res.status === 503) {
          throw new Error('Database not initialized. Please run the dashboard blocking migration first. See DASHBOARD_BLOCKING_SETUP.md')
        }
        throw new Error(data.error || data.message || 'Failed to update block time')
      }

      setBlockingSuccess('✅ Configuration updated successfully! Changes will take effect immediately.')
      setTimeout(() => setBlockingSuccess(null), 4000)
      await fetchBlockingConfig()
    } catch (err) {
      setBlockingError('❌ ' + err.message)
      setTimeout(() => setBlockingError(null), 4000)
    } finally {
      setBlockingUpdating(false)
    }
  }

  async function handleGenerateAccessKey() {
    if (!selectedPartnerForKey) {
      alert('❌ Please select a delivery partner')
      return
    }
    try {
      setGeneratingKey(true)
      const headers = {
        'x-admin-api-key': adminKey,
        'Content-Type': 'application/json'
      }
      const res = await fetch(`${API_BASE}/api/dashboard-blocking/admin/generate-access-key`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          partnerId: selectedPartnerForKey,
          expiryHours: 24
        })
      })

      if (!res.ok) {
        const errorData = await res.json()

        // Check if database not initialized
        if (res.status === 503) {
          const setupMsg = 'Database not initialized. Please run the setup:\n\n' +
            '1. Go to pepsico/DASHBOARD_BLOCKING_SETUP.md\n' +
            '2. Copy SQL from pepsico/database/ADD_DASHBOARD_BLOCKING.sql\n' +
            '3. Run in Supabase SQL Editor\n' +
            '4. Restart backend'
          alert('❌ ' + setupMsg)
          throw new Error(setupMsg)
        }

        throw new Error(errorData.error || 'Failed to generate access key')
      }

      const data = await res.json()
      setGeneratedKeyDisplay(data)

      // Auto-copy to clipboard
      try {
        await navigator.clipboard.writeText(data.accessKey)
        console.log('✅ Access key copied to clipboard:', data.accessKey)
      } catch (clipboardError) {
        console.error('Failed to copy to clipboard:', clipboardError)
      }

      setTimeout(() => {
        setGeneratedKeyDisplay(null)
        setSelectedPartnerForKey('')
        fetchAccessKeys()
      }, 5000)
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setGeneratingKey(false)
    }
  }

  async function handleRevokeAccessKey(keyId) {
    if (!confirm('Are you sure you want to revoke this access key?')) return
    try {
      const headers = { 'x-admin-api-key': adminKey }
      const res = await fetch(`${API_BASE}/api/dashboard-blocking/admin/access-keys/${keyId}`, {
        method: 'DELETE',
        headers
      })
      if (!res.ok) throw new Error('Failed to revoke access key')
      await fetchAccessKeys()
      alert('✅ Access key revoked')
    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  async function fetchDeliveryPartners() {
    try {
      const headers = { 'x-admin-api-key': adminKey }
      const res = await fetch(`${API_BASE}/api/admin/delivery-partners`, { headers })
      if (!res.ok) throw new Error('Failed to fetch delivery partners')
      const data = await res.json()
      setDeliveryPartners(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchSettlements(settledOrdersParam = settledOrders) {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (selectedPartner !== 'all') params.append('partnerId', selectedPartner)

      const headers = { 'x-admin-api-key': adminKey }
      const res = await fetch(`${API_BASE}/api/admin/transactions/settlement?${params.toString()}`, { headers })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch settlements')
      }

      const data = await res.json()

      // Filter out already settled orders
      const settledOrderIds = settledOrdersParam.map((s) => s.id)
      const unsettledData = Array.isArray(data) ? data.filter((item) => !settledOrderIds.includes(item.id)) : []
      setSettlements(unsettledData)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchHistory() {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const params = new URLSearchParams()
      if (selectedPartner !== 'all') params.append('partnerId', selectedPartner)
      params.append('limit', '20')
      const headers = { 'x-admin-api-key': adminKey }
      const res = await fetch(`${API_BASE}/api/admin/transactions/settlement/history?${params.toString()}`, { headers })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch history')
      }
      const data = await res.json()
      setHistoryItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setHistoryError(err.message)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    setSelectedIds([])
    setCashReceived('')
  }, [selectedPartner, startDate, endDate])

  // Refetch settlements when settled orders change to keep lists in sync
  useEffect(() => {
    if (adminKey && settledOrders.length > 0) {
      fetchSettlements(settledOrders)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledOrders])

  const isAdminVerified = adminPassword === 'ASHI2005'

  // Calculate totals (excluding settled orders)
  const totalCollected = settlements.reduce((sum, s) => sum + Number(s.amount_collected || 0), 0)
  const totalSettled = settlements.reduce((sum, s) => sum + Number(s.amount_settled || 0), 0)
  const todayKey = new Date().toLocaleDateString('en-CA')

  // Visible settlements for current partner/filter
  const visibleSettlements = selectedPartner === 'all'
    ? settlements
    : settlements.filter((s) => s.delivery_partner_id === selectedPartner)

  // Visible settled collections for current partner
  const visibleSettledOrders = selectedPartner === 'all'
    ? settledOrders
    : settledOrders.filter((s) => s.delivery_partner_id === selectedPartner)

  // Calculate pending remittance (only unsettled)
  const totalAssigned = visibleSettlements.reduce((sum, s) => sum + Number(s.amount_assigned || 0), 0)
  const pendingRemittance = totalAssigned

  // Calculate total settled amount
  const totalSettledAmount = visibleSettledOrders.reduce((sum, s) => sum + Number(s.amount_assigned || 0), 0)

  const todaysCollections = visibleSettlements
    .filter((s) => new Date(s.collection_date || s.created_at).toLocaleDateString('en-CA') === todayKey)
    .reduce((sum, s) => sum + Number(s.amount_collected || 0), 0)

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
  const selectedTotal = selectedItems.reduce((sum, s) => sum + Number(s.amount_assigned || 0), 0)
  const cashReceivedValue = Number(cashReceived || 0)
  const difference = cashReceivedValue - selectedTotal

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => {
        const order = visibleSettlements.find((s) => s.id === id)
        return order && isSettlementUnlockedForOrder(order)
      })
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) {
        return prev
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSettlements, todayKey])

  if (loading) return <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>Loading settlement data…</div>
  if (error) return <div style={{ color: '#d32f2f', background: '#fee', border: '1px solid #fcc', padding: '16px', borderRadius: '8px' }}>{error}</div>

  async function handleCompleteSettlement() {
    if (!isAdminVerified) return
    if (selectedItems.length === 0) return
    if (selectedPartner === 'all') {
      alert('Select a delivery partner to complete settlement.')
      return
    }
    try {
      const payload = {
        delivery_partner_id: selectedPartner,
        delivery_partner_name: deliveryPartners.find((dp) => dp.id === selectedPartner)?.name,
        items: selectedItems.map((s) => ({
          order_id: s.order_id,
          user_name: s.user_name || null,
          amount_assigned: s.amount_assigned || 0,
          amount_collected: s.amount_collected || 0,
          collection_date: s.collection_date || s.created_at
        })),
        total_assigned: selectedTotal,
        total_collected: selectedItems.reduce((sum, s) => sum + Number(s.amount_collected || 0), 0),
        total_settled: selectedTotal,
        cash_received: cashReceivedValue,
        difference,
        note: settlementNote
      }

      const res = await fetch(`${API_BASE}/api/admin/transactions/settlement/complete`, {
        method: 'POST',
        headers: {
          'x-admin-api-key': adminKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to complete settlement')
      }

      alert('✅ Settlement completed successfully!')

      // Move settled items to settled collections with timestamp
      const settledItems = visibleSettlements
        .filter((s) => selectedIds.includes(s.id))
        .map((s) => ({
          ...s,
          settled_at: new Date().toISOString()
        }))
      setSettledOrders((prev) => [...prev, ...settledItems])

      // Remove settled items from unsettled collections
      setSettlements((prev) => prev.filter((s) => !selectedIds.includes(s.id)))

      await fetchHistory()
      setSelectedIds([])
      setCashReceived('')
      setSettlementNote('')
      setAdminPassword('')
      setHistoryOpen(true)
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleReportDiscrepancy() {
    if (!isAdminVerified) return
    if (selectedItems.length === 0) return
    if (selectedPartner === 'all') {
      alert('Select a delivery partner to report discrepancy.')
      return
    }
    if (difference === 0) {
      alert('No discrepancy found. The cash received matches the expected amount.')
      return
    }
    try {
      const discrepancyType = difference > 0 ? 'overage' : 'shortage'
      const payload = {
        delivery_partner_id: selectedPartner,
        delivery_partner_name: deliveryPartners.find((dp) => dp.id === selectedPartner)?.name,
        expected_amount: selectedTotal,
        received_amount: cashReceivedValue,
        discrepancy_amount: Math.abs(difference),
        discrepancy_type: discrepancyType,
        description: settlementNote || `${discrepancyType} of ₹${Math.abs(difference).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        items: selectedItems.map((s) => ({
          order_id: s.order_id,
          user_name: s.user_name || null,
          amount_assigned: s.amount_assigned || 0,
          amount_collected: s.amount_collected || 0,
          collection_date: s.collection_date || s.created_at
        }))
      }

      const res = await fetch(`${API_BASE}/api/admin/transactions/settlement/discrepancy`, {
        method: 'POST',
        headers: {
          'x-admin-api-key': adminKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to report discrepancy')
      }

      alert(`✅ Discrepancy reported successfully! (Report ID: DISC-${Date.now()})`)
      await fetchHistory()
      setSelectedIds([])
      setCashReceived('')
      setSettlementNote('')
      setAdminPassword('')
      setHistoryOpen(true)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Dashboard Blocking Management Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '32px',
          color: '#111827',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          border: '1px solid #e5e7eb'
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '2px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              🔐
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                Delivery Dashboard Access Control
              </h3>
              <p style={{ margin: '0', fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                Manage daily blocking schedule and generate access keys for partners
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '0'
        }}>
          <button
            onClick={() => setBlockingTab('config')}
            style={{
              padding: '12px 16px',
              background: blockingTab === 'config' ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' : 'transparent',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              color: blockingTab === 'config' ? '#fff' : '#6b7280',
              fontWeight: blockingTab === 'config' ? '600' : '500',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (blockingTab !== 'config') {
                e.target.style.background = '#f3f4f6'
                e.target.style.color = '#374151'
              }
            }}
            onMouseLeave={(e) => {
              if (blockingTab !== 'config') {
                e.target.style.background = 'transparent'
                e.target.style.color = '#6b7280'
              }
            }}
          >
            ⚙️ Block Configuration
          </button>
          <button
            onClick={() => setBlockingTab('keys')}
            style={{
              padding: '12px 16px',
              background: blockingTab === 'keys' ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' : 'transparent',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              color: blockingTab === 'keys' ? '#fff' : '#6b7280',
              fontWeight: blockingTab === 'keys' ? '600' : '500',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (blockingTab !== 'keys') {
                e.target.style.background = '#f3f4f6'
                e.target.style.color = '#374151'
              }
            }}
            onMouseLeave={(e) => {
              if (blockingTab !== 'keys') {
                e.target.style.background = 'transparent'
                e.target.style.color = '#6b7280'
              }
            }}
          >
            🔑 Access Keys <span style={{ fontWeight: '700', marginLeft: '4px' }}>({accessKeys.length})</span>
          </button>
        </div>

        {/* Block Configuration Tab */}
        {blockingTab === 'config' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: '20px' }}
          >
            {/* Status Bar */}
            <div style={{
              background: isCurrentlyBlocked()
                ? 'linear-gradient(135deg, #fca5a5 0%, #f87171 100%)'
                : 'linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 100%)',
              padding: '16px 20px',
              borderRadius: '8px',
              marginBottom: '20px',
              color: '#fff',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>{isCurrentlyBlocked() ? '🔒' : '🔓'}</span>
                <div>
                  <div style={{ fontSize: '14px', opacityInheritance: '0.9' }}>Current Status</div>
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>
                    {isCurrentlyBlocked() ? '🔴 DASHBOARD LOCKED' : '🟢 DASHBOARD OPEN'}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Current Time</div>
                <div style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'monospace' }}>
                  {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Main Configuration Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              {/* Time Input Section */}
              <div style={{
                background: '#f9fafb',
                padding: '24px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                transition: 'all 0.2s'
              }}>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  ⏰ Daily Block Time
                </label>
                <p style={{
                  fontSize: '12px',
                  color: '#9ca3af',
                  marginBottom: '12px'
                }}>
                  Set the time when delivery dashboard auto-locks
                </p>
                <input
                  type="time"
                  value={blockingConfig.blockTime}
                  onChange={(e) => setBlockingConfig({ ...blockingConfig, blockTime: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    background: '#fff',
                    color: '#111827',
                    fontSize: '16px',
                    fontWeight: '700',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    fontFamily: 'monospace'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6'
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb'
                    e.target.style.boxShadow = 'none'
                  }}
                />

                {/* Quick Preset Buttons */}
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
                    Quick Presets:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {['17:30', '18:00', '18:30', '19:00', '19:30', '20:00'].map((time) => (
                      <button
                        key={time}
                        onClick={() => setBlockingConfig({ ...blockingConfig, blockTime: time })}
                        style={{
                          padding: '6px 12px',
                          background: blockingConfig.blockTime === time
                            ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)'
                            : '#fff',
                          border: blockingConfig.blockTime === time
                            ? '2px solid #1e40af'
                            : '1px solid #d1d5db',
                          borderRadius: '6px',
                          color: blockingConfig.blockTime === time ? '#fff' : '#374151',
                          fontWeight: '600',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (blockingConfig.blockTime !== time) {
                            e.target.style.background = '#f3f4f6'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (blockingConfig.blockTime !== time) {
                            e.target.style.background = '#fff'
                          }
                        }}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Countdown & Status Section */}
              <div style={{
                background: blockingConfig.isEnabled
                  ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)'
                  : 'linear-gradient(135deg, #fef2f2 0%, #fef2f2 100%)',
                padding: '24px',
                borderRadius: '12px',
                border: blockingConfig.isEnabled ? '2px solid #10b981' : '2px solid #ef4444',
                transition: 'all 0.2s'
              }}>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {blockingConfig.isEnabled ? '🟢 Active Status' : '🔴 Inactive Status'}
                </label>
                <p style={{
                  fontSize: '12px',
                  color: '#9ca3af',
                  marginBottom: '12px'
                }}>
                  {blockingConfig.isEnabled
                    ? 'Dashboard blocking is currently enabled'
                    : 'Dashboard blocking is currently disabled'
                  }
                </p>

                {/* Countdown Timer */}
                {blockingConfig.isEnabled && (
                  <div style={{
                    background: '#fff',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    border: '1px solid #d1d5db'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
                      Time Until Lock
                    </div>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      fontFamily: 'monospace',
                      color: '#3b82f6',
                      textAlign: 'center'
                    }}>
                      {String(countdownDisplay.hours).padStart(2, '0')}:{String(countdownDisplay.minutes).padStart(2, '0')}:{String(countdownDisplay.seconds).padStart(2, '0')}
                    </div>
                  </div>
                )}

                {/* Enable/Disable Toggle */}
                <button
                  onClick={() => setBlockingConfig({ ...blockingConfig, isEnabled: !blockingConfig.isEnabled })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: blockingConfig.isEnabled
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)'
                    e.target.style.boxShadow = '0 10px 20px rgba(0,0,0,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)'
                    e.target.style.boxShadow = 'none'
                  }}
                >
                  {blockingConfig.isEnabled ? '✓ ENABLED' : '✕ DISABLED'}
                </button>
              </div>
            </div>

            {/* Alerts */}
            {blockingSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
                  color: '#065f46',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  border: '1px solid #10b981',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                <span>✅</span>
                {blockingSuccess}
              </motion.div>
            )}

            {blockingError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  background: 'linear-gradient(135deg, #fef2f2 0%, #fef2f2 100%)',
                  color: '#7f1d1d',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  border: '1px solid #ef4444',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                <span>❌</span>
                {blockingError}
              </motion.div>
            )}

            {/* Save Configuration Button */}
            <button
              onClick={handleUpdateBlockTime}
              disabled={blockingUpdating}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: blockingUpdating
                  ? '#d1d5db'
                  : 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: '700',
                cursor: blockingUpdating ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                transition: 'all 0.3s ease',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                if (!blockingUpdating) {
                  e.target.style.transform = 'translateY(-2px)'
                  e.target.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.3)'
                }
              }}
              onMouseLeave={(e) => {
                if (!blockingUpdating) {
                  e.target.style.transform = 'translateY(0)'
                  e.target.style.boxShadow = 'none'
                }
              }}
            >
              {blockingUpdating ? '⏳ Saving...' : '💾 Save Configuration'}
            </button>
          </motion.div>
        )}

        {/* Access Keys Tab */}
        {blockingTab === 'keys' && (
          <div>
            {/* Blocking Status Alert */}
            {!isCurrentlyBlocked() && blockingConfig.isEnabled && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  border: '2px solid #f59e0b',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{ fontSize: 24 }}>⏳</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                    Access Key Generation Locked
                  </div>
                  <div style={{ fontSize: 12, color: '#b45309' }}>
                    Access keys can only be generated after blocking time ({blockingConfig.blockTime}). Current time: {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: 11, color: '#d97706', marginTop: 4, fontWeight: 600 }}>
                    ⏱️ Time until unlock: {String(countdownDisplay.hours).padStart(2, '0')}:{String(countdownDisplay.minutes).padStart(2, '0')}:{String(countdownDisplay.seconds).padStart(2, '0')}
                  </div>
                </div>
              </motion.div>
            )}

            {!blockingConfig.isEnabled && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                  border: '2px solid #ef4444',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{ fontSize: 24 }}>🔓</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#7f1d1d', marginBottom: 4 }}>
                    Dashboard Blocking Disabled
                  </div>
                  <div style={{ fontSize: 12, color: '#991b1b' }}>
                    Access key generation is disabled because blocking is not enabled. Please enable blocking in the configuration tab first.
                  </div>
                </div>
              </motion.div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#374151' }}>Select Delivery Partner</label>
                <select
                  value={selectedPartnerForKey}
                  onChange={(e) => setSelectedPartnerForKey(e.target.value)}
                  disabled={!isCurrentlyBlocked() || !blockingConfig.isEnabled}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    background: (!isCurrentlyBlocked() || !blockingConfig.isEnabled) ? '#f3f4f6' : '#fff',
                    color: (!isCurrentlyBlocked() || !blockingConfig.isEnabled) ? '#9ca3af' : '#111827',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: (!isCurrentlyBlocked() || !blockingConfig.isEnabled) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="">-- Choose Partner --</option>
                  {deliveryPartners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.phone} ({p.phone})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerateAccessKey}
                disabled={!selectedPartnerForKey || generatingKey || !isCurrentlyBlocked() || !blockingConfig.isEnabled}
                style={{
                  padding: '10px 16px',
                  background: selectedPartnerForKey && !generatingKey && isCurrentlyBlocked() && blockingConfig.isEnabled
                    ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)'
                    : '#e5e7eb',
                  border: 'none',
                  borderRadius: 8,
                  color: selectedPartnerForKey && !generatingKey && isCurrentlyBlocked() && blockingConfig.isEnabled ? '#fff' : '#9ca3af',
                  fontWeight: 700,
                  cursor: selectedPartnerForKey && !generatingKey && isCurrentlyBlocked() && blockingConfig.isEnabled ? 'pointer' : 'not-allowed',
                  fontSize: 14,
                  alignSelf: 'flex-end',
                  transition: 'all 0.2s ease',
                  opacity: (!isCurrentlyBlocked() || !blockingConfig.isEnabled) ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (selectedPartnerForKey && !generatingKey && isCurrentlyBlocked() && blockingConfig.isEnabled) {
                    e.target.style.transform = 'translateY(-2px)'
                    e.target.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.3)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedPartnerForKey && !generatingKey && isCurrentlyBlocked() && blockingConfig.isEnabled) {
                    e.target.style.transform = 'translateY(0)'
                    e.target.style.boxShadow = 'none'
                  }
                }}
                title={
                  !blockingConfig.isEnabled
                    ? 'Enable blocking first'
                    : !isCurrentlyBlocked()
                      ? `Available after ${blockingConfig.blockTime}`
                      : 'Generate access key'
                }
              >
                {generatingKey
                  ? '⏳ Generating...'
                  : !isCurrentlyBlocked() || !blockingConfig.isEnabled
                    ? '🔒 Locked'
                    : '🔑 Generate Key'}
              </button>
            </div>

            {generatedKeyDisplay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                  border: '2px solid #10b981',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>✅ Access Key Generated Successfully!</div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#10b981',
                    background: '#fff',
                    padding: '4px 10px',
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    📋 Copied to Clipboard!
                  </div>
                </div>
                <div
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(generatedKeyDisplay.accessKey)
                      alert('✅ Access key copied to clipboard!')
                    } catch (err) {
                      alert('❌ Failed to copy to clipboard')
                    }
                  }}
                  style={{
                    background: '#fff',
                    padding: '14px',
                    borderRadius: 8,
                    fontFamily: 'monospace',
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: '2px',
                    textAlign: 'center',
                    color: '#111827',
                    border: '2px dashed #10b981',
                    marginBottom: 10,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#f0fdf4'
                    e.target.style.transform = 'scale(1.02)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#fff'
                    e.target.style.transform = 'scale(1)'
                  }}
                  title="Click to copy"
                >
                  {generatedKeyDisplay.accessKey}
                </div>
                <div style={{ fontSize: 11, color: '#065f46', fontWeight: 600 }}>
                  🕐 Expires in 24 hours • Partner: {generatedKeyDisplay.partnerName}
                </div>
              </motion.div>
            )}

            {accessKeys.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: 13 }}>
                No active access keys. Generate one above.
              </div>
            ) : (
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#111827' }}>Active Access Keys</div>
                {accessKeys.map(key => (
                  <div
                    key={key.id}
                    style={{
                      background: '#fff',
                      padding: '12px',
                      borderRadius: 8,
                      marginBottom: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 12,
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4, color: '#111827' }}>{key.partnerName}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        <span
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(key.accessKey)
                              alert('✅ Access key copied to clipboard!')
                            } catch (err) {
                              alert('❌ Failed to copy to clipboard')
                            }
                          }}
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#3b82f6',
                            background: '#eff6ff',
                            padding: '2px 6px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#dbeafe'
                            e.target.style.transform = 'scale(1.05)'
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#eff6ff'
                            e.target.style.transform = 'scale(1)'
                          }}
                          title="Click to copy"
                        >
                          {key.accessKey}
                        </span> • Expires: {new Date(key.expiresAt).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(key.accessKey)
                            alert('✅ Access key copied to clipboard!')
                          } catch (err) {
                            alert('❌ Failed to copy to clipboard')
                          }
                        }}
                        style={{
                          padding: '4px 10px',
                          background: '#3b82f6',
                          border: 'none',
                          borderRadius: 4,
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        title="Copy to clipboard"
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={() => handleRevokeAccessKey(key.id)}
                        style={{
                          padding: '4px 10px',
                          background: '#ef4444',
                          border: 'none',
                          borderRadius: 4,
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Existing Collection Settlement Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}
      >
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
            Collection Settlement & Reconciliation
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            Reconcile COD payments from delivery partners.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const nextOpen = !historyOpen
              setHistoryOpen(nextOpen)
              if (nextOpen) fetchHistory()
            }}
            style={{
              padding: '8px 14px',
              border: '1px solid #e5e7eb',
              background: '#fff',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              color: '#374151',
              cursor: 'pointer'
            }}
          >
            History
          </button>
          {settledOrders.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear all settled orders? This cannot be undone.')) {
                  setSettledOrders([])
                  localStorage.removeItem('settledOrders')
                  fetchSettlements([])
                }
              }}
              style={{
                padding: '8px 14px',
                border: '1px solid #fecaca',
                background: '#fef2f2',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                color: '#991b1b',
                cursor: 'pointer'
              }}
            >
              Reset Settled ({settledOrders.length})
            </button>
          )}
        </div>
      </motion.div>

      {historyOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Settlement History</div>
          {historyLoading && <div style={{ color: '#64748b', fontSize: 12 }}>Loading history…</div>}
          {historyError && <div style={{ color: '#b91c1c', fontSize: 12 }}>{historyError}</div>}
          {!historyLoading && !historyError && historyItems.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: 12 }}>No settlement receipts found.</div>
          )}
          {!historyLoading && !historyError && historyItems.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#64748b' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px' }}>Receipt ID</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px' }}>Partner</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px' }}>Pending Remittance</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px' }}>Cash Received</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px' }}>Difference</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 700, color: '#0f172a' }}>{r.id}</td>
                      <td style={{ padding: '10px 6px', color: '#1f2937' }}>{r.delivery_partner_name || 'Unknown'}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700 }}>
                        ₹{Number(r.total_assigned || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        ₹{Number(r.cash_received || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: Number(r.difference || 0) === 0 ? '#16a34a' : '#f59e0b' }}>
                        ₹{Number(r.difference || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>
                        {new Date(r.created_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          padding: 18,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
            Select Delivery Partner
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                fontSize: 13,
                background: '#fff'
              }}
            >
              <option value="all">All Partners</option>
              {deliveryPartners.map((dp) => (
                <option key={dp.id} value={dp.id}>
                  {dp.name} {dp.delivery_partner_id ? `(ID: ${dp.delivery_partner_id})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: '#10b981', fontSize: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#10b981', display: 'inline-block' }} />
            Active Shift
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Pending Remittance</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 6 }}>
            ₹{Number(pendingRemittance).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Total amount to be collected</div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Today's Collections</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>
              ₹{Number(todaysCollections).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: 999 }}>
              {pendingRemittance > 0 ? `${Math.round((todaysCollections / pendingRemittance) * 100)}%` : '0%'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Progress towards target</div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Remaining to Collect</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: pendingRemittance - todaysCollections <= 0 ? '#10b981' : '#f59e0b' }}>
              ₹{Number(Math.max(0, pendingRemittance - todaysCollections)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
            {Math.max(0, pendingRemittance - todaysCollections) === 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: 999 }}>
                ✓ Complete
              </span>
            )}
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
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
            {visibleSettledOrders.length > 0 ? `${visibleSettledOrders.length} batches settled` : 'No batch settled yet'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Total Settled Amount</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', marginTop: 6 }}>
            ₹{Number(totalSettledAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{visibleSettledOrders.length} orders settled</div>
        </div>
      </motion.div>

      {/* Pending Collection Tasks Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          padding: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 20 }}>📋</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
              Pending Collection Tasks
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Orders assigned for collection ({visibleSettlements.length} tasks)
            </div>
          </div>
        </div>

        {visibleSettlements.length === 0 ? (
          <div style={{
            padding: '30px 20px',
            textAlign: 'center',
            color: '#94a3b8',
            background: '#f9fafb',
            borderRadius: 12,
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>✓ All Collections Completed</div>
            <div style={{ fontSize: 12 }}>No pending collection tasks. All assigned orders have been settled.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Order ID</th>
                  <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Retailer</th>
                  <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Assignment Date</th>
                  <th style={{ textAlign: 'right', padding: '10px 6px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Amount Assigned</th>
                  <th style={{ textAlign: 'center', padding: '10px 6px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleSettlements.map((s, idx) => {
                  const isSettled = settledOrders.some(so => so.id === s.id)
                  return (
                    <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: isSettled ? '#f0fdf4' : '#fff' }}>
                      <td style={{ padding: '12px 6px', fontWeight: 700, color: '#0f172a' }}>
                        #ORD-{String(s.order_id || '').slice(0, 6)}
                      </td>
                      <td style={{ padding: '12px 6px', color: '#1f2937' }}>
                        {s.user_name || 'Unknown'}
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                          {s.delivery_partner_id ? `Partner: ${s.delivery_partner_id}` : 'No Partner'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 6px', color: '#64748b' }}>
                        {new Date(s.created_at || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td style={{ padding: '12px 6px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        ₹{Number(s.amount_assigned || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 6px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: isSettled ? '#fff' : '#fff',
                          background: isSettled ? '#10b981' : '#f59e0b',
                          padding: '4px 10px',
                          borderRadius: 12,
                          display: 'inline-block'
                        }}>
                          {isSettled ? '✓ Settled' : '⏳ Pending'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 20 }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setViewSettledTab(false)}
                style={{
                  padding: '6px 12px',
                  background: !viewSettledTab ? '#1d4ed8' : 'transparent',
                  color: !viewSettledTab ? '#fff' : '#64748b',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Unsettled ({visibleSettlements.length})
              </button>
              <button
                onClick={() => setViewSettledTab(true)}
                style={{
                  padding: '6px 12px',
                  background: viewSettledTab ? '#10b981' : 'transparent',
                  color: viewSettledTab ? '#fff' : '#64748b',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Settled ({visibleSettledOrders.length})
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', padding: '4px 8px', borderRadius: 999, border: '1px solid #e5e7eb' }}>
              {viewSettledTab ? `${visibleSettledOrders.length} Settled Orders` : `${visibleSettlements.length} Total Assigned Orders`}
            </div>
          </div>

          {!viewSettledTab && visibleSettlements.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#94a3b8',
              background: '#f9fafb',
              borderRadius: 12,
              border: '1px solid #e5e7eb'
            }}>
              No unsettled collections for the selected filters.
            </div>
          ) : viewSettledTab && visibleSettledOrders.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#94a3b8',
              background: '#f9fafb',
              borderRadius: 12,
              border: '1px solid #e5e7eb'
            }}>
              No settled collections yet. Complete a settlement to see them here.
            </div>
          ) : !viewSettledTab ? (
            // Unsettled Collections Table
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#64748b' }}>
                    <th style={{ textAlign: 'left', padding: '10px 6px' }}>
                      <input
                        type="checkbox"
                        checked={unlockableVisibleSettlements.length > 0 && selectedItems.length === unlockableVisibleSettlements.length}
                        disabled={unlockableVisibleSettlements.length === 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(unlockableVisibleSettlements.map((s) => s.id))
                          } else {
                            setSelectedIds([])
                          }
                        }}
                      />
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Order ID</th>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Retailer Name</th>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Collection Date</th>
                    <th style={{ textAlign: 'right', padding: '10px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Order Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSettlements.map((s, idx) => {
                    const orderAmount = getOrderAmount(s)
                    const collectedAmount = getOrderCollectedAmount(s)
                    const todaysCollectionForOrder = getOrderTodaysCollection(s)
                    const isUnlocked = isSettlementUnlockedForOrder(s)
                    const isChecked = selectedIds.includes(s.id)
                    return (
                      <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 6px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!isUnlocked}
                            onChange={(e) => {
                              if (!isUnlocked) return
                              if (e.target.checked) {
                                setSelectedIds((prev) => [...prev, s.id])
                              } else {
                                setSelectedIds((prev) => prev.filter((id) => id !== s.id))
                              }
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px 6px', fontWeight: 700, color: '#0f172a' }}>
                          #ORD-{String(s.order_id || '').slice(0, 4)}
                        </td>
                        <td style={{ padding: '12px 6px', color: '#1f2937' }}>
                          {s.user_name || 'Unknown User'}
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>Sector 14</div>
                        </td>
                        <td style={{ padding: '12px 6px', color: '#64748b' }}>
                          {new Date(s.collection_date || s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })},{' '}
                          {new Date(s.collection_date || s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '12px 6px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          ₹{Number(orderAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, fontWeight: 600 }}>
                            Collected: ₹{Number(collectedAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: 10, marginTop: 3, color: isUnlocked ? '#16a34a' : '#b45309', fontWeight: 700 }}>
                            {isUnlocked
                              ? '🔓 Settlement Unlocked'
                              : `🔒 Locked (Today: ₹${Number(todaysCollectionForOrder).toLocaleString('en-IN', { maximumFractionDigits: 2 })})`}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            // Settled Collections Table
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#64748b' }}>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Order ID</th>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Retailer Name</th>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Settlement Date</th>
                    <th style={{ textAlign: 'right', padding: '10px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Amount Settled</th>
                    <th style={{ textAlign: 'center', padding: '10px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSettledOrders.map((s, idx) => (
                    <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: '#f9fafb' }}>
                      <td style={{ padding: '12px 6px', fontWeight: 700, color: '#0f172a' }}>
                        #ORD-{String(s.order_id || '').slice(0, 4)}
                      </td>
                      <td style={{ padding: '12px 6px', color: '#1f2937' }}>
                        {s.user_name || 'Unknown User'}
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>Sector 14</div>
                      </td>
                      <td style={{ padding: '12px 6px', color: '#64748b' }}>
                        {new Date(s.settled_at || s.collection_date || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })},{' '}
                        {new Date(s.settled_at || s.collection_date || new Date()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '12px 6px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        ₹{Number(s.amount_assigned || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 6px', textAlign: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#10b981', padding: '4px 8px', borderRadius: 4 }}>
                          ✓ Settled
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {!viewSettledTab && selectedItems.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ fontSize: 24, color: '#dc2626' }}>🔒</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#7f1d1d', marginBottom: 6 }}>Settlement Locked</div>
                <div style={{ fontSize: 13, color: '#991b1b', marginBottom: 8 }}>
                  {unlockableVisibleSettlements.length === 0
                    ? 'No order is currently unlock-ready. Settlement unlocks per order when collected amount or today collection equals that order amount.'
                    : 'Please select at least one unlocked order to proceed with settlement.'}
                </div>
                <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
                  📦 Selected Orders: {selectedItems.length} • 🔓 Unlock-ready Orders: {unlockableVisibleSettlements.length}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {!viewSettledTab && selectedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>✅ Settlement Details</div>
            <div style={{ fontSize: 12, color: '#10b981', marginBottom: 14, fontWeight: 600 }}>Ready to finalize settlement with {selectedItems.length} selected order(s)</div>

            <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#475569' }}>
                <span>Total to Settle ({selectedItems.length} items)</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  ₹{Number(selectedTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Cash Received Amount</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 12 }}>₹</div>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0"
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                />
                <div style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8fafc', fontSize: 11, color: '#64748b' }}>INR</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12 }}>
                <span style={{ color: '#64748b' }}>Difference</span>
                <span style={{ fontWeight: 700, color: difference === 0 ? '#10b981' : '#f59e0b' }}>
                  ₹{Number(difference).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Settlement Note (Optional)</div>
            <textarea
              value={settlementNote}
              onChange={(e) => setSettlementNote(e.target.value)}
              rows={3}
              placeholder="e.g. Received in 2 bundles of 500s..."
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 12,
                resize: 'vertical',
                marginBottom: 12
              }}
            />

            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Admin Password Verification</div>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Required to authorize settlement"
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 6
              }}
            />
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>Required to authorize financial settlement.</div>

            <button
              onClick={handleCompleteSettlement}
              disabled={!isAdminVerified || selectedItems.length === 0 || selectedPartner === 'all'}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: !isAdminVerified || selectedItems.length === 0 || selectedPartner === 'all'
                  ? '#e2e8f0'
                  : 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: !isAdminVerified || selectedItems.length === 0 || selectedPartner === 'all' ? '#94a3b8' : '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: !isAdminVerified || selectedItems.length === 0 || selectedPartner === 'all' ? 'not-allowed' : 'pointer'
              }}
            >
              Complete Settlement & Issue Receipt
            </button>

            <button
              onClick={handleReportDiscrepancy}
              disabled={!isAdminVerified || selectedItems.length === 0 || selectedPartner === 'all' || difference === 0}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: !isAdminVerified || selectedItems.length === 0 || selectedPartner === 'all' || difference === 0 ? '#e2e8f0' : '#fef3c7',
                color: !isAdminVerified || selectedItems.length === 0 || selectedPartner === 'all' || difference === 0 ? '#94a3b8' : '#92400e',
                border: '1px solid ' + (!isAdminVerified || selectedItems.length === 0 || selectedPartner === 'all' || difference === 0 ? '#cbd5e1' : '#fcd34d'),
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                cursor: !isAdminVerified || selectedItems.length === 0 || selectedPartner === 'all' || difference === 0 ? 'not-allowed' : 'pointer',
                marginTop: 8
              }}
            >
              Report a Discrepancy
            </button>
          </motion.div>
        )}

        {viewSettledTab && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
              ✓ Settled Collections Summary
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13 }}>
                <span style={{ color: '#166534', fontWeight: 600 }}>Total Settled Amount</span>
                <span style={{ fontWeight: 700, color: '#166534', fontSize: 18 }}>
                  ₹{Number(totalSettledAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#6b7280' }}>
                <span>Orders Settled</span>
                <span style={{ fontWeight: 600, color: '#374151' }}>{visibleSettledOrders.length}</span>
              </div>
            </div>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 10 }}>Settlement Summary</div>
              {visibleSettledOrders.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 12 }}>No settled collections to display.</div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #e5e7eb' }}>
                    <span>Latest Settlement</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      ₹{Number(visibleSettledOrders[0]?.amount_assigned || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {new Date(visibleSettledOrders[0]?.settled_at || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ============ WAREHOUSE SETTLEMENT TAB ============
function WarehouseSettlementTab() {
  const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')
  const { adminKey } = useAdminAuth()
  const headers = { 'x-admin-api-key': adminKey }

  const [settlements, setSettlements] = useState([])
  const [settledOrders, setSettledOrders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('settledWarehouseOrders') || '[]') } catch (_) { return [] }
  })
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
    if (!adminKey) return
    fetchWarehouses()
    fetchSettlements(settledOrders)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey])

  useEffect(() => { setSelectedIds([]); setCashReceived('') }, [selectedWarehouse, startDate, endDate])

  useEffect(() => {
    if (adminKey && settledOrders.length > 0) fetchSettlements(settledOrders)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledOrders])

  async function fetchWarehouses() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/warehouses`, { headers })
      if (!res.ok) return
      const data = await res.json()
      setWarehouses(Array.isArray(data) ? data : [])
    } catch (_) { }
  }

  async function fetchSettlements(currentSettled = settledOrders) {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (selectedWarehouse !== 'all') params.append('warehouseId', selectedWarehouse)
      const res = await fetch(`${API_BASE}/api/admin/transactions/warehouse-settlement?${params.toString()}`, { headers })
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
      const res = await fetch(`${API_BASE}/api/admin/transactions/warehouse-settlement/history?${params.toString()}`, { headers })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Failed to fetch history') }
      const data = await res.json()
      setHistoryItems(Array.isArray(data) ? data : [])
    } catch (err) { setHistoryError(err.message) } finally { setHistoryLoading(false) }
  }

  const isAdminVerified = adminPassword === 'ASHI2005'
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

  if (loading) return <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>Loading warehouse settlement data…</div>
  if (error) return <div style={{ color: '#d32f2f', background: '#fee', border: '1px solid #fcc', padding: '16px', borderRadius: '8px' }}>{error}</div>

  async function handleCompleteSettlement() {
    if (!isAdminVerified || selectedItems.length === 0) return
    if (selectedWarehouse === 'all') { alert('Select a warehouse to complete settlement.'); return }
    try {
      const payload = {
        warehouse_id: selectedWarehouse,
        warehouse_name: warehouses.find((w) => w.id === selectedWarehouse)?.name,
        items: selectedItems.map((s) => ({ order_id: s.order_id, user_name: s.user_name || null, amount_assigned: s.amount_assigned || 0, amount_collected: s.amount_collected || 0, collection_date: s.collection_date || s.created_at })),
        total_assigned: selectedTotal,
        total_collected: selectedItems.reduce((sum, s) => sum + Number(s.amount_collected || 0), 0),
        total_settled: selectedTotal, cash_received: cashReceivedValue, difference, note: settlementNote
      }
      const res = await fetch(`${API_BASE}/api/admin/transactions/warehouse-settlement/complete`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Failed to complete settlement') }
      alert('✅ Warehouse settlement completed successfully!')
      const settled = selectedItems.map((s) => ({ ...s, settled_at: new Date().toISOString() }))
      setSettledOrders((prev) => [...prev, ...settled])
      setSettlements((prev) => prev.filter((s) => !selectedItems.map((x) => x.id).includes(s.id)))
      await fetchHistory()
      setSelectedIds([]); setCashReceived(''); setSettlementNote(''); setAdminPassword(''); setHistoryOpen(true)
    } catch (err) { alert(err.message) }
  }

  async function handleReportDiscrepancy() {
    if (!isAdminVerified || selectedItems.length === 0 || selectedWarehouse === 'all' || difference === 0) return
    try {
      const payload = {
        warehouse_id: selectedWarehouse,
        warehouse_name: warehouses.find((w) => w.id === selectedWarehouse)?.name,
        expected_amount: selectedTotal, received_amount: cashReceivedValue,
        discrepancy_amount: Math.abs(difference), discrepancy_type: difference > 0 ? 'overage' : 'shortage',
        description: settlementNote || `${difference > 0 ? 'overage' : 'shortage'} of ₹${Math.abs(difference).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        items: selectedItems.map((s) => ({ order_id: s.order_id, user_name: s.user_name || null, amount_assigned: s.amount_assigned || 0, amount_collected: s.amount_collected || 0, collection_date: s.collection_date || s.created_at }))
      }
      const res = await fetch(`${API_BASE}/api/admin/transactions/warehouse-settlement/discrepancy`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Failed to report discrepancy') }
      alert(`✅ Discrepancy reported successfully! (Report ID: WAR-DISC-${Date.now()})`)
      await fetchHistory()
      setSelectedIds([]); setCashReceived(''); setSettlementNote(''); setAdminPassword(''); setHistoryOpen(true)
    } catch (err) { alert(err.message) }
  }

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
                      <input type="checkbox"
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
                          <input type="checkbox" checked={selectedIds.includes(s.id)} disabled={!isUnlocked}
                            onChange={(e) => setSelectedIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id))}
                            style={{ cursor: isUnlocked ? 'pointer' : 'not-allowed', opacity: isUnlocked ? 1 : 0.45 }}
                          />
                        </td>
                        <td style={{ padding: '12px 6px', fontWeight: 700, color: '#0f172a' }}>#ORD-{String(s.order_id || '').slice(0, 4)}</td>
                        <td style={{ padding: '12px 6px' }}>
                          <div style={{ color: '#1f2937', fontWeight: 600 }}>{s.user_name || 'Unknown'}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11 }}>{s.warehouse_name || 'Unknown Warehouse'}</div>
                        </td>
                        <td style={{ padding: '12px 6px', color: '#64748b' }}>{new Date(s.collection_date || s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
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
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Admin Password Verification</div>
                <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Required to authorize settlement"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, marginBottom: 14, boxSizing: 'border-box' }} />
                <button onClick={handleCompleteSettlement} disabled={!isAdminVerified || selectedItems.length === 0 || selectedWarehouse === 'all'}
                  style={{ width: '100%', padding: '10px 14px', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: (!isAdminVerified || selectedItems.length === 0 || selectedWarehouse === 'all') ? 'not-allowed' : 'pointer', background: (!isAdminVerified || selectedItems.length === 0 || selectedWarehouse === 'all') ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9, #0369a1)', color: (!isAdminVerified || selectedItems.length === 0 || selectedWarehouse === 'all') ? '#94a3b8' : '#fff' }}>
                  Complete Warehouse Settlement &amp; Issue Receipt
                </button>
                <button onClick={handleReportDiscrepancy} disabled={!isAdminVerified || selectedItems.length === 0 || selectedWarehouse === 'all' || difference === 0}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid', borderRadius: 8, fontSize: 11, fontWeight: 600, marginTop: 8, cursor: (!isAdminVerified || difference === 0) ? 'not-allowed' : 'pointer', background: (!isAdminVerified || difference === 0) ? '#e2e8f0' : '#fef3c7', borderColor: (!isAdminVerified || difference === 0) ? '#cbd5e1' : '#fcd34d', color: (!isAdminVerified || difference === 0) ? '#94a3b8' : '#92400e' }}>
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

// ============ WAREHOUSE TAB ============
function WarehouseTab({ adminKey }) {
  const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')
  const authHeaders = { 'x-admin-api-key': adminKey, 'x-admin-key': adminKey }

  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', address: '', contact_number: '' })
  const [saving, setSaving] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  useEffect(() => { fetchWarehouses() }, [])

  async function fetchWarehouses() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/warehouses`, { headers: authHeaders })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body.migration) {
          setError('Run ADD_PICKUP_WAREHOUSE_SUPPORT.sql migration first, then refresh.')
        } else {
          setError(body.error || 'Failed to load warehouses')
        }
        setWarehouses([])
        return
      }
      const data = await res.json()
      setWarehouses(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load warehouses')
    } finally {
      setLoading(false)
    }
  }

  function startCreate() {
    setEditingId(null)
    setForm({ name: '', address: '', contact_number: '' })
    setShowForm(true)
    setActionMsg('')
  }

  function startEdit(w) {
    setEditingId(w.id)
    setForm({ name: w.name, address: w.address, contact_number: w.contact_number || '' })
    setShowForm(true)
    setActionMsg('')
  }

  async function handleSave() {
    if (!form.name.trim() || !form.address.trim()) {
      setActionMsg('Name and address are required.')
      return
    }
    setSaving(true)
    setActionMsg('')
    try {
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? `${API_BASE}/api/admin/warehouses/${editingId}` : `${API_BASE}/api/admin/warehouses`
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Save failed')
      }
      setShowForm(false)
      setEditingId(null)
      await fetchWarehouses()
      setActionMsg(editingId ? 'Warehouse updated.' : 'Warehouse created.')
    } catch (err) {
      setActionMsg(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this warehouse? This will fail if active orders reference it.')) return
    try {
      const res = await fetch(`${API_BASE}/api/admin/warehouses/${id}`, { method: 'DELETE', headers: authHeaders })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Delete failed')
      }
      await fetchWarehouses()
      setActionMsg('Warehouse deleted.')
    } catch (err) {
      setActionMsg(err.message || 'Delete failed')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>🏬 Warehouse Management</h3>
        <button
          onClick={startCreate}
          style={{ padding: '10px 20px', background: '#f59e0b', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          + New Warehouse
        </button>
      </div>

      {actionMsg && (
        <div style={{ padding: '10px 16px', background: actionMsg.includes('failed') || actionMsg.includes('required') ? '#fee2e2' : '#ecfdf5', color: actionMsg.includes('failed') || actionMsg.includes('required') ? '#b91c1c' : '#065f46', borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
          {actionMsg}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef3c7', color: '#92400e', borderRadius: 8, border: '1px solid #fcd34d', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {showForm && (
        <div style={{ background: '#fff', border: '1.5px solid #fcd34d', borderRadius: 12, padding: 24, display: 'grid', gap: 16 }}>
          <h4 style={{ margin: 0, color: '#92400e' }}>{editingId ? 'Edit Warehouse' : 'Create Warehouse'}</h4>
          <div style={{ display: 'grid', gap: 12 }}>
            <input
              placeholder="Warehouse name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, width: '100%', boxSizing: 'border-box' }}
            />
            <input
              placeholder="Full address *"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, width: '100%', boxSizing: 'border-box' }}
            />
            <input
              placeholder="Contact number"
              value={form.contact_number}
              onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '10px 24px', background: saving ? '#fde68a' : '#f59e0b', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{ padding: '10px 24px', background: '#f1f5f9', color: '#475569', border: 0, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Loading warehouses…</div>
      ) : warehouses.length === 0 && !error ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999', background: '#f9f9f9', borderRadius: 12, border: '2px dashed #ddd' }}>
          🏬 No warehouses yet. Create one to enable Pickup &amp; Drive orders.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {warehouses.map((w) => (
            <div key={w.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>🏬 {w.name}</div>
                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 2 }}>📍 {w.address}</div>
                {w.contact_number && <div style={{ fontSize: 14, color: '#64748b' }}>📞 {w.contact_number}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => startEdit(w)} style={{ padding: '8px 16px', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Edit</button>
                <button onClick={() => handleDelete(w.id)} style={{ padding: '8px 16px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============ DELIVERY PARTNERS TAB ============
const BIHAR_ROUTE_AREAS = {
  Araria: ['Forbesganj', 'Jokihat', 'Raniganj', 'Narpatganj', 'Palasi'],
  Arwal: ['Arwal', 'Karpi', 'Kaler', 'Kurtha'],
  Aurangabad: ['Daudnagar', 'Rafiganj', 'Madanpur', 'Nabinagar', 'Kutumba'],
  Banka: ['Banka', 'Amarpur', 'Katoria', 'Barahat', 'Belhar'],
  Begusarai: ['Begusarai', 'Bakhri', 'Balia', 'Cheria Bariarpur', 'Teghra'],
  Bhagalpur: ['Nathnagar', 'Kahalgaon', 'Sultanganj', 'Naugachhia', 'Sabour'],
  Bhojpur: ['Ara', 'Jagdishpur', 'Koilwar', 'Sahar', 'Piro'],
  Buxar: ['Buxar', 'Dumraon', 'Itarhi', 'Chakki', 'Chausa'],
  Darbhanga: ['Laheriasarai', 'Benipur', 'Biraul', 'Jale', 'Singhwara'],
  'East Champaran': ['Motihari', 'Raxaul', 'Mehsi', 'Chakia', 'Pakri Dayal'],
  Gaya: ['Bodh Gaya', 'Tekari', 'Sherghati', 'Imamganj', 'Belaganj'],
  Gopalganj: ['Gopalganj', 'Hathua', 'Barauli', 'Kuchaikote', 'Manjha'],
  Jamui: ['Jamui', 'Jhajha', 'Chakai', 'Sonohara', 'Gidhaur'],
  Jehanabad: ['Jehanabad', 'Makhdumpur', 'Kako', 'Ratni Faridpur'],
  Kaimur: ['Bhabua', 'Mohania', 'Adhaura', 'Durgawati', 'Ramgarh'],
  Katihar: ['Katihar', 'Barari', 'Manihari', 'Dandkhora', 'Balrampur'],
  Khagaria: ['Khagaria', 'Mansi', 'Alouli', 'Gogri', 'Parbatta'],
  Kishanganj: ['Kishanganj', 'Bahadurganj', 'Thakurganj', 'Pothia', 'Teragachh'],
  Lakhisarai: ['Lakhisarai', 'Surajgarha', 'Chanan', 'Piparia'],
  Madhepura: ['Madhepura', 'Murliganj', 'Udakishunganj', 'Bihariganj', 'Kumarkhand'],
  Madhubani: ['Madhubani', 'Jhanjharpur', 'Benipatti', 'Saharsa', 'Phulparas'],
  Munger: ['Munger', 'Jamalpur', 'Haveli Kharagpur', 'Asarganj', 'Tarapur'],
  Muzaffarpur: ['Bochahan', 'Kanti', 'Motipur', 'Sakra', 'Mushahari', 'Minapur', 'Kurhani'],
  Nalanda: ['Bihar Sharif', 'Rajgir', 'Hilsa', 'Islampur', 'Biharsharif Sadar'],
  Nawada: ['Nawada', 'Rajauli', 'Pakribarawan', 'Narhat', 'Warisaliganj'],
  Patna: ['Danapur', 'Phulwari Sharif', 'Bakhtiyarpur', 'Barh', 'Masaurhi', 'Paliganj', 'Digha', 'Patna City', 'Bihta', 'Maner'],
  Purnia: ['Purnia', 'Banmankhi', 'Dhamdaha', 'Kasba', 'Jalalgarh'],
  Rohtas: ['Sasaram', 'Dehri', 'Nokha', 'Kargahar', 'Chenari'],
  Saharsa: ['Saharsa', 'Simri Bakhtiarpur', 'Mahishi', 'Sonbarsa', 'Kahra'],
  Samastipur: ['Samastipur', 'Rosera', 'Dalsinghsarai', 'Patori', 'Sarairanjan'],
  Saran: ['Chhapra', 'Marhaura', 'Ekma', 'Baniapur', 'Garkha'],
  Sheikhpura: ['Sheikhpura', 'Barbigha', 'Chewara', 'Ghat Kusumbha'],
  Sheohar: ['Sheohar', 'Piprahi', 'Dumri Katsari', 'Purnahiya'],
  Sitamarhi: ['Sitamarhi', 'Belsand', 'Pupri', 'Riga', 'Parihar'],
  Siwan: ['Siwan', 'Mairwa', 'Ziradei', 'Barharia', 'Andar'],
  Supaul: ['Supaul', 'Nirmali', 'Triveniganj', 'Pipra', 'Basantpur'],
  Vaishali: ['Hajipur', 'Mahua', 'Lalganj', 'Patepur', 'Raja Pakar'],
  'West Champaran': ['Bettiah', 'Bagaha', 'Narkatiaganj', 'Lauriya', 'Chanpatia']
}

const BIHAR_ROUTE_OPTIONS = Object.keys(BIHAR_ROUTE_AREAS)

function splitBiharRouteArea(value) {
  const raw = String(value || '').trim()
  if (!raw) return { route: '', area: '' }

  for (const route of BIHAR_ROUTE_OPTIONS) {
    if (raw === route) return { route, area: '' }

    const prefixes = [`${route} - `, `${route} / `, `${route}: `, `${route} — `]
    for (const prefix of prefixes) {
      if (raw.startsWith(prefix)) {
        return { route, area: raw.slice(prefix.length).trim() }
      }
    }
  }

  const dashIndex = raw.indexOf(' - ')
  if (dashIndex > 0) {
    return {
      route: raw.slice(0, dashIndex).trim(),
      area: raw.slice(dashIndex + 3).trim()
    }
  }

  return { route: '', area: raw }
}

function buildBiharAssignedArea(route, area) {
  const cleanedRoute = String(route || '').trim()
  const cleanedArea = String(area || '').trim()
  if (!cleanedRoute) return cleanedArea
  if (!cleanedArea) return cleanedRoute
  return `${cleanedRoute} - ${cleanedArea}`
}

function DeprecatedDeliveryPartnersTab({ adminKey }) {
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPartner, setEditingPartner] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '', mobileNumber: '', route: '', area: '' })
  const [editFormData, setEditFormData] = useState({ name: '', email: '', mobile_number: '', route: '', area: '', status: 'active' })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const sanitizePhoneInput = (value) => String(value || '').replace(/\D/g, '').slice(0, 10)

  useEffect(() => {
    loadDeliveryPartners()
  }, [])

  const loadDeliveryPartners = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/admin/delivery-partners`, {
        headers: { 'x-admin-api-key': adminKey }
      })
      const data = await res.json()
      setPartners(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load delivery partners:', err)
      setError('Failed to load delivery partners')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePartner = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const normalizedMobileNumber = sanitizePhoneInput(formData.mobileNumber)
    const assignedArea = buildBiharAssignedArea(formData.route, formData.area)

    if (!formData.name || !formData.email || !normalizedMobileNumber || !formData.route || !formData.area) {
      setError('All fields are required')
      return
    }

    if (!/^\d{10}$/.test(normalizedMobileNumber)) {
      setError('Mobile number must be exactly 10 digits')
      return
    }

    if (!BIHAR_ROUTE_OPTIONS.includes(formData.route)) {
      setError('Please select a Bihar district')
      return
    }

    if (!BIHAR_ROUTE_AREAS[formData.route]?.includes(formData.area)) {
      setError('Please select a valid area for the selected district')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/delivery/admin/create`, {
        method: 'POST',
        headers: {
          'x-admin-api-key': adminKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          assignedArea,
          mobileNumber: normalizedMobileNumber
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to create partner')

      setSuccess(`✅ Delivery partner created!\nID: ${data.deliveryPartner.delivery_partner_id}\nTemp Password: ${data.tempPassword}\n\nShare these credentials with the partner.`)
      setFormData({ name: '', email: '', mobileNumber: '', route: '', area: '' })
      setShowCreateForm(false)
      loadDeliveryPartners()
    } catch (err) {
      setError(err.message || 'Failed to create delivery partner')
    }
  }

  const startEditPartner = (partner) => {
    setError(null)
    setSuccess(null)
    setEditingPartner(partner)
    setShowCreateForm(false)
    const { route, area } = splitBiharRouteArea(partner.assigned_area || '')
    setEditFormData({
      name: partner.name || '',
      email: partner.email || '',
      mobile_number: String(partner.mobile_number || '').replace(/\D/g, '').slice(0, 10),
      route,
      area,
      status: partner.status || 'active'
    })
  }

  const cancelEditPartner = () => {
    setEditingPartner(null)
    setEditFormData({ name: '', email: '', mobile_number: '', route: '', area: '', status: 'active' })
  }

  const handleUpdatePartner = async (e) => {
    e.preventDefault()
    if (!editingPartner) return

    setError(null)
    setSuccess(null)

    const normalizedMobileNumber = sanitizePhoneInput(editFormData.mobile_number)
    const assignedArea = buildBiharAssignedArea(editFormData.route, editFormData.area)

    if (!editFormData.name.trim() || !editFormData.email.trim() || !normalizedMobileNumber || !editFormData.route || !editFormData.area) {
      setError('All fields are required')
      return
    }

    if (!/^\d{10}$/.test(normalizedMobileNumber)) {
      setError('Mobile number must be exactly 10 digits')
      return
    }

    if (!BIHAR_ROUTE_OPTIONS.includes(editFormData.route)) {
      setError('Please select a Bihar district')
      return
    }

    if (!BIHAR_ROUTE_AREAS[editFormData.route]?.includes(editFormData.area)) {
      setError('Please select a valid area for the selected district')
      return
    }

    const payload = {
      name: editFormData.name.trim(),
      email: editFormData.email.trim(),
      mobile_number: normalizedMobileNumber,
      assigned_area: assignedArea,
      status: editFormData.status
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/delivery-partners/${editingPartner.id}`, {
        method: 'PUT',
        headers: {
          'x-admin-api-key': adminKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to update partner')

      setSuccess('Delivery partner updated successfully')
      cancelEditPartner()
      loadDeliveryPartners()
    } catch (err) {
      setError(err.message || 'Failed to update delivery partner')
    }
  }

  const handleDeletePartner = async (partner) => {
    if (!confirm(`Delete ${partner.name || 'this delivery partner'}? This will remove the partner account and credentials from the database.`)) {
      return
    }

    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`${API_BASE}/api/admin/delivery-partners/${partner.id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-api-key': adminKey
        }
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to delete partner')

      if (editingPartner?.id === partner.id) {
        cancelEditPartner()
      }
      setSuccess('Delivery partner deleted successfully')
      loadDeliveryPartners()
    } catch (err) {
      setError(err.message || 'Failed to delete delivery partner')
    }
  }

  const handleStatusToggle = async (partnerId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      setError(null)
      const res = await fetch(`${API_BASE}/api/admin/delivery-partners/${partnerId}`, {
        method: 'PUT',
        headers: {
          'x-admin-key': adminKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(payload.error || 'Failed to update status')

      setSuccess(`Partner status updated to ${payload.status || newStatus}`)
      loadDeliveryPartners()
    } catch (err) {
      setError(err.message || 'Failed to update status')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ color: '#0f172a' }}>Delivery Partners Management</h3>
        {editingPartner ? (
          <button
            type="button"
            onClick={cancelEditPartner}
            style={{
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #2b7eb8 0%, #1a5f8f 100%)',
              color: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ✕ Cancle
          </button>
        ) : (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #2b7eb8 0%, #1a5f8f 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {showCreateForm ? '✕ Cancel' : '+ Create New Partner'}
          </button>
        )}
      </div>

      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert" style={{ marginBottom: 16, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', whiteSpace: 'pre-wrap' }}>{success}</div>}

      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ padding: 24, marginBottom: 24, background: '#f9fafb' }}
        >
          <h4 style={{ marginBottom: 16, color: '#0f172a' }}>Create New Delivery Partner</h4>
          <form onSubmit={handleCreatePartner} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            <div>
              <label className="form-label">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <input
                name="create_email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Mobile Number</label>
              <input
                type="tel"
                placeholder="9876543210"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: sanitizePhoneInput(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="form-label">Bihar District</label>
              <select
                value={formData.route}
                onChange={(e) => setFormData({ ...formData, route: e.target.value, area: '' })}
                required
                style={{ width: '100%' }}
              >
                <option value="">Select Bihar district</option>
                {BIHAR_ROUTE_OPTIONS.map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Area / Locality under selected district</label>
              <select
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                required
                disabled={!formData.route}
                style={{ width: '100%' }}
              >
                <option value="">{formData.route ? 'Select area' : 'Select district first'}</option>
                {(BIHAR_ROUTE_AREAS[formData.route] || []).map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #FF8C00, #FFB347)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Create Partner
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {editingPartner && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ padding: 20, marginBottom: 24, background: '#ffffff', border: '1px solid #e6eefc', borderRadius: 12, boxShadow: '0 8px 28px rgba(13, 30, 60, 0.06)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Edit Delivery Partner</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Partner ID: <span style={{ fontWeight: 700, color: '#334155' }}>{editingPartner.delivery_partner_id || '—'}</span></div>
            </div>
          </div>
          {error && (
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: '#fff1f0', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 700 }}>{error}</div>
          )}
          {success && (
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: '#ecfdf5', color: '#065f46', border: '1px solid #bbf7d0', fontWeight: 700 }}>{success}</div>
          )}

          <form onSubmit={handleUpdatePartner} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Full Name</label>
              <input
                type="text"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, color: '#0f172a', background: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Email Address</label>
              <input
                name="edit_email"
                type="email"
                value={editFormData.email}
                readOnly
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, color: '#6b7280', background: '#f9fafb', cursor: 'not-allowed' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Mobile Number</label>
              <input
                type="tel"
                placeholder="9876543210"
                value={editFormData.mobile_number}
                onChange={(e) => setEditFormData({ ...editFormData, mobile_number: sanitizePhoneInput(e.target.value) })}
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>Only 10 digits allowed.</div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Bihar District</label>
              <select
                value={editFormData.route}
                onChange={(e) => setEditFormData({ ...editFormData, route: e.target.value, area: '' })}
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: '#fff' }}
              >
                <option value="">Select Bihar district</option>
                {BIHAR_ROUTE_OPTIONS.map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Area / Locality under selected district</label>
              <select
                value={editFormData.area}
                onChange={(e) => setEditFormData({ ...editFormData, area: e.target.value })}
                required
                disabled={!editFormData.route}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: editFormData.route ? '#fff' : '#f9fafb' }}
              >
                <option value="">{editFormData.route ? 'Select area' : 'Select district first'}</option>
                {(BIHAR_ROUTE_AREAS[editFormData.route] || []).map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Status</label>
              <select
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: '#fff' }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                style={{
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #0b5fff, #2563eb)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Update Partner
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Loading delivery partners...</div>
      ) : partners.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No delivery partners yet</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#0f172a' }}>Partner ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#0f172a' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#0f172a' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#0f172a' }}>Mobile</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#0f172a' }}>Assigned Area</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#0f172a' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <motion.tr
                  key={partner.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ borderBottom: '1px solid #e5e7eb', background: '#fff' }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#FF8C00' }}>{partner.delivery_partner_id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>{partner.name}</td>
                  <td style={{ padding: '12px 16px', color: '#556070', fontSize: '13px' }}>{partner.email}</td>
                  <td style={{ padding: '12px 16px', color: '#556070', fontSize: '13px' }}>{partner.mobile_number}</td>
                  <td style={{ padding: '12px 16px', color: '#556070', fontSize: '13px' }}>{partner.assigned_area}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: partner.status === 'active' ? '#d1fae5' : '#fee2e2',
                      color: partner.status === 'active' ? '#065f46' : '#991b1b',
                      fontWeight: '600',
                      fontSize: '11px'
                    }}>
                      {partner.status?.toUpperCase() || 'ACTIVE'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => startEditPartner(partner)}
                      style={{
                        padding: '6px 12px',
                        marginRight: 8,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        borderRadius: 6,
                        fontWeight: '600',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeletePartner(partner)}
                      style={{
                        padding: '6px 12px',
                        marginRight: 8,
                        background: '#fee2e2',
                        color: '#991b1b',
                        border: '1px solid #fecaca',
                        borderRadius: 6,
                        fontWeight: '600',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleStatusToggle(partner.id, partner.status || 'active')}
                      style={{
                        padding: '6px 12px',
                        background: partner.status === 'active' ? '#fee2e2' : '#d1fae5',
                        color: partner.status === 'active' ? '#991b1b' : '#065f46',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: '600',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {partner.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// --- Realtime Notification Popup Components ---

function RealtimePopupContainer({ popups, onDismiss, onApprove, onReview, onViewDetails, onAssign, warehouses, deliveryPartners, adminKey }) {
  if (!popups || popups.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      maxWidth: 420,
      width: 'calc(100% - 48px)',
      pointerEvents: 'none'
    }}>
      <AnimatePresence>
        {popups.map((popup) => (
          <RealtimePopupCard
            key={popup.id}
            order={popup}
            onDismiss={() => onDismiss(popup.id)}
            onApprove={(warehouseId) => onApprove(popup.id, warehouseId)}
            onReview={() => onReview(popup)}
            onViewDetails={() => onViewDetails(popup)}
            onAssign={onAssign}
            warehouses={warehouses}
            deliveryPartners={deliveryPartners}
            adminKey={adminKey}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function RealtimePopupCard({ order: initialOrder, onDismiss, onApprove, onReview, onViewDetails, onAssign, warehouses, deliveryPartners = [], adminKey }) {
  const [order, setOrder] = useState(initialOrder)
  const [loading, setLoading] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedPartner, setSelectedPartner] = useState('')
  const [loadingAssign, setLoadingAssign] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    let isMounted = true
    async function fetchFreshOrder() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/orders/${initialOrder.id}`, {
          headers: { 'x-admin-api-key': adminKey }
        })
        if (res.ok && isMounted) {
          const freshOrder = await res.json()
          setOrder(freshOrder)
        }
      } catch (err) {
        console.error('Failed to fetch fresh order details in popup:', err)
      }
    }
    fetchFreshOrder()
    return () => { isMounted = false }
  }, [initialOrder.id, adminKey])

  useEffect(() => {
    setOrder(prev => {
      const merged = { ...prev, ...initialOrder }
      const keysToPreserve = [
        'subtotal',
        'discount_total',
        'slab_discount',
        'Slab_discount',
        'coupon_discount',
        'offer_discount',
        'gst_amount',
        'shipping_fee'
      ]
      keysToPreserve.forEach(key => {
        if (prev[key] !== undefined && prev[key] !== null && (initialOrder[key] === undefined || initialOrder[key] === null)) {
          merged[key] = prev[key]
        }
      })
      if (prev.items && prev.items.length > 0 && prev.items[0].price !== undefined) {
        merged.items = prev.items
      }
      return merged
    })
  }, [initialOrder])

  const isPickup = order.shipping_method === 'pickup_drive' || order.pickup_order

  // Auto-dismiss countdown
  useEffect(() => {
    if (loading || hovered || order.status === 'Approved') return

    const startTime = Date.now()
    const duration = 15000 // 15 seconds
    const intervalTime = 100

    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev - (intervalTime / duration) * 100
        if (next <= 0) {
          clearInterval(timer)
          onDismiss()
          return 0
        }
        return next
      })
    }, intervalTime)

    return () => clearInterval(timer)
  }, [loading, hovered, order.status, onDismiss])

  const handleQuickApprove = async (e) => {
    e.stopPropagation()
    if (isPickup && !selectedWarehouse) {
      alert('Please select a warehouse for Pickup & Drive approval.')
      return
    }
    setLoading(true)
    try {
      await onApprove(selectedWarehouse)
    } catch (err) {
      setLoading(false)
    }
  }

  const handleAssignClick = async (e) => {
    e.stopPropagation()
    if (!selectedPartner) {
      alert('Please select a delivery partner to assign.')
      return
    }
    setLoadingAssign(true)
    try {
      await onAssign(order.id, selectedPartner)
    } catch (err) {
      setLoadingAssign(false)
    }
  }

  const items = order.items || []

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, y: 0, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 200, scale: 0.9, transition: { duration: 0.25 } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onViewDetails} // Clicking the card opens details modal
      style={{
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(220, 200, 180, 0.8)',
        borderRadius: 20,
        boxShadow: '0 20px 40px rgba(100, 70, 50, 0.15), 0 1px 3px rgba(0, 0, 0, 0.05)',
        padding: '20px 20px 16px',
        position: 'relative',
        overflow: 'hidden',
        pointerEvents: 'auto',
        width: '100%',
        boxSizing: 'border-box',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none'
      }}
    >
      {/* Top Banner Accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 5,
        background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)'
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🔔</span>
          <span style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            color: '#1e40af',
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.5px'
          }}>
            NEW ORDER
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          style={{
            background: 'rgba(0, 0, 0, 0.04)',
            border: 0,
            borderRadius: '50%',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748b',
            fontSize: 16,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#dc2626' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)'; e.currentTarget.style.color = '#64748b' }}
        >
          ✕
        </button>
      </div>

      {/* Order ID & Price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>
          #{order.id ? order.id.slice(0, 8).toUpperCase() : 'ORDER'}
        </span>
        <span style={{ fontSize: 20, fontWeight: 950, color: '#0ea5e9' }}>
          ₹{Number(order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {Number(order.discount_total || order.slab_discount || order.Slab_discount || 0) > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 12,
          padding: '8px 12px',
          marginBottom: 10,
          fontSize: 12,
          color: '#166534',
          fontWeight: 700
        }}>
          <span>💰 Total Savings</span>
          <span>−₹{Number(order.discount_total || order.slab_discount || order.Slab_discount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      )}

      {/* Customer details */}
      <div style={{ marginBottom: 12, fontSize: 13, color: '#475569' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
          <span>👤</span> {order.customer_name}
        </div>
        {order.customer_email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8, paddingLeft: 2 }}>
            <span>✉️</span> {order.customer_email}
          </div>
        )}
      </div>

      {/* Items Preview */}
      <div style={{
        background: '#f8fafc',
        borderRadius: 12,
        padding: '10px 14px',
        maxHeight: 100,
        overflowY: 'auto',
        marginBottom: 14,
        border: '1px solid #f1f5f9'
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.5px' }}>
          Items ({items.length})
        </div>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#334155', marginTop: idx > 0 ? 6 : 0 }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
              {item.name}
            </span>
            <span style={{ color: '#64748b', fontWeight: 700 }}>
              x{item.quantity || 1}
            </span>
          </div>
        ))}
      </div>

      {/* Warehouse Selector for Pickup Orders */}
      {isPickup && order.status === 'Pending' && (
        <div style={{ marginBottom: 12 }} onClick={(e) => e.stopPropagation()}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>
            Select Warehouse *
          </label>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 12,
              background: '#fff'
            }}
          >
            <option value="">Choose pickup warehouse...</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      )}

      {order.status === 'Approved' ? (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>✓ Approved</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>Select Delivery Partner:</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              style={{
                flex: 2,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 12,
                background: '#fff'
              }}
            >
              <option value="">Choose partner...</option>
              {deliveryPartners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={handleAssignClick}
              disabled={loadingAssign || !selectedPartner}
              style={{
                flex: 1.2,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                fontWeight: 700,
                fontSize: 12,
                border: 0,
                cursor: loadingAssign || !selectedPartner ? 'not-allowed' : 'pointer',
                opacity: loadingAssign || !selectedPartner ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                transition: 'all 0.2s'
              }}
            >
              {loadingAssign ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      ) : (
        /* Actions */
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={handleQuickApprove}
            disabled={loading || (isPickup && !selectedWarehouse)}
            style={{
              flex: 1.2,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              fontWeight: 700,
              fontSize: 12,
              border: 0,
              cursor: loading || (isPickup && !selectedWarehouse) ? 'not-allowed' : 'pointer',
              opacity: loading || (isPickup && !selectedWarehouse) ? 0.6 : 1,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Approving...' : '✓ Approve'}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onReview() }}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#eff6ff',
              color: '#1e40af',
              fontWeight: 700,
              fontSize: 12,
              border: '1px solid #bfdbfe',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#dbeafe'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#eff6ff'}
          >
            Review
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails() }}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#f8fafc',
              color: '#334155',
              fontWeight: 700,
              fontSize: 12,
              border: '1px solid #cbd5e1',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
          >
            Details
          </button>
        </div>
      )}

      {/* Progress Auto-dismiss Indicator */}
      {order.status !== 'Approved' && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 3,
          width: `${progress}%`,
          background: '#3b82f6',
          transition: 'width 0.1s linear'
        }} />
      )}
    </motion.div>
  )
}

// --- Realtime Order Details Modal Component ---

function OrderDetailModal({ order: initialOrder, onClose, onApprove, onCancel, onAssign, warehouses, deliveryPartners = [], adminKey }) {
  const [order, setOrder] = useState(initialOrder)
  const [loading, setLoading] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedPartner, setSelectedPartner] = useState('')
  const [loadingAssign, setLoadingAssign] = useState(false)

  const formatCurrency = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  useEffect(() => {
    let isMounted = true
    async function fetchFreshOrder() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/orders/${initialOrder.id}`, {
          headers: { 'x-admin-api-key': adminKey }
        })
        if (res.ok && isMounted) {
          const freshOrder = await res.json()
          setOrder(freshOrder)
        }
      } catch (err) {
        console.error('Failed to fetch fresh order details in modal:', err)
      }
    }
    fetchFreshOrder()
    return () => { isMounted = false }
  }, [initialOrder.id, adminKey])

  useEffect(() => {
    setOrder(prev => {
      const merged = { ...prev, ...initialOrder }
      const keysToPreserve = [
        'subtotal',
        'discount_total',
        'slab_discount',
        'Slab_discount',
        'coupon_discount',
        'offer_discount',
        'gst_amount',
        'shipping_fee'
      ]
      keysToPreserve.forEach(key => {
        if (prev[key] !== undefined && prev[key] !== null && (initialOrder[key] === undefined || initialOrder[key] === null)) {
          merged[key] = prev[key]
        }
      })
      if (prev.items && prev.items.length > 0 && prev.items[0].price !== undefined) {
        merged.items = prev.items
      }
      return merged
    })
  }, [initialOrder])

  const isPickup = order.shipping_method === 'pickup_drive' || order.pickup_order
  const items = order.items || []

  const calculatedSubtotal = useMemo(() => {
    const itemsSum = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || item.qty || 1)), 0)
    if (itemsSum > 0) return itemsSum
    if (order.subtotal && Number(order.subtotal) > 0) return Number(order.subtotal)
    return Number(order.total_amount || 0)
  }, [order, items])

  const getItemQty = (item) => Number(item?.qty ?? item?.quantity ?? 0)
  const getSlabDiscountAmount = (item) => {
    const qty = getItemQty(item)
    const slab = item?.slab
    if (!slab || qty < Number(slab.min_quantity || 0)) return 0
    const stored = Number(item?.slab_discount || 0)
    if (stored > 0) return stored
    return calculateSlabDiscountAmount({ price: Number(item?.price || 0), quantity: qty, slab })
  }
  const slabDiscountDetails = useMemo(() => {
    return (items || [])
      .filter(i => Number(i?.slab_discount || 0) > 0 || (i?.slab && getItemQty(i) >= Number(i.slab.min_quantity || 0)))
      .map(i => ({
        name: i.name || i.product?.name || 'Product',
        qty: getItemQty(i),
        ruleText: i?.slab ? formatSlabRuleText(i.slab) : 'Applied on eligible quantities',
        amount: getSlabDiscountAmount(i) || Number(i?.slab_discount || 0)
      }))
      .filter(d => d.amount > 0)
  }, [items])

  const handleApproveClick = async () => {
    if (isPickup && !selectedWarehouse) {
      alert('Please select a warehouse for Pickup & Drive approval.')
      return
    }
    setLoading(true)
    try {
      await onApprove(order.id, selectedWarehouse)
    } catch (err) {
      setLoading(false)
    }
  }

  const handleCancelClick = async () => {
    setLoading(true)
    try {
      await onCancel(order.id)
    } catch (err) {
      setLoading(false)
    }
  }

  const handleAssignClick = async () => {
    if (!selectedPartner) {
      alert('Please select a delivery partner to assign')
      return
    }
    setLoadingAssign(true)
    try {
      await onAssign(order.id, selectedPartner)
    } catch (err) {
      setLoadingAssign(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'grid',
        placeItems: 'center',
        padding: '24px 16px',
        zIndex: 10000,
        overflowY: 'auto'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        style={{
          width: '100%',
          maxWidth: 640,
          background: 'white',
          borderRadius: 24,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 24px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                Order #{order.id ? order.id.slice(0, 8).toUpperCase() : 'ORDER'}
              </span>
              <span style={{
                padding: '4px 10px',
                borderRadius: 8,
                background: order.status === 'Pending' ? '#fffbeb' : '#ecfdf5',
                color: order.status === 'Pending' ? '#b45309' : '#047857',
                fontSize: 12,
                fontWeight: 700
              }}>
                {order.status}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              Placed on {new Date(order.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: 18,
              transition: 'all 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#94a3b8'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(80vh - 200px)' }}>
          {/* Customer details */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              👤 Customer Details
            </h4>
            <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16, border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Full Name</div>
                  <div style={{ fontWeight: 700, color: '#334155' }}>{order.customer_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Email Address</div>
                  <div style={{ fontWeight: 700, color: '#334155' }}>{order.customer_email || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Payment Method</div>
                  <div style={{ fontWeight: 700, color: '#334155' }}>{order.payment_method === 'COD' ? 'Cash on Delivery' : 'Prepaid'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Shipping Method</div>
                  <div style={{ fontWeight: 700, color: '#334155' }}>{isPickup ? 'Pickup & Drive' : 'Standard Delivery'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📦 Order Items
            </h4>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700 }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Item Name</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', width: 80 }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', width: 100 }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', width: 120 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const price = Number(item.price || 0)
                    const qty = Number(item.quantity || item.qty || 1)
                    return (
                      <tr key={index} style={{ borderBottom: index < items.length - 1 ? '1px solid #f1f5f9' : 'none', color: '#334155' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{qty}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>₹{price.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>₹{(price * qty).toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Warehouse and Prices */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            <div>
              {isPickup && order.status === 'Pending' && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#92400e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Select Warehouse *
                  </label>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      background: '#fff',
                      color: '#475569'
                    }}
                  >
                    <option value="">Select pickup warehouse...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {!isPickup && order.status === 'Approved' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 16, padding: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e40af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Assign Delivery Partner *
                  </label>
                  <select
                    value={selectedPartner}
                    onChange={(e) => setSelectedPartner(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      background: '#fff',
                      color: '#475569'
                    }}
                  >
                    <option value="">Select delivery partner...</option>
                    {deliveryPartners.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16, border: '1px solid #f1f5f9', display: 'grid', gap: 10, fontSize: 13, color: '#475569' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>₹{formatCurrency(calculatedSubtotal)}</span>
              </div>
              {Number(order.coupon_discount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 600 }}>
                  <span>Coupon Discount</span>
                  <span>-₹{formatCurrency(order.coupon_discount)}</span>
                </div>
              )}
              {slabDiscountDetails.length > 0 && (
                <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '10px 14px', border: '1px solid #bbf7d0', marginTop: 4, marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#166534', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🏷️</span> Slab Discounts Applied
                  </div>
                  {slabDiscountDetails.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                      <span style={{ color: '#166534' }}>{d.name} (×{d.qty})</span>
                      <span style={{ color: '#059669', fontWeight: 700 }}>−₹{formatCurrency(d.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {slabDiscountDetails.length === 0 && Number(order.slab_discount || order.Slab_discount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 600 }}>
                  <span>Slab Discount</span>
                  <span>-₹{formatCurrency(order.slab_discount || order.Slab_discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Shipping</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>
                  {Number(order.shipping_fee || 0) === 0 ? <span style={{ color: '#10b981', fontWeight: 700 }}>FREE</span> : `₹${formatCurrency(order.shipping_fee)}`}
                </span>
              </div>
              {Number(order.gst_amount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tax (GST 5%)</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>₹{formatCurrency(order.gst_amount)}</span>
                </div>
              )}
              {Number(order.discount_total || order.slab_discount || order.Slab_discount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontWeight: 700, marginTop: 4 }}>
                  <span>💰 Total Savings</span>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>−₹{formatCurrency(order.discount_total || order.slab_discount || order.Slab_discount || 0)}</span>
                </div>
              )}
              <div style={{ borderTop: '2px solid #0f172a', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                <span>Total Amount</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>₹{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #f1f5f9',
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12
        }}>
          <button
            onClick={onClose}
            disabled={loading || loadingAssign}
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              border: '1px solid #cbd5e1',
              background: 'white',
              color: '#475569',
              fontWeight: 700,
              fontSize: 14,
              cursor: loading || loadingAssign ? 'not-allowed' : 'pointer'
            }}
          >
            Close
          </button>

          {order.status === 'Pending' && (
            <>
              <button
                onClick={handleCancelClick}
                disabled={loading}
                style={{
                  padding: '12px 20px',
                  borderRadius: 12,
                  border: 0,
                  background: '#ef4444',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
                }}
              >
                {loading ? 'Cancelling...' : 'Cancel Order'}
              </button>

              <button
                onClick={handleApproveClick}
                disabled={loading || (isPickup && !selectedWarehouse)}
                style={{
                  padding: '12px 24px',
                  borderRadius: 12,
                  border: 0,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: loading || (isPickup && !selectedWarehouse) ? 'not-allowed' : 'pointer',
                  opacity: loading || (isPickup && !selectedWarehouse) ? 0.6 : 1,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                }}
              >
                {loading ? 'Approving...' : '✓ Approve Order'}
              </button>
            </>
          )}

          {order.status === 'Approved' && !isPickup && (
            <button
              onClick={handleAssignClick}
              disabled={loadingAssign || !selectedPartner}
              style={{
                padding: '12px 24px',
                borderRadius: 12,
                border: 0,
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                fontWeight: 700,
                fontSize: 14,
                cursor: loadingAssign || !selectedPartner ? 'not-allowed' : 'pointer',
                opacity: loadingAssign || !selectedPartner ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
              }}
            >
              {loadingAssign ? 'Assigning...' : 'Assign Delivery Partner'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
