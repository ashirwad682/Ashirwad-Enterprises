-- Managers table for RBAC
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

-- Update manager_permissions to reference managers(id)
DROP TABLE IF EXISTS manager_permissions;
CREATE TABLE IF NOT EXISTS manager_permissions (
  id SERIAL PRIMARY KEY,
  manager_id UUID REFERENCES managers(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  can_access BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(manager_id, section)
);
