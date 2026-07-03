# 🚀 Dashboard Blocking Setup Instructions

## Quick Setup (2 minutes)

### Step 1: Run the SQL Migration in Supabase

1. **Go to Supabase Dashboard**
   - Open https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy & Paste SQL**
   - Copy all contents from: `pepsico/database/ADD_DASHBOARD_BLOCKING.sql`
   - Paste into the query editor

4. **Execute**
   - Click "Run" button
   - You should see "Success" message

### Step 2: Verify Tables Were Created

In Supabase SQL Editor, run this query:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('dashboard_blocking', 'delivery_partner_access_keys');
```

You should see:
```
dashboard_blocking
delivery_partner_access_keys
```

### Step 3: Restart Your Backend

```bash
cd /Users/ashirwadk/Project/pepsico/backend
pkill -f "node.*server.js"
sleep 2
npm run dev
```

### Done! ✅

The system is now ready to use:
- **Admin** can set block time and generate access keys
- **Delivery partners** can unlock dashboard with keys
- Keys are single-use and auto-expire after 24 hours

---

## Troubleshooting

### Getting "Failed to generate access key"?

This usually means the `delivery_partner_access_keys` table doesn't exist.

**Solution:**
1. Run the SQL migration steps above
2. Make sure no errors appear in SQL Editor
3. Restart backend

### "Delivery partner not found"?

Make sure you have delivery partners created. You can verify with:

```sql
SELECT id, name, phone FROM public.delivery_partners LIMIT 5;
```

### Still having issues?

1. Check backend logs: `tail -50 /tmp/backend.log`
2. Verify admin key header is being sent correctly
3. Make sure `x-admin-key` header value matches your admin key

---

## Manual Table Creation (if auto-run fails)

If the migration script doesn't work, manually create in Supabase SQL Editor:

```sql
-- Create table for dashboard blocking configuration
CREATE TABLE IF NOT EXISTS public.dashboard_blocking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_time TIME NOT NULL DEFAULT '17:30:00',
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create table for access keys
CREATE TABLE IF NOT EXISTS public.delivery_partner_access_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  access_key VARCHAR(32) NOT NULL UNIQUE,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_delivery_partner_access_keys_partner_id 
  ON public.delivery_partner_access_keys(partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_partner_access_keys_access_key 
  ON public.delivery_partner_access_keys(access_key);
CREATE INDEX IF NOT EXISTS idx_delivery_partner_access_keys_expires_at 
  ON public.delivery_partner_access_keys(expires_at);

-- Insert default blocking configuration
INSERT INTO public.dashboard_blocking (id, block_time, is_enabled)
VALUES (gen_random_uuid(), '17:30:00', TRUE)
ON CONFLICT DO NOTHING;
```

Then restart your backend.

---

## Testing the System

Once tables are created:

1. **As Admin**:
   - Go to Admin Dashboard
   - Navigate to "Collection Settlement from Delivery Partner"
   - click 🔑 Access Keys tab
   - Select a delivery partner
   - Click "Generate Key"
   - Copy the generated key

2. **As Delivery Partner**:
   - After 5:30 PM, dashboard will lock
   - Click lock icon or try to access
   - Enter the access key
   - Dashboard unlocks immediately

---

## API Endpoints

All endpoints are automatic after setup:

- **POST** `/api/dashboard-blocking/check-dashboard-access` - Check & verify key
- **GET** `/api/dashboard-blocking/dashboard-blocking` - Get blocking config
- **PATCH** `/api/dashboard-blocking/admin/dashboard-blocking` - Update block time (admin)
- **POST** `/api/dashboard-blocking/admin/generate-access-key` - Generate key (admin)
- **GET** `/api/dashboard-blocking/admin/access-keys` - List keys (admin)
- **DELETE** `/api/dashboard-blocking/admin/access-keys/:keyId` - Revoke key (admin)
