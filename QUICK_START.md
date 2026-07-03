# Quick Start Guide - Registration & Login

## How It Works

**Passwords are encrypted by Supabase Auth** - they're automatically hashed using bcrypt and stored securely. You don't need to do anything special.

### The Registration Flow

1. User fills in form (Email, Password, Full Name)
2. Backend creates account in Supabase Auth (password encrypted)
3. Backend creates user profile in public.users table
4. Backend auto-confirms email (user can login immediately)
5. User sees success message and can go to login

### The Login Flow

1. User enters email and password
2. Supabase Auth checks if password matches (bcrypt comparison)
3. Checks if email is confirmed
4. If both valid → User logged in → Redirected to dashboard
5. If email not confirmed → Error message

## Step-by-Step Testing

### Register a New User

1. Go to http://localhost:5175/register
2. Fill in:
   - Full Name: `John Doe`
   - Email: `john@example.com`
   - Password: `Test1234`
3. Click "Create Account"
4. You should see ✓ "Account Created Successfully!"
5. The email is **auto-confirmed** - no email link needed!

### Login with the New User

1. Go to http://localhost:5175/login
2. Fill in:
   - Email: `john@example.com`
   - Password: `Test1234`
3. Click "Sign In"
4. You should be logged in and see the dashboard

## Database Details

### Where Passwords Are Stored

**auth.users** (Supabase manages this)
```
id: user-uuid
email: john@example.com
encrypted_password: $2a$12$... (bcrypt hash)
email_confirmed_at: 2025-12-23 (set during registration)
```

**public.users** (Our table)
```
id: user-uuid
email: john@example.com
full_name: John Doe
is_verified: false (needs admin approval for ordering)
```

### Important Fields

- `auth.users.encrypted_password` → Password hash (bcrypt)
- `auth.users.email_confirmed_at` → Must be set for login to work
- `public.users.is_verified` → Admin approval for ordering

## SQL to View Users

If you want to check users in Supabase Dashboard:

```sql
-- View custom user profiles (no passwords here)
SELECT id, email, full_name, is_verified, created_at 
FROM public.users 
ORDER BY created_at DESC;

-- View auth status (don't try to view password, it's encrypted)
SELECT id, email, email_confirmed_at 
FROM auth.users 
ORDER BY created_at DESC;
```

## Common Issues & Fixes

### "Email not confirmed" error
**Solution**: Email should be auto-confirmed during registration. If you see this:
1. Wait a few seconds and try again
2. Check browser console (F12) for errors
3. Check backend logs for confirmation failures

### "Invalid email or password"
**Solution**: 
- Check exact email and password
- Make sure email matches what you registered with
- Password is case-sensitive

### User can register but can't login
**Solution**: Email confirmation probably failed
- Run admin confirmation: `./scripts/confirm-user-email.sh`
- Or restart backend server

## File Locations

- **Register Code**: `frontend/src/pages/Register.jsx`
- **Login Code**: `frontend/src/pages/Login.jsx`
- **Backend Auth**: `backend/server.js` (look for `/api/auth/` routes)
- **Database Schema**: `database/schema.sql`

## Backend Routes Used

### Registration
```
POST /api/auth/profile
- Creates user profile in public.users

POST /api/auth/confirm-email
- Sets email_confirmed_at so user can login
```

### Admin (if needed)
```
POST /api/admin/confirm-user-email
- Manually confirm email for a user
- Requires x-admin-key header
```

## Testing Passwords

Passwords are automatically encrypted - no special testing needed. Just use any password that's 6+ characters.

**Examples:**
- `Test1234` ✓
- `Password123` ✓
- `12345` ✗ (too short)
- `abc` ✗ (too short)

## Next Steps

1. ✓ Run project: `npm run dev` (both backend and frontend)
2. ✓ Register a test user
3. ✓ Login with that user
4. ✓ Check dashboard works
5. ⏳ (Future) Admin can approve users for ordering

## Quick Commands

```bash
# Kill existing processes
killall node npm

# Start backend (port 5001)
cd backend && npm install && node server.js &

# Start frontend (port 5175)
cd frontend && npm install && npm run dev &

# View users (Supabase SQL Editor)
SELECT * FROM public.users ORDER BY created_at DESC;
```

---

**Summary**: Passwords are encrypted automatically by Supabase. Registration auto-confirms email. User can login immediately after registration. No extra steps needed!
