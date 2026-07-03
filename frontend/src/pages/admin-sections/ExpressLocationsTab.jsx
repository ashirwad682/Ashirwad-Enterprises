import React, { useState, useEffect, useCallback } from 'react'
import { STATE_DISTRICTS_MAP, STATES_LIST } from '../../lib/india-states-districts'

const API_BASE = import.meta.env.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '')
  : (import.meta.env.PROD ? '' : 'http://localhost:5001')

export default function ExpressLocationsTab({ adminKey }) {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  // Form states
  const [selectedState, setSelectedState] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [availablePincodes, setAvailablePincodes] = useState([])
  const [pincodesLoading, setPincodesLoading] = useState(false)
  const [selectedPincodes, setSelectedPincodes] = useState([])
  const [isEnabled, setIsEnabled] = useState(true)
  
  // Single edit state (for editing/updating a single record already saved)
  const [singlePincode, setSinglePincode] = useState('')

  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Manual pincode inputs
  const [manualPincodeInput, setManualPincodeInput] = useState('')
  const [manualPincodeError, setManualPincodeError] = useState('')
  
  // Track if we are editing an already configured district
  const [isEditingDistrict, setIsEditingDistrict] = useState(false)

  // Search / Filter
  const [search, setSearch] = useState('')
  const [filterEnabled, setFilterEnabled] = useState('all')

  // Delete confirm
  const [deletingId, setDeletingId] = useState(null)

  const headers = { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey }

  const fetchLocations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/admin/express-locations`, { headers: { 'x-admin-api-key': adminKey } })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setLocations(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load express locations')
    } finally {
      setLoading(false)
    }
  }, [adminKey])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  // Auto-clear success message
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(''), 3500)
    return () => clearTimeout(t)
  }, [success])

  // Automatically fetch pincodes when District changes (and state is set)
  useEffect(() => {
    if (!selectedState || !selectedDistrict || editingId) {
      setAvailablePincodes([])
      return
    }

    let cancelled = false
    setPincodesLoading(true)
    setFormError('')
    setAvailablePincodes([])
    setSelectedPincodes([])
    setIsEditingDistrict(false)

    // Check if district already exists
    const districtExists = locations.some(
      loc => loc.state === selectedState && loc.district === selectedDistrict
    )
    if (districtExists) {
      setFormError('This district has already been configured for Express Delivery.')
    }

    fetch(`${API_BASE}/api/geo/pincodes-by-district?state=${encodeURIComponent(selectedState)}&district=${encodeURIComponent(selectedDistrict)}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch pincodes')
        return r.json()
      })
      .then(data => {
        if (cancelled) return
        if (Array.isArray(data)) {
          setAvailablePincodes(data)
          // Default to all selected for user convenience if not already configured
          if (!districtExists) {
            setSelectedPincodes(data)
          }
        } else {
          setAvailablePincodes([])
        }
      })
      .catch((err) => {
        if (!cancelled && !districtExists) setFormError('Error loading pincodes from postal directory. Please enter manually or try again.')
      })
      .finally(() => {
        if (!cancelled) setPincodesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedState, selectedDistrict, editingId, locations])

  const openAddModal = () => {
    setEditingId(null)
    setSelectedState('')
    setSelectedDistrict('')
    setAvailablePincodes([])
    setSelectedPincodes([])
    setIsEnabled(true)
    setSinglePincode('')
    setFormError('')
    setManualPincodeInput('')
    setManualPincodeError('')
    setIsEditingDistrict(false)
    setShowModal(true)
  }

  const openEditModal = (loc) => {
    setEditingId(loc.id)
    setSelectedState(loc.state || '')
    setSelectedDistrict(loc.district || '')
    setSinglePincode(loc.pincode || '')
    setIsEnabled(loc.is_enabled !== false)
    setFormError('')
    setManualPincodeInput('')
    setManualPincodeError('')
    setIsEditingDistrict(false)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setSelectedState('')
    setSelectedDistrict('')
    setAvailablePincodes([])
    setSelectedPincodes([])
    setSinglePincode('')
    setFormError('')
    setManualPincodeInput('')
    setManualPincodeError('')
    setIsEditingDistrict(false)
  }

  const handleAddManualPincode = () => {
    const trimmed = manualPincodeInput.trim()
    if (!/^\d{6}$/.test(trimmed)) {
      setManualPincodeError('Please enter a valid 6-digit numeric pincode.')
      return
    }
    // Check if pincode already exists in the selected district (locally or in locations list)
    const existsLocally = availablePincodes.includes(trimmed)
    const existsInSaved = locations.some(
      loc => loc.state === selectedState && loc.district === selectedDistrict && loc.pincode === trimmed
    )

    if (existsLocally || existsInSaved) {
      setManualPincodeError('This pincode already exists in the selected district.')
      // Auto select it if it's already in availablePincodes but unchecked
      if (existsLocally && !selectedPincodes.includes(trimmed)) {
        setSelectedPincodes(prev => [...prev, trimmed])
      }
      return
    }
    // Add to lists and clear
    setAvailablePincodes(prev => [...prev, trimmed])
    setSelectedPincodes(prev => [...prev, trimmed])
    setManualPincodeInput('')
    setManualPincodeError('')
  }

  const handlePincodeToggle = (pin) => {
    setSelectedPincodes(prev =>
      prev.includes(pin) ? prev.filter(p => p !== pin) : [...prev, pin]
    )
  }

  const handleSelectAllPincodes = () => {
    if (selectedPincodes.length === availablePincodes.length) {
      setSelectedPincodes([])
    } else {
      setSelectedPincodes([...availablePincodes])
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!selectedState) return setFormError('State is required.')
    if (!selectedDistrict) return setFormError('District is required.')

    setSaving(true)
    setFormError('')
    try {
      if (editingId) {
        // Edit single record
        if (!/^\d{6}$/.test(singlePincode.trim())) {
          setSaving(false)
          return setFormError('Please enter a valid 6-digit pincode.')
        }
        // Check for duplicates before updating
        const isDuplicate = locations.some(
          loc => loc.id !== editingId &&
                 loc.state === selectedState &&
                 loc.district === selectedDistrict &&
                 loc.pincode === singlePincode.trim()
        )
        if (isDuplicate) {
          setSaving(false)
          return setFormError('This pincode already exists in the selected district.')
        }

        const res = await fetch(`${API_BASE}/api/admin/express-locations/${editingId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            state: selectedState,
            district: selectedDistrict,
            pincode: singlePincode.trim(),
            is_enabled: isEnabled
          })
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
        setSuccess('Location updated successfully!')
      } else {
        // Bulk save
        if (!isEditingDistrict) {
          const districtExists = locations.some(
            loc => loc.state === selectedState && loc.district === selectedDistrict
          )
          if (districtExists) {
            setSaving(false)
            return setFormError('This district has already been configured for Express Delivery.')
          }
        }

        if (selectedPincodes.length === 0) {
          setSaving(false)
          return setFormError('Please select at least one pincode to enable.')
        }

        const res = await fetch(`${API_BASE}/api/admin/express-locations/bulk`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            state: selectedState,
            district: selectedDistrict,
            pincodes: selectedPincodes,
            is_enabled: isEnabled
          })
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
        setSuccess(`Enabled Express Delivery for ${body.count || selectedPincodes.length} pincode(s) in ${selectedDistrict}!`)
      }
      closeModal()
      fetchLocations()
    } catch (err) {
      setFormError(err.message || 'Failed to save locations')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (loc) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/express-locations/${loc.id}/toggle`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_enabled: !loc.is_enabled })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, is_enabled: !l.is_enabled } : l))
      setSuccess(`Pincode ${loc.pincode} ${!loc.is_enabled ? 'enabled' : 'disabled'} successfully!`)
    } catch (err) {
      setError(err.message || 'Failed to toggle location status')
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`${API_BASE}/api/admin/express-locations/${deletingId}`, {
        method: 'DELETE', headers
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setLocations(prev => prev.filter(l => l.id !== deletingId))
      setSuccess('Serviceable location removed successfully!')
    } catch (err) {
      setError(err.message || 'Failed to delete location')
    } finally {
      setDeletingId(null)
    }
  }

  // Filter logic
  const filtered = locations.filter(loc => {
    if (filterEnabled === 'enabled' && !loc.is_enabled) return false
    if (filterEnabled === 'disabled' && loc.is_enabled) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      loc.state?.toLowerCase().includes(q) ||
      loc.district?.toLowerCase().includes(q) ||
      loc.pincode?.includes(q)
    )
  })

  const enabledCount = locations.filter(l => l.is_enabled).length
  const disabledCount = locations.length - enabledCount

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '0 0 40px' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        borderRadius: 20,
        padding: '28px 32px',
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 200, height: 200,
          borderRadius: '50%', background: 'rgba(249,115,22,0.1)', filter: 'blur(40px)'
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'linear-gradient(135deg, #f97316, #ea580c)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, boxShadow: '0 4px 14px rgba(249,115,22,0.4)'
                }}>⚡</div>
                <div>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                    Express Delivery Locations
                  </h1>
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                    Manage serviceable areas for Express Delivery
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={openAddModal}
              style={{
                padding: '11px 22px',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                border: 'none', borderRadius: 12, color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(249,115,22,0.45)',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'transform 0.15s, box-shadow 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(249,115,22,0.55)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 14px rgba(249,115,22,0.45)' }}
            >
              <span style={{ fontSize: 18 }}>＋</span> Add Serviceable Pincodes
            </button>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Serviceable Pincodes', value: locations.length, color: '#94a3b8', icon: '📍' },
              { label: 'Active Pincodes', value: enabledCount, color: '#4ade80', icon: '✅' },
              { label: 'Disabled Pincodes', value: disabledCount, color: '#f87171', icon: '⛔' }
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10
              }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toast messages ── */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12,
          padding: '12px 16px', color: '#991b1b', fontSize: 14, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span>⚠️</span> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16 }}>✕</button>
        </div>
      )}
      {success && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12,
          padding: '12px 16px', color: '#166534', fontSize: 14, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span>✅</span> {success}
        </div>
      )}

      {/* ── Search & Filter Bar ── */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center'
      }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#94a3b8' }}>🔍</span>
          <input
            type="text"
            placeholder="Search state, district, pincode…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px 10px 38px',
              border: '1.5px solid #e2e8f0', borderRadius: 10,
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
              background: '#fff', color: '#1e293b',
              transition: 'border 0.2s'
            }}
            onFocus={e => e.target.style.border = '1.5px solid #f97316'}
            onBlur={e => e.target.style.border = '1.5px solid #e2e8f0'}
          />
        </div>
        {['all', 'enabled', 'disabled'].map(f => (
          <button
            key={f}
            onClick={() => setFilterEnabled(f)}
            style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: filterEnabled === f ? '#f97316' : '#f1f5f9',
              color: filterEnabled === f ? '#fff' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            {f === 'all' ? 'All' : f === 'enabled' ? '✅ Enabled' : '⛔ Disabled'}
          </button>
        ))}
        <button
          onClick={fetchLocations}
          title="Refresh"
          style={{
            padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0',
            background: '#fff', fontSize: 16, cursor: 'pointer', color: '#475569',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
        >🔄</button>
      </div>

      {/* ── Locations Table ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 15 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Loading express delivery locations…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, background: '#f8fafc',
          border: '2px dashed #e2e8f0', borderRadius: 16, color: '#94a3b8'
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#64748b' }}>
            {locations.length === 0 ? 'No express locations configured' : 'No results match your filters'}
          </div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>
            {locations.length === 0
              ? 'Add serviceable states and districts to enable Express Delivery for customers.'
              : 'Try adjusting your search or filters.'
            }
          </div>
          {locations.length === 0 && (
            <button onClick={openAddModal} style={{
              padding: '11px 22px', background: 'linear-gradient(135deg, #f97316, #ea580c)',
              border: 'none', borderRadius: 10, color: '#fff', fontSize: 14,
              fontWeight: 700, cursor: 'pointer'
            }}>
              ＋ Add Serviceable Pincodes
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(loc => (
            <LocationCard
              key={loc.id}
              loc={loc}
              onEdit={() => openEditModal(loc)}
              onDelete={() => handleDelete(loc.id)}
              onToggle={() => handleToggle(loc)}
            />
          ))}
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 580,
            boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
            animation: 'slideUp 0.2s ease', display: 'flex', flexDirection: 'column',
            maxHeight: '90vh'
          }}>
            {/* Modal header */}
            <div style={{
              padding: '22px 28px',
              background: 'linear-gradient(135deg, #0f172a, #1e293b)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>⚡</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                    {editingId ? 'Edit Serviceable Pincode' : 'Add Serviceable State & District'}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    {editingId ? 'Configure individual pincode status' : 'Select state, district and choose active pincodes'}
                  </div>
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'grid', gap: 18 }}>

                  {/* 1. State Selector */}
                  <Field label="State *">
                    <select
                      value={selectedState}
                      onChange={e => {
                        setSelectedState(e.target.value)
                        setSelectedDistrict('')
                        setAvailablePincodes([])
                        setSelectedPincodes([])
                      }}
                      disabled={!!editingId}
                      style={inputStyle}
                    >
                      <option value="">Select State…</option>
                      {STATES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>

                  {/* 2. District Selector (appears after state is chosen) */}
                  {selectedState && (
                    <div>
                      <Field label="District *">
                        <select
                          value={selectedDistrict}
                          onChange={e => {
                            setSelectedDistrict(e.target.value)
                          }}
                          disabled={!!editingId}
                          style={inputStyle}
                        >
                          <option value="">Select District…</option>
                          {(STATE_DISTRICTS_MAP[selectedState] || []).map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </Field>
                      {!editingId && selectedDistrict && locations.some(loc => loc.state === selectedState && loc.district === selectedDistrict) && !isEditingDistrict && (
                        <div style={{
                          marginTop: 8,
                          padding: '10px 14px',
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10
                        }}>
                          <span style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>
                            ⚠️ This district has already been configured for Express Delivery.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingDistrict(true)
                              setFormError('')
                              // Load existing saved pincodes for this district
                              const savedPins = locations
                                .filter(loc => loc.state === selectedState && loc.district === selectedDistrict)
                                .map(loc => loc.pincode)
                              // Merge into availablePincodes so they are shown
                              setAvailablePincodes(prev => {
                                const merged = [...prev]
                                savedPins.forEach(p => {
                                  if (!merged.includes(p)) merged.push(p)
                                })
                                return merged
                              })
                              setSelectedPincodes(savedPins)
                            }}
                            style={{
                              padding: '5px 12px',
                              background: '#d97706',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ✏️ Edit Existing
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Pincode List (for bulk add mode) */}
                  {!editingId && selectedDistrict && (
                    <div>
                      <label style={{ display: 'block', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Pincodes in {selectedDistrict} *</span>
                          {availablePincodes.length > 0 && (
                            <button
                              type="button"
                              onClick={handleSelectAllPincodes}
                              style={{
                                background: 'none', border: 'none', color: '#ea580c',
                                fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '2px 6px'
                              }}
                            >
                              {selectedPincodes.length === availablePincodes.length ? '🧹 Deselect All' : '✅ Select All Pincodes'}
                            </button>
                          )}
                        </div>
                      </label>

                      {pincodesLoading ? (
                        <div style={{
                          padding: '30px 20px', background: '#f8fafc', border: '1.5px solid #e2e8f0',
                          borderRadius: 10, textAlign: 'center', color: '#64748b', fontSize: 13
                        }}>
                          ⏳ Querying India Post directory for {selectedDistrict} pincodes…
                        </div>
                      ) : (
                        <div>
                          {availablePincodes.length > 0 ? (
                            <div style={{
                              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))',
                              gap: 8, maxHeight: 180, overflowY: 'auto', padding: 12,
                              background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10
                            }}>
                              {availablePincodes.map(pin => {
                                const checked = selectedPincodes.includes(pin)
                                return (
                                  <label
                                    key={pin}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
                                      borderRadius: 6, background: checked ? '#fff7ed' : '#fff',
                                      border: checked ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                                      cursor: 'pointer', fontSize: 13, userSelect: 'none',
                                      transition: 'all 0.15s'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => handlePincodeToggle(pin)}
                                      style={{ accentColor: '#ea580c' }}
                                    />
                                    <span style={{ fontWeight: checked ? 700 : 500, color: checked ? '#ea580c' : '#334155' }}>
                                      {pin}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          ) : (
                            <div style={{
                              padding: '24px 20px', background: '#fff5f5', border: '1.5px dashed #fecaca',
                              borderRadius: 10, textAlign: 'center', color: '#b91c1c', fontSize: 13, marginBottom: 12
                            }}>
                              No automatically loaded pincodes found for district "{selectedDistrict}".
                            </div>
                          )}

                          {/* Manual Add Inline Input */}
                          <div style={{
                            marginTop: 12,
                            padding: 14,
                            background: '#f8fafc',
                            border: '1.5px dashed #e2e8f0',
                            borderRadius: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>📮</span> Can't find a pincode? Add it manually:
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <input
                                type="text"
                                placeholder="Enter 6-digit pincode"
                                maxLength={6}
                                value={manualPincodeInput}
                                onChange={e => {
                                  setManualPincodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                                  setManualPincodeError('')
                                }}
                                style={{
                                  flex: 1,
                                  padding: '8px 12px',
                                  border: '1.5px solid #cbd5e1',
                                  borderRadius: 8,
                                  fontSize: 13,
                                  outline: 'none',
                                  background: '#fff'
                                }}
                              />
                              <button
                                type="button"
                                onClick={handleAddManualPincode}
                                style={{
                                  padding: '8px 16px',
                                  background: '#ea580c',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 8,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#d94e06'}
                                onMouseLeave={e => e.currentTarget.style.background = '#ea580c'}
                              >
                                ＋ Add Pincode
                              </button>
                            </div>
                            {manualPincodeError && (
                              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>⚠️</span> {manualPincodeError}
                              </div>
                            )}
                          </div>

                          {availablePincodes.length > 0 && (
                            <p style={{ margin: '8px 0 0 4px', fontSize: 11, color: '#64748b' }}>
                              Selected: {selectedPincodes.length} of {availablePincodes.length} pincodes
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Single Pincode (only shown in editing mode) */}
                  {editingId && (
                    <Field label="Pincode *">
                      <input
                        type="text"
                        placeholder="e.g. 800001"
                        maxLength={6}
                        value={singlePincode}
                        onChange={e => setSinglePincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        style={inputStyle}
                      />
                    </Field>
                  )}

                  {/* 5. Enable/Disable Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1.5px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Express Delivery Active</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        {editingId ? 'Toggle serviceability status' : 'Enable Express Delivery for all selected pincodes'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEnabled(!isEnabled)}
                      style={{
                        width: 50, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer',
                        background: isEnabled ? '#f97316' : '#cbd5e1',
                        position: 'relative', transition: 'background 0.25s', flexShrink: 0
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3, width: 22, height: 22,
                        borderRadius: '50%', background: '#fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                        left: isEnabled ? 25 : 3,
                        transition: 'left 0.25s'
                      }} />
                    </button>
                  </div>

                  {formError && (
                    <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
                      ⚠️ {formError}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, padding: '20px 28px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', justifyContent: 'flex-end', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: '11px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                    background: '#fff', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer'
                  }}
                >Cancel</button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '11px 24px', borderRadius: 10, border: 'none',
                    background: saving ? '#94a3b8' : 'linear-gradient(135deg, #f97316, #ea580c)',
                    color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: saving ? 'none' : '0 4px 12px rgba(249,115,22,0.35)'
                  }}
                >
                  {saving ? '⏳ Saving…' : editingId ? '💾 Save Changes' : `✅ Enable ${selectedPincodes.length} Pincode(s)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deletingId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#fff', borderRadius: 18, width: '100%', maxWidth: 400,
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)', padding: 30, textAlign: 'center'
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Remove Location?</div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.5 }}>
              This will permanently remove the serviceable pincode. Express Delivery option will be blocked for users checking out from this area.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setDeletingId(null)}
                style={{
                  padding: '11px 22px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                  background: '#fff', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer'
                }}
              >Cancel</button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '11px 22px', borderRadius: 10, border: 'none',
                  background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220,38,38,0.3)'
                }}
              >🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function LocationCard({ loc, onEdit, onDelete, onToggle }) {
  return (
    <div style={{
      background: '#fff',
      border: loc.is_enabled ? '1.5px solid #fed7aa' : '1.5px solid #e2e8f0',
      borderRadius: 14,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      transition: 'box-shadow 0.2s, transform 0.2s',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = '' }}
    >
      {/* Status dot */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        background: loc.is_enabled ? '#f97316' : '#cbd5e1',
        boxShadow: loc.is_enabled ? '0 0 0 3px rgba(249,115,22,0.2)' : 'none'
      }} />

      {/* Location info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
            {loc.district}
          </span>
          <span style={{ fontSize: 12, color: '#64748b' }}>— {loc.state}</span>
          <span style={{
            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            background: loc.is_enabled ? '#fff7ed' : '#f1f5f9',
            color: loc.is_enabled ? '#c2410c' : '#94a3b8',
            border: `1px solid ${loc.is_enabled ? '#fed7aa' : '#e2e8f0'}`
          }}>
            {loc.is_enabled ? '⚡ Active' : 'Disabled'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>📍</span>{loc.district}, {loc.state}
          </span>
          <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>📮</span>Pincode: <strong>{loc.pincode}</strong>
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {/* Toggle */}
        <button
          onClick={onToggle}
          title={loc.is_enabled ? 'Disable' : 'Enable'}
          style={{
            padding: '7px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0',
            background: '#f8fafc', fontSize: 13, cursor: 'pointer', fontWeight: 600,
            color: loc.is_enabled ? '#dc2626' : '#16a34a', transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
          onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
        >
          {loc.is_enabled ? '⛔ Disable' : '✅ Enable'}
        </button>
        {/* Edit */}
        <button
          onClick={onEdit}
          title="Edit"
          style={{
            padding: '7px 12px', borderRadius: 8, border: '1.5px solid #dbeafe',
            background: '#eff6ff', fontSize: 13, cursor: 'pointer', fontWeight: 600,
            color: '#1d4ed8', transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
          onMouseLeave={e => e.currentTarget.style.background = '#eff6ff'}
        >✏️ Edit</button>
        {/* Delete */}
        <button
          onClick={onDelete}
          title="Delete"
          style={{
            padding: '7px 12px', borderRadius: 8, border: '1.5px solid #fee2e2',
            background: '#fff5f5', fontSize: 13, cursor: 'pointer', fontWeight: 600,
            color: '#dc2626', transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff5f5'}
        >🗑️</button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  border: '1.5px solid #e2e8f0',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  color: '#0f172a',
  background: '#fff',
  fontFamily: 'inherit'
}
