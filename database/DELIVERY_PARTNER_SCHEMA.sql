-- Delivery Partners Table
CREATE TABLE IF NOT EXISTS delivery_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_partner_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  assigned_area TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add delivery partner fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner_id UUID REFERENCES delivery_partners(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'assigned', 'packed', 'dispatched', 'out_for_delivery', 'delivered'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_amount_received DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_confirmed_by UUID REFERENCES delivery_partners(id);

-- OTP Table for Delivery Verification
CREATE TABLE IF NOT EXISTS delivery_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  otp TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Delivery Logs for Audit Trail
CREATE TABLE IF NOT EXISTS delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id),
  event_type TEXT NOT NULL,
  event_details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_partners_email ON delivery_partners(email);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_id ON delivery_partners(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner ON orders(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_otps_order ON delivery_otps(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_order ON delivery_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_partner ON delivery_logs(delivery_partner_id);
