import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'

const STATUS_SEQUENCE = ['pending', 'assigned', 'packed', 'dispatched', 'out_for_delivery', 'delivered']
const PICKUP_STATUS_SEQUENCE = ['pending', 'assigned', 'packed', 'delivered']

const normalizeStatus = (status, isPickupOrder = false) => {
  if (!status) return 'pending'
  const normalized = status.toString().toLowerCase().replace(/[-\s]+/g, '_')
  if (isPickupOrder && (normalized === 'dispatched' || normalized === 'out_for_delivery')) {
    return 'packed'
  }
  const allowed = isPickupOrder ? PICKUP_STATUS_SEQUENCE : STATUS_SEQUENCE
  return allowed.includes(normalized) ? normalized : 'pending'
}

const mapLogToStatus = (eventType = '', isPickupOrder = false) => {
  if (!eventType) return null
  let mapped = null
  if (eventType.startsWith('status_')) mapped = eventType.replace('status_', '')
  else if (eventType === 'delivery_started') mapped = 'out_for_delivery'
  if (eventType === 'delivery_completed') return 'delivered'
  if (!mapped) return null
  if (isPickupOrder && (mapped === 'dispatched' || mapped === 'out_for_delivery')) return 'packed'
  return mapped
}

const JOURNEY_STAGES = [
  { key: 'packed', label: 'Packed', icon: '📦', description: 'Order is being prepared' },
  { key: 'dispatched', label: 'Dispatched', icon: '🚚', description: 'Order shipped from warehouse' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🛵', description: 'On the way to you' },
  { key: 'delivered', label: 'Delivered', icon: '🎉', description: 'Delivery confirmed via OTP' }
]

const PICKUP_JOURNEY_STAGES = [
  { key: 'packed', label: 'Packed', icon: '📦', description: 'Order is prepared for customer pickup' },
  { key: 'delivered', label: 'Delivered', icon: '🎉', description: 'Pickup completed and confirmed via OTP' }
]

export default function DeliveryJourneyModal({ order, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDeliveryLogs()
  }, [order.id])

  const loadDeliveryLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_logs')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      console.error('Failed to load delivery logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const isPickupOrder = String(order?.shipping_method || '').toLowerCase() === 'pickup_drive' || Boolean(order?.pickup_order)
  const statusSequence = isPickupOrder ? PICKUP_STATUS_SEQUENCE : STATUS_SEQUENCE
  const journeyStages = isPickupOrder ? PICKUP_JOURNEY_STAGES : JOURNEY_STAGES
  const normalizedStatus = normalizeStatus(order.delivery_status, isPickupOrder)
  const currentRank = statusSequence.indexOf(normalizedStatus)
  const modalTitle = isPickupOrder ? '🏬 Pickup Journey' : '📦 Delivery Journey'
  const totalAmount = Number(order?.total_amount || 0)
  const codAmountReceived = Number(order?.cod_amount_received || 0)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card"
        style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: '#0f172a' }}>{modalTitle}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: '#999'
            }}
          >
            ×
          </button>
        </div>

        {/* Order Summary */}
        <div style={{
          background: '#f9fafb',
          padding: 16,
          borderRadius: 12,
          marginBottom: 24,
          borderLeft: '4px solid #FF8C00'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            Order {order.id.slice(0, 8).toUpperCase()}
          </div>
          <div style={{ fontSize: 12, color: '#556070' }}>
            Amount: <strong>₹{totalAmount.toFixed(2)}</strong>
            {order.cod_amount_received && ` | Cash Received: ₹${codAmountReceived.toFixed(2)}`}
          </div>
        </div>

        {/* Journey Stages */}
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ margin: '0 0 16px', color: '#0f172a', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Journey Progress
          </h4>

          <div style={{ position: 'relative' }}>
            {journeyStages.map((stage, idx) => {
              const stageLog = logs.find(log => mapLogToStatus(log.event_type, isPickupOrder) === stage.key)
              const stageRank = statusSequence.indexOf(stage.key)
              const isCompleted = stageRank !== -1 && currentRank >= stageRank
              const isCurrent = stage.key === normalizedStatus

              return (
                <motion.div
                  key={stage.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  style={{
                    display: 'flex',
                    gap: 16,
                    marginBottom: 16,
                    position: 'relative'
                  }}
                >
                  {/* Connector Line */}
                  {idx < journeyStages.length - 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 20,
                        top: 56,
                        width: 2,
                        height: 40,
                        background: isCompleted ? '#10b981' : '#e5e7eb'
                      }}
                    />
                  )}

                  {/* Node */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: isCompleted ? '#10b981' : isCurrent ? '#8b5cf6' : '#e5e7eb',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      flexShrink: 0,
                      boxShadow: isCurrent ? '0 0 0 4px rgba(139, 92, 246, 0.2)' : 'none'
                    }}
                  >
                    {stage.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingTop: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                      {stage.label}
                      {isCompleted && !isCurrent && <span style={{ color: '#10b981', marginLeft: 8 }}>✓</span>}
                      {isCurrent && <span style={{ color: '#8b5cf6', marginLeft: 8 }}>⏳</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#556070', marginBottom: 8 }}>
                      {stage.description}
                    </div>

                    {stageLog && (
                      <div style={{
                        fontSize: 11,
                        color: '#999',
                        background: '#f3f4f6',
                        padding: '6px 8px',
                        borderRadius: 4,
                        display: 'inline-block'
                      }}>
                        {new Date(stageLog.created_at).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Delivery Logs Timeline */}
        {logs.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 16px', color: '#0f172a', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Event Log
            </h4>

            <div style={{ background: '#f9fafb', borderRadius: 12, padding: 0, maxHeight: 300, overflowY: 'auto' }}>
              {logs.map((log, idx) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    padding: '12px 16px',
                    borderBottom: idx < logs.length - 1 ? '1px solid #e5e7eb' : 'none',
                    fontSize: 12
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', minWidth: 100 }}>
                      {log.event_type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span style={{ color: '#999' }}>
                      {new Date(log.created_at).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {log.event_details && (
                    <div style={{ color: '#556070', fontSize: 11 }}>
                      {Object.entries(log.event_details).map(([key, value]) => (
                        <div key={key}>
                          {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 24,
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #FF8C00 0%, #FFB347 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  )
}
