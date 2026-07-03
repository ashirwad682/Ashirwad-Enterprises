# CRITICAL: Disable Email Confirmation in Supabase

## Problem
Users cannot login after registration because Supabase requires email confirmation by default.

## Solution: Disable Email Confirmation (REQUIRED)

### Steps:
1. Go to https://supabase.com/dashboard
2. Select your project: **kpnvvrmvwfztkfxdsrrb**
3. Click **Authentication** in the left sidebar
4. Click **Providers**
5. Click **Email** provider
6. **UNCHECK** "Confirm email"
7. Click **Save**

## Alternative: Confirm Existing Users Manually

If you want to keep email confirmation enabled, you need to confirm each user manually:

```bash
# For user akumar@gmail.com (ID: 5063cf13-3098-4643-9e73-7c7ab0c5774d)
curl -X POST http://localhost:5001/api/admin/confirm-user-email \
  -H "Content-Type: application/json" \
  -H "x-admin-key: Qk3uX9n7r2sP5w8yZa1cV4eB6mJ0tDs" \
  -d '{"userId":"5063cf13-3098-4643-9e73-7c7ab0c5774d"}'
```

## What I've Done
✅ Updated backend to auto-confirm emails during registration
✅ Confirmed akumar@gmail.com manually
✅ Added emailRedirectTo: undefined in registration

## What You MUST Do
🔴 **DISABLE EMAIL CONFIRMATION IN SUPABASE DASHBOARD** (see steps above)

This will allow ALL new users to login immediately after registration without any email confirmation step.
