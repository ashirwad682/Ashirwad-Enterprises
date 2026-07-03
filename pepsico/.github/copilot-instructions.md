# AI Coding Agent Instructions for PepsiCo Distributor E‑Commerce

## Project Overview
- **Architecture:**
  - React frontend (`frontend/`), Node.js/Express backend (`backend/`), Supabase (Postgres + Auth) for data and authentication.
  - Data flow: Frontend → Backend (API) → Supabase. Backend uses service role for privileged actions.
  - Email notifications via Nodemailer/Handlebars templates in `backend/email-templates/`.
  - Razorpay integration for payments (optional, backend only).

## Key Workflows
- **Local Development:**
  - Backend: `cd backend && npm install && npm run dev` (uses `server.js`)
  - Frontend: `cd frontend && npm install && npm run dev` (uses Vite)
  - Environment variables: see `/backend/.env` and `/frontend/.env.local` (never expose service role key to frontend)
  - Database: Run `/database/schema.sql` in Supabase SQL editor to initialize tables and policies.
- **Testing:**
  - Backend: `npm test` (Jest, see `backend/tests/`)
- **Email:**
  - Templates in `backend/email-templates/`, logic in `backend/lib/emailer.js`.
  - Email sending requires proper SMTP config in backend `.env`.
- **Admin/Delivery:**
  - Admin and delivery partner flows are separated in both frontend (see `context/`, `pages/`) and backend (see `routes/delivery.js`).

## Project-Specific Patterns
- **Supabase:**
  - Backend uses service role key for privileged DB access; frontend uses anon key for user actions.
  - RLS (Row Level Security) is enabled; policies are defined in SQL.
- **Frontend:**
  - Uses React Context for cart, admin, and delivery partner auth (`frontend/src/context/`).
  - Routing: All dashboard/admin/delivery routes are protected by custom route components.
- **Backend:**
  - All API routes expect JSON; CORS enabled.
  - Delivery status flow is normalized in `routes/delivery.js` (`DELIVERY_FLOW`).
  - Emailer loads and compiles templates at startup; fallback templates are provided if missing.

## Integration Points
- **Supabase:**
  - All user/product/order data is stored in Supabase; see `database/schema.sql` for structure.
- **Razorpay:**
  - Payment integration is optional; only enabled if keys are present in backend `.env`.
- **Email:**
  - All notification emails are sent from backend using templates.

## Conventions
- **Never expose backend secrets to frontend.**
- **Keep all business logic in backend; frontend only calls APIs.**
- **Use provided SQL for DB setup and updates.**
- **Follow existing file/module structure for new features.**

## References
- See `README.md` for setup, `.env` examples, and workflow details.
- See `backend/routes/`, `frontend/src/pages/`, and `database/schema.sql` for main logic and data flows.
