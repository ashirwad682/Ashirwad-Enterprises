-- ============================================================
-- Bank Accounts Table Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE,
  delivery_partner_id UUID REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  branch_name TEXT,
  branch_address TEXT,
  state TEXT,
  district TEXT,
  upi_id TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  admin_notes TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user ON public.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_manager ON public.bank_accounts(manager_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_delivery ON public.bank_accounts(delivery_partner_id);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access bank_accounts" ON public.bank_accounts;
CREATE POLICY "Service role full access bank_accounts" ON public.bank_accounts
  FOR ALL USING (true) WITH CHECK (true);

-- Allow users to view their own bank account rows
DROP POLICY IF EXISTS "Users can view their own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users can view their own bank accounts" ON public.bank_accounts
  FOR SELECT USING (auth.uid() = user_id);
