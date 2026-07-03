import React, { useEffect, useMemo, useState } from 'react'
import { fetchProducts, fetchProductSlabs, getCachedDataSync } from '../api/client'
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
function formatDescriptionText(text) {
  if (!text) return ''
  let cleaned = String(text)
    .replace(/^description"\s*:\s*"/i, '')
    .replace(/^description\s*:\s*"/i, '')
    .replace(/^"/, '')
    .replace(/"$/, '')
    .replace(/\\n/g, '\n') // Normalize escaped newlines
  
  return cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join(' | ')
    .replace(/\s*\|\s*\|\s*/g, ' | ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseProductMetadata(descStr) {
  const defaultMeta = {
    description: descStr || '',
    sku: '',
    features: [],
    specifications: {},
    stock_history: []
  }
  if (!descStr) return defaultMeta
  const trimmed = descStr.trim()
  
  // 1. Try parsing JSON first
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object') {
      return {
        description: formatDescriptionText(parsed.description || ''),
        sku: parsed.sku || '',
        features: Array.isArray(parsed.features) ? parsed.features : [],
        specifications: (parsed.specifications && typeof parsed.specifications === 'object') ? parsed.specifications : {},
        stock_history: Array.isArray(parsed.stock_history) ? parsed.stock_history : []
      }
    }
  } catch (e) {
    // Direct parse failed
  }

  // 2. If it's wrapped in quotes, try unescaping first
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const unescaped = JSON.parse(trimmed)
      const parsed = typeof unescaped === 'string' ? JSON.parse(unescaped) : unescaped
      if (parsed && typeof parsed === 'object') {
        return {
          description: formatDescriptionText(parsed.description || ''),
          sku: parsed.sku || '',
          features: Array.isArray(parsed.features) ? parsed.features : [],
          specifications: (parsed.specifications && typeof parsed.specifications === 'object') ? parsed.specifications : {},
          stock_history: Array.isArray(parsed.stock_history) ? parsed.stock_history : []
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // 3. Regex match for "description":"value" pattern (even if it's malformed JSON)
  const regexPatterns = [
    /description"\s*:\s*"([^"]+)"/i,
    /description"\s*:\s*'([^']+)'/i,
    /description"\s*:\s*(.*)/i
  ]
  for (const regex of regexPatterns) {
    const match = trimmed.match(regex)
    if (match && match[1]) {
      let val = match[1].trim()
      val = val.replace(/^[{\s"'\\]+/, '').replace(/[}\s"'\\]+$/, '').replace(/\\"/g, '"')
      return {
        ...defaultMeta,
        description: formatDescriptionText(val)
      }
    }
  }

  // 4. Fallback: clean the string and format it
  return {
    ...defaultMeta,
    description: formatDescriptionText(trimmed)
  }
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

function getBrandStyles(brandName = '') {
  const key = brandName.toLowerCase()
  if (key.includes('pepsi')) return { bg: '#e0f2fe', text: '#0369a1' }
  if (key.includes('dew')) return { bg: '#f0fdf4', text: '#15803d' }
  if (key.includes('lay')) return { bg: '#fffbeb', text: '#b45309' }
  if (key.includes('sting')) return { bg: '#fef2f2', text: '#b91c1c' }
  if (key.includes('gatorade')) return { bg: '#fff7ed', text: '#c2410c' }
  if (key.includes('aquafina')) return { bg: '#ecfeff', text: '#0891b2' }
  return { bg: '#f1f5f9', text: '#475569' }
}

function isProductNew(createdAt) {
  if (!createdAt) return false
  const productDate = new Date(createdAt)
  const now = new Date()
  const daysOld = (now - productDate) / (1000 * 60 * 60 * 24)
  return daysOld <= 3 // Show "New" badge for 3 days after creation (visible for 3 days, then hidden)
}

function isBestSeller(totalSold) {
  return Number(totalSold || 0) >= 50 // Show "Best Seller" badge for products sold >= 50 units
}

function getPriorityScore(product, slabsList) {
  let score = 0
  if (isProductNew(product.created_at)) {
    score += 1000
  }
  if (slabsList && slabsList.length > 0) {
    score += 100
  }
  if (isBestSeller(product.total_sold)) {
    score += 10
  }
  return score
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
  const cachedProducts = getCachedDataSync('products')
  const cachedSlabsMap = useMemo(() => {
    if (!cachedProducts) return {}
    const map = {}
    for (const p of cachedProducts) {
      const slabData = getCachedDataSync(`slabs_${p.id}`)
      if (slabData) map[p.id] = slabData
    }
    return map
  }, [cachedProducts])

  const [products, setProducts] = useState(cachedProducts || [])
  const [loading, setLoading] = useState(!cachedProducts)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [availability, setAvailability] = useState('all')
  const [sortBy, setSortBy] = useState('popularity')
  const [viewMode, setViewMode] = useState('grid')
  const [lastUpdated, setLastUpdated] = useState(cachedProducts ? new Date() : null)
  const [productSlabs, setProductSlabs] = useState(cachedSlabsMap) // { [productId]: [slabs] }
  const [selectedCategory, setSelectedCategory] = useState('all')

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean))
    return ['all', ...Array.from(cats)]
  }, [products])

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 9

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, availability, selectedCategory, sortBy])


  const { state, dispatch } = useCart()
  const isMobile = useMediaQuery('(max-width: 980px)')
  const isCompact = useMediaQuery('(max-width: 640px)')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [imageLoadErrors, setImageLoadErrors] = useState({})

  const loadProducts = async () => {
    try {
      if (!cachedProducts) {
        setLoading(true)
      }
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
      console.error(e)
      if (!cachedProducts) {
        setError(e.message)
      }
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
      const matchesCategory = selectedCategory === 'all' || category.toLowerCase() === selectedCategory.toLowerCase()
      return matchesSearch && matchesAvailability && matchesCategory
    })
    .sort((a, b) => {
      if (sortBy === 'popularity') {
        const scoreA = getPriorityScore(a, productSlabs[a.id])
        const scoreB = getPriorityScore(b, productSlabs[b.id])
        if (scoreB !== scoreA) {
          return scoreB - scoreA
        }
        return (a.name || '').localeCompare(b.name || '')
      }
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'price-low') return Number(a.price || 0) - Number(b.price || 0)
      if (sortBy === 'price-high') return Number(b.price || 0) - Number(a.price || 0)
      if (sortBy === 'stock') return Number(b.stock || 0) - Number(a.stock || 0)
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '')
      return 0
    })

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredProducts, currentPage, itemsPerPage])

  const totalItemsInCart = Object.values(state.items).reduce((sum, item) => sum + item.qty, 0)
  const selectedProductHasImage = Boolean(selectedProduct?.image_url) && !Boolean(imageLoadErrors[String(selectedProduct?.id || '')])
  const activeFilters = [
    searchQuery ? { key: 'search', label: `Search: ${searchQuery}`, onClear: () => setSearchQuery('') } : null,
    availability !== 'all' ? { key: 'availability', label: availability === 'in' ? 'In stock only' : 'Out of stock only', onClear: () => setAvailability('all') } : null,
    selectedCategory !== 'all' ? { key: 'category', label: `Category: ${selectedCategory}`, onClear: () => setSelectedCategory('all') } : null
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
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isCompact ? 10 : 16
        }} onClick={() => setSelectedProduct(null)}>
          <div style={{
            background: '#fff',
            borderRadius: 24,
            maxWidth: isCompact ? 360 : 440,
            width: '100%',
            maxHeight: '85vh',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.22)',
            border: '1px solid #ebd2aa',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            {/* Sticky close button */}
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
              <button
                onClick={() => setSelectedProduct(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  fontSize: 20,
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.color = '#0f172a';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                &times;
              </button>
            </div>

            {/* Scrollable Content Container */}
            <div style={{
              overflowY: 'auto',
              padding: isCompact ? '20px' : '28px',
              width: '100%',
              height: '100%'
            }}>
              <div style={{ width: '100%', height: isCompact ? 180 : 220, borderRadius: 18, marginBottom: 20, background: 'linear-gradient(180deg, #ffffff 0%, #f8f6f0 100%)', border: '1px solid #ebd2aa', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedProductHasImage ? (
                  <motion.img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    onError={() => setImageLoadErrors((prev) => ({ ...prev, [String(selectedProduct.id)]: true }))}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
                    transition={{ opacity: { duration: 0.35 }, scale: { duration: 0.35 }, y: { duration: 4.6, repeat: Infinity, ease: 'easeInOut' } }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block', padding: 12, boxSizing: 'border-box', filter: 'saturate(1.12) contrast(1.08) drop-shadow(0 14px 16px rgba(15, 23, 42, 0.15))' }}
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
              
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.4px',
                  background: getBrandStyles(deriveBrand(selectedProduct.name)).bg,
                  color: getBrandStyles(deriveBrand(selectedProduct.name)).text,
                  textTransform: 'uppercase'
                }}>
                  {deriveBrand(selectedProduct.name)}
                </span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#cbd5e1' }}>•</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'capitalize' }}>
                  {selectedProduct.category}
                </span>
              </div>

              <h2 style={{ margin: 0, fontSize: isCompact ? 20 : 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>{selectedProduct.name}</h2>
              {(() => {
                const meta = parseProductMetadata(selectedProduct.description)
                return (
                  <div style={{ display: 'grid', gap: 14, margin: '8px 0 16px' }}>
                    <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                      {meta.description || 'No description available.'}
                    </div>

                    {meta.features.length > 0 && (
                      <div style={{ borderTop: '1px solid #ebd2aa', paddingTop: 10 }}>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: 11, fontWeight: 800, color: '#d66022', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Key Highlights</h4>
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#334155', display: 'grid', gap: 3 }}>
                          {meta.features.map((f, i) => (
                            <li key={i} style={{ lineHeight: 1.4 }}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {Object.keys(meta.specifications).length > 0 && (
                      <div style={{ borderTop: '1px solid #ebd2aa', paddingTop: 10 }}>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: 11, fontWeight: 800, color: '#d66022', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Specifications</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#fdfbf7', padding: 10, borderRadius: 10, border: '1px solid #ebd2aa' }}>
                          {Object.entries(meta.specifications).map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f5ebd6', paddingBottom: 2, fontSize: 11 }}>
                              <span style={{ color: '#64748b' }}>{k}</span>
                              <span style={{ fontWeight: 700, color: '#1e293b' }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fdfbf7', border: '1px solid #ebd2aa', borderRadius: 14, padding: '12px 16px', marginBottom: 20 }}>
                <div>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Unit Price</span>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 20 }}>₹{selectedProduct.price}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Stock Availability</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: selectedProduct.stock > 0 ? '#15803d' : '#b91c1c', marginTop: 2 }}>{selectedProduct.stock || 0} Units</div>
                </div>
              </div>

              {/* Slab Offers in Modal */}
              {productSlabs[selectedProduct.id] && productSlabs[selectedProduct.id].length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #fdfbf7 0%, #faf5ec 100%)',
                  border: '1px dashed #e5d5be',
                  borderRadius: 16,
                  padding: 16,
                  margin: '16px 0',
                  boxShadow: '0 4px 6px rgba(53, 36, 20, 0.01)'
                }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: '#d66022', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span>🏷️</span> Available Bulk Slab Offers:
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
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
                      const modalStock = Number(selectedProduct.stock || 0)
                      const currentItem = state.items[selectedProduct.id]
                      const currentQty = Number(currentItem?.qty || 0)
                      const slabKey = getSlabKey(slab)
                      const activeSlabKey = getSlabKey(currentItem?.slab)
                      const hasDifferentActiveSlab = Boolean(activeSlabKey) && activeSlabKey !== slabKey
                      const slabCount = activeSlabKey === slabKey && currentQty > 0 ? Math.floor(currentQty / qty) : 0
                      const canIncrease = !hasDifferentActiveSlab && currentQty + qty <= modalStock

                      return (
                        <div key={slab.id || idx} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          paddingBottom: idx === productSlabs[selectedProduct.id].length - 1 ? 0 : 10,
                          borderBottom: idx === productSlabs[selectedProduct.id].length - 1 ? 'none' : '1px dashed #ebd2aa'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                              Buy {qty}+ units
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '3px 8px', borderRadius: 6 }}>
                              {discountType === 'percent' ? `${discountValue}% off` : `₹${discountValue} off/unit`}
                            </span>
                          </div>
                          {slab.start_date && slab.end_date && (
                            <div style={{ color: '#94a3b8', fontSize: 10 }}>
                              Validity: {new Date(slab.start_date).toLocaleDateString()} to {new Date(slab.end_date).toLocaleDateString()}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
                            <div style={{ fontSize: 11, color: '#475569' }}>
                              Price: <span style={{ textDecoration: 'line-through' }}>₹{totalBefore}</span>{' '}
                              <span style={{ fontWeight: 800, color: '#f0641c' }}>₹{totalAfter}</span>
                            </div>
                            
                            {slabCount <= 0 ? (
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 8,
                                  border: 'none',
                                  background: (modalStock < qty || hasDifferentActiveSlab) 
                                    ? '#e2e8f0' 
                                    : 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)',
                                  color: (modalStock < qty || hasDifferentActiveSlab) ? '#94a3b8' : '#fff',
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: (modalStock < qty || hasDifferentActiveSlab) ? 'not-allowed' : 'pointer',
                                  boxShadow: (modalStock < qty || hasDifferentActiveSlab) ? 'none' : '0 2px 4px rgba(240, 100, 28, 0.15)'
                                }}
                                onClick={() => dispatch({ type: 'add', product: selectedProduct, qty, maxQty: modalStock, slab })}
                                disabled={modalStock < qty || hasDifferentActiveSlab}
                              >
                                {hasDifferentActiveSlab ? 'Locked' : `Add ${qty}`}
                              </motion.button>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.9 }}
                                  style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={() => dispatch({
                                    type: 'set_qty',
                                    id: selectedProduct.id,
                                    product: selectedProduct,
                                    qty: currentQty - qty,
                                    slab: currentQty - qty >= qty ? slab : null
                                  })}
                                >
                                  −
                                </motion.button>
                                <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', minWidth: 46, textAlign: 'center' }}>
                                  {slabCount} slab{slabCount > 1 ? 's' : ''}
                                </span>
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.9 }}
                                  style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: canIncrease ? 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)' : '#e2e8f0', color: canIncrease ? '#fff' : '#cbd5e0', fontSize: 14, fontWeight: 800, cursor: canIncrease ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={() => dispatch({ type: 'add', product: selectedProduct, qty, maxQty: modalStock, slab })}
                                  disabled={!canIncrease}
                                >
                                  +
                                </motion.button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 20 }}>
        <section style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #fdfbfa 0%, #faf6f0 100%)',
          border: '1px solid #ebd2aa',
          borderRadius: 24,
          padding: '24px 28px',
          boxShadow: '0 14px 28px rgba(44, 36, 22, 0.05)'
        }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Products Catalog</h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Browse high-quality beverages, snacks, and track bulk order offers in real time.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={loadProducts}
              disabled={loading}
              style={{
                padding: '10px 18px',
                borderRadius: 14,
                border: 'none',
                background: loading ? '#e2e8f0' : 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 12px rgba(240, 100, 28, 0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
              title="Refresh product stock"
            >
              {loading ? 'Refreshing...' : '🔄 Refresh Stock'}
            </motion.button>
            <div style={{ padding: '10px 18px', borderRadius: 14, border: '1px solid #ebd2aa', background: '#fffcf6', fontSize: 13, fontWeight: 700, color: '#d66022', boxShadow: '0 4px 6px rgba(53, 36, 20, 0.03)' }}>
              🛒 {totalItemsInCart} in cart
            </div>
            <div style={{ padding: '10px 18px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 700, color: '#475569', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.02)' }}>
              📦 {filteredProducts.length} items found
            </div>
          </div>
        </section>

        {/* Category Filter Pills */}
        <div style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          padding: '4px 4px 12px',
          margin: '0 -4px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          alignItems: 'center'
        }}>
          {categories.map((cat) => {
            const isActive = selectedCategory.toLowerCase() === cat.toLowerCase()
            return (
              <motion.button
                key={cat}
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 24,
                  border: isActive ? '1px solid #f0641c' : '1px solid #ecdcc4',
                  background: isActive 
                    ? 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)' 
                    : '#fff',
                  color: isActive ? '#fff' : '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive 
                    ? '0 6px 14px rgba(240, 100, 28, 0.24)' 
                    : '0 4px 6px rgba(53, 36, 20, 0.03)',
                  transition: 'color 0.2s, border 0.2s, box-shadow 0.2s'
                }}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </motion.button>
            )
          })}
        </div>

        <section
          style={{
            background: 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #ebd2aa',
            borderRadius: 20,
            padding: isMobile ? 16 : 20,
            display: 'grid',
            gap: 14,
            boxShadow: '0 12px 24px rgba(44, 36, 22, 0.03)'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(280px, 1fr) auto auto', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 14, color: '#94a3b8', fontSize: 15 }}>🔍</span>
              <input
                id="product-search"
                type="text"
                placeholder="Search products, SKUs, or brands..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 40px',
                  border: '1px solid #ecdcc4',
                  borderRadius: 14,
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  background: '#fff',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#f0641c'
                  e.target.style.boxShadow = '0 0 0 3px rgba(240, 100, 28, 0.12)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#ecdcc4'
                  e.target.style.boxShadow = 'none'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 12,
                    background: 'none',
                    border: 'none',
                    fontSize: 18,
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 4
                  }}
                >
                  &times;
                </button>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              style={{
                width: isMobile ? '100%' : 200,
                padding: '12px 14px',
                border: '1px solid #ecdcc4',
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 600,
                color: '#475569',
                background: '#fff',
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '14px',
                paddingRight: '36px',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#f0641c'}
              onBlur={(e) => e.target.style.borderColor = '#ecdcc4'}
            >
              <option value="popularity">Sort by: Recommended (Priority)</option>
              <option value="name">Name (A-Z)</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="stock">Stock: Most First</option>
              <option value="category">Category</option>
            </select>
            <div style={{ display: 'flex', gap: 6, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
              {['grid', 'list'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 14,
                    border: viewMode === mode ? '1px solid #f0641c' : '1px solid #ecdcc4',
                    background: viewMode === mode ? 'rgba(240, 100, 28, 0.08)' : '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    color: viewMode === mode ? '#f0641c' : '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  aria-label={`${mode} view`}
                >
                  {mode === 'grid' ? 'Grid View' : 'List View'}
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
                    padding: '6px 14px',
                    borderRadius: 999,
                    border: '1px solid #f4d5ad',
                    background: FESTIVE.accentSoft,
                    fontSize: 12,
                    fontWeight: 700,
                    color: FESTIVE.accentDark,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {filter.label} <span>&times;</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: 20 }}>
          <aside style={{ display: 'grid', gap: 16, position: isMobile ? 'static' : 'sticky', top: 12, alignSelf: 'start', zIndex: 10 }}>
            <section style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: `1px solid ${FESTIVE.border}`,
              borderRadius: 20,
              padding: 20,
              display: 'grid',
              gap: 16,
              boxShadow: '0 10px 25px rgba(57, 44, 27, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ebd2aa', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>⚙️</span>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>Filters</h3>
                </div>
                {(searchQuery || availability !== 'all' || selectedCategory !== 'all') && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05, color: '#dd7415' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSearchQuery('')
                      setAvailability('all')
                      setSelectedCategory('all')
                    }}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: FESTIVE.accent,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Reset
                  </motion.button>
                )}
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Availability</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { value: 'all', label: 'All items', icon: '📦' },
                    { value: 'in', label: 'In stock', icon: '🟢' },
                    { value: 'out', label: 'Out of stock', icon: '🔴' }
                  ].map((option) => {
                    const isSelected = availability === option.value;
                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        whileHover={{ x: 4, background: isSelected ? undefined : '#fdfbf7' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setAvailability(option.value)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 14px',
                          borderRadius: 12,
                          border: isSelected ? '1px solid #f0641c' : '1px solid #ecdcc4',
                          background: isSelected 
                            ? 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)' 
                            : '#fff',
                          color: isSelected ? '#fff' : '#475569',
                          fontSize: 12,
                          fontWeight: 700,
                          textAlign: 'left',
                          cursor: 'pointer',
                          boxShadow: isSelected 
                            ? '0 4px 10px rgba(240, 100, 28, 0.15)' 
                            : '0 2px 4px rgba(53, 36, 20, 0.01)',
                          transition: 'color 0.2s, border 0.2s, background 0.2s'
                        }}
                      >
                        <span style={{ fontSize: 13 }}>{option.icon}</span>
                        <span style={{ flex: 1 }}>{option.label}</span>
                        {isSelected && (
                          <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            style={{ fontSize: 10 }}
                          >
                            ✓
                          </motion.span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </section>
          </aside>

          <section style={{ display: 'grid', gap: 16 }}>
            {filteredProducts.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(240px, 1fr))' : '1fr', gap: 16 }}>
                {paginatedProducts.map((product) => {
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
                        whileHover={{ y: viewMode === 'grid' ? -8 : 0, boxShadow: '0 20px 35px rgba(53, 36, 20, 0.08)' }}
                        style={{
                          background: '#fff',
                          border: '1px solid #ebd2aa',
                          borderRadius: 20,
                          overflow: 'hidden',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03), 0 10px 15px -3px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0,0,0,0.01)',
                          display: 'grid',
                          gap: 0,
                          gridTemplateColumns: viewMode === 'list' && !isCompact ? 'auto 1fr' : '1fr',
                          transition: 'border-color 0.2s, box-shadow 0.2s'
                        }}
                      >
                        {/* Image Container */}
                        <div
                          style={{
                            height: viewMode === 'list' && !isCompact ? 140 : 200,
                            width: viewMode === 'list' && !isCompact ? 160 : '100%',
                            background: 'linear-gradient(180deg, #ffffff 0%, #fcfbf9 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            flexShrink: 0,
                            cursor: 'pointer',
                            borderBottom: viewMode === 'grid' || isCompact ? '1px solid #f3ebd7' : 'none',
                            borderRight: viewMode === 'list' && !isCompact ? '1px solid #f3ebd7' : 'none',
                            padding: 12,
                            boxSizing: 'border-box'
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
                              whileHover={{ scale: 1.05 }}
                              transition={{ duration: 0.3, ease: 'easeOut' }}
                              style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block', filter: 'saturate(1.1) contrast(1.05) drop-shadow(0 10px 10px rgba(15, 23, 42, 0.15))' }}
                            />
                          ) : (
                            <div style={{ width: 66, height: 66, borderRadius: '50%', background: '#e2e8f0', color: '#64748b', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{brand.slice(0, 1)}</div>
                          )}
                          {hasUsableImage && (
                            <motion.div
                              initial={{ x: '-135%' }}
                              animate={{ x: ['-135%', '145%'] }}
                              transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.2, ease: 'linear' }}
                              style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.4), rgba(255,255,255,0))', transform: 'skewX(-14deg)' }}
                            />
                          )}
                          {/* Stock Status Pill */}
                          <div style={{ position: 'absolute', top: 12, left: 12, fontSize: 10, fontWeight: 800, color: stock > 0 ? '#15803d' : '#b91c1c', background: stock > 0 ? '#dcfce7' : '#fee2e2', padding: '4px 10px', borderRadius: 999, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                            {stock > 0 ? `${stock} available` : 'Out of stock'}
                          </div>
                          {/* New or Best Seller Badge */}
                          {isProductNew(product.created_at) ? (
                            <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', padding: '4px 10px', borderRadius: 6, boxShadow: '0 4px 8px rgba(5,150,105,0.15)' }}>
                              ✨ New
                            </div>
                          ) : isBestSeller(product.total_sold) ? (
                            <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 800, color: '#b45309', background: 'linear-gradient(135deg, #fbcfe8 0%, #fbbf24 100%)', padding: '4px 10px', borderRadius: 6, boxShadow: '0 4px 8px rgba(251,191,36,0.15)' }}>
                              ⭐ Best Seller
                            </div>
                          ) : null}
                          {slabs.length > 0 && (
                            <div style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 10, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', padding: '4px 10px', borderRadius: 6, boxShadow: '0 4px 8px rgba(234,88,12,0.2)' }}>
                              🔥 Bulk Offer
                            </div>
                          )}
                        </div>

                        {/* Content Container */}
                        <div style={{ padding: 18, display: 'grid', gap: 10, width: '100%' }}>
                          
                          {/* Category and Brand row */}
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: '0.4px',
                              background: getBrandStyles(brand).bg,
                              color: getBrandStyles(brand).text,
                              textTransform: 'uppercase'
                            }}>
                              {brand}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#cbd5e1' }}>•</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'capitalize' }}>
                              {product.category || 'Category'}
                            </span>
                          </div>

                          {/* Product Name */}
                          <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>{product.name}</h3>
                          </div>

                          {/* Description */}
                          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, minHeight: 36 }}>
                            {(() => {
                              const meta = parseProductMetadata(product.description)
                              const text = meta.description || 'Premium quality product.'
                              return text.length > 80 ? `${text.slice(0, 77)}…` : text
                            })()}
                          </div>

                          {/* Rendering structured features inside card */}
                          {(() => {
                            const meta = parseProductMetadata(product.description)
                            if (meta.features && meta.features.length > 0) {
                              return (
                                <div style={{ padding: '6px 0', borderTop: '1px solid #e2e8f0' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Key Highlights:</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {meta.features.slice(0, 3).map((f, i) => (
                                      <span key={i} style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>✓ {f}</span>
                                    ))}
                                  </div>
                                </div>
                              )
                            }
                            return null
                          })()}

                          {/* Rendering specifications inside card */}
                          {(() => {
                            const meta = parseProductMetadata(product.description)
                            if (meta.specifications && Object.keys(meta.specifications).length > 0) {
                              return (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '6px 0', borderTop: '1px solid #e2e8f0', fontSize: 11 }}>
                                  {Object.entries(meta.specifications).slice(0, 4).map(([k, v]) => (
                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', background: '#fff', padding: '4px 6px', borderRadius: 4, border: '1px solid #f1f5f9' }}>
                                      <span style={{ color: '#64748b' }}>{k}</span>
                                      <span style={{ fontWeight: 700, color: '#1e293b' }}>{v}</span>
                                    </div>
                                  ))}
                                </div>
                              )
                            }
                            return null
                          })()}

                          {/* Slab Offers "Coupon Ticket" Section */}
                          {slabs.length > 0 && (
                            <div style={{
                              background: 'linear-gradient(135deg, #fdfbf7 0%, #faf5ec 100%)',
                              border: '1px dashed #e5d5be',
                              borderRadius: 14,
                              padding: 12,
                              margin: '4px 0',
                              boxShadow: '0 4px 6px rgba(53, 36, 20, 0.01)'
                            }}>
                              <div style={{ fontWeight: 800, fontSize: 11, color: '#d66022', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span>🏷️</span> Bulk Slab Offers:
                              </div>
                              <div style={{ display: 'grid', gap: 8 }}>
                                {slabs.map((slab, idx) => {
                                  const qty = Number(slab.min_quantity);
                                  const pr = Number(product.price);
                                  const totalBefore = qty * pr;
                                  const discountType = slab.discount_type;
                                  const discountValue = Number(slab.discount_value);
                                  let discount = 0;
                                  if (discountType === 'percent') {
                                    discount = totalBefore * (discountValue / 100);
                                  } else {
                                    discount = discountValue * qty;
                                  }
                                  const totalAfter = totalBefore - discount;
                                  const currentItem = state.items[product.id]
                                  const currentQty = Number(currentItem?.qty || 0)
                                  const slabKey = getSlabKey(slab)
                                  const activeSlabKey = getSlabKey(currentItem?.slab)
                                  const hasDifferentActiveSlab = Boolean(activeSlabKey) && activeSlabKey !== slabKey
                                  const slabCount = activeSlabKey === slabKey && currentQty > 0 ? Math.floor(currentQty / qty) : 0
                                  const canIncrease = !hasDifferentActiveSlab && currentQty + qty <= stock

                                  return (
                                    <div key={slab.id || idx} style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 4,
                                      paddingBottom: idx === slabs.length - 1 ? 0 : 8,
                                      borderBottom: idx === slabs.length - 1 ? 'none' : '1px dashed #ebd2aa'
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
                                          Buy {qty}+ units
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>
                                          {discountType === 'percent' ? `${discountValue}% off` : `₹${discountValue} off/unit`}
                                        </span>
                                      </div>
                                      
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 2 }}>
                                        <div style={{ fontSize: 10, color: '#64748b' }}>
                                          Total: <span style={{ textDecoration: 'line-through' }}>₹{totalBefore}</span>{' '}
                                          <span style={{ fontWeight: 700, color: '#f0641c' }}>₹{totalAfter}</span>
                                        </div>
                                        
                                        {slabCount <= 0 ? (
                                          <motion.button
                                            type="button"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            style={{
                                              padding: '5px 10px',
                                              borderRadius: 8,
                                              border: 'none',
                                              background: (stock < qty || hasDifferentActiveSlab) 
                                                ? '#e2e8f0' 
                                                : 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)',
                                              color: (stock < qty || hasDifferentActiveSlab) ? '#94a3b8' : '#fff',
                                              fontSize: 10,
                                              fontWeight: 800,
                                              cursor: (stock < qty || hasDifferentActiveSlab) ? 'not-allowed' : 'pointer',
                                              boxShadow: (stock < qty || hasDifferentActiveSlab) ? 'none' : '0 2px 4px rgba(240, 100, 28, 0.15)'
                                            }}
                                            onClick={() => dispatch({ type: 'add', product, qty, maxQty: stock, slab })}
                                            disabled={stock < qty || hasDifferentActiveSlab}
                                          >
                                            {hasDifferentActiveSlab ? 'Locked' : `Add ${qty}`}
                                          </motion.button>
                                        ) : (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <motion.button
                                              type="button"
                                              whileTap={{ scale: 0.9 }}
                                              style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                              onClick={() => dispatch({
                                                type: 'set_qty',
                                                id: product.id,
                                                product,
                                                qty: currentQty - qty,
                                                slab: currentQty - qty >= qty ? slab : null
                                              })}
                                            >
                                              −
                                            </motion.button>
                                            <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', minWidth: 42, textAlign: 'center' }}>
                                              {slabCount} slab{slabCount > 1 ? 's' : ''}
                                            </span>
                                            <motion.button
                                              type="button"
                                              whileTap={{ scale: 0.9 }}
                                              style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: canIncrease ? 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)' : '#e2e8f0', color: canIncrease ? '#fff' : '#cbd5e0', fontSize: 13, fontWeight: 800, cursor: canIncrease ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                              onClick={() => dispatch({ type: 'add', product, qty, maxQty: stock, slab })}
                                              disabled={!canIncrease}
                                            >
                                              +
                                            </motion.button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Divider */}
                          <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />

                          {/* Price and Stock Status */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Unit Price</div>
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 18 }}>₹{price}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Available Stock</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>{stock || 0} Units</div>
                            </div>
                          </div>

                          {/* Add to Cart Section */}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                            {quantityInCart > 0 ? (
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flex: 1, width: '100%' }}>
                                <motion.button
                                  type="button"
                                  whileHover={{ backgroundColor: '#f1f5f9' }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => dispatch({ type: 'remove', id: product.id })}
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 12,
                                    border: '1px solid #e2e8f0',
                                    background: '#f8fafc',
                                    fontSize: 18,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    color: '#64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  −
                                </motion.button>
                                <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{quantityInCart}</div>
                                <motion.button
                                  type="button"
                                  whileHover={{ scale: quantityInCart >= stock ? 1 : 1.03 }}
                                  whileTap={{ scale: quantityInCart >= stock ? 1 : 0.95 }}
                                  onClick={() => { if (quantityInCart < stock) dispatch({ type: 'add', product, maxQty: stock }) }}
                                  disabled={quantityInCart >= stock}
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 12,
                                    border: 'none',
                                    background: quantityInCart >= stock ? '#e2e8f0' : 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)',
                                    fontSize: 18,
                                    fontWeight: 700,
                                    cursor: quantityInCart >= stock ? 'not-allowed' : 'pointer',
                                    color: quantityInCart >= stock ? '#cbd5e0' : '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: quantityInCart >= stock ? 'none' : '0 4px 10px rgba(240, 100, 28, 0.2)'
                                  }}
                                >
                                  +
                                </motion.button>
                              </div>
                            ) : (
                              <motion.button
                                type="button"
                                whileHover={{ scale: stock > 0 ? 1.02 : 1 }}
                                whileTap={{ scale: stock > 0 ? 0.98 : 1 }}
                                onClick={() => dispatch({ type: 'add', product, maxQty: stock })}
                                disabled={stock <= 0}
                                style={{
                                  flex: 1,
                                  padding: '12px 16px',
                                  borderRadius: 12,
                                  border: 'none',
                                  background: stock > 0 ? 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)' : '#e2e8f0',
                                  color: stock > 0 ? '#fff' : '#94a3b8',
                                  fontSize: 13,
                                  fontWeight: 800,
                                  cursor: stock > 0 ? 'pointer' : 'not-allowed',
                                  boxShadow: stock > 0 ? '0 4px 12px rgba(240, 100, 28, 0.15)' : 'none',
                                  transition: 'background 0.2s'
                                }}
                              >
                                {stock > 0 ? '🛒 Add to Cart' : 'Notify Me'}
                              </motion.button>
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
              <span>
                Showing {filteredProducts.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} results
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: '1px solid #ecdcc4',
                    background: currentPage === 1 ? '#f8fafc' : '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    color: currentPage === 1 ? '#cbd5e0' : '#475569',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(53, 36, 20, 0.02)',
                    transition: 'all 0.2s'
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', padding: '0 4px' }}>
                  Page {currentPage} of {Math.max(totalPages, 1)}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: currentPage >= totalPages ? '#e2e8f0' : 'linear-gradient(135deg, #f7a938 0%, #f0641c 100%)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: currentPage >= totalPages ? '#cbd5e0' : '#fff',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    boxShadow: currentPage >= totalPages ? 'none' : '0 4px 8px rgba(240, 100, 28, 0.15)',
                    transition: 'all 0.2s'
                  }}
                >
                  Next
                </button>
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
