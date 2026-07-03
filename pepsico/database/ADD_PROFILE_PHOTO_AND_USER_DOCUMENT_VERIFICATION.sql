-- Add profile photo metadata and user document verification support.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_source TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_path TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_profile_photo_source_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      DROP CONSTRAINT users_profile_photo_source_check;
  END IF;

  ALTER TABLE public.users
    ADD CONSTRAINT users_profile_photo_source_check
    CHECK (
      profile_photo_source IS NULL
      OR profile_photo_source IN (
        'upload',
        'uploaded',
        'file_upload',
        'gallery',
        'device_upload',
        'live',
        'live_photo',
        'camera',
        'capture'
      )
    );
END $$;

CREATE TABLE IF NOT EXISTS public.user_verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('aadhaar', 'pan', 'gst_certificate')),
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER CHECK (file_size > 0 AND file_size <= 5242880),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880),
  storage_path TEXT NOT NULL,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, document_type)
);

-- Backward compatibility: ensure older pre-existing tables get all required columns.
ALTER TABLE public.user_verification_documents
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.user_verification_documents
SET status = 'Pending'
WHERE status IS NULL;

UPDATE public.user_verification_documents
SET uploaded_at = NOW()
WHERE uploaded_at IS NULL;

UPDATE public.user_verification_documents
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE public.user_verification_documents
SET updated_at = NOW()
WHERE updated_at IS NULL;

-- Keep legacy and new file size columns synchronized.
UPDATE public.user_verification_documents
SET file_size = file_size_bytes
WHERE file_size IS NULL AND file_size_bytes IS NOT NULL;

UPDATE public.user_verification_documents
SET file_size_bytes = file_size
WHERE file_size_bytes IS NULL AND file_size IS NOT NULL;

-- Keep legacy file_path and new storage_path columns synchronized.
UPDATE public.user_verification_documents
SET file_path = storage_path
WHERE file_path IS NULL AND storage_path IS NOT NULL;

UPDATE public.user_verification_documents
SET storage_path = file_path
WHERE storage_path IS NULL AND file_path IS NOT NULL;

-- Legacy schemas may have NOT NULL on file_size; relax it for compatibility.
ALTER TABLE public.user_verification_documents
  ALTER COLUMN file_size DROP NOT NULL;

-- Legacy schemas may have NOT NULL on file_path; relax it for compatibility.
ALTER TABLE public.user_verification_documents
  ALTER COLUMN file_path DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_verification_documents_document_type_check'
      AND conrelid = 'public.user_verification_documents'::regclass
  ) THEN
    ALTER TABLE public.user_verification_documents
      DROP CONSTRAINT user_verification_documents_document_type_check;
  END IF;

  ALTER TABLE public.user_verification_documents
    ADD CONSTRAINT user_verification_documents_document_type_check
    CHECK (
      document_type IS NULL
      OR document_type IN ('aadhaar', 'pan', 'gst_certificate')
    );

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_verification_documents_status_check'
      AND conrelid = 'public.user_verification_documents'::regclass
  ) THEN
    ALTER TABLE public.user_verification_documents
      DROP CONSTRAINT user_verification_documents_status_check;
  END IF;

  ALTER TABLE public.user_verification_documents
    ADD CONSTRAINT user_verification_documents_status_check
    CHECK (
      status IS NULL
      OR status IN ('Pending', 'Approved', 'Rejected')
    );

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_verification_documents_file_size_bytes_check'
      AND conrelid = 'public.user_verification_documents'::regclass
  ) THEN
    ALTER TABLE public.user_verification_documents
      DROP CONSTRAINT user_verification_documents_file_size_bytes_check;
  END IF;

  ALTER TABLE public.user_verification_documents
    ADD CONSTRAINT user_verification_documents_file_size_bytes_check
    CHECK (
      file_size_bytes IS NULL
      OR (file_size_bytes > 0 AND file_size_bytes <= 5242880)
    );

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_verification_documents_file_size_check'
      AND conrelid = 'public.user_verification_documents'::regclass
  ) THEN
    ALTER TABLE public.user_verification_documents
      DROP CONSTRAINT user_verification_documents_file_size_check;
  END IF;

  ALTER TABLE public.user_verification_documents
    ADD CONSTRAINT user_verification_documents_file_size_check
    CHECK (
      file_size IS NULL
      OR (file_size > 0 AND file_size <= 5242880)
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_user_verification_documents_user
  ON public.user_verification_documents(user_id);

CREATE INDEX IF NOT EXISTS idx_user_verification_documents_status
  ON public.user_verification_documents(status);

CREATE OR REPLACE FUNCTION public.set_user_verification_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_verification_documents_updated_at
  ON public.user_verification_documents;

CREATE TRIGGER trg_user_verification_documents_updated_at
BEFORE UPDATE ON public.user_verification_documents
FOR EACH ROW
EXECUTE FUNCTION public.set_user_verification_documents_updated_at();

ALTER TABLE public.user_verification_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own verification documents"
  ON public.user_verification_documents;

CREATE POLICY "Users can view own verification documents"
ON public.user_verification_documents
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access verification documents"
  ON public.user_verification_documents;

CREATE POLICY "Service role full access verification documents"
ON public.user_verification_documents
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Public profile photos bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'user-profile-photos', 'user-profile-photos', TRUE, 5242880,
       ARRAY['image/jpeg', 'image/png']::TEXT[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'user-profile-photos'
);

-- Private verification documents bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'user-verification-documents', 'user-verification-documents', FALSE, 5242880,
       ARRAY['application/pdf', 'image/jpeg', 'image/png']::TEXT[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'user-verification-documents'
);

-- Refresh PostgREST schema cache so new columns become visible immediately.
NOTIFY pgrst, 'reload schema';
