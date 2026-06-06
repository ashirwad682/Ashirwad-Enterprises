import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function CashValidationModal({ order, onClose, onValidate }) {
  const [cashReceived, setCashReceived] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const totalDue = Number(order?.total_amount ?? 0) || 0
  const formattedTotal = totalDue.toFixed(2)

  useEffect(() => {
    setCashReceived('')
    setError(null)
  }, [order?.id])

  const handleValidate = async () => {
    if (cashReceived === '') {
      setError('Please enter the cash amount received')
      return
    }

    const numericValue = Number(cashReceived)
    if (Number.isNaN(numericValue)) {
      setError('Enter a valid number')
      return
    }

    setLoading(true)
    setError(null)

    const result = await onValidate(numericValue, order)
    
    if (!result.success) {
      setError(result.error)
    }
    
    setLoading(false)
  }

  const paymentDescriptor = (order?.payment_method || order?.order_type || '').toString().toUpperCase()
  const isCOD = paymentDescriptor === 'COD'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card"
        style={{ width: '90%', maxWidth: 400, padding: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: 8, color: '#0f172a' }}>Confirm Delivery</h2>
        
        {isCOD ? (
          <>
            <p style={{ color: '#556070', marginBottom: 24, lineHeight: 1.5 }}>
              Record the cash collected before completing delivery. The amount must match the invoice total shown below. This confirmation is required before OTP verification.
            </p>

            <div className="form-group">
              <label className="form-label">Order Type</label>
              <div style={{ padding: 12, background: '#fff3cd', borderRadius: 8, color: '#856404', fontWeight: 600 }}>
                💵 Cash on Delivery (COD)
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Total Bill Amount</label>
              <div style={{ padding: 12, background: '#f3f4f6', borderRadius: 8, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                ₹{formattedTotal}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Cash Received (₹)*</label>
              <input
                type="number"
                placeholder="Enter amount"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                disabled={loading}
                step="0.01"
                min="0"
                style={{ fontSize: 16 }}
              />
            </div>

            {error && (
              <div className="alert error" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={onClose}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#f3f4f6',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleValidate}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: loading ? '#ccc' : 'linear-gradient(135deg, #FF8C00 0%, #FFB347 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: '#556070', marginBottom: 24 }}>
              This is a prepaid order. Proceeding to OTP verification...
            </p>
            <div className="form-group">
              <label className="form-label">Order Type</label>
              <div style={{ padding: 12, background: '#d1fae5', borderRadius: 8, color: '#065f46', fontWeight: 600 }}>
                ✓ Prepaid Order
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#f3f4f6',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => onValidate(0, order)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #FF8C00 0%, #FFB347 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Proceed to OTP
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
