/*
  # Add XP and Levels System
  
  ## Overview
  Implements experience points (XP), user levels, and achievement badges system.
  
  ## Changes to Existing Tables
  
  ### `profiles`
  - Add `xp` (integer) - Total experience points earned
  - Add `level` (integer) - Current user level (starts at 1)
  
  ### `badges` table modification
  - Add new badge type 'rookie' for level 5 achievement
  - Update badge_type constraint to include 'rookie'
  
  ## XP System Rules
  
  1. **Publishing Looks**: +25 XP per look posted
  2. **Deleting Looks**: -25 XP when look is deleted
  3. **Receiving Likes**: +10 XP per like received on own looks
  4. **Unliking**: -10 XP when a like is removed from own looks
  
  ## Level System
  
  - Start at level 1
  - Need 100 XP per level (level 2 = 100 XP, level 3 = 200 XP, etc.)
  - Formula: level = floor(xp / 100) + 1
  
  ## Badges
  
  - **Rookie Badge**: Awarded at level 5 (400 XP)
  - Visual badges with no social impact
  
  ## Security
  
  - RLS policies maintained on all modified tables
  - Automatic XP calculation through triggers
  - Badge creation managed by database functions
  
  ## Triggers
  
  - Auto-award XP on look creation/deletion
  - Auto-award XP on like/unlike
  - Auto-calculate level based on XP
  - Auto-award Rookie badge at level 5
*/

-- Add XP and level columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'xp'
  ) THEN
    ALTER TABLE profiles ADD COLUMN xp integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'level'
  ) THEN
    ALTER TABLE profiles ADD COLUMN level integer DEFAULT 1;
  END IF;
END $$;

-- Update badges table to support rookie badge
DROP TABLE IF EXISTS badges CASCADE;

CREATE TABLE badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_type text NOT NULL CHECK (badge_type IN ('rising_star', 'elite_style', 'legend', 'rookie')),
  achieved_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_badges_user_id ON badges(user_id);
CREATE INDEX IF NOT EXISTS idx_badges_type ON badges(badge_type);

-- Enable RLS on badges
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges are viewable by everyone"
  ON badges FOR SELECT
  TO authenticated
  USING (true);

-- Function to calculate and update user level
CREATE OR REPLACE FUNCTION calculate_user_level(user_xp integer)
RETURNS integer AS $$
BEGIN
  RETURN GREATEST(1, FLOOR(user_xp / 100.0) + 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to award XP and update level
CREATE OR REPLACE FUNCTION award_xp(p_user_id uuid, xp_amount integer)
RETURNS void AS $$
DECLARE
  old_level integer;
  new_level integer;
  new_xp integer;
BEGIN
  -- Get current level and XP
  SELECT level, xp INTO old_level, new_xp FROM profiles WHERE id = p_user_id;
  
  -- Calculate new XP (minimum 0)
  new_xp := GREATEST(0, new_xp + xp_amount);
  
  -- Calculate new level
  new_level := calculate_user_level(new_xp);
  
  -- Update profile
  UPDATE profiles 
  SET xp = new_xp, level = new_level
  WHERE id = p_user_id;
  
  -- Award Rookie badge at level 5
  IF new_level >= 5 AND old_level < 5 THEN
    INSERT INTO badges (user_id, badge_type, metadata)
    VALUES (p_user_id, 'rookie', jsonb_build_object('level_achieved', new_level))
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle XP on look creation/deletion
CREATE OR REPLACE FUNCTION handle_look_xp()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Award 25 XP for posting a look
    PERFORM award_xp(NEW.user_id, 25);
  ELSIF TG_OP = 'DELETE' THEN
    -- Deduct 25 XP for deleting a look
    PERFORM award_xp(OLD.user_id, -25);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for look XP
DROP TRIGGER IF EXISTS trigger_look_xp ON looks;
CREATE TRIGGER trigger_look_xp
AFTER INSERT OR DELETE ON looks
FOR EACH ROW
EXECUTE FUNCTION handle_look_xp();

-- Update the existing like trigger to also handle XP
DROP TRIGGER IF EXISTS trigger_update_look_likes_count ON likes;
DROP FUNCTION IF EXISTS update_look_likes_count();

CREATE OR REPLACE FUNCTION update_look_likes_count()
RETURNS TRIGGER AS $$
DECLARE
  look_owner_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get the look owner
    SELECT user_id INTO look_owner_id FROM looks WHERE id = NEW.look_id;
    
    -- Update likes count
    UPDATE looks SET likes_count = likes_count + 1 WHERE id = NEW.look_id;
    UPDATE profiles SET total_likes = total_likes + 1 WHERE id = look_owner_id;
    
    -- Award 10 XP to look owner
    PERFORM award_xp(look_owner_id, 10);
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Get the look owner
    SELECT user_id INTO look_owner_id FROM looks WHERE id = OLD.look_id;
    
    -- Update likes count
    UPDATE looks SET likes_count = likes_count - 1 WHERE id = OLD.look_id;
    UPDATE profiles SET total_likes = total_likes - 1 WHERE id = look_owner_id;
    
    -- Deduct 10 XP from look owner
    PERFORM award_xp(look_owner_id, -10);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_look_likes_count
AFTER INSERT OR DELETE ON likes
FOR EACH ROW
EXECUTE FUNCTION update_look_likes_count();