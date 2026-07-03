import React from 'react'
import { motion } from 'framer-motion'

export default function DeliveryProgressTracker({ order }) {
  const accent = '#f97316'
  const accentDark = '#9a3412'
  const accentSoft = '#fff7ed'
  const borderTone = '#e2e8f0'
  const mutedText = '#64748b'
  const titleText = '#0f172a'
  const stages = [
    { key: 'packed', label: 'Packed', status: 'CONFIRMED', icon: '📦' },
    { key: 'dispatched', label: 'Dispatched', status: 'NEXT UP', icon: '🚚' },
    { key: 'out_for_delivery', label: 'Out for Delivery', status: '', icon: '🛵' },
    { key: 'delivered', label: 'Delivered', status: '', icon: '🎉' }
  ]

  const normalizeStatus = (status) => {
    if (!status) return 'pending'
    const normalized = status.toString().toLowerCase().replace(/[-\s]+/g, '_')
    return ['pending', 'assigned', 'packed', 'dispatched', 'out_for_delivery', 'delivered'].includes(normalized)
      ? normalized
      : 'pending'
  }

  const statusMap = {
    pending: 'packed',
    assigned: 'packed',
    packed: 'packed',
    dispatched: 'dispatched',
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered'
  }

  const normalizedStatus = normalizeStatus(order.delivery_status)
  const currentStatus = statusMap[normalizedStatus] || 'packed'
  const currentStageIndex = stages.findIndex(s => s.key === currentStatus)
  
  // When delivered, all stages are complete (progress = 100%)
  const isFullyDelivered = normalizedStatus === 'delivered'
  const progressPercent = isFullyDelivered ? 100 : Math.max(0, Math.min(100, (currentStageIndex / (stages.length - 1)) * 100))
  const completedPercent = isFullyDelivered ? 100 : Math.max(0, ((currentStageIndex - 1) / (stages.length - 1)) * 100)
  const inProgressPercent = isFullyDelivered ? 0 : Math.max(0, progressPercent - completedPercent)

  // Responsive check
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 600

  return (
    <div style={{ 
      padding: isMobile ? '20px 16px' : '30px 26px', 
      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', 
      borderRadius: 20, 
      marginTop: 20, 
      border: `1px solid ${borderTone}`,
      boxShadow: '0 14px 30px rgba(15, 23, 42, 0.08)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: accent,
            boxShadow: `0 0 0 6px ${accentSoft}`
          }} />
          <div>
            <div style={{ fontWeight: 800, color: titleText, fontSize: isMobile ? 12 : 13, letterSpacing: 0.7, textTransform: 'uppercase' }}>
              Delivery Milestones
            </div>
            <div style={{ fontSize: 12, color: mutedText, marginTop: 4 }}>
              Track each stage from packing to doorstep delivery.
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: mutedText, fontWeight: 700 }}>
          Stage {currentStageIndex + 1} of {stages.length}
        </div>
      </div>

      <div style={{ background: '#eef2f7', borderRadius: 999, height: 7, overflow: 'hidden', marginBottom: 24, position: 'relative' }}>
        <div style={{ height: '100%', width: `${completedPercent}%`, background: '#22c55e', transition: 'width 0.5s ease' }} />
        <div style={{ height: '100%', width: `${inProgressPercent}%`, background: accent, transition: 'width 0.5s ease', position: 'absolute', left: `${completedPercent}%`, top: 0, boxShadow: '0 4px 10px rgba(15, 23, 42, 0.12)' }} />
      </div>

      {/* Timeline */}
      <div style={{ 
        position: 'relative', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        overflowX: isMobile ? 'auto' : 'visible',
        paddingBottom: isMobile ? '10px' : '0'
      }}>
        {/* Connecting Line */}
        <div style={{
          position: 'absolute',
          top: isMobile ? 30 : 34,
          left: isMobile ? '10%' : '12.5%',
          right: isMobile ? '10%' : '12.5%',
          height: 3,
          background: borderTone,
          zIndex: 0
        }}>
          <div
            style={{
              height: '100%',
              width: `${completedPercent}%`,
              background: '#22c55e',
              transition: 'width 0.5s ease'
            }}
          />
          <div
            style={{
              height: '100%',
              width: `${inProgressPercent}%`,
              background: accent,
              transition: 'width 0.5s ease',
              position: 'absolute',
              left: `${completedPercent}%`,
              top: 0
            }}
          />
        </div>

        {/* Stage Nodes */}
        {stages.map((stage, idx) => {
          const isActive = idx <= currentStageIndex
          const isCurrent = idx === currentStageIndex && !isFullyDelivered
          const statusTag = isCurrent ? 'In Progress' : isActive ? 'Completed' : 'Upcoming'
          const tagStyle = isCurrent
            ? { background: accentSoft, color: accentDark }
            : isActive
              ? { background: '#dcfce7', color: '#15803d' }
              : { background: '#f1f5f9', color: '#64748b' }

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: isMobile ? 8 : 12,
                flex: 1,
                position: 'relative',
                zIndex: 1,
                minWidth: isMobile ? '70px' : 'auto'
              }}
            >
              {/* Circle */}
              <motion.div
                animate={{
                  scale: isCurrent ? [1, 1.1, 1] : 1
                }}
                transition={{
                  scale: isCurrent ? { duration: 2, repeat: Infinity } : {}
                }}
                style={{
                  width: isMobile ? 56 : 64,
                  height: isMobile ? 56 : 64,
                  borderRadius: '50%',
                  background: isActive ? '#fff' : '#f8fafc',
                  border: isCurrent ? `2px solid ${accent}` : isActive ? '2px solid #22c55e' : `2px solid ${borderTone}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? 24 : 28,
                  color: isCurrent ? accentDark : isActive ? '#15803d' : '#cbd5e1',
                  boxShadow: isActive ? '0 8px 18px rgba(15, 23, 42, 0.1)' : 'none',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{
                  width: isMobile ? 42 : 48,
                  height: isMobile ? 42 : 48,
                  borderRadius: '50%',
                  background: isCurrent
                    ? `linear-gradient(135deg, ${accentSoft} 0%, #fff 100%)`
                    : isActive
                      ? 'linear-gradient(135deg, #dcfce7 0%, #ffffff 100%)'
                      : '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  border: isCurrent ? `1px solid ${accent}` : isActive ? '1px solid #22c55e' : `1px solid ${borderTone}`
                }}>
                  {isActive && !isCurrent ? '✓' : stage.icon}
                </div>
              </motion.div>

              {/* Label */}
              <div style={{ textAlign: 'center', maxWidth: isMobile ? '70px' : '120px' }}>
                <div
                  style={{
                    fontSize: isMobile ? 11 : 13,
                    fontWeight: 700,
                    color: isActive ? titleText : '#94a3b8',
                    marginBottom: idx < 2 ? (isMobile ? 4 : 6) : 0,
                    transition: 'all 0.3s ease',
                    lineHeight: 1.2
                  }}
                >
                  {stage.label}
                </div>
                <div
                  style={{
                    fontSize: isMobile ? 8 : 9,
                    padding: isMobile ? '2px 8px' : '3px 10px',
                    borderRadius: 999,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    ...tagStyle
                  }}
                >
                  {statusTag}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
