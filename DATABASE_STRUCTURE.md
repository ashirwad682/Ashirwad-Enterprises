# Database Structure & Password Encryption

## Overview
This application uses **Supabase Auth** for secure password management. Passwords are NOT stored in the custom database tables - they're encrypted and stored in Supabase's `auth.users` table.

## How Password Encryption Works

### Table Structure

#### 1. `auth.users` (Managed by Supabase - NOT in our schema.sql)
This is Supabase's built-in authentication table. **Passwords are encrypted and stored here.**

```sql
-- This table is managed by Supabase
-- Passwords are hashed using bcrypt (industry standard)
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  encrypted_password TEXT NOT NULL,  -- Password is bcrypt encrypted
  email_confirmed_at TIMESTAMP,      -- Key for login: must be set
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Important**: Users cannot login if `email_confirmed_at` is NULL.

#### 2. `public.users` (Our custom table in schema.sql)
This stores user profile information ONLY (no passwords).

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'user',
  is_verified BOOLEAN DEFAULT FALSE,  -- Admin approval for ordering
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

## Password Flow

### Registration
```
User enters: email + password
    ↓
1. Supabase Auth encrypts password with bcrypt
2. Stores encrypted password in auth.users table
3. User cannot login until email_confirmed_at is set
4. Backend auto-confirms email (sets email_confirmed_at)
5. User can now login
6. User profile created in public.users table
```

### Login
```
User enters: email + password
    ↓
1. Supabase Auth checks auth.users table
2. Compares entered password with bcrypt encrypted password
3. Checks if email_confirmed_at is set
4. If both valid → creates session → user logged in
5. If email_confirmed_at is NULL → login fails with "Email not confirmed"
```

## Why Passwords Aren't in public.users

This is a **security best practice**:
- Passwords should only be handled by authentication systems
- Never store passwords in business logic tables
- Separation of concerns: Auth system ≠ Business data
- Reduces security risk if database is compromised

## Email Confirmation is Critical

The `email_confirmed_at` field in `auth.users` is what enables/disables login:

```javascript
// Backend auto-confirms during registration
await supabaseAdmin.auth.admin.updateUserById(userId, {
  email_confirmed_at: new Date().toISOString()
})
// Now user can login!
```

## Database Tables

### users
- Stores profile information
- Links to auth.users via UUID
- `is_verified` = Admin approval for ordering
- Password management handled by Supabase Auth

### products
- Product catalog
- Price, stock, category
- Only admins can modify

### orders
- Customer orders
- Links user_id → users
- Links product_id → products
- Status tracking: Pending → Approved → Dispatched → Delivered

### addresses
- Shipping addresses for users
- Multiple addresses per user
- Can mark one as default

### notifications
- Admin messages to users
- One-way notifications from admin to users

## Key Points

1. **Passwords are encrypted** - Supabase uses bcrypt (industry standard)
2. **We never handle passwords** - All handled by Supabase Auth
3. **Email confirmation is required** - Set automatically during registration
4. **Public.users stores ONLY profile data** - No passwords here
5. **Auth flow is secure** - Follows best practices

## Running the Application

```bash
# Backend (auto-confirms emails)
cd backend && npm install && node server.js

# Frontend (uses Supabase auth)
cd frontend && npm install && npm run dev
```

## Testing

```bash
# Register new user
- Email: test@example.com
- Password: Test1234
- Full Name: Test User
→ Registration succeeds
→ Email auto-confirmed
→ Can login immediately

# Login
- Email: test@example.com
- Password: Test1234
→ Success! Dashboard loads
```
