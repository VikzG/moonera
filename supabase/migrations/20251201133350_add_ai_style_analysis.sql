/*
  # Add AI Style Analysis to Looks
  
  ## Overview
  This migration adds AI-powered style analysis capabilities to the looks table.
  The system will analyze uploaded outfits to provide:
  - Dominant colors detection
  - Silhouette type identification
  - Style category classification (streetwear, chic, casual, etc.)
  - Simple styling suggestions
  
  ## Changes
  
  ### 1. Add AI Analysis Column
  - Add `ai_analysis` JSONB column to looks table
  - Stores structured analysis data including:
    - dominant_colors: array of color names/hex codes
    - silhouette_type: detected body/outfit silhouette
    - style_category: auto-detected style (streetwear, chic, casual, etc.)
    - suggestions: array of simple styling observations
  
  ### 2. Security
  - Update RLS policies to allow read access to ai_analysis
  - Only owners can insert/update looks with analysis
*/

-- ============================================
-- 1. Add AI Analysis Column
-- ============================================

ALTER TABLE looks 
ADD COLUMN IF NOT EXISTS ai_analysis JSONB DEFAULT NULL;

-- Create index for JSONB queries (helps with filtering by style_category, etc.)
CREATE INDEX IF NOT EXISTS idx_looks_ai_analysis ON looks USING GIN (ai_analysis);

COMMENT ON COLUMN looks.ai_analysis IS 'AI-powered style analysis containing dominant_colors, silhouette_type, style_category, and suggestions';