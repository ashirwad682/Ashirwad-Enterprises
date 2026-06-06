import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAdminAuth } from '../../context/AdminAuthContext'

const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')

export default function CouponsTab({ managerMode = false }) {
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

  const { adminKey } = useAdminAuth ? useAdminAuth() : { adminKey: null }
  const managerToken = localStorage.getItem('manager_token')
  const authToken = managerMode ? managerToken : adminKey
  const authHeader = managerMode
    ? { 'x-manager-token': managerToken }
    : { 'x-admin-api-key': adminKey }
  const couponPath = managerMode ? '/api/manager/coupons' : '/api/admin/coupons'

  useEffect(() => {
    if (!authToken) return
    fetchCoupons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerMode, adminKey, managerToken])

  async function fetchCoupons() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}${couponPath}`, { headers: authHeader })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('Failed to fetch coupons:', body)
        throw new Error(body.error || `Failed to fetch coupons (Status: ${res.status})`)
      }
      const data = await res.json()
      setCoupons(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Fetch coupons error:', err)
      const errorMsg = String(err?.message || '').includes('relation "coupons" does not exist')
        ? 'Coupons table does not exist. Please run the ADD_COUPONS_TABLE.sql script in Supabase SQL Editor.'
        : (err?.message || 'Failed to fetch coupons')
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
        res = await fetch(`${API_BASE}${couponPath}/${editingCoupon.code}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...authHeader
          },
          body: JSON.stringify(payload)
        })
      } else {
        payload.code = formData.code.trim().toUpperCase()
        res = await fetch(`${API_BASE}${couponPath}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeader
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
      setError(err?.message || 'Failed to save coupon. Check console for details.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(code) {
    if (!window.confirm(`Delete coupon ${code}?`)) return

    try {
      const res = await fetch(`${API_BASE}${couponPath}/${code}`, {
        method: 'DELETE',
        headers: authHeader
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to delete coupon')
      }

      await fetchCoupons()
    } catch (err) {
      window.alert('Error: ' + err.message)
    }
  }

  async function toggleActive(coupon) {
    try {
      const res = await fetch(`${API_BASE}${couponPath}/${coupon.code}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({ active: !coupon.active })
      })

      if (!res.ok) throw new Error('Failed to update coupon')
      await fetchCoupons()
    } catch (err) {
      window.alert('Error: ' + err.message)
    }
  }

  if (loading) return <div>Loading coupons...</div>

  return (
    <div>
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: 16,
            marginBottom: 16,
            background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontWeight: 600
          }}
        >
          {'⚠️ '}{error}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
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
                {submitting ? '💾 Saving...' : editingCoupon ? '💾 Update Coupon' : '✓ Create Coupon'}
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              padding: 60,
              textAlign: 'center',
              color: '#999',
              background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)',
              borderRadius: 12,
              border: '2px dashed #ddd'
            }}
          >
            {'🎟️ No coupons yet. Click "Create New Coupon" to get started!'}
          </motion.div>
        ) : (
          coupons.map((coupon, idx) => {
            const isExpired = new Date(coupon.valid_to) < new Date()

            return (
              <motion.div
                key={coupon.code}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: coupon.active && !isExpired ? 'linear-gradient(90deg, #FF8C00, #FFB347)' : '#ddd'
                  }}
                />

                <div style={{ paddingTop: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: '18px', color: '#1f2937' }}>{coupon.code}</h4>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: 11,
                        fontWeight: 700,
                        background: coupon.active ? '#dcfce7' : '#fee2e2',
                        color: coupon.active ? '#166534' : '#991b1b'
                      }}
                    >
                      {coupon.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', color: '#1a202c', marginBottom: 6, fontWeight: '700' }}>
                    {coupon.type === 'percent' ? `${coupon.value}% off` : `₹${coupon.value} off`}
                  </div>

                  {coupon.min_amount > 0 && (
                    <div style={{ color: '#666', fontSize: 13, marginBottom: '8px' }}>
                      {'📋 Minimum order: ₹'}{coupon.min_amount}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: '#475569', display: 'flex', gap: '20px' }}>
                    <span>{'📅 '}{new Date(coupon.valid_from).toLocaleDateString()}</span>
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
