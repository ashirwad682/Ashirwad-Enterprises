# PepsiCo Distributor E‑Commerce (React + Node + Supabase)

This project provides a simple e‑commerce portal for a PepsiCo distributor:
- React frontend (products, cart, checkout, login/register)
- Node.js/Express backend (products and orders)
- Supabase for auth and data (Postgres + RLS)

## Prerequisites
- Node.js 18+
- A Supabase project (URL + anon + service role secret)

## Configuration
Create environment files with your Supabase credentials:

Backend: `/backend/.env`
```
SUPABASE_URL=https://kpnvvrmvwfztkfxdsrrb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_SECRET
PORT=5000
```

Frontend: `/frontend/.env.local`
```
VITE_SUPABASE_URL=https://kpnvvrmvwfztkfxdsrrb.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
VITE_API_BASE=http://localhost:5000
```

## Database Setup
Copy the SQL in `/database/schema.sql` and run it in the Supabase SQL editor.
- Adds `products`, `orders`, `users` profile table, addresses, notifications
- Enables RLS and policies
- Seeds sample PepsiCo products

After creating a Supabase auth user for admin, link it:
```
INSERT INTO users (id, email, full_name, role, is_verified)
VALUES ('<admin-auth-user-id>', 'admin@system.com', 'System Admin', 'admin', TRUE);
```

## Run Locally
Backend:
```
cd backend
npm install
npm run dev
```

Frontend:
```
cd frontend
npm install
npm run dev
```

Open the frontend (Vite) URL it prints (usually http://localhost:5173). Ensure backend runs at `http://localhost:5000`.

## Features
- Browse active products from Supabase (`products`)
- Add to cart, update quantities
- Checkout creates orders in Supabase using backend service role
- Login/Register via Supabase Auth

## Notes
- Do not expose the service role key in frontend. It must only live in backend.
- You can expand backend with admin endpoints for product and order management.

