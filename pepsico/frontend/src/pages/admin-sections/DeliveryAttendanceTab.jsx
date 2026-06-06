import React, { useEffect, useMemo, useState } from 'react'
import { useAdminAuth } from '../../context/AdminAuthContext'

const API_BASE = import.meta.env.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '')
  : (import.meta.env.PROD ? '' : 'http://localhost:5001')
const LOCAL_API_BASE = 'http://localhost:5001'

const getCurrentMonth = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

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

const formatLabel = (value) => {
  if (!value) return '--'
  return value
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

const toMoney = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const toMapLink = (lat, lon) => {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return null
  return `https://www.google.com/maps?q=${lat},${lon}`
}

function KPI({ label, value, tone = 'default' }) {
  const toneStyles = {
    default: { bg: '#ffffff', border: '#e2e8f0', color: '#0f172a' },
    good: { bg: '#ecfdf5', border: '#bbf7d0', color: '#047857' },
    warn: { bg: '#fff7ed', border: '#fed7aa', color: '#9a3412' },
    info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' }
  }

  const style = toneStyles[tone] || toneStyles.default

  return (
    <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${style.border}`, background: style.bg }}>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: style.color }}>{value}</div>
    </div>
  )
}

export default function DeliveryAttendanceTab({ managerMode = false }) {
  const { adminKey } = useAdminAuth ? useAdminAuth() : { adminKey: null }
  const managerToken = localStorage.getItem('manager_token')

  const [month, setMonth] = useState(getCurrentMonth())
  const [partnerId, setPartnerId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [partners, setPartners] = useState([])
  const [partnerDrafts, setPartnerDrafts] = useState({})
  const [savingPartnerId, setSavingPartnerId] = useState('')

  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 })
  const [summary, setSummary] = useState([])
  const [totals, setTotals] = useState({ payableDays: 0, totalSalary: 0, fullDays: 0, halfDays: 0, absentDays: 0 })
  const [auditLogs, setAuditLogs] = useState([])

  const [previewImage, setPreviewImage] = useState('')
  const [editRowId, setEditRowId] = useState('')
  const [editForm, setEditForm] = useState({
    day_fraction: '1',
    working_status: 'present',
    check_in_status: 'on_time',
    check_out_status: 'on_time',
    notes: '',
    reason: ''
  })

  const headers = useMemo(() => {
    if (managerMode) return { 'x-manager-token': managerToken }
    return { 'x-admin-api-key': adminKey, 'x-admin-key': adminKey }
  }, [adminKey, managerToken, managerMode])

  const apiBaseCandidates = useMemo(() => {
    const candidates = [API_BASE]
    const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)

    if (isLocalBrowser && API_BASE !== LOCAL_API_BASE) {
      candidates.push(LOCAL_API_BASE)
    }

    return [...new Set(candidates)]
  }, [])

  const fetchAttendanceApi = async (path, options = {}) => {
    const cleanPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`
    let lastError = null

    for (const baseUrl of apiBaseCandidates) {
      try {
        const cleanBase = String(baseUrl || '').replace(/\/$/, '')
        const response = await fetch(`${cleanBase}${cleanPath}`, options)
        if (response.status === 404) continue
        return response
      } catch (err) {
        lastError = err
      }
    }

    throw (lastError || new Error('Unable to connect to attendance API'))
  }

  const loadAttendanceData = async ({ showLoader = true } = {}) => {
    if (managerMode && !managerToken) return
    if (!managerMode && !adminKey) return

    if (showLoader) setLoading(true)
    setError('')

    try {
      const baseQuery = new URLSearchParams()
      baseQuery.set('month', month)
      baseQuery.set('page', String(page))
      baseQuery.set('pageSize', '25')
      if (partnerId) baseQuery.set('partner_id', partnerId)
      if (statusFilter) baseQuery.set('status', statusFilter)
      if (flaggedOnly) baseQuery.set('flagged', 'true')

      const summaryQuery = new URLSearchParams()
      summaryQuery.set('month', month)
      if (partnerId) summaryQuery.set('partner_id', partnerId)

      const [partnersRes, logsRes, summaryRes, auditRes] = await Promise.all([
        fetchAttendanceApi('/api/delivery/admin/attendance/partners', { headers }),
        fetchAttendanceApi(`/api/delivery/admin/attendance/logs?${baseQuery.toString()}`, { headers }),
        fetchAttendanceApi(`/api/delivery/admin/attendance/monthly-summary?${summaryQuery.toString()}`, { headers }),
        fetchAttendanceApi('/api/delivery/admin/attendance/audit-logs?limit=40', { headers })
      ])

      const partnersBody = await partnersRes.json().catch(() => ({}))
      if (!partnersRes.ok) throw new Error(partnersBody.error || 'Failed to load attendance partners')

      const logsBody = await logsRes.json().catch(() => ({}))
      if (!logsRes.ok) throw new Error(logsBody.error || 'Failed to load attendance logs')

      const summaryBody = await summaryRes.json().catch(() => ({}))
      if (!summaryRes.ok) throw new Error(summaryBody.error || 'Failed to load attendance summary')

      const auditBody = await auditRes.json().catch(() => ({}))
      if (!auditRes.ok) throw new Error(auditBody.error || 'Failed to load attendance audit logs')

      const partnerRows = Array.isArray(partnersBody.partners) ? partnersBody.partners : []
      setPartners(partnerRows)
      setRows(Array.isArray(logsBody.rows) ? logsBody.rows : [])
      setPagination(logsBody.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 })
      setSummary(Array.isArray(summaryBody.summary) ? summaryBody.summary : [])
      setTotals(summaryBody.totals || { payableDays: 0, totalSalary: 0, fullDays: 0, halfDays: 0, absentDays: 0 })
      setAuditLogs(Array.isArray(auditBody.logs) ? auditBody.logs : [])

      setPartnerDrafts((prev) => {
        const next = { ...prev }
        partnerRows.forEach((partner) => {
          next[partner.id] = next[partner.id] || {
            salary_per_day: partner.salary_per_day ?? 0,
            attendance_required: Boolean(partner.attendance_required)
          }
        })
        return next
      })
    } catch (err) {
      setError(err.message || 'Failed to load attendance data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAttendanceData()
  }, [adminKey, managerToken, managerMode, month, partnerId, statusFilter, flaggedOnly, page])

  const handlePartnerDraftChange = (partnerKey, field, value) => {
    setPartnerDrafts((prev) => ({
      ...prev,
      [partnerKey]: {
        ...(prev[partnerKey] || {}),
        [field]: value
      }
    }))
  }

  const savePartnerConfig = async (partnerKey) => {
    const draft = partnerDrafts[partnerKey]
    if (!draft) return

    try {
      setSavingPartnerId(partnerKey)
      setError('')
      setSuccess('')

      const payload = {
        salary_per_day: Number(draft.salary_per_day || 0),
        attendance_required: Boolean(draft.attendance_required)
      }

      const response = await fetchAttendanceApi(`/api/delivery/admin/attendance/partners/${partnerKey}/config`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || 'Failed to save partner config')
      }

      setSuccess('Partner attendance configuration updated')
      await loadAttendanceData({ showLoader: false })
    } catch (err) {
      setError(err.message || 'Failed to save partner config')
    } finally {
      setSavingPartnerId('')
    }
  }

  const handleExportCsv = async () => {
    try {
      setActionLoading(true)
      setError('')

      const query = new URLSearchParams({ month })
      if (partnerId) query.set('partner_id', partnerId)

      const response = await fetchAttendanceApi(`/api/delivery/admin/attendance/export?${query.toString()}`, { headers })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'CSV export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `delivery-attendance-${month}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message || 'CSV export failed')
    } finally {
      setActionLoading(false)
    }
  }

  const beginEdit = (row) => {
    setEditRowId(row.id)
    setEditForm({
      day_fraction: String(row.day_fraction ?? 1),
      working_status: row.working_status || 'present',
      check_in_status: row.check_in_status || 'on_time',
      check_out_status: row.check_out_status || 'on_time',
      notes: row.notes || '',
      reason: ''
    })
  }

  const submitCorrection = async (attendanceId) => {
    if (!editForm.reason.trim()) {
      setError('Correction reason is required before saving manual update')
      return
    }

    try {
      setActionLoading(true)
      setError('')
      setSuccess('')

      const payload = {
        day_fraction: Number(editForm.day_fraction),
        working_status: editForm.working_status,
        check_in_status: editForm.check_in_status,
        check_out_status: editForm.check_out_status,
        notes: editForm.notes,
        reason: editForm.reason
      }

      const response = await fetchAttendanceApi(`/api/delivery/admin/attendance/${attendanceId}/manual-correction`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || 'Manual correction failed')
      }

      setSuccess('Attendance correction saved and audited successfully')
      setEditRowId('')
      await loadAttendanceData({ showLoader: false })
    } catch (err) {
      setError(err.message || 'Manual correction failed')
    } finally {
      setActionLoading(false)
    }
  }

  const suspiciousCount = rows.filter((row) => row.suspicious).length

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, color: '#0f172a' }}>Delivery Attendance Management</h3>
          <div style={{ marginTop: 6, fontSize: 13, color: '#64748b' }}>
            Biometric + GPS attendance, fraud flags, monthly payroll summary, and admin corrections with audit trail.
          </div>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={actionLoading}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #dbeafe',
            background: actionLoading ? '#bfdbfe' : '#eff6ff',
            color: '#1d4ed8',
            fontWeight: 700,
            cursor: actionLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {actionLoading ? 'Working...' : 'Export Monthly CSV'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        <KPI label="Attendance Rows" value={rows.length} tone="default" />
        <KPI label="Suspicious Rows" value={suspiciousCount} tone={suspiciousCount > 0 ? 'warn' : 'good'} />
        <KPI label="Payable Days" value={totals.payableDays || 0} tone="info" />
        <KPI label="Total Salary" value={toMoney(totals.totalSalary || 0)} tone="good" />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Month</label>
        <input
          type="month"
          value={month}
          onChange={(event) => {
            setPage(1)
            setMonth(event.target.value)
          }}
          style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid #cbd5e1' }}
        />

        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Partner</label>
        <select
          value={partnerId}
          onChange={(event) => {
            setPage(1)
            setPartnerId(event.target.value)
          }}
          style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid #cbd5e1', minWidth: 0, width: 'min(100%, 280px)' }}
        >
          <option value="">All Partners</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.delivery_partner_id} - {partner.name}
            </option>
          ))}
        </select>

        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Status</label>
        <select
          value={statusFilter}
          onChange={(event) => {
            setPage(1)
            setStatusFilter(event.target.value)
          }}
          style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid #cbd5e1' }}
        >
          <option value="">All</option>
          <option value="present">Present</option>
          <option value="half_day">Half Day</option>
          <option value="late">Late</option>
          <option value="absent">Absent</option>
          <option value="early_checkout">Early Checkout</option>
        </select>

        <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#475569' }}>
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(event) => {
              setPage(1)
              setFlaggedOnly(event.target.checked)
            }}
          />
          Fraud Flags Only
        </label>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700 }}>
          {success}
        </div>
      )}

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Partner Salary + Attendance Setup</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={thStyle}>Partner</th>
                <th style={thStyle}>Salary/Day</th>
                <th style={thStyle}>Attendance Required</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => {
                const draft = partnerDrafts[partner.id] || {}
                return (
                  <tr key={partner.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{partner.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{partner.delivery_partner_id} • {partner.assigned_area}</div>
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.salary_per_day ?? 0}
                        onChange={(event) => handlePartnerDraftChange(partner.id, 'salary_per_day', event.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={Boolean(draft.attendance_required)}
                        onChange={(event) => handlePartnerDraftChange(partner.id, 'attendance_required', event.target.checked)}
                      />
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => savePartnerConfig(partner.id)}
                        disabled={savingPartnerId === partner.id}
                        style={{
                          padding: '7px 10px',
                          borderRadius: 8,
                          border: 'none',
                          background: savingPartnerId === partner.id ? '#bfdbfe' : '#2563eb',
                          color: '#fff',
                          fontWeight: 700,
                          cursor: savingPartnerId === partner.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {savingPartnerId === partner.id ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Monthly Salary Summary ({month})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={thStyle}>Partner</th>
                <th style={thStyle}>Full Days</th>
                <th style={thStyle}>Half Days</th>
                <th style={thStyle}>Absent</th>
                <th style={thStyle}>Payable Days</th>
                <th style={thStyle}>Salary/Day</th>
                <th style={thStyle}>Total Salary</th>
                <th style={thStyle}>Suspicious Days</th>
              </tr>
            </thead>
            <tbody>
              {summary.length === 0 ? (
                <tr>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8' }} colSpan={8}>No summary data available.</td>
                </tr>
              ) : summary.map((item) => (
                <tr key={item.partner_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={tdStyle}><strong>{item.partner_name}</strong> <span style={{ color: '#64748b' }}>({item.partner_code})</span></td>
                  <td style={tdStyle}>{item.full_days}</td>
                  <td style={tdStyle}>{item.half_days}</td>
                  <td style={tdStyle}>{item.absent_days}</td>
                  <td style={tdStyle}><strong>{item.payable_days}</strong></td>
                  <td style={tdStyle}>{toMoney(item.salary_per_day)}</td>
                  <td style={tdStyle}><strong>{toMoney(item.total_salary)}</strong></td>
                  <td style={tdStyle}>{item.suspicious_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Attendance Logs</div>
        {loading ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>Loading attendance logs...</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1280 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Partner</th>
                    <th style={thStyle}>Check In</th>
                    <th style={thStyle}>Check Out</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Day</th>
                    <th style={thStyle}>Flags</th>
                    <th style={thStyle}>Location</th>
                    <th style={thStyle}>Faces</th>
                    <th style={thStyle}>Manual Correction</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8' }} colSpan={10}>No attendance logs found for current filter.</td>
                    </tr>
                  ) : rows.map((row) => {
                    const flagList = [
                      row.location_mismatch ? 'Location' : null,
                      row.fake_gps ? 'Fake GPS' : null,
                      row.repeated_same_image_hash ? 'Face Hash' : null,
                      row.impossible_travel_time ? 'Travel' : null,
                      row.suspicious_early_checkout ? 'Early Out' : null
                    ].filter(Boolean)

                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9', background: editRowId === row.id ? '#f8fafc' : '#fff' }}>
                        <td style={tdStyle}>{row.attendance_date}</td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.delivery_partners?.name || '--'}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{row.delivery_partners?.delivery_partner_id || '--'}</div>
                        </td>
                        <td style={tdStyle}>{formatDateTime(row.check_in_at)}</td>
                        <td style={tdStyle}>{formatDateTime(row.check_out_at)}</td>
                        <td style={tdStyle}>
                          <div>{formatLabel(row.check_in_status)}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Out: {formatLabel(row.check_out_status)}</div>
                        </td>
                        <td style={tdStyle}>{row.day_fraction}</td>
                        <td style={tdStyle}>
                          {flagList.length === 0 ? (
                            <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 700 }}>Clean</span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {flagList.map((flag) => (
                                <span key={flag} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, border: '1px solid #fdba74', background: '#ffedd5', color: '#9a3412', fontWeight: 700 }}>
                                  {flag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {toMapLink(row.check_in_latitude, row.check_in_longitude) && (
                              <a href={toMapLink(row.check_in_latitude, row.check_in_longitude)} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: 12, fontWeight: 700 }}>
                                In Map
                              </a>
                            )}
                            {toMapLink(row.check_out_latitude, row.check_out_longitude) && (
                              <a href={toMapLink(row.check_out_latitude, row.check_out_longitude)} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: 12, fontWeight: 700 }}>
                                Out Map
                              </a>
                            )}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {row.check_in_face_url && (
                              <button
                                onClick={() => setPreviewImage(row.check_in_face_url)}
                                style={linkButtonStyle}
                              >
                                Check-In Face
                              </button>
                            )}
                            {row.check_out_face_url && (
                              <button
                                onClick={() => setPreviewImage(row.check_out_face_url)}
                                style={linkButtonStyle}
                              >
                                Check-Out Face
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {editRowId === row.id ? (
                            <div style={{ display: 'grid', gap: 6, minWidth: 240 }}>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="1"
                                value={editForm.day_fraction}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, day_fraction: event.target.value }))}
                                style={smallInputStyle}
                              />
                              <select
                                value={editForm.working_status}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, working_status: event.target.value }))}
                                style={smallInputStyle}
                              >
                                <option value="present">Present</option>
                                <option value="half_day">Half Day</option>
                                <option value="absent">Absent</option>
                                <option value="manual">Manual</option>
                              </select>
                              <select
                                value={editForm.check_in_status}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, check_in_status: event.target.value }))}
                                style={smallInputStyle}
                              >
                                <option value="on_time">On Time</option>
                                <option value="late">Late</option>
                                <option value="half_day">Half Day</option>
                                <option value="manual">Manual</option>
                              </select>
                              <select
                                value={editForm.check_out_status}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, check_out_status: event.target.value }))}
                                style={smallInputStyle}
                              >
                                <option value="on_time">On Time</option>
                                <option value="early">Early</option>
                                <option value="manual">Manual</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Notes"
                                value={editForm.notes}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                                style={smallInputStyle}
                              />
                              <input
                                type="text"
                                placeholder="Reason (required)"
                                value={editForm.reason}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, reason: event.target.value }))}
                                style={{ ...smallInputStyle, borderColor: '#fca5a5' }}
                              />
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  onClick={() => submitCorrection(row.id)}
                                  style={{ ...smallActionButton, background: '#2563eb', color: '#fff' }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditRowId('')}
                                  style={{ ...smallActionButton, background: '#f1f5f9', color: '#0f172a' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => beginEdit(row)}
                              style={{ ...smallActionButton, background: '#eff6ff', color: '#1d4ed8' }}
                            >
                              Correct
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ color: '#64748b', fontSize: 12 }}>
                Page {pagination.page} of {pagination.totalPages} • Total {pagination.total}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={pagination.page <= 1}
                  style={{ ...smallActionButton, opacity: pagination.page <= 1 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((prev) => Math.min(pagination.totalPages || 1, prev + 1))}
                  disabled={pagination.page >= (pagination.totalPages || 1)}
                  style={{ ...smallActionButton, opacity: pagination.page >= (pagination.totalPages || 1) ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Attendance Audit Trail</div>
        {auditLogs.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 12 }}>No audit records available.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {auditLogs.map((log) => (
              <div key={log.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                    {formatLabel(log.action_type)} • {log.delivery_partners?.name || log.delivery_partner_id || '--'}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{formatDateTime(log.created_at)}</div>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#475569' }}>
                  By: <strong>{formatLabel(log.action_by)}</strong>
                  {log.action_reason ? ` • Reason: ${log.action_reason}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {previewImage && (
        <div
          onClick={() => setPreviewImage('')}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.72)',
            zIndex: 110,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
          }}
        >
          <img
            src={previewImage}
            alt="Attendance face"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, border: '2px solid #fff' }}
          />
        </div>
      )}
    </div>
  )
}

const thStyle = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 12,
  color: '#475569',
  fontWeight: 800
}

const tdStyle = {
  padding: '8px 10px',
  fontSize: 12,
  color: '#334155',
  verticalAlign: 'top'
}

const inputStyle = {
  width: '100%',
  maxWidth: 160,
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 12
}

const smallInputStyle = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 12
}

const smallActionButton = {
  padding: '6px 8px',
  border: 'none',
  borderRadius: 7,
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 11
}

const linkButtonStyle = {
  border: '1px solid #bfdbfe',
  background: '#eff6ff',
  color: '#1d4ed8',
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 11,
  padding: '4px 6px',
  cursor: 'pointer'
}
