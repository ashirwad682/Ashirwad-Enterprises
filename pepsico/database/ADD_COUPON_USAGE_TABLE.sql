-- Coupon usage tracking: ensures one-time use per user
CREATE TABLE IF NOT EXISTS coupon_usages (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    coupon_code VARCHAR(64) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_coupon FOREIGN KEY(coupon_code) REFERENCES coupons(code) ON DELETE CASCADE,
    CONSTRAINT unique_user_coupon UNIQUE(user_id, coupon_code)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_coupon ON coupon_usages(user_id, coupon_code);