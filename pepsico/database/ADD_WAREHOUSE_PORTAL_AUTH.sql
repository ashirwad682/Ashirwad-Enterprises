-- ============================================================
-- ADD_WAREHOUSE_PORTAL_AUTH.sql
-- Enables warehouse portal login and warehouse-owned delivery logs
-- for existing databases that already ran pickup warehouse support.
-- ============================================================

ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;

ALTER TABLE delivery_logs ALTER COLUMN delivery_partner_id DROP NOT NULL;
ALTER TABLE delivery_logs ADD COLUMN IF NOT EXISTS pickup_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_warehouses_name ON warehouses(name);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_warehouse ON delivery_logs(pickup_warehouse_id);