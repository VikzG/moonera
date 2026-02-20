/*
  # Add Multiple Images Support to Looks
  
  ## Overview
  Updates the looks table to support up to 3 images per outfit post instead of a single image.
  Users can capture different angles of their outfits.
  
  ## Changes
  
  ### `looks` table
  - Replace `image_url` (text) with `image_urls` (text array)
  - `image_urls` will contain 1-3 image URLs
  - First image in array is the primary/cover image shown in feeds
  
  ## Migration Strategy
  - Add new column `image_urls` as array
  - Migrate existing `image_url` data to `image_urls[0]`
  - Keep `image_url` temporarily for backward compatibility
  - Future: Remove `image_url` column once frontend is fully migrated
  
  ## Security
  - RLS policies remain unchanged
  - Validation will be done at application level (max 3 images)
*/

-- Add image_urls array column to looks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'looks' AND column_name = 'image_urls'
  ) THEN
    ALTER TABLE looks ADD COLUMN image_urls text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

-- Migrate existing image_url data to image_urls array
UPDATE looks 
SET image_urls = ARRAY[image_url]
WHERE image_urls IS NULL OR array_length(image_urls, 1) IS NULL;

-- Add index for better query performance on image_urls
CREATE INDEX IF NOT EXISTS idx_looks_image_urls ON looks USING GIN(image_urls);

-- Add constraint to ensure at least one image
ALTER TABLE looks 
DROP CONSTRAINT IF EXISTS looks_image_urls_check;

ALTER TABLE looks 
ADD CONSTRAINT looks_image_urls_check 
CHECK (array_length(image_urls, 1) >= 1 AND array_length(image_urls, 1) <= 3);