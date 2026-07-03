import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { useMediaQuery } from '../lib/useMediaQuery';
import * as faceapi from '@vladmandic/face-api';

// ...existing code...
const API_BASE = import.meta.env.VITE_API_BASE 
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') 
  : (import.meta.env.PROD ? 'https://pepsico-backend.vercel.app' : 'http://localhost:5001')
const LOCAL_API_BASE = 'http://localhost:5001'
const VERIFICATION_DOCS_BUCKET = 'user-verification-documents'
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png'])
const ALLOWED_DOCUMENT_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'])
const PROFILE_BRAND_COLORS = {
  navy: '#0a1d53',
  saffron: '#ff671f',
  amber: '#f9b23d',
  softBg: 'linear-gradient(180deg, #fff7ed 0%, #eff6ff 45%, #f0fdf4 100%)'
}

const REQUIRED_DOCUMENTS = [
  { documentType: 'aadhaar', documentName: 'Aadhaar Card' },
  { documentType: 'pan', documentName: 'PAN Card' },
  { documentType: 'gst_certificate', documentName: 'GST Certificate' }
]

const VERIFICATION_STATUS_STYLES = {
  'Pending Verification': {
    icon: '🔴',
    label: 'Pending Verification',
    background: '#fef2f2',
    color: '#991b1b',
    border: '#fecaca'
  },
  'Under Review': {
    icon: '🟡',
    label: 'Under Review',
    background: '#fef9c3',
    color: '#854d0e',
    border: '#fde68a'
  },
  Verified: {
    icon: '🟢',
    label: 'Verified',
    background: '#ecfdf5',
    color: '#065f46',
    border: '#a7f3d0'
  }
}

const FORMAT_DATE = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

const FORMAT_DATETIME = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

function truncateEmail(value) {
  if (!value) return '—'
  if (value.length <= 24) return value
  const [local, domain = ''] = value.split('@')
  return `${local.slice(0, 12)}…@${domain}`
}

function formatPhone(value) {
  if (!value) return 'Add a contact number'
  const clean = value.replace(/\D/g, '')
  if (clean.length === 10) return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`
  if (clean.length === 12 && clean.startsWith('91')) return `+${clean.slice(0, 2)} ${clean.slice(2, 7)} ${clean.slice(7)}`
  return value
}

function getVerificationStatusStyle(value) {
  return VERIFICATION_STATUS_STYLES[value] || VERIFICATION_STATUS_STYLES['Pending Verification']
}

function formatFileSize(sizeBytes) {
  const size = Number(sizeBytes || 0)
  if (!Number.isFinite(size) || size <= 0) return '—'
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}

function normalizeDocumentTypeForUi(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_')
  if (normalized === 'aadhaar_card') return 'aadhaar'
  if (normalized === 'pan_card') return 'pan'
  if (normalized === 'gst' || normalized === 'gstcertificate' || normalized === 'gst_cert') return 'gst_certificate'
  return normalized
}

function getStoragePathCandidates(record) {
  const primary = String(record?.storage_path || record?.file_path || '').trim()
  if (!primary) return []

  const clean = primary.replace(/^\/+/, '')
  const candidates = [clean]

  if (clean.startsWith(`${VERIFICATION_DOCS_BUCKET}/`)) {
    candidates.push(clean.slice(`${VERIFICATION_DOCS_BUCKET}/`.length))
  }

  return [...new Set(candidates.filter(Boolean))]
}

function toAbsoluteDocumentUrl(rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return ''

  if (/^https?:\/\//i.test(value) || /^blob:/i.test(value) || /^data:/i.test(value)) {
    return value
  }

  const clean = value.replace(/^\/+/, '')
  if (clean.startsWith('uploads/')) {
    return `${API_BASE}/${clean}`
  }

  if (value.startsWith('/')) {
    return `${API_BASE}${value}`
  }

  return `${API_BASE}/${clean}`
}

function buildApiUrl(baseUrl, path) {
  const cleanBase = String(baseUrl || '').replace(/\/$/, '')
  const cleanPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`
  return `${cleanBase}${cleanPath}`
}

function getApiBaseCandidates() {
  const candidates = [API_BASE]
  const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)

  if (isLocalBrowser && API_BASE !== LOCAL_API_BASE) {
    candidates.push(LOCAL_API_BASE)
  }

  return [...new Set(candidates)]
}

async function fetchProfileApi(path, options = {}) {
  const candidates = getApiBaseCandidates()
  let last404Response = null
  let lastError = null

  for (const baseUrl of candidates) {
    try {
      const response = await fetch(buildApiUrl(baseUrl, path), options)
      if (response.status === 404) {
        last404Response = response
        continue
      }
      return response
    } catch (err) {
      lastError = err
    }
  }

  if (last404Response) return last404Response
  throw (lastError || new Error('Unable to connect to server right now.'))
}

function getAuthErrorDetails(errorLike) {
  const rawMessage = String(errorLike?.message || errorLike?.error || '').trim()
  const rawCode = String(errorLike?.code || '').trim()
  const normalized = `${rawMessage} ${rawCode}`.toLowerCase()

  const isAuthError = /session[_\s-]*expired|jwt expired|invalid jwt|bad_jwt|no_authorization|session_not_found|authorization token is required|invalid authorization token|unable to validate authentication token|authentication required/.test(normalized)

  return {
    isAuthError,
    message: isAuthError
      ? 'Unable to load verification data right now.'
      : (rawMessage || 'Unable to process your request right now.')
  }
}

export default function Profile() {

  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(max-width: 1024px)')
  const [authUser, setAuthUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [addressError, setAddressError] = useState('');
  const [documents, setDocuments] = useState([])
  const [verificationStatus, setVerificationStatus] = useState('Pending Verification')
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentsError, setDocumentsError] = useState('')
  const [documentActionMessage, setDocumentActionMessage] = useState('')
  const [uploadingDocumentType, setUploadingDocumentType] = useState('')
  const [viewingDocumentType, setViewingDocumentType] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [photoMessage, setPhotoMessage] = useState('')
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraMirror, setCameraMirror] = useState(true)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const detectionTimeoutRef = useRef(null)
  const [isFaceDetected, setIsFaceDetected] = useState(false)
  const [faceFeedback, setFaceFeedback] = useState('Initializing...')

  useEffect(() => {
    if (cameraOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [cameraOpen]);

  function stopCameraStream() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current)
      detectionTimeoutRef.current = null
    }
    setIsFaceDetected(false)
  }

  useEffect(() => {
    return () => {
      stopCameraStream()
    }
  }, [])

  const detectFaceLoop = async () => {
    if (!videoRef.current || !cameraStreamRef.current) return;

    try {
      const result = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
      ).withFaceLandmarks();

      if (result) {
        const box = result.detection.box;
        const score = result.detection.score;
        const videoWidth = videoRef.current.videoWidth;
        const videoHeight = videoRef.current.videoHeight;
        
        // Ensure face is mostly inside the frame bounds and large enough
        const isCenteredX = box.x > videoWidth * 0.05 && (box.x + box.width) < videoWidth * 0.95;
        const isCenteredY = box.y > videoHeight * 0.05 && (box.y + box.height) < videoHeight * 0.95;
        const isGoodSize = box.width > videoWidth * 0.20;

        if (!isGoodSize || !isCenteredX || !isCenteredY) {
          setFaceFeedback('Please center your face and move closer.');
          setIsFaceDetected(false);
        } else if (score < 0.85) {
          setFaceFeedback('⚠️ Please remove any masks, sunglasses, or facial coverings.');
          setIsFaceDetected(false);
        } else {
          setFaceFeedback('✅ Face detected and clear! Ready to capture.');
          setIsFaceDetected(true);
        }
      } else {
        setFaceFeedback('No face detected. Please look into the camera.');
        setIsFaceDetected(false);
      }
    } catch (error) {
      console.warn("Face detection error:", error);
    }

    if (cameraStreamRef.current) {
      detectionTimeoutRef.current = setTimeout(detectFaceLoop, 300);
    }
  };

  const getAuthToken = useCallback(async () => {
    const sessionResult = await supabase.auth.getSession()
    let token = sessionResult?.data?.session?.access_token

    if (!token || sessionResult?.error) {
      const refreshResult = await supabase.auth.refreshSession()
      token = refreshResult?.data?.session?.access_token || token

      if (!token && refreshResult?.error) {
        const { data: authResult } = await supabase.auth.getUser()
        if (!authResult?.user) {
          throw new Error('Authentication required. Please log in again.')
        }
        throw new Error('Authentication issue detected. Please refresh this page and try again.')
      }
    }

    if (!token) {
      const { data: authResult } = await supabase.auth.getUser()
      if (!authResult?.user) {
        throw new Error('Authentication required. Please log in again.')
      }
      throw new Error('Authentication issue detected. Please refresh this page and try again.')
    }

    return token
  }, [])

  const primaryAddress = useMemo(() => {
    if (!Array.isArray(addresses) || addresses.length === 0) return null;
    return addresses.find((address) => address.is_default) || addresses[0];
  }, [addresses]);

  const documentMap = useMemo(() => {
    const map = new Map()
    const sortedDocuments = [...(documents || [])].sort((a, b) => {
      const timeA = new Date(a?.uploaded_at || 0).getTime()
      const timeB = new Date(b?.uploaded_at || 0).getTime()
      return timeB - timeA
    })

    for (const doc of sortedDocuments) {
      const normalizedType = normalizeDocumentTypeForUi(doc?.document_type)
      if (normalizedType && !map.has(normalizedType)) {
        map.set(normalizedType, doc)
      }
    }
    return map
  }, [documents])

  const loadVerificationData = useCallback(async (userId) => {
    setDocumentsLoading(true)
    setDocumentsError('')
    setDocumentActionMessage('')

    try {
      if (!userId) {
        throw new Error('Unable to load verification data.')
      }

      // Prefer backend response because it returns signed download URLs.
      try {
        const token = await getAuthToken()
        const response = await fetchProfileApi('/api/user/verification-documents', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })

        const payload = await response.json().catch(() => ({}))
        if (response.ok) {
          const apiDocuments = Array.isArray(payload.documents) ? payload.documents : []
          const normalizedDocuments = apiDocuments.map((row) => ({
            ...row,
            document_type: normalizeDocumentTypeForUi(row.document_type),
            download_url: row.download_url || row.file_url || null,
            file_size_bytes: Number(row.file_size_bytes ?? row.file_size ?? 0) || null
          }))

          setDocuments(normalizedDocuments)
          setVerificationStatus(payload.verification_status || 'Pending Verification')
          if (typeof payload.user_is_verified === 'boolean') {
            setProfile((prev) => prev ? { ...prev, is_verified: payload.user_is_verified } : prev)
          }
          return
        }
      } catch (backendFetchErr) {
        // Fall through to by-user fallback below.
      }

      // Token-less fallback for unstable auth validation states.
      try {
        const response = await fetchProfileApi(`/api/user/verification-documents/by-user/${userId}`)
        const payload = await response.json().catch(() => ({}))
        if (response.ok) {
          const apiDocuments = Array.isArray(payload.documents) ? payload.documents : []
          const normalizedDocuments = apiDocuments.map((row) => ({
            ...row,
            document_type: normalizeDocumentTypeForUi(row.document_type),
            download_url: row.download_url || row.file_url || null,
            file_size_bytes: Number(row.file_size_bytes ?? row.file_size ?? 0) || null
          }))

          setDocuments(normalizedDocuments)
          setVerificationStatus(payload.verification_status || 'Pending Verification')
          if (typeof payload.user_is_verified === 'boolean') {
            setProfile((prev) => prev ? { ...prev, is_verified: payload.user_is_verified } : prev)
          }
          return
        }
      } catch (fallbackFetchErr) {
        // Fall back to direct DB reads below.
      }

      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('is_verified')
        .eq('id', userId)
        .maybeSingle()

      if (userError) throw userError

      const { data: rows, error: docsError } = await supabase
        .from('user_verification_documents')
        .select('*')
        .eq('user_id', userId)

      if (docsError) throw docsError

      const byType = new Map((rows || []).map((row) => [normalizeDocumentTypeForUi(row.document_type), row.status]))
      const allApproved = REQUIRED_DOCUMENTS.every((doc) => byType.get(doc.documentType) === 'Approved')
      const uploadedCount = REQUIRED_DOCUMENTS.filter((doc) => Boolean(byType.get(doc.documentType))).length
      const derivedStatus = allApproved
        ? 'Verified'
        : (uploadedCount === 0 ? 'Pending Verification' : 'Under Review')

      const normalizedDocuments = (rows || []).map((row) => ({
        ...row,
        document_type: normalizeDocumentTypeForUi(row.document_type),
        download_url: row.download_url || row.file_url || null,
        file_size_bytes: Number(row.file_size_bytes ?? row.file_size ?? 0) || null
      }))

      setDocuments(normalizedDocuments)
      setVerificationStatus(derivedStatus)
      setProfile((prev) => prev ? { ...prev, is_verified: Boolean(userRow?.is_verified) } : prev)
    } catch (err) {
      const authError = getAuthErrorDetails(err)
      setDocuments([])
      setVerificationStatus('Pending Verification')
      setDocumentsError(authError.message || 'Unable to load verification data right now.')
    } finally {
      setDocumentsLoading(false)
    }
  }, [getAuthToken])

  const handleViewDocument = useCallback(async (documentRecord) => {
    if (!documentRecord) return

    const normalizedType = normalizeDocumentTypeForUi(documentRecord.document_type)
    setViewingDocumentType(normalizedType)
    setDocumentsError('')
    setDocumentActionMessage('')

    try {
      let url = ''
      const storageCandidates = getStoragePathCandidates(documentRecord)

      // Always fetch a fresh signed URL from backend first so users can view files reliably.
      try {
        const token = await getAuthToken()
        const response = await fetchProfileApi(`/api/user/verification-documents/${normalizedType}/download`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        const payload = await response.json().catch(() => ({}))
        if (response.ok) {
          url = toAbsoluteDocumentUrl(payload.download_url || '')
        }
      } catch (freshUrlErr) {
        // Continue with by-user fallback below.
      }

      if (!url && authUser?.id) {
        try {
          const response = await fetchProfileApi(`/api/user/verification-documents/by-user/${authUser.id}/${normalizedType}/download`)
          const payload = await response.json().catch(() => ({}))
          if (response.ok) {
            url = toAbsoluteDocumentUrl(payload.download_url || '')
          }
        } catch (fallbackUrlErr) {
          // Continue with client-side fallbacks below.
        }
      }

      if (!url) {
        url = toAbsoluteDocumentUrl(documentRecord.download_url || documentRecord.file_url || '')
      }

      if (!url && storageCandidates.length > 0) {
        for (const storagePath of storageCandidates) {
          const { data: signedData, error: signedError } = await supabase
            .storage
            .from(VERIFICATION_DOCS_BUCKET)
            .createSignedUrl(storagePath, 1800)

          if (!signedError && signedData?.signedUrl) {
            url = toAbsoluteDocumentUrl(signedData.signedUrl)
            break
          }
        }
      }

      if (!url && storageCandidates.length > 0) {
        for (const storagePath of storageCandidates) {
          const { data: fileBlob, error: downloadError } = await supabase
            .storage
            .from(VERIFICATION_DOCS_BUCKET)
            .download(storagePath)

          if (!downloadError && fileBlob) {
            url = URL.createObjectURL(fileBlob)
            setTimeout(() => URL.revokeObjectURL(url), 60 * 1000)
            break
          }
        }
      }

      if (!url) {
        throw new Error('Document file is unavailable right now.')
      }

      window.open(url, '_blank', 'noopener,noreferrer')
      setDocumentActionMessage('Opened uploaded document in a new tab.')
    } catch (err) {
      setDocumentActionMessage('Unable to open this file right now. Please re-upload this document once.')
    } finally {
      setViewingDocumentType('')
    }
  }, [authUser?.id, getAuthToken])

  const loadProfile = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const { data: authResult, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authResult?.user;
      setAuthUser(user);
      if (!user) {
        setProfile(null);
        setAddresses([]);
        setDocuments([])
        setVerificationStatus('Pending Verification')
        setLoading(false);
        return;
      }
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;
      setProfile(profileData);
      const { data: addressData, error: addressError } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      if (addressError) throw addressError;
      setAddresses(addressData || []);
      await loadVerificationData(user.id)
    } catch (err) {
      const authError = getAuthErrorDetails(err)
      setError(authError.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [loadVerificationData]);

  const uploadPhotoFile = useCallback(async (selectedFile, source = 'upload') => {
    if (!selectedFile) return false

    if (!ALLOWED_PHOTO_MIME_TYPES.has(selectedFile.type)) {
      setPhotoError('Only JPG and PNG files are allowed for profile photos.')
      setPhotoMessage('')
      return false
    }

    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setPhotoError('Profile photo must be 5MB or smaller.')
      setPhotoMessage('')
      return false
    }

    setPhotoUploading(true)
    setPhotoError('')
    setPhotoMessage('')

    try {
      const token = await getAuthToken()
      const formData = new FormData()
      formData.append('photo', selectedFile)
      formData.append('source', source)

      const response = await fetchProfileApi('/api/user/profile-photo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to upload profile photo')
      }

      setProfile((prev) => prev ? {
        ...prev,
        profile_photo_url: payload.profile_photo_url || prev.profile_photo_url,
        profile_photo_source: payload.profile_photo_source || source
      } : prev)

      setPhotoMessage('Profile photo updated successfully.')
      return true
    } catch (err) {
      setPhotoError(err.message || 'Unable to upload profile photo')
      return false
    } finally {
      setPhotoUploading(false)
    }
  }, [getAuthToken])

  async function openLiveCamera() {
    setPhotoError('')
    setPhotoMessage('')
    setFaceFeedback('Loading face detection models...')
    setIsFaceDetected(false)

    if (!navigator?.mediaDevices?.getUserMedia) {
      setPhotoError('Live camera is not supported on this device/browser.')
      return
    }

    setCameraOpen(true)
    setCameraStarting(true)
    stopCameraStream()

    try {
      // Load tiny face detector and landmarks model from a fast CDN
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'),
        faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model')
      ]);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      })

      cameraStreamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => {
            setCameraStarting(false)
            detectFaceLoop()
          }).catch(() => {
            setCameraStarting(false)
          })
        }
      } else {
        setCameraStarting(false)
      }
    } catch (err) {
      const text = String(err?.message || '')
      if (text.toLowerCase().includes('permission') || text.toLowerCase().includes('notallowed')) {
        setPhotoError('Camera access denied. Please allow camera permission and try again.')
      } else {
        setPhotoError('Unable to start live camera. Please check camera settings and retry.')
      }
      setCameraOpen(false)
      stopCameraStream()
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
      setPhotoError('Camera preview is not ready yet.')
      return
    }

    const width = Number(video.videoWidth || 0)
    const height = Number(video.videoHeight || 0)
    if (width <= 0 || height <= 0) {
      setPhotoError('Camera is still loading. Please wait a moment and try again.')
      return
    }

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      setPhotoError('Unable to capture live photo.')
      return
    }

    if (cameraMirror) {
      // Mirror capture so saved image matches what user sees in selfie preview.
      context.save()
      context.translate(width, 0)
      context.scale(-1, 1)
      context.drawImage(video, 0, 0, width, height)
      context.restore()
    } else {
      context.drawImage(video, 0, 0, width, height)
    }

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 1.0)
    })

    if (!blob) {
      setPhotoError('Unable to capture photo from camera.')
      return
    }

    const liveFile = new File([blob], `user-live-photo-${Date.now()}.jpg`, {
      type: 'image/jpeg'
    })

    const success = await uploadPhotoFile(liveFile, 'camera')
    if (success) {
      closeLiveCamera()
    }
  }

  const handleDocumentUpload = useCallback(async (event, documentType) => {
    const selectedFile = event?.target?.files?.[0]
    event.target.value = ''

    if (!selectedFile) return

    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(selectedFile.type)) {
      setDocumentsError('Only PDF, JPG, and PNG files are allowed.')
      setDocumentActionMessage('')
      return
    }

    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setDocumentsError('Document size must be 5MB or smaller.')
      setDocumentActionMessage('')
      return
    }

    setUploadingDocumentType(documentType)
    setDocumentsError('')
    setDocumentActionMessage('')

    try {
      const createUploadFormData = () => {
        const data = new FormData()
        data.append('document', selectedFile)
        return data
      }

      let response = null

      try {
        const token = await getAuthToken()
        response = await fetchProfileApi(`/api/user/verification-documents/${documentType}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: createUploadFormData()
        })

        if ((response.status === 401 || response.status === 403 || response.status === 404) && authUser?.id) {
          response = await fetchProfileApi(`/api/user/verification-documents/by-user/${authUser.id}/${documentType}`, {
            method: 'POST',
            body: createUploadFormData()
          })
        }
      } catch (tokenErr) {
        if (!authUser?.id) {
          throw tokenErr
        }

        response = await fetchProfileApi(`/api/user/verification-documents/by-user/${authUser.id}/${documentType}`, {
          method: 'POST',
          body: createUploadFormData()
        })
      }

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || `Failed to upload document (HTTP ${response.status})`)
      }

      if (Array.isArray(payload.documents)) {
        setDocuments(payload.documents)
      }
      setVerificationStatus(payload.verification_status || 'Under Review')
      if (typeof payload.user_is_verified === 'boolean') {
        setProfile((prev) => prev ? { ...prev, is_verified: payload.user_is_verified } : prev)
      }
      setDocumentActionMessage(payload.message || 'Document uploaded successfully.')
    } catch (err) {
      const authError = getAuthErrorDetails(err)
      setDocumentsError(authError.message || 'Unable to upload document')
    } finally {
      setUploadingDocumentType('')
    }
  }, [authUser?.id, getAuthToken])

  useEffect(() => {
    loadProfile(false)
  }, [loadProfile]);

  // Show loading spinner while checking auth or loading profile
  if (authUser === undefined || loading) {
    return (
      <div style={{ minHeight: '400px', display: 'grid', placeItems: 'center' }}>
        <div style={{ display: 'grid', gap: 16, placeItems: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #e2e8f0', borderTop: `3px solid ${PROFILE_BRAND_COLORS.saffron}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
          <div style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>Loading profile</div>
        </div>
        <style>{
          `@keyframes spin { to { transform: rotate(360deg); } }`
        }</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 16, padding: 24, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#991b1b' }}>Unable to load profile</div>
        <div style={{ color: '#b91c1c', fontSize: 13, lineHeight: 1.6 }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '10px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  if (!authUser) {
    navigate('/login', { replace: true });
    return (
      <div style={{ minHeight: '320px', display: 'grid', placeItems: 'center', color: '#64748b', fontSize: 15 }}>
        Redirecting to login…
      </div>
    );
  }

  if (!profile || (typeof profile === 'object' && Object.keys(profile).length === 0)) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: 28, display: 'grid', gap: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#92400e' }}>Profile not found</div>
        <div style={{ color: '#b45309', fontSize: 13, lineHeight: 1.6 }}>No profile data found for your account. Please contact support.</div>
      </div>
    );
  }

  const avatarInitial = (profile.full_name || profile.email || 'A').trim().slice(0, 1).toUpperCase()

  return (
    <div style={{ display: 'grid', gap: isMobile ? 20 : 28, gridTemplateColumns: isTablet ? '1fr' : '320px 1fr', maxWidth: 1140, margin: '0 auto', padding: isMobile ? 16 : isTablet ? 24 : 32, background: 'transparent', minHeight: '100vh' }}>
      <ProfileSidebar
        avatarInitial={avatarInitial}
        profile={profile}
        verificationStatus={verificationStatus}
        refreshing={loading}
        photoUploading={photoUploading}
        photoError={photoError}
        photoMessage={photoMessage}
        onOpenCamera={openLiveCamera}
        onRefresh={() => loadProfile(true)}
        isMobile={isMobile}
        isTablet={isTablet}
      />

      <div style={{ display: 'grid', gap: 24, alignContent: 'start' }}>
        <ProfileDetailsCard profile={profile} />
        <DocumentVerificationSection
          verificationStatus={verificationStatus}
          documents={documentMap}
          loading={documentsLoading}
          error={documentsError}
          actionMessage={documentActionMessage}
          uploadingDocumentType={uploadingDocumentType}
          viewingDocumentType={viewingDocumentType}
          onUpload={handleDocumentUpload}
          onViewDocument={handleViewDocument}
          isMobile={isMobile}
        />
        <AddressSection
          primaryAddress={primaryAddress}
          addressError={addressError}
          onRefresh={() => loadProfile(true)}
        />
        <PhoneEditSection profile={profile} onUpdated={() => loadProfile(true)} isMobile={isMobile} />
      </div>

      <AnimatePresence>
        {cameraOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(6px)',
              display: 'grid',
              placeItems: 'center',
              padding: 16,
              zIndex: 1000
            }}
          >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ width: '100%', maxWidth: 460, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, border: '1px solid #cbd5e1', padding: 16, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Live Camera Capture</div>

            <div style={{
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              background: '#0f172a',
              aspectRatio: '3 / 4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              minHeight: 0,
              position: 'relative'
            }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: cameraMirror ? 'scaleX(-1)' : 'none'
                }}
              />
              {!cameraStarting && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'grid', placeItems: 'center', zIndex: 10 }}>
                  <div style={{
                    width: '65%',
                    height: '70%',
                    borderRadius: '50% 50% 45% 45%',
                    border: `3px dashed ${isFaceDetected ? '#4ade80' : 'rgba(255,255,255,0.5)'}`,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                    transition: 'all 0.3s ease'
                  }} />
                </div>
              )}
            </div>

            {cameraStarting && (
              <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: '#64748b', textAlign: 'center' }}>Starting camera & loading AI models...</div>
            )}

            {!cameraStarting && (
              <>
                <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 700, background: isFaceDetected ? '#dcfce7' : '#fef9c3', color: isFaceDetected ? '#166534' : '#854d0e', border: `1px solid ${isFaceDetected ? '#86efac' : '#fde68a'}`, transition: 'all 0.3s ease' }}>
                  {faceFeedback}
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Mirror preview</span>
                  <button
                    type="button"
                    onClick={() => setCameraMirror((prev) => !prev)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#334155',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {cameraMirror ? 'On' : 'Off'}
                  </button>
                </div>
              </>
            )}

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={closeLiveCamera}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={captureLivePhoto}
                disabled={cameraStarting || photoUploading || !isFaceDetected}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 0,
                  background: PROFILE_BRAND_COLORS.saffron,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: (cameraStarting || photoUploading || !isFaceDetected) ? 'not-allowed' : 'pointer',
                  opacity: (cameraStarting || photoUploading || !isFaceDetected) ? 0.5 : 1,
                  boxShadow: (cameraStarting || photoUploading || !isFaceDetected) ? 'none' : '0 4px 12px rgba(255, 103, 31, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                {photoUploading ? 'Uploading...' : 'Take Photo'}
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

function ProfileSidebar({
  avatarInitial,
  profile,
  verificationStatus,
  refreshing,
  photoUploading,
  photoError,
  photoMessage,
  onOpenCamera,
  onRefresh,
  isMobile,
  isTablet
}) {
  const statusStyle = getVerificationStatusStyle(verificationStatus)
  const profilePhotoUrl = profile?.profile_photo_url
  const [isViewingPhoto, setIsViewingPhoto] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    if (isViewingPhoto) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isViewingPhoto]);

  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 20,
        padding: isMobile ? 20 : 28,
        display: 'flex',
        flexDirection: isTablet && !isMobile ? 'row' : 'column',
        alignItems: isTablet && !isMobile ? 'center' : 'stretch',
        justifyContent: 'space-between',
        gap: 24,
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        height: 'fit-content',
        position: isTablet ? 'static' : 'sticky',
        top: 32
      }}
    >
      <div style={{ display: 'flex', flexDirection: isTablet && !isMobile ? 'row' : 'column', alignItems: 'center', gap: 18 }}>
        <div
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onClick={() => profilePhotoUrl && setIsViewingPhoto(true)}
          style={{
            width: 110,
            height: 110,
            borderRadius: '50%',
            background: profilePhotoUrl ? `url(${profilePhotoUrl}) center/cover no-repeat` : `linear-gradient(135deg, ${PROFILE_BRAND_COLORS.saffron} 0%, ${PROFILE_BRAND_COLORS.amber} 45%, ${PROFILE_BRAND_COLORS.navy} 100%)`,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            fontWeight: 700,
            boxShadow: '0 8px 22px rgba(10,29,83,0.22)',
            border: '4px solid #fff',
            cursor: profilePhotoUrl ? 'pointer' : 'default',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            transform: isHovering && profilePhotoUrl ? 'scale(1.05)' : 'scale(1)'
          }}
        >
          {!profilePhotoUrl ? avatarInitial : null}
          {profilePhotoUrl && isHovering && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#fff'
            }}>
              View
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isTablet && !isMobile ? 'flex-start' : 'center', gap: 8 }}>
          <div style={{ textAlign: isTablet && !isMobile ? 'left' : 'center', display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>{profile.full_name || 'PepsiCo Partner'}</div>
            <div style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>{truncateEmail(profile.email)}</div>
          </div>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              background: statusStyle.background,
              color: statusStyle.color,
              border: `1px solid ${statusStyle.border}`,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              width: 'fit-content'
            }}
          >
            {statusStyle.icon} {statusStyle.label}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: isTablet && !isMobile ? '0 1 300px' : 'none' }}>
        <div style={{ width: '100%', display: 'grid', gap: 8 }}>
          <button
            type="button"
            onClick={onOpenCamera}
            disabled={photoUploading}
            style={{
              width: '100%',
              textAlign: 'center',
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #ffd7bf',
              background: '#fff4ed',
              color: PROFILE_BRAND_COLORS.saffron,
              fontSize: 12,
              fontWeight: 600,
              cursor: photoUploading ? 'not-allowed' : 'pointer'
            }}
          >
            {photoUploading ? 'Please wait...' : 'Capture Live Photo'}
          </button>

          {photoError && (
            <div style={{ fontSize: 11, color: '#b91c1c', textAlign: 'center' }}>{photoError}</div>
          )}
          {photoMessage && (
            <div style={{ fontSize: 11, color: '#166534', textAlign: 'center' }}>{photoMessage}</div>
          )}
        </div>
        
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Member since</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{profile.created_at ? FORMAT_DATE.format(new Date(profile.created_at)) : '—'}</span>
        </div>
        
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            marginTop: 4,
            padding: '11px 16px',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            background: refreshing ? '#f9fafb' : '#fff',
            color: '#374151',
            fontWeight: 600,
            fontSize: 13,
            cursor: refreshing ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: refreshing ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          {refreshing ? 'Refreshing…' : 'Sync data'}
        </button>
      </div>

      <AnimatePresence>
        {isViewingPhoto && profilePhotoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsViewingPhoto(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(8px)',
              zIndex: 1100,
              display: 'grid',
              placeItems: 'center',
              padding: 24,
              cursor: 'zoom-out'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ 
                background: '#fff', 
                padding: 8, 
                borderRadius: 20, 
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <img
                  src={profilePhotoUrl}
                  alt="Profile High Quality"
                  style={{
                    width: '85vw',
                    maxWidth: 480,
                    aspectRatio: '1 / 1',
                    objectFit: 'cover',
                    borderRadius: 14,
                    display: 'block'
                  }}
                />
              </div>
              
              <button
                onClick={() => setIsViewingPhoto(false)}
                style={{
                  marginTop: 24,
                  padding: '12px 24px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              >
                <span>✕</span> Close Preview
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function ProfileDetailsCard({ profile }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 28, display: 'grid', gap: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Profile details</h2>
      </div>
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <DataRow label="Full name" value={profile.full_name || '—'} />
        <DataRow label="Email address" value={profile.email || '—'} />
        <DataRow label="Phone number" value={formatPhone(profile.phone)} />
        <DataRow label="Last updated" value={profile.updated_at ? FORMAT_DATETIME.format(new Date(profile.updated_at)) : '—'} />
      </div>
    </section>
  )
}

function DataRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gap: 7, padding: '12px 0' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: '#111827', wordBreak: 'break-word', lineHeight: 1.5 }}>{value}</span>
    </div>
  )
}

function DocumentVerificationSection({
  verificationStatus,
  documents,
  loading,
  error,
  actionMessage,
  uploadingDocumentType,
  viewingDocumentType,
  onUpload,
  onViewDocument,
  isMobile
}) {
  const statusStyle = getVerificationStatusStyle(verificationStatus)
  const [hoveredDocumentType, setHoveredDocumentType] = useState('')

  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 28, display: 'grid', gap: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <style>{`@keyframes docLinkPulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.03); opacity: 0.82; } 100% { transform: scale(1); opacity: 1; } } @keyframes docFullLineFlow { 0% { background-position: 0% 50%; transform: scaleX(0.94); } 50% { background-position: 100% 50%; transform: scaleX(1); } 100% { background-position: 200% 50%; transform: scaleX(0.94); } }`}</style>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Document verification</h2>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              background: statusStyle.background,
              color: statusStyle.color,
              border: `1px solid ${statusStyle.border}`,
              letterSpacing: 0.3,
              textTransform: 'uppercase'
            }}
          >
            {statusStyle.icon} {statusStyle.label}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
          Upload Aadhaar Card, PAN Card, and GST Certificate. Once uploaded, a document is locked until admin rejection.
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Allowed formats: PDF/JPG/PNG. Maximum size: 5MB per file.</p>
      </div>

      {loading ? (
        <div style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#f8fafc', color: '#64748b', fontSize: 13 }}>
          Loading document status...
        </div>
      ) : (
        <div style={{ border: isMobile ? 'none' : '1px solid #e5e7eb', borderRadius: 14, overflow: isMobile ? 'visible' : 'auto', display: 'grid', gap: isMobile ? 16 : 0 }}>
          {!isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', minWidth: 760 }}>
              <HeaderCell>Document Name</HeaderCell>
              <HeaderCell>Upload File</HeaderCell>
              <HeaderCell>Upload Date</HeaderCell>
              <HeaderCell>Status</HeaderCell>
            </div>
          )}

          {REQUIRED_DOCUMENTS.map((requiredDocument) => {
            const record = documents?.get?.(requiredDocument.documentType)
            const status = record?.status || 'Pending'
            const canUpload = !record || status === 'Rejected'
            const isUploading = uploadingDocumentType === requiredDocument.documentType
            const isViewing = viewingDocumentType === requiredDocument.documentType
            const isHovered = hoveredDocumentType === requiredDocument.documentType
            const shouldAnimateLine = isViewing || isHovered
            const uploadInputId = `upload-${requiredDocument.documentType}`

            const statusTone = status === 'Approved'
              ? { bg: '#dcfce7', color: '#166534' }
              : status === 'Rejected'
                ? { bg: '#fee2e2', color: '#991b1b' }
                : { bg: '#fef3c7', color: '#854d0e' }

            if (isMobile) {
              return (
                <div key={requiredDocument.documentType} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, display: 'grid', gap: 14, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>{requiredDocument.documentName}</div>
                    <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: statusTone.bg, color: statusTone.color, textTransform: 'uppercase' }}>
                      {status}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <label
                        htmlFor={uploadInputId}
                        style={{
                          display: 'inline-block',
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          background: canUpload && !isUploading ? '#fff' : '#f1f5f9',
                          color: canUpload && !isUploading ? '#1f2937' : '#94a3b8',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: canUpload && !isUploading ? 'pointer' : 'not-allowed',
                          boxShadow: canUpload && !isUploading ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                        }}
                      >
                        {isUploading ? 'Uploading...' : canUpload ? 'Upload file' : 'Locked'}
                      </label>
                      <input
                        id={uploadInputId}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                        disabled={!canUpload || isUploading}
                        onChange={(event) => onUpload(event, requiredDocument.documentType)}
                      />
                    </div>
                    
                    {record && (
                      <div
                        onClick={() => { if (!isViewing) onViewDocument(record) }}
                        style={{ color: PROFILE_BRAND_COLORS.saffron, fontSize: 14, fontWeight: 600, cursor: isViewing ? 'not-allowed' : 'pointer' }}
                      >
                        {isViewing ? 'Opening...' : 'View File ↗'}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#64748b', borderTop: '1px dashed #e2e8f0', paddingTop: 12 }}>
                    <span>{record?.uploaded_at ? FORMAT_DATETIME.format(new Date(record.uploaded_at)) : 'No file uploaded'}</span>
                    {record?.file_size_bytes && <span>{formatFileSize(record.file_size_bytes)}</span>}
                  </div>

                  {record?.rejection_reason && (
                    <div style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', padding: '10px 12px', borderRadius: 8, marginTop: 4 }}>
                      <strong>Reason:</strong> {record.rejection_reason}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div
                key={requiredDocument.documentType}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr',
                  borderBottom: '1px solid #f1f5f9',
                  alignItems: 'start',
                  minWidth: 760
                }}
              >
                <BodyCell>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{requiredDocument.documentName}</div>
                  {record && (
                    <div
                      onClick={() => {
                        if (!isViewing) onViewDocument(record)
                      }}
                      onMouseEnter={() => setHoveredDocumentType(requiredDocument.documentType)}
                      onMouseLeave={() => setHoveredDocumentType('')}
                      style={{
                        marginTop: 6,
                        color: PROFILE_BRAND_COLORS.saffron,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isViewing ? 'not-allowed' : 'pointer',
                        width: 'fit-content',
                        display: 'inline-flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        opacity: isViewing ? 0.7 : 1,
                        animation: isViewing ? 'docLinkPulse 0.8s ease-in-out infinite' : 'none',
                        userSelect: 'none'
                      }}
                      role="button"
                      aria-disabled={isViewing}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (isViewing) return
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onViewDocument(record)
                        }
                      }}
                    >
                      {isViewing ? 'Opening...' : 'View uploaded file'}
                      <div
                        style={{
                          marginTop: 4,
                          height: 2,
                          borderRadius: 999,
                          width: '100%',
                          background: `linear-gradient(90deg, ${PROFILE_BRAND_COLORS.amber}, ${PROFILE_BRAND_COLORS.saffron}, ${PROFILE_BRAND_COLORS.navy})`,
                          backgroundSize: '220% 100%',
                          animation: shouldAnimateLine ? 'docFullLineFlow 1.5s linear infinite' : 'none',
                          transformOrigin: 'center',
                          opacity: shouldAnimateLine ? 1 : 0,
                          transition: 'opacity 0.2s ease'
                        }}
                      />
                    </div>
                  )}
                </BodyCell>

                <BodyCell>
                  <label
                    htmlFor={uploadInputId}
                    style={{
                      display: 'inline-block',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: canUpload && !isUploading ? '#fff' : '#f1f5f9',
                      color: canUpload && !isUploading ? '#1f2937' : '#94a3b8',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: canUpload && !isUploading ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {isUploading ? 'Uploading...' : canUpload ? 'Upload file' : 'Locked'}
                  </label>
                  <input
                    id={uploadInputId}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: 'none' }}
                    disabled={!canUpload || isUploading}
                    onChange={(event) => onUpload(event, requiredDocument.documentType)}
                  />
                  {record && !canUpload && status !== 'Rejected' && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>Locked until admin review.</div>
                  )}
                </BodyCell>

                <BodyCell>
                  <div style={{ color: '#334155', fontSize: 12 }}>
                    {record?.uploaded_at ? FORMAT_DATETIME.format(new Date(record.uploaded_at)) : '—'}
                  </div>
                  {record?.file_size_bytes ? (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>{formatFileSize(record.file_size_bytes)}</div>
                  ) : null}
                </BodyCell>

                <BodyCell>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '5px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: statusTone.bg,
                      color: statusTone.color,
                      textTransform: 'uppercase',
                      letterSpacing: 0.2
                    }}
                  >
                    {status}
                  </span>
                  {record?.rejection_reason ? (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#b91c1c' }}>
                      Reason: {record.rejection_reason}
                    </div>
                  ) : null}
                </BodyCell>
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 12, padding: '12px 14px', color: '#991b1b', fontSize: 12, fontWeight: 500 }}>
          {error}
        </div>
      )}

      {actionMessage && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', color: '#166534', fontSize: 12, fontWeight: 500 }}>
          {actionMessage}
        </div>
      )}
    </section>
  )
}

function HeaderCell({ children }) {
  return (
    <div style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </div>
  )
}

function BodyCell({ children }) {
  return (
    <div style={{ padding: '12px 14px', display: 'grid', gap: 4 }}>
      {children}
    </div>
  )
}

function AddressSection({ primaryAddress, addressError, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [addressLine, setAddressLine] = useState('');
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');

  // Lock the form if address exists - user cannot change address once added
  useEffect(() => {
    if (primaryAddress) {
      setShowForm(false);
      setAddressLine('');
      setPincode('');
      setState('');
      setDistrict('');
      setFormError('');
      setFormMessage('');
    }
  }, [primaryAddress]);

  // Auto-fetch state and district when pincode is entered
  useEffect(() => {
    const fetchPincodeData = async () => {
      if (pincode.length === 6) {
        setLookupLoading(true);
        setFormError('');
        try {
          const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
          const data = await response.json();
          
          if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
            const postOffice = data[0].PostOffice[0];
            setState(postOffice.State || '');
            setDistrict(postOffice.District || '');
          } else {
            setFormError('Invalid pincode. Please check and try again.');
            setState('');
            setDistrict('');
          }
        } catch (err) {
          setFormError('Unable to fetch pincode details. Please try again.');
          setState('');
          setDistrict('');
        } finally {
          setLookupLoading(false);
        }
      } else {
        setState('');
        setDistrict('');
      }
    };

    fetchPincodeData();
  }, [pincode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormMessage('');

    // Prevent address submission if address already exists
    if (primaryAddress) {
      setFormError('Address already exists. Contact support to update.');
      setShowForm(false);
      return;
    }

    if (!addressLine.trim()) {
      setFormError('Please enter your address.');
      return;
    }
    if (pincode.length !== 6) {
      setFormError('Please enter a valid 6-digit pincode.');
      return;
    }
    if (!state || !district) {
      setFormError('State and district are required. Please enter a valid pincode.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: insertError } = await supabase
        .from('addresses')
        .insert({
          user_id: user.id,
          address_line: addressLine.trim(),
          pincode: pincode,
          district: district,
          state: state,
          is_default: true
        });

      if (insertError) throw insertError;

      setFormMessage('Address added successfully!');
      setShowForm(false);
      setAddressLine('');
      setPincode('');
      setState('');
      setDistrict('');
      
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.message || 'Failed to add address.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 28, display: 'grid', gap: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Delivery address</h2>
      </div>

      {primaryAddress && (
        <div style={{ background: '#fef9e7', border: '1px solid #fde68a', borderRadius: 14, padding: '14px 16px', display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🔒</span>
            <span>Address locked</span>
          </div>
          <div style={{ color: '#b45309', fontSize: 12, lineHeight: 1.6 }}>Your delivery address cannot be modified once added. For any changes, please contact support.</div>
        </div>
      )}

      {addressError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 14, padding: '14px 16px', color: '#991b1b', fontSize: 13, fontWeight: 500 }}>
          {addressError}
        </div>
      )}

      {!addressError && primaryAddress && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, display: 'grid', gap: 12, background: '#fafbfc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>Primary address</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#065f46', background: '#d1fae5', borderRadius: 999, padding: '5px 11px', letterSpacing: 0.3, textTransform: 'uppercase' }}>✓ Verified</span>
          </div>
          <div style={{ fontSize: 14, color: '#111827', fontWeight: 600, lineHeight: 1.5 }}>{primaryAddress.address_line || '—'}</div>
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{primaryAddress.district || '—'}</div>
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{primaryAddress.state || '—'} {primaryAddress.pincode || ''}</div>
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>India</div>
        </div>
      )}

      {!addressError && !primaryAddress && !showForm && (
        <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, padding: 24, display: 'grid', gap: 16, textAlign: 'center', background: '#fafbfc' }}>
          <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>No address on file. Please add your delivery address to complete your profile.</div>
          <button
            type="button"
            onClick={() => {
              // Only allow form to open if no address exists
              if (!primaryAddress) {
                setShowForm(true);
              }
            }}
            style={{ padding: '12px 20px', borderRadius: 12, background: '#1d4ed8', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer', margin: '0 auto' }}
          >
            Add delivery address
          </button>
        </div>
      )}

      {!addressError && !primaryAddress && showForm && (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Address line <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="Enter your complete address (Shop/Building, Street, Area)"
              rows={3}
              style={{ padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 12, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pincode <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit pincode"
                maxLength={6}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 12, fontSize: 14, fontWeight: 500, outline: 'none' }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
              {lookupLoading && (
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#3b82f6' }}>
                  Looking up...
                </div>
              )}
            </div>
            <span style={{ fontSize: 11, color: '#9ca3b8', fontWeight: 500 }}>State and district will be automatically filled</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>State</label>
              <input
                type="text"
                value={state}
                readOnly
                placeholder="Auto-filled from pincode"
                style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 14, fontWeight: 500, background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }}
              />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>District</label>
              <input
                type="text"
                value={district}
                readOnly
                placeholder="Auto-filled from pincode"
                style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 14, fontWeight: 500, background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }}
              />
            </div>
          </div>

          {formError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 12, padding: '12px 14px', color: '#991b1b', fontSize: 12, fontWeight: 500 }}>
              {formError}
            </div>
          )}

          {formMessage && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', color: '#166534', fontSize: 12, fontWeight: 500 }}>
              {formMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setAddressLine('');
                setPincode('');
                setState('');
                setDistrict('');
                setFormError('');
              }}
              style={{ padding: '12px 20px', borderRadius: 12, background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, border: '1px solid #d1d5db', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || lookupLoading}
              style={{ padding: '12px 24px', borderRadius: 12, background: saving ? '#9ca3af' : '#1d4ed8', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              {saving ? 'Saving...' : 'Save address'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// PhoneEditSection: Allows editing the user's phone number
function PhoneEditSection({ profile, onUpdated, isMobile }) {
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setPhone(profile?.phone || '');
  }, [profile]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const clean = phone.replace(/\D/g, '');
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ phone: clean })
        .eq('id', profile.id);
      if (updateError) throw updateError;
      setMessage('Phone number updated successfully!');
      if (onUpdated) onUpdated();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update phone number.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 28, display: 'grid', gap: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Update contact number</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>Change your phone number for order notifications</p>
      </div>
      <form onSubmit={handleSave} style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Phone number</label>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: 12 }}>
            <input
              type="tel"
              value={phone}
              onChange={e => {
                // Only allow digits, max 10
                let val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setPhone(val);
              }}
              placeholder="Enter 10-digit number"
              maxLength={10}
              style={{ padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 12, fontSize: 14, fontWeight: 500, outline: 'none', transition: 'border 0.15s ease' }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '12px 20px', borderRadius: 12, background: saving ? '#9ca3af' : '#1d4ed8', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease', boxShadow: saving ? 'none' : '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              {saving ? 'Updating…' : 'Update number'}
            </button>
          </div>
          <span style={{ fontSize: 11, color: '#9ca3b8', fontWeight: 500 }}>You will receive an OTP to verify the new number</span>
        </div>
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 12, padding: '12px 14px', color: '#991b1b', fontSize: 12, fontWeight: 500 }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', color: '#166534', fontSize: 12, fontWeight: 500 }}>
            {message}
          </div>
        )}
      </form>
    </section>
  );
}
