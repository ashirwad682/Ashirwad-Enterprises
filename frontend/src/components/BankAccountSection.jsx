import React, { useState, useEffect } from 'react'
import { verifyIfscCode, fetchBankAccount, saveBankAccount, deleteBankAccount, resolveAccountHolderName } from '../api/client'
import { motion, AnimatePresence } from 'framer-motion'

import { supabase } from '../lib/supabaseClient'

export default function BankAccountSection({ role, token, dpId }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Bank account rows from database
  const [approvedAccount, setApprovedAccount] = useState(null)
  const [pendingRequest, setPendingRequest] = useState(null)

  // Mode: 'view' or 'edit' or 'create' or 'update_request'
  const [mode, setMode] = useState('view') // view, edit, create

  // Form Fields
  const [accountHolderName, setAccountHolderName] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [branchName, setBranchName] = useState('')
  const [upiId, setUpiId] = useState('')

  // IFSC Verification State
  const [verifyingIfsc, setVerifyingIfsc] = useState(false)
  const [ifscVerified, setIfscVerified] = useState(false)
  const [verifiedDetails, setVerifiedDetails] = useState(null)
  const [ifscError, setIfscError] = useState('')

  // Account Number Validation & Resolution State
  const [accountNumberError, setAccountNumberError] = useState('')
  const [resolvingName, setResolvingName] = useState(false)


  // Fetch bank details on mount
  useEffect(() => {
    loadBankDetails()
  }, [role, token, dpId])

  const loadBankDetails = async () => {
    try {
      setLoading(true)
      setError('')
      let activeToken = token
      if (role === 'user' && !activeToken) {
        const { data } = await supabase.auth.getSession()
        activeToken = data?.session?.access_token
      }
      const res = await fetchBankAccount(role, { token: activeToken, dpId })

      if (res.success) {
        setApprovedAccount(res.approvedAccount)
        setPendingRequest(res.pendingRequest)

        // Set mode based on what exists
        if (res.pendingRequest) {
          // Prefill with pending request
          prefillForm(res.pendingRequest)
          setMode('edit')
        } else if (res.approvedAccount) {
          setMode('view')
        } else {
          setMode('create')
          clearForm()
        }
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load bank account details')
    } finally {
      setLoading(false)
    }
  }

  const prefillForm = (acc) => {
    setAccountHolderName(acc.account_holder_name || '')
    setBankName(acc.bank_name || '')
    setAccountNumber(acc.account_number || '')
    setConfirmAccountNumber(acc.account_number || '')
    setIfscCode(acc.ifsc_code || '')
    setBranchName(acc.branch_name || '')
    setUpiId(acc.upi_id || '')
    setIfscVerified(acc.is_verified || false)
    setIfscError('')
    if (acc.is_verified) {
      setVerifiedDetails({
        BANK: acc.bank_name,
        BRANCH: acc.branch_name,
        ADDRESS: acc.branch_address,
        STATE: acc.state,
        DISTRICT: acc.district
      })
    } else {
      setVerifiedDetails(null)
    }
  }

  const clearForm = () => {
    setAccountHolderName('')
    setBankName('')
    setAccountNumber('')
    setConfirmAccountNumber('')
    setIfscCode('')
    setBranchName('')
    setUpiId('')
    setIfscVerified(false)
    setVerifiedDetails(null)
    setIfscError('')
    setAccountNumberError('')
  }

  const resolveHolderName = async (accNum) => {
    const trimmed = String(accNum).trim()
    if (!/^\d{9,18}$/.test(trimmed)) return
    try {
      setResolvingName(true)
      setAccountNumberError('')
      const res = await resolveAccountHolderName(trimmed, ifscCode, role, { token, dpId })
      if (res.success && res.accountHolderName) {
        setAccountHolderName(res.accountHolderName)
      }
    } catch (err) {
      console.error('Failed to resolve account holder name:', err)
    } finally {
      setResolvingName(false)
    }
  }

  // Trigger resolve if ifsc gets verified and account number is already valid
  useEffect(() => {
    if (ifscVerified && /^\d{9,18}$/.test(accountNumber.trim())) {
      resolveHolderName(accountNumber.trim())
    }
  }, [ifscVerified])

  const handleAccountNumberBlur = () => {
    const trimmed = accountNumber.trim()
    if (trimmed.length > 0 && (trimmed.length < 9 || trimmed.length > 18)) {
      setAccountNumberError('Please enter a valid account number.')
    } else {
      setAccountNumberError('')
      if (trimmed.length >= 9 && trimmed.length <= 18) {
        resolveHolderName(trimmed)
      }
    }
  }

  const handleConfirmAccountNumberBlur = () => {
    const trimmedConfirm = confirmAccountNumber.trim()
    const trimmedAcc = accountNumber.trim()
    if (trimmedConfirm && trimmedConfirm !== trimmedAcc) {
      setAccountNumberError('Account numbers do not match.')
    } else if (trimmedConfirm && trimmedConfirm === trimmedAcc) {
      setAccountNumberError('')
    }
  }

  const handleVerifyIFSC = async () => {
    if (!ifscCode) {
      setIfscError('Please enter an IFSC code first.')
      return
    }
    const cleanIfsc = ifscCode.trim().toUpperCase()
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
    if (!ifscRegex.test(cleanIfsc)) {
      setIfscError('Invalid IFSC Code format. E.g. SBIN0001234')
      setIfscVerified(false)
      return
    }

    try {
      setVerifyingIfsc(true)
      setIfscError('')
      const res = await verifyIfscCode(cleanIfsc)
      if (res.success) {
        setIfscVerified(true)
        setBankName(res.bankName)
        setBranchName(res.branchName)
        setVerifiedDetails({
          BANK: res.bankName,
          BRANCH: res.branchName,
          ADDRESS: res.branchAddress,
          STATE: res.state,
          DISTRICT: res.district
        })
      }
    } catch (err) {
      setIfscVerified(false)
      setVerifiedDetails(null)
      setIfscError(err.message || 'Unable to verify the IFSC Code at the moment. Please try again later.')
    } finally {
      setVerifyingIfsc(false)
    }
  }

  // Trigger verify on 11 characters automatic check
  const handleIfscChange = (e) => {
    const val = e.target.value.toUpperCase()
    setIfscCode(val)
    setIfscVerified(false)
    setVerifiedDetails(null)
    setIfscError('')
    if (val.length === 11) {
      // Auto verify if format matches
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
      if (ifscRegex.test(val)) {
        // Run verify
        setTimeout(() => {
          verifyIfscCode(val)
            .then(res => {
              if (res.success) {
                setIfscVerified(true)
                setBankName(res.bankName)
                setBranchName(res.branchName)
                setVerifiedDetails({
                  BANK: res.bankName,
                  BRANCH: res.branchName,
                  ADDRESS: res.branchAddress,
                  STATE: res.state,
                  DISTRICT: res.district
                })
              }
            })
            .catch(err => {
              setIfscVerified(false)
              setVerifiedDetails(null)
              setIfscError(err.message || 'Invalid IFSC Code.')
            })
        }, 100)
      }
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const cleanAcc = accountNumber.trim()
    const cleanConfirm = confirmAccountNumber.trim()

    if (!accountHolderName.trim() || !bankName.trim() || !cleanAcc || !ifscCode.trim()) {
      setError('All required fields must be filled.')
      return
    }

    if (!/^\d{9,18}$/.test(cleanAcc)) {
      setError('Please enter a valid account number.')
      return
    }

    if (cleanAcc !== cleanConfirm) {
      setError('Account numbers do not match.')
      return
    }

    if (!ifscVerified) {
      setError('Please verify the IFSC Code before submitting.')
      return
    }

    try {
      setSaving(true)
      const payload = {
        account_holder_name: accountHolderName.trim(),
        bank_name: bankName.trim(),
        account_number: cleanAcc,
        ifsc_code: ifscCode.trim().toUpperCase(),
        branch_name: branchName.trim(),
        upi_id: upiId.trim()
      }
      let activeToken = token
      if (role === 'user' && !activeToken) {
        const { data } = await supabase.auth.getSession()
        activeToken = data?.session?.access_token
      }
      const res = await saveBankAccount(role, payload, { token: activeToken, dpId })
      if (res.success) {
        setSuccess('Bank account details saved successfully and submitted for Admin approval.')
        loadBankDetails()
      }
    } catch (err) {
      setError(err.message || 'Failed to save bank account details.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to remove your pending bank account details?')) {
      return
    }
    try {
      setError('')
      setSuccess('')
      setSaving(true)
      let activeToken = token
      if (role === 'user' && !activeToken) {
        const { data } = await supabase.auth.getSession()
        activeToken = data?.session?.access_token
      }
      const res = await deleteBankAccount(role, { token: activeToken, dpId })
      if (res.success) {
        setSuccess('Bank details removed successfully.')
        loadBankDetails()
      }
    } catch (err) {
      setError(err.message || 'Failed to delete bank details.')
    } finally {
      setSaving(false)
    }
  }

  const handleRequestChange = () => {
    // Prefill with approved account to edit it
    if (approvedAccount) {
      prefillForm(approvedAccount)
    } else {
      clearForm()
    }
    // Set to create/edit mode
    setMode('create')
  }


  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(10px)',
      borderRadius: 16,
      border: '1px solid rgba(226, 232, 240, 0.8)',
      padding: 24,
      boxShadow: '0 4px 20px -2px rgba(148, 163, 184, 0.12)',
      marginTop: 20
    }}>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        🏦 Bank Account Details
      </h3>

      {error && (
        <div style={{
          background: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #fecaca',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: '#f0fdf4',
          color: '#166534',
          border: '1px solid #bbf7d0',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: '0.875rem'
        }}>
          {success}
        </div>
      )}

      {/* 1. View Mode (Approved Details Display) */}
      {mode === 'view' && approvedAccount && (
        <div>
          <div style={{
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 20,
            fontSize: '0.875rem',
            lineHeight: '1.5'
          }}>
            Your bank account has been approved by the Admin. To change your bank details, please submit a new bank account update request for approval.
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 20
          }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Account Holder</label>
              <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#0f172a', marginTop: 2 }}>{approvedAccount.account_holder_name}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Bank Name</label>
              <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#0f172a', marginTop: 2 }}>{approvedAccount.bank_name}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Account Number</label>
              <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#0f172a', marginTop: 2 }}>
                {'X'.repeat(Math.max(0, approvedAccount.account_number.length - 4)) + approvedAccount.account_number.slice(-4)}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>IFSC Code</label>
              <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#0f172a', marginTop: 2 }}>{approvedAccount.ifsc_code}</div>
            </div>
            {approvedAccount.branch_name && (
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Branch Name</label>
                <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#0f172a', marginTop: 2 }}>{approvedAccount.branch_name}</div>
              </div>
            )}
            {approvedAccount.upi_id && (
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>UPI ID</label>
                <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#0f172a', marginTop: 2 }}>{approvedAccount.upi_id}</div>
              </div>
            )}
          </div>

          <button
            onClick={handleRequestChange}
            type="button"
            className="btn btn-outline-primary btn-sm"
            style={{ borderRadius: 8, padding: '8px 16px', fontWeight: '500' }}
          >
            🔄 Request Bank Account Update
          </button>
        </div>
      )}

      {/* 2. Edit / Create / Update Request Mode */}
      {mode !== 'view' && (
        <form onSubmit={handleSave}>
          {pendingRequest && (
            <div style={{
              background: pendingRequest.approval_status === 'changes_requested' ? '#fef9c3' : (pendingRequest.approval_status === 'rejected' ? '#fef2f2' : '#eff6ff'),
              color: pendingRequest.approval_status === 'changes_requested' ? '#854d0e' : (pendingRequest.approval_status === 'rejected' ? '#991b1b' : '#1e40af'),
              border: pendingRequest.approval_status === 'changes_requested' ? '1px solid #fde68a' : (pendingRequest.approval_status === 'rejected' ? '1px solid #fecaca' : '1px solid #bfdbfe'),
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 20,
              fontSize: '0.875rem'
            }}>
              {pendingRequest.approval_status === 'pending' && (
                <div>⏳ Your bank account details are pending Admin approval. You can edit or remove them below.</div>
              )}
              {pendingRequest.approval_status === 'changes_requested' && (
                <div>
                  <strong>⚠️ Admin Requested Changes:</strong> {pendingRequest.admin_notes || 'No description provided.'}
                  <br />Please update the details and resubmit.
                </div>
              )}
              {pendingRequest.approval_status === 'rejected' && (
                <div>
                  <strong>❌ Bank Account Request Rejected:</strong> {pendingRequest.admin_notes || 'No reason provided.'}
                  <br />Please update the details and resubmit.
                </div>
              )}
            </div>
          )}

          {approvedAccount && (
            <div style={{
              background: '#f8fafc',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 20,
              fontSize: '0.825rem'
            }}>
              ℹ️ You are submitting a new bank account change request. Your existing approved account remains active until this request is approved by the Admin.
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 20
          }}>
            <div>
              <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: '500', marginBottom: 4, display: 'block' }}>
                Account Holder Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Name as in bank records"
                required
                style={{ borderRadius: 8 }}
              />
              {resolvingName && (
                <div style={{ color: '#0284c7', fontSize: '0.75rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="spinner-border spinner-border-sm text-info" style={{ width: 12, height: 12 }} role="status"></span>
                  Resolving name...
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: '500', marginBottom: 4, display: 'block' }}>
                IFSC Code <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="form-control"
                  value={ifscCode}
                  onChange={handleIfscChange}
                  placeholder="e.g. SBIN0001234"
                  required
                  style={{ borderRadius: 8, textTransform: 'uppercase' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleVerifyIFSC}
                  disabled={verifyingIfsc || !ifscCode}
                  style={{ borderRadius: 8, flexShrink: 0, padding: '0 12px' }}
                >
                  {verifyingIfsc ? 'Verifying...' : 'Verify'}
                </button>
              </div>
              {ifscError && (
                <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 4 }}>{ifscError}</div>
              )}
              {ifscVerified && (
                <div style={{ color: '#16a34a', fontSize: '0.75rem', marginTop: 4, fontWeight: '500' }}>
                  ✓ IFSC Verified Successfully!
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: '500', marginBottom: 4, display: 'block' }}>
                Bank Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Verify IFSC or enter bank name"
                required
                disabled={ifscVerified}
                style={{ borderRadius: 8 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: '500', marginBottom: 4, display: 'block' }}>
                Branch Name {ifscVerified ? '' : '(Optional)'}
              </label>
              <input
                type="text"
                className="form-control"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="Branch office"
                disabled={ifscVerified}
                style={{ borderRadius: 8 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: '500', marginBottom: 4, display: 'block' }}>
                Account Number <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="password"
                className="form-control"
                value={accountNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  if (val.length <= 18) {
                    setAccountNumber(val)
                    setAccountNumberError('')
                  }
                }}
                onBlur={handleAccountNumberBlur}
                maxLength={18}
                placeholder="Enter account number"
                required
                style={{ borderRadius: 8 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: '500', marginBottom: 4, display: 'block' }}>
                Confirm Account Number <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={confirmAccountNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  if (val.length <= 18) {
                    setConfirmAccountNumber(val)
                    setAccountNumberError('')
                  }
                }}
                onBlur={handleConfirmAccountNumberBlur}
                maxLength={18}
                placeholder="Confirm account number"
                required
                style={{ borderRadius: 8 }}
              />
              {accountNumberError && (
                <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 4 }}>
                  {accountNumberError}
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: '500', marginBottom: 4, display: 'block' }}>
                UPI ID (Optional)
              </label>
              <input
                type="text"
                className="form-control"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="username@bank"
                style={{ borderRadius: 8 }}
              />
            </div>
          </div>

          {verifiedDetails && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 20,
              fontSize: '0.8rem',
              color: '#334155',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 8
            }}>
              <div><strong>Branch Address:</strong> {verifiedDetails.ADDRESS || '—'}</div>
              <div><strong>District:</strong> {verifiedDetails.DISTRICT || '—'}</div>
              <div><strong>State:</strong> {verifiedDetails.STATE || '—'}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                saving || 
                !ifscVerified || 
                !accountHolderName.trim() || 
                !bankName.trim() || 
                !/^\d{9,18}$/.test(accountNumber.trim()) || 
                confirmAccountNumber !== accountNumber ||
                !!accountNumberError
              }
              style={{ borderRadius: 8, padding: '10px 24px', fontWeight: '500' }}
            >
              {saving ? 'Saving...' : '💾 Save Bank Details'}
            </button>

            {pendingRequest && (
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={handleDelete}
                disabled={saving}
                style={{ borderRadius: 8, padding: '10px 18px', fontWeight: '500' }}
              >
                🗑️ Remove Details
              </button>
            )}

            {approvedAccount && (
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setMode('view')}
                disabled={saving}
                style={{ borderRadius: 8, padding: '10px 18px', fontWeight: '500' }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
