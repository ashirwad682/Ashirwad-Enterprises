import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { fetchOffers, getCachedDataSync, setCachedData } from '../api/client'
import { useMediaQuery } from '../lib/useMediaQuery'
import { jsPDF } from 'jspdf'

// Helper to convert number to words in Indian Numbering System
function convertNumberToWords(num) {
  if (num === 0) return 'Zero Rupees Only'
  
  const parts = Number(num).toFixed(2).split('.')
  const rupees = parseInt(parts[0], 10)
  const paise = parseInt(parts[1], 10)
  
  function getIndianWords(n) {
    const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
    const doubleDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    const tensDigits = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    
    if (n === 0) return ''
    
    let str = ''
    if (n >= 10000000) {
      str += getIndianWords(Math.floor(n / 10000000)) + ' Crore '
      n %= 10000000
    }
    if (n >= 100000) {
      str += getIndianWords(Math.floor(n / 100000)) + ' Lakh '
      n %= 100000
    }
    if (n >= 1000) {
      str += getIndianWords(Math.floor(n / 1000)) + ' Thousand '
      n %= 1000
    }
    if (n >= 100) {
      str += getIndianWords(Math.floor(n / 100)) + ' Hundred '
      n %= 100
    }
    if (n > 0) {
      if (n < 10) {
        str += singleDigits[n]
      } else if (n < 20) {
        str += doubleDigits[n - 10]
      } else {
        str += tensDigits[Math.floor(n / 10)] + ' ' + singleDigits[n % 10]
      }
    }
    return str.trim()
  }

  let words = ''
  if (rupees > 0) {
    words += getIndianWords(rupees) + ' Rupees'
  } else {
    words += 'Zero Rupees'
  }
  
  if (paise > 0) {
    words += ' and ' + getIndianWords(paise) + ' Paise'
  }
  
  return words.replace(/\s+/g, ' ').trim() + ' Only'
}

// Helper to pre-load and fade the logo image for watermark
const getFadedLogoBase64 = (url, opacity = 0.08) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = url
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.globalAlpha = opacity
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      resolve(null)
    }
  })
}

function getOfferValidity(endAtStr) {
  if (!endAtStr) return 'Ongoing'
  const end = new Date(endAtStr)
  const now = new Date()
  const diffMs = end - now
  if (diffMs <= 0) return 'Expired'
  
  const diffDays = Math.floor(diffMs / 86400000)
  const diffHours = Math.floor((diffMs % 86400000) / 3600000)
  
  if (diffDays > 0) {
    return `${diffDays}d ${diffHours}h remaining`
  }
  if (diffHours > 0) {
    return `${diffHours}h remaining`
  }
  const diffMins = Math.floor((diffMs % 3600000) / 60000)
  return `${diffMins}m remaining`
}

export default function DashboardHome() {
  const cachedOffers = getCachedDataSync('offers_public')
  const cachedOrders = getCachedDataSync('orders_current_user')
  
  const [offers, setOffers] = useState(cachedOffers || [])
  const [offersLoading, setOffersLoading] = useState(!cachedOffers)
  const [offersError, setOffersError] = useState(null)
  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState(cachedOrders || [])
  const [recentActivity, setRecentActivity] = useState(() => {
    if (cachedOrders) {
      return cachedOrders.slice(0, 3).map(order => ({
        id: order.id,
        type: 'order',
        title: `Order #${order.order_id || order.id.slice(0, 8).toUpperCase()}`,
        description: `Order status: ${order.status}`,
        status: order.status,
        timestamp: order.created_at,
        details: order.status === 'Delivered' 
          ? 'Delivered to Main Office reception.'
          : order.status === 'Dispatched'
          ? 'Package has left the warehouse.'
          : order.status === 'Approved'
          ? 'Payment verified. Packing in progress.'
          : order.status
      }))
    }
    return []
  })
  const navigate = useNavigate()
  const isCompact = useMediaQuery('(max-width: 1024px)')
  const now = new Date()

  // Fetch user data and orders
  useEffect(() => {
    const fetchUserAndOrders = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (authUser) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single()
          
          setUser(userData || { email: authUser.email })

          // Fetch orders for this user
          const { data: ordersData } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })

          if (ordersData) {
            setOrders(ordersData)
            setCachedData(`orders_${authUser.id}`, ordersData)
            setCachedData('orders_current_user', ordersData)
            
            setRecentActivity(ordersData.slice(0, 3).map(order => ({
              id: order.id,
              type: 'order',
              title: `Order #${order.order_id || order.id.slice(0, 8).toUpperCase()}`,
              description: `Order status: ${order.status}`,
              status: order.status,
              timestamp: order.created_at,
              details: order.status === 'Delivered' 
                ? 'Delivered to Main Office reception.'
                : order.status === 'Dispatched'
                ? 'Package has left the warehouse.'
                : order.status === 'Approved'
                ? 'Payment verified. Packing in progress.'
                : order.status
            })))
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err)
      }
    }

    fetchUserAndOrders()
  }, [])

  // Fetch offers
  useEffect(() => {
    const loadOffers = async () => {
      try {
        if (!cachedOffers) {
          setOffersLoading(true)
        }
        setOffersError(null)
        const offersResponse = await fetchOffers()
        const activeOffers = Array.isArray(offersResponse) ? offersResponse : []
        setOffers(activeOffers)
      } catch (offerErr) {
        console.error('Error fetching offers:', offerErr)
        if (!cachedOffers) {
          setOffersError('Unable to load admin offers right now.')
        }
      } finally {
        setOffersLoading(false)
      }
    }
    loadOffers()
  }, [cachedOffers])

  const getStatusBadge = (status) => {
    const badges = {
      'Pending': { bg: '#fef3c7', color: '#92400e', label: 'PENDING' },
      'Approved': { bg: '#dbeafe', color: '#1e40af', label: 'PROCESSING' },
      'Dispatched': { bg: '#fce7f3', color: '#831843', label: 'DISPATCHED' },
      'Delivered': { bg: '#d1fae5', color: '#065f46', label: 'DELIVERED' }
    }
    return badges[status] || badges['Pending']
  }

  const getActivityIcon = (status) => {
    switch(status) {
      case 'Delivered': return '✅'
      case 'Dispatched': return '🚚'
      case 'Approved': return '⏳'
      default: return '📦'
    }
  }

  const availableMonths = useMemo(() => {
    if (!orders || orders.length === 0) return []
    const monthsMap = new Map()
    orders.forEach(order => {
      if (order.created_at) {
        const d = new Date(order.created_at)
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
        const label = d.toLocaleString('default', { month: 'long', year: 'numeric' })
        monthsMap.set(key, { key, label, year: d.getFullYear(), month: d.getMonth() })
      }
    })
    return Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key))
  }, [orders])

  const [selectedReportMonth, setSelectedReportMonth] = useState('')

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedReportMonth) {
      setSelectedReportMonth(availableMonths[0].key)
    }
  }, [availableMonths, selectedReportMonth])

  const handleDownloadReport = async () => {
    const logoBase64 = await getFadedLogoBase64('/ashirwad_logo.png', 0.08)

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const now = new Date()
    let year = now.getFullYear()
    let month = now.getMonth() + 1
    
    if (selectedReportMonth) {
      const parts = selectedReportMonth.split('-').map(Number)
      year = parts[0]
      month = parts[1]
    }

    const currentMonthOrders = orders.filter(order => {
      if (!order.created_at) return false
      const orderDate = new Date(order.created_at)
      return orderDate.getFullYear() === year && (orderDate.getMonth() + 1) === month
    })

    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    const monthName = months[month - 1]
    const reportPeriod = `${monthName} ${year}`

    doc.setFont('helvetica', 'normal')
    
    // 1. Header Banner
    doc.setFillColor(0, 75, 147)
    doc.rect(0, 0, 210, 40, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('PEPSICO DISTRIBUTOR', 15, 18)
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Ashirwad Enterprises B2B Portal', 15, 24)
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('MONTHLY SUMMARY REPORT', 195, 18, { align: 'right' })
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Period: ${reportPeriod.toUpperCase()}`, 195, 24, { align: 'right' })
    
    doc.setFillColor(240, 138, 37)
    doc.rect(0, 40, 210, 2, 'F')

    // 1.5. Watermark Background
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 55, 98.5, 100, 100)
    }
    
    // 2. Client & Metadata Details
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('CLIENT DETAILS', 15, 54)
    doc.line(15, 56, 95, 56)
    
    doc.setFont('helvetica', 'normal')
    doc.text(`Name:       ${user?.full_name || 'Ashirwad Enterprises'}`, 15, 62)
    doc.text(`Email:       ${user?.email || 'admin@system.com'}`, 15, 68)
    doc.text(`Role:        Distributor Merchant`, 15, 74)
    
    doc.setFont('helvetica', 'bold')
    doc.text('STATEMENT METADATA', 115, 54)
    doc.line(115, 56, 195, 56)
    
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated:   ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 115, 62)
    doc.text(`Frequency:   On-Demand (Monthly)`, 115, 68)
    doc.text(`Report ID:   REP-${year}${month.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`, 115, 74)

    // 3. Stats widgets (Bento cards)
    const totalAmount = currentMonthOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
    const totalCount = currentMonthOrders.length
    const deliveredCount = currentMonthOrders.filter(o => o.status === 'Delivered').length
    const fulfillmentRate = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 100

    const cardW = 56
    const cardH = 20
    const yPos = 84
    
    // Total Spent Card
    doc.setFillColor(248, 250, 252)
    doc.rect(15, yPos, cardW, cardH, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.rect(15, yPos, cardW, cardH, 'S')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('TOTAL PURCHASE AMOUNT', 19, yPos + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(30, 41, 59)
    doc.text(`INR ${totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 19, yPos + 14)
    
    // Total Orders Card
    doc.setFillColor(248, 250, 252)
    doc.rect(15 + cardW + 6, yPos, cardW, cardH, 'F')
    doc.rect(15 + cardW + 6, yPos, cardW, cardH, 'S')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('ORDERS PLACED', 15 + cardW + 10, yPos + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(30, 41, 59)
    doc.text(`${totalCount} Dispatch${totalCount === 1 ? '' : 'es'}`, 15 + cardW + 10, yPos + 14)
    
    // Fulfillment Rate Card
    doc.setFillColor(248, 250, 252)
    doc.rect(15 + 2 * (cardW + 6), yPos, cardW, cardH, 'F')
    doc.rect(15 + 2 * (cardW + 6), yPos, cardW, cardH, 'S')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('FULFILLMENT RATE', 15 + 2 * (cardW + 6) + 4, yPos + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(22, 163, 74)
    doc.text(`${fulfillmentRate}% Delivered`, 15 + 2 * (cardW + 6) + 4, yPos + 14)

    // 4. Orders Table
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('ORDER TRANSACTION RECORD', 15, 116)
    doc.line(15, 118, 195, 118)

    let nextY = 124
    
    if (currentMonthOrders.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text('No order transactions recorded for this business during the selected calendar month.', 15, nextY)
    } else {
      doc.setFillColor(241, 245, 249)
      doc.rect(15, nextY, 180, 8, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      
      doc.text('ORDER ID', 18, nextY + 5.5)
      doc.text('DATE', 55, nextY + 5.5)
      doc.text('PAYMENT', 95, nextY + 5.5)
      doc.text('STATUS', 135, nextY + 5.5)
      doc.text('AMOUNT (INR)', 192, nextY + 5.5, { align: 'right' })
      
      nextY += 8
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(30, 41, 59)
      
      currentMonthOrders.forEach((order, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252)
          doc.rect(15, nextY, 180, 8, 'F')
        }
        
        const orderIdText = order.order_id || order.id.slice(0, 8).toUpperCase()
        const orderDateText = new Date(order.created_at).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
        const paymentText = order.payment_method || 'Razorpay'
        const statusText = order.status || 'Pending'
        const amountText = `INR ${Number(order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        
        doc.text(orderIdText, 18, nextY + 5.5)
        doc.text(orderDateText, 55, nextY + 5.5)
        doc.text(paymentText, 95, nextY + 5.5)
        
        if (statusText === 'Delivered') doc.setTextColor(22, 163, 74)
        else if (statusText === 'Pending') doc.setTextColor(180, 83, 9)
        else doc.setTextColor(37, 99, 235)
        
        doc.text(statusText, 135, nextY + 5.5)
        doc.setTextColor(30, 41, 59)
        
        doc.text(amountText, 192, nextY + 5.5, { align: 'right' })
        
        nextY += 8
      })
      
      doc.setDrawColor(226, 232, 240)
      doc.line(15, nextY, 195, nextY)
      
      nextY += 6
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Total Purchasing Summary:', 110, nextY)
      doc.text(`INR ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 192, nextY, { align: 'right' })
      
      doc.line(110, nextY + 1.5, 195, nextY + 1.5)
      doc.line(110, nextY + 2.2, 195, nextY + 2.2)

      // Print total amount in words
      nextY += 9
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      const amountInWords = convertNumberToWords(totalAmount)
      doc.text(`Amount in Words: ${amountInWords}`, 15, nextY)
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text('This monthly report is auto-generated by the Ashirwad Enterprises PepsiCo Distributor platform.', 15, 275)
    doc.text('For billing discrepancies or credit terms issues, please contact logistics support directly.', 15, 279)
    
    doc.text(`Page 1 of 1`, 195, 275, { align: 'right' })
    
    const filename = `PepsiCo_Monthly_Report_${monthName}_${year}.pdf`
    doc.save(filename)
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Two Column Layout - Offers & Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'minmax(0, 2fr) minmax(340px, 1fr)', gap: 20 }}>
        {/* Admin Offers Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            background: 'rgba(255, 253, 248, 0.95)',
            borderRadius: 32,
            border: '1px solid #eedfca',
            padding: isCompact ? 18 : 28,
            display: 'grid',
            gap: 18,
            boxShadow: '0 18px 34px rgba(57, 44, 27, 0.07)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: '"Nunito Sans", "Segoe UI", sans-serif' }}>Admin Offers</h3>
            <span style={{ fontSize: 13, color: '#9da9b8', fontWeight: 600 }}>Curated centrally — refreshed by the admin team</span>
          </div>

          {offersLoading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading offers…</div>
          ) : offersError ? (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>
              {offersError}
            </div>
          ) : offers.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {offers.map((offer, index) => {
                const discountValue = Number(offer.discountValue || 0)
                const discountLabel = offer.discountType === 'percent'
                  ? `${discountValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}% off`
                  : `INR ${discountValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })} off`

                const displayTitle = offer.productName || 'Exclusive Offer'

                return (
                  <div key={`${offer.id}-${index}`} style={{
                    padding: '24px',
                    borderRadius: '24px',
                    background: '#ffffff',
                    border: '1px solid #eedecc',
                    boxShadow: '0 8px 20px rgba(220, 190, 150, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Decorative accent light */}
                    <div style={{
                      position: 'absolute',
                      top: '-20px',
                      right: '-20px',
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #f29a2c 10%, transparent 70%)',
                      opacity: 0.15
                    }} />
                    
                    {/* Title and Top Right Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                        {displayTitle}
                      </h4>
                      {offer.discountType !== 'percent' && discountLabel && (
                        <span style={{
                          padding: '6px 14px',
                          borderRadius: '99px',
                          background: '#f29a2c',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 800,
                          boxShadow: '0 4px 10px rgba(242, 154, 44, 0.25)',
                          whiteSpace: 'nowrap'
                        }}>
                          {discountLabel.toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    {/* Message / Description */}
                    <div style={{
                      fontSize: '14px',
                      color: '#475569',
                      lineHeight: '1.6',
                      fontWeight: 500
                    }}>
                      {offer.message}
                    </div>

                    {/* Specs Box */}
                    <div style={{
                      background: '#fffdf9',
                      border: '1px solid #fbeed7',
                      borderRadius: '20px',
                      padding: '16px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '16px'
                    }}>
                      {/* Discount Type */}
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Discount Type</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                          {offer.discountType === 'percent' ? 'Percentage' : 'Flat'}
                        </div>
                      </div>
                      
                      {/* Value - only shown if NOT percent */}
                      {offer.discountType !== 'percent' ? (
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Value</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                            INR {discountValue.toLocaleString('en-IN')}
                          </div>
                        </div>
                      ) : (
                        <div />
                      )}
                      
                      {/* Min Spend */}
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Min. Spend</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                          INR {Number(offer.minimumAmount || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                      
                      {/* Validity */}
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Validity</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#b25e00', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ⌛ {getOfferValidity(offer.endAt)}
                        </div>
                      </div>
                    </div>

                    {/* Applied to badge */}
                    {offer.productName && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        background: '#eef2ff',
                        color: '#3730a3',
                        fontSize: '13px',
                        fontWeight: 700
                      }}>
                        <span>🏷️</span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Applied to: <strong style={{ color: '#1e1b4b' }}>{offer.productName}</strong>
                        </span>
                      </div>
                    )}

                    {/* Shop Button */}
                    <button
                      onClick={() => navigate('/dashboard/products')}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '16px',
                        background: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                        transition: 'all 0.2s ease',
                        marginTop: 'auto'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#1d4ed8'
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.3)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#2563eb'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)'
                        e.currentTarget.style.transform = 'none'
                      }}
                    >
                      🛒 Shop Product
                    </button>

                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{
              padding: isCompact ? '30px 18px' : '44px 36px',
              textAlign: 'center',
              borderRadius: 24,
              background: '#fffdfa',
              border: '2px dashed #f0cf9f'
            }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>🪔🎁</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8, lineHeight: 1.2 }}>No active festive offers right now</div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, maxWidth: 640, margin: '0 auto' }}>
                We're currently curating some exciting deals from Ashirwad Enterprises. Check back soon for exclusive distributor discounts!
              </div>
            </div>
          )}
        </motion.section>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            background: 'rgba(255, 253, 248, 0.95)',
            borderRadius: 32,
            border: '1px solid #eedfca',
            padding: isCompact ? 18 : 28,
            display: 'grid',
            gap: 16,
            boxShadow: '0 18px 34px rgba(57, 44, 27, 0.07)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: '"Nunito Sans", "Segoe UI", sans-serif' }}>Recent Activity</h3>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                navigate('/dashboard/orders')
              }}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#f29a2c',
                textDecoration: 'none',
                cursor: 'pointer',
                letterSpacing: '0.5px'
              }}
            >
              VIEW ALL
            </a>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {recentActivity.length === 0 ? (
              <div style={{
                padding: 20,
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 13
              }}>
                No recent activity yet
              </div>
            ) : (
              recentActivity.map((activity, idx) => {
                const badge = getStatusBadge(activity.status)
                const timeAgo = new Date(activity.timestamp)
                const now = new Date()
                const diffHours = Math.floor((now - timeAgo) / (1000 * 60 * 60))
                const diffDays = Math.floor((now - timeAgo) / (1000 * 60 * 60 * 24))
                const timeLabel = diffHours < 1 ? 'Just now' : diffHours < 24 ? `${diffHours}h ago` : `${diffDays}d ago`

                return (
                  <div key={activity.id} style={{ display: 'flex', gap: 12 }}>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      background: badge.bg,
                      color: badge.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      flexShrink: 0
                    }}>
                      {getActivityIcon(activity.status)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                          {activity.title}
                        </div>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 999,
                          fontSize: 9,
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color
                        }}>
                          {badge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                        {activity.details}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {timeLabel}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            <select
              value={selectedReportMonth}
              onChange={(e) => setSelectedReportMonth(e.target.value)}
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid #dce4ee',
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 600,
                color: '#43566d',
                background: '#ffffff',
                cursor: 'pointer',
                minWidth: 120
              }}
            >
              {availableMonths.length > 0 ? (
                availableMonths.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))
              ) : (
                <option value={`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`}>
                  {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </option>
              )}
            </select>
            <button
              onClick={handleDownloadReport}
              style={{
                flex: 1.5,
                padding: '14px 18px',
                border: '1px solid #dce4ee',
                background: '#fefefe',
                color: '#43566d',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
                borderRadius: 14
              }}
            >
              📄 Download PDF
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
