/*
  # Add Outfit Items System

  1. New Tables
    - `look_items`
      - `id` (uuid, primary key)
      - `look_id` (uuid, references looks)
      - `item_type` (text) - Type of clothing item (haut, pantalon, veste, chaussures, accessoires, etc.)
      - `brand` (text) - Brand name
      - `link` (text, nullable) - Product link
      - `position` (integer) - Order of display (0-7)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `look_items` table
    - Add policy for authenticated users to read all items
    - Add policy for users to manage their own look items
    - Add policy for users to insert items for their own looks

  3. Important Notes
    - Users can add up to 8 items per look
    - Items will be displayed under the look's tags
    - Position determines the display order
*/

-- Create look_items table
CREATE TABLE IF NOT EXISTS look_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  look_id uuid NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  brand text NOT NULL,
  link text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_position CHECK (position >= 0 AND position < 8)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_look_items_look_id ON look_items(look_id);
CREATE INDEX IF NOT EXISTS idx_look_items_position ON look_items(look_id, position);

-- Enable RLS
ALTER TABLE look_items ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read look items
CREATE POLICY "Anyone can read look items"
  ON look_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Users can insert items for their own looks
CREATE POLICY "Users can insert items for their own looks"
  ON look_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM looks
      WHERE looks.id = look_items.look_id
      AND looks.user_id = auth.uid()
    )
  );

-- Policy: Users can update their own look items
CREATE POLICY "Users can update their own look items"
  ON look_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM looks
      WHERE looks.id = look_items.look_id
      AND looks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM looks
      WHERE looks.id = look_items.look_id
      AND looks.user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own look items
CREATE POLICY "Users can delete their own look items"
  ON look_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM looks
      WHERE looks.id = look_items.look_id
      AND looks.user_id = auth.uid()
    )
  );