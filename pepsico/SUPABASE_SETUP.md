# PepsiCo Distributor Portal - Setup Instructions

## Disable Email Confirmation in Supabase

To allow users to login immediately after registration without email confirmation:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: **kpnvvrmvwfztkfxdsrrb**
3. Navigate to: **Authentication** → **Settings** → **Email Auth**
4. **Disable** the option: "Confirm email"
5. Click **Save**

This allows users to:
- ✅ Register and login immediately
- ✅ Access the dashboard after login
- ⚠️ Still need admin verification to place orders

## Alternative: Auto-confirm Emails via Backend

If you want to keep email confirmation enabled but auto-confirm users, add this to your backend:

```javascript
// In server.js - create endpoint for auto-confirming
app.post('/api/admin/confirm-user/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase.auth.admin.updateUserById(
      req.params.userId,
      { email_confirm: true }
    )
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
```

## Current Setup

✅ Users can register
✅ After registration, they're redirected to login
✅ After successful login, they're redirected to `/dashboard`
✅ Users can browse products and add to cart
⚠️ Users cannot place orders until admin verifies them via Admin Dashboard

## Admin Access
- URL: http://localhost:5173/admin
- Password: admin@123
