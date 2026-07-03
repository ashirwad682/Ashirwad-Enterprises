import React, { useState, useEffect } from 'react'
import {
  adminUpdateManagerSalaryConfig,
  adminCalculateDeliveryPartnerSalary,
  adminInitiateSalary,
  fetchAdminSalariesHistory,
  adminUpdateSalaryStatus
} from '../../api/client'
import { motion, AnimatePresence } from 'framer-motion'

const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001')

export default function SalaryManagementTab({ adminKey }) {
  const [activeSubTab, setActiveSubTab] = useState('managers') // 'managers' | 'delivery-partners' | 'history'

  // Common UI states
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Manager State
  const [managers, setManagers] = useState([])
  const [loadingManagers, setLoadingManagers] = useState(false)
  const [selectedManager, setSelectedManager] = useState(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [configForm, setConfigForm] = useState({ base_salary: '', payroll_schedule: 'monthly' })
  const [payoutForm, setPayoutForm] = useState({
    pay_period_start: '',
    pay_period_end: '',
    incentives: '0',
    deductions: '0',
    remarks: '',
    payment_status: 'pending'
  })

  // Delivery Partner State
  const [partners, setPartners] = useState([])
  const [loadingPartners, setLoadingPartners] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState('')
  const [dpCalcStart, setDpCalcStart] = useState('')
  const [dpCalcEnd, setDpCalcEnd] = useState('')
  const [calculatingDp, setCalculatingDp] = useState(false)
  const [dpCalculatedData, setDpCalculatedData] = useState(null)
  const [dpPayoutForm, setDpPayoutForm] = useState({
    incentives: '0',
    deductions: '0',
    remarks: '',
    payment_status: 'pending'
  })

  // History State
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all') // 'all' | 'pending' | 'processing' | 'paid' | 'failed'
  const [activeHistoryAction, setActiveHistoryAction] = useState(null) // { payout, action: 'pay' | 'fail' }
  const [actionForm, setActionForm] = useState({ transaction_id: '', remarks: '' })

  // Bank Accounts mapping for direct check in lists
  const [bankAccounts, setBankAccounts] = useState([])

  useEffect(() => {
    loadBankAccounts()
    if (activeSubTab === 'managers') {
      loadManagers()
    } else if (activeSubTab === 'delivery-partners') {
      loadPartners()
    } else if (activeSubTab === 'history') {
      loadHistory()
    }
  }, [activeSubTab])

  const loadBankAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/bank-accounts`, {
        headers: { 'x-admin-api-key': adminKey }
      })
      if (res.ok) {
        const data = await res.json()
        setBankAccounts(data || [])
      }
    } catch (err) {
      console.error('Failed to load bank accounts', err)
    }
  }

  const loadManagers = async () => {
    try {
      setLoadingManagers(true)
      setError('')
      const res = await fetch(`${API_BASE}/api/admin/managers`, {
        headers: { 'x-admin-api-key': adminKey }
      })
      if (!res.ok) throw new Error('Failed to fetch managers list')
      const data = await res.json()
      setManagers(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingManagers(false)
    }
  }

  const loadPartners = async () => {
    try {
      setLoadingPartners(true)
      setError('')
      const res = await fetch(`${API_BASE}/api/admin/delivery-partners`, {
        headers: { 'x-admin-api-key': adminKey }
      })
      if (!res.ok) throw new Error('Failed to fetch delivery partners list')
      const data = await res.json()
      setPartners(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingPartners(false)
    }
  }

  const loadHistory = async () => {
    try {
      setLoadingHistory(true)
      setError('')
      const data = await fetchAdminSalariesHistory(adminKey)
      setHistory(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Get Approved Bank status for a specific entity
  const getApprovedBank = (entityId, role) => {
    return bankAccounts.find(account => {
      if (role === 'manager') return account.manager_id === entityId && account.approval_status === 'approved'
      if (role === 'delivery_partner') return account.delivery_partner_id === entityId && account.approval_status === 'approved'
      return false
    })
  }

  // Manager salary config save
  const handleSaveConfig = async (e) => {
    e.preventDefault()
    try {
      setError('')
      setSuccess('')
      const rate = parseFloat(configForm.base_salary)
      if (isNaN(rate) || rate < 0) {
        throw new Error('Please enter a valid base salary amount.')
      }
      await adminUpdateManagerSalaryConfig(adminKey, selectedManager.id, rate, configForm.payroll_schedule)
      setSuccess(`Updated salary configuration for ${selectedManager.full_name}`)
      setShowConfigModal(false)
      loadManagers()
    } catch (err) {
      setError(err.message)
    }
  }

  // Manager salary payout initiate
  const handleInitiateManagerPayout = async (e) => {
    e.preventDefault()
    try {
      setError('')
      setSuccess('')

      const approvedBank = getApprovedBank(selectedManager.id, 'manager')
      if (!approvedBank) {
        throw new Error('This manager does not have an Admin-approved bank account. Payout cannot be initiated.')
      }

      const incentivesVal = parseFloat(payoutForm.incentives || 0)
      const deductionsVal = parseFloat(payoutForm.deductions || 0)
      const baseVal = parseFloat(selectedManager.base_salary || 0)
      const netVal = baseVal + incentivesVal - deductionsVal

      if (netVal < 0) {
        throw new Error('Net salary cannot be negative.')
      }

      await adminInitiateSalary(adminKey, {
        manager_id: selectedManager.id,
        pay_period_start: payoutForm.pay_period_start,
        pay_period_end: payoutForm.pay_period_end,
        working_days: 0,
        days_present: 0,
        completed_deliveries: 0,
        base_salary: baseVal,
        incentives: incentivesVal,
        deductions: deductionsVal,
        net_salary: netVal,
        remarks: payoutForm.remarks,
        payment_status: payoutForm.payment_status
      })

      setSuccess(`Successfully initiated salary payout for ${selectedManager.full_name}`)
      setShowPayoutModal(false)
      // reset form
      setPayoutForm({
        pay_period_start: '',
        pay_period_end: '',
        incentives: '0',
        deductions: '0',
        remarks: '',
        payment_status: 'pending'
      })
    } catch (err) {
      setError(err.message)
    }
  }

  // Delivery Partner Dynamic Calculation
  const handleDpCalculate = async (e) => {
    e.preventDefault()
    if (!selectedPartner || !dpCalcStart || !dpCalcEnd) {
      setError('Please select a partner and date range.')
      return
    }
    try {
      setCalculatingDp(true)
      setError('')
      setSuccess('')
      setDpCalculatedData(null)
      const data = await adminCalculateDeliveryPartnerSalary(adminKey, selectedPartner, dpCalcStart, dpCalcEnd)
      setDpCalculatedData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setCalculatingDp(false)
    }
  }

  // Delivery Partner Payout Initiate
  const handleInitiateDpPayout = async () => {
    try {
      setError('')
      setSuccess('')
      if (!dpCalculatedData) return

      if (!dpCalculatedData.approved_bank_account) {
        throw new Error('This partner does not have an Admin-approved bank account. Payout cannot be initiated.')
      }

      const incentivesVal = parseFloat(dpPayoutForm.incentives || 0)
      const deductionsVal = parseFloat(dpPayoutForm.deductions || 0)
      const baseVal = parseFloat(dpCalculatedData.base_salary || 0)
      const deliveryInc = parseFloat(dpCalculatedData.delivery_incentives || 0)
      const netVal = baseVal + deliveryInc + incentivesVal - deductionsVal

      if (netVal < 0) {
        throw new Error('Net salary cannot be negative.')
      }

      const partnerObj = partners.find(p => p.id === selectedPartner)
      const partnerName = partnerObj ? partnerObj.name : 'Delivery Partner'

      await adminInitiateSalary(adminKey, {
        delivery_partner_id: selectedPartner,
        pay_period_start: dpCalcStart,
        pay_period_end: dpCalcEnd,
        working_days: 0, // dynamic payable days used
        days_present: dpCalculatedData.days_present,
        completed_deliveries: dpCalculatedData.completed_deliveries,
        base_salary: baseVal,
        incentives: incentivesVal + deliveryInc, // combine custom and delivery incentives
        deductions: deductionsVal,
        net_salary: netVal,
        remarks: dpPayoutForm.remarks,
        payment_status: dpPayoutForm.payment_status
      })

      setSuccess(`Successfully initiated salary payout for ${partnerName}`)
      setDpCalculatedData(null)
      setSelectedPartner('')
      setDpCalcStart('')
      setDpCalcEnd('')
      setDpPayoutForm({ incentives: '0', deductions: '0', remarks: '', payment_status: 'pending' })
    } catch (err) {
      setError(err.message)
    }
  }

  // Handle History Action (Pay/Fail)
  const handleHistoryActionSubmit = async (e) => {
    e.preventDefault()
    try {
      setError('')
      setSuccess('')
      const { payout, action } = activeHistoryAction
      const status = action === 'pay' ? 'paid' : 'failed'

      await adminUpdateSalaryStatus(
        adminKey,
        payout.id,
        status,
        actionForm.transaction_id,
        actionForm.remarks
      )

      setSuccess(`Payout transaction updated successfully`)
      setActiveHistoryAction(null)
      setActionForm({ transaction_id: '', remarks: '' })
      loadHistory()
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredHistory = history.filter(row => {
    if (historyFilter === 'all') return true
    return row.payment_status === historyFilter
  })

  // Format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0)
  }

  // Mask Account Number
  const maskAccountNumber = (accountNumber) => {
    if (!accountNumber) return 'N/A'
    const clean = String(accountNumber).trim()
    if (clean.length < 4) return clean
    return 'XXXX-XXXX-' + clean.slice(-4)
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#1f2937', padding: '24px', background: '#f9fafb', borderRadius: '16px', minHeight: '80vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            Salary & Payroll Management
          </h2>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Define salary rules, calculate attendance-based payouts, and initiate verified bank payouts.
          </p>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', background: '#f3f4f6', padding: '4px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          {[
            { id: 'managers', label: '👔 Managers Payroll', icon: '👔' },
            { id: 'delivery-partners', label: '🚚 Partner Payouts', icon: '🚚' },
            { id: 'history', label: '📝 Salary History', icon: '📝' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id)
                setError('')
                setSuccess('')
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                background: activeSubTab === tab.id ? '#ffffff' : 'transparent',
                color: activeSubTab === tab.id ? '#1e3a8a' : '#4b5563',
                boxShadow: activeSubTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #fca5a5' }}>
          <span>⚠️</span> {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', background: '#dcfce7', color: '#15803d', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #86efac' }}>
          <span>✅</span> {success}
        </div>
      )}

      {/* Main Tab Views */}
      <AnimatePresence mode="wait">
        {activeSubTab === 'managers' && (
          <motion.div key="managers" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div style={{ background: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025)', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Configure and Pay Managers</h3>
              </div>

              {loadingManagers ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading managers details...</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Manager Name</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Email / Phone</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Base Salary</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Payroll Schedule</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Bank Account</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managers.map(manager => {
                        const approvedBank = getApprovedBank(manager.id, 'manager')
                        return (
                          <tr key={manager.id} style={{ borderBottom: '1px solid #f3f4f6', hover: { background: '#f9fafb' } }}>
                            <td style={{ padding: '16px 20px', fontWeight: '600', color: '#111827' }}>{manager.full_name}</td>
                            <td style={{ padding: '16px 20px', color: '#4b5563' }}>
                              <div>{manager.email}</div>
                              <div style={{ fontSize: '12px', color: '#9ca3af' }}>{manager.phone || 'No phone'}</div>
                            </td>
                            <td style={{ padding: '16px 20px', fontWeight: '700', color: '#047857' }}>
                              {formatCurrency(manager.base_salary)}
                            </td>
                            <td style={{ padding: '16px 20px', textTransform: 'capitalize', color: '#4b5563' }}>
                              <span style={{ background: '#eff6ff', color: '#1e40af', padding: '4px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' }}>
                                {manager.payroll_schedule || 'monthly'}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              {approvedBank ? (
                                <div style={{ color: '#16a34a', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontWeight: '600', fontSize: '13px' }}>🏦 Approved</span>
                                  <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                    {approvedBank.bank_name} ({maskAccountNumber(approvedBank.account_number)})
                                  </span>
                                </div>
                              ) : (
                                <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                                  ⚠️ No Approved Bank
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => {
                                    setSelectedManager(manager)
                                    setConfigForm({
                                      base_salary: manager.base_salary || '',
                                      payroll_schedule: manager.payroll_schedule || 'monthly'
                                    })
                                    setShowConfigModal(true)
                                  }}
                                  style={{ background: 'transparent', border: '1px solid #d1d5db', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#374151', fontWeight: '600' }}
                                >
                                  ⚙️ Set Rules
                                </button>
                                <button
                                  disabled={!approvedBank}
                                  onClick={() => {
                                    setSelectedManager(manager)
                                    setShowPayoutModal(true)
                                  }}
                                  style={{
                                    background: approvedBank ? '#1e3a8a' : '#9ca3af',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    cursor: approvedBank ? 'pointer' : 'not-allowed',
                                    fontWeight: '600'
                                  }}
                                >
                                  💸 Pay Salary
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {managers.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No managers configured in the system.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeSubTab === 'delivery-partners' && (
          <motion.div key="delivery-partners" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
              
              {/* Calculator Form */}
              <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>Delivery Partner Payout Calculator</h3>
                
                <form onSubmit={handleDpCalculate} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Select Delivery Partner</label>
                    <select
                      value={selectedPartner}
                      onChange={(e) => {
                        setSelectedPartner(e.target.value)
                        setDpCalculatedData(null)
                      }}
                      required
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' }}
                    >
                      <option value="">-- Choose Partner --</option>
                      {partners.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.delivery_partner_id || 'No Code'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Start Date</label>
                    <input
                      type="date"
                      value={dpCalcStart}
                      onChange={(e) => {
                        setDpCalcStart(e.target.value)
                        setDpCalculatedData(null)
                      }}
                      required
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>End Date</label>
                    <input
                      type="date"
                      value={dpCalcEnd}
                      onChange={(e) => {
                        setDpCalcEnd(e.target.value)
                        setDpCalculatedData(null)
                      }}
                      required
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={calculatingDp}
                    style={{ background: '#1e3a8a', color: '#ffffff', padding: '9px 20px', borderRadius: '6px', border: 'none', fontWeight: '600', cursor: calculatingDp ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', gap: '8px' }}
                  >
                    {calculatingDp ? 'Calculating...' : '📊 Calculate Salary'}
                  </button>
                </form>
              </div>

              {/* Calculator Output */}
              {dpCalculatedData && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                        Calculated Payout Summary: {dpCalculatedData.partner?.name}
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                        Pay period: {dpCalcStart} to {dpCalcEnd}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      {dpCalculatedData.approved_bank_account ? (
                        <div style={{ color: '#16a34a', border: '1px solid #bcf0da', background: '#f3faf7', padding: '6px 12px', borderRadius: '6px', display: 'inline-block', fontSize: '12px' }}>
                          <strong>Approved Bank:</strong> {dpCalculatedData.approved_bank_account.bank_name} ({maskAccountNumber(dpCalculatedData.approved_bank_account.account_number)})
                        </div>
                      ) : (
                        <div style={{ color: '#b91c1c', border: '1px solid #fde8e8', background: '#fdf2f2', padding: '6px 12px', borderRadius: '6px', display: 'inline-block', fontSize: '12px', fontWeight: 'bold' }}>
                          ⚠️ Payout Blocked: No Approved Bank Account
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Calculations Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>PAYABLE ATTENDANCE DAYS</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827', marginTop: '4px' }}>{dpCalculatedData.payable_days} Days</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Rate: {formatCurrency(dpCalculatedData.salary_per_day)}/day</div>
                    </div>

                    <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>COMPLETED DELIVERIES</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827', marginTop: '4px' }}>{dpCalculatedData.completed_deliveries} Orders</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Incentive Rate: {formatCurrency(dpCalculatedData.pay_per_delivery)}/order</div>
                    </div>

                    <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                      <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600' }}>BASE ATTENDANCE SALARY</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#166534', marginTop: '4px' }}>{formatCurrency(dpCalculatedData.base_salary)}</div>
                    </div>

                    <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                      <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: '600' }}>DELIVERY INCENTIVES</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e3a8a', marginTop: '4px' }}>{formatCurrency(dpCalculatedData.delivery_incentives)}</div>
                    </div>
                  </div>

                  {/* Initiate Panel */}
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '20px', background: '#fafafa', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <h5 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#374151' }}>Initiate Verified Payout Ledger</h5>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Custom Incentives (INR)</label>
                        <input
                          type="number"
                          value={dpPayoutForm.incentives}
                          onChange={(e) => setDpPayoutForm(prev => ({ ...prev, incentives: e.target.value }))}
                          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Custom Deductions (INR)</label>
                        <input
                          type="number"
                          value={dpPayoutForm.deductions}
                          onChange={(e) => setDpPayoutForm(prev => ({ ...prev, deductions: e.target.value }))}
                          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Payout Status</label>
                        <select
                          value={dpPayoutForm.payment_status}
                          onChange={(e) => setDpPayoutForm(prev => ({ ...prev, payment_status: e.target.value }))}
                          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                        >
                          <option value="pending">Pending Admin Release</option>
                          <option value="paid">Direct Release (Mark Paid)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Remarks / Memo</label>
                      <input
                        type="text"
                        value={dpPayoutForm.remarks}
                        onChange={(e) => setDpPayoutForm(prev => ({ ...prev, remarks: e.target.value }))}
                        placeholder="e.g. Monthly salary calculation with performance bonus"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                      <div>
                        <span style={{ fontSize: '14px', color: '#4b5563', fontWeight: '600' }}>TOTAL NET PAYABLE: </span>
                        <strong style={{ fontSize: '20px', color: '#047857', marginLeft: '8px' }}>
                          {formatCurrency(
                            parseFloat(dpCalculatedData.base_salary) +
                            parseFloat(dpCalculatedData.delivery_incentives) +
                            parseFloat(dpPayoutForm.incentives || 0) -
                            parseFloat(dpPayoutForm.deductions || 0)
                          )}
                        </strong>
                      </div>

                      <button
                        onClick={handleInitiateDpPayout}
                        disabled={!dpCalculatedData.approved_bank_account}
                        style={{
                          background: dpCalculatedData.approved_bank_account ? '#10b981' : '#9ca3af',
                          color: '#ffffff',
                          padding: '10px 24px',
                          borderRadius: '6px',
                          border: 'none',
                          fontWeight: '700',
                          cursor: dpCalculatedData.approved_bank_account ? 'pointer' : 'not-allowed',
                          fontSize: '14px'
                        }}
                      >
                        🚀 Initiate Bank Payout
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {activeSubTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div style={{ background: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Salary Payout History Ledger</h3>
                
                {/* Filter */}
                <div style={{ display: 'flex', gap: '8px', background: '#f3f4f6', padding: '2px', borderRadius: '6px' }}>
                  {['all', 'pending', 'processing', 'paid', 'failed'].map(f => (
                    <button
                      key={f}
                      onClick={() => setHistoryFilter(f)}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'capitalize',
                        cursor: 'pointer',
                        background: historyFilter === f ? '#ffffff' : 'transparent',
                        color: historyFilter === f ? '#1f2937' : '#4b5563',
                        boxShadow: historyFilter === f ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {loadingHistory ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading payout history...</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Recipient Details</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Role</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Pay Period</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Amounts Breakdown</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Net Paid</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Bank Destination</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Status</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600' }}>Transaction Info</th>
                        <th style={{ padding: '12px 20px', fontWeight: '600', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map(row => {
                        let recipientName = 'N/A'
                        let recipientEmail = 'N/A'
                        let role = 'Manager'
                        if (row.managers) {
                          recipientName = row.managers.full_name
                          recipientEmail = row.managers.email
                        } else if (row.delivery_partners) {
                          recipientName = row.delivery_partners.name
                          recipientEmail = row.delivery_partners.email
                          role = 'Delivery Partner'
                        }

                        const bank = row.bank_accounts

                        const statusColors = {
                          pending: { bg: '#fffbeb', text: '#d97706' },
                          processing: { bg: '#eff6ff', text: '#2563eb' },
                          paid: { bg: '#ecfdf5', text: '#059669' },
                          failed: { bg: '#fef2f2', text: '#dc2626' }
                        }
                        const colors = statusColors[row.payment_status] || { bg: '#f3f4f6', text: '#374151' }

                        return (
                          <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '16px 20px', fontWeight: '600', color: '#111827' }}>
                              <div>{recipientName}</div>
                              <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>{recipientEmail}</div>
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              <span style={{ fontSize: '12px', fontWeight: '600', background: role === 'Manager' ? '#f5f3ff' : '#eff6ff', color: role === 'Manager' ? '#6d28d9' : '#1d4ed8', padding: '4px 8px', borderRadius: '4px' }}>
                                {role}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                              {row.pay_period_start} to {row.pay_period_end}
                            </td>
                            <td style={{ padding: '16px 20px', color: '#4b5563' }}>
                              <div style={{ fontSize: '11px' }}>Base: {formatCurrency(row.base_salary)}</div>
                              <div style={{ fontSize: '11px', color: '#16a34a' }}>Inc: +{formatCurrency(row.incentives)}</div>
                              <div style={{ fontSize: '11px', color: '#dc2626' }}>Ded: -{formatCurrency(row.deductions)}</div>
                            </td>
                            <td style={{ padding: '16px 20px', fontWeight: '700', color: '#047857', fontSize: '14px' }}>
                              {formatCurrency(row.net_salary)}
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              {bank ? (
                                <div style={{ fontSize: '11px', color: '#4b5563' }}>
                                  <div><strong>{bank.bank_name}</strong></div>
                                  <div>Acc: {maskAccountNumber(bank.account_number)}</div>
                                  <div>IFSC: {bank.ifsc_code}</div>
                                </div>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>No bank info</span>
                              )}
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', background: colors.bg, color: colors.text }}>
                                {row.payment_status}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', maxWidth: '180px', wordBreak: 'break-all' }}>
                              {row.transaction_id ? (
                                <div style={{ fontSize: '11px' }}>
                                  <div><strong>Ref:</strong> {row.transaction_id}</div>
                                  <div style={{ color: '#9ca3af' }}>Date: {row.payment_date ? new Date(row.payment_date).toLocaleDateString() : 'N/A'}</div>
                                </div>
                              ) : (
                                <span style={{ color: '#9ca3af', fontSize: '11px' }}>No reference</span>
                              )}
                              {row.remarks && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', fontStyle: 'italic' }}>"{row.remarks}"</div>}
                            </td>
                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                              {(row.payment_status === 'pending' || row.payment_status === 'processing') ? (
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button
                                    onClick={() => {
                                      setActiveHistoryAction({ payout: row, action: 'pay' })
                                    }}
                                    style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                                  >
                                    ✓ Paid
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveHistoryAction({ payout: row, action: 'fail' })
                                    }}
                                    style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                                  >
                                    ✗ Fail
                                  </button>
                                </div>
                              ) : (
                                <span style={{ color: '#9ca3af', fontSize: '11px' }}>Locked</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {filteredHistory.length === 0 && (
                        <tr>
                          <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No salary payouts in history matches selection.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 1: Manager Salary Config */}
      {showConfigModal && selectedManager && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#111827' }}>
              Configure Salary rules: {selectedManager.full_name}
            </h4>

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#4b5563' }}>Monthly Base Salary (INR)</label>
                <input
                  type="number"
                  value={configForm.base_salary}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, base_salary: e.target.value }))}
                  required
                  placeholder="e.g. 35000"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#4b5563' }}>Payroll Schedule</label>
                <select
                  value={configForm.payroll_schedule}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, payroll_schedule: e.target.value }))}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  style={{ background: '#f3f4f6', border: 'none', padding: '8px 16px', borderRadius: '6px', color: '#4b5563', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#1e3a8a', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Save Rules
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Pay Manager Salary */}
      {showPayoutModal && selectedManager && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#111827' }}>
              Pay Salary Payout: {selectedManager.full_name}
            </h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
              Base pay rate defined: <strong>{formatCurrency(selectedManager.base_salary)}</strong> ({selectedManager.payroll_schedule})
            </p>

            <form onSubmit={handleInitiateManagerPayout} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Period Start</label>
                  <input
                    type="date"
                    value={payoutForm.pay_period_start}
                    onChange={(e) => setPayoutForm(prev => ({ ...prev, pay_period_start: e.target.value }))}
                    required
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Period End</label>
                  <input
                    type="date"
                    value={payoutForm.pay_period_end}
                    onChange={(e) => setPayoutForm(prev => ({ ...prev, pay_period_end: e.target.value }))}
                    required
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Incentives / Bonus</label>
                  <input
                    type="number"
                    value={payoutForm.incentives}
                    onChange={(e) => setPayoutForm(prev => ({ ...prev, incentives: e.target.value }))}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Deductions</label>
                  <input
                    type="number"
                    value={payoutForm.deductions}
                    onChange={(e) => setPayoutForm(prev => ({ ...prev, deductions: e.target.value }))}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Remarks / Memo</label>
                <input
                  type="text"
                  value={payoutForm.remarks}
                  onChange={(e) => setPayoutForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="e.g. Monthly salary payout"
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Transaction Status</label>
                <select
                  value={payoutForm.payment_status}
                  onChange={(e) => setPayoutForm(prev => ({ ...prev, payment_status: e.target.value }))}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                >
                  <option value="pending">Pending Bank Release</option>
                  <option value="paid">Released (Mark Paid Immediately)</option>
                </select>
              </div>

              {/* Net Payout Counter */}
              <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', border: '1px solid #f3f4f6', textAlign: 'right' }}>
                <span style={{ fontSize: '13px', color: '#4b5563' }}>Net Salary Payable: </span>
                <strong style={{ fontSize: '16px', color: '#047857', marginLeft: '6px' }}>
                  {formatCurrency(
                    parseFloat(selectedManager.base_salary || 0) +
                    parseFloat(payoutForm.incentives || 0) -
                    parseFloat(payoutForm.deductions || 0)
                  )}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  style={{ background: '#f3f4f6', border: 'none', padding: '8px 16px', borderRadius: '6px', color: '#4b5563', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#1e3a8a', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Confirm Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Update History Payout Status */}
      {activeHistoryAction && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#111827' }}>
              {activeHistoryAction.action === 'pay' ? '💳 Record Successful Payment' : '❌ Mark Payout Failure'}
            </h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
              Confirm transaction update for net amount: <strong>{formatCurrency(activeHistoryAction.payout.net_salary)}</strong>
            </p>

            <form onSubmit={handleHistoryActionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {activeHistoryAction.action === 'pay' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#4b5563' }}>Bank Transaction Ref / ID</label>
                  <input
                    type="text"
                    value={actionForm.transaction_id}
                    onChange={(e) => setActionForm(prev => ({ ...prev, transaction_id: e.target.value }))}
                    required
                    placeholder="e.g. TXN987293817293"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#4b5563' }}>
                  {activeHistoryAction.action === 'pay' ? 'Remarks (Optional)' : 'Failure Reason / Note'}
                </label>
                <input
                  type="text"
                  value={actionForm.remarks}
                  onChange={(e) => setActionForm(prev => ({ ...prev, remarks: e.target.value }))}
                  required={activeHistoryAction.action === 'fail'}
                  placeholder={activeHistoryAction.action === 'pay' ? 'Payment processed successfully' : 'e.g. Incorrect IFSC code / Account frozen'}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveHistoryAction(null)
                    setActionForm({ transaction_id: '', remarks: '' })
                  }}
                  style={{ background: '#f3f4f6', border: 'none', padding: '8px 16px', borderRadius: '6px', color: '#4b5563', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: activeHistoryAction.action === 'pay' ? '#10b981' : '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
