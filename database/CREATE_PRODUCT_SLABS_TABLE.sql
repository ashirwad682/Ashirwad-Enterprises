-- Product Slab Table for Quantity-based Discounts
CREATE TABLE IF NOT EXISTS product_slabs (
    id SERIAL PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    min_quantity INTEGER NOT NULL CHECK (min_quantity > 0),
    discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup of slabs by product
CREATE INDEX IF NOT EXISTS idx_product_slabs_product ON product_slabs (product_id);
