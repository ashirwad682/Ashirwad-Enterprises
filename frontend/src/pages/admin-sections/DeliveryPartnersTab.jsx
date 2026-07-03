import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAdminAuth } from '../../context/AdminAuthContext'

const rawBase = (import.meta.env.VITE_API_BASE || '').trim()
const API_BASE = rawBase ? rawBase.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')

const BIHAR_ROUTE_AREAS = {
  Araria: ['Forbesganj', 'Jokihat', 'Raniganj', 'Narpatganj', 'Palasi'],
  Arwal: ['Arwal', 'Karpi', 'Kaler', 'Kurtha'],
  Aurangabad: ['Daudnagar', 'Rafiganj', 'Madanpur', 'Nabinagar', 'Kutumba'],
  Banka: ['Banka', 'Amarpur', 'Katoria', 'Barahat', 'Belhar'],
  Begusarai: ['Begusarai', 'Bakhri', 'Balia', 'Cheria Bariarpur', 'Teghra'],
  Bhagalpur: ['Nathnagar', 'Kahalgaon', 'Sultanganj', 'Naugachhia', 'Sabour'],
  Bhojpur: ['Ara', 'Jagdishpur', 'Koilwar', 'Sahar', 'Piro'],
  Buxar: ['Buxar', 'Dumraon', 'Itarhi', 'Chakki', 'Chausa'],
  Darbhanga: ['Laheriasarai', 'Benipur', 'Biraul', 'Jale', 'Singhwara'],
  'East Champaran': ['Motihari', 'Raxaul', 'Mehsi', 'Chakia', 'Pakri Dayal'],
  Gaya: ['Bodh Gaya', 'Tekari', 'Sherghati', 'Imamganj', 'Belaganj'],
  Gopalganj: ['Gopalganj', 'Hathua', 'Barauli', 'Kuchaikote', 'Manjha'],
  Jamui: ['Jamui', 'Jhajha', 'Chakai', 'Sonohara', 'Gidhaur'],
  Jehanabad: ['Jehanabad', 'Makhdumpur', 'Kako', 'Ratni Faridpur'],
  Kaimur: ['Bhabua', 'Mohania', 'Adhaura', 'Durgawati', 'Ramgarh'],
  Katihar: ['Katihar', 'Barari', 'Manihari', 'Dandkhora', 'Balrampur'],
  Khagaria: ['Khagaria', 'Mansi', 'Alouli', 'Gogri', 'Parbatta'],
  Kishanganj: ['Kishanganj', 'Bahadurganj', 'Thakurganj', 'Pothia', 'Teragachh'],
  Lakhisarai: ['Lakhisarai', 'Surajgarha', 'Chanan', 'Piparia'],
  Madhepura: ['Madhepura', 'Murliganj', 'Udakishunganj', 'Bihariganj', 'Kumarkhand'],
  Madhubani: ['Madhubani', 'Jhanjharpur', 'Benipatti', 'Saharsa', 'Phulparas'],
  Munger: ['Munger', 'Jamalpur', 'Haveli Kharagpur', 'Asarganj', 'Tarapur'],
  Muzaffarpur: ['Bochahan', 'Kanti', 'Motipur', 'Sakra', 'Mushahari', 'Minapur', 'Kurhani'],
  Nalanda: ['Bihar Sharif', 'Rajgir', 'Hilsa', 'Islampur', 'Biharsharif Sadar'],
  Nawada: ['Nawada', 'Rajauli', 'Pakribarawan', 'Narhat', 'Warisaliganj'],
  Patna: ['Danapur', 'Phulwari Sharif', 'Bakhtiyarpur', 'Barh', 'Masaurhi', 'Paliganj', 'Digha', 'Patna City', 'Bihta', 'Maner'],
  Purnia: ['Purnia', 'Banmankhi', 'Dhamdaha', 'Kasba', 'Jalalgarh'],
  Rohtas: ['Sasaram', 'Dehri', 'Nokha', 'Kargahar', 'Chenari'],
  Saharsa: ['Saharsa', 'Simri Bakhtiarpur', 'Mahishi', 'Sonbarsa', 'Kahra'],
  Samastipur: ['Samastipur', 'Rosera', 'Dalsinghsarai', 'Patori', 'Sarairanjan'],
  Saran: ['Chhapra', 'Marhaura', 'Ekma', 'Baniapur', 'Garkha'],
  Sheikhpura: ['Sheikhpura', 'Barbigha', 'Chewara', 'Ghat Kusumbha'],
  Sheohar: ['Sheohar', 'Piprahi', 'Dumri Katsari', 'Purnahiya'],
  Sitamarhi: ['Sitamarhi', 'Belsand', 'Pupri', 'Riga', 'Parihar'],
  Siwan: ['Siwan', 'Mairwa', 'Ziradei', 'Barharia', 'Andar'],
  Supaul: ['Supaul', 'Nirmali', 'Triveniganj', 'Pipra', 'Basantpur'],
  Vaishali: ['Hajipur', 'Mahua', 'Lalganj', 'Patepur', 'Raja Pakar'],
  'West Champaran': ['Bettiah', 'Bagaha', 'Narkatiaganj', 'Lauriya', 'Chanpatia']
}

const BIHAR_ROUTE_OPTIONS = Object.keys(BIHAR_ROUTE_AREAS)

function splitBiharRouteArea(value) {
  const raw = String(value || '').trim()
  if (!raw) return { route: '', area: '' }

  for (const route of BIHAR_ROUTE_OPTIONS) {
    if (raw === route) return { route, area: '' }

    const prefixes = [`${route} - `, `${route} / `, `${route}: `, `${route} — `]
    for (const prefix of prefixes) {
      if (raw.startsWith(prefix)) {
        return { route, area: raw.slice(prefix.length).trim() }
      }
    }
  }

  const dashIndex = raw.indexOf(' - ')
  if (dashIndex > 0) {
    return {
      route: raw.slice(0, dashIndex).trim(),
      area: raw.slice(dashIndex + 3).trim()
    }
  }

  return { route: '', area: raw }
}

function buildBiharAssignedArea(route, area) {
  const cleanedRoute = String(route || '').trim()
  const cleanedArea = String(area || '').trim()
  if (!cleanedRoute) return cleanedArea
  if (!cleanedArea) return cleanedRoute
  return `${cleanedRoute} - ${cleanedArea}`
}

function statusBadgeStyle(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'approved' || normalized === 'verified' || normalized === 'active') {
    return { bg: '#e6f4ea', color: '#137333', border: '#ceead6' }
  }
  if (normalized === 'pending' || normalized === 'under_review') {
    return { bg: '#fef7e0', color: '#b06000', border: '#feebc8' }
  }
  if (normalized === 'rejected' || normalized === 'inactive') {
    return { bg: '#fce8e6', color: '#c5221f', border: '#fad2cf' }
  }
  return { bg: '#f1f3f4', color: '#3c4043', border: '#e8eaed' }
}

export default function DeliveryPartnersTab() {
  const { adminKey } = useAdminAuth ? useAdminAuth() : { adminKey: null }
  const headers = useMemo(() => ({
    'x-admin-key': adminKey,
    'x-admin-api-key': adminKey
  }), [adminKey])

  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Filtering and search state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Detailed selected partner view
  const [selectedPartnerId, setSelectedPartnerId] = useState(null)
  const [detailPartner, setDetailPartner] = useState(null)
  const [detailDocs, setDetailDocs] = useState([])
  const [detailAudit, setDetailAudit] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingAudit, setLoadingAudit] = useState(false)

  // Document action state (rejection)
  const [rejectingDocId, setRejectingDocId] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [submittingReject, setSubmittingReject] = useState(false)

  // Overall profile rejection state
  const [rejectingProfile, setRejectingProfile] = useState(false)
  const [profileRejectionReason, setProfileRejectionReason] = useState('')

  // Create Partner Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createFormData, setCreateFormData] = useState({ name: '', email: '', mobileNumber: '', route: '', area: '' })
  const [creating, setCreating] = useState(false)
  const [tempCredentials, setTempCredentials] = useState(null)

  // Edit Partner Modal State
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({ id: '', name: '', email: '', mobileNumber: '', route: '', area: '', status: 'active', password: '' })
  const [updating, setUpdating] = useState(false)

  // Preview Image Modal
  const [previewImageUrl, setPreviewImageUrl] = useState(null)

  const sanitizePhoneInput = (value) => String(value || '').replace(/\D/g, '').slice(0, 10)

  useEffect(() => {
    if (adminKey) {
      fetchPartners()
    }
  }, [adminKey])

  async function fetchPartners() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/delivery/admin/delivery-partners`, { headers })
      if (!res.ok) throw new Error('Failed to fetch delivery partners summary')
      const data = await res.json()
      setPartners(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Load detailed partner information when selected
  useEffect(() => {
    if (selectedPartnerId) {
      fetchPartnerDetails(selectedPartnerId)
      fetchPartnerAuditLogs(selectedPartnerId)
    } else {
      setDetailPartner(null)
      setDetailDocs([])
      setDetailAudit([])
    }
  }, [selectedPartnerId])

  async function fetchPartnerDetails(id) {
    setLoadingDetail(true)
    try {
      const res = await fetch(`${API_BASE}/api/delivery/admin/delivery-partners/${id}`, { headers })
      if (!res.ok) throw new Error('Failed to load partner details')
      const data = await res.json()
      if (data.success) {
        setDetailPartner(data.partner)
        setDetailDocs(data.documents || [])
      }
    } catch (err) {
      setError(`Detail view error: ${err.message}`)
    } finally {
      setLoadingDetail(false)
    }
  }

  async function fetchPartnerAuditLogs(id) {
    setLoadingAudit(true)
    try {
      const res = await fetch(`${API_BASE}/api/delivery/admin/delivery-partners/${id}/audit`, { headers })
      if (!res.ok) throw new Error('Failed to load verification logs')
      const data = await res.json()
      if (data.success) {
        setDetailAudit(data.auditLogs || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAudit(false)
    }
  }

  // Individual Document Actions
  async function handleApproveDocument(docId) {
    if (!detailPartner) return
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/delivery/admin/delivery-partners/${detailPartner.id}/documents/${docId}/approve`, {
        method: 'POST',
        headers
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to approve document')
      }
      setSuccessMessage('Document approved successfully.')
      setTimeout(() => setSuccessMessage(null), 3000)
      
      // Refresh details
      fetchPartnerDetails(detailPartner.id)
      fetchPartnerAuditLogs(detailPartner.id)
      fetchPartners() // Refresh summary counts in main grid
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRejectDocument(e) {
    e.preventDefault()
    if (!detailPartner || !rejectingDocId) return
    if (!rejectionReason.trim()) {
      setError('Please provide a reason for document rejection.')
      return
    }

    setSubmittingReject(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/delivery/admin/delivery-partners/${detailPartner.id}/documents/${rejectingDocId}/reject`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: rejectionReason.trim() })
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to reject document')
      }

      setSuccessMessage('Document marked as rejected.')
      setTimeout(() => setSuccessMessage(null), 3000)
      setRejectingDocId(null)
      setRejectionReason('')
      
      // Refresh details
      fetchPartnerDetails(detailPartner.id)
      fetchPartnerAuditLogs(detailPartner.id)
      fetchPartners()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmittingReject(false)
    }
  }

  // Overall Profile Actions
  async function handleApproveProfile() {
    if (!detailPartner) return
    if (!window.confirm('Are you sure you want to approve this delivery partner profile overall? This will mark them as verified.')) return

    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/delivery/admin/delivery-partners/${detailPartner.id}/approve`, {
        method: 'POST',
        headers
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to approve profile')
      }

      setSuccessMessage('Overall profile verification approved successfully.')
      setTimeout(() => setSuccessMessage(null), 3000)

      fetchPartnerDetails(detailPartner.id)
      fetchPartnerAuditLogs(detailPartner.id)
      fetchPartners()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRejectProfile(e) {
    e.preventDefault()
    if (!detailPartner) return
    if (!profileRejectionReason.trim()) {
      setError('Please provide a rejection reason.')
      return
    }

    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/delivery/admin/delivery-partners/${detailPartner.id}/reject`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: profileRejectionReason.trim() })
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to reject profile')
      }

      setSuccessMessage('Overall profile marked as rejected.')
      setTimeout(() => setSuccessMessage(null), 3000)
      setRejectingProfile(false)
      setProfileRejectionReason('')

      fetchPartnerDetails(detailPartner.id)
      fetchPartnerAuditLogs(detailPartner.id)
      fetchPartners()
    } catch (err) {
      setError(err.message)
    }
  }

  // Create Partner Form Handler
  async function handleCreatePartnerSubmit(e) {
    e.preventDefault()
    setError(null)
    setTempCredentials(null)

    const normalizedMobileNumber = sanitizePhoneInput(createFormData.mobileNumber)
    const assignedArea = buildBiharAssignedArea(createFormData.route, createFormData.area)

    if (!createFormData.name.trim() || !createFormData.email.trim() || !normalizedMobileNumber || !createFormData.route || !createFormData.area) {
      setError('All fields are required')
      return
    }

    if (!/^\d{10}$/.test(normalizedMobileNumber)) {
      setError('Mobile number must be exactly 10 digits')
      return
    }

    if (!BIHAR_ROUTE_OPTIONS.includes(createFormData.route)) {
      setError('Please select a valid Bihar district')
      return
    }

    if (!BIHAR_ROUTE_AREAS[createFormData.route]?.includes(createFormData.area)) {
      setError('Please select a valid area')
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/api/delivery/admin/create`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: createFormData.name.trim(),
          email: createFormData.email.trim(),
          mobileNumber: normalizedMobileNumber,
          assignedArea
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create partner')

      setTempCredentials({
        id: data.deliveryPartner.delivery_partner_id,
        email: data.deliveryPartner.email,
        password: data.tempPassword
      })

      setCreateFormData({ name: '', email: '', mobileNumber: '', route: '', area: '' })
      fetchPartners()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  // Start Edit Partner Form
  function handleOpenEditModal(partner) {
    setError(null)
    const { route, area } = splitBiharRouteArea(partner.assigned_area || '')
    setEditFormData({
      id: partner.id,
      name: partner.name || '',
      email: partner.email || '',
      mobileNumber: String(partner.mobile_number || '').replace(/\D/g, '').slice(0, 10),
      route,
      area,
      status: partner.status || 'active',
      password: ''
    })
    setShowEditModal(true)
  }

  // Edit Partner Form Handler
  async function handleEditPartnerSubmit(e) {
    e.preventDefault()
    setError(null)
    setUpdating(true)

    const normalizedMobileNumber = sanitizePhoneInput(editFormData.mobileNumber)
    const assignedArea = buildBiharAssignedArea(editFormData.route, editFormData.area)

    if (!editFormData.name.trim() || !editFormData.email.trim() || !normalizedMobileNumber || !editFormData.route || !editFormData.area) {
      setError('All fields are required')
      setUpdating(false)
      return
    }

    const payload = {
      name: editFormData.name.trim(),
      email: editFormData.email.trim().toLowerCase(),
      mobile_number: normalizedMobileNumber,
      assigned_area: assignedArea,
      status: editFormData.status
    }

    if (editFormData.password.trim()) {
      payload.password = editFormData.password.trim()
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/delivery-partners/${editFormData.id}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update partner')

      setSuccessMessage('Delivery partner profile details updated successfully.')
      setTimeout(() => setSuccessMessage(null), 3000)
      setShowEditModal(false)
      
      if (selectedPartnerId === editFormData.id) {
        fetchPartnerDetails(editFormData.id)
      }
      fetchPartners()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdating(false)
    }
  }

  // Deactivate Partner Toggle (Drawer shortcut)
  async function handleToggleStatus(partner) {
    const newStatus = partner.status === 'active' ? 'inactive' : 'active'
    if (!window.confirm(`Are you sure you want to make this partner account ${newStatus.toUpperCase()}?`)) return

    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/delivery/admin/delivery-partners/${partner.id}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update partner status')

      setSuccessMessage(`Partner marked as ${newStatus}.`)
      setTimeout(() => setSuccessMessage(null), 3000)

      fetchPartnerDetails(partner.id)
      fetchPartners()
    } catch (err) {
      setError(err.message)
    }
  }

  // Filter and search computation
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      // Search matches
      const query = searchQuery.trim().toLowerCase()
      const matchesSearch = !query || 
        String(p.name || '').toLowerCase().includes(query) ||
        String(p.email || '').toLowerCase().includes(query) ||
        String(p.delivery_partner_id || '').toLowerCase().includes(query) ||
        String(p.mobile_number || '').toLowerCase().includes(query)

      // Status matches
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'pending' && (p.verification_status === 'pending' || p.overall_approval_status === 'pending')) ||
        (statusFilter === 'under_review' && p.verification_status === 'under_review') ||
        (statusFilter === 'approved' && p.verification_status === 'approved') ||
        (statusFilter === 'rejected' && p.verification_status === 'rejected')

      return matchesSearch && matchesStatus
    })
  }, [partners, searchQuery, statusFilter])

  // Count helper functions
  const counts = useMemo(() => {
    return {
      all: partners.length,
      pending: partners.filter(p => p.verification_status === 'pending' || p.overall_approval_status === 'pending').length,
      under_review: partners.filter(p => p.verification_status === 'under_review').length,
      approved: partners.filter(p => p.verification_status === 'approved').length,
      rejected: partners.filter(p => p.verification_status === 'rejected').length
    }
  }, [partners])

  return (
    <div style={{ position: 'relative', display: 'grid', gap: 16 }}>
      
      {/* Title & Register Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: 22, fontWeight: 800 }}>
            Delivery Partner Verification Center
          </h3>
          <div style={{ marginTop: 4, fontSize: 13, color: '#64748b' }}>
            Manage identity verification documents, live camera photos, edit profiles, and register new partners.
          </div>
        </div>

        <button
          onClick={() => { setError(null); setTempCredentials(null); setShowCreateModal(true) }}
          style={{
            padding: '10px 18px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(79, 70, 229, 0.25)',
            fontSize: 13
          }}
        >
          ➕ Register New Partner
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div style={{ background: '#fce8e6', color: '#c5221f', padding: '12px 16px', borderRadius: 12, fontSize: 14, border: '1px solid #fad2cf', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}
      {successMessage && (
        <div style={{ background: '#e6f4ea', color: '#137333', padding: '12px 16px', borderRadius: 12, fontSize: 14, border: '1px solid #ceead6', fontWeight: 600 }}>
          ✓ {successMessage}
        </div>
      )}

      {/* Filters & Search */}
      <div style={{ 
        background: '#fff', 
        border: '1px solid #e2e8f0', 
        borderRadius: 16, 
        padding: '14px 18px', 
        display: 'flex', 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        gap: 14, 
        alignItems: 'center', 
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
      }}>
        {/* Status Filter Chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Partners', count: counts.all },
            { id: 'pending', label: '⏳ Pending/Review', count: counts.pending },
            { id: 'under_review', label: '👀 Under Review', count: counts.under_review },
            { id: 'approved', label: '✓ Verified', count: counts.approved },
            { id: 'rejected', label: '❌ Rejected', count: counts.rejected }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setStatusFilter(chip.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid',
                background: statusFilter === chip.id ? '#0f172a' : '#fff',
                borderColor: statusFilter === chip.id ? '#0f172a' : '#e2e8f0',
                color: statusFilter === chip.id ? '#fff' : '#475569',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: statusFilter === chip.id ? '0 4px 10px rgba(15, 23, 42, 0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {chip.label}
              <span style={{ 
                fontSize: 10, 
                padding: '1px 6px', 
                borderRadius: 10, 
                background: statusFilter === chip.id ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                color: statusFilter === chip.id ? '#fff' : '#64748b'
              }}>
                {chip.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: 'min(100%, 300px)' }}>
          <input
            type="text"
            placeholder="Search by name, ID, email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              outline: 'none',
              transition: 'border-color 0.15s ease'
            }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }}>🔍</span>
        </div>
      </div>

      {/* Partners List Grid */}
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 200 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #f3f4f6', borderTopColor: '#0f172a', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ color: '#64748b', fontSize: 13 }}>Fetching partners directory...</div>
          </div>
        </div>
      ) : filteredPartners.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '48px 24px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#334155', marginBottom: 4 }}>No Partners Found</div>
          <div style={{ fontSize: 13 }}>Try adjusting your filters or search terms.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {filteredPartners.map(partner => {
            const vBadge = statusBadgeStyle(partner.verification_status)
            const sBadge = statusBadgeStyle(partner.status)
            const docSummary = partner.document_summary || { total: 0, pending: 0, approved: 0, rejected: 0 }
            
            return (
              <motion.div
                key={partner.id}
                whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)' }}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 18,
                  padding: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.02)',
                  opacity: partner.status === 'inactive' ? 0.75 : 1,
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setSelectedPartnerId(partner.id)}
              >
                <div>
                  {/* Top line: Display ID & Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>
                      🆔 ID: {partner.delivery_partner_id}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 6,
                        fontSize: 9,
                        fontWeight: 700,
                        border: '1px solid',
                        ...sBadge
                      }}>
                        {String(partner.status || 'active').toUpperCase()}
                      </span>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 6,
                        fontSize: 9,
                        fontWeight: 700,
                        border: '1px solid',
                        ...vBadge
                      }}>
                        {String(partner.verification_status || 'Pending').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Name and Basic Contact */}
                  <h4 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                    {partner.name}
                  </h4>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'grid', gap: 2, marginBottom: 14 }}>
                    <div>✉ {partner.email}</div>
                    <div>📞 {partner.mobile_number || 'No phone added'}</div>
                    <div style={{ fontWeight: 600 }}>📍 Area: {partner.assigned_area || 'Not assigned'}</div>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div style={{ 
                  borderTop: '1px solid #f1f5f9', 
                  paddingTop: 12, 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                    <span style={{ color: '#475569', fontWeight: 600 }}>Docs:</span>
                    <span style={{ 
                      color: docSummary.total === 3 && docSummary.approved === 3 ? '#166534' : '#1e3a8a',
                      fontWeight: 700
                    }}>
                      {docSummary.approved}/3 Approved
                    </span>
                    {docSummary.pending > 0 && (
                      <span style={{ color: '#b06000', fontWeight: 700 }}>
                        ({docSummary.pending} Review)
                      </span>
                    )}
                    {docSummary.rejected > 0 && (
                      <span style={{ color: '#c5221f', fontWeight: 700 }}>
                        ({docSummary.rejected} Rejected)
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: '#4f46e5', fontWeight: 800 }}>Review →</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Slide-over Detail Drawer */}
      <AnimatePresence>
        {selectedPartnerId && (
          <>
            {/* Dark Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!rejectingDocId && !rejectingProfile) {
                  setSelectedPartnerId(null)
                }
              }}
              style={{
                position: 'fixed',
                inset: 0,
                background: '#0f172a',
                zIndex: 1000
              }}
            />

            {/* Slide-in Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: 'min(100vw, 550px)',
                background: '#fff',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
                zIndex: 1001,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header */}
              <div style={{ 
                padding: '20px 24px', 
                borderBottom: '1px solid #f1f5f9', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                    {loadingDetail ? 'Loading Details...' : detailPartner?.name}
                  </h3>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    ID: {detailPartner?.delivery_partner_id} • Registered {detailPartner && new Date(detailPartner.created_at).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {detailPartner && (
                    <button
                      onClick={() => handleOpenEditModal(detailPartner)}
                      style={{
                        padding: '6px 12px',
                        background: '#f1f5f9',
                        color: '#4f46e5',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ✏ Edit Info
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedPartnerId(null)}
                    style={{
                      border: 'none',
                      background: '#f1f5f9',
                      borderRadius: '50%',
                      width: 32,
                      height: 32,
                      cursor: 'pointer',
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#475569',
                      display: 'grid',
                      placeItems: 'center'
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Scrollable Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'grid', gap: 24 }}>
                {loadingDetail ? (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                    <div style={{ width: 28, height: 28, border: '3px solid #f3f4f6', borderTopColor: '#0f172a', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : detailPartner ? (
                  <>
                    {/* Overall Status Banner */}
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{
                        flex: 1,
                        background: statusBadgeStyle(detailPartner.verification_status).bg,
                        border: `1px solid ${statusBadgeStyle(detailPartner.verification_status).border}`,
                        color: statusBadgeStyle(detailPartner.verification_status).color,
                        padding: '12px 16px',
                        borderRadius: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 13,
                        fontWeight: 700
                      }}>
                        <span>Verification:</span>
                        <span style={{ textTransform: 'uppercase' }}>
                          {detailPartner.verification_status || 'Pending'}
                        </span>
                      </div>

                      <div style={{
                        flex: 1,
                        background: statusBadgeStyle(detailPartner.status).bg,
                        border: `1px solid ${statusBadgeStyle(detailPartner.status).border}`,
                        color: statusBadgeStyle(detailPartner.status).color,
                        padding: '12px 16px',
                        borderRadius: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 13,
                        fontWeight: 700
                      }}>
                        <span>Account:</span>
                        <span style={{ textTransform: 'uppercase' }}>
                          {detailPartner.status || 'Active'}
                        </span>
                      </div>
                    </div>

                    {/* Partner Profile Details */}
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        👤 Profile Details
                      </h4>
                      <div style={{ 
                        background: '#f8fafc', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: 14, 
                        padding: 16,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 12,
                        fontSize: 13
                      }}>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ color: '#64748b' }}>Full Residential Address:</span>
                          <div style={{ fontWeight: 700, marginTop: 2, color: '#0f172a' }}>
                            {detailPartner.address_line || 'Not Provided'}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>City:</span>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{detailPartner.address_city || 'Not Provided'}</div>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>State:</span>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{detailPartner.address_state || 'Not Provided'}</div>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Pincode:</span>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{detailPartner.address_pincode || 'Not Provided'}</div>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Mobile Number:</span>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{detailPartner.mobile_number || 'Not Provided'}</div>
                        </div>
                        <div style={{ borderTop: '1px solid #e2e8f0', gridColumn: 'span 2', paddingVerical: 8 }} />
                        <div>
                          <span style={{ color: '#64748b' }}>Vehicle Type:</span>
                          <div style={{ fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>
                            {detailPartner.vehicle_type ? detailPartner.vehicle_type.replace('_', ' ') : 'Not Provided'}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Vehicle Number:</span>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{detailPartner.vehicle_number || 'Not Provided'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Profile Photo Section */}
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📸 Live-Captured Profile Photo
                      </h4>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{ 
                          width: 96, 
                          height: 96, 
                          borderRadius: 12, 
                          border: '2px solid #cbd5e1', 
                          overflow: 'hidden', 
                          background: '#f8fafc',
                          cursor: detailPartner.profile_photo_url ? 'zoom-in' : 'default'
                        }}
                          onClick={() => detailPartner.profile_photo_url && setPreviewImageUrl(detailPartner.profile_photo_url)}
                        >
                          {detailPartner.profile_photo_url ? (
                            <img src={detailPartner.profile_photo_url} alt="Live Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 32, color: '#94a3b8' }}>👤</div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                            {detailPartner.profile_photo_url ? '✓ Live capture confirmed' : '⏳ Photo not captured yet'}
                          </div>
                          {detailPartner.profile_photo_url && (
                            <button
                              onClick={() => setPreviewImageUrl(detailPartner.profile_photo_url)}
                              style={{ padding: '6px 12px', background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >
                              🔍 View Photo Fullscreen
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Verification Documents List */}
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📄 Identification & Registration Files
                      </h4>
                      <div style={{ display: 'grid', gap: 14 }}>
                        {['aadhaar', 'driving_license', 'vehicle_rc'].map(docType => {
                          const doc = detailDocs.find(d => d.document_type === docType)
                          const label = docType.toUpperCase().replace('_', ' ')
                          const dBadge = statusBadgeStyle(doc ? doc.status : 'missing')

                          return (
                            <div key={docType} style={{
                              padding: 16,
                              borderRadius: 14,
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 12
                            }}>
                              {/* Header of doc card */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>
                                  {label}
                                </span>
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  border: '1px solid',
                                  ...dBadge
                                }}>
                                  {doc ? doc.status.toUpperCase() : 'MISSING'}
                                </span>
                              </div>

                              {doc ? (
                                <>
                                  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#64748b' }}>
                                      Uploaded: {new Date(doc.uploaded_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                    <a
                                      href={doc.file_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
                                    >
                                      📄 Open File
                                    </a>
                                  </div>

                                  {/* If rejected reason is present */}
                                  {doc.status === 'rejected' && doc.rejection_reason && (
                                    <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', color: '#c5221f', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                                      <strong>Rejection Reason:</strong> {doc.rejection_reason}
                                    </div>
                                  )}

                                  {/* Approve / Reject Controls */}
                                  {doc.status === 'pending' && (
                                    <div style={{ display: 'flex', gap: 10, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                                      <button
                                        onClick={() => handleApproveDocument(doc.id)}
                                        style={{
                                          flex: 1,
                                          padding: '8px 12px',
                                          background: '#166534',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: 8,
                                          fontSize: 12,
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ✓ Approve
                                      </button>
                                      <button
                                        onClick={() => setRejectingDocId(doc.id)}
                                        style={{
                                          flex: 1,
                                          padding: '8px 12px',
                                          background: '#c5221f',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: 8,
                                          fontSize: 12,
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ❌ Reject
                                      </button>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                                  Document has not been uploaded by the delivery partner.
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Audit Logs Trail */}
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📜 Verification Audit Trail
                      </h4>
                      {loadingAudit ? (
                        <div style={{ fontSize: 12, color: '#64748b' }}>Loading trail...</div>
                      ) : detailAudit.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No verification events recorded yet.</div>
                      ) : (
                        <div style={{ display: 'grid', gap: 10, maxHeight: 180, overflowY: 'auto', paddingRight: 6 }}>
                          {detailAudit.map(log => (
                            <div key={log.id} style={{ 
                              background: '#f8fafc', 
                              border: '1px solid #e2e8f0', 
                              borderRadius: 10, 
                              padding: 10,
                              fontSize: 12 
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#334155' }}>
                                <span>{log.action.replace('_', ' ').toUpperCase()}</span>
                                <span style={{ fontSize: 10, color: '#64748b' }}>
                                  {new Date(log.performed_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                </span>
                              </div>
                              {log.notes && <div style={{ marginTop: 2, color: '#475569' }}>{log.notes}</div>}
                              {log.rejection_reason && (
                                <div style={{ marginTop: 4, color: '#b91c1c', fontWeight: 600 }}>
                                  Reason: {log.rejection_reason}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>

              {/* Footer Panel Actions */}
              {detailPartner && (
                <div style={{ 
                  padding: '16px 24px', 
                  borderTop: '1px solid #f1f5f9', 
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12 
                }}>
                  {/* Account Activation Toggle Shortcut */}
                  <button
                    onClick={() => handleToggleStatus(detailPartner)}
                    style={{
                      padding: '10px 16px',
                      background: detailPartner.status === 'active' ? '#fff7ed' : '#e6f4ea',
                      color: detailPartner.status === 'active' ? '#c2410c' : '#137333',
                      border: '1px solid',
                      borderColor: detailPartner.status === 'active' ? '#ffedd5' : '#ceead6',
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    ⚙ {detailPartner.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
                  </button>

                  <div style={{ display: 'flex', gap: 12 }}>
                    {detailPartner.verification_status !== 'approved' && (
                      <button
                        onClick={handleApproveProfile}
                        style={{
                          flex: 2,
                          padding: '12px 16px',
                          background: 'linear-gradient(135deg, #166534 0%, #14532d 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 10,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(22, 101, 52, 0.25)'
                        }}
                      >
                        ✓ Approve Entire Profile
                      </button>
                    )}
                    {detailPartner.verification_status !== 'rejected' && (
                      <button
                        onClick={() => setRejectingProfile(true)}
                        style={{
                          flex: 1,
                          padding: '12px 16px',
                          background: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 10,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        ❌ Reject
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Creation Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1500,
            display: 'grid',
            placeItems: 'center',
            padding: 16
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#fff',
                borderRadius: 20,
                padding: 24,
                maxWidth: 480,
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'grid',
                gap: 16
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  Register New Delivery Partner
                </h4>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}
                >
                  ×
                </button>
              </div>

              {tempCredentials ? (
                <div style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 13,
                  display: 'grid',
                  gap: 10
                }}>
                  <div style={{ fontWeight: 700, color: '#0369a1', fontSize: 14 }}>
                    ✅ Delivery Partner Account Created!
                  </div>
                  <div>Please share these temporary credentials with the partner to log in:</div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontFamily: 'monospace', display: 'grid', gap: 4 }}>
                    <div><strong>ID:</strong> {tempCredentials.id}</div>
                    <div><strong>Email:</strong> {tempCredentials.email}</div>
                    <div><strong>Temporary Password:</strong> {tempCredentials.password}</div>
                  </div>
                  <button
                    onClick={() => { setTempCredentials(null); setShowCreateModal(false) }}
                    style={{
                      padding: '8px 12px',
                      background: '#0369a1',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginTop: 6
                    }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreatePartnerSubmit} style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Partner Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={createFormData.name}
                      onChange={e => setCreateFormData({ ...createFormData, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. ramesh@gmail.com"
                      value={createFormData.email}
                      onChange={e => setCreateFormData({ ...createFormData, email: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Mobile Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="10-digit number"
                      value={createFormData.mobileNumber}
                      onChange={e => setCreateFormData({ ...createFormData, mobileNumber: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13 }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Assigned District *</label>
                      <select
                        required
                        value={createFormData.route}
                        onChange={e => setCreateFormData({ ...createFormData, route: e.target.value, area: '' })}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, background: '#fff' }}
                      >
                        <option value="">Select District</option>
                        {BIHAR_ROUTE_OPTIONS.map(district => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Assigned Area *</label>
                      <select
                        required
                        disabled={!createFormData.route}
                        value={createFormData.area}
                        onChange={e => setCreateFormData({ ...createFormData, area: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, background: '#fff' }}
                      >
                        <option value="">Select Area</option>
                        {(BIHAR_ROUTE_AREAS[createFormData.route] || []).map(area => (
                          <option key={area} value={area}>{area}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        background: '#f1f5f9',
                        border: 'none',
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        color: '#475569'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                        border: 'none',
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        color: '#fff'
                      }}
                    >
                      {creating ? 'Registering...' : 'Register Partner'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Info Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1500,
            display: 'grid',
            placeItems: 'center',
            padding: 16
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#fff',
                borderRadius: 20,
                padding: 24,
                maxWidth: 480,
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'grid',
                gap: 16
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  Edit Partner Information
                </h4>
                <button
                  onClick={() => setShowEditModal(false)}
                  style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleEditPartnerSubmit} style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Email Address</label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Mobile Number</label>
                  <input
                    type="text"
                    required
                    value={editFormData.mobileNumber}
                    onChange={e => setEditFormData({ ...editFormData, mobileNumber: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Assigned District</label>
                    <select
                      required
                      value={editFormData.route}
                      onChange={e => setEditFormData({ ...editFormData, route: e.target.value, area: '' })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, background: '#fff' }}
                    >
                      <option value="">Select District</option>
                      {BIHAR_ROUTE_OPTIONS.map(district => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Assigned Area</label>
                    <select
                      required
                      disabled={!editFormData.route}
                      value={editFormData.area}
                      onChange={e => setEditFormData({ ...editFormData, area: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, background: '#fff' }}
                    >
                      <option value="">Select Area</option>
                      {(BIHAR_ROUTE_AREAS[editFormData.route] || []).map(area => (
                        <option key={area} value={area}>{area}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Account Status</label>
                  <select
                    value={editFormData.status}
                    onChange={e => setEditFormData({ ...editFormData, status: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, background: '#fff' }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Reset Password (Optional)</label>
                  <input
                    type="password"
                    placeholder="Enter new password to reset"
                    value={editFormData.password}
                    onChange={e => setEditFormData({ ...editFormData, password: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      color: '#475569'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                      border: 'none',
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      color: '#fff'
                    }}
                  >
                    {updating ? 'Updating...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inline Modal for Document Rejection Reason */}
      <AnimatePresence>
        {rejectingDocId && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 2000,
            display: 'grid',
            placeItems: 'center',
            padding: 16
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#fff',
                borderRadius: 18,
                padding: 24,
                maxWidth: 420,
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              }}
            >
              <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                Document Rejection Reason
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: 12, color: '#64748b' }}>
                Please specify the exact reason for rejecting this document. This will be shown to the delivery partner so they can upload a correct document.
              </p>

              <form onSubmit={handleRejectDocument}>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Aadhaar image is blurry, name mismatch, or expired license"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    outline: 'none',
                    resize: 'none',
                    marginBottom: 16
                  }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setRejectingDocId(null); setRejectionReason('') }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      color: '#475569'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReject}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: '#dc2626',
                      border: 'none',
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      color: '#fff'
                    }}
                  >
                    {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inline Modal for Overall Profile Rejection Reason */}
      <AnimatePresence>
        {rejectingProfile && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 2000,
            display: 'grid',
            placeItems: 'center',
            padding: 16
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#fff',
                borderRadius: 18,
                padding: 24,
                maxWidth: 420,
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              }}
            >
              <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                Profile Rejection Reason
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: 12, color: '#64748b' }}>
                Specify why this delivery partner profile is rejected overall. The partner will see this reason in their dashboard.
              </p>

              <form onSubmit={handleRejectProfile}>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Mismatched vehicle number, failed verification audit, fake identification documents"
                  value={profileRejectionReason}
                  onChange={e => setProfileRejectionReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    outline: 'none',
                    resize: 'none',
                    marginBottom: 16
                  }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setRejectingProfile(false); setProfileRejectionReason('') }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      color: '#475569'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: '#dc2626',
                      border: 'none',
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      color: '#fff'
                    }}
                  >
                    Reject Profile
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImageUrl && (
          <div
            onClick={() => setPreviewImageUrl(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.8)',
              zIndex: 2500,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24,
              cursor: 'zoom-out'
            }}
          >
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              src={previewImageUrl}
              alt="Verification File Preview"
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                borderRadius: 12,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                border: '4px solid #fff'
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
