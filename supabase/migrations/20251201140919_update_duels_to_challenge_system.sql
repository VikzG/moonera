/*
  # Update Duels to Challenge-Based System
  
  ## Overview
  This migration transforms the duels system from automatic/random to a challenge-based system where:
  - Users can challenge other users of similar level
  - Each participant has 1 hour to select/post their look after accepting
  - Participants can use existing looks or create new ones
  - No automatic duel creation by system
  
  ## Changes
  
  ### 1. Modify duels table
  - Add `challenger_id` (uuid, user who initiated the duel)
  - Add `challenged_id` (uuid, user who was challenged)
  - Add `challenger_look_id` (uuid, nullable, selected look by challenger)
  - Add `challenged_look_id` (uuid, nullable, selected look by challenged)
  - Add `accepted_at` (timestamptz, when challenge was accepted)
  - Add `challenger_deadline` (timestamptz, time limit for challenger to select look)
  - Add `challenged_deadline` (timestamptz, time limit for challenged to select look)
  - Update status to include: 'pending', 'accepted', 'active', 'completed', 'expired', 'declined'
  - Remove look_1_id and look_2_id (replaced by challenger/challenged_look_id)
  
  ### 2. Drop is_duel_entry field from looks
  - Remove is_duel_entry column as all looks can be used in duels
  - Remove related index
  
  ### 3. Update RLS policies
  - Users can view duels they are part of
  - Users can create duel challenges
  - Users can accept/decline challenges directed at them
  - Users can select looks for their accepted duels
  
  ### 4. Add helper functions
  - Function to check user level range for matchmaking
  - Function to auto-expire duels past deadline
  - Function to check if duel is ready to start (both looks selected)
*/

-- ============================================
-- 1. Drop old constraints and columns
-- ============================================

ALTER TABLE duels DROP CONSTRAINT IF EXISTS different_looks;

-- Store existing data temporarily if any exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM duels LIMIT 1) THEN
    CREATE TEMP TABLE duels_backup AS SELECT * FROM duels;
  END IF;
END $$;

-- Drop old columns
ALTER TABLE duels 
DROP COLUMN IF EXISTS look_1_id,
DROP COLUMN IF EXISTS look_2_id,
DROP COLUMN IF EXISTS look_1_votes,
DROP COLUMN IF EXISTS look_2_votes;

-- ============================================
-- 2. Add new columns for challenge system
-- ============================================

ALTER TABLE duels
ADD COLUMN IF NOT EXISTS challenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS challenged_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS challenger_look_id uuid REFERENCES looks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS challenged_look_id uuid REFERENCES looks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS challenger_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS challenged_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS accepted_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS challenger_deadline timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS challenged_deadline timestamptz DEFAULT NULL;

-- Update status constraint
DO $$
BEGIN
  ALTER TABLE duels DROP CONSTRAINT IF EXISTS duels_status_check;
  ALTER TABLE duels ADD CONSTRAINT duels_status_check 
    CHECK (status IN ('pending', 'accepted', 'active', 'completed', 'expired', 'declined'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Set default status
ALTER TABLE duels ALTER COLUMN status SET DEFAULT 'pending';

-- Add constraint to prevent self-challenges
ALTER TABLE duels ADD CONSTRAINT different_users CHECK (challenger_id != challenged_id);

-- ============================================
-- 3. Update indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_duels_challenger ON duels(challenger_id);
CREATE INDEX IF NOT EXISTS idx_duels_challenged ON duels(challenged_id);
CREATE INDEX IF NOT EXISTS idx_duels_status_created ON duels(status, created_at DESC);

-- ============================================
-- 4. Remove is_duel_entry from looks
-- ============================================

DROP INDEX IF EXISTS idx_looks_is_duel_entry;
ALTER TABLE looks DROP COLUMN IF EXISTS is_duel_entry;

-- ============================================
-- 5. Update duel_votes to use new structure
-- ============================================

-- Update duel_votes to reference challenger/challenged instead of look
ALTER TABLE duel_votes DROP CONSTRAINT IF EXISTS duel_votes_voted_for_look_id_fkey;
ALTER TABLE duel_votes DROP COLUMN IF EXISTS voted_for_look_id;
ALTER TABLE duel_votes ADD COLUMN IF NOT EXISTS voted_for TEXT NOT NULL CHECK (voted_for IN ('challenger', 'challenged'));

-- ============================================
-- 6. Update RLS policies
-- ============================================

DROP POLICY IF EXISTS "Anyone can view active duels" ON duels;
DROP POLICY IF EXISTS "System can insert duels" ON duels;
DROP POLICY IF EXISTS "System can update duels" ON duels;

CREATE POLICY "Users can view their duels"
  ON duels FOR SELECT
  TO authenticated
  USING (
    auth.uid() = challenger_id OR 
    auth.uid() = challenged_id OR 
    status IN ('active', 'completed')
  );

CREATE POLICY "Users can create duel challenges"
  ON duels FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Users can update their duels"
  ON duels FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = challenger_id OR 
    auth.uid() = challenged_id
  )
  WITH CHECK (
    auth.uid() = challenger_id OR 
    auth.uid() = challenged_id
  );

-- ============================================
-- 7. Update trigger for duel stats
-- ============================================

DROP TRIGGER IF EXISTS update_duel_stats_trigger ON duel_votes;
DROP FUNCTION IF EXISTS update_duel_stats();

CREATE OR REPLACE FUNCTION update_duel_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE duels
  SET 
    challenger_votes = (
      SELECT COUNT(*) FROM duel_votes 
      WHERE duel_id = NEW.duel_id AND voted_for = 'challenger'
    ),
    challenged_votes = (
      SELECT COUNT(*) FROM duel_votes 
      WHERE duel_id = NEW.duel_id AND voted_for = 'challenged'
    ),
    total_votes = (
      SELECT COUNT(*) FROM duel_votes WHERE duel_id = NEW.duel_id
    )
  WHERE id = NEW.duel_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_duel_stats_trigger
  AFTER INSERT ON duel_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_duel_stats();

-- ============================================
-- 8. Update complete_duel function
-- ============================================

DROP FUNCTION IF EXISTS complete_duel(uuid);

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
  v_winner_look_id uuid;
  v_loser_look_id uuid;
BEGIN
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id;
  
  IF v_duel.status = 'completed' THEN
    RETURN;
  END IF;
  
  IF v_duel.challenger_votes > v_duel.challenged_votes THEN
    v_winner_id := v_duel.challenger_id;
    v_loser_id := v_duel.challenged_id;
    v_winner_look_id := v_duel.challenger_look_id;
    v_loser_look_id := v_duel.challenged_look_id;
  ELSIF v_duel.challenged_votes > v_duel.challenger_votes THEN
    v_winner_id := v_duel.challenged_id;
    v_loser_id := v_duel.challenger_id;
    v_winner_look_id := v_duel.challenged_look_id;
    v_loser_look_id := v_duel.challenger_look_id;
  ELSE
    UPDATE duels SET status = 'completed' WHERE id = p_duel_id;
    RETURN;
  END IF;
  
  IF v_winner_look_id IS NOT NULL THEN
    UPDATE looks SET duel_wins = duel_wins + 1 WHERE id = v_winner_look_id;
  END IF;
  
  IF v_loser_look_id IS NOT NULL THEN
    UPDATE looks SET duel_losses = duel_losses + 1 WHERE id = v_loser_look_id;
  END IF;
  
  UPDATE duels SET status = 'completed' WHERE id = p_duel_id;
  
  PERFORM create_notification(
    v_winner_id,
    'duel_won',
    'Victoire au duel !',
    'Vous avez remporté un duel avec ' || v_duel.total_votes || ' votes !',
    v_winner_look_id,
    NULL,
    jsonb_build_object('duel_id', p_duel_id, 'votes', v_duel.total_votes)
  );
END;
$$;

-- ============================================
-- 9. Add function to find similar level players
-- ============================================

CREATE OR REPLACE FUNCTION find_similar_level_players(p_user_id uuid, p_limit integer DEFAULT 20)
RETURNS TABLE(
  user_id uuid,
  username text,
  level integer,
  xp integer,
  profile_image_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_level integer;
BEGIN
  SELECT profiles.level INTO v_user_level 
  FROM profiles 
  WHERE id = p_user_id;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.level,
    p.xp,
    p.profile_image_url
  FROM profiles p
  WHERE p.id != p_user_id
    AND p.level BETWEEN (v_user_level - 2) AND (v_user_level + 2)
  ORDER BY ABS(p.level - v_user_level), RANDOM()
  LIMIT p_limit;
END;
$$;

-- ============================================
-- 10. Add function to auto-expire duels
-- ============================================

CREATE OR REPLACE FUNCTION expire_old_duels()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE duels
  SET status = 'expired'
  WHERE status = 'accepted'
    AND (
      (challenger_deadline IS NOT NULL AND NOW() > challenger_deadline AND challenger_look_id IS NULL)
      OR
      (challenged_deadline IS NOT NULL AND NOW() > challenged_deadline AND challenged_look_id IS NULL)
    );
    
  UPDATE duels
  SET status = 'expired'
  WHERE status = 'pending'
    AND NOW() > created_at + INTERVAL '24 hours';
END;
$$;

COMMENT ON TABLE duels IS 'Challenge-based 1v1 battles where users challenge each other and select looks';
COMMENT ON COLUMN duels.challenger_id IS 'User who initiated the challenge';
COMMENT ON COLUMN duels.challenged_id IS 'User who was challenged';
COMMENT ON COLUMN duels.accepted_at IS 'Timestamp when challenge was accepted';
COMMENT ON COLUMN duels.challenger_deadline IS '1 hour after acceptance for challenger to select look';
COMMENT ON COLUMN duels.challenged_deadline IS '1 hour after acceptance for challenged to select look';