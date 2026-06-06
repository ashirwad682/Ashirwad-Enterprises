import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { fetchOffers } from '../api/client'
import { useMediaQuery } from '../lib/useMediaQuery'

export default function DashboardHome() {
  const [offers, setOffers] = useState([])
  const [offersLoading, setOffersLoading] = useState(true)
  const [offersError, setOffersError] = useState(null)
  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const navigate = useNavigate()
  const isCompact = useMediaQuery('(max-width: 1024px)')

  // Fetch user data and orders
  useEffect(() => {
    const fetchUserAndOrders = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (authUser) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single()
          
          setUser(userData || { email: authUser.email })

          // Fetch orders for this user
          const { data: ordersData } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })

          if (ordersData) {
            setOrders(ordersData)
            // Set recent activity from orders
            setRecentActivity(ordersData.slice(0, 3).map(order => ({
              id: order.id,
              type: 'order',
              title: `Order #${order.order_id || order.id.slice(0, 8).toUpperCase()}`,
              description: `Order status: ${order.status}`,
              status: order.status,
              timestamp: order.created_at,
              details: order.status === 'Delivered' 
                ? 'Delivered to Main Office reception.'
                : order.status === 'Dispatched'
                ? 'Package has left the warehouse.'
                : order.status === 'Approved'
                ? 'Payment verified. Packing in progress.'
                : order.status
            })))
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err)
      }
    }

    fetchUserAndOrders()
  }, [])

  // Fetch offers
  useEffect(() => {
    const loadOffers = async () => {
      try {
        setOffersLoading(true)
        setOffersError(null)
        const offersResponse = await fetchOffers()
        const activeOffers = Array.isArray(offersResponse) ? offersResponse : []
        setOffers(activeOffers)
      } catch (offerErr) {
        console.error('Error fetching offers:', offerErr)
        setOffersError('Unable to load admin offers right now.')
      } finally {
        setOffersLoading(false)
      }
    }
    loadOffers()
  }, [])

  const getStatusBadge = (status) => {
    const badges = {
      'Pending': { bg: '#fef3c7', color: '#92400e', label: 'PENDING' },
      'Approved': { bg: '#dbeafe', color: '#1e40af', label: 'PROCESSING' },
      'Dispatched': { bg: '#fce7f3', color: '#831843', label: 'DISPATCHED' },
      'Delivered': { bg: '#d1fae5', color: '#065f46', label: 'DELIVERED' }
    }
    return badges[status] || badges['Pending']
  }

  const getActivityIcon = (status) => {
    switch(status) {
      case 'Delivered': return '✅'
      case 'Dispatched': return '🚚'
      case 'Approved': return '⏳'
      default: return '📦'
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Two Column Layout - Offers & Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'minmax(0, 2fr) minmax(340px, 1fr)', gap: 20 }}>
        {/* Admin Offers Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            background: 'rgba(255, 253, 248, 0.95)',
            borderRadius: 32,
            border: '1px solid #eedfca',
            padding: isCompact ? 18 : 28,
            display: 'grid',
            gap: 18,
            boxShadow: '0 18px 34px rgba(57, 44, 27, 0.07)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: '"Nunito Sans", "Segoe UI", sans-serif' }}>Admin Offers</h3>
            <span style={{ fontSize: 13, color: '#9da9b8', fontWeight: 600 }}>Curated centrally — refreshed by the admin team</span>
          </div>

          {offersLoading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading offers…</div>
          ) : offersError ? (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>
              {offersError}
            </div>
          ) : offers.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {offers.map((offer, index) => {
                const discountValue = Number(offer.discountValue || 0)
                const discountLabel = offer.discountType === 'percent'
                  ? `${discountValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}% off`
                  : `₹${discountValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })} off`

                return (
                  <div key={`${offer.id}-${index}`} style={{
                    padding: 16,
                    borderRadius: 16,
                    background: '#fffdf8',
                    border: '1px solid #eddcc2',
                    display: 'grid',
                    gap: 10
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{offer.title || 'Special offer'}</div>
                    <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{discountLabel}</div>
                    <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{offer.message}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{
              padding: isCompact ? '30px 18px' : '44px 36px',
              textAlign: 'center',
              borderRadius: 24,
              background: '#fffdfa',
              border: '2px dashed #f0cf9f'
            }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>🪔🎁</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8, lineHeight: 1.2 }}>No active festive offers right now</div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, maxWidth: 640, margin: '0 auto' }}>
                We're currently curating some exciting deals from Ashirwad Enterprises. Check back soon for exclusive distributor discounts!
              </div>
            </div>
          )}
        </motion.section>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            background: 'rgba(255, 253, 248, 0.95)',
            borderRadius: 32,
            border: '1px solid #eedfca',
            padding: isCompact ? 18 : 28,
            display: 'grid',
            gap: 16,
            boxShadow: '0 18px 34px rgba(57, 44, 27, 0.07)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: '"Nunito Sans", "Segoe UI", sans-serif' }}>Recent Activity</h3>
            <a
              href="#"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#f29a2c',
                textDecoration: 'none',
                cursor: 'pointer',
                letterSpacing: '0.5px'
              }}
            >
              VIEW ALL
            </a>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {recentActivity.length === 0 ? (
              <div style={{
                padding: 20,
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 13
              }}>
                No recent activity yet
              </div>
            ) : (
              recentActivity.map((activity, idx) => {
                const badge = getStatusBadge(activity.status)
                const timeAgo = new Date(activity.timestamp)
                const now = new Date()
                const diffHours = Math.floor((now - timeAgo) / (1000 * 60 * 60))
                const diffDays = Math.floor((now - timeAgo) / (1000 * 60 * 60 * 24))
                const timeLabel = diffHours < 1 ? 'Just now' : diffHours < 24 ? `${diffHours}h ago` : `${diffDays}d ago`

                return (
                  <div key={activity.id} style={{ display: 'flex', gap: 12 }}>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      background: badge.bg,
                      color: badge.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      flexShrink: 0
                    }}>
                      {getActivityIcon(activity.status)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                          {activity.title}
                        </div>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 999,
                          fontSize: 9,
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color
                        }}>
                          {badge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                        {activity.details}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {timeLabel}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <button
            style={{
              padding: '14px 18px',
              border: '1px solid #dce4ee',
              background: '#fefefe',
              color: '#43566d',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'center',
              borderRadius: 14
            }}
          >
            📄 Download Monthly Report
          </button>
        </motion.div>
      </div>
    </div>
  )
}
