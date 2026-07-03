import React, { useEffect, useMemo, useState } from 'react'
import { fetchProducts, fetchProductSlabs } from '../api/client'
import { useCart } from '../context/CartContext'
import { motion } from 'framer-motion'
import FloatingCart from '../components/FloatingCart'
import { useMediaQuery } from '../lib/useMediaQuery'

const BRAND_MATCHERS = [
  { label: 'Pepsi', regex: /pepsi/i },
  { label: 'Mountain Dew', regex: /mountain\s*dew/i },
  { label: 'Lays', regex: /\blays\b/i },
  { label: 'Mirinda', regex: /\bmirinda\b/i },
  { label: '7UP', regex: /7up/i },
  { label: 'Aquafina', regex: /aquafina/i },
  { label: 'Sting', regex: /\bsting\b/i },
  { label: 'Gatorade', regex: /gatorade/i },
  { label: 'Tropicana', regex: /tropicana/i },
  { label: 'Quaker', regex: /quaker/i }
]

function deriveBrand(name = '') {
  const match = BRAND_MATCHERS.find((item) => item.regex.test(name))
  if (match) return match.label
  const fallback = name.split(' ').filter(Boolean)[0]
  return fallback ? `${fallback.charAt(0).toUpperCase()}${fallback.slice(1)}` : 'Other'
}

function buildSku(product) {
  const name = product?.name || ''
  const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  const prefix = parts.slice(0, 3).map((part) => part.slice(0, 3).toUpperCase()).join('-') || 'PROD'
  const sizeMatch = name.match(/(\d+)\s*(ml|l|kg|g)/i)
  const size = sizeMatch ? `${sizeMatch[1]}${sizeMatch[2].toUpperCase()}` : (product?.id || '').slice(0, 4).toUpperCase()
  return `SKU-${prefix}-${size || 'GEN'}`
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function getSlabKey(slab) {
  if (!slab || typeof slab !== 'object') return ''
  if (slab.id !== undefined && slab.id !== null && slab.id !== '') {
    return `id:${slab.id}`
  }
  return `min:${slab.min_quantity || 0}|type:${slab.discount_type || ''}|val:${slab.discount_value || 0}|start:${slab.start_date || ''}|end:${slab.end_date || ''}`
}

function getProductColor(category = '') {
  const key = category.toLowerCase()
  if (key.includes('soft')) return '#2563eb'
  if (key.includes('snack')) return '#f59e0b'
  if (key.includes('energy')) return '#ef4444'
  if (key.includes('water')) return '#0ea5e9'
  if (key.includes('food')) return '#16a34a'
  return '#6366f1'
}

function isProductNew(createdAt) {
  if (!createdAt) return false
  const productDate = new Date(createdAt)
  const now = new Date()
  const daysOld = (now - productDate) / (1000 * 60 * 60 * 24)
  return daysOld <= 7 // Show "New" badge for 7 days after creation
}

function isBestSeller(totalSold) {
  return Number(totalSold || 0) >= 50 // Show "Best Seller" badge for products sold >= 50 units
}

const FESTIVE = {
  pageBg: '#f7f2e8',
  panelBg: '#fbf5ea',
  cardBg: '#fffdf8',
  border: '#ecdcc4',
  text: '#111827',
  muted: '#6b7280',
  accent: '#ef8e29',
  accentDark: '#dd7415',
  accentSoft: '#fff1dd'
}

export default function Prorducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [availability, setAvailability] = useState('all')
  const [sortBy, setSortBy] = useState('popularity')
  const [viewMode, setViewMode] = useState('grid')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [productSlabs, setProductSlabs] = useState({}) // { [productId]: [slabs] }
  const { state, dispatch } = useCart()
  const isMobile = useMediaQuery('(max-width: 980px)')
  const isCompact = useMediaQuery('(max-width: 640px)')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [imageLoadErrors, setImageLoadErrors] = useState({})

  const loadProducts = async () => {
    try {
      setLoading(true)
      const data = await fetchProducts()
      setProducts(data)
      setError(null)
      setLastUpdated(new Date())
      // Fetch slabs for all products in parallel
      const slabResults = await Promise.all(
        data.map(async (product) => {
          try {
            const slabs = await fetchProductSlabs(product.id)
            return [product.id, slabs]
          } catch {
            return [product.id, []]
          }
        })
      )
      const slabsMap = Object.fromEntries(slabResults)
      setProductSlabs(slabsMap)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  // Refresh products when returning from checkout or cart changes
  useEffect(() => {
    const cartItemCount = Object.keys(state.items).length
    // If cart was cleared (order placed), reload products to get updated stock
    if (cartItemCount === 0 && lastUpdated) {
      const timeSinceLastUpdate = Date.now() - lastUpdated.getTime()
      // Only auto-refresh if it's been a bit since last update (prevent rapid refreshes)
      if (timeSinceLastUpdate > 2000) {
        console.log('Cart cleared, refreshing product stock...')
        loadProducts()
      }
    }
  }, [state.items, lastUpdated])

  const inventoryStats = useMemo(() => {
    const total = products.length
    const inStock = products.filter((product) => Number(product.stock || 0) > 0).length
    const lowStock = products.filter((product) => {
      const stock = Number(product.stock || 0)
      return stock > 0 && stock <= 15
    }).length
    const outOfStock = total - inStock
    const avgPrice = total === 0
      ? 0
      : products.reduce((sum, product) => sum + Number(product.price || 0), 0) / total
    return { total, inStock, lowStock, outOfStock, avgPrice }
  }, [products])

  const filteredProducts = products
    .filter((product) => {
      const name = product.name || ''
      const category = product.category || ''
      const brand = deriveBrand(name)
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        brand.toLowerCase().includes(searchQuery.toLowerCase())
      const stock = Number(product.stock || 0)
      const matchesAvailability = availability === 'all' ||
        (availability === 'in' && stock > 0) ||
        (availability === 'out' && stock <= 0)
      return matchesSearch && matchesAvailability
    })
    .sort((a, b) => {
      if (sortBy === 'name' || sortBy === 'popularity') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'price-low') return Number(a.price || 0) - Number(b.price || 0)
      if (sortBy === 'price-high') return Number(b.price || 0) - Number(a.price || 0)
      if (sortBy === 'stock') return Number(b.stock || 0) - Number(a.stock || 0)
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '')
      return 0
    })

  const totalItemsInCart = Object.values(state.items).reduce((sum, item) => sum + item.qty, 0)
  const selectedProductHasImage = Boolean(selectedProduct?.image_url) && !Boolean(imageLoadErrors[String(selectedProduct?.id || '')])
  const activeFilters = [
    searchQuery ? { key: 'search', label: `Search: ${searchQuery}`, onClear: () => setSearchQuery('') } : null,
    availability !== 'all' ? { key: 'availability', label: availability === 'in' ? 'In stock only' : 'Out of stock only', onClear: () => setAvailability('all') } : null
  ].filter(Boolean)

  if (loading) {
    return <SkeletonGrid isMobile={isMobile} />
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 16px', borderRadius: 12, fontSize: 13 }}>
          Unable to load products. {error}
        </div>
      </div>
    )
  }

  return (
    <>
      <FloatingCart />
      {/* Product Detail Modal */}
      {selectedProduct && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.32)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isCompact ? 10 : 16
        }} onClick={() => setSelectedProduct(null)}>
          <div style={{ background: FESTIVE.cardBg, borderRadius: 18, maxWidth: isCompact ? 360 : 420, width: '100%', boxShadow: '0 18px 48px rgba(44, 36, 22, 0.18)', border: `1px solid ${FESTIVE.border}`, padding: isCompact ? 18 : 24, position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedProduct(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', fontSize: 20, color: '#64748b', cursor: 'pointer' }}>&times;</button>
            <div style={{ width: '100%', height: isCompact ? 180 : 210, borderRadius: 14, marginBottom: 16, background: '#fff', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selectedProductHasImage ? (
                <motion.img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  onError={() => setImageLoadErrors((prev) => ({ ...prev, [String(selectedProduct.id)]: true }))}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
                  transition={{ opacity: { duration: 0.35 }, scale: { duration: 0.35 }, y: { duration: 4.6, repeat: Infinity, ease: 'easeInOut' } }}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block', padding: 8, boxSizing: 'border-box', filter: 'saturate(1.12) contrast(1.08) drop-shadow(0 18px 20px rgba(15, 23, 42, 0.22))' }}
                />
              ) : (
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 30 }}>
                  {(selectedProduct.name || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              {selectedProductHasImage && (
                <motion.div
                  initial={{ x: '-130%' }}
                  animate={{ x: ['-130%', '150%'] }}
                  transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.4, ease: 'linear' }}
                  style={{ position: 'absolute', top: 0, bottom: 0, width: '32%', pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.6), rgba(255,255,255,0))', transform: 'skewX(-16deg)' }}
                />
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: isCompact ? 18 : 20, fontWeight: 800, color: '#0f172a' }}>{selectedProduct.name}</h2>
            <div style={{ fontSize: 13, color: '#64748b', margin: '8px 0 12px' }}>{selectedProduct.category}</div>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 12 }}>{selectedProduct.description || 'No description available.'}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 8 }}>₹{selectedProduct.price}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Stock: {selectedProduct.stock}</div>
            {/* Slab Offers in Modal */}
            {productSlabs[selectedProduct.id] && productSlabs[selectedProduct.id].length > 0 && (
              <div style={{ background: '#f1f5f9', border: '1px solid #e0e7ef', borderRadius: 10, padding: 10, margin: '12px 0' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#2563eb', marginBottom: 4 }}>Slab Offers:</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12 }}>
                  {productSlabs[selectedProduct.id].map((slab, idx) => {
                    const qty = Number(slab.min_quantity);
                    const price = Number(selectedProduct.price);
                    const totalBefore = qty * price;
                    const discountType = slab.discount_type;
                    const discountValue = Number(slab.discount_value);
                    let discount = 0;
                    if (discountType === 'percent') {
                      discount = totalBefore * (discountValue / 100);
                    } else {
                      discount = discountValue * qty;
                    }
                    const totalAfter = totalBefore - discount;
                    return (
                      <li key={slab.id || idx} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px dashed #e0e7ef' }}>
                        <span style={{ fontWeight: 600 }}>Quantity: {qty}+</span>: {discountType === 'percent' ? `${discountValue}% off` : `₹${discountValue} off`}
                        {slab.start_date && slab.end_date && (
                          <span style={{ color: '#64748b', marginLeft: 6 }}>
                            ({new Date(slab.start_date).toLocaleDateString()} - {new Date(slab.end_date).toLocaleDateString()})
                          </span>
                        )}
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          <span>Total Before Offer: ₹{totalBefore.toLocaleString()}</span> <br /> <span style={{ fontWeight: 700, color: '#1976d2' }}>Total After Slab Offer: ₹{totalAfter.toLocaleString()}</span>
                        </div>
                        {(() => {
                          const modalStock = Number(selectedProduct.stock || 0)
                          const currentItem = state.items[selectedProduct.id]
                          const currentQty = Number(currentItem?.qty || 0)
                          const slabKey = getSlabKey(slab)
                          const activeSlabKey = getSlabKey(currentItem?.slab)
                          const hasDifferentActiveSlab = Boolean(activeSlabKey) && activeSlabKey !== slabKey
                          const slabCount = activeSlabKey === slabKey && currentQty > 0 ? Math.floor(currentQty / qty) : 0
                          const canIncrease = !hasDifferentActiveSlab && currentQty + qty <= modalStock

                          if (slabCount <= 0) {
                            return (
                              <button
                                type="button"
                                style={{ marginTop: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #1976d2', background: '#1976d2', color: '#fff', fontSize: 13, fontWeight: 600, cursor: (modalStock < qty || hasDifferentActiveSlab) ? 'not-allowed' : 'pointer', opacity: (modalStock < qty || hasDifferentActiveSlab) ? 0.5 : 1 }}
                                onClick={() => dispatch({ type: 'add', product: selectedProduct, qty, maxQty: modalStock, slab })}
                                disabled={modalStock < qty || hasDifferentActiveSlab}
                              >
                                {hasDifferentActiveSlab
                                  ? 'Clear active slab first'
                                  : `Add ${qty} to Cart (${totalAfter.toLocaleString()})`}
                              </button>
                            )
                          }

                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
                                onClick={() => dispatch({
                                  type: 'set_qty',
                                  id: selectedProduct.id,
                                  product: selectedProduct,
                                  qty: currentQty - qty,
                                  slab: currentQty - qty >= qty ? slab : null
                                })}
                              >
                                −
                              </button>
                              <span style={{ minWidth: 60, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                {slabCount} slab
                              </span>
                              <button
                                type="button"
                                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #1976d2', background: '#1976d2', color: '#fff', fontSize: 16, fontWeight: 700, cursor: canIncrease ? 'pointer' : 'not-allowed', opacity: canIncrease ? 1 : 0.5 }}
                                onClick={() => dispatch({ type: 'add', product: selectedProduct, qty, maxQty: modalStock, slab })}
                                disabled={!canIncrease}
                              >
                                +
                              </button>
                              <span style={{ fontSize: 11, color: '#64748b' }}>
                                Total: {currentQty} units
                              </span>
                            </div>
                          )
                        })()}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {/* Add more details as needed */}
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gap: 20 }}>
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: isMobile ? 'flex-start' : 'center', justifyContent: isMobile ? 'flex-start' : 'space-between', background: FESTIVE.panelBg, border: `1px solid ${FESTIVE.border}`, borderRadius: 18, padding: '16px 18px', boxShadow: '0 12px 24px rgba(57, 44, 27, 0.06)' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: FESTIVE.text, fontFamily: '"Georgia", "Times New Roman", serif' }}>Products</h1>
            <p style={{ margin: 0, color: FESTIVE.muted, fontSize: 13 }}>Search, filter, and add items to your cart in seconds.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={loadProducts}
              disabled={loading}
              style={{
                padding: '8px 12px',
                borderRadius: 12,
                border: `1px solid ${FESTIVE.accent}`,
                background: loading ? '#f1f5f9' : FESTIVE.accent,
                color: loading ? '#cbd5e0' : '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
              title="Refresh product stock"
              onMouseOver={(e) => { if (!loading) e.target.style.background = FESTIVE.accentDark }}
              onMouseOut={(e) => { if (!loading) e.target.style.background = FESTIVE.accent }}
            >
              {loading ? 'Refreshing...' : '🔄 Refresh Stock'}
            </button>
            <div style={{ padding: '8px 12px', borderRadius: 12, border: `1px solid ${FESTIVE.border}`, background: FESTIVE.cardBg, fontSize: 12, fontWeight: 600, color: '#1f2937' }}>
              {totalItemsInCart} item{totalItemsInCart === 1 ? '' : 's'} in cart
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 12, border: `1px solid ${FESTIVE.border}`, background: FESTIVE.cardBg, fontSize: 12, fontWeight: 600, color: '#475569' }}>
              {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}
            </div>
          </div>
        </section>

        {/* Inventory stats section removed as requested */}

        <section
          style={{
            background: FESTIVE.panelBg,
            border: `1px solid ${FESTIVE.border}`,
            borderRadius: 16,
            padding: isMobile ? 16 : 20,
            display: 'grid',
            gap: 14,
            boxShadow: '0 12px 24px rgba(57, 44, 27, 0.05)'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(280px, 1fr) auto auto', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input
                id="product-search"
                type="text"
                placeholder="Search for products, SKUs, or brands"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: `1px solid ${FESTIVE.border}`,
                  borderRadius: 12,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  background: '#fff'
                }}
              />
            </div>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              style={{
                width: isMobile ? '100%' : 200,
                padding: '12px 12px',
                border: `1px solid ${FESTIVE.border}`,
                borderRadius: 12,
                fontSize: 13,
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="popularity">Sort by: Popularity</option>
              <option value="name">Name (A-Z)</option>
              <option value="price-low">Price (low to high)</option>
              <option value="price-high">Price (high to low)</option>
              <option value="stock">Stock (most first)</option>
              <option value="category">Category</option>
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
              {['grid', 'list'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  style={{
                    width: 64,
                    height: 38,
                    borderRadius: 12,
                    border: viewMode === mode ? `1px solid ${FESTIVE.accent}` : `1px solid ${FESTIVE.border}`,
                    background: viewMode === mode ? FESTIVE.accentSoft : '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    color: viewMode === mode ? FESTIVE.accentDark : '#64748b'
                  }}
                  aria-label={`${mode} view`}
                >
                  {mode === 'grid' ? 'Grid' : 'List'}
                </button>
              ))}
            </div>
          </div>
          {activeFilters.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={filter.onClear}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: '1px solid #f4d5ad',
                    background: FESTIVE.accentSoft,
                    fontSize: 12,
                    fontWeight: 600,
                    color: FESTIVE.accentDark,
                    cursor: 'pointer'
                  }}
                >
                  {filter.label} x
                </button>
              ))}
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: 20 }}>
          <aside style={{ display: 'grid', gap: 16, position: isMobile ? 'static' : 'sticky', top: 12, alignSelf: 'start' }}>
            <section style={{ background: FESTIVE.panelBg, border: `1px solid ${FESTIVE.border}`, borderRadius: 16, padding: 16, display: 'grid', gap: 12, boxShadow: '0 12px 24px rgba(57, 44, 27, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Filters</h3>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setAvailability('all')
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: FESTIVE.accentDark,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Reset
                </button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Availability</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#0f172a' }}>
                  <input type="radio" name="availability" checked={availability === 'all'} onChange={() => setAvailability('all')} />
                  All items
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#0f172a' }}>
                  <input type="radio" name="availability" checked={availability === 'in'} onChange={() => setAvailability('in')} />
                  In stock
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#0f172a' }}>
                  <input type="radio" name="availability" checked={availability === 'out'} onChange={() => setAvailability('out')} />
                  Out of stock
                </label>
              </div>
            </section>
          </aside>

          <section style={{ display: 'grid', gap: 16 }}>
            {filteredProducts.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(240px, 1fr))' : '1fr', gap: 16 }}>
                {filteredProducts.map((product) => {
                  const quantityInCart = state.items[product.id]?.qty || 0
                  const stock = Number(product.stock || 0)
                  const price = Number(product.price || 0)
                  const isLowStock = stock > 0 && stock <= 15
                  const brand = deriveBrand(product.name)
                  const color = getProductColor(product.category || '')
                  const hasUsableImage = Boolean(product.image_url) && !Boolean(imageLoadErrors[String(product.id)])

                  const slabs = productSlabs[product.id] || []
                  return (
                    <motion.article
                      key={product.id}
                      whileHover={{ y: viewMode === 'grid' ? -4 : 0 }}
                      style={{
                        background: FESTIVE.cardBg,
                        border: `1px solid ${FESTIVE.border}`,
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 10px 24px rgba(57, 44, 27, 0.06)',
                        display: 'grid',
                        gap: 0,
                        gridTemplateColumns: viewMode === 'list' && !isCompact ? 'auto 1fr' : '1fr'
                      }}
                    >
                      {/* Image Container */}
                      <div
                        style={{
                          height: viewMode === 'list' && !isCompact ? 120 : 180,
                          width: viewMode === 'list' && !isCompact ? 140 : '100%',
                          borderRadius: 0,
                          background: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          flexShrink: 0,
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedProduct(product)}
                      >
                        {hasUsableImage ? (
                          <motion.img
                            src={product.image_url}
                            alt={product.name}
                            onError={() => setImageLoadErrors((prev) => ({ ...prev, [String(product.id)]: true }))}
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block', padding: 8, boxSizing: 'border-box', filter: 'saturate(1.1) contrast(1.06) drop-shadow(0 14px 14px rgba(15, 23, 42, 0.2))' }}
                          />
                        ) : (
                          <div style={{ width: 66, height: 66, borderRadius: '50%', background: '#e2e8f0', color: '#64748b', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{brand.slice(0, 1)}</div>
                        )}
                        {hasUsableImage && (
                          <motion.div
                            initial={{ x: '-135%' }}
                            animate={{ x: ['-135%', '145%'] }}
                            transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.2, ease: 'linear' }}
                            style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.52), rgba(255,255,255,0))', transform: 'skewX(-14deg)' }}
                          />
                        )}
                        {/* Stock Badge */}
                        <div style={{ position: 'absolute', top: 12, left: 12, fontSize: 10, fontWeight: 700, color: stock > 0 ? '#16a34a' : '#dc2626', background: stock > 0 ? '#dcfce7' : '#fee2e2', padding: '4px 10px', borderRadius: 999 }}>
                          {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                        </div>
                        {/* New or Best Seller Badge */}
                        {isProductNew(product.created_at) ? (
                          <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 700, color: '#fff', background: '#10b981', padding: '4px 10px', borderRadius: 6 }}>
                            ✨ New
                          </div>
                        ) : isBestSeller(product.total_sold) ? (
                          <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 700, color: '#b45309', background: '#fbbf24', padding: '4px 10px', borderRadius: 6 }}>
                            ⭐ Best Seller
                          </div>
                        ) : null}
                      </div>

                      {/* Content Container */}
                      <div style={{ padding: 16, display: 'grid', gap: 12, width: '100%' }}>
                        {/* Slab Offers Section */}
                        {slabs.length > 0 && (
                          <div style={{ background: '#f1f5f9', border: '1px solid #e0e7ef', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#2563eb', marginBottom: 4 }}>Slab Offers:</div>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12 }}>
                              {slabs.map((slab, idx) => {
                                const qty = Number(slab.min_quantity);
                                const price = Number(product.price);
                                const totalBefore = qty * price;
                                const discountType = slab.discount_type;
                                const discountValue = Number(slab.discount_value);
                                let discount = 0;
                                if (discountType === 'percent') {
                                  discount = totalBefore * (discountValue / 100);
                                } else {
                                  discount = discountValue * qty;
                                }
                                const totalAfter = totalBefore - discount;
                                return (
                                  <li key={slab.id || idx} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px dashed #e0e7ef' }}>
                                    <span style={{ fontWeight: 600 }}>Quantity: {qty}+</span>: {discountType === 'percent' ? `${discountValue}% off` : `₹${discountValue} off`}
                                    {slab.start_date && slab.end_date && (
                                      <span style={{ color: '#64748b', marginLeft: 6 }}>
                                        ({new Date(slab.start_date).toLocaleDateString()} - {new Date(slab.end_date).toLocaleDateString()})
                                      </span>
                                    )}
                                    <div style={{ fontSize: 12, marginTop: 4 }}>
                                    <span>Total Before Offer: ₹{totalBefore.toLocaleString()}</span> <br /> <span style={{ fontWeight: 700, color: '#1976d2' }}>Total After Slab Offer: ₹{totalAfter.toLocaleString()}</span>
                                    </div>
                                    {(() => {
                                      const currentItem = state.items[product.id]
                                      const currentQty = Number(currentItem?.qty || 0)
                                      const slabKey = getSlabKey(slab)
                                      const activeSlabKey = getSlabKey(currentItem?.slab)
                                      const hasDifferentActiveSlab = Boolean(activeSlabKey) && activeSlabKey !== slabKey
                                      const slabCount = activeSlabKey === slabKey && currentQty > 0 ? Math.floor(currentQty / qty) : 0
                                      const canIncrease = !hasDifferentActiveSlab && currentQty + qty <= stock

                                      if (slabCount <= 0) {
                                        return (
                                          <button
                                            type="button"
                                            style={{ marginTop: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #1976d2', background: '#1976d2', color: '#fff', fontSize: 13, fontWeight: 600, cursor: (stock < qty || hasDifferentActiveSlab) ? 'not-allowed' : 'pointer', opacity: (stock < qty || hasDifferentActiveSlab) ? 0.5 : 1 }}
                                            onClick={() => dispatch({ type: 'add', product, qty, maxQty: stock, slab })}
                                            disabled={stock < qty || hasDifferentActiveSlab}
                                          >
                                            {hasDifferentActiveSlab
                                              ? 'Clear active slab first'
                                              : `Add ${qty} to Cart (${totalAfter.toLocaleString()})`}
                                          </button>
                                        )
                                      }

                                      return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                                          <button
                                            type="button"
                                            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
                                            onClick={() => dispatch({
                                              type: 'set_qty',
                                              id: product.id,
                                              product,
                                              qty: currentQty - qty,
                                              slab: currentQty - qty >= qty ? slab : null
                                            })}
                                          >
                                            −
                                          </button>
                                          <span style={{ minWidth: 60, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                            {slabCount} slab
                                          </span>
                                          <button
                                            type="button"
                                            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #1976d2', background: '#1976d2', color: '#fff', fontSize: 16, fontWeight: 700, cursor: canIncrease ? 'pointer' : 'not-allowed', opacity: canIncrease ? 1 : 0.5 }}
                                            onClick={() => dispatch({ type: 'add', product, qty, maxQty: stock, slab })}
                                            disabled={!canIncrease}
                                          >
                                            +
                                          </button>
                                          <span style={{ fontSize: 11, color: '#64748b' }}>
                                            Total: {currentQty} units
                                          </span>
                                        </div>
                                      )
                                    })()}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                        {/* Category Badge */}
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{product.category || 'Category'}</div>

                        {/* Product Name */}
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{product.name}</h3>
                        </div>

                        {/* Description */}
                        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                          {product.description ? product.description.slice(0, 85) : 'Premium quality product.'}
                          {product.description && product.description.length > 85 ? '…' : ''}
                        </div>

                        {/* Divider */}
                        <div style={{ height: 1, background: '#e2e8f0' }} />

                        {/* Price and Stock Status */}
                        <div style={{ display: 'flex', alignItems: isCompact ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isCompact ? 'column' : 'row', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Unit Price</div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 16 }}>₹{price}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: stock > 0 ? '#16a34a' : '#dc2626', background: stock > 0 ? '#dcfce7' : '#fee2e2', padding: '4px 10px', borderRadius: 999 }}>
                              {stock > 0 ? 'In Stock' : 'Out of Stock'}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{stock || 0} Units</div>
                          </div>
                        </div>

                        {/* Add to Cart Section */}
                        <div style={{ display: 'flex', gap: 8, alignItems: isCompact ? 'stretch' : 'center', flexDirection: isCompact ? 'column' : 'row', marginTop: 4 }}>
                          {quantityInCart > 0 ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: isCompact ? 'space-between' : 'flex-start', flex: 1, width: '100%' }}>
                              <button
                                type="button"
                                onClick={() => dispatch({ type: 'remove', id: product.id })}
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  border: '1px solid #e2e8f0',
                                  background: '#f8fafc',
                                  fontSize: 16,
                                  cursor: 'pointer',
                                  color: '#64748b'
                                }}
                              >
                                −
                              </button>
                              <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{quantityInCart}</div>
                              <button
                                type="button"
                                onClick={() => { if (quantityInCart < stock) dispatch({ type: 'add', product, maxQty: stock }) }}
                                disabled={quantityInCart >= stock}
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  border: quantityInCart >= stock ? '1px solid #e2e8f0' : `1px solid ${FESTIVE.accent}`,
                                  background: quantityInCart >= stock ? '#f1f5f9' : FESTIVE.accent,
                                  fontSize: 16,
                                  cursor: quantityInCart >= stock ? 'not-allowed' : 'pointer',
                                  color: quantityInCart >= stock ? '#cbd5e0' : '#fff'
                                }}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => dispatch({ type: 'add', product, maxQty: stock })}
                              disabled={stock <= 0}
                              style={{
                                flex: 1,
                                padding: '10px 16px',
                                borderRadius: 10,
                                border: 'none',
                                background: stock > 0 ? FESTIVE.accent : '#e2e8f0',
                                color: stock > 0 ? '#fff' : '#94a3b8',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: stock > 0 ? 'pointer' : 'not-allowed',
                                transition: 'background 0.2s'
                              }}
                              onMouseOver={(e) => { if (stock > 0) e.target.style.background = FESTIVE.accentDark }}
                              onMouseOut={(e) => { if (stock > 0) e.target.style.background = FESTIVE.accent }}
                            >
                              {stock > 0 ? '🛒 Add to Cart' : 'Notify Me'}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.article>
                  )
                })}
              </div>
            ) : (
              <div style={{ background: FESTIVE.cardBg, border: `1px solid ${FESTIVE.border}`, borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>No products match your filters</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Update your search keywords or choose a different category.</p>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: isCompact ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isCompact ? 'column' : 'row', gap: 10, color: '#94a3b8', fontSize: 12 }}>
              <span>Showing {filteredProducts.length} result{filteredProducts.length === 1 ? '' : 's'}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${FESTIVE.border}`, background: '#fff', fontSize: 12, color: '#475569' }}>Previous</button>
                <button type="button" style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${FESTIVE.accent}`, background: FESTIVE.accent, fontSize: 12, color: '#fff' }}>Next</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

function SkeletonGrid({ isMobile = false }) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ height: 48, background: '#f6efe3', borderRadius: 16 }} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: 20 }}>
        <div style={{ height: 520, background: '#f6efe3', borderRadius: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: '#fffdf8', border: '1px solid #ecdcc4', borderRadius: 16, overflow: 'hidden', boxShadow: '0 10px 24px rgba(57, 44, 27, 0.06)' }}>
              <div style={{ height: 180, background: '#f6efe3', borderRadius: 0 }} />
              <div style={{ padding: 16, display: 'grid', gap: 10 }}>
                <div style={{ height: 12, width: '60%', background: '#f6efe3', borderRadius: 6 }} />
                <div style={{ height: 18, width: '80%', background: '#f6efe3', borderRadius: 6 }} />
                <div style={{ height: 12, width: '100%', background: '#f6efe3', borderRadius: 6 }} />
                <div style={{ height: 1, background: '#f6efe3' }} />
                <div style={{ height: 16, width: '70%', background: '#f6efe3', borderRadius: 6 }} />
                <div style={{ height: 40, width: '100%', background: '#f6efe3', borderRadius: 8 }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
