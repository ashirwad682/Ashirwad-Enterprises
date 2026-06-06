
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_verified BOOLEAN DEFAULT FALSE,  -- Admin approval for ordering
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
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

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Dispatched', 'Delivered')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  pincode TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  address_line TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coupons (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('flat','percent')),
  value NUMERIC NOT NULL,
  min_amount NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_to TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '365 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON public.users(is_verified);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(active);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_dates ON public.coupons(valid_from, valid_to);


ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Everyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Everyone can view active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Service role full access users" ON public.users;

CREATE POLICY "Users can view their own profile" 
ON public.users FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.users FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can view their own orders" 
ON public.orders FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders" 
ON public.orders FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own addresses" 
ON public.addresses FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view active products" 
ON public.products FOR SELECT 
USING (is_active = true);

CREATE POLICY "Everyone can view active coupons" 
ON public.coupons FOR SELECT 
USING (active = true);

CREATE POLICY "Service role full access users"
ON public.users FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');


INSERT INTO public.products (name, category, price, stock, description) VALUES
('Pepsi Cola 2L', 'Beverages', 150.00, 100, 'Pepsi Cola - 2 Liter bottle'),
('Tropicana Orange Juice 1L', 'Juice', 180.00, 50, 'Tropicana Orange Juice'),
('Gatorade Lemon 500ml', 'Sports Drink', 80.00, 75, 'Gatorade Sports Drink - Lemon flavor'),
('7UP 1.5L', 'Beverages', 120.00, 80, '7UP - 1.5 Liter bottle'),
('Mountain Dew 2L', 'Beverages', 140.00, 90, 'Mountain Dew - 2 Liter bottle')
ON CONFLICT DO NOTHING;

INSERT INTO public.coupons (code, type, value, min_amount) VALUES
('SAVE10', 'percent', 10, 0),
('FLAT50', 'flat', 50, 199),
('WELCOME20', 'percent', 20, 299)
ON CONFLICT DO NOTHING;









CREATE OR REPLACE FUNCTION confirm_user_email(user_id UUID)
RETURNS TABLE(id UUID, email TEXT, email_confirmed_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  -- Note: This requires service role key
  -- Use backend endpoint instead: POST /api/admin/confirm-user-email
  RETURN QUERY SELECT au.id, au.email, au.email_confirmed_at FROM auth.users au WHERE au.id = user_id;
END;
$$ LANGUAGE plpgsql;

