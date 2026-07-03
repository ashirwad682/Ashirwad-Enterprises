# 🔧 Dashboard Blocking System - Quick Setup

**Status**: ✅ Code complete. ⏳ Needs database setup.

## What is this?

A security system that locks the delivery partner dashboard every day at 5:30 PM. Only administrators can unlock it by generating single-use access keys for delivery partners.

## 🚀 One-Minute Setup

### Step 1: Copy the SQL
```bash
cat pepsico/database/ADD_DASHBOARD_BLOCKING.sql
```

### Step 2: Open Supabase

1. Go to https://app.supabase.com
2. Select your project
3. Click **SQL Editor** → **New Query**
4. **Paste** the SQL from step 1
5. Click **Run**

Expected output: "Success"

### Step 3: Restart Backend

```bash
pkill -f "node.*server.js"
sleep 2
cd pepsico/backend && npm run dev
```

## ✅ Done!

The system is now active. You can:
- **Admin**: Generate access keys for delivery partners
- **Partners**: Use keys to unlock dashboard after 5:30 PM

---

## 🔑 How to Generate Access Keys

### In Admin Dashboard:

1. Navigate to **Settings** → **Collection Settlement from Delivery Partner**
2. Go to **🔑 Access Keys** tab
3. Select a **Delivery Partner Name**
4. Click **Generate Key**
5. **Copy** the key (appears for 5 seconds)
6. **Send** to the delivery partner

### Partners Unlock Dashboard:

1. After 5:30 PM, dashboard shows lock screen 🔒
2. Enter the access key
3. Dashboard unlocks immediately

⚠️ Keys are **single-use** - once used, they expire automatically.

---

## 🐛 Troubleshooting

### Error: "Database not initialized"

**Problem**: SQL migration wasn't executed in Supabase
**Solution**: 
1. Re-read instructions above
2. Make sure you're in Supabase SQL Editor (not a text file)
3. Copy the **entire** SQL and run it

### Error: "Delivery partner not found"

**Problem**: The selected delivery partner doesn't exist
**Solution**:
1. Make sure you have delivery partners created
2. Check they're visible in the Delivery Partners table

### Dashboard not locking at 5:30 PM?

**Problem**: Blocking might be disabled
**Solution**:
1. Go to Admin Dashboard → Collection Settlement
2. Check **"Enable Dashboard Blocking"** toggle
3. Set time if needed (default: 5:30 PM)
4. Click **Update Settings**

---

## 📊 Admin Controls

All controls are in **Admin Dashboard** → **Collection Settlement from Delivery Partner**:

### Settings Tab
- **Set Block Time**: Change daily lock time (default 5:30 PM)
- **Enable/Disable**: Turn blocking on/off

### Access Keys Tab
- **Generate Key**: Create new key for partner
- **View Keys**: See active/expired keys
- **Revoke**: Delete a key to make it unusable

---

## 🔐 Technical Details

- **Block Time**: Every day at 5:30 PM (configurable)
- **Key Format**: 32-character hex string
- **Key Expiry**: 24 hours (set when generated)
- **Single Use**: First use marks key as consumed, can't reuse
- **Auto-Cleanup**: Expired keys shown as inactive but kept for audit trail

---

## 📋 Database Tables

Two new tables are created:

### `dashboard_blocking`
```
- id (UUID primary key)
- block_time (TIME - e.g., '17:30:00')
- is_enabled (BOOLEAN)
- updated_at (for audit)
```

### `delivery_partner_access_keys`
```
- id (UUID primary key)
- partner_id (FK to delivery_partners)
- access_key (32-char unique string)
- is_used (BOOLEAN - tracks if key was used)
- expires_at (TIMESTAMP)
- generated_by (admin user ID)
```

---

## 🆘 Still Not Working?

Check backend logs:
```bash
tail -50 /tmp/backend.log 2>/dev/null || tail -50 pepsico/backend/logs/*.log 2>/dev/null
```

Should see:
```
Server running on port 5001
```

If not, restart backend and confirm no errors on startup.

---

**Questions?** Check [DASHBOARD_BLOCKING_SETUP.md](./DASHBOARD_BLOCKING_SETUP.md) for detailed instructions.
