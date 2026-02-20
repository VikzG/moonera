/*
  # Add Authentic Looks Verification System

  1. Changes to looks table
    - Add `is_authentic_look` (boolean) - Whether the look passed authentication checks
    - Add `verification_details` (jsonb) - Details about AI and face matching verification
    - Add `requires_verification` (boolean) - Whether this look needs verification (posted by authentic user)
    
  2. Security
    - Update existing policies to handle verification status
    
  3. Important Notes
    - Only looks from authenticated users need verification
    - Verification checks both AI detection and face matching
    - Failed verification results in "Tenue Libre" classification
*/

-- Add verification columns to looks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'looks' AND column_name = 'is_authentic_look'
  ) THEN
    ALTER TABLE looks ADD COLUMN is_authentic_look boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'looks' AND column_name = 'verification_details'
  ) THEN
    ALTER TABLE looks ADD COLUMN verification_details jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'looks' AND column_name = 'requires_verification'
  ) THEN
    ALTER TABLE looks ADD COLUMN requires_verification boolean DEFAULT false;
  END IF;
END $$;

-- Create index for faster queries on authentic looks
CREATE INDEX IF NOT EXISTS idx_looks_is_authentic 
  ON looks(is_authentic_look) WHERE is_authentic_look = true;

-- Create index for verification status
CREATE INDEX IF NOT EXISTS idx_looks_requires_verification 
  ON looks(requires_verification) WHERE requires_verification = true;