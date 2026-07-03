# Dashboard Blocking System - Administrator Guide

## Overview

The **Dashboard Blocking System** is a security feature that prevents delivery partners from accessing the delivery dashboard after a specified time each day (default: 5:30 PM). This ensures that bill collection and settlement activities can only happen during designated business hours.

## Key Features

- ⏰ **Time-based Locking**: Automatically locks dashboard at configured time daily
- 🔑 **Access Keys**: Admins generate single-use keys to grant temporary access
- 🔐 **Single-Use Keys**: Each key can only be used once; automatically expires after 24 hours
- 🎛️ **Admin Control**: Full control panel to change lock times and manage keys
- 📱 **User-Friendly**: Beautiful lock modal with clear instructions
- 🔔 **Error Messages**: Helpful guidance when users encounter issues

## For Administrators

### Access the Dashboard Blocking Controls

1. Login to Admin Dashboard
2. Go to **Settings** → **Collection Settlement from Delivery Partner**
3. You'll see two tabs:
   - **⏱️ Settings**: Configure lock time and enable/disable feature
   - **🔑 Access Keys**: Generate and manage keys

### Change Daily Lock Time

1. In **Settings** tab
2. Clear the time field and enter new time (e.g., `18:00` for 6 PM)
3. Click **Update Settings**
4. Changes take effect immediately

### Generate Access Keys

1. In **🔑 Access Keys** tab
2. Select a **Delivery Partner** from dropdown
3. Click **Generate Key** button
4. A 32-character code appears (visible for 5 seconds)
5. **Copy** the key and **send to the delivery partner**
6. The key will work until it's used OR it expires (24 hours)

### View & Revoke Keys

- **View**: List shows all active and expired keys with:
  - Partner name
  - Generated time
  - Expiry time
  - Current status (active/expired/used)

- **Revoke**: Click 🗑️ to delete a key (makes it unusable)
  - Use this if key is compromised
  - User must get a new key from admin

## For Delivery Partners

### When Dashboard is Locked

After the daily lock time (default 5:30 PM):

1. You'll see a **🔒 Dashboard Locked** modal
2. Enter the **access key** provided by your admin
3. Click **🔓 Unlock Dashboard**
4. You now have access for the rest of the day

### Important Notes

- 🔐 Each access key is **single-use only**
- ⏰ Keys expire after **24 hours**
- 🚨 Once you use a key, you cannot use it again
- 📞 If you need access again, ask your admin to generate a new key

## Database Setup

The system requires two database tables. They are created automatically or manually via:

**Automatic Setup:**
```bash
node pepsico/database/run-dashboard-blocking-migration.js
```

**Manual Setup:**
- Copy SQL from `pepsico/database/ADD_DASHBOARD_BLOCKING.sql`
- Paste into Supabase SQL Editor
- Click Run

See [DASHBOARD_BLOCKING_SETUP.md](./DASHBOARD_BLOCKING_SETUP.md) for detailed instructions.

## API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/dashboard-blocking/dashboard-blocking` | GET | Check if dashboard is currently blocked | None |
| `/api/dashboard-blocking/check-dashboard-access` | POST | Verify and use an access key | None |
| `/api/dashboard-blocking/admin/dashboard-blocking` | PATCH | Update block time/settings | Admin Key |
| `/api/dashboard-blocking/admin/generate-access-key` | POST | Generate new key for partner | Admin Key |
| `/api/dashboard-blocking/admin/access-keys` | GET | List all keys and their status | Admin Key |
| `/api/dashboard-blocking/admin/access-keys/:keyId` | DELETE | Revoke a specific key | Admin Key |

## Troubleshooting

### Dashboard Not Locking at Expected Time

**Check 1**: Is blocking enabled?
- Admin Dashboard → Settings tab → "Enable Dashboard Blocking" toggle
- Must be checked/ON

**Check 2**: Is lock time set correctly?
- Look at the time field in Settings tab
- Format should be HH:MM (24-hour format)
- 5:30 PM = 17:30

**Check 3**: Backend running?
- Should see "Server running on port 5001" in logs
- Restart if needed: `npm run dev` in `backend` folder

### "Database not initialized" Error

**Solution**: Run database migration
```bash
node pepsico/database/run-dashboard-blocking-migration.js
```

Then restart backend.

### Access Key Not Working

**Possible causes:**
1. Key was already used (single-use only)
2. Key has expired (24-hour limit from generation)
3. Wrong key was entered

**Solution**: Admin generates a new key

### "This access key has already been used"

**This is expected!** Keys are single-use. 

- First use: ✅ Unlocks dashboard
- Second use: ❌ Rejected message
- Ask admin to generate a fresh key

## Technical Details

### Lock Time Calculation

- Compared against current system time
- Uses 24-hour format (00:00-23:59)
- Default: 17:30:00 (5:30 PM)
- Applied daily at that time

### Key Generation

- Format: 32-character hexadecimal string
- Example: `a3f4e8c2d1b9f7e4a6c3d2b1f9e8a7c2`
- Generated using cryptographically secure random number generator
- Stored in database with expiry timestamp

### Key Validation Flow

```
User enters key → Backend checks:
├─ Is key in database?
├─ Does it match the partner?
├─ Has it already been used?
├─ Has it expired?
└─ All checks pass?
  ├─ YES → Mark as used, unlock dashboard
  └─ NO → Show error, keep dashboard locked
```

### Single-Use Implementation

- When key is first used: `is_used` flag changed from `false` to `true`
- On next use attempt: Validation sees `is_used = true` and rejects it
- Cannot be changed back to false (prevents reuse)

## Configuration Examples

### Default Configuration
```
Block Time: 17:30:00 (5:30 PM)
Enabled: true
Key Expiry: 24 hours
```

### Example: Alternative Times
```
Morning: 08:00 (8 AM)
Afternoon: 12:00 (12 PM / Noon)
Evening: 18:00 (6 PM)
```

All times are in 24-hour format.

## Integration Points

### With Delivery System
- ✅ Integrates with existing delivery partner authentication
- ✅ Uses same database and Supabase setup
- ✅ No impact on delivery order features

### With Billing System
- ✅ Works alongside bill generation and emails
- ✅ Also respects blocked dashboard state
- ✅ Admin can override block times if needed

## File Reference

- **Configuration**: None (time stored in database)
- **Frontend Code**: 
  - `frontend/src/components/DashboardBlockLockModal.jsx`
  - `frontend/src/pages/AdminDashboard.jsx`
  - `frontend/src/pages/DeliveryPartnerDashboard.jsx`
- **Backend Code**: `backend/routes/dashboard-blocking.js`
- **Database**: `database/ADD_DASHBOARD_BLOCKING.sql`
- **Setup Guide**: `DASHBOARD_BLOCKING_SETUP.md`

## Support & Troubleshooting

See detailed guide: [DASHBOARD_BLOCKING_SETUP.md](./DASHBOARD_BLOCKING_SETUP.md)

Quick reference: [DASHBOARD_BLOCKING_QUICK.md](./DASHBOARD_BLOCKING_QUICK.md)

Status report: [DASHBOARD_BLOCKING_STATUS.md](./DASHBOARD_BLOCKING_STATUS.md)

---

**System Status**: ✅ Ready for Deployment

**Requirements Met**:
- ✅ Code implementation complete
- ✅ Frontend UI polished
- ✅ Backend APIs working
- ⏳ Database tables need to be created (one-time setup)

**Next Step**: Run database migration as shown above.
