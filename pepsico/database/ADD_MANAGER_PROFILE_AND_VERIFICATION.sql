-- Manager profile and verification schema
-- Run this in Supabase SQL editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS manager_profiles (
  manager_id UUID PRIMARY KEY REFERENCES managers(id) ON DELETE CASCADE,
  full_name TEXT,
  registered_email TEXT,
  personal_email TEXT,
  personal_email_verified BOOLEAN DEFAULT FALSE,
  personal_email_verification_token_hash TEXT,
  personal_email_verification_expires_at TIMESTAMP WITH TIME ZONE,
  mobile_number TEXT,
  address_line TEXT,
  pincode TEXT,
  state TEXT,
  district TEXT,
  profile_photo_url TEXT,
  profile_photo_path TEXT,
  profile_photo_source TEXT,
  profile_verification_status TEXT DEFAULT 'Pending Verification'
    CHECK (profile_verification_status IN ('Pending Verification', 'Under Review', 'Verified Manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manager_verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (
    document_type IN ('aadhaar', 'pan', 'bank_account_details', 'police_verification_certificate', 'passport')
  ),
  file_name TEXT,
  mime_type TEXT,
  file_size BIGINT,
  file_size_bytes BIGINT,
  file_path TEXT,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  rejection_reason TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(manager_id, document_type)
);

CREATE TABLE IF NOT EXISTS manager_password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manager_profiles_personal_email
  ON manager_profiles (personal_email);

CREATE INDEX IF NOT EXISTS idx_manager_docs_manager
  ON manager_verification_documents (manager_id);

CREATE INDEX IF NOT EXISTS idx_manager_docs_status
  ON manager_verification_documents (status);

CREATE INDEX IF NOT EXISTS idx_manager_reset_manager
  ON manager_password_reset_tokens (manager_id);

CREATE INDEX IF NOT EXISTS idx_manager_reset_expiry
  ON manager_password_reset_tokens (expires_at);
