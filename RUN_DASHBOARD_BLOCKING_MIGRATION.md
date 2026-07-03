# Dashboard Blocking Migration - Manual Setup

The migration script requires packages from the backend. Here's the easiest way to set up the database:

## Option 1: Quick Setup in Supabase (Recommended - 2 minutes)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Copy & Paste the SQL Below**
   - Copy ALL the SQL code in the next section
   - Paste it into the query editor

4. **Execute**
   - Click **Run** button
   - Wait for "Success" message

## SQL to Execute

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

-- Create indexes for performance
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

## Option 2: Run via Backend (Alternative)

If you want to use Node.js, run from the backend directory:

```bash
cd /Users/ashirwadk/Project/pepsico/backend
node ../database/run-dashboard-blocking-migration.js
```

The backend has all required packages installed.

## Verify the Setup

After running the SQL, verify tables were created:

```bash
curl -s http://localhost:5001/api/dashboard-blocking/dashboard-blocking
```

You should see:
```json
{
  "blockTime": "17:30:00",
  "isEnabled": true,
  "isBlocked": true,
  "nextBlockTime": "2026-02-16T17:30:00.000Z"
}
```

If you see this, the setup is **successful!** ✅

## Troubleshooting

### Still getting errors?

1. **Check Supabase connection**
   - Verify SUPABASE_URL in `.env`
   - Verify SUPABASE_SERVICE_ROLE_KEY in `.env`

2. **Check backend logs**
   ```bash
   tail -50 /tmp/backend.log | grep -i "dashboard\|error"
   ```

3. **Restart backend**
   ```bash
   pkill -f "node.*server.js"
   sleep 2
   cd /Users/ashirwadk/Project/pepsico/backend && npm run dev
   ```

## Next Steps

Once the tables are created:

1. Go to Admin Dashboard
2. Navigate to **Collection Settlement from Delivery Partner**
3. Go to **Block Configuration** tab
4. Update the block time and click **Save**
5. Go to **Access Keys** tab and generate a key

Everything should now work! ✅
