import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BankAccountSection from '../components/BankAccountSection'


const API_BASE = import.meta.env.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '')
  : (import.meta.env.PROD ? '' : 'http://localhost:5001')

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png'])
const ALLOWED_DOCUMENT_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'])

function statusBadgeStyle(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'approved') {
    return { bg: '#e6f4ea', color: '#137333', border: '#ceead6' }
  }
  if (normalized === 'pending' || normalized === 'under_review') {
    return { bg: '#fef7e0', color: '#b06000', border: '#feebc8' }
  }
  if (normalized === 'rejected') {
    return { bg: '#fce8e6', color: '#c5221f', border: '#fad2cf' }
  }
  return { bg: '#f1f3f4', color: '#3c4043', border: '#e8eaed' }
}

export default function DeliveryPartnerProfile({ deliveryPartnerId }) {
  const deliveryPartnerToken = localStorage.getItem('delivery_partner_id') // Uses delivery partner auth flow
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(null)

  const [partner, setPartner] = useState(null)
  const [documents, setDocuments] = useState([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [docUploadingType, setDocUploadingType] = useState('')

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const cameraStreamRef = useRef(null)

  const [form, setForm] = useState({
    mobile_number: '',
    address_line: '',
    address_city: '',
    address_state: '',
    address_pincode: '',
    vehicle_type: '',
    vehicle_number: ''
  })

  // Group documents by document_type
  const docMap = React.useMemo(() => {
    const map = new Map()
    documents.forEach(doc => {
      map.set(doc.document_type, doc)
    })
    return map
  }, [documents])

  const stopCameraStream = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    fetchProfile()
    return () => stopCameraStream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchProfile = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/delivery/profile`, {
        headers: {
          'x-delivery-partner-id': deliveryPartnerId || deliveryPartnerToken
        }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load profile details')
      
      const p = data.partner || {}
      setPartner(p)
      setDocuments(data.documents || [])

      setForm({
        mobile_number: p.mobile_number || '',
        address_line: p.address_line || '',
        address_city: p.address_city || '',
        address_state: p.address_state || '',
        address_pincode: p.address_pincode || '',
        vehicle_type: p.vehicle_type || '',
        vehicle_number: p.vehicle_number || ''
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage(null)
    try {
      // Validation
      if (!form.mobile_number.trim()) {
        throw new Error('Phone number is required')
      }
      if (form.address_pincode && !/^\d{6}$/.test(form.address_pincode)) {
        throw new Error('Pincode must be a 6-digit number')
      }

      // Update phone number (always allowed)
      const phoneRes = await fetch(`${API_BASE}/api/delivery/profile/phone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-delivery-partner-id': deliveryPartnerId || deliveryPartnerToken
        },
        body: JSON.stringify({ mobile_number: form.mobile_number })
      })
      const phonePayload = await phoneRes.json()
      if (!phoneRes.ok) throw new Error(phonePayload.error || 'Failed to save phone number')

      // Update other profile details (if not locked)
      if (!partner?.profile_details_locked) {
        const profileRes = await fetch(`${API_BASE}/api/delivery/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-delivery-partner-id': deliveryPartnerId || deliveryPartnerToken
          },
          body: JSON.stringify({
            address_line: form.address_line,
            address_city: form.address_city,
            address_state: form.address_state,
            address_pincode: form.address_pincode,
            vehicle_type: form.vehicle_type,
            vehicle_number: form.vehicle_number
          })
        })
        const profilePayload = await profileRes.json()
        if (!profileRes.ok) throw new Error(profilePayload.error || 'Failed to save profile details')
      }

      setMessage({ type: 'success', text: 'Profile saved successfully.' })
      fetchProfile()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openLiveCamera = async () => {
    setError('')
    setMessage(null)
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('Live camera is not supported on this device/browser.')
      return
    }
    setCameraOpen(true)
    setCameraStarting(true)
    stopCameraStream()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      })
      cameraStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
    } catch (err) {
      setError('Unable to access camera. Please allow camera permissions.')
      setCameraOpen(false)
    } finally {
      setCameraStarting(false)
    }
  }

  const captureLivePhoto = async () => {
    if (photoUploading) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) {
      setError('Camera preview is not ready.')
      return
    }

    const width = video.videoWidth
    const height = video.videoHeight
    if (width <= 0 || height <= 0) return

    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(video, 0, 0, width, height)
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    })

    if (!blob) {
      setError('Failed to capture photo.')
      return
    }

    const file = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' })
    await uploadPhotoFile(file)
  }

  const uploadPhotoFile = async (file) => {
    setPhotoUploading(true)
    setError('')
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('source', 'camera')

      const res = await fetch(`${API_BASE}/api/delivery/profile/photo`, {
        method: 'POST',
        headers: {
          'x-delivery-partner-id': deliveryPartnerId || deliveryPartnerToken
        },
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to upload photo')

      setMessage({ type: 'success', text: 'Live photo uploaded successfully.' })
      stopCameraStream()
      setCameraOpen(false)
      fetchProfile()
    } catch (err) {
      setError(err.message)
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleDocumentUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setError('')
    setMessage(null)

    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
      setError('Only PDF, JPG, and PNG files are allowed.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('File size must be 5MB or smaller.')
      return
    }

    setDocUploadingType(type)
    try {
      const formData = new FormData()
      formData.append('document', file)

      const res = await fetch(`${API_BASE}/api/delivery/documents/${type}`, {
        method: 'POST',
        headers: {
          'x-delivery-partner-id': deliveryPartnerId || deliveryPartnerToken
        },
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to upload document')

      setMessage({ type: 'success', text: `${type.toUpperCase().replace('_', ' ')} uploaded successfully.` })
      fetchProfile()
    } catch (err) {
      setError(err.message)
    } finally {
      setDocUploadingType('')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '300px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, border: '4px solid #f3f4f6', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <div style={{ color: '#6b7280', fontSize: 14, fontWeight: 500 }}>Loading profile...</div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 0 24px 0', maxWidth: 1200, margin: '0 auto' }}>
      
      {/* Messages */}
      {error && (
        <div style={{ background: '#fce8e6', color: '#c5221f', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 14, border: '1px solid #fad2cf', fontWeight: 500 }}>
          ⚠️ {error}
        </div>
      )}
      {message && (
        <div style={{ background: '#e6f4ea', color: '#137333', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 14, border: 'ceead6', fontWeight: 500 }}>
          ✓ {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        
        {/* Left Card: Live Capture & General Status */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          
          <div style={{ position: 'relative', width: 140, height: 140, borderRadius: '50%', border: '4px solid #e2e8f0', overflow: 'hidden', background: '#f8fafc', marginBottom: 16 }}>
            {partner?.profile_photo_url ? (
              <img src={partner.profile_photo_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 48, color: '#94a3b8' }}>👤</div>
            )}
          </div>

          <h3 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: 20, fontWeight: 800 }}>{partner?.name}</h3>
          <p style={{ margin: '0 0 12px 0', color: '#64748b', fontSize: 13 }}>ID: {partner?.delivery_partner_id}</p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
            <span style={{
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              border: '1px solid',
              ...statusBadgeStyle(partner?.verification_status)
            }}>
              Verification: {String(partner?.verification_status || 'Pending').toUpperCase().replace('_', ' ')}
            </span>
            <span style={{
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              border: '1px solid',
              background: partner?.status === 'active' ? '#e6f4ea' : '#fce8e6',
              color: partner?.status === 'active' ? '#137333' : '#c5221f',
              borderColor: partner?.status === 'active' ? '#ceead6' : '#fad2cf'
            }}>
              Status: {String(partner?.status || 'inactive').toUpperCase()}
            </span>
          </div>

          {/* Photo upload / Capture */}
          {!partner?.profile_photo_locked ? (
            <button
              onClick={openLiveCamera}
              disabled={photoUploading}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                color: '#fff',
                borderRadius: 12,
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
              }}
            >
              📸 Capture Live Photo
            </button>
          ) : (
            <div style={{ color: '#64748b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '8px 12px', borderRadius: 8, width: '100%', justifyContent: 'center' }}>
              🔒 Profile Photo is verified and locked
            </div>
          )}

          {/* Camera View Modal inside Card */}
          <AnimatePresence>
            {cameraOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(15, 23, 42, 0.8)',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 16,
                  zIndex: 2000
                }}
              >
                <div style={{ background: '#fff', padding: 24, borderRadius: 20, maxWidth: 480, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#0f172a', fontWeight: 800 }}>Take Live Profile Photo</h4>
                  
                  <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', background: '#000', position: 'relative', marginBottom: 20 }}>
                    {cameraStarting && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 14 }}>
                        Starting camera...
                      </div>
                    )}
                    <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                  </div>

                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                    <button
                      onClick={() => { stopCameraStream(); setCameraOpen(false) }}
                      style={{ flex: 1, padding: '10px 16px', background: '#f1f5f9', color: '#0f172a', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={captureLivePhoto}
                      disabled={photoUploading}
                      style={{ flex: 1, padding: '10px 16px', background: '#2563eb', color: '#fff', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {photoUploading ? 'Uploading...' : 'Capture'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <hr style={{ width: '100%', border: '0', borderTop: '1px solid #f1f5f9', margin: '20px 0' }} />

          <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#475569' }}>
            <div>Joined: <strong>{new Date(partner?.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></div>
            <div>Assigned Area: <strong>{partner?.assigned_area || 'Not Assigned'}</strong></div>
            <div>Registered Email: <strong>{partner?.email}</strong></div>
          </div>
        </div>

        {/* Right Card: Personal Info and Vehicle Details */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: 18, fontWeight: 800 }}>Personal & Vehicle Details</h3>
            {partner?.profile_details_locked && (
              <span style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>🔒 Locked</span>
            )}
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Phone Number - ALWAYS EDITABLE */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Phone Number *</label>
              <input
                type="text"
                value={form.mobile_number}
                onChange={e => setForm({ ...form, mobile_number: e.target.value })}
                placeholder="Enter phone number"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, outline: 'none' }}
              />
            </div>

            {/* Address Details - Locked after verification */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Residential Address</label>
              <input
                type="text"
                disabled={partner?.profile_details_locked}
                value={form.address_line}
                onChange={e => setForm({ ...form, address_line: e.target.value })}
                placeholder="House No, Street, Landmark"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, outline: 'none', background: partner?.profile_details_locked ? '#f8fafc' : '#fff' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>City</label>
                <input
                  type="text"
                  disabled={partner?.profile_details_locked}
                  value={form.address_city}
                  onChange={e => setForm({ ...form, address_city: e.target.value })}
                  placeholder="City"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, outline: 'none', background: partner?.profile_details_locked ? '#f8fafc' : '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>State</label>
                <input
                  type="text"
                  disabled={partner?.profile_details_locked}
                  value={form.address_state}
                  onChange={e => setForm({ ...form, address_state: e.target.value })}
                  placeholder="State"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, outline: 'none', background: partner?.profile_details_locked ? '#f8fafc' : '#fff' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Pincode</label>
              <input
                type="text"
                disabled={partner?.profile_details_locked}
                value={form.address_pincode}
                onChange={e => setForm({ ...form, address_pincode: e.target.value })}
                placeholder="6-digit pincode"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, outline: 'none', background: partner?.profile_details_locked ? '#f8fafc' : '#fff' }}
              />
            </div>

            {/* Vehicle Details - Locked after verification */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Vehicle Type</label>
                <select
                  disabled={partner?.profile_details_locked}
                  value={form.vehicle_type}
                  onChange={e => setForm({ ...form, vehicle_type: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, outline: 'none', background: partner?.profile_details_locked ? '#f8fafc' : '#fff' }}
                >
                  <option value="">Select Type</option>
                  <option value="motorcycle">Motorcycle / Scooter</option>
                  <option value="three_wheeler">Three-Wheeler / Auto</option>
                  <option value="e_rickshaw">E-Rickshaw</option>
                  <option value="truck">Mini Truck / Van</option>
                  <option value="bicycle">Bicycle</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Vehicle Number</label>
                <input
                  type="text"
                  disabled={partner?.profile_details_locked}
                  value={form.vehicle_number}
                  onChange={e => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })}
                  placeholder="e.g. BR-01-AB-1234"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, outline: 'none', background: partner?.profile_details_locked ? '#f8fafc' : '#fff' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: 8,
                padding: '12px 16px',
                background: '#0f172a',
                color: '#fff',
                borderRadius: 12,
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
              }}
            >
              {saving ? 'Saving changes...' : 'Save Profile Details'}
            </button>
          </form>
        </div>

      </div>

      {/* Verification Documents Section */}
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', marginTop: 24 }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: 18, fontWeight: 800 }}>Verification Documents</h3>
        <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: 13 }}>Please upload your Aadhaar Card, Driving License, and Vehicle RC. Approved documents are locked permanently.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {['aadhaar', 'driving_license', 'vehicle_rc'].map((docType) => {
            const doc = docMap.get(docType)
            const label = docType.toUpperCase().replace('_', ' ')
            const isUploading = docUploadingType === docType

            return (
              <div key={docType} style={{ padding: 18, borderRadius: 16, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>{label}</span>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      border: '1px solid',
                      ...statusBadgeStyle(doc?.status || 'missing')
                    }}>
                      {doc ? doc.status.toUpperCase() : 'NOT UPLOADED'}
                    </span>
                  </div>

                  {doc && (
                    <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                      File: <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>{doc.file_name}</a>
                    </div>
                  )}

                  {doc?.status === 'rejected' && doc.rejection_reason && (
                    <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', color: '#c5221f', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginTop: 8 }}>
                      <strong>Rejection Reason:</strong> {doc.rejection_reason}
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                {(!doc || doc.status === 'rejected') ? (
                  <div>
                    <label style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 14px',
                      background: '#fff',
                      border: '1px dashed #cbd5e1',
                      borderRadius: 10,
                      textAlign: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#4f46e5',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}>
                      {isUploading ? 'Uploading...' : doc ? 'Re-upload Document' : 'Upload Document'}
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={(e) => handleDocumentUpload(e, docType)}
                        style={{ display: 'none' }}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' }}>
                    🔒 Locked for review / approved
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <BankAccountSection role="delivery" dpId={deliveryPartnerId || deliveryPartnerToken} />
    </div>
  )
}

