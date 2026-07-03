-- Delivery Partner Profile and Verification Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add profile verification fields to delivery_partners table
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS address_state TEXT;
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS address_pincode TEXT;
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS vehicle_number TEXT;
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS profile_photo_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS profile_details_locked BOOLEAN DEFAULT FALSE;

-- Ensure constraints and default status are safely set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'delivery_partners' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE delivery_partners ADD COLUMN verification_status TEXT DEFAULT 'pending';
  END IF;
END $$;

ALTER TABLE delivery_partners DROP CONSTRAINT IF EXISTS delivery_partners_verification_status_check;
ALTER TABLE delivery_partners ADD CONSTRAINT delivery_partners_verification_status_check 
  CHECK (verification_status IN ('pending', 'under_review', 'approved', 'rejected'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'delivery_partners' AND column_name = 'overall_approval_status'
  ) THEN
    ALTER TABLE delivery_partners ADD COLUMN overall_approval_status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- Create delivery_partner_documents table for uploading Aadhaar, DL, Vehicle RC, and Live Profile Photo
CREATE TABLE IF NOT EXISTS delivery_partner_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('aadhaar', 'driving_license', 'profile_photo', 'vehicle_rc')),
  file_name TEXT,
  storage_path TEXT,
  file_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (delivery_partner_id, document_type)
);

-- Create audit log table for tracking document verification actions
CREATE TABLE IF NOT EXISTS delivery_partner_verification_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_partner_id UUID REFERENCES delivery_partners(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  document_type TEXT,
  old_status TEXT,
  new_status TEXT,
  rejection_reason TEXT,
  performed_by TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Create indexes for optimization
CREATE INDEX IF NOT EXISTS idx_dp_docs_partner ON delivery_partner_documents(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_dp_docs_status ON delivery_partner_documents(status);
CREATE INDEX IF NOT EXISTS idx_dp_audit_partner ON delivery_partner_verification_audit(delivery_partner_id);

-- Create or update update_at trigger function if not exists
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delivery_partner_documents_updated_at ON delivery_partner_documents;
CREATE TRIGGER trg_delivery_partner_documents_updated_at
BEFORE UPDATE ON delivery_partner_documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Register dedicated Supabase storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'delivery-partner-profile-photos', 'delivery-partner-profile-photos', TRUE, 5242880,
       ARRAY['image/jpeg', 'image/png']::TEXT[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'delivery-partner-profile-photos'
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'delivery-partner-documents', 'delivery-partner-documents', FALSE, 5242880,
       ARRAY['application/pdf', 'image/jpeg', 'image/png']::TEXT[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'delivery-partner-documents'
);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
