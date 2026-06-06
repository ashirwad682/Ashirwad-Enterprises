-- Table to store manager section permissions
CREATE TABLE IF NOT EXISTS managers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manager_permissions (
  id SERIAL PRIMARY KEY,
  manager_id UUID REFERENCES managers(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  can_access BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(manager_id, section)
);
-- PepsiCo Distribution Portal Database Schema
-- Run this SQL in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'manager')),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock INTEGER DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Dispatched', 'Delivered')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pincode TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  address_line TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'flat' CHECK (discount_type IN ('flat', 'percent')),
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_amount NUMERIC(10,2) DEFAULT 0,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  start_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coupons (optional)
CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('flat','percent')),
  value NUMERIC NOT NULL,
  min_amount NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_to TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '365 days')
);

-- Sample coupons
INSERT INTO coupons (code, type, value, min_amount) VALUES
  ('SAVE10', 'percent', 10, 0)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.uid() = id);

-- Avoid recursive self-selects that can trigger infinite recursion errors.
CREATE POLICY "Service role full access users" ON users
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admin can manage products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Verified users can create orders" ON orders
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_verified = TRUE
    )
  );

CREATE POLICY "Admin can view all orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update orders" ON orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can manage own addresses" ON addresses
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admin can create notifications" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

INSERT INTO products (name, category, price, stock, description) VALUES
  ('Pepsi 2L', 'Soft Drinks', 90.00, 100, 'Pepsi Cola 2 Liter Bottle'),
  ('Mountain Dew 1L', 'Soft Drinks', 50.00, 150, 'Mountain Dew 1 Liter'),
  ('Lays Classic 50g', 'Snacks & Beverages', 20.00, 200, 'Lays Classic Salted Chips'),
  ('Kurkure Masala 40g', 'Snacks & Beverages', 15.00, 180, 'Kurkure Masala Munch'),
  ('Sting Energy 250ml', 'Energy Drinks', 30.00, 120, 'Sting Energy Drink'),
  ('Gatorade 500ml', 'Energy Drinks', 60.00, 80, 'Gatorade Sports Drink'),
  ('Quaker Oats 1kg', 'Packaged Foods', 180.00, 60, 'Quaker Whole Grain Oats'),
  ('Tropicana Juice 1L', 'Snacks & Beverages', 110.00, 90, 'Tropicana Orange Juice');
