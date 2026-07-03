# 🚨 FIX: "Failed to create order" Error

## Problem
You're getting "Failed to create order" error during checkout because the `orders` table is missing the required `items` and `total_amount` columns.

---

## ✅ Solution (2 minutes)

### Step 1: Add Database Columns
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the SQL from `/database/ADD_ITEMS_TO_ORDERS.sql`:

```sql
-- Add items column (JSONB array to store multiple products per order)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- Add total_amount column (to store the final order amount)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0;
```

3. Click **Run**
4. You should see: "Success. No rows returned"

### Step 2: Verify It Worked
Run this query in Supabase SQL Editor:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders';
```

You should see both `items` (jsonb) and `total_amount` (numeric) columns.

### Step 3: Test Checkout Again
1. Go back to your checkout page
2. Click "Place order (COD)" again
3. Order should now be created successfully! ✅

---

## What These Columns Do

**items** (JSONB array):
- Stores all products in a single order
- Format: `[{"product_id": "uuid", "quantity": 2}, {"product_id": "uuid2", "quantity": 1}]`
- Allows multiple products per order

**total_amount** (DECIMAL):
- Stores the final order total after discounts
- Used for billing and invoice generation

---

## Alternative: Use Complete Schema

If you prefer to recreate the entire orders table with all columns:

1. Backup existing orders (if any):
```sql
SELECT * FROM orders;
```

2. Drop and recreate:
```sql
DROP TABLE IF EXISTS orders CASCADE;

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  items JSONB DEFAULT '[]'::jsonb,
  total_amount DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## After Adding Columns

Your checkout will work because:
- ✅ Backend can now store multiple items per order
- ✅ Total amount is saved for accurate billing
- ✅ Bill generation will work correctly
- ✅ Stock management will function properly

---

## Quick Test

After running the SQL, test with this command:
```bash
curl -X POST http://localhost:5001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-user-id",
    "items": [{"product_id": "product-id", "quantity": 1}],
    "total_amount": 100
  }'
```

If it returns order data → ✅ Working!
If error → Check the SQL was executed correctly

---

**Status**: Ready to fix in 2 minutes! Just run the SQL in Supabase SQL Editor.
