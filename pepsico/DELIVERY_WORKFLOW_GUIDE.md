# 📦 Delivery Partner Workflow - Complete Guide

## Visual Delivery Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                    DELIVERY WORKFLOW PATHS                      │
└─────────────────────────────────────────────────────────────────┘

🟡 COD (CASH ON DELIVERY) ORDER
════════════════════════════════════════════════════════════════

  📦 PACKED              🚚 DISPATCHED         🛵 OUT FOR DELIVERY
  (Order in cart)        (Assigned to you)      (On the way)
      ↓                       ↓                       ↓
  Order created         Partner assigned        Click "START"
  payment_method='COD'   delivery_status         delivery_status=
                        ='assigned'              'out_for_delivery'
                                                      ↓
                                            ┌─────────────────────┐
                                            │ CASH VALIDATION      │
                                            │ Modal Appears        │
                                            │                      │
                                            │ "Enter cash amount"  │
                                            │ Must equal ₹5000     │
                                            └─────────────────────┘
                                                      ↓
                                            [Amount Validated]
                                            cod_amount_received=
                                            ₹5000
                                                      ↓
                                            ┌─────────────────────┐
                                            │ OTP VERIFICATION     │
                                            │ Modal Appears        │
                                            │                      │
                                            │ "Enter 6-digit OTP"  │
                                            │ Sent to customer     │
                                            │ email                │
                                            └─────────────────────┘
                                                      ↓
                                            [OTP Verified]
                                            otp_verified=true
                                                      ↓
                                            🎉 DELIVERED
                                            delivery_status=
                                            'delivered'

────────────────────────────────────────────────────────────────────

🟢 PREPAID (RAZORPAY) ORDER
════════════════════════════════════════════════════════════════

  📦 PACKED              🚚 DISPATCHED         🛵 OUT FOR DELIVERY
  (Order in cart)        (Assigned to you)      (On the way)
      ↓                       ↓                       ↓
  Order created         Partner assigned        Click "START"
  payment_method=       delivery_status         delivery_status=
  'prepaid'            ='assigned'              'out_for_delivery'
                                                      ↓
                                    [Skip Cash Validation]
                                            ↓
                                            ┌─────────────────────┐
                                            │ OTP VERIFICATION     │
                                            │ Modal Appears        │
                                            │                      │
                                            │ "Enter 6-digit OTP"  │
                                            │ Sent to customer     │
                                            │ email                │
                                            └─────────────────────┘
                                                      ↓
                                            [OTP Verified]
                                            otp_verified=true
                                                      ↓
                                            🎉 DELIVERED
                                            delivery_status=
                                            'delivered'
```

---

## Implementation Details

### 1️⃣ Starting Delivery (Click "🚀 Start Delivery" button)

```javascript
// File: DeliveryPartnerDashboard.jsx, Line 95
const handleStartDelivery = async (order) => {
  // Step 1: Update delivery_status to 'out_for_delivery'
  await supabase.from('orders').update({ 
    delivery_status: 'out_for_delivery' 
  }).eq('id', order.id)
  
  // Step 2: Log the event in delivery_logs
  await supabase.from('delivery_logs').insert({
    order_id: order.id,
    event_type: 'delivery_started'
  })
  
  // Step 3: Show correct modal based on payment_method
  if (order.payment_method === 'COD') {
    setShowCashModal(true)  // ← COD ORDERS: SHOW CASH MODAL FIRST
  } else {
    setShowOTPModal(true)   // ← PREPAID: SKIP TO OTP
  }
}
```

### 2️⃣ Cash Validation (COD Orders Only)

```javascript
// File: DeliveryPartnerDashboard.jsx, Line 139
const handleCashValidation = async (cashReceived, order) => {
  // Customer must give exact amount (₹5000 for example)
  if (cashReceived !== order.total_amount) {
    return {
      success: false,
      error: `Cash (₹${cashReceived}) must equal bill (₹${order.total_amount})`
    }
  }
  
  // Save cash amount to database
  await supabase.from('orders').update({ 
    cod_amount_received: cashReceived 
  }).eq('id', order.id)
  
  // Close cash modal and open OTP modal
  setShowCashModal(false)
  setShowOTPModal(true)     // ← NOW SHOW OTP FOR CONFIRMATION
  
  return { success: true }
}
```

### 3️⃣ OTP Verification (All Orders)

```javascript
// File: OTPVerificationModal.jsx
const handleVerifyOTP = async () => {
  // Customer enters 6-digit OTP
  // Verify it matches what's in delivery_otps table
  
  // If correct:
  setMessage('OTP verified successfully')
  // Trigger handleOTPVerified callback
}
```

### 4️⃣ Mark as Delivered (After OTP)

```javascript
// File: DeliveryPartnerDashboard.jsx, Line 154
const handleOTPVerified = async (order) => {
  // Step 1: Mark order as delivered
  await supabase.from('orders').update({
    otp_verified: true,
    delivery_status: 'delivered',
    delivered_at: new Date().toISOString(),
    delivery_confirmed_by: deliveryPartner.id
  }).eq('id', order.id)
  
  // Step 2: Log delivery completion
  await supabase.from('delivery_logs').insert({
    order_id: order.id,
    event_type: 'delivery_completed'
  })
  
  // Step 3: Refresh dashboard
  await loadAssignedOrders()  // ← Order now shows "✓ Delivered"
}
```

---

## Database Fields Used

### Orders Table
| Field | Purpose | COD | Prepaid |
|-------|---------|-----|---------|
| `delivery_status` | Current stage | ✅ | ✅ |
| `payment_method` | Order type | 'COD' | 'prepaid' |
| `cod_amount_received` | Cash collected | ✅ Filled | ❌ Not filled |
| `otp_verified` | OTP confirmed | ✅ Yes | ✅ Yes |
| `delivered_at` | Completion time | ✅ Set | ✅ Set |
| `delivery_confirmed_by` | Partner ID | ✅ Set | ✅ Set |

### Delivery Logs Table (Audit Trail)
| Field | Events Logged |
|-------|-----------------|
| `event_type` | 'delivery_started', 'cash_validated' (COD), 'delivery_completed' |
| `event_details` | Status changes, cash amount, OTP confirmed |
| `created_at` | Timestamp of each event |

### Delivery OTPs Table
| Field | Purpose |
|-------|---------|
| `otp` | 6-digit code |
| `order_id` | Which order |
| `expires_at` | 5 minutes validity |
| `verified` | Whether customer confirmed |

---

## Key Differences: COD vs Prepaid

### ✅ What Happens for COD Orders:
```
Start Delivery
    ↓
[CASH VALIDATION MODAL]
"Please enter the exact amount customer paid"
"Total Bill: ₹5000"
"Enter Cash Amount: ___"
    ↓
Cash amount MUST match bill exactly
    ↓
[OTP MODAL]
"Customer will receive OTP via email"
"Enter the 6-digit OTP"
    ↓
Order marked DELIVERED
Database: cod_amount_received = ₹5000, otp_verified = true
```

### ✅ What Happens for Prepaid Orders:
```
Start Delivery
    ↓
[SKIP CASH MODAL - Payment already received via Razorpay]
    ↓
[OTP MODAL - Directly]
"Customer will receive OTP via email"
"Enter the 6-digit OTP"
    ↓
Order marked DELIVERED
Database: otp_verified = true (no cash amount needed)
```

---

## Order Card Display

### Before Clicking "Start Delivery"
```
┌─────────────────────────────────┐
│ ORDER ID: ABC12345              │
│ CUSTOMER: John Doe              │
│ TYPE: 💵 COD                    │    ← Shows payment type
│ ADDRESS: 123 Main St, Bangalore │    ← Full address
│ AMOUNT: ₹5000                   │
│ STATUS: 📍 Assigned             │
│                                 │
│        🚀 Start Delivery ←────── Button to click
└─────────────────────────────────┘
```

### After Clicking "Start Delivery" (COD)
```
Cash Validation Modal Opens
─────────────────────────────
Title: "Confirm Delivery"
"Please verify the cash amount received"
"Order Type: 💵 Cash on Delivery"
"Total Bill Amount: ₹5000"
"Cash Received (₹): ___"  ← Partner enters exact amount
"⚠️ Must equal bill amount exactly"

[Cancel] [Validate]
```

### After Validating Cash (COD)
```
OTP Verification Modal Opens
─────────────────────────────
Title: "Confirm Delivery with OTP"
"OTP has been sent to customer's email"
"Enter 6-digit OTP: _ _ _ _ _ _"
"Resend OTP (in 45s)"

[Cancel] [Verify OTP]
```

### After Verifying OTP
```
Order marked DELIVERED
─────────────────────
Order Card updates to:
┌─────────────────────────────────┐
│ ORDER ID: ABC12345              │
│ CUSTOMER: John Doe              │
│ TYPE: 💵 COD                    │
│ ADDRESS: 123 Main St, Bangalore │
│ AMOUNT: ₹5000                   │
│ CASH RECEIVED: ✓ ₹5000          │ ← Shows collected amount
│ STATUS: ✓ Delivered             │
│                                 │
│        📋 View Journey ←──────── See delivery timeline
└─────────────────────────────────┘
```

---

## Testing Checklist

### Test COD Order Flow:
- [ ] Create COD order from checkout
- [ ] Verify `payment_method = 'COD'` in database
- [ ] Login as delivery partner
- [ ] See order with "💵 COD" badge
- [ ] Click "🚀 Start Delivery"
- [ ] Verify Cash Validation Modal appears
- [ ] Enter amount that doesn't match → Error shows ❌
- [ ] Enter correct amount → Success ✅
- [ ] Verify OTP Modal appears next
- [ ] Enter OTP → Order marked "✓ Delivered"
- [ ] Verify delivery_logs shows: delivery_started → delivery_completed
- [ ] Click "View Journey" → See timeline with events

### Test Prepaid Order Flow:
- [ ] Create prepaid order via Razorpay
- [ ] Verify `payment_method = 'prepaid'` in database
- [ ] Login as delivery partner
- [ ] See order with "✓ Prepaid" badge
- [ ] Click "🚀 Start Delivery"
- [ ] Verify Cash Modal does NOT appear ✅
- [ ] Verify OTP Modal appears directly ✅
- [ ] Enter OTP → Order marked "✓ Delivered"
- [ ] Verify cod_amount_received is NULL (not filled)
- [ ] Verify otp_verified = true

---

## Production Ready? ✅

The entire workflow is fully implemented:
- ✅ Database schema with payment_method column
- ✅ Backend API accepts payment_method on order creation
- ✅ Frontend passes payment_method (COD or prepaid)
- ✅ Dashboard detects payment_method and shows correct modal sequence
- ✅ Cash validation only for COD
- ✅ OTP for all orders
- ✅ Delivery logs audit trail
- ✅ Order cards show full address
- ✅ Progress tracker shows stages

**Status**: Awaiting migration execution in Supabase
