# User Registration & Login - How It Works

## 🔐 Where Passwords Are Stored

**Your passwords ARE being saved!** They're stored securely in Supabase's authentication system, not in your custom database table.

### How Supabase Auth Works:

1. **Registration** (`signUp`):
   - Creates user in `auth.users` table (managed by Supabase)
   - Stores **email + hashed password** in Supabase Auth
   - Creates profile in `public.users` table (your custom table)
   - Profile has: id, email, full_name, role, is_verified
   - Profile does NOT store password (security best practice!)

2. **Login** (`signInWithPassword`):
   - Supabase checks email + password against `auth.users` table
   - If correct, returns authentication token
   - You use this token to access the app

3. **Your Custom Table** (`public.users`):
   - Stores profile info only: full_name, role, is_verified
   - Does NOT store passwords (that's in Supabase Auth)
   - Linked to auth.users by user ID

## ✅ Testing Login

### Step 1: Register a New User

1. Go to: `http://localhost:5177/register`
2. Fill in:
   - Full Name: `Test User`
   - Email: `testuser@example.com`
   - Password: `password123`
3. Click "Sign Up"
4. Wait for success message

### Step 2: Login

1. Go to: `http://localhost:5177/login`
2. Enter:
   - Email: `testuser@example.com`
   - Password: `password123`
3. Click "Sign In"
4. You should be redirected to `/dashboard`

### Step 3: If Login Fails

Check the error message:

#### ❌ "Invalid login credentials"
- **Cause**: Wrong email or password
- **Fix**: Make sure you're using the EXACT email and password you registered with

#### ❌ "Email not confirmed"
- **Cause**: Email confirmation failed during registration
- **Fix**: The backend auto-confirms emails, but if this fails check backend logs

#### ❌ "Your account is not verified"
- **Cause**: Admin hasn't approved your account yet
- **Fix**: Login to admin dashboard and verify the user

## 🔍 Debugging Steps

### 1. Check if user exists in Supabase Auth:

Open Supabase Dashboard → Authentication → Users

You should see users listed there with their emails.

### 2. Check if profile exists in database:

```bash
# Check users in custom table
curl -X GET http://localhost:5001/api/admin/users \
  -H "x-admin-key: Qk3uX9n7r2sP5w8yZa1cV4eB6mJ0tDs" \
  -s | jq .
```

### 3. Check browser console for errors:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try to login
4. Look for any red error messages

## 📝 Common Issues & Solutions

### Issue: "Can't login with registered email"

**Solution:**
1. Make sure you're entering the EXACT same email you registered with
2. Emails are case-insensitive but must match exactly
3. Try resetting your password via Supabase Auth

### Issue: "Registration succeeds but login fails"

**Possible causes:**
1. Email confirmation didn't work
2. User profile wasn't created in database
3. Password doesn't match

**Debug:**
```javascript
// Open browser console and run:
localStorage.clear()
sessionStorage.clear()
location.reload()
// Then try registering and logging in again
```

### Issue: "Login works but dashboard is empty"

**Cause:** User is not verified by admin

**Fix:**
1. Login to admin dashboard: `/admin`
2. Admin key: `Qk3uX9n7r2sP5w8yZa1cV4eB6mJ0tDs`
3. Go to "Users" tab
4. Click "Verify" next to the user

## 🎯 Quick Test Script

Run this in your browser console after registering:

```javascript
// Test if you can login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'testuser@example.com',
  password: 'password123'
})

console.log('Login result:', { data, error })

// If successful, you should see:
// data: { user: {...}, session: {...} }
// error: null
```

## ✅ Expected Behavior

1. **Register**: Creates account → Shows success message
2. **Login**: Accepts email + password → Redirects to dashboard
3. **Dashboard**: Shows "Account not verified" message (until admin verifies)
4. **After Admin Verification**: User can place orders

## 🚨 If Still Not Working

1. **Check backend logs** for errors during registration
2. **Check Supabase logs** in your Supabase dashboard
3. **Clear browser storage** and try again:
   ```javascript
   localStorage.clear()
   sessionStorage.clear()
   ```
4. **Try with a fresh email** to rule out duplicate account issues

The system is designed correctly - passwords ARE saved (in Supabase Auth, not your database table). This is the secure way to handle authentication! 🔒
