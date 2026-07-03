# DATABASE UPDATE INSTRUCTIONS

## Problem
The user dashboard shows "Failed to fetch orders" and "Failed to fetch notifications" because the database is missing required columns on the orders table.

## Required Columns Missing
The `orders` table is missing these essential columns:
- `items` - JSONB array to store order items
- `total_amount` - Decimal to store order total
- `payment_method` - Text for payment type (cod/prepaid)
- Plus delivery-related columns and other tables

## Solution - Run This SQL

### ⚡ Quick Fix (Essential Columns Only)
If you just want to fix the orders/notifications issue quickly, run this:

```sql
-- Add missing columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'prepaid';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_items ON orders USING GIN (items);
```

### 🚀 Complete Fix (Recommended)
For the full system with all features, use the complete update script:

**File:** `database/COMPLETE_UPDATE.sql`

This script includes:
- ✅ All missing orders columns (items, total_amount, payment_method)
- ✅ Offers table for promotions
- ✅ Delivery partners system
- ✅ Managers & permissions
- ✅ Coupon usage tracking
- ✅ All necessary indexes
- ✅ Proper constraints and triggers

## How to Run the SQL

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project: https://supabase.com/dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy the entire contents of `database/COMPLETE_UPDATE.sql`
5. Paste into the SQL editor
6. Click "Run" button
7. Check the results - you should see a table showing all columns and record counts

### Option 2: Using psql Command Line
```bash
# If you have direct database access
psql -h <your-db-host> -U postgres -d postgres -f database/COMPLETE_UPDATE.sql
```

## After Running the SQL

1. **Restart the backend server** (the startup script already does this):
   ```bash
   bash pepsico/stop-project.sh
   bash pepsico/start-project.sh
   ```

2. **Clear browser cache or do a hard refresh**:
   - Chrome/Edge: Ctrl+Shift+R (Cmd+Shift+R on Mac)
   - Firefox: Ctrl+F5 (Cmd+Shift+R on Mac)

3. **Test the dashboard**:
   - Login to the user dashboard
   - Navigate to Orders - should show "No orders yet" (not an error)
   - Navigate to Notifications - should show "No notifications yet" (not an error)

## Verification

After running the SQL, you can verify it worked by running this query:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND table_schema = 'public'
AND column_name IN ('items', 'total_amount', 'payment_method')
ORDER BY column_name;
```

You should see 3 rows returned.

## Common Issues

### "column already exists" errors
- **Safe to ignore** - The script uses `IF NOT EXISTS` so it won't break anything

### "permission denied" errors
- Make sure you're logged in as a superuser or database owner
- In Supabase, use the SQL Editor (it runs with proper permissions)

### Still showing "Failed to fetch"
1. Check that the backend is running: `curl http://localhost:5001/api/health`
2. Check backend logs: `cat pepsico/logs/backend.log`
3. Try restarting both servers again
4. Check browser console for specific error messages (F12 → Console tab)

## Files Created
- ✅ `database/COMPLETE_UPDATE.sql` - Full database update (recommended)
- ✅ `database/FIX_ORDERS_TABLE.sql` - Quick fix for orders table only
- ✅ `database/UPDATE_INSTRUCTIONS.md` - This file

## Next Steps
After the database is updated and working:
1. Create some test products (if needed)
2. Place a test order to verify the system works
3. Check that orders appear correctly in the dashboard
