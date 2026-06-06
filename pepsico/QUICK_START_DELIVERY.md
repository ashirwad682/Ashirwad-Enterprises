# 🚀 Delivery Dashboard - Quick Start

## In 5 Minutes: Get Everything Running

### Step 1: Run Database Migration (1 min) ⚙️

```
1. Open Supabase Dashboard
2. Go to: Database → SQL Editor
3. Click: "+" (New Query)
4. Copy & Paste ALL of this:
```

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'prepaid' CHECK (payment_method IN ('COD', 'prepaid'));
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
COMMENT ON COLUMN orders.payment_method IS 'Payment method: COD (Cash on Delivery) or prepaid (Razorpay)';
```

```
5. Click: "RUN" (top right)
6. Wait for: ✓ Success
```

---

### Step 2: Start Backend (1 min) 🔧

```bash
cd backend
npm run dev
```

✓ Should show: `Server running on http://localhost:5001`

---

### Step 3: Start Frontend (1 min) 🎨

```bash
cd frontend
npm run dev
```

✓ Should show: `http://localhost:5173`

---

### Step 4: Create a COD Order (1 min) 📦

```
1. Open: http://localhost:5173
2. Login as customer
3. Add products to cart
4. Go to Checkout
5. Select: "💵 Cash on Delivery"
6. Click: "Place Order"
✓ Order created with payment_method='COD'
```

---

### Step 5: Test Delivery Workflow (1 min) 🚚

```
1. Login as Delivery Partner
2. Go to Dashboard
3. See order with "💵 COD" badge
4. Click: "🚀 Start Delivery"
5. Enter: Cash amount (e.g., 5000)
6. Click: "Validate"
7. Enter: OTP (from console or check database: 
   SELECT otp FROM delivery_otps ORDER BY created_at DESC LIMIT 1;)
8. Click: "Verify OTP"
✓ Order marked "✓ Delivered"
```

---

## What Should Work Now ✅

### Delivery Partner Dashboard Shows:
- [x] Order cards with all information
- [x] Address with pincode & district (not blank)
- [x] Payment type: "💵 COD" or "✓ Prepaid"
- [x] "🚀 Start Delivery" button for pending orders
- [x] "⏳ Validating..." for in-progress orders
- [x] "✓ Delivered" for completed orders
- [x] Stats (Total, Pending, Out for Delivery, Delivered)

### Workflow Works Correctly:
- [x] COD orders:
  - [x] Show "💵 COD" badge
  - [x] Show Cash Validation Modal first
  - [x] Then OTP Modal
  - [x] Then marked Delivered

- [x] Prepaid orders:
  - [x] Show "✓ Prepaid" badge
  - [x] Skip Cash Modal
  - [x] Show OTP Modal directly
  - [x] Then marked Delivered

---

## What Each Modal Does

### 💰 Cash Validation Modal (COD Only)
```
Ask: "Enter the cash amount received"
Input: Partner types amount (must equal bill)
Action: Saves cod_amount_received to database
Next: Opens OTP Modal
```

### 🔐 OTP Verification Modal (All Orders)
```
Ask: "Enter 6-digit OTP sent to customer's email"
Input: Partner enters OTP
Action: Verifies and marks order delivered
Next: Dashboard updates, order shows "✓ Delivered"
```

### 📋 View Journey Modal (Delivered Orders)
```
Show: Complete delivery timeline
Events:
  ✓ Order Packed
  ✓ Assigned to Partner
  ✓ Started Delivery
  ✓ Cash Validated (COD only)
  ✓ OTP Verified
  ✓ Delivered
```

---

## Testing Scenarios

### Test 1: COD Order (₹5000)
```bash
Steps:
1. Create order (COD)
2. Assign to partner
3. Partner clicks "Start Delivery"
4. Partner enters: 5000
5. Partner enters OTP
6. Order shows "✓ Delivered"

Expected:
✓ Address shows
✓ Type shows "💵 COD"
✓ Cash modal asks for amount
✓ OTP modal asks for code
✓ Dashboard stats update
```

### Test 2: Prepaid Order (₹3500)
```bash
Steps:
1. Create order (Razorpay - prepaid)
2. Assign to partner
3. Partner clicks "Start Delivery"
4. Partner enters OTP
5. Order shows "✓ Delivered"

Expected:
✓ Address shows
✓ Type shows "✓ Prepaid"
✓ NO cash modal (payment already received)
✓ OTP modal shows directly
✓ Dashboard stats update
```

---

## Quick Database Checks

### Check if migration worked:
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'payment_method';

-- Expected: payment_method, text, 'prepaid'::text
```

### Check orders created with correct payment_method:
```sql
SELECT id, total_amount, payment_method, status 
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;

-- Expected: payment_method = 'COD' or 'prepaid'
```

### Check delivery logs (audit trail):
```sql
SELECT order_id, event_type, event_details, created_at 
FROM delivery_logs 
ORDER BY created_at DESC 
LIMIT 5;

-- Expected: delivery_started, delivery_completed events
```

### Get OTP for testing:
```sql
SELECT otp, order_id, expires_at, verified 
FROM delivery_otps 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## Common Issues & Quick Fixes

### ❌ Address still not showing
```
Fix:
1. Backend → server.js line 36
2. Check: Query includes addresses relationship
3. If not: Add addresses(...) to select
4. Restart backend: npm run dev
```

### ❌ Payment type shows wrong
```
Fix:
1. Check Supabase: Does payment_method column exist?
2. If not: Run migration SQL again
3. Check Checkout.jsx: Passes payment_method to createOrder
4. Restart: npm run dev (both)
```

### ❌ Modals not showing
```
Fix:
1. Console errors? (F12 → Console tab)
2. Backend errors? (Check terminal)
3. Check state: showCashModal, showOTPModal set correctly
4. Try: Hard refresh (Cmd+Shift+R on Mac)
```

### ❌ OTP not sending
```
Fix:
1. Check: Backend email config
2. Check: Customer email in users table not null
3. Check: email-templates/otp.html exists
4. Try: npm run dev in backend
```

---

## Files to Check/Modify

| File | Purpose |
|------|---------|
| `database/ADD_PAYMENT_METHOD.sql` | Migration file |
| `backend/server.js` | Line 156: POST /api/orders accepts payment_method |
| `frontend/src/api/client.js` | Line 9: createOrder passes payment_method |
| `frontend/src/pages/Checkout.jsx` | Line 143, 200: Pass payment_method to createOrder |
| `frontend/src/pages/DeliveryPartnerDashboard.jsx` | Line 36: Query with addresses, Line 367: Check payment_method |
| `frontend/src/components/CashValidationModal.jsx` | Shows for COD orders |
| `frontend/src/components/OTPVerificationModal.jsx` | Shows for all orders |

---

## Monitoring

### Check if things are working:

**In Browser Console (F12):**
```javascript
// Check if orders loaded
console.log('Orders:', orders)

// Check if delivery partner set
console.log('Delivery Partner:', deliveryPartner)

// Check if modals trigger
console.log('Show Cash Modal:', showCashModal)
console.log('Show OTP Modal:', showOTPModal)
```

**In Backend Terminal:**
```
Look for:
✓ POST /api/orders called
✓ No 500 errors
✓ Database queries succeed
✓ Email sent for OTP
```

---

## Success Indicators ✅

- [x] Can create COD orders
- [x] Can create Razorpay orders
- [x] Dashboard loads without errors
- [x] Orders display with correct payment type
- [x] Address shows with full information
- [x] Start Delivery triggers correct modal
- [x] COD orders show cash validation first
- [x] Prepaid orders skip cash validation
- [x] OTP verification works
- [x] Order marked delivered after OTP
- [x] View Journey shows complete timeline
- [x] Stats update in real-time

---

## Still Having Issues?

1. **Check Logs:**
   - Backend console
   - Browser console (F12)
   - Supabase logs

2. **Verify Setup:**
   - Database migration ran successfully
   - Both services running (backend, frontend)
   - Environment variables set
   - Supabase connection working

3. **Test Manually:**
   ```sql
   -- Check payment_method column exists
   SELECT * FROM orders LIMIT 1;
   
   -- Check data is correct
   SELECT id, payment_method, delivery_status FROM orders;
   
   -- Check delivery partner logged in
   SELECT id, delivery_partner_id FROM delivery_partners LIMIT 1;
   ```

---

**You're all set!** 🎉

Your delivery dashboard is now fully functional with:
- ✅ Complete COD workflow
- ✅ Prepaid order handling
- ✅ Address display
- ✅ Payment type detection
- ✅ Cash validation (COD only)
- ✅ OTP verification (all orders)
- ✅ Delivery timeline tracking
