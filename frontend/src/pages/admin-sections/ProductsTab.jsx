import React, { useEffect, useMemo, useState } from 'react'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useMediaQuery } from '../../lib/useMediaQuery'

const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')

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

// Helpers for backward-compatible metadata serialization inside the description column
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

export function serializeProductMetadata({ description, sku, features, specifications, stock_history }) {
  return JSON.stringify({
    description: description || '',
    sku: sku || '',
    features: Array.isArray(features) ? features : [],
    specifications: specifications || {},
    stock_history: Array.isArray(stock_history) ? stock_history : []
  })
}

function deriveBrand(name = '') {
  const matchers = [
    { label: 'PEPSI', regex: /pepsi/i },
    { label: 'DEW', regex: /mountain\s*dew/i },
    { label: 'LAYS', regex: /lays/i },
    { label: '7UP', regex: /7up/i },
    { label: 'AQF', regex: /aquafina/i },
    { label: 'STG', regex: /sting/i }
  ]
  const match = matchers.find(m => m.regex.test(name))
  if (match) return match.label
  const firstWord = name.split(' ')[0] || 'PEP'
  return firstWord.slice(0, 3).toUpperCase()
}

const EMPTY_FORM = {
  name: '',
  category: '',
  price: '',
  stock: '',
  description: '',
  image_url: '',
  sku: '',
  features: [],
  specifications: {}
}

const STANDARD_SPEC_KEYS = [
  'Volume',
  'Packaging Type',
  'Shelf Life',
  'Units per Case',
  'Calories',
  'Sugar Content',
  'Flavour',
  'Storage Temp'
]

const STANDARD_FEATURE_SUGGESTIONS = [
  'Zero Calories',
  '100% Real Fruit Juice',
  'No Added Preservatives',
  'Caffeine Free',
  'Gluten Free',
  'Best Served Chilled',
  'High Energy Blend',
  'Crunchy & Delicious'
]

export default function ProductsTab({ managerMode = false }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Dashboard & Forms State
  const [activeSubTab, setActiveSubTab] = useState('catalogue') // 'catalogue' | 'inventory'
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [searchQuery, setSearchQuery] = useState('')
  const [inventorySearchQuery, setInventorySearchQuery] = useState('')
  const [stockFilter, setStockFilter] = useState('all') // 'all' | 'low' | 'out' | 'healthy'
  
  // Media Input helper states
  const [isDragging, setIsDragging] = useState(false)
  const [mediaName, setMediaName] = useState('')
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [pasteSuccess, setPasteSuccess] = useState(false)
  
  // Form feature/specification helpers
  const [featureInput, setFeatureInput] = useState('')
  const [editingFeatureIndex, setEditingFeatureIndex] = useState(-1)
  const [editingFeatureText, setEditingFeatureText] = useState('')
  const [specKeyInput, setSpecKeyInput] = useState('')
  const [specValInput, setSpecValInput] = useState('')

  // Stock Modals State
  const [historyModalProduct, setHistoryModalProduct] = useState(null)
  const [adjustModalProduct, setAdjustModalProduct] = useState(null)
  const [adjustTargetStock, setAdjustTargetStock] = useState('')
  const [adjustReason, setAdjustReason] = useState('Inventory audit correction')
  const [adjustCustomReason, setAdjustCustomReason] = useState('')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkAdjustments, setBulkAdjustments] = useState({}) // { [productId]: adjustmentOffsetNumber }
  const [bulkReason, setBulkReason] = useState('Weekly stock replenishment')

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

  // Global paste handler for images
  useEffect(() => {
    function onPaste(e) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            handleMediaFile(file)
            setPasteSuccess(true)
            setTimeout(() => setPasteSuccess(false), 2500)
          }
          break
        }
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Parses description columns and filters products
  const parsedProductsList = useMemo(() => {
    return products.map(product => {
      const meta = parseProductMetadata(product.description)
      return {
        ...product,
        parsedMeta: meta,
        stockNum: parseInt(product.stock || 0, 10)
      }
    })
  }, [products])

  const filteredCatalogueProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return parsedProductsList
    return parsedProductsList.filter((product) => {
      const haystack = [product.name, product.category, product.parsedMeta.sku]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [parsedProductsList, searchQuery])

  const filteredInventoryProducts = useMemo(() => {
    const query = inventorySearchQuery.trim().toLowerCase()
    let list = parsedProductsList

    if (query) {
      list = list.filter((product) => {
        const haystack = [product.name, product.category, product.parsedMeta.sku]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(query)
      })
    }

    if (stockFilter === 'low') {
      list = list.filter(p => p.stockNum > 0 && p.stockNum <= 50)
    } else if (stockFilter === 'out') {
      list = list.filter(p => p.stockNum === 0)
    } else if (stockFilter === 'healthy') {
      list = list.filter(p => p.stockNum > 50)
    }

    return list
  }, [parsedProductsList, inventorySearchQuery, stockFilter])

  // KPI Calculations
  const metrics = useMemo(() => {
    const total = parsedProductsList.length
    const totalVal = parsedProductsList.reduce((sum, p) => sum + (parseFloat(p.price || 0) * p.stockNum), 0)
    const lowStock = parsedProductsList.filter(p => p.stockNum > 0 && p.stockNum <= 50).length
    const outOfStock = parsedProductsList.filter(p => p.stockNum === 0).length
    return { total, totalVal, lowStock, outOfStock }
  }, [parsedProductsList])

  // Save Product (Create or Edit)
  async function handleSave() {
    try {
      const parsedPrice = parseFloat(form.price)
      const parsedStock = parseInt(form.stock, 10)
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        alert('Please enter a valid price.')
        return
      }
      if (isNaN(parsedStock) || parsedStock < 0) {
        alert('Please enter a valid stock level.')
        return
      }

      // Generate SKU automatically if empty
      let currentSku = form.sku.trim()
      if (!currentSku) {
        const brand = deriveBrand(form.name)
        const catCode = form.category ? form.category.slice(0, 3).toUpperCase() : 'GEN'
        const sizeMatch = form.name.match(/(\d+)\s*(ml|l|kg|g|pack)/i)
        const size = sizeMatch ? `${sizeMatch[1]}${sizeMatch[2].toUpperCase()}` : 'SKU'
        currentSku = `${brand}-${catCode}-${size}-${Math.floor(100 + Math.random() * 900)}`
      }

      let currentHistory = []
      if (editing) {
        const existing = products.find(p => p.id === editing)
        const meta = parseProductMetadata(existing?.description)
        currentHistory = meta.stock_history || []
        
        const oldStock = parseInt(existing?.stock || 0, 10)
        if (oldStock !== parsedStock) {
          const diff = parsedStock - oldStock
          currentHistory.push({
            timestamp: new Date().toISOString(),
            change: diff > 0 ? `+${diff}` : String(diff),
            newStock: parsedStock,
            reason: 'Form details updated',
            user: managerMode ? 'Manager' : 'Admin'
          })
        }
      } else {
        currentHistory.push({
          timestamp: new Date().toISOString(),
          change: `+${parsedStock}`,
          newStock: parsedStock,
          reason: 'Product record created',
          user: managerMode ? 'Manager' : 'Admin'
        })
      }

      const serializedDescription = serializeProductMetadata({
        description: form.description,
        sku: currentSku,
        features: form.features,
        specifications: form.specifications,
        stock_history: currentHistory
      })

      const payload = {
        name: form.name.trim(),
        category: form.category,
        price: parsedPrice,
        stock: parsedStock,
        description: serializedDescription,
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
    const meta = parseProductMetadata(product.description)
    setEditing(product.id)
    setForm({
      name: product.name || '',
      category: product.category || '',
      price: String(product.price || ''),
      stock: String(product.stock || ''),
      description: meta.description || '',
      image_url: product.image_url || '',
      sku: meta.sku || '',
      features: meta.features || [],
      specifications: meta.specifications || {}
    })
    setMediaName(product.image_url ? 'Saved image' : '')
    setActiveSubTab('catalogue') // Switch to editor tab
  }

  // Stock Quick Increments / Adjustments with history tracking
  async function quickUpdateStock(product, newStock, reason = 'Quick inventory adjust') {
    if (newStock < 0 || isNaN(newStock)) return
    try {
      const meta = parseProductMetadata(product.description)
      const oldStock = parseInt(product.stock || 0, 10)
      const diff = newStock - oldStock
      if (diff === 0) return

      const updatedHistory = [...(meta.stock_history || [])]
      updatedHistory.push({
        timestamp: new Date().toISOString(),
        change: diff > 0 ? `+${diff}` : String(diff),
        newStock,
        reason,
        user: managerMode ? 'Manager' : 'Admin'
      })

      const serializedDesc = serializeProductMetadata({
        ...meta,
        stock_history: updatedHistory
      })

      const payload = {
        name: product.name,
        category: product.category,
        price: parseFloat(product.price),
        stock: newStock,
        description: serializedDesc,
        image_url: product.image_url
      }

      const url = managerMode
        ? `${API_BASE}/api/manager/products/${product.id}`
        : `${API_BASE}/api/admin/products/${product.id}`

      const headers = managerMode
        ? { 'Content-Type': 'application/json', 'x-manager-token': managerToken }
        : { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey }

      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to update stock')
      }

      // Update local state directly for instant feedback
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock, description: serializedDesc } : p))
    } catch (err) {
      alert(`Error updating stock: ${err.message || 'Unknown error'}`)
    }
  }

  // Trigger inline single setting modal
  const openAdjustModal = (product) => {
    setAdjustModalProduct(product)
    setAdjustTargetStock(String(product.stock))
    setAdjustReason('Inventory audit correction')
    setAdjustCustomReason('')
  }

  const handleAdjustSubmit = async (e) => {
    e.preventDefault()
    if (!adjustModalProduct) return
    const newStock = parseInt(adjustTargetStock, 10)
    if (isNaN(newStock) || newStock < 0) {
      alert('Enter a valid stock number.')
      return
    }
    const finalReason = adjustReason === 'Other' ? adjustCustomReason.trim() : adjustReason
    if (!finalReason) {
      alert('Provide a reason for the adjustment.')
      return
    }
    await quickUpdateStock(adjustModalProduct, newStock, finalReason)
    setAdjustModalProduct(null)
  }

  // Bulk Adjustment
  const openBulkModal = () => {
    const initial = {}
    products.forEach(p => {
      initial[p.id] = 0
    })
    setBulkAdjustments(initial)
    setBulkReason('Weekly stock replenishment')
    setShowBulkModal(true)
  }

  const handleBulkChange = (prodId, val) => {
    const num = parseInt(val, 10)
    setBulkAdjustments(prev => ({
      ...prev,
      [prodId]: isNaN(num) ? 0 : num
    }))
  }

  const handleBulkSubmit = async () => {
    const editsToRun = Object.keys(bulkAdjustments).filter(id => bulkAdjustments[id] !== 0)
    if (editsToRun.length === 0) {
      setShowBulkModal(false)
      return
    }
    const finalReason = bulkReason.trim() || 'Bulk stock adjust'

    setLoading(true)
    try {
      for (const prodId of editsToRun) {
        const prod = products.find(p => p.id === prodId)
        if (!prod) continue
        const offset = bulkAdjustments[prodId]
        const currentStock = parseInt(prod.stock || 0, 10)
        const nextStock = Math.max(0, currentStock + offset)
        await quickUpdateStock(prod, nextStock, finalReason)
      }
      setShowBulkModal(false)
    } catch (err) {
      alert(`Error in bulk adjustments: ${err.message}`)
    } finally {
      setLoading(false)
      fetchProducts()
    }
  }

  // SKU helper
  const handleAutoGenerateSku = () => {
    const brand = deriveBrand(form.name)
    const catCode = form.category ? form.category.slice(0, 3).toUpperCase() : 'GEN'
    const sizeMatch = form.name.match(/(\d+)\s*(ml|l|kg|g|pack)/i)
    const size = sizeMatch ? `${sizeMatch[1]}${sizeMatch[2].toUpperCase()}` : 'SKU'
    const generated = `${brand}-${catCode}-${size}-${Math.floor(100 + Math.random() * 900)}`
    setForm(prev => ({ ...prev, sku: generated }))
  }

  // Feature actions
  const handleAddFeature = () => {
    const text = featureInput.trim()
    if (!text) return
    setForm(prev => ({ ...prev, features: [...prev.features, text] }))
    setFeatureInput('')
  }

  const handleApplyTemplateFeature = (val) => {
    if (form.features.includes(val)) return
    setForm(prev => ({ ...prev, features: [...prev.features, val] }))
  }

  const startEditFeature = (idx, text) => {
    setEditingFeatureIndex(idx)
    setEditingFeatureText(text)
  }

  const saveEditFeature = (idx) => {
    const text = editingFeatureText.trim()
    if (!text) return
    setForm(prev => {
      const next = [...prev.features]
      next[idx] = text
      return { ...prev, features: next }
    })
    setEditingFeatureIndex(-1)
  }

  const handleMoveFeature = (idx, dir) => {
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= form.features.length) return
    setForm(prev => {
      const next = [...prev.features]
      const temp = next[idx]
      next[idx] = next[targetIdx]
      next[targetIdx] = temp
      return { ...prev, features: next }
    })
  }

  // Specifications actions
  const handleAddSpec = () => {
    const key = specKeyInput.trim()
    const val = specValInput.trim()
    if (!key || !val) return
    setForm(prev => ({
      ...prev,
      specifications: { ...prev.specifications, [key]: val }
    }))
    setSpecKeyInput('')
    setSpecValInput('')
  }

  const handleDeleteSpec = (key) => {
    setForm(prev => {
      const next = { ...prev.specifications }
      delete next[key]
      return { ...prev, specifications: next }
    })
  }

  // Image helpers
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
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = dataUrl
    })
  }

  function handleMediaFile(file) {
    if (!file) return
    setMediaName(file.name)
    const reader = new FileReader()
    reader.onload = async () => {
      const compressed = await compressImage(reader.result)
      setForm((prev) => ({ ...prev, image_url: compressed || '' }))
    }
    reader.readAsDataURL(file)
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) handleMediaFile(file)
  }

  async function handleUrlImport() {
    const url = imageUrlInput.trim()
    if (!url) return
    setUrlLoading(true)
    setUrlError('')
    try {
      const res = await fetch(`${API_BASE}/api/admin/proxy-image?url=${encodeURIComponent(url)}`, {
        headers: { 'x-admin-api-key': adminKey }
      })
      if (!res.ok) throw new Error('Failed to fetch image via proxy.')
      const blob = await res.blob()
      const reader = new FileReader()
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result)
        setForm((prev) => ({ ...prev, image_url: compressed }))
        setMediaName('Imported URL Image')
        setImageUrlInput('')
      }
      reader.readAsDataURL(blob)
    } catch (err) {
      setUrlError(err.message || 'Could not proxy image.')
    } finally {
      setUrlLoading(false)
    }
  }

  if (loading && products.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 16 }}>Loading product catalog details...</div>
  }

  return (
    <div style={{ display: 'grid', gap: 24, color: '#0f172a' }}>
      
      {/* ── SUB-TABS NAVIGATION ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: 20 }}>
        <button
          onClick={() => setActiveSubTab('catalogue')}
          style={{
            padding: '12px 6px',
            fontSize: 15,
            fontWeight: 700,
            color: activeSubTab === 'catalogue' ? '#4f46e5' : '#64748b',
            border: 0,
            borderBottom: activeSubTab === 'catalogue' ? '3px solid #4f46e5' : '3px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          📂 Product Catalogue Editor
        </button>
        <button
          onClick={() => setActiveSubTab('inventory')}
          style={{
            padding: '12px 6px',
            fontSize: 15,
            fontWeight: 700,
            color: activeSubTab === 'inventory' ? '#4f46e5' : '#64748b',
            border: 0,
            borderBottom: activeSubTab === 'inventory' ? '3px solid #4f46e5' : '3px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          📈 Stock & Inventory Control
        </button>
      </div>

      {/* ── TAB 1: PRODUCT CATALOGUE EDITOR ── */}
      {activeSubTab === 'catalogue' && (
        <div style={{ display: 'grid', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1.4fr 1fr', gap: 24, alignItems: 'start' }}>
            
            {/* Form card */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1px solid #e5e7eb', boxShadow: '0 8px 30px rgba(15,23,42,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', fontWeight: 800 }}>+</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{editing ? 'Update Product Details' : 'Add Product to Catalogue'}</div>
              </div>

              <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Product Name</label>
                    <input
                      placeholder="e.g. Pepsi Black 500ml"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, background: '#fff' }}
                    >
                      <option value="">Select Category</option>
                      <option value="Beverages">Beverages</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Packaged Foods">Packaged Foods</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Pricing (per unit)</label>
                    <input
                      type="number"
                      placeholder="₹0.00"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Initial Stock Level</label>
                    <input
                      type="number"
                      placeholder="Units in warehouse"
                      value={form.stock}
                      onChange={(e) => setForm({ ...form, stock: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>
                </div>


                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Clean Description Text</label>
                  <textarea
                    placeholder="Provide details about size, taste, pack contents..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, minHeight: 70, resize: 'vertical' }}
                  />
                </div>

                {/* ── ADVANCED FEATURES BUILDER ── */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: '#f8fafc' }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}>Product Features List ({form.features.length})</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input
                      placeholder="Add key feature... (e.g. Low Calories)"
                      value={featureInput}
                      onChange={(e) => setFeatureInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddFeature()}
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                    />
                    <button
                      type="button"
                      onClick={handleAddFeature}
                      style={{ padding: '8px 14px', background: '#4f46e5', color: '#fff', border: 0, borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                    >
                      Add
                    </button>
                  </div>

                  {/* Suggestion list */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {STANDARD_FEATURE_SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleApplyTemplateFeature(s)}
                        style={{ padding: '4px 8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 999, fontSize: 11, color: '#475569', cursor: 'pointer' }}
                      >
                        + {s}
                      </button>
                    ))}
                  </div>

                  {form.features.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>No features listed yet.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {form.features.map((feature, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
                          {editingFeatureIndex === idx ? (
                            <input
                              value={editingFeatureText}
                              onChange={(e) => setEditingFeatureText(e.target.value)}
                              onBlur={() => saveEditFeature(idx)}
                              onKeyDown={(e) => e.key === 'Enter' && saveEditFeature(idx)}
                              autoFocus
                              style={{ flex: 1, padding: '4px 6px', border: '1px solid #4f46e5', borderRadius: 4 }}
                            />
                          ) : (
                            <span style={{ fontWeight: 600 }}>• {feature}</span>
                          )}

                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleMoveFeature(idx, 'up')}
                              disabled={idx === 0}
                              style={{ background: 'none', border: 0, cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveFeature(idx, 'down')}
                              disabled={idx === form.features.length - 1}
                              style={{ background: 'none', border: 0, cursor: idx === form.features.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === form.features.length - 1 ? 0.3 : 1 }}
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditFeature(idx, feature)}
                              style={{ background: 'none', border: 0, cursor: 'pointer', color: '#4f46e5' }}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => setForm(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }))}
                              style={{ background: 'none', border: 0, cursor: 'pointer', color: '#dc2626', fontWeight: 800 }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── PRODUCT SPECIFICATIONS ── */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: '#f8fafc' }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}>Product Specifications</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <select
                      value={specKeyInput}
                      onChange={(e) => setSpecKeyInput(e.target.value)}
                      style={{ flex: '1 1 120px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, background: '#fff' }}
                    >
                      <option value="">Custom key...</option>
                      {STANDARD_SPEC_KEYS.map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                    <input
                      placeholder="Type custom name if not in list"
                      value={specKeyInput}
                      onChange={(e) => setSpecKeyInput(e.target.value)}
                      style={{ flex: '1 1 120px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                    />
                    <input
                      placeholder="Value (e.g. 500ml)"
                      value={specValInput}
                      onChange={(e) => setSpecValInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSpec()}
                      style={{ flex: '1 1 120px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                    />
                    <button
                      type="button"
                      onClick={handleAddSpec}
                      style={{ padding: '8px 14px', background: '#4f46e5', color: '#fff', border: 0, borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                    >
                      Set Spec
                    </button>
                  </div>

                  {Object.keys(form.specifications).length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>No specifications configured.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {Object.entries(form.specifications).map(([key, val]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
                          <div>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>{key}: </span>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{val}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteSpec(key)}
                            style={{ background: 'none', border: 0, cursor: 'pointer', color: '#dc2626', fontWeight: 800 }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={handleSave}
                    disabled={!form.name || !form.category || !form.price || !form.stock}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: 0,
                      background: (!form.name || !form.category || !form.price || !form.stock) ? '#cbd5e1' : '#4f46e5',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: (!form.name || !form.category || !form.price || !form.stock) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {editing ? '💾 Save Updates' : '🆕 Create Product'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(null)
                      setForm(EMPTY_FORM)
                      setMediaName('')
                    }}
                    style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Column & Product Media upload */}
            <div style={{ display: 'grid', gap: 24 }}>
              
              {/* Media management */}
              <div style={{ background: '#fff', borderRadius: 20, padding: 20, border: '1px solid #e5e7eb', boxShadow: '0 8px 30px rgba(15,23,42,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🖼️</div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>Product Media</div>
                </div>

                {/* Drag / Drop */}
                <label
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${isDragging ? '#4f46e5' : pasteSuccess ? '#10b981' : '#cbd5e1'}`,
                    background: isDragging ? '#f5f7ff' : pasteSuccess ? '#ecfdf5' : '#f8fafc',
                    borderRadius: 12,
                    padding: '24px 16px',
                    display: 'grid',
                    gap: 8,
                    alignItems: 'center',
                    justifyItems: 'center',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <input type="file" accept="image/*" onChange={(e) => handleMediaFile(e.target.files?.[0])} style={{ display: 'none' }} />
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: pasteSuccess ? '#d1fae5' : '#e0e7ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, color: pasteSuccess ? '#10b981' : '#4f46e5'
                  }}>
                    {pasteSuccess ? '✓' : '📷'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                    {pasteSuccess ? 'Image Pasted!' : 'Drop Image file or Click to Upload'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Supports PNG, JPG, WebP. Max 5MB</div>
                  {mediaName && !pasteSuccess && <div style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>📎 {mediaName}</div>}
                </label>

                {/* URL import */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>🔗 Import from URL</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="url"
                      placeholder="https://example.com/coke.jpg"
                      value={imageUrlInput}
                      onChange={(e) => { setImageUrlInput(e.target.value); setUrlError('') }}
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13 }}
                    />
                    <button
                      onClick={handleUrlImport}
                      disabled={!imageUrlInput.trim() || urlLoading}
                      style={{ padding: '8px 14px', background: '#4f46e5', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
                    >
                      {urlLoading ? '⏳' : 'Import'}
                    </button>
                  </div>
                  {urlError && <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626' }}>⚠️ {urlError}</div>}
                </div>
              </div>

              {/* Catalogue Live Preview */}
              <div style={{ background: '#fff', borderRadius: 20, padding: 20, border: '1px solid #e5e7eb', boxShadow: '0 8px 30px rgba(15,23,42,0.03)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>LIVE CATALOGUE PREVIEW</div>
                
                <div style={{ borderRadius: 16, background: '#f8fafc', padding: 16, border: '1px solid #cbd5e1', display: 'grid', gap: 12 }}>
                  <div style={{ height: 160, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', overflow: 'hidden', padding: 12, boxSizing: 'border-box' }}>
                    {form.image_url ? (
                      <img src={form.image_url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: 13 }}>No Image Asset</div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{form.category || 'Category'}</span>
                    </div>
                    <div style={{ fontWeight: 950, fontSize: 18, color: '#0f172a' }}>{form.name || 'Product Title'}</div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{form.description || 'Describe product to show preview text...'}</div>
                  </div>

                  {/* Rendering structured features inside preview */}
                  {form.features.length > 0 && (
                    <div style={{ padding: '6px 0', borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Key Highlights:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {form.features.slice(0, 3).map((f, i) => (
                          <span key={i} style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>✓ {f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rendering specifications inside preview */}
                  {Object.keys(form.specifications).length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '6px 0', borderTop: '1px solid #e2e8f0', fontSize: 11 }}>
                      {Object.entries(form.specifications).slice(0, 4).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', background: '#fff', padding: '4px 6px', borderRadius: 4 }}>
                          <span style={{ color: '#64748b' }}>{k}</span>
                          <span style={{ fontWeight: 700 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>Sale Price</div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>₹{form.price || '0.00'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: Number(form.stock) > 0 ? '#15803d' : '#b91c1c', background: Number(form.stock) > 0 ? '#dcfce7' : '#fef2f2', padding: '3px 8px', borderRadius: 999 }}>
                        {Number(form.stock) > 0 ? `${form.stock} In Stock` : 'Out of Stock'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Catalogue List Table */}
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 8px 30px rgba(15,23,42,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Products Catalog Index</div>
              <input
                placeholder="Filter index..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13 }}
              />
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700 }}>PRODUCT</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700 }}>CATEGORY</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700 }}>PRICE</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700 }}>STOCK</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 11, color: '#64748b', fontWeight: 700 }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalogueProducts.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No products match this query.</td>
                    </tr>
                  ) : (
                    filteredCatalogueProducts.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {p.image_url ? (
                                <img src={p.image_url} alt="p" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              ) : (
                                <span style={{ fontSize: 16 }}>🥤</span>
                              )}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600 }}>{p.category}</td>
                        <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700 }}>₹{parseFloat(p.price || 0).toFixed(2)}</td>
                        <td style={{ padding: '12px 20px', fontSize: 13 }}>
                          <span style={{ fontWeight: 700, color: p.stockNum > 50 ? '#059669' : p.stockNum > 0 ? '#d97706' : '#dc2626' }}>
                            {p.stock}
                          </span>
                        </td>
                        <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                              onClick={() => editProduct(p)}
                              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12 }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              disabled={managerMode}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1px solid #fecaca',
                                background: managerMode ? '#fff' : '#fef2f2',
                                color: managerMode ? '#94a3b8' : '#dc2626',
                                cursor: managerMode ? 'not-allowed' : 'pointer',
                                fontSize: 12
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: STOCK & INVENTORY CONTROL ── */}
      {activeSubTab === 'inventory' && (
        <div style={{ display: 'grid', gap: 20 }}>
          
          {/* Inventory KPIs grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {/* KPI 1: Catalog Items */}
            <div style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📦</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Catalog Items</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{metrics.total} products</div>
              </div>
            </div>

            {/* KPI 2: Stock Value */}
            <div style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>💰</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Stock Value</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981', marginTop: 4 }}>
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(metrics.totalVal)}
                </div>
              </div>
            </div>

            {/* KPI 3: Low Stock Items */}
            <div style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>⚠️</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Low Stock Items</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: metrics.lowStock > 0 ? '#b45309' : '#0f172a', marginTop: 4 }}>{metrics.lowStock} alerts</div>
              </div>
            </div>

            {/* KPI 4: Out of Stock */}
            <div style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🚨</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Out of Stock</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: metrics.outOfStock > 0 ? '#dc2626' : '#0f172a', marginTop: 4 }}>{metrics.outOfStock} items</div>
              </div>
            </div>
          </div>
          
          {/* Controls Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: 16, borderRadius: 16, border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
              <input
                placeholder="Search inventory..."
                value={inventorySearchQuery}
                onChange={(e) => setInventorySearchQuery(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, minWidth: 200 }}
              />
              
              <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  onClick={() => setStockFilter('all')}
                  style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, border: 0, background: stockFilter === 'all' ? '#e2e8f0' : '#fff', cursor: 'pointer' }}
                >
                  All
                </button>
                <button
                  onClick={() => setStockFilter('low')}
                  style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, border: 0, background: stockFilter === 'low' ? '#fef3c7' : '#fff', color: '#b45309', cursor: 'pointer' }}
                >
                  Low Stock
                </button>
                <button
                  onClick={() => setStockFilter('out')}
                  style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, border: 0, background: stockFilter === 'out' ? '#fee2e2' : '#fff', color: '#dc2626', cursor: 'pointer' }}
                >
                  Out of Stock
                </button>
              </div>
            </div>

            <button
              onClick={openBulkModal}
              style={{ padding: '10px 16px', background: '#4f46e5', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
            >
              📦 Bulk Stock Adjuster
            </button>
          </div>

          {/* Inventory control Table */}
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 8px 30px rgba(15,23,42,0.02)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700 }}>PRODUCT INVENTORY</th>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700 }}>STOCK STATE</th>
                    <th style={{ padding: '14px 20px', textAlign: 'center', fontSize: 11, color: '#64748b', fontWeight: 700 }}>QUICK UPDATE</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: 11, color: '#64748b', fontWeight: 700 }}>AUDIT HISTORY</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventoryProducts.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No inventory matches.</td>
                    </tr>
                  ) : (
                    filteredInventoryProducts.map(p => {
                      const isLow = p.stockNum > 0 && p.stockNum <= 50
                      const isOut = p.stockNum === 0
                      
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {p.image_url ? (
                                  <img src={p.image_url} alt="p" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                ) : (
                                  <span style={{ fontSize: 16 }}>🥤</span>
                                )}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{p.category}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 800,
                                background: isOut ? '#fef2f2' : isLow ? '#fffbeb' : '#ecfdf5',
                                color: isOut ? '#b91c1c' : isLow ? '#b45309' : '#047857'
                              }}>
                                {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Good Stock'}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>({p.stockNum} Units)</span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                              <button
                                onClick={() => quickUpdateStock(p, Math.max(0, p.stockNum - 1), 'Quick decrement (-1)')}
                                disabled={isOut}
                                style={{
                                  width: 26, height: 26, display: 'grid', placeItems: 'center',
                                  background: isOut ? '#f1f5f9' : '#fee2e2',
                                  color: isOut ? '#cbd5e1' : '#dc2626',
                                  border: 0, borderRadius: 6, cursor: isOut ? 'not-allowed' : 'pointer',
                                  fontWeight: 800, fontSize: 14
                                }}
                              >
                                -
                              </button>
                              
                              <button
                                onClick={() => quickUpdateStock(p, p.stockNum + 1, 'Quick increment (+1)')}
                                style={{
                                  width: 26, height: 26, display: 'grid', placeItems: 'center',
                                  background: '#dcfce7', color: '#16a34a',
                                  border: 0, borderRadius: 6, cursor: 'pointer',
                                  fontWeight: 800, fontSize: 14
                                }}
                              >
                                +
                              </button>

                              <button
                                onClick={() => openAdjustModal(p)}
                                style={{ padding: '4px 10px', fontSize: 11, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontWeight: 700, color: '#4f46e5' }}
                              >
                                Set Stock
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <button
                              onClick={() => setHistoryModalProduct(p)}
                              style={{ padding: '5px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#475569' }}
                            >
                              📋 History ({p.parsedMeta.stock_history?.length || 0})
                            </button>
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
      )}

      {/* ── MODAL: STOCK ADJUST REASON PROMPT ── */}
      {adjustModalProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 1100 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Manual Stock Adjustment</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginBottom: 16 }}>{adjustModalProduct.name}</p>
            
            <form onSubmit={handleAdjustSubmit} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Set Target Stock Level</label>
                <input
                  type="number"
                  value={adjustTargetStock}
                  onChange={(e) => setAdjustTargetStock(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Reason for Adjustment</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff' }}
                >
                  <option value="Inventory audit correction">Inventory audit correction</option>
                  <option value="Restock shipment received">Restock shipment received</option>
                  <option value="Damaged box write-off">Damaged box write-off</option>
                  <option value="Customer return restock">Customer return restock</option>
                  <option value="Other">Other (Type custom reason below)</option>
                </select>
              </div>

              {adjustReason === 'Other' && (
                <div>
                  <input
                    placeholder="Enter custom audit reason..."
                    value={adjustCustomReason}
                    onChange={(e) => setAdjustCustomReason(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setAdjustModalProduct(null)}
                  style={{ padding: '8px 14px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                >
                  Confirm Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: STOCK ADJUSTMENT AUDIT LOG VIEWER ── */}
      {historyModalProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 1100 }} onClick={() => setHistoryModalProduct(null)}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 16, width: '90%', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Inventory Audit Log</h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{historyModalProduct.name} • SKU: {historyModalProduct.parsedMeta.sku || 'None'}</div>
              </div>
              <button
                onClick={() => setHistoryModalProduct(null)}
                style={{ background: 'none', border: 0, fontSize: 24, color: '#94a3b8', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {(!historyModalProduct.parsedMeta.stock_history || historyModalProduct.parsedMeta.stock_history.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>No audit records found for this product.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left', color: '#64748b' }}>Date & Time</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', color: '#64748b' }}>Operator</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', color: '#64748b' }}>Change</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', color: '#64748b' }}>New Stock</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', color: '#64748b' }}>Reason / Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyModalProduct.parsedMeta.stock_history.map((log, idx) => {
                      const isPositive = String(log.change).startsWith('+')
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 8px', color: '#64748b' }}>{new Date(log.timestamp).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 8px', fontWeight: 600 }}>{log.user || 'Admin'}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: isPositive ? '#059669' : '#dc2626' }}>{log.change}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>{log.newStock}</td>
                          <td style={{ padding: '10px 8px', color: '#334155' }}>{log.reason || 'Manual Quick adjust'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setHistoryModalProduct(null)}
                style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
              >
                Close Audit Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BULK INVENTORY ADJUSTER ── */}
      {showBulkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 1100 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 16, width: '90%', maxWidth: 700, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Bulk Stock Adjustments</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginTop: 4 }}>Apply increment or decrement offsets across multiple products at once.</p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 12, paddingRight: 6 }}>
              {products.map(p => {
                const meta = parseProductMetadata(p.description)
                const currentStock = parseInt(p.stock || 0, 10)
                const currentOffset = bulkAdjustments[p.id] || 0
                const nextStock = Math.max(0, currentStock + currentOffset)

                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <span style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>SKU: {meta.sku || 'None'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ fontSize: 12, color: '#475569' }}>
                        <span>Stock: <b>{currentStock}</b></span>
                        <span style={{ margin: '0 6px' }}>➔</span>
                        <span>Next: <b style={{ color: nextStock !== currentStock ? '#4f46e5' : '#475569' }}>{nextStock}</b></span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => handleBulkChange(p.id, currentOffset - 10)}
                          style={{ padding: '4px 8px', fontSize: 11, background: '#fee2e2', color: '#dc2626', border: 0, borderRadius: 4, cursor: 'pointer' }}
                        >
                          -10
                        </button>
                        <input
                          type="number"
                          value={currentOffset === 0 ? '' : currentOffset}
                          onChange={(e) => handleBulkChange(p.id, e.target.value)}
                          placeholder="Offset (+/-)"
                          style={{ width: 80, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                        />
                        <button
                          onClick={() => handleBulkChange(p.id, currentOffset + 10)}
                          style={{ padding: '4px 8px', fontSize: 11, background: '#dcfce7', color: '#16a34a', border: 0, borderRadius: 4, cursor: 'pointer' }}
                        >
                          +10
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16, display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Bulk Audit Reason</label>
                <input
                  placeholder="e.g. Weekly batch restock from PepsiCo depot"
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowBulkModal(false)}
                  style={{ padding: '10px 16px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkSubmit}
                  style={{ padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                >
                  Apply Batch Adjustments
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
