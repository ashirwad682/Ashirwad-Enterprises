-- ============================================================
-- SALARY AND REFUND MANAGEMENT DATABASE SCHEMA
-- ============================================================

BEGIN;

-- 1) Configure Managers Table
ALTER TABLE public.managers
  ADD COLUMN IF NOT EXISTS base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payroll_schedule TEXT NOT NULL DEFAULT 'monthly';

-- 2) Configure Delivery Partners Table
ALTER TABLE public.delivery_partners
  ADD COLUMN IF NOT EXISTS pay_per_delivery NUMERIC(10,2) NOT NULL DEFAULT 50.00;

-- 3) Create Salaries Table
CREATE TABLE IF NOT EXISTS public.salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID REFERENCES public.managers(id) ON DELETE SET NULL,
  delivery_partner_id UUID REFERENCES public.delivery_partners(id) ON DELETE SET NULL,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  working_days NUMERIC(4,1) NOT NULL DEFAULT 0,
  days_present NUMERIC(4,1) NOT NULL DEFAULT 0,
  completed_deliveries INT NOT NULL DEFAULT 0,
  base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  incentives NUMERIC(10,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed')),
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  payment_date TIMESTAMP WITH TIME ZONE,
  transaction_id TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4) Create Refunds Table
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed')),
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  payment_date TIMESTAMP WITH TIME ZONE,
  transaction_id TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5) Indexes
CREATE INDEX IF NOT EXISTS idx_salaries_manager ON public.salaries(manager_id);
CREATE INDEX IF NOT EXISTS idx_salaries_delivery_partner ON public.salaries(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_refunds_user ON public.refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON public.refunds(order_id);

-- 6) Enable RLS
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- 7) Add Service Role Policies (full access for admin backend scripts)
DROP POLICY IF EXISTS "Service role full access salaries" ON public.salaries;
CREATE POLICY "Service role full access salaries" ON public.salaries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access refunds" ON public.refunds;
CREATE POLICY "Service role full access refunds" ON public.refunds
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
