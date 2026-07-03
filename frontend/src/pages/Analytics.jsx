import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fetchUserOrders, getCachedDataSync } from '../api/client'
import { motion } from 'framer-motion'

export default function Analytics({ userId }) {
  const cachedOrders = userId ? getCachedDataSync(`orders_${userId}`) : getCachedDataSync('orders_current_user')
  const [orders, setOrders] = useState(cachedOrders || [])
  const [loading, setLoading] = useState(!cachedOrders)
  const [selectedMonth, setSelectedMonth] = useState('all')

  useEffect(() => {
    async function loadData() {
      try {
        let activeUserId = userId
        if (!activeUserId) {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            setLoading(false)
            return
          }
          activeUserId = user.id
        }

        const currentCacheKey = `orders_${activeUserId}`
        const freshCached = getCachedDataSync(currentCacheKey)
        if (freshCached) {
          setOrders(freshCached)
          setLoading(false)
        } else if (!orders.length) {
          setLoading(true)
        }

        const data = await fetchUserOrders(activeUserId).catch(() => [])
        setOrders(Array.isArray(data) ? data : [])
        setLoading(false)
      } catch (error) {
        console.error('Error loading analytics:', error)
        setLoading(false)
      }
    }
    loadData()
  }, [userId])

  const availableMonths = useMemo(() => {
    const monthsMap = new Map()
    orders.forEach(order => {
      if (order.created_at) {
        const d = new Date(order.created_at)
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
        const label = d.toLocaleString('default', { month: 'long', year: 'numeric' })
        monthsMap.set(key, { key, label, year: d.getFullYear(), month: d.getMonth() })
      }
    })
    return Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key))
  }, [orders])

  const filteredOrders = useMemo(() => {
    if (selectedMonth === 'all') return orders
    const [year, month] = selectedMonth.split('-').map(Number)
    return orders.filter(order => {
      if (!order.created_at) return false
      const d = new Date(order.created_at)
      return d.getFullYear() === year && (d.getMonth() + 1) === month
    })
  }, [orders, selectedMonth])

  const monthlySpending = useMemo(() => {
    const spending = {}
    filteredOrders.forEach(order => {
      if (order.created_at) {
        const month = new Date(order.created_at).toLocaleString('default', { month: 'short', year: 'numeric' })
        spending[month] = (spending[month] || 0) + (order.total_amount || 0)
      }
    })
    return spending
  }, [filteredOrders])

  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    const ordersByStatus = {}
    filteredOrders.forEach(order => {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1
    })

    return {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      ordersByStatus,
      monthlySpending
    }
  }, [filteredOrders, monthlySpending])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <div style={{ color: '#6b7280', fontSize: 16 }}>Loading analytics...</div>
      </div>
    )
  }

  if (!orders.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          textAlign: 'center',
          padding: '60px 24px',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          borderRadius: 16
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h3 style={{ margin: 0, marginBottom: 8, fontSize: 24, fontWeight: 700 }}>No Orders Yet</h3>
        <p style={{ color: '#6b7280', margin: 0 }}>Start placing orders to see your analytics here.</p>
      </motion.div>
    )
  }

  const AnalyticsCard = ({ title, value, subtitle, icon, color, delay }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        padding: 24,
        background: `linear-gradient(135deg, ${color}10 0%, ${color}05 100%)`,
        border: `1px solid ${color}30`,
        borderRadius: 14,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 50, opacity: 0.08 }}>
        {icon}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: '#6b7280', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            {title}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: color, marginBottom: 4 }}>
            {value}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 32, opacity: 0.8 }}>{icon}</div>
      </div>
    </motion.div>
  )

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '32px',
          background: 'linear-gradient(135deg, #FF8C00 0%, #FFB347 100%)',
          borderRadius: 16,
          color: '#fff',
          marginBottom: 32,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1), transparent 40%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: 32, fontWeight: 800 }}>📊 Business Analytics</h2>
          <p style={{ margin: 0, opacity: 0.95, fontSize: 15 }}>Track your order trends and spending patterns</p>
        </div>
      </motion.div>

      {/* Month Selector Filter Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#ffffff',
        border: '1px solid #ebdcc4',
        borderRadius: 16,
        padding: '16px 24px',
        marginBottom: 24,
        boxShadow: '0 8px 24px rgba(53, 36, 20, 0.03)',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
          📅 Filter Analytics by Month
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            padding: '10px 16px',
            border: '1px solid #ebdcc4',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            color: '#475569',
            background: '#ffffff',
            cursor: 'pointer',
            minWidth: 220
          }}
        >
          <option value="all">All Time (Lifetime Summary)</option>
          {availableMonths.map(m => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 32 }}>
        <AnalyticsCard
          icon="📦"
          title="Total Orders"
          value={stats.totalOrders}
          subtitle={selectedMonth === 'all' ? 'All time' : 'Selected month'}
          color="#3b82f6"
          delay={0.1}
        />
        <AnalyticsCard
          icon="💰"
          title="Total Spending"
          value={`INR ${Number(stats.totalRevenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtitle={selectedMonth === 'all' ? 'Lifetime spending' : 'Selected month spending'}
          color="#8b5cf6"
          delay={0.15}
        />
        <AnalyticsCard
          icon="📈"
          title="Avg Order Value"
          value={`INR ${Number(stats.avgOrderValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtitle={selectedMonth === 'all' ? 'Lifetime average' : 'Selected month average'}
          color="#f59e0b"
          delay={0.2}
        />
        <AnalyticsCard
          icon="✅"
          title="Delivered"
          value={stats.ordersByStatus['Delivered'] || 0}
          subtitle={selectedMonth === 'all' ? 'All time' : 'Selected month'}
          color="#10b981"
          delay={0.25}
        />
      </div>

      {/* Order Status Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          padding: 28,
          marginBottom: 32,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      >
        <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 700, color: '#1f2937' }}>
          📋 Orders by Status
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {Object.entries(stats.ordersByStatus).map(([status, count], idx) => {
            const statusColors = {
              'Pending': { color: '#f59e0b', bg: '#fffbeb' },
              'Approved': { color: '#3b82f6', bg: '#eff6ff' },
              'Dispatched': { color: '#4CAF50', bg: '#E8F5E9' },
              'Delivered': { color: '#10b981', bg: '#f0fdf4' },
              'Cancelled': { color: '#ef4444', bg: '#fef2f2' }
            }
            const config = statusColors[status] || { color: '#6b7280', bg: '#f3f4f6' }
            const percentage = ((count / stats.totalOrders) * 100).toFixed(1)

            return (
              <motion.div
                key={status}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + idx * 0.05 }}
                style={{
                  padding: 20,
                  background: config.bg,
                  border: `1px solid ${config.color}20`,
                  borderRadius: 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: config.color }}>{status}</div>
                  <div style={{ color: '#6b7280', fontWeight: 600 }}>{percentage}%</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: config.color, marginBottom: 8 }}>
                  {count}
                </div>
                <div style={{ width: '100%', height: 6, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${percentage}%`,
                      background: config.color,
                      transition: 'width 0.5s ease'
                    }}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Monthly Spending */}
      {Object.keys(stats.monthlySpending).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            padding: 28,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 700, color: '#1f2937' }}>
            💳 Monthly Spending Trend
          </h3>
          <div style={{ display: 'grid', gap: 16 }}>
            {Object.entries(stats.monthlySpending).sort((a, b) => new Date(a[0]) - new Date(b[0])).map(([month, amount], idx) => {
              const maxAmount = Math.max(...Object.values(stats.monthlySpending))
              const percentage = (amount / maxAmount) * 100

              return (
                <motion.div
                  key={month}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 + idx * 0.05 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16
                  }}
                >
                  <div style={{ minWidth: 100, fontWeight: 600, color: '#1f2937', fontSize: 14 }}>
                    {month}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ width: '100%', height: 32, background: '#f3f4f6', borderRadius: 8, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${percentage}%`,
                          background: 'linear-gradient(90deg, #FF8C00 0%, #FFB347 100%)',
                          transition: 'width 0.5s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: 12,
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 12
                        }}
                      >
                        {percentage > 10 && `INR ${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ minWidth: 100, textAlign: 'right', fontWeight: 700, color: '#FF8C00', fontSize: 14 }}>
                    INR {Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
