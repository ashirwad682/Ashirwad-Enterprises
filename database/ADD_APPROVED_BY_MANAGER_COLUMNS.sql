-- Add approved_by_manager_id to users and orders tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by_manager_id UUID REFERENCES managers(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_by_manager_id UUID REFERENCES managers(id);