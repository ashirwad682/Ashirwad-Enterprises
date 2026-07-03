-- Drop the image_url index that's causing size issues
-- Base64 images are too large for btree index maximum size
DROP INDEX IF EXISTS idx_products_image;

-- Image URLs don't need indexing for search/filtering purposes
-- The image data is only used for display, not queries
