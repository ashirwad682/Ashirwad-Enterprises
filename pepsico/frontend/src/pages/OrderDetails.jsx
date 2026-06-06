import React from 'react'
import { useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function OrderDetails() {
  const location = useLocation()
  const data = location.state

  if (!data) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ marginTop: 0 }}>Order Details</h3>
        <p>We couldn't find your order details. Go back to the dashboard.</p>
        <Link to="/dashboard" className="btn" style={{ display: 'inline-block', marginTop: 8 }}>Go to Dashboard</Link>
      </div>
    )
  }

  const { items = [], address = {}, subtotal = 0, discount = 0, total = 0, payment = {} } = data

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Order Placed</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Thank you! Your payment is successful.</p>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Summary</h3>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Items</span><span>{items.length}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>− ₹{discount.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Total Paid</span><span style={{ color: 'var(--brand-primary)' }}>₹{total.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Delivery Address</h3>
        <div style={{ whiteSpace: 'pre-line' }}>
          {address.address_line ? address.address_line + '\n' : ''}
          {address.district ? address.district + ', ' : ''}{address.state}
          {address.pincode ? ' - ' + address.pincode : ''}
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Items</h3>
        {items.map((it, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{it.name || it.product_name || `ID ${it.product_id}`}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>₹{Number(it.price).toFixed(2)} × {it.qty}</div>
            </div>
            <div style={{ fontWeight: 700 }}>₹{(Number(it.price) * it.qty).toFixed(2)}</div>
          </div>
        ))}
      </div>

      <Link to="/dashboard" className="btn" style={{ display: 'inline-block' }}>Back to Dashboard</Link>
    </motion.div>
  )
}
