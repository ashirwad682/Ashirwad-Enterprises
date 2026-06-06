# Delivery Partner Dashboard - Complete Documentation

## 🚚 Overview

The Delivery Partner Dashboard is a secure, role-based system for managing delivery operations. Delivery partners receive orders assigned by admins and use this dashboard to confirm deliveries with strict validation:

1. **COD Cash Validation** - Verify exact amount received
2. **OTP Verification** - Confirm customer identity via email OTP
3. **Delivery Logging** - Audit trail for all transactions

---

## 👥 Role-Based Access Model

| Role | Access | Login Route | Dashboard |
|------|--------|------------|-----------|
| **Admin** | Full control | `/admin/login` | `/admin/dashboard` |
| **User** | Browse & order | `/login` | `/dashboard` |
| **Delivery Partner** | Manage deliveries | `/delivery-login` | `/delivery-dashboard` |

---

## 🔐 Delivery Partner Account Creation (Admin-Controlled)

### ✅ Key Rule: No Self-Registration
Delivery partners **cannot self-register**. Only admins can create accounts.

### Admin Creates Account

```bash
POST /api/delivery/admin/create
Headers: x-admin-key: ADMIN_API_KEY
Body: {
  "name": "John Doe",
  "email": "john@example.com",
  "mobileNumber": "9876543210",
  "assignedArea": "Sector 5, Delhi"
}

Response: {
  "success": true,
  "deliveryPartner": {
    "id": "uuid",
    "delivery_partner_id": "DP-1735236545000-1234",
    "name": "John Doe",
    "email": "john@example.com",
    "assigned_area": "Sector 5, Delhi",
    "status": "active"
  },
  "tempPassword": "abc12345"
}
```

**System-Generated:**
- ✅ `delivery_partner_id` - Unique, immutable identifier (DP-TIMESTAMP-RANDOM)
- ✅ Login credentials sent to email
- ✅ Temporary password for first login

---

## 🔑 Login Flow

### Login Page (Single Login Form - Role Auto-Detection)

```
Email: john@example.com
Password: ••••••••

System detects role from database:
- Admin → Admin Dashboard
- User → User Dashboard
- Delivery Partner → Delivery Partner Dashboard
```

**Frontend:** `/delivery-login` (Delivery Partner specific route)

---

## 📊 Dashboard Overview

### Header Section
```
┌─────────────────────────────────────────────────┐
│ DELIVERY PARTNER                                │
│ Welcome, John Doe                               │
│ ID: DP-1735236545000-1234                       │
│ Area: Sector 5, Delhi                           │
│                                              [Logout]
└─────────────────────────────────────────────────┘

Stats Cards:
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Total Orders │   Pending    │ Delivered    │ COD Collected│
│      24      │      3       │      5       │  ₹12,500.00  │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### Assigned Orders List

Each order shows:
- **Order ID** - First 8 chars of UUID
- **Customer Name** - Full name
- **Delivery Address** - Complete address
- **Order Type** - COD (💵) or Prepaid (✓)
- **Total Amount** - Bill amount in ₹
- **Status** - Pending / Out for Delivery / Delivered
- **Actions** - Start Delivery button (visible only for pending orders)

---

## 🔄 Secure Delivery Confirmation Workflow

### Step 1️⃣: Start Delivery

**Delivery Partner Action:**
```
Click "Start Delivery" on order card
↓
Order status → "Out for Delivery"
↓
Automatically shows Cash Validation Modal
```

### Step 2️⃣: COD Cash Validation (If Applicable)

**Only for COD Orders:**

```
┌────────────────────────────────────┐
│ Confirm Delivery                   │
├────────────────────────────────────┤
│ Order Type: 💵 Cash on Delivery    │
│                                    │
│ Total Bill Amount: ₹5,000.00       │
│                                    │
│ Cash Received (₹): [____________]  │
│                                    │
│                    [Cancel] [Verify]│
└────────────────────────────────────┘
```

**Validation Logic:**
```javascript
if (order.order_type === 'COD') {
  if (cashReceived !== totalAmount) {
    ❌ Error: "Cash received must equal total bill amount."
    // User must correct amount
  }
  // If matched → proceed to OTP
}

if (order.order_type === 'Prepaid') {
  // Skip cash validation → go straight to OTP
}
```

### Step 3️⃣: OTP Verification (Mandatory for ALL)

**System Sends OTP:**
- OTP sent to customer's registered email
- OTP validity: **5 minutes**
- 6-digit numeric code

**Delivery Partner Action:**
```
┌────────────────────────────────────┐
│ Verify OTP                         │
├────────────────────────────────────┤
│ 📧 OTP sent to: customer@email.com │
│                                    │
│ Enter 6-Digit OTP: [0][0][0][0][0]│[0]
│                                    │
│ OTP expires in 5 minutes           │
│                                    │
│         [Cancel] [Verify OTP]      │
│                                    │
│      [Resend OTP] (in 45s...)      │
└────────────────────────────────────┘
```

**OTP Verification Responses:**
```
❌ Invalid OTP:
   "Invalid or expired OTP. Please try again."

✅ Valid OTP:
   "OTP verified successfully. 
    You may now complete the delivery."

❌ Expired OTP:
   "OTP has expired. Request a new one."
```

### Step 4️⃣: Mark as Delivered

**Button Becomes Active Only After:**
✅ COD amount validated (if applicable)
✅ OTP verified successfully

**On Success:**
```
✓ Order status → "Delivered"
✓ Timestamp saved
✓ Delivery Partner ID logged
✓ COD amount recorded (if COD)
✓ Success message: "Order marked as delivered successfully."
```

---

## 📋 Delivery Status Rules (Strict)

| Condition | Can Mark Delivered? | Error Message |
|-----------|-------------------|---------------|
| OTP not verified | ❌ No | "OTP verification required" |
| COD cash mismatch | ❌ No | "Cash received must equal total" |
| OTP expired | ❌ No | "OTP has expired" |
| ✅ OTP verified + cash matched | ✅ YES | — |

---

## 📧 Notifications & Emails

### Customer Emails

1. **OTP for Delivery Confirmation**
   ```
   Subject: Delivery Confirmation - Your OTP
   Body: 
   Your delivery is on the way!
   Confirmation OTP: 123456
   Valid for: 5 minutes
   ```

2. **Delivery Success Confirmation**
   ```
   Subject: Order Delivered Successfully
   Body:
   Your order has been delivered.
   Order ID: xxxx-xxxx
   Amount Paid: ₹5,000.00
   ```

### Admin Notifications

- Order delivered
- COD amount collected
- Daily delivery summary (cron job)

---

## 🔒 Security & Audit Logging

Every delivery logs:

| Field | Example | Purpose |
|-------|---------|---------|
| `order_id` | UUID | Which order |
| `delivery_partner_id` | DP-timestamp-random | Who delivered |
| `event_type` | "delivery_completed" | What happened |
| `timestamp` | 2025-12-26 10:30:00 | When it happened |
| `cod_amount` | 5000.00 | Money collected |
| `event_details` | JSON | Extra metadata |

---

## 🗄️ Database Schema

### delivery_partners Table
```sql
id                    UUID PRIMARY KEY
delivery_partner_id   TEXT UNIQUE (e.g., DP-1735236545000-1234)
name                  TEXT NOT NULL
email                 TEXT UNIQUE NOT NULL
password_hash         TEXT NOT NULL
mobile_number         TEXT NOT NULL
assigned_area         TEXT NOT NULL
status                TEXT (active/inactive)
created_by            UUID (admin who created)
created_at            TIMESTAMP
updated_at            TIMESTAMP
```

### orders Table (New Columns)
```sql
delivery_partner_id   UUID (FK to delivery_partners)
delivery_status       TEXT (pending/out_for_delivery/delivered)
cod_amount_received   DECIMAL (for COD orders)
otp_verified          BOOLEAN
delivered_at          TIMESTAMP
delivery_confirmed_by UUID (delivery_partner_id)
```

### delivery_otps Table
```sql
id                    UUID PRIMARY KEY
order_id              UUID (FK to orders)
otp                   TEXT (6-digit code)
expires_at            TIMESTAMP (5 min from creation)
verified              BOOLEAN
verified_at           TIMESTAMP
created_at            TIMESTAMP
```

### delivery_logs Table (Audit Trail)
```sql
id                    UUID PRIMARY KEY
order_id              UUID
delivery_partner_id   UUID
event_type            TEXT (delivery_started/delivery_completed)
event_details         JSONB (metadata)
ip_address            TEXT (optional)
created_at            TIMESTAMP
```

---

## 🔌 API Endpoints

### Delivery Partner Routes

#### Create Account (Admin Only)
```bash
POST /api/delivery/admin/create
Headers: x-admin-key: ADMIN_API_KEY
```

#### Get Assigned Orders
```bash
GET /api/delivery/assigned-orders/:dpId
Headers: x-delivery-partner-id: dpId
```

#### Start Delivery
```bash
PATCH /api/delivery/start-delivery/:orderId
Headers: x-delivery-partner-id: dpId
```

#### Send OTP
```bash
POST /api/delivery/send-otp
Body: { orderId, customerEmail, otp }
```

#### Verify OTP
```bash
POST /api/delivery/verify-otp
Body: { orderId, otp, dpId }
```

#### Mark as Delivered
```bash
PATCH /api/delivery/mark-delivered/:orderId
Headers: x-delivery-partner-id: dpId
Body: { codAmountReceived }
```

#### Get Stats
```bash
GET /api/delivery/stats/:dpId
Headers: x-delivery-partner-id: dpId
```

---

## 🛣️ Routes & Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/delivery-login` | `DeliveryPartnerLogin.jsx` | Login page |
| `/delivery-dashboard` | `DeliveryPartnerDashboard.jsx` | Main dashboard |
| Protected by: `DeliveryPartnerProtectedRoute.jsx` | — | Route guard |

---

## 🧪 Testing Checklist

- [ ] Admin can create delivery partner account
- [ ] Delivery partner receives login credentials
- [ ] Delivery partner can login with email/password
- [ ] Dashboard shows assigned orders
- [ ] Stats cards update correctly
- [ ] "Start Delivery" changes status to "Out for Delivery"
- [ ] Cash validation modal appears for COD
- [ ] Cash amount must match exactly
- [ ] OTP sent to customer email
- [ ] OTP validated within 5 minutes
- [ ] Order marked as delivered
- [ ] Audit log created
- [ ] Customer receives success email
- [ ] Admin can see delivery logs

---

## 🚨 Error Messages (Exact)

| Scenario | Error Message |
|----------|---------------|
| Cash mismatch | "Cash received must be equal to the total bill amount." |
| OTP not sent | "Failed to send OTP. Please try again." |
| Invalid OTP | "Invalid or expired OTP. Please try again." |
| Expired OTP | "OTP has expired. Please request a new one." |
| No OTP verification | "OTP verification required before delivery" |
| Missing fields | "Missing required fields" |
| Unauthorized access | "Unauthorized" |

---

## 🎯 Business Logic Summary

**One-Line Rule:**
> A delivery partner can mark an order as delivered only after:
> 1. COD cash verification (if applicable)
> 2. Successful OTP validation sent to customer's email
> With delivery partner identity fully controlled by the admin

---

## 📝 Implementation Status

✅ **Database Schema** - Complete
✅ **Backend API Routes** - Complete
✅ **Frontend Context** - Complete
✅ **Protected Routes** - Complete
✅ **Login Page** - Complete
✅ **Dashboard** - Complete
✅ **Cash Validation Modal** - Complete
✅ **OTP Verification Modal** - Complete
✅ **Audit Logging** - Complete
✅ **App.jsx Routes** - Integrated

---

## 🚀 Next Steps

1. Run database migrations
2. Test with sample delivery partners
3. Configure email for OTP sending
4. Deploy and monitor

---

Generated: December 26, 2025  
Version: 1.0 - Complete Implementation
