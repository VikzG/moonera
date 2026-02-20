/*
  # Add Duels System
  
  ## Overview
  This migration creates a complete 1v1 duel system where users can battle with their outfits.
  Users can upload looks with images (up to 3) and an optional 30-second video presentation.
  
  ## Changes
  
  ### 1. New Tables
  
  #### `duels`
  Represents a 1v1 battle between two looks
  - `id` (uuid, primary key)
  - `look_1_id` (uuid, foreign key to looks)
  - `look_2_id` (uuid, foreign key to looks)
  - `status` (text: 'active', 'completed')
  - `total_votes` (integer)
  - `look_1_votes` (integer)
  - `look_2_votes` (integer)
  - `category` (text, optional filter)
  - `created_at` (timestamptz)
  - `expires_at` (timestamptz, optional time limit)
  
  #### `duel_votes`
  Tracks individual user votes on duels
  - `id` (uuid, primary key)
  - `duel_id` (uuid, foreign key to duels)
  - `user_id` (uuid, foreign key to auth.users)
  - `voted_for_look_id` (uuid, foreign key to looks)
  - `created_at` (timestamptz)
  - Unique constraint on (duel_id, user_id) to prevent double voting
  
  ### 2. Modify `looks` table
  - Add `video_url` column for optional 30-second video presentation
  - Add `is_duel_entry` boolean flag to identify duel-specific looks
  - Add `duel_wins` counter
  - Add `duel_losses` counter
  
  ### 3. Security
  - Enable RLS on all new tables
  - Users can read all duels and votes
  - Only authenticated users can vote
  - Users can only vote once per duel
  - System creates duels automatically or via admin
  
  ### 4. Indexes
  - Index on duels.status for filtering active duels
  - Index on duel_votes (duel_id, user_id) for vote checking
  - Index on looks (is_duel_entry) for duel-specific queries
*/

-- ============================================
-- 1. Modify looks table for video support
-- ============================================

ALTER TABLE looks 
ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_duel_entry BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS duel_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS duel_losses INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_looks_is_duel_entry ON looks(is_duel_entry) WHERE is_duel_entry = true;

COMMENT ON COLUMN looks.video_url IS 'Optional 30-second video URL for look presentation';
COMMENT ON COLUMN looks.is_duel_entry IS 'Flag to identify looks created specifically for duels';
COMMENT ON COLUMN looks.duel_wins IS 'Total number of duel victories for this look';
COMMENT ON COLUMN looks.duel_losses IS 'Total number of duel defeats for this look';

-- ============================================
-- 2. Create duels table
-- ============================================

CREATE TABLE IF NOT EXISTS duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  look_1_id uuid NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  look_2_id uuid NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  total_votes INTEGER DEFAULT 0,
  look_1_votes INTEGER DEFAULT 0,
  look_2_votes INTEGER DEFAULT 0,
  category TEXT DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT NULL,
  CONSTRAINT different_looks CHECK (look_1_id != look_2_id)
);

CREATE INDEX IF NOT EXISTS idx_duels_status ON duels(status);
CREATE INDEX IF NOT EXISTS idx_duels_category ON duels(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_duels_created_at ON duels(created_at DESC);

COMMENT ON TABLE duels IS '1v1 battles between two looks where users vote for their favorite';
COMMENT ON COLUMN duels.status IS 'active: ongoing, completed: finished';
COMMENT ON COLUMN duels.expires_at IS 'Optional expiration time for time-limited duels';

-- ============================================
-- 3. Create duel_votes table
-- ============================================

CREATE TABLE IF NOT EXISTS duel_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voted_for_look_id uuid NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(duel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_duel_votes_duel_user ON duel_votes(duel_id, user_id);
CREATE INDEX IF NOT EXISTS idx_duel_votes_user ON duel_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_duel_votes_look ON duel_votes(voted_for_look_id);

COMMENT ON TABLE duel_votes IS 'Tracks user votes on duels - one vote per user per duel';

-- ============================================
-- 4. Create function to update duel stats
-- ============================================

CREATE OR REPLACE FUNCTION update_duel_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_duel duels%ROWTYPE;
BEGIN
  SELECT * INTO v_duel FROM duels WHERE id = NEW.duel_id;
  
  UPDATE duels
  SET 
    look_1_votes = (
      SELECT COUNT(*) FROM duel_votes 
      WHERE duel_id = NEW.duel_id AND voted_for_look_id = v_duel.look_1_id
    ),
    look_2_votes = (
      SELECT COUNT(*) FROM duel_votes 
      WHERE duel_id = NEW.duel_id AND voted_for_look_id = v_duel.look_2_id
    ),
    total_votes = (
      SELECT COUNT(*) FROM duel_votes WHERE duel_id = NEW.duel_id
    )
  WHERE id = NEW.duel_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to update duel stats after vote
DROP TRIGGER IF EXISTS update_duel_stats_trigger ON duel_votes;
CREATE TRIGGER update_duel_stats_trigger
  AFTER INSERT ON duel_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_duel_stats();

-- ============================================
-- 5. Create function to complete duel and update look stats
-- ============================================

CREATE OR REPLACE FUNCTION complete_duel(p_duel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_duel duels%ROWTYPE;
  v_winner_id uuid;
  v_loser_id uuid;
BEGIN
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id;
  
  IF v_duel.status = 'completed' THEN
    RETURN;
  END IF;
  
  IF v_duel.look_1_votes > v_duel.look_2_votes THEN
    v_winner_id := v_duel.look_1_id;
    v_loser_id := v_duel.look_2_id;
  ELSIF v_duel.look_2_votes > v_duel.look_1_votes THEN
    v_winner_id := v_duel.look_2_id;
    v_loser_id := v_duel.look_1_id;
  ELSE
    UPDATE duels SET status = 'completed' WHERE id = p_duel_id;
    RETURN;
  END IF;
  
  UPDATE looks SET duel_wins = duel_wins + 1 WHERE id = v_winner_id;
  UPDATE looks SET duel_losses = duel_losses + 1 WHERE id = v_loser_id;
  
  UPDATE duels SET status = 'completed' WHERE id = p_duel_id;
  
  PERFORM create_notification(
    (SELECT user_id FROM looks WHERE id = v_winner_id),
    'duel_won',
    'Victoire au duel !',
    'Vous avez remporté un duel avec ' || v_duel.total_votes || ' votes !',
    v_winner_id,
    NULL,
    jsonb_build_object('duel_id', p_duel_id, 'votes', v_duel.look_1_votes + v_duel.look_2_votes)
  );
END;
$$;

-- ============================================
-- 6. Enable RLS
-- ============================================

ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE duel_votes ENABLE ROW LEVEL SECURITY;

-- Duels policies
CREATE POLICY "Anyone can view active duels"
  ON duels FOR SELECT
  USING (true);

CREATE POLICY "System can insert duels"
  ON duels FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update duels"
  ON duels FOR UPDATE
  TO authenticated
  USING (true);

-- Duel votes policies
CREATE POLICY "Users can view all votes"
  ON duel_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can vote"
  ON duel_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users cannot delete votes"
  ON duel_votes FOR DELETE
  TO authenticated
  USING (false);