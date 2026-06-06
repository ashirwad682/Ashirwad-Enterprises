# PepsiCo Distributor Project - Troubleshooting Guide

## 🚀 Quick Start

### Starting the Project
```bash
# From the project root directory
./start-project.sh
```

### Stopping the Project
```bash
./stop-project.sh
```

## ✅ Common Issues & Solutions

### 1. **Servers Won't Start**

#### Issue: Port already in use
```bash
# Kill processes on the ports
lsof -ti:5001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

#### Issue: Missing dependencies
```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd frontend && npm install
```

### 2. **Frontend Can't Connect to Backend**

#### Check if backend is running:
```bash
curl http://localhost:5001/api/health
```

#### Expected response:
```json
{
  "status": "ok",
  "port": 5001,
  "mailerConfigured": true/false,
  "db": {
    "ok": true,
    "error": null
  }
}
```

#### Fix: Verify environment variables
- **Frontend**: Check `frontend/.env.local` has:
  ```env
  VITE_SUPABASE_URL=your_supabase_url
  VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
  VITE_API_BASE=http://localhost:5001
  ```

- **Backend**: Check `backend/.env` has:
  ```env
  PORT=5001
  SUPABASE_URL=your_supabase_url
  SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
  ADMIN_API_KEY=your_admin_api_key
  ```

### 3. **Database Connection Errors**

#### Issue: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
- Verify your `backend/.env` file has valid Supabase credentials
- Check if the Supabase project is still active

#### Issue: Database queries failing
```bash
# Test Supabase connection
curl -H "apikey: YOUR_ANON_KEY" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     "YOUR_SUPABASE_URL/rest/v1/products"
```

### 4. **Authentication Issues**

#### Issue: "Email not confirmed"
Users need to be verified by admin. Two options:

**Option 1: Using the script**
```bash
cd scripts
./confirm-user-email.sh user@example.com
```

**Option 2: Using the API**
```bash
curl -X POST http://localhost:5001/api/admin/confirm-user-email-by-email \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -d '{"email": "user@example.com"}'
```

### 5. **Login Errors**

#### Issue: "Invalid email or password"
- Verify the email is confirmed (see above)
- Check if the password meets minimum requirements (6 characters)
- Ensure email is lowercase

#### Issue: User can't login after registration
- The user profile must be approved by admin
- Check the admin dashboard at `/admin/dashboard`

### 6. **Checkout/Order Issues**

#### Issue: Orders not being created
- Verify backend is running on port 5001
- Check browser console for error messages
- Verify user is verified (`is_verified: true` in database)

### 7. **Email Notifications Not Working**

#### Check email configuration:
```bash
# Backend .env should have:
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

#### Test email functionality:
```bash
curl http://localhost:5001/api/health
# Check "mailerConfigured" field
```

### 8. **Admin Dashboard Access**

#### Issue: Can't access admin dashboard
- Admin login uses API key authentication (not email/password)
- The admin key is stored in `backend/.env` as `ADMIN_API_KEY`
- Minimum key length: 12 characters

## 📋 Health Check Checklist

Run these commands to verify everything is working:

```bash
# 1. Check if backend is running
curl http://localhost:5001/api/health

# 2. Check if frontend is running
curl http://localhost:5173

# 3. Check database connection
curl http://localhost:5001/api/products

# 4. View backend logs
tail -f logs/backend.log

# 5. View frontend logs
tail -f logs/frontend.log
```

## 🔧 Manual Startup (If Scripts Don't Work)

### Terminal 1 - Backend:
```bash
cd backend
npm start
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

## 📊 Port Reference

| Service  | Port | URL |
|----------|------|-----|
| Backend  | 5001 | http://localhost:5001 |
| Frontend | 5173 | http://localhost:5173 |

## 🐛 Debugging Tips

### Enable detailed logging:
```bash
# Backend - add to .env
DEBUG=*

# Frontend - check browser console
# Press F12 in your browser
```

### Check for JavaScript errors:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for red error messages
4. Check Network tab for failed API requests

### Database queries:
```bash
# Check Supabase Studio
# Go to your Supabase project → Table Editor
```

## 📞 Need Help?

If you're still experiencing issues:

1. Check the logs in `logs/` directory
2. Look for error messages in browser console
3. Verify all environment variables are set correctly
4. Ensure database tables are created (check `database/schema.sql`)
5. Make sure Supabase project is active and accessible

## 🔄 Complete Reset

If nothing works, try a complete reset:

```bash
# 1. Stop all servers
./stop-project.sh

# 2. Clear logs
rm -rf logs

# 3. Reinstall dependencies
cd backend && rm -rf node_modules && npm install && cd ..
cd frontend && rm -rf node_modules && npm install && cd ..

# 4. Start fresh
./start-project.sh
```
