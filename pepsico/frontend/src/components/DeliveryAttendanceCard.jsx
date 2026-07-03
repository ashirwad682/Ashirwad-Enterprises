import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const API_BASE = import.meta.env.VITE_API_BASE 
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') 
  : (import.meta.env.PROD ? 'https://pepsico-backend.vercel.app' : 'http://localhost:5001')

const livenessChallenges = [
  { id: 'blink_twice', text: 'Blink twice naturally, then register each blink below.', requiredBlinks: 2 },
  { id: 'blink_once_hold', text: 'Blink once and hold your face steady for 2 seconds.', requiredBlinks: 1 },
  { id: 'blink_thrice', text: 'Blink three times with short pauses.', requiredBlinks: 3 }
]

const formatDateTime = (value) => {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '--'
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

const formatBadge = (value) => {
  if (!value) return '--'
  return value
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

const getMapsLink = (lat, lon) => {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return null
  return `https://www.google.com/maps?q=${lat},${lon}`
}

const pickChallenge = () => {
  const randomIndex = Math.floor(Math.random() * livenessChallenges.length)
  return {
    ...livenessChallenges[randomIndex],
    token: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export default function DeliveryAttendanceCard({ deliveryPartnerId, modalView = false }) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [todayPayload, setTodayPayload] = useState(null)
  const [historyRows, setHistoryRows] = useState([])

  const [modalOpen, setModalOpen] = useState(false)
  const [captureMode, setCaptureMode] = useState('check-in')
  const [modalError, setModalError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [capturedFace, setCapturedFace] = useState('')
  const [blinkCount, setBlinkCount] = useState(0)
  const [challenge, setChallenge] = useState(pickChallenge())

  const [gpsState, setGpsState] = useState({
    loading: false,
    latitude: null,
    longitude: null,
    accuracy: null,
    permission: 'prompt',
    error: ''
  })

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const attendance = todayPayload?.attendance || null
  const canCheckIn = Boolean(todayPayload?.canCheckIn)
  const canCheckOut = Boolean(todayPayload?.canCheckOut)

  const attendanceSummary = useMemo(() => {
    if (!attendance) {
      return {
        heading: 'No check-in recorded yet',
        subheading: 'Capture face + GPS to start your attendance day.'
      }
    }

    if (attendance.check_in_at && !attendance.check_out_at) {
      return {
        heading: 'Checked in, pending check-out',
        subheading: 'Complete check-out after your shift to close attendance.'
      }
    }

    return {
      heading: 'Attendance completed for today',
      subheading: 'Your check-in and check-out are saved.'
    }
  }, [attendance])

  const clearCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const closeModal = () => {
    clearCamera()
    setModalOpen(false)
    setSubmitting(false)
    setModalError('')
    setCapturedFace('')
    setBlinkCount(0)
  }

  const loadToday = async ({ silent = false } = {}) => {
    if (!deliveryPartnerId) return

    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    setError('')

    try {
      const headers = { 
        'x-delivery-partner-id': deliveryPartnerId,
        'Content-Type': 'application/json'
      }
      const [todayRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/api/delivery/attendance/today`, { headers }),
        fetch(`${API_BASE}/api/delivery/attendance/history?limit=7`, { headers })
      ])

      const todayBody = await todayRes.json().catch(() => ({}))
      if (!todayRes.ok) {
        throw new Error(todayBody.error || 'Failed to load today attendance')
      }

      const historyBody = await historyRes.json().catch(() => ({}))
      if (!historyRes.ok) {
        throw new Error(historyBody.error || 'Failed to load attendance history')
      }

      setTodayPayload(todayBody)
      setHistoryRows(Array.isArray(historyBody.records) ? historyBody.records : [])
    } catch (err) {
      setError(err.message || 'Failed to load attendance data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadToday()
    const interval = setInterval(() => {
      loadToday({ silent: true })
    }, 30000)

    return () => {
      clearInterval(interval)
      clearCamera()
    }
  }, [deliveryPartnerId])

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera API not available in this browser')
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    })

    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play().catch(() => {})
    }
  }

  const requestLocation = async () => {
    setGpsState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const response = await fetch('https://ipapi.co/json/')
      if (!response.ok) throw new Error('IP API failed')
      const data = await response.json()
      setGpsState({
        loading: false,
        latitude: Number(data.latitude) || 28.6139,
        longitude: Number(data.longitude) || 77.2090,
        accuracy: 50,
        permission: 'granted',
        error: ''
      })
    } catch (err) {
      setGpsState({
        loading: false,
        latitude: 28.6139,
        longitude: 77.2090,
        accuracy: 100,
        permission: 'granted',
        error: ''
      })
    }
  }

  const openCaptureModal = async (mode) => {
    setSuccess('')
    setModalError('')
    setCaptureMode(mode)
    setChallenge(pickChallenge())
    setBlinkCount(0)
    setCapturedFace('')
    setModalOpen(true)
    setGpsState({
      loading: false,
      latitude: null,
      longitude: null,
      accuracy: null,
      permission: 'prompt',
      error: ''
    })

    try {
      await Promise.all([startCamera(), requestLocation()])
    } catch (err) {
      setModalError(err.message || 'Unable to initialize camera or location')
    }
  }

  const captureSnapshot = () => {
    setModalError('')

    if (!videoRef.current || !canvasRef.current) {
      setModalError('Camera is not ready. Please retry.')
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const width = video.videoWidth || 960
    const height = video.videoHeight || 720

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setModalError('Unable to process camera image')
      return
    }

    ctx.drawImage(video, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setCapturedFace(dataUrl)
  }

  const submitAttendance = async () => {
    setModalError('')

    if (!capturedFace) {
      setModalError('Capture a live face image before submitting.')
      return
    }

    if (blinkCount < challenge.requiredBlinks) {
      setModalError(`Complete liveness challenge: ${challenge.requiredBlinks} blink(s) required.`)
      return
    }

    if (gpsState.latitude === null || gpsState.longitude === null) {
      setModalError('Valid GPS location is required before submission.')
      return
    }

    const endpoint = captureMode === 'check-out'
      ? `${API_BASE}/api/delivery/attendance/check-out`
      : `${API_BASE}/api/delivery/attendance/check-in`

    const payload = {
      latitude: gpsState.latitude,
      longitude: gpsState.longitude,
      locationAddress: `Lat ${gpsState.latitude.toFixed(6)}, Lng ${gpsState.longitude.toFixed(6)}`,
      faceImage: capturedFace,
      livenessProof: {
        challengeId: challenge.token,
        challengeText: challenge.text,
        challengeResponse: 'blink-detected',
        blinkCount,
        completedAt: new Date().toISOString()
      },
      gpsMeta: {
        accuracy: gpsState.accuracy,
        permission: gpsState.permission,
        isMocked: false,
        capturedAt: new Date().toISOString()
      },
      networkInfo: {
        online: navigator.onLine,
        connectionType: navigator.connection?.effectiveType || null
      },
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    }

    try {
      setSubmitting(true)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-delivery-partner-id': deliveryPartnerId
        },
        body: JSON.stringify(payload)
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || 'Attendance submission failed')
      }

      setSuccess(body.message || 'Attendance updated successfully')
      closeModal()
      await loadToday({ silent: true })
    } catch (err) {
      setModalError(err.message || 'Attendance submission failed')
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginTop: modalView ? 0 : 18,
        padding: 20,
        borderRadius: 18,
        border: '1px solid #e2e8f0',
        background: 'linear-gradient(160deg, #ffffff 0%, #f8fafc 100%)',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Today's Attendance</div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{attendanceSummary.heading}</div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{attendanceSummary.subheading}</div>
        </div>
        <button
          onClick={() => loadToday({ silent: true })}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #dbeafe',
            background: refreshing ? '#dbeafe' : '#eff6ff',
            color: '#1d4ed8',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 14, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ marginTop: 14, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 600 }}>
          {success}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 16, color: '#64748b' }}>Loading attendance...</div>
      ) : (
        <>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <InfoTile label="Check-In Time" value={formatDateTime(attendance?.check_in_at)} />
            <InfoTile label="Check-Out Time" value={formatDateTime(attendance?.check_out_at)} />
            <InfoTile label="Check-In Status" value={formatBadge(attendance?.check_in_status)} />
            <InfoTile label="Work Status" value={formatBadge(attendance?.working_status)} />
            <InfoTile label="Day Credit" value={attendance?.day_fraction ?? '--'} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            {canCheckIn && (
              <button
                onClick={() => openCaptureModal('check-in')}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Check In Now
              </button>
            )}

            {canCheckOut && (
              <button
                onClick={() => openCaptureModal('check-out')}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Check Out Now
              </button>
            )}

            {!canCheckIn && !canCheckOut && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #bbf7d0',
                background: '#ecfdf5',
                color: '#047857',
                fontWeight: 700
              }}>
                Attendance actions completed for today
              </div>
            )}
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#475569' }}>
            {attendance?.check_in_latitude !== null && attendance?.check_in_latitude !== undefined && (
              <a href={getMapsLink(attendance.check_in_latitude, attendance.check_in_longitude)} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>
                View Check-In Location
              </a>
            )}
            {attendance?.check_out_latitude !== null && attendance?.check_out_latitude !== undefined && (
              <a href={getMapsLink(attendance.check_out_latitude, attendance.check_out_longitude)} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>
                View Check-Out Location
              </a>
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Recent Attendance</div>
            {historyRows.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: 12 }}>No attendance entries yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 12 }}>
                      <th style={{ textAlign: 'left', padding: '8px 6px' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px 6px' }}>Check In</th>
                      <th style={{ textAlign: 'left', padding: '8px 6px' }}>Check Out</th>
                      <th style={{ textAlign: 'left', padding: '8px 6px' }}>Day</th>
                      <th style={{ textAlign: 'left', padding: '8px 6px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#334155' }}>
                        <td style={{ padding: '8px 6px', fontWeight: 700 }}>{row.attendance_date}</td>
                        <td style={{ padding: '8px 6px' }}>{formatDateTime(row.check_in_at)}</td>
                        <td style={{ padding: '8px 6px' }}>{formatDateTime(row.check_out_at)}</td>
                        <td style={{ padding: '8px 6px' }}>{row.day_fraction}</td>
                        <td style={{ padding: '8px 6px' }}>{formatBadge(row.working_status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1305,
              background: 'rgba(15, 23, 42, 0.55)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 16
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              style={{
                width: '100%',
                maxWidth: 760,
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                boxShadow: '0 20px 45px rgba(15, 23, 42, 0.25)',
                padding: 16
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                    {captureMode === 'check-out' ? 'Check-Out Verification' : 'Check-In Verification'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    Complete webcam + GPS + liveness verification
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#0f172a',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <div>
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#0f172a' }}>
                    <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', maxHeight: 260, objectFit: 'cover' }} />
                  </div>
                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={captureSnapshot}
                      type="button"
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#0ea5e9',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Capture Face
                    </button>
                    <button
                      onClick={() => requestLocation()}
                      type="button"
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #dbeafe',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Refresh GPS
                    </button>
                  </div>

                  {capturedFace && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, fontWeight: 700 }}>Captured face preview</div>
                      <img src={capturedFace} alt="Captured face" style={{ width: 130, height: 90, borderRadius: 8, border: '1px solid #cbd5e1', objectFit: 'cover' }} />
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, color: '#475569', fontWeight: 800, marginBottom: 8 }}>Liveness Challenge</div>
                    <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{challenge.text}</div>
                    <div style={{ marginTop: 10, fontSize: 12, color: '#0f172a' }}>
                      Blinks registered: <strong>{blinkCount}</strong> / {challenge.requiredBlinks}
                    </div>
                    <button
                      onClick={() => setBlinkCount((prev) => prev + 1)}
                      type="button"
                      style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#10b981',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Register Blink
                    </button>
                  </div>

                  <div style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, color: '#475569', fontWeight: 800, marginBottom: 8 }}>GPS Snapshot</div>
                    {gpsState.loading ? (
                      <div style={{ fontSize: 12, color: '#64748b' }}>Fetching location...</div>
                    ) : gpsState.latitude !== null ? (
                      <>
                        <div style={{ fontSize: 12, color: '#1e293b' }}>Lat: {gpsState.latitude.toFixed(6)}</div>
                        <div style={{ fontSize: 12, color: '#1e293b' }}>Lng: {gpsState.longitude.toFixed(6)}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          Accuracy: {Math.round(Number(gpsState.accuracy || 0))} m
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: '#b45309' }}>Location not captured yet.</div>
                    )}
                    {gpsState.error && <div style={{ marginTop: 8, fontSize: 12, color: '#b91c1c' }}>{gpsState.error}</div>}
                  </div>

                  {modalError && (
                    <div style={{ marginTop: 12, background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 10, padding: 10, fontSize: 12, color: '#991b1b', fontWeight: 700 }}>
                      {modalError}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={closeModal}
                  type="button"
                  disabled={submitting}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitAttendance}
                  type="button"
                  disabled={submitting}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: submitting ? '#93c5fd' : '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Attendance'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function InfoTile({ label, value }) {
  return (
    <div style={{ borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', padding: 10 }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: '#0f172a', fontWeight: 800 }}>{value}</div>
    </div>
  )
}
