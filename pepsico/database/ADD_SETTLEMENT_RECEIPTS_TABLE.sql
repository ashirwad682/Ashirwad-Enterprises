-- Create settlement receipts table for collection reconciliation history
CREATE TABLE IF NOT EXISTS public.settlement_receipts (
  id TEXT PRIMARY KEY,
  delivery_partner_id UUID,
  delivery_partner_name TEXT,
  total_assigned NUMERIC,
  total_collected NUMERIC,
  total_settled NUMERIC,
  cash_received NUMERIC,
  difference NUMERIC,
  note TEXT,
  items JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_receipts_partner ON public.settlement_receipts(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_settlement_receipts_created_at ON public.settlement_receipts(created_at);
