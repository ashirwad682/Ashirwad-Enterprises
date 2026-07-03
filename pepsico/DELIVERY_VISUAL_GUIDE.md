# 📊 Delivery Workflow - Visual Reference

## The Two Paths

```
CUSTOMER CHECKOUT
       ↓
   [Choose Payment]
      / \
     /   \
    ↓     ↓
  COD   RAZORPAY
   ↓     ↓
   
Order Created in Database:
├─ payment_method='COD'
└─ payment_method='prepaid'

       ↓ (Admin assigns to partner)
       
DELIVERY PARTNER DASHBOARD
       ↓
   [Sees Order Card]
   
COD CARD:                  PREPAID CARD:
Order: ABC123              Order: DEF456
Type: 💵 COD               Type: ✓ Prepaid
Status: 📍 Assigned        Status: 📍 Assigned
[🚀 Start]                [🚀 Start]
       ↓                          ↓
       │                          │
   [CASH MODAL]             (NO CASH MODAL)
   "Enter amount"                 │
   Must = ₹5000                   │
       │                          │
       └──→ ✓ Amount saved        │
           │                      │
           ↓                      ↓
        [OTP MODAL]           [OTP MODAL]
        "Enter 6-digit"       "Enter 6-digit"
           │                      │
           └──────→ ✓ Verified ←──┘
                    │
                    ↓
           🎉 DELIVERED
              Order saved:
           ├─ delivery_status='delivered'
           ├─ otp_verified=true
           ├─ cod_amount_received=5000 (COD only)
           └─ delivered_at=timestamp
```

---

## Step-by-Step: COD Order

```
STEP 1: CUSTOMER CHECKOUT
────────────────────────────────────
Frontend: Checkout.jsx (Line 143)
  ↓
Customer selects: "💵 Cash on Delivery"
  ↓
Click: "Place Order"
  ↓
API: POST /api/orders
  ↓
Backend: server.js (Line 156)
  ↓
Create order with:
  {
    user_id: "...",
    items: [...],
    total_amount: 5000,
    payment_method: "COD"  ← NEW!
  }
  ↓
Database: orders table
  ↓
ORDER CREATED ✓
payment_method = 'COD'


STEP 2: ADMIN ASSIGNMENT
────────────────────────────────────
Admin Dashboard
  ↓
Click: "Assign to Partner"
  ↓
API: PATCH /api/admin/orders/:id/assign
  ↓
Backend: server.js (Line 883)
  ↓
Update order:
  {
    delivery_partner_id: "...",
    delivery_status: "assigned"
  }
  ↓
Database: orders, delivery_logs
  ↓
ORDER ASSIGNED ✓


STEP 3: PARTNER SEES ORDER
────────────────────────────────────
Frontend: DeliveryPartnerDashboard.jsx
  ↓
loadAssignedOrders() query
  ↓
Supabase: SELECT *,
  users(...),
  addresses(...)  ← FETCH ADDRESS!
  ↓
Component State:
  {
    id: "ABC123",
    total_amount: 5000,
    payment_method: "COD",  ← CHECK THIS
    delivery_status: "assigned",
    users: { full_name: "John" },
    addresses: [{ address_line: "..." }]
  }
  ↓
OrderCard Component
  ↓
Check: isCOD = (payment_method === 'COD')
  ↓
Displays:
  ┌─────────────────────────┐
  │ Order: ABC123           │
  │ Customer: John Doe      │
  │ Type: 💵 COD ← SHOWS! │
  │ Address: [Full details] │
  │ Amount: ₹5000           │
  │ Status: 📍 Assigned     │
  │ [🚀 Start Delivery]     │
  └─────────────────────────┘


STEP 4: PARTNER STARTS DELIVERY
────────────────────────────────────
Partner clicks: "🚀 Start Delivery"
  ↓
handleStartDelivery() function (Line 95)
  ↓
Update database:
  delivery_status = 'out_for_delivery'
  ↓
Check payment_method:
  if (payment_method === 'COD') {
    setShowCashModal(true)  ← CASH FIRST!
  } else {
    setShowOTPModal(true)
  }
  ↓
CASH VALIDATION MODAL APPEARS


STEP 5: CASH VALIDATION (COD ONLY)
────────────────────────────────────
Modal shown:
  ┌──────────────────────────────────┐
  │ Confirm Delivery                 │
  │                                  │
  │ Type: 💵 Cash on Delivery        │
  │ Bill Amount: ₹5000               │
  │ Cash Received: [____] ← Input!   │
  │                                  │
  │ [Cancel] [Validate]              │
  └──────────────────────────────────┘
  ↓
Partner types: 5000
  ↓
handleCashValidation() (Line 139)
  ↓
Check: cashReceived === total_amount
  ✓ 5000 === 5000 → Success!
  ✗ 4500 === 5000 → Error: "must equal"
  ↓
(If correct) Update database:
  cod_amount_received = 5000
  ↓
Close Cash Modal
  ↓
setShowOTPModal(true)


STEP 6: OTP VERIFICATION
────────────────────────────────────
Modal shown:
  ┌──────────────────────────────────┐
  │ Confirm with OTP                 │
  │                                  │
  │ 💰 Cash: ✓ ₹5000                │
  │                                  │
  │ OTP sent to: john@email.com      │
  │ Enter code: [_ _ _ _ _ _]        │
  │                                  │
  │ [Cancel] [Verify]                │
  └──────────────────────────────────┘
  ↓
Backend sends OTP to email
  ↓
Customer gets email with: 456789
  ↓
Partner asks customer for OTP
  ↓
Partner types: 456789
  ↓
handleOTPVerified() (Line 154)
  ↓
Verify OTP matches database
  ✓ Correct → Proceed
  ✗ Wrong → Error: "Invalid OTP"
  ↓
(If correct) Update database:
  {
    delivery_status: 'delivered',
    otp_verified: true,
    delivered_at: timestamp,
    delivery_confirmed_by: partner_id
  }


STEP 7: ORDER MARKED DELIVERED
────────────────────────────────────
Modal closes
  ↓
Dashboard refreshes
  ↓
loadAssignedOrders() query runs
  ↓
Order card updates:
  ┌─────────────────────────────────┐
  │ Order: ABC123                   │
  │ Customer: John Doe              │
  │ Type: 💵 COD                    │
  │ Address: [Details]              │
  │ Amount: ₹5000                   │
  │ Cash: ✓ ₹5000 ← Shows amount! │
  │ Status: ✓ Delivered             │
  │ [📋 View Journey]               │
  └─────────────────────────────────┘
  ↓
Stats update:
  Delivered: +1
  Pending: -1


STEP 8: VIEW JOURNEY (OPTIONAL)
────────────────────────────────────
Partner clicks: "📋 View Journey"
  ↓
DeliveryJourneyModal opens
  ↓
Query: SELECT FROM delivery_logs
  ↓
Shows timeline:
  ◉ 📦 PACKED
    Created: 10:00 AM
    ━━━━━━━━━━
  
  ◉ 🚚 DISPATCHED
    Assigned: 10:30 AM
    ━━━━━━━━━━
  
  ◉ 🛵 OUT FOR DELIVERY
    Started: 1:00 PM
    ━━━━━━━━━━
  
  ◉ ✅ CASH VALIDATED
    Amount: ₹5000 ✓
    Time: 2:10 PM
    ━━━━━━━━━━
  
  ◉ 🎉 DELIVERED
    Confirmed: 2:30 PM
    OTP: Verified
```

---

## Step-by-Step: Prepaid Order

```
(Steps 1-3 same as COD)

STEP 4: PARTNER STARTS DELIVERY
────────────────────────────────────
Partner clicks: "🚀 Start Delivery"
  ↓
handleStartDelivery() function
  ↓
Update database:
  delivery_status = 'out_for_delivery'
  ↓
Check payment_method:
  if (payment_method === 'COD') {
    setShowCashModal(true)
  } else {
    setShowOTPModal(true)  ← NO CASH, GO STRAIGHT TO OTP
  }
  ↓
OTP VERIFICATION MODAL APPEARS DIRECTLY


STEP 5: OTP VERIFICATION (NO CASH FIRST)
────────────────────────────────────
Modal shown:
  ┌──────────────────────────────────┐
  │ Confirm with OTP                 │
  │                                  │
  │ ✓ Payment received (Razorpay)   │
  │                                  │
  │ OTP sent to: john@email.com      │
  │ Enter code: [_ _ _ _ _ _]        │
  │                                  │
  │ [Cancel] [Verify]                │
  └──────────────────────────────────┘
  ↓
(Rest same as COD)


STEP 6: ORDER MARKED DELIVERED (PREPAID)
────────────────────────────────────
Order card updates:
  ┌─────────────────────────────────┐
  │ Order: DEF456                   │
  │ Customer: Jane Doe              │
  │ Type: ✓ Prepaid                 │
  │ Address: [Details]              │
  │ Amount: ₹3500                   │
  │ Status: ✓ Delivered             │
  │ [📋 View Journey]               │
  └─────────────────────────────────┘
  ↓
(No "Cash Received" because prepaid)


STEP 7: VIEW JOURNEY (PREPAID)
────────────────────────────────────
Timeline shows:
  ◉ 📦 PACKED
  ◉ 🚚 DISPATCHED
  ◉ 🛵 OUT FOR DELIVERY
  ◉ 🎉 DELIVERED  ← NO ✅ CASH VALIDATED
    (Prepaid, so no cash validation step)
```

---

## Database Tables Involved

```
┌─ ORDERS TABLE ─────────────────────┐
│                                    │
│ id: ABC123                         │
│ user_id: ...                       │
│ total_amount: 5000                 │
│ payment_method: 'COD' ← NEW!      │ ← NEW!
│ delivery_partner_id: ...           │
│ delivery_status: 'delivered'       │
│ cod_amount_received: 5000 ← COD!  │
│ otp_verified: true                 │
│ delivered_at: 2025-12-26T14:30    │
│ delivery_confirmed_by: ...         │
│                                    │
└────────────────────────────────────┘

┌─ DELIVERY_LOGS TABLE ──────────────┐
│                                    │
│ id: 1                              │
│ order_id: ABC123                   │
│ event_type: 'delivery_started'    │
│ created_at: 2025-12-26T13:00      │
│                                    │
│ id: 2                              │
│ order_id: ABC123                   │
│ event_type: 'delivery_completed'  │
│ created_at: 2025-12-26T14:30      │
│                                    │
└────────────────────────────────────┘

┌─ DELIVERY_OTPS TABLE ──────────────┐
│                                    │
│ id: 1                              │
│ order_id: ABC123                   │
│ otp: '456789'                      │
│ expires_at: 2025-12-26T14:35      │
│ verified: true                     │
│                                    │
└────────────────────────────────────┘
```

---

## Key Differences Summary

```
FEATURE              COD                PREPAID
─────────────────────────────────────────────────────
Payment Method      'COD'               'prepaid'
Badge               💵 COD              ✓ Prepaid
Cash Validation     ✅ YES              ❌ NO
Modal Sequence      Cash → OTP          OTP only
cod_amount_received Filled (₹)          NULL
Payment Already Received  ❌ NO          ✅ YES
Delivery Logs       +1 event            Normal events
```

---

## Color Codes & Icons

```
Status Badges:
  ⏳ Pending           (Gray)
  📍 Assigned          (Blue)
  🚚 Out for Delivery  (Purple)
  ✓ Delivered         (Green)

Payment Types:
  💵 COD              (Orange/Yellow)
  ✓ Prepaid           (Green)

Delivery Stages:
  📦 Packed
  🚚 Dispatched
  🛵 Out for Delivery
  🎉 Delivered

Actions:
  🚀 Start Delivery
  ⏳ Validating...
  📋 View Journey
```

---

## Error Prevention

```
✓ Can't deliver without start
✓ Can't skip cash (COD)
✓ Can't enter wrong cash amount
✓ Can't verify wrong OTP
✓ Can't access other partner's orders
✓ All events logged in delivery_logs
```

---

This is the complete delivery workflow! 🎉
