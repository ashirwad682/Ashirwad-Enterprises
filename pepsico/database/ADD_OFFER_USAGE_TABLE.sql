-- Offer usage tracking: ensures one-time use per user per offer
-- This prevents users from reusing the same auto-applied offers

CREATE TABLE IF NOT EXISTS offer_usages (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    offer_id UUID NOT NULL,
    order_id UUID,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_offer_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_offer FOREIGN KEY(offer_id) REFERENCES offers(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_offer UNIQUE(user_id, offer_id)
);

-- Index for fast lookup when checking if user has used an offer
CREATE INDEX IF NOT EXISTS idx_offer_usages_user_offer ON offer_usages(user_id, offer_id);

-- Index for reporting: what offers were used in which orders
CREATE INDEX IF NOT EXISTS idx_offer_usages_order ON offer_usages(order_id);

-- If offer_usages already exists with order_id as INTEGER, convert to UUID
ALTER TABLE offer_usages
    ALTER COLUMN order_id TYPE UUID
    USING NULLIF(order_id::text, '')::uuid;

-- Enable RLS
ALTER TABLE offer_usages ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it already exists
DROP POLICY IF EXISTS "Users can view own offer usage" ON offer_usages;

-- Users can view their own offer usage history
CREATE POLICY "Users can view own offer usage"
ON offer_usages FOR SELECT
USING (auth.uid() = user_id);

-- System can insert offer usage records (handled by backend)
-- No direct insert policy needed as backend uses service role
