-- ============================================================
-- ADD_PICKUP_WAREHOUSE_SUPPORT.sql
-- Adds Pickup & Drive shipping support:
--   1. warehouses table for self-pickup locations
--   2. New columns on orders for pickup flow
-- ============================================================

-- 1. Warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT        NOT NULL,
  address          TEXT        NOT NULL,
  contact_number   TEXT,
  password_hash    TEXT,
  password_set_at  TIMESTAMPTZ,
  password_updated_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_warehouses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_warehouses_updated_at ON warehouses;
CREATE TRIGGER trg_warehouses_updated_at
  BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION update_warehouses_updated_at();

-- 2. New columns on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method        TEXT        DEFAULT 'standard';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_order           BOOLEAN     DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_available_from  TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_available_until TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_warehouse_id    UUID        REFERENCES warehouses(id) ON DELETE SET NULL;

-- 2b. Allow delivery journey logs to be written by warehouses too
ALTER TABLE delivery_logs ALTER COLUMN delivery_partner_id DROP NOT NULL;
ALTER TABLE delivery_logs ADD COLUMN IF NOT EXISTS pickup_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

-- 3. Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_orders_shipping_method   ON orders(shipping_method);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_order      ON orders(pickup_order) WHERE pickup_order = TRUE;
CREATE INDEX IF NOT EXISTS idx_orders_pickup_warehouse  ON orders(pickup_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_name          ON warehouses(name);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_warehouse  ON delivery_logs(pickup_warehouse_id);
