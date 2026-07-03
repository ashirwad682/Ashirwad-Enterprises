import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useMediaQuery } from '../../lib/useMediaQuery'
import BankAccountSection from '../../components/BankAccountSection'


const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png'])
const ALLOWED_DOCUMENT_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'])

const REQUIRED_DOCUMENT_FALLBACK = [
  { document_type: 'aadhaar', document_name: 'Aadhaar Card' },
  { document_type: 'pan', document_name: 'PAN Card' },
  { document_type: 'bank_account_details', document_name: 'Bank Account Details' },
  { document_type: 'police_verification_certificate', document_name: 'Police Verification Certificate', optional: true },
  { document_type: 'passport', document_name: 'Passport', optional: true }
]

function toAbsoluteUrl(input) {
  const value = String(input || '').trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/')) return `${API_BASE}${value}`
  return `${API_BASE}/${value}`
}

function statusBadgeStyle(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('verified')) {
    return { bg: '#dcfce7', color: '#166534', border: '#86efac' }
  }
  if (normalized.includes('review')) {
    return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' }
  }
  if (normalized.includes('rejected')) {
    return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
  }
  return { bg: '#e2e8f0', color: '#334155', border: '#cbd5e1' }
}

function fileSizeLabel(value) {
  const size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) return '-'
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}

function getProfileLockStorageKey(managerId) {
  const id = String(managerId || '').trim()
  if (!id) return null
  return `manager_profile_details_locked_${id}`
}

export default function ManagerProfileTab() {
  const managerToken = localStorage.getItem('manager_token')
  const isCompactLayout = useMediaQuery('(max-width: 1080px)')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(null)

  const [managerMeta, setManagerMeta] = useState(null)
  const [profileMeta, setProfileMeta] = useState(null)
  const [profileDetailsLockedLocal, setProfileDetailsLockedLocal] = useState(false)
  const [requiredDocuments, setRequiredDocuments] = useState(REQUIRED_DOCUMENT_FALLBACK)
  const [documents, setDocuments] = useState([])

  const [photoUploading, setPhotoUploading] = useState(false)
  const [docUploadingType, setDocUploadingType] = useState('')
  const [emailVerificationSending, setEmailVerificationSending] = useState(false)
  const [passwordLinkSending, setPasswordLinkSending] = useState(false)
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const cameraStreamRef = useRef(null)

  const [form, setForm] = useState({
    full_name: '',
    personal_email: '',
    mobile_number: '',
    registered_email: '',
    address_line: '',
    pincode: '',
    state: '',
    district: ''
  })

  const documentMap = useMemo(() => {
    const map = new Map()
    for (const row of documents || []) {
      if (row?.document_type) {
        map.set(row.document_type, row)
      }
    }
    return map
  }, [documents])

  function stopCameraStream() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    return () => {
      stopCameraStream()
    }
  }, [])

  async function fetchProfile() {
    if (!managerToken) {
      setError('Manager session missing. Please log in again.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/api/manager/profile`, {
        headers: { 'x-manager-token': managerToken }
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to load manager profile')
      }

      const manager = payload.manager || {}
      const profile = payload.profile || {}

      const lockStorageKey = getProfileLockStorageKey(manager.id)
      const lockedFromStorage = lockStorageKey ? localStorage.getItem(lockStorageKey) === '1' : false
      const lockedFromApi = Boolean(profile?.profile_details_locked)
      const effectiveLocked = lockedFromApi || lockedFromStorage

      if (lockStorageKey && effectiveLocked) {
        localStorage.setItem(lockStorageKey, '1')
      }

      setManagerMeta(manager)
      setProfileMeta(profile)
      setProfileDetailsLockedLocal(effectiveLocked)
      setRequiredDocuments(Array.isArray(payload.required_documents) && payload.required_documents.length > 0
        ? payload.required_documents
        : REQUIRED_DOCUMENT_FALLBACK)
      setDocuments(Array.isArray(payload.documents) ? payload.documents : [])

      setForm({
        full_name: profile.full_name || manager.full_name || '',
        personal_email: profile.personal_email || '',
        mobile_number: profile.mobile_number || manager.mobile_number || '',
        registered_email: profile.registered_email || manager.registered_email || '',
        address_line: profile.address_line || '',
        pincode: profile.pincode || '',
        state: profile.state || '',
        district: profile.district || ''
      })
    } catch (err) {
      setError(err.message || 'Failed to load manager profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerToken])

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage(null)

    try {
      if (!personalEmailVerified) {
        throw new Error('Please verify personal email first. Save is available after verification.')
      }
      if (!form.full_name.trim()) {
        throw new Error('Full name is required')
      }
      if (!form.personal_email.trim()) {
        throw new Error('Personal email is required')
      }
      if (!form.mobile_number.trim()) {
        throw new Error('Mobile number is required')
      }
      if (!/^\d{6}$/.test(String(form.pincode || '').trim())) {
        throw new Error('Pincode must be 6 digits')
      }

      const shouldLockProfileDetails = personalEmailVerified && !profileDetailsLocked
      const res = await fetch(`${API_BASE}/api/manager/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-manager-token': managerToken
        },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          personal_email: form.personal_email.trim().toLowerCase(),
          mobile_number: form.mobile_number.trim(),
          address_line: form.address_line.trim(),
          pincode: form.pincode.trim(),
          state: form.state.trim(),
          district: form.district.trim(),
          lock_profile_details: shouldLockProfileDetails
        })
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to save profile')
      }

      const nowLocked = Boolean(payload?.profile_details_locked)
      if (nowLocked) {
        const lockStorageKey = getProfileLockStorageKey(managerMeta?.id)
        if (lockStorageKey) {
          localStorage.setItem(lockStorageKey, '1')
        }
        setProfileDetailsLockedLocal(true)
      }

      setMessage({
        type: 'success',
        text: nowLocked
          ? 'Profile saved. Details are now locked. Only mobile number can be changed.'
          : 'Profile saved successfully.'
      })
      await fetchProfile()
    } catch (err) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function uploadPhotoFile(selectedFile, source) {
    if (!selectedFile) return

    setError('')
    setMessage(null)

    if (!ALLOWED_PHOTO_MIME_TYPES.has(selectedFile.type)) {
      setError('Only JPG and PNG files are allowed for profile photos.')
      return
    }

    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setError('Profile photo must be 5MB or smaller.')
      return false
    }

    setPhotoUploading(true)

    try {
      const formData = new FormData()
      formData.append('photo', selectedFile)
      formData.append('source', source)

      const res = await fetch(`${API_BASE}/api/manager/profile-photo`, {
        method: 'POST',
        headers: {
          'x-manager-token': managerToken
        },
        body: formData
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to upload profile photo')
      }

      setMessage({ type: 'success', text: 'Profile photo updated successfully.' })
      await fetchProfile()
      return true
    } catch (err) {
      setError(err.message || 'Failed to upload profile photo')
      return false
    } finally {
      setPhotoUploading(false)
    }
  }

  async function openLiveCamera() {
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
      const text = String(err?.message || '')
      if (text.toLowerCase().includes('permission') || text.toLowerCase().includes('notallowed')) {
        setError('Camera access denied. Please allow camera permission and try again.')
      } else {
        setError('Unable to start live camera. Please check camera settings and retry.')
      }
      setCameraOpen(false)
      stopCameraStream()
    } finally {
      setCameraStarting(false)
    }
  }

  function closeLiveCamera() {
    stopCameraStream()
    setCameraOpen(false)
  }

  async function captureLivePhoto() {
    if (photoUploading) return

    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) {
      setError('Camera preview is not ready yet.')
      return
    }

    const width = Number(video.videoWidth || 0)
    const height = Number(video.videoHeight || 0)
    if (width <= 0 || height <= 0) {
      setError('Camera is still loading. Please wait a moment and try again.')
      return
    }

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      setError('Unable to capture live photo.')
      return
    }

    context.drawImage(video, 0, 0, width, height)

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    })

    if (!blob) {
      setError('Unable to capture photo from camera.')
      return
    }

    const liveFile = new File([blob], `manager-live-photo-${Date.now()}.jpg`, {
      type: 'image/jpeg'
    })

    const success = await uploadPhotoFile(liveFile, 'camera')
    if (success) {
      closeLiveCamera()
    }
  }

  async function handleDocumentUpload(event, documentType) {
    const selectedFile = event?.target?.files?.[0]
    event.target.value = ''
    if (!selectedFile) return

    setError('')
    setMessage(null)

    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(selectedFile.type)) {
      setError('Only PDF, JPG, and PNG files are allowed for documents.')
      return
    }

    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setError('Document size must be 5MB or smaller.')
      return
    }

    setDocUploadingType(documentType)

    try {
      const formData = new FormData()
      formData.append('document', selectedFile)

      const res = await fetch(`${API_BASE}/api/manager/verification-documents/${documentType}`, {
        method: 'POST',
        headers: {
          'x-manager-token': managerToken
        },
        body: formData
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to upload document')
      }

      setDocuments(Array.isArray(payload.documents) ? payload.documents : [])
      setProfileMeta((prev) => prev ? {
        ...prev,
        profile_verification_status: payload.verification_status || prev.profile_verification_status
      } : prev)

      setMessage({ type: 'success', text: payload.message || 'Document uploaded successfully.' })
    } catch (err) {
      setError(err.message || 'Failed to upload document')
    } finally {
      setDocUploadingType('')
    }
  }

  async function handleSendEmailVerification() {
    const candidateEmail = String(form.personal_email || '').trim().toLowerCase()
    if (!candidateEmail) {
      setError('Please add a personal email address before requesting verification.')
      return
    }

    setEmailVerificationSending(true)
    setError('')
    setMessage(null)

    try {
      const res = await fetch(`${API_BASE}/api/manager/personal-email/send-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-manager-token': managerToken
        },
        body: JSON.stringify({ personal_email: candidateEmail })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to send verification email')
      }

      setMessage({ type: 'success', text: payload.message || 'Verification email sent.' })
      await fetchProfile()
    } catch (err) {
      setError(err.message || 'Failed to send verification email')
    } finally {
      setEmailVerificationSending(false)
    }
  }

  async function handleSendPasswordLink() {
    setPasswordLinkSending(true)
    setError('')
    setMessage(null)

    try {
      const res = await fetch(`${API_BASE}/api/manager/password-reset/request-auth`, {
        method: 'POST',
        headers: {
          'x-manager-token': managerToken
        }
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to send password reset link')
      }

      setMessage({ type: 'success', text: payload.message || 'Password reset link sent.' })
    } catch (err) {
      setError(err.message || 'Failed to send password reset link')
    } finally {
      setPasswordLinkSending(false)
    }
  }

  async function lookupPincode() {
    const code = String(form.pincode || '').trim()
    if (!/^\d{6}$/.test(code)) return

    setPincodeLookupLoading(true)
    setError('')

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${code}`)
      const payload = await res.json().catch(() => [])
      const first = Array.isArray(payload) ? payload[0] : null
      const postOffice = first?.PostOffice?.[0]

      if (first?.Status !== 'Success' || !postOffice) {
        throw new Error('Unable to auto-fetch state and district for this pincode.')
      }

      setForm((prev) => ({
        ...prev,
        state: postOffice.State || prev.state,
        district: postOffice.District || prev.district
      }))
    } catch (err) {
      setError(err.message || 'Pincode lookup failed')
    } finally {
      setPincodeLookupLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, color: '#64748b' }}>Loading manager profile...</div>
  }

  const accountStatus = managerMeta?.account_status || 'inactive'
  const accountIsActive = accountStatus === 'active'
  const verificationStatus = profileMeta?.profile_verification_status || 'Pending Verification'
  const verificationStyle = statusBadgeStyle(verificationStatus)
  const accountStyle = statusBadgeStyle(accountIsActive ? 'Verified' : 'Rejected')
  const profilePhotoUrl = toAbsoluteUrl(profileMeta?.profile_photo_url)
  const verifiedPersonalEmail = String(profileMeta?.personal_email || '').trim().toLowerCase()
  const personalEmailVerified = Boolean(profileMeta?.personal_email_verified) && Boolean(verifiedPersonalEmail)
  const profileDetailsLocked = Boolean(profileMeta?.profile_details_locked) || profileDetailsLockedLocal
  const personalEmailLocked = personalEmailVerified
  const personalEmailNeedsVerification = !personalEmailLocked
  const personalEmailAvatarUrl = personalEmailVerified
    ? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(verifiedPersonalEmail)}&radius=22`
    : null
  const displayedProfilePhotoUrl = profilePhotoUrl || personalEmailAvatarUrl
  const managerDisplayName = String(managerMeta?.full_name || managerMeta?.name || 'Manager').trim() || 'Manager'
  const labelStyle = { fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.35px' }
  const inputBaseStyle = {
    width: '100%',
    marginTop: 6,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #d8dee6',
    fontSize: 14,
    background: '#fff',
    color: '#1f2937'
  }
  const lockedInputStyle = {
    ...inputBaseStyle,
    background: '#f8fafc',
    color: '#64748b',
    cursor: 'not-allowed'
  }
  const lockPillStyle = {
    padding: '1px 6px',
    borderRadius: 999,
    border: '1px solid #e5e7eb',
    background: '#f8fafc',
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: 700
  }
  const documentIconByType = {
    aadhaar: '🆔',
    pan: '💳',
    bank_account_details: '🏦',
    police_verification_certificate: '🧑‍✈️',
    passport: '🌍'
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{
        background: 'linear-gradient(120deg, #f8f3e4 0%, #f6efdd 60%, #f4ecd7 100%)',
        border: '1px solid #efd8b4',
        borderRadius: 18,
        padding: isCompactLayout ? '14px 14px' : '16px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 14,
        flexWrap: 'wrap',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: 10, left: 10, color: 'rgba(241, 192, 94, 0.55)', fontSize: 18 }}>✺</div>
        <div style={{ position: 'absolute', top: 10, right: 10, color: 'rgba(241, 192, 94, 0.55)', fontSize: 18 }}>✺</div>

        <div style={{ minWidth: 260, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: isCompactLayout ? 26 : 32, fontWeight: 700, color: '#111827', lineHeight: 1.08, fontFamily: '"Georgia", "Times New Roman", serif' }}>
            Profile Settings:{' '}
            <span style={{ color: '#f0641c' }}>{managerDisplayName}</span>
          </h2>
          <p style={{ margin: '10px 0 0', fontSize: 13, color: '#334155', maxWidth: 620, lineHeight: 1.55 }}>
            Seasonal greetings! Ensure your professional profile and identification documents are up-to-date for seamless operations.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${accountStyle.border}`, background: accountStyle.bg, color: accountStyle.color, fontSize: 11, fontWeight: 700 }}>
              {accountIsActive ? 'Account Active' : 'Account Inactive'}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${personalEmailVerified ? '#86efac' : '#fde68a'}`, background: personalEmailVerified ? '#dcfce7' : '#fef3c7', color: personalEmailVerified ? '#166534' : '#92400e', fontSize: 11, fontWeight: 700 }}>
              {personalEmailVerified ? 'Personal Email Verified' : 'Personal Email Pending'}
            </span>
          </div>
        </div>

        <div style={{
          minWidth: isCompactLayout ? '100%' : 230,
          border: '1px solid #f1cc8c',
          borderRadius: 12,
          background: '#fff9ec',
          padding: '10px 12px'
        }}>
          <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.6px', fontWeight: 700, textTransform: 'uppercase' }}>Verification Status</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: verificationStyle.bg, border: `1px solid ${verificationStyle.border}`, display: 'grid', placeItems: 'center', color: verificationStyle.color, fontSize: 11 }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>{verificationStatus}</span>
          </div>
        </div>
      </div>

      {!accountIsActive && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 12, color: '#9a3412', fontSize: 13, fontWeight: 600 }}>
          Your manager account is inactive. You can access dashboard and profile only until Admin reactivates your account.
        </div>
      )}

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`,
            color: message.type === 'success' ? '#166534' : '#991b1b',
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
            fontWeight: 600
          }}
        >
          {message.text}
        </motion.div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: isCompactLayout ? '1fr' : '230px minmax(0, 1fr)',
        gap: 16,
        alignItems: 'start'
      }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ background: '#fff', border: '1px solid #e8decf', borderRadius: 14, padding: 14 }}>
            <div style={{
              width: 92,
              height: 92,
              borderRadius: '50%',
              margin: '0 auto',
              border: '3px solid #f2d89f',
              overflow: 'hidden',
              position: 'relative',
              background: '#f8fafc'
            }}>
              {displayedProfilePhotoUrl ? (
                <img src={displayedProfilePhotoUrl} alt="Manager Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 24, fontWeight: 700 }}>
                  {managerDisplayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={openLiveCamera}
                disabled={cameraStarting || photoUploading}
                style={{
                  position: 'absolute',
                  right: 2,
                  bottom: 2,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: '2px solid #fff',
                  background: '#f59e0b',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center',
                  cursor: (cameraStarting || photoUploading) ? 'not-allowed' : 'pointer',
                  opacity: (cameraStarting || photoUploading) ? 0.7 : 1
                }}
                title="Open live camera"
              >
                📸
              </button>
            </div>

            <div style={{ marginTop: 12, textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#111827' }}>Profile Photo</div>

            {!profilePhotoUrl && personalEmailAvatarUrl && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#166534', fontWeight: 600, textAlign: 'center' }}>
                Using personal email avatar.
              </div>
            )}

            <button
              type="button"
              onClick={openLiveCamera}
              disabled={cameraStarting || photoUploading}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'center',
                padding: '10px 12px',
                borderRadius: 8,
                border: 0,
                background: '#f59a2f',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: (cameraStarting || photoUploading) ? 'not-allowed' : 'pointer',
                opacity: (cameraStarting || photoUploading) ? 0.7 : 1,
                marginTop: 10
              }}
            >
              Capture Live Photo
            </button>

            <div style={{ marginTop: 10, fontSize: 10, color: '#6b7280', lineHeight: 1.45, textAlign: 'center' }}>
              Note: You can use your Google/personal email avatar or capture a live photo for identity confirmation.
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e8decf', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', marginBottom: 10 }}>🛡️ Account Security</div>
            <button
              type="button"
              onClick={handleSendPasswordLink}
              disabled={passwordLinkSending}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #f1d4a7',
                background: '#fff7ec',
                color: '#f07818',
                fontWeight: 700,
                fontSize: 13,
                cursor: passwordLinkSending ? 'not-allowed' : 'pointer',
                opacity: passwordLinkSending ? 0.7 : 1,
                textAlign: 'left'
              }}
            >
              {passwordLinkSending ? 'Sending Password Change Link...' : 'Send Password Change Link  →'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <form onSubmit={handleSaveProfile} style={{ background: '#fff', border: '1px solid #e8decf', borderRadius: 14, padding: 16, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>📝 Personal Information</h3>
              {profileDetailsLocked && (
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                  Locked after verification
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <label style={labelStyle}>FULL NAME</label>
                  {profileDetailsLocked && <span style={lockPillStyle}>🔒 Locked</span>}
                </div>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  disabled={profileDetailsLocked}
                  required
                  style={profileDetailsLocked ? lockedInputStyle : inputBaseStyle}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <label style={labelStyle}>REGISTERED EMAIL</label>
                  <span style={lockPillStyle}>🔒 Locked</span>
                </div>
                <input
                  value={form.registered_email}
                  readOnly
                  style={lockedInputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <label style={labelStyle}>PERSONAL EMAIL (GOOGLE)</label>
                  {personalEmailLocked && <span style={{ ...lockPillStyle, color: '#15803d', border: '1px solid #bbf7d0', background: '#ecfdf5' }}>✓ Verified</span>}
                </div>
                <input
                  type="email"
                  value={form.personal_email}
                  onChange={(e) => setForm((prev) => ({ ...prev, personal_email: e.target.value }))}
                  disabled={personalEmailLocked}
                  required
                  placeholder="name@gmail.com"
                  style={personalEmailLocked ? lockedInputStyle : inputBaseStyle}
                />
                {personalEmailNeedsVerification && (
                  <button
                    type="button"
                    onClick={handleSendEmailVerification}
                    disabled={emailVerificationSending || !form.personal_email}
                    style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: 0,
                      background: '#0ea5e9',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: (emailVerificationSending || !form.personal_email) ? 'not-allowed' : 'pointer',
                      opacity: (emailVerificationSending || !form.personal_email) ? 0.6 : 1
                    }}
                  >
                    {emailVerificationSending ? 'Sending...' : 'Verify Personal Email'}
                  </button>
                )}
              </div>

              <div>
                <label style={labelStyle}>MOBILE NUMBER</label>
                <input
                  value={form.mobile_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, mobile_number: e.target.value }))}
                  required
                  placeholder="10-digit mobile number"
                  style={inputBaseStyle}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <label style={labelStyle}>RESIDENTIAL ADDRESS</label>
                {profileDetailsLocked && <span style={lockPillStyle}>🔒 Locked</span>}
              </div>
              <input
                value={form.address_line}
                onChange={(e) => setForm((prev) => ({ ...prev, address_line: e.target.value }))}
                disabled={profileDetailsLocked}
                required
                placeholder="Flat/Building, Street, Landmark"
                style={profileDetailsLocked ? lockedInputStyle : inputBaseStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle}>PINCODE</label>
                <input
                  value={form.pincode}
                  onChange={(e) => setForm((prev) => ({ ...prev, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  onBlur={profileDetailsLocked ? undefined : lookupPincode}
                  disabled={profileDetailsLocked}
                  required
                  placeholder="6-digit pincode"
                  style={profileDetailsLocked ? lockedInputStyle : inputBaseStyle}
                />
                {pincodeLookupLoading && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Looking up district/state...</div>}
              </div>

              <div>
                <label style={labelStyle}>STATE</label>
                <input
                  value={form.state}
                  onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                  disabled={profileDetailsLocked}
                  required
                  style={profileDetailsLocked ? lockedInputStyle : inputBaseStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>DISTRICT</label>
                <input
                  value={form.district}
                  onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))}
                  disabled={profileDetailsLocked}
                  required
                  style={profileDetailsLocked ? lockedInputStyle : inputBaseStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {profileDetailsLocked ? (
                <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>
                  Profile details are locked after verification. Only mobile number can be changed.
                </span>
              ) : (
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  {personalEmailVerified ? 'Save once to lock profile details.' : 'Verify personal email to enable Save Profile.'}
                </span>
              )}
              {personalEmailVerified && (
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 9,
                    border: 0,
                    background: 'linear-gradient(135deg, #f59e2f, #ef7c1f)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1
                  }}
                >
                  {saving ? 'Saving...' : 'Save Profile Changes'}
                </button>
              )}
            </div>
          </form>

          <div style={{ background: '#fff', border: '1px solid #e8decf', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>📂 Verification Documents</h3>
              <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Locked after verification</span>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {requiredDocuments.map((item) => {
                const doc = documentMap.get(item.document_type)
                const status = doc?.status || 'Pending Upload'
                const statusStyle = statusBadgeStyle(status)
                const isLocked = Boolean(doc) && status !== 'Rejected'
                const isUploading = docUploadingType === item.document_type

                return (
                  <div
                    key={item.document_type}
                    style={{
                      border: '1px solid #ece2d4',
                      borderRadius: 10,
                      padding: 12,
                      display: 'grid',
                      gridTemplateColumns: isCompactLayout ? '1fr' : '1fr auto',
                      gap: 10,
                      alignItems: 'center',
                      background: status === 'Pending Upload' ? '#fffdfa' : '#fff'
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: '#f8f1e5',
                        color: '#8b5a2b',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 17,
                        flexShrink: 0
                      }}>
                        {documentIconByType[item.document_type] || '📄'}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.document_name}</span>
                          {item.optional && (
                            <span style={{ fontSize: 10, color: '#9ca3af' }}>(Optional)</span>
                          )}
                        </div>

                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                          {doc?.file_size_bytes ? `Size: ${fileSizeLabel(doc.file_size_bytes)} • ` : ''}
                          <span style={{ color: statusStyle.color, fontWeight: 700 }}>{String(status).toUpperCase()}</span>
                        </div>

                        {doc?.rejection_reason && (
                          <div style={{ marginTop: 5, fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>
                            Rejection reason: {doc.rejection_reason}
                          </div>
                        )}

                        {isLocked && status !== 'Rejected' && (
                          <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
                            Locked: editable only if rejected by admin.
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: isCompactLayout ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>
                      {doc?.download_url && (
                        <a
                          href={toAbsoluteUrl(doc.download_url) || doc.download_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 12, color: '#f97316', fontWeight: 700, textDecoration: 'none' }}
                        >
                          View Document
                        </a>
                      )}

                      <label style={{
                        padding: '7px 12px',
                        borderRadius: 8,
                        border: `1px solid ${isLocked ? '#d1d5db' : '#f2be6a'}`,
                        background: isLocked ? '#f3f4f6' : '#fff8e8',
                        color: isLocked ? '#9ca3af' : '#e58a19',
                        fontWeight: 700,
                        fontSize: 11,
                        cursor: (isLocked || isUploading) ? 'not-allowed' : 'pointer',
                        opacity: (isLocked || isUploading) ? 0.75 : 1,
                        whiteSpace: 'nowrap'
                      }}>
                        {isUploading ? 'Uploading...' : doc ? (status === 'Rejected' ? 'Re-upload' : 'Uploaded') : 'Upload'}
                        <input
                          type="file"
                          accept="application/pdf,image/png,image/jpeg,image/jpg"
                          disabled={isLocked || isUploading}
                          onChange={(event) => handleDocumentUpload(event, item.document_type)}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <BankAccountSection role="manager" />


      {cameraOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 70
          }}
        >
          <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 14, border: '1px solid #cbd5e1', padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Live Camera Capture</div>

            <div style={{
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              background: '#0f172a',
              aspectRatio: '3 / 4',
              display: 'grid',
              placeItems: 'center'
            }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {cameraStarting && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Starting camera...</div>
            )}

            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={closeLiveCamera}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={captureLivePhoto}
                disabled={cameraStarting || photoUploading}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 0,
                  background: '#f59e0b',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: (cameraStarting || photoUploading) ? 'not-allowed' : 'pointer',
                  opacity: (cameraStarting || photoUploading) ? 0.7 : 1
                }}
              >
                Take Photo
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 8, marginTop: 6, marginBottom: 6 }}>
        <div style={{ color: '#da8e2b', letterSpacing: 10, fontSize: 13 }}>🪔 🪔 🪔</div>
        <div style={{ color: '#f27a25', fontSize: 14, fontStyle: 'italic' }}>Wishing you a prosperous festival season!</div>
      </div>
    </div>
  )
}
