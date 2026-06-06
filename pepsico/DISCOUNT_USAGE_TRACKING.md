# Coupon & Offer Usage Tracking - Complete Implementation

## Overview
This implementation ensures that each user can only use a coupon or offer **once per account**. After placing an order with a discount, the system tracks the usage and prevents the same discount from being applied again.

## Features Implemented

### 1. **Database Tables**
- ✅ `coupon_usages` - Tracks which coupons each user has used
- ✅ `offer_usages` - Tracks which auto-applied offers each user has used

### 2. **Backend Logic**
- ✅ Check coupon usage before validation
- ✅ Check offer usage before allowing offer application
- ✅ Record coupon usage when order is successfully created
- ✅ Record offer usage when order is successfully created
- ✅ Return appropriate error messages for already-used discounts

### 3. **Frontend Integration**
- ✅ Pass user_id when fetching offers (filters out used offers)
- ✅ Pass offer_id when creating orders
- ✅ Handle "COUPON_ALREADY_USED" error messages
- ✅ Handle "OFFER_ALREADY_USED" error messages
- ✅ Show detailed discount breakdown (auto-offer vs coupon)

## Installation Steps

### Step 1: Run Database Migration
Execute the following SQL in your Supabase SQL Editor:

```bash
# Navigate to project directory
cd /Users/ashirwadk/Project/pepsico/database

# Run the migration in Supabase SQL Editor
# Copy and paste the contents of ADD_OFFER_USAGE_TABLE.sql
```

**File:** `database/ADD_OFFER_USAGE_TABLE.sql`

This creates:
- `offer_usages` table with user_id, offer_id, order_id, used_at
- Unique constraint preventing duplicate usage
- Indexes for fast lookup
- Row Level Security policies

### Step 2: Verify Tables Exist

Run this query in Supabase SQL Editor to verify both tables exist:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('coupon_usages', 'offer_usages');
```

Expected result: Both `coupon_usages` and `offer_usages` should be listed.

### Step 3: Restart Backend Server

```bash
cd /Users/ashirwadk/Project/pepsico/backend
npm run dev
```

The backend will now:
- Filter out used offers when user requests offers
- Check usage before creating orders
- Save usage records after successful orders

### Step 4: Test the Implementation

#### A. Test Coupon Usage Tracking

1. **First Use (Should Work)**
   - Login as a user
   - Add products to cart
   - Go to checkout
   - Apply coupon code (e.g., "SAVE10")
   - Complete the order
   - ✅ Order should be created successfully

2. **Second Use (Should Fail)**
   - Add more products to cart
   - Go to checkout
   - Try to apply the same coupon ("SAVE10")
   - ❌ Should show: "You have already used this coupon. Each coupon can only be used once per user."

#### B. Test Offer Usage Tracking

1. **First Use (Should Work)**
   - Login as a user
   - Add products that qualify for an auto-offer
   - Go to checkout
   - Offer should auto-apply
   - Complete the order
   - ✅ Order should be created successfully

2. **Second Use (Should Not Show)**
   - Add more products to cart
   - Go to checkout
   - The previously used offer should NOT appear in the offers list
   - If somehow it still applies, order creation will fail with "OFFER_ALREADY_USED"

## How It Works

### Coupon Flow

```
User applies coupon
    ↓
Frontend: validateCoupon(code, total, items, user_id)
    ↓
Backend: Check coupon_usages table
    ↓
If already used → Return { valid: false, reason: "COUPON_ALREADY_USED" }
    ↓
If not used → Validate coupon rules → Return discount
    ↓
User places order
    ↓
Backend: Create order
    ↓
Backend: Insert into coupon_usages (user_id, coupon_code, used_at)
    ↓
Success! (Coupon now marked as used for this user)
```

### Offer Flow

```
User opens checkout
    ↓
Frontend: fetchOffers(user_id)
    ↓
Backend: Get active offers
    ↓
Backend: Check offer_usages for this user
    ↓
Backend: Filter out already-used offers
    ↓
Backend: Return only unused offers
    ↓
Frontend: Auto-apply best offer
    ↓
User places order
    ↓
Backend: Verify offer not used (double-check)
    ↓
Backend: Create order
    ↓
Backend: Insert into offer_usages (user_id, offer_id, order_id, used_at)
    ↓
Success! (Offer now marked as used for this user)
```

## Database Schema

### coupon_usages Table
```sql
CREATE TABLE coupon_usages (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    coupon_code VARCHAR(64) NOT NULL REFERENCES coupons(code),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_coupon UNIQUE(user_id, coupon_code)
);
```

### offer_usages Table
```sql
CREATE TABLE offer_usages (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    offer_id UUID NOT NULL REFERENCES offers(id),
    order_id INTEGER REFERENCES orders(id),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_offer UNIQUE(user_id, offer_id)
);
```

## API Changes

### GET /api/offers
**Before:**
```javascript
GET /api/offers
```

**After:**
```javascript
GET /api/offers?user_id=<uuid>
```

Now filters out offers the user has already used.

### POST /api/orders
**Before:**
```json
{
  "user_id": "uuid",
  "items": [...],
  "total_amount": 1000,
  "payment_method": "COD",
  "coupon_code": "SAVE10"
}
```

**After:**
```json
{
  "user_id": "uuid",
  "items": [...],
  "total_amount": 1000,
  "payment_method": "COD",
  "coupon_code": "SAVE10",
  "offer_id": "uuid-of-offer"
}
```

Now accepts `offer_id` to track which offer was used.

### POST /api/coupons/validate
No changes to request/response, but now checks `coupon_usages` and returns:
```json
{
  "valid": false,
  "reason": "COUPON_ALREADY_USED"
}
```
If coupon was already used by this user.

## Error Messages

### User-Facing Messages

| Scenario | Message |
|----------|---------|
| Coupon already used during validation | "You have already used this coupon. Each coupon can only be used once per user." |
| Coupon already used during order | "You have already used this coupon. Each coupon can only be used once per user." |
| Offer already used during order | "This offer has already been used on your account and cannot be applied again." |

## Viewing Usage History

### For Admins - Check Coupon Usage
```sql
SELECT 
  cu.user_id,
  u.full_name,
  u.email,
  cu.coupon_code,
  cu.used_at
FROM coupon_usages cu
JOIN users u ON cu.user_id = u.id
ORDER BY cu.used_at DESC;
```

### For Admins - Check Offer Usage
```sql
SELECT 
  ou.user_id,
  u.full_name,
  u.email,
  o.title as offer_name,
  ou.order_id,
  ou.used_at
FROM offer_usages ou
JOIN users u ON ou.user_id = u.id
JOIN offers o ON ou.offer_id = o.id
ORDER BY ou.used_at DESC;
```

### For Users - Check Their Own Usage
Users can see their usage through the frontend by:
1. Trying to apply a coupon (will show "already used" message)
2. Not seeing previously used offers in the available offers list

## Security Features

✅ **Unique Constraints**: Database enforces one-time use per user
✅ **Double Validation**: Checked during validation AND order creation
✅ **RLS Policies**: Users can only view their own usage history
✅ **Foreign Keys**: Ensures data integrity (user, coupon, offer must exist)
✅ **Cascade Deletion**: If user is deleted, their usage records are deleted

## Troubleshooting

### Issue: "offer_usages table not found"
**Solution:** Run the migration file `database/ADD_OFFER_USAGE_TABLE.sql` in Supabase SQL Editor

### Issue: Offer still showing after use
**Solution:** 
1. Make sure user_id is being passed to fetchOffers
2. Check browser console for errors
3. Verify offer_usages table has the record

### Issue: Order fails with "OFFER_ALREADY_USED" even though it's first time
**Solution:**
1. Check offer_usages table for the user_id and offer_id combination
2. If exists but shouldn't, delete the record:
```sql
DELETE FROM offer_usages 
WHERE user_id = '<user-uuid>' 
AND offer_id = '<offer-uuid>';
```

## Testing Checklist

- [ ] Coupon validation shows "already used" for used coupons
- [ ] COD order with coupon saves coupon usage
- [ ] Prepaid order with coupon saves coupon usage
- [ ] Second use of same coupon is blocked
- [ ] Auto-offers filter out used offers
- [ ] COD order with offer saves offer usage
- [ ] Prepaid order with offer saves offer usage
- [ ] Second use of same offer is blocked
- [ ] Using both coupon AND offer works correctly
- [ ] Discount breakdown shows offer and coupon separately
- [ ] Error messages are user-friendly

## Files Modified

### Backend
- ✅ `backend/server.js` - Added offer usage checking and tracking

### Frontend
- ✅ `frontend/src/api/client.js` - Updated fetchOffers and createOrder
- ✅ `frontend/src/pages/Checkout.jsx` - Added offer_id passing and error handling

### Database
- ✅ `database/ADD_OFFER_USAGE_TABLE.sql` - New migration file

## Next Steps (Optional Enhancements)

1. **Admin Dashboard**: Show usage statistics for coupons and offers
2. **User Profile**: Show history of used coupons/offers
3. **Email Notifications**: Notify users of successful discount usage
4. **Analytics**: Track which discounts are most popular
5. **Redemption Limits**: Allow offers/coupons to be used N times instead of just once

---

**Status:** ✅ Complete and Ready for Testing

**Last Updated:** February 12, 2026
