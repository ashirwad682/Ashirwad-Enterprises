import React, { useEffect, useMemo, useState } from 'react'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useMediaQuery } from '../../lib/useMediaQuery'

const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')

const EMPTY_FORM = {
  name: '',
  category: '',
  price: '',
  stock: '',
  description: '',
  image_url: ''
}

export default function ProductsTab({ managerMode = false }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [mediaName, setMediaName] = useState('')

  const { adminKey } = useAdminAuth ? useAdminAuth() : { adminKey: null }
  const managerToken = localStorage.getItem('manager_token')
  const isTablet = useMediaQuery('(max-width: 1024px)')
  const isMobile = useMediaQuery('(max-width: 640px)')

  const canLoad = managerMode ? Boolean(managerToken) : Boolean(adminKey)

  useEffect(() => {
    if (!canLoad) return
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, managerToken, managerMode])

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return products
    return products.filter((product) => {
      const haystack = [product.name, product.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [products, searchQuery])

  async function fetchProducts() {
    setLoading(true)
    setError(null)

    try {
      const url = managerMode ? `${API_BASE}/api/manager/products` : `${API_BASE}/api/admin/products`
      const headers = managerMode
        ? { 'x-manager-token': managerToken }
        : { 'x-admin-api-key': adminKey }

      const res = await fetch(url, { headers })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch products')
      }

      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      const payload = {
        name: form.name,
        category: form.category,
        price: parseFloat(form.price),
        stock: parseInt(form.stock, 10),
        description: form.description,
        image_url: form.image_url
      }

      const method = editing ? 'PUT' : 'POST'
      const url = managerMode
        ? `${API_BASE}/api/manager/products${editing ? `/${editing}` : ''}`
        : `${API_BASE}/api/admin/products${editing ? `/${editing}` : ''}`

      const headers = managerMode
        ? { 'Content-Type': 'application/json', 'x-manager-token': managerToken }
        : { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey }

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save product')
      }

      setEditing(null)
      setForm(EMPTY_FORM)
      setMediaName('')
      fetchProducts()
    } catch (err) {
      alert(`Error saving product: ${err.message || 'Unknown error'}`)
    }
  }

  async function handleDelete(id) {
    if (managerMode) return
    if (!window.confirm('Delete this product?')) return

    try {
      const res = await fetch(`${API_BASE}/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-api-key': adminKey }
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to delete product')
      }
      fetchProducts()
    } catch (err) {
      alert(`Error deleting product: ${err.message || 'Unknown error'}`)
    }
  }

  function editProduct(product) {
    setEditing(product.id)
    setForm({
      name: product.name || '',
      category: product.category || '',
      price: String(product.price || ''),
      stock: String(product.stock || ''),
      description: product.description || '',
      image_url: product.image_url || ''
    })
    setMediaName(product.image_url ? 'Saved image' : '')
  }

  function compressImage(dataUrl, maxWidth = 400, maxHeight = 300, quality = 0.5) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(dataUrl)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        const compressed = canvas.toDataURL('image/jpeg', quality)
        const sizeKB = Math.round(compressed.length / 1024)

        if (sizeKB > 1024) {
          canvas.width = Math.max(220, width * 0.7)
          canvas.height = Math.max(180, height * 0.7)
          const ctx2 = canvas.getContext('2d')
          if (!ctx2) {
            resolve(compressed)
            return
          }
          ctx2.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.35))
          return
        }

        resolve(compressed)
      }
      img.src = dataUrl
    })
  }

  function handleMediaFile(file) {
    if (!file) return

    setMediaName(file.name)
    const reader = new FileReader()
    reader.onload = async () => {
      const originalDataUrl = reader.result
      const compressedDataUrl = await compressImage(originalDataUrl)
      setForm((prev) => ({ ...prev, image_url: compressedDataUrl || '' }))
    }
    reader.readAsDataURL(file)
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) handleMediaFile(file)
  }

  if (loading) {
    return <div style={{ padding: 18, color: '#64748b' }}>Loading products...</div>
  }

  if (error) {
    return (
      <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, color: '#be123c', padding: 16, fontWeight: 600 }}>
        Failed to load products: {error}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.4px' }}>Product Management</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#3b82f6', marginTop: 4 }}>{editing ? 'Edit Product' : 'Add New Product'}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1.4fr 0.8fr', gap: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: isMobile ? 18 : 24, border: '1px solid #e5e7eb', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', fontWeight: 700 }}>≡</div>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>Product Details</div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Product Name</label>
              <input
                placeholder="e.g. Pepsi 2L Bottle"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, background: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, background: '#fff' }}
              >
                <option value="">Select category</option>
                <option value="Beverages">Beverages</option>
                <option value="Snacks">Snacks</option>
                <option value="Packaged Foods">Packaged Foods</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Product Description</label>
              <textarea
                placeholder="Enter detailed product description..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, background: '#fff', minHeight: 120, resize: 'vertical' }}
              />
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Pricing & Inventory Configuration</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Pricing (per unit)</label>
                  <input
                    type="number"
                    placeholder="1140.00"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, background: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Stock (units)</label>
                  <input
                    type="number"
                    placeholder="500"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, background: '#fff' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
              <button
                onClick={handleSave}
                disabled={!form.name || !form.category || !form.price || !form.stock}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: 0,
                  background: (!form.name || !form.category || !form.price || !form.stock) ? '#cbd5e1' : '#5b5bd6',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: (!form.name || !form.category || !form.price || !form.stock) ? 'not-allowed' : 'pointer',
                  boxShadow: (!form.name || !form.category || !form.price || !form.stock) ? 'none' : '0 10px 20px rgba(91,91,214,0.2)',
                  opacity: (!form.name || !form.category || !form.price || !form.stock) ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {editing ? 'Update Product' : 'Create Product'}
              </button>
              <button
                onClick={() => {
                  setEditing(null)
                  setForm(EMPTY_FORM)
                  setMediaName('')
                }}
                style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🖼️</div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>Product Media</div>
            </div>
            <label
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${isDragging ? '#6366f1' : '#c7d2fe'}`,
                background: isDragging ? '#eef2ff' : '#f8fafc',
                borderRadius: 14,
                padding: 20,
                display: 'grid',
                gap: 8,
                alignItems: 'center',
                justifyItems: 'center',
                textAlign: 'center',
                cursor: 'pointer'
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleMediaFile(e.target.files?.[0])}
                style={{ display: 'none' }}
              />
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#4f46e5' }}>📷</div>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>Drag & Drop or Click to Upload</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>PNG, JPG up to 5MB</div>
              {mediaName && <div style={{ fontSize: 11, color: '#475569' }}>{mediaName}</div>}
            </label>
          </div>

          <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.6px' }}>LIVE CATALOGUE PREVIEW</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Distributor View</div>
            </div>
            <div style={{ marginTop: 12, borderRadius: 18, background: '#f8fafc', padding: 16, display: 'grid', gap: 12 }}>
              <div
                style={{
                  height: 180,
                  borderRadius: 14,
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  border: form.image_url ? 'none' : '1px solid #e5e7eb'
                }}
              >
                {form.image_url ? (
                  <img src={form.image_url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }} />
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>No Image</div>
                )}
              </div>
              <div style={{ display: 'grid', gap: 8, padding: '6px 4px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>{form.category || 'Category'}</div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 18 }}>{form.name || 'Product Name'}</div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                  {form.description ? form.description.slice(0, 90) : 'Add a product description to show key details here.'}
                  {form.description && form.description.length > 90 ? '…' : ''}
                </div>
              </div>
              <div style={{ height: 1, background: '#e2e8f0' }} />
              <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Unit Price</div>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 18 }}>₹{form.price || '0'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: Number(form.stock || 0) > 0 ? '#16a34a' : '#dc2626', background: Number(form.stock || 0) > 0 ? '#dcfce7' : '#fee2e2', padding: '4px 10px', borderRadius: 999 }}>
                    {Number(form.stock || 0) > 0 ? 'In Stock' : 'Out of Stock'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{Number(form.stock || 0) || 0} Units</div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 10, fontStyle: 'italic' }}>This is how the distributor will see the product card.</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
          <div style={{ fontWeight: 800, color: '#0f172a' }}>Existing Inventory</div>
          <div style={{ display: 'flex', gap: 10, width: isMobile ? '100%' : 'auto' }}>
            <input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, background: '#fff', minWidth: 0, width: '100%' }}
            />
            <button style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>⚙️</button>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, letterSpacing: '0.4px', color: '#64748b' }}>PRODUCT</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, letterSpacing: '0.4px', color: '#64748b' }}>CATEGORY</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, letterSpacing: '0.4px', color: '#64748b' }}>PRICE / UNIT</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, letterSpacing: '0.4px', color: '#64748b' }}>STOCK LEVEL</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, letterSpacing: '0.4px', color: '#64748b' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8' }}>No products found.</td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const stockValue = Number(product.stock || 0)
                  const stockRatio = Math.min(stockValue / 500, 1)
                  return (
                    <tr key={product.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f1f5f9', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: 14 }}>🥤</span>
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{product.name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '4px 8px', borderRadius: 999 }}>{product.category || 'General'}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#0f172a', fontWeight: 700 }}>₹{Number(product.price || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div style={{ height: 4, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                            <div style={{ width: `${stockRatio * 100}%`, height: '100%', background: stockValue > 50 ? '#22c55e' : stockValue > 0 ? '#f59e0b' : '#ef4444' }} />
                          </div>
                          <div style={{ fontSize: 11, color: stockValue > 50 ? '#16a34a' : stockValue > 0 ? '#d97706' : '#dc2626' }}>
                            {stockValue} Units{stockValue > 0 && stockValue < 60 ? ' (Low)' : ''}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <button onClick={() => editProduct(product)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>✏️</button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            disabled={managerMode}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #fee2e2',
                              background: managerMode ? '#fff' : '#fff5f5',
                              color: managerMode ? '#cbd5e1' : '#dc2626',
                              cursor: managerMode ? 'not-allowed' : 'pointer'
                            }}
                            title={managerMode ? 'Delete is only available in Admin panel' : 'Delete product'}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
