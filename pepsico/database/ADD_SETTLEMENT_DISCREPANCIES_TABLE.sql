-- Create settlement discrepancies table for tracking collection reconciliation issues
CREATE TABLE IF NOT EXISTS public.settlement_discrepancies (
  id TEXT PRIMARY KEY,
  delivery_partner_id UUID,
  delivery_partner_name TEXT,
  expected_amount NUMERIC,
  received_amount NUMERIC,
  discrepancy_amount NUMERIC,
  discrepancy_type TEXT CHECK (discrepancy_type IN ('shortage', 'overage', 'damaged', 'other')),
  status TEXT CHECK (status IN ('reported', 'investigating', 'resolved', 'dismissed')) DEFAULT 'reported',
  description TEXT,
  items JSONB,
  resolution_note TEXT,
  resolved_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_settlement_discrepancies_partner ON public.settlement_discrepancies(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_settlement_discrepancies_status ON public.settlement_discrepancies(status);
CREATE INDEX IF NOT EXISTS idx_settlement_discrepancies_created_at ON public.settlement_discrepancies(created_at);
