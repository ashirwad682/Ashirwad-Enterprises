# Fix: Missing Order Columns Error

## Problem
Error: `Could not find the 'coupon_discount' column of 'orders' in the schema cache`

This occurs because the orders table is missing several important columns needed for storing order details, pricing, and discounts.

## Solution

### Run the Migration

Execute this SQL migration file in your Supabase SQL editor:

**File:** `database/ADD_MISSING_ORDER_COLUMNS.sql`

### Step-by-Step Instructions

1. **Go to Supabase Dashboard**
   - Open your Supabase project console
   - Navigate to SQL Editor

2. **Create a New Query**
   - Click "New query"
   - Name it: `Add Missing Order Columns`

3. **Copy and Paste the Migration**
   ```sql
   -- Add missing columns to orders table for order details and payments
   ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12, 2) DEFAULT 0;
   ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
   ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'COD';
   ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12, 2) DEFAULT 0;
   ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_total DECIMAL(12, 2) DEFAULT 0;
   ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(12, 2) DEFAULT 0;
   ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offer_discount DECIMAL(12, 2) DEFAULT 0;
   ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(12, 2) DEFAULT 0;
   ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(12, 2) DEFAULT 0;
   ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
   ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offer_id UUID;

   CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
   CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
   CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
   ```

4. **Execute the Query**
   - Click "Run" or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux)
   - Wait for success message

5. **Verify the Columns**
   - Go to Database > Tables > orders
   - Scroll right to see the new columns:
     - total_amount
     - items
     - payment_method
     - subtotal
     - discount_total
     - coupon_discount
     - offer_discount
     - shipping_fee
     - gst_amount
     - coupon_code
     - offer_id

## What Each Column Does

| Column | Type | Purpose |
|--------|------|---------|
| total_amount | DECIMAL | Final total price user pays |
| items | JSONB | Array of {product_id, quantity} objects |
| payment_method | TEXT | "COD" or "prepaid" |
| subtotal | DECIMAL | Price before discounts |
| discount_total | DECIMAL | Total discount amount |
| coupon_discount | DECIMAL | Discount from coupon code |
| offer_discount | DECIMAL | Discount from promotional offer |
| shipping_fee | DECIMAL | Delivery cost |
| gst_amount | DECIMAL | Tax amount (GST) |
| coupon_code | TEXT | Coupon code used |
| offer_id | UUID | Reference to offer |

## After Migration

### Test Order Placement
1. Visit product page
2. Add items to cart
3. Go to checkout
4. Try placing a test order
5. You should see: "Order placed successfully!"

The order details will now be saved with all pricing and discount information.

## Troubleshooting

### Error: "relation 'public.orders' does not exist"
- Means the orders table is missing
- Run COMPLETE_SCHEMA.sql first

### Error: "constraint already exists"
- Safe to ignore - the constraint was already created

### Still getting column not found error
- Clear your browser cache (Cmd+Shift+R or Ctrl+Shift+R)
- Refresh Supabase dashboard
- Check that all columns show in the table schema

## Files Modified
- Backend: `/pepsico/backend/server.js` - Uses these columns for order creation
- Frontend: `/pepsico/frontend/src/pages/Checkout.jsx` - Sends order data
- Database: `/pepsico/database/ADD_MISSING_ORDER_COLUMNS.sql` - New migration
