-- =====================================================
-- DELIVERY ATTENDANCE MANAGEMENT SYSTEM
-- =====================================================
-- Features:
-- 1. Daily check-in/check-out attendance table with fraud flags
-- 2. Audit trail for attendance actions and admin corrections
-- 3. Salary and attendance configuration on delivery partners
-- 4. Secure private storage bucket for face captures
-- 5. Monthly attendance summary view for salary reporting

BEGIN;

-- =====================================================
-- 1) DELIVERY PARTNER CONFIGURATION COLUMNS
-- =====================================================

ALTER TABLE public.delivery_partners
  DROP COLUMN IF EXISTS assigned_route_latitude,
  DROP COLUMN IF EXISTS assigned_route_longitude,
  DROP COLUMN IF EXISTS allowed_radius_meters;

ALTER TABLE public.delivery_partners
  ADD COLUMN IF NOT EXISTS salary_per_day NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_required BOOLEAN NOT NULL DEFAULT true;

-- =====================================================
-- 2) ATTENDANCE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.delivery_partner_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_partner_id UUID NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,

  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  check_in_status TEXT NOT NULL DEFAULT 'on_time' CHECK (check_in_status IN ('on_time', 'late', 'half_day', 'manual')),
  check_out_status TEXT CHECK (check_out_status IN ('on_time', 'early', 'manual')),
  working_status TEXT NOT NULL DEFAULT 'absent' CHECK (working_status IN ('present', 'half_day', 'absent', 'manual')),
  day_fraction NUMERIC(3,1) NOT NULL DEFAULT 0 CHECK (day_fraction IN (0, 0.5, 1.0)),

  check_in_latitude DOUBLE PRECISION,
  check_in_longitude DOUBLE PRECISION,
  check_out_latitude DOUBLE PRECISION,
  check_out_longitude DOUBLE PRECISION,
  check_in_location_text TEXT,
  check_out_location_text TEXT,
  check_in_distance_meters NUMERIC(10,2),
  check_out_distance_meters NUMERIC(10,2),
  location_mismatch BOOLEAN NOT NULL DEFAULT false,

  face_check_in_path TEXT,
  face_check_out_path TEXT,
  face_check_in_hash TEXT,
  face_check_out_hash TEXT,
  face_liveness_check_in_passed BOOLEAN NOT NULL DEFAULT false,
  face_liveness_check_out_passed BOOLEAN NOT NULL DEFAULT false,

  fake_gps BOOLEAN NOT NULL DEFAULT false,
  vpn_proxy_detected BOOLEAN NOT NULL DEFAULT false,
  repeated_same_image_hash BOOLEAN NOT NULL DEFAULT false,
  impossible_travel_time BOOLEAN NOT NULL DEFAULT false,
  suspicious_early_checkout BOOLEAN NOT NULL DEFAULT false,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,

  manual_override BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  last_action_by TEXT,
  last_action_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE public.delivery_partner_attendance
    ADD CONSTRAINT uq_delivery_partner_attendance_partner_day
    UNIQUE (delivery_partner_id, attendance_date);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_partner_attendance_partner_date
  ON public.delivery_partner_attendance(delivery_partner_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_delivery_partner_attendance_date
  ON public.delivery_partner_attendance(attendance_date);

CREATE INDEX IF NOT EXISTS idx_delivery_partner_attendance_flags
  ON public.delivery_partner_attendance(location_mismatch, fake_gps, vpn_proxy_detected, repeated_same_image_hash, impossible_travel_time, suspicious_early_checkout);

-- =====================================================
-- 3) ATTENDANCE AUDIT TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.delivery_attendance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES public.delivery_partner_attendance(id) ON DELETE SET NULL,
  delivery_partner_id UUID REFERENCES public.delivery_partners(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_by TEXT NOT NULL,
  action_by_id TEXT,
  action_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_attendance_audit_partner
  ON public.delivery_attendance_audit_logs(delivery_partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_attendance_audit_attendance
  ON public.delivery_attendance_audit_logs(attendance_id);

-- =====================================================
-- 4) UPDATE TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.touch_delivery_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delivery_partner_attendance_updated_at ON public.delivery_partner_attendance;
CREATE TRIGGER trg_delivery_partner_attendance_updated_at
BEFORE UPDATE ON public.delivery_partner_attendance
FOR EACH ROW
EXECUTE FUNCTION public.touch_delivery_attendance_updated_at();

-- =====================================================
-- 5) RLS POLICIES
-- =====================================================

ALTER TABLE public.delivery_partner_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_attendance_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_attendance_service_role_all ON public.delivery_partner_attendance;
CREATE POLICY delivery_attendance_service_role_all
ON public.delivery_partner_attendance
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS delivery_attendance_audit_service_role_all ON public.delivery_attendance_audit_logs;
CREATE POLICY delivery_attendance_audit_service_role_all
ON public.delivery_attendance_audit_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- 6) SECURE FACE IMAGE BUCKET
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-attendance-faces',
  'delivery-attendance-faces',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS delivery_attendance_faces_service_role_all ON storage.objects;
CREATE POLICY delivery_attendance_faces_service_role_all
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'delivery-attendance-faces')
WITH CHECK (bucket_id = 'delivery-attendance-faces');

-- =====================================================
-- 7) MONTHLY SUMMARY VIEW
-- =====================================================

CREATE OR REPLACE VIEW public.delivery_partner_monthly_attendance_summary AS
SELECT
  a.delivery_partner_id,
  dp.delivery_partner_id AS partner_code,
  dp.name AS partner_name,
  date_trunc('month', a.attendance_date)::date AS month_start,
  COUNT(*) FILTER (WHERE a.day_fraction > 0) AS days_present,
  COUNT(*) FILTER (WHERE a.day_fraction = 1.0) AS full_days,
  COUNT(*) FILTER (WHERE a.day_fraction = 0.5) AS half_days,
  SUM(COALESCE(a.day_fraction, 0)) AS payable_days,
  COALESCE(dp.salary_per_day, 0) AS salary_per_day,
  SUM(COALESCE(a.day_fraction, 0)) * COALESCE(dp.salary_per_day, 0) AS total_salary,
  COUNT(*) FILTER (
    WHERE a.location_mismatch
      OR a.fake_gps
      OR a.vpn_proxy_detected
      OR a.repeated_same_image_hash
      OR a.impossible_travel_time
      OR a.suspicious_early_checkout
  ) AS suspicious_days
FROM public.delivery_partner_attendance a
JOIN public.delivery_partners dp ON dp.id = a.delivery_partner_id
GROUP BY
  a.delivery_partner_id,
  dp.delivery_partner_id,
  dp.name,
  date_trunc('month', a.attendance_date),
  dp.salary_per_day;

COMMIT;
