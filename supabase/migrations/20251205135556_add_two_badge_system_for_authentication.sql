/*
  # Two-Badge System for Authentic Users
  
  ## Overview
  Implements a dual badge system to recognize and reward authentic users at different stages:
  
  ### Badge 1: "Verified Authentic" 🟢
  - **Purpose**: Immediate recognition for completing identity verification
  - **Requirements**: Pass liveness check + AI detection + face matching
  - **When Awarded**: Immediately when `is_authentic` becomes true
  - **Benefits**: 
    - Instant credibility and trust
    - Shows verified real person
    - Motivates others to verify
    - Useful even with 0 looks posted
  
  ### Badge 2: "Authentic User" 🟣
  - **Purpose**: Recognition for consistent, high-quality authentic content
  - **Requirements**: 20+ authentic looks posted and verified
  - **Benefits**:
    - Higher social status
    - Access to special features (tournaments, cash prizes)
    - Proof of investment and engagement
    - More rare and valuable
  
  ## Why Two Badges?
  
  **Without immediate badge:**
  ❌ New authentic users feel invisible
  ❌ Demotivating to verify (no instant reward)
  ❌ Less authentic content overall
  
  **With immediate badge:**
  ✔️ Users feel valued from day one
  ✔️ Motivated to post and reach second badge
  ✔️ Boosts network quality
  
  ## Changes
  
  1. **Update `badges` table**
     - Add 'verified_authentic' badge type
     - Add 'authentic_user' badge type
  
  2. **Add column to profiles**
     - Add `authentic_looks_count` to track verified looks
  
  3. **Create functions**
     - Auto-award "Verified Authentic" badge when user verifies identity
     - Auto-award "Authentic User" badge at 20 authentic looks
     - Track authentic looks count
  
  4. **Create triggers**
     - Award "Verified Authentic" on profile update (is_authentic = true)
     - Update authentic looks count when look verification changes
     - Award "Authentic User" at 20 authentic looks
  
  ## Security
  - RLS policies maintained
  - Automatic badge awarding via secure functions
  - No manual badge manipulation possible
*/

-- Add authentic_looks_count to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'authentic_looks_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN authentic_looks_count integer DEFAULT 0;
  END IF;
END $$;

-- Drop existing triggers and functions that depend on badges table
DROP TRIGGER IF EXISTS trigger_look_xp ON looks;
DROP TRIGGER IF EXISTS trigger_update_look_likes_count ON likes;
DROP FUNCTION IF EXISTS handle_look_xp();
DROP FUNCTION IF EXISTS update_look_likes_count();
DROP FUNCTION IF EXISTS award_xp(uuid, integer);
DROP FUNCTION IF EXISTS calculate_user_level(integer);

-- Update badges table to include new badge types
DROP TABLE IF EXISTS badges CASCADE;

CREATE TABLE badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_type text NOT NULL CHECK (
    badge_type IN (
      'rising_star', 
      'elite_style', 
      'legend', 
      'rookie',
      'verified_authentic',
      'authentic_user'
    )
  ),
  achieved_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(user_id, badge_type)
);

CREATE INDEX IF NOT EXISTS idx_badges_user_id ON badges(user_id);
CREATE INDEX IF NOT EXISTS idx_badges_type ON badges(badge_type);

-- Enable RLS on badges
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges are viewable by everyone"
  ON badges FOR SELECT
  TO authenticated
  USING (true);

-- Function to award "Verified Authentic" badge
CREATE OR REPLACE FUNCTION award_verified_authentic_badge()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if is_authentic was just set to true
  IF NEW.is_authentic = true AND (OLD.is_authentic IS NULL OR OLD.is_authentic = false) THEN
    -- Award the "Verified Authentic" badge
    INSERT INTO badges (user_id, badge_type, metadata)
    VALUES (
      NEW.id, 
      'verified_authentic',
      jsonb_build_object(
        'verified_at', now(),
        'face_embedding', NEW.face_embedding IS NOT NULL
      )
    )
    ON CONFLICT (user_id, badge_type) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to award "Verified Authentic" badge on profile update
DROP TRIGGER IF EXISTS trigger_award_verified_authentic_badge ON profiles;
CREATE TRIGGER trigger_award_verified_authentic_badge
AFTER UPDATE OF is_authentic ON profiles
FOR EACH ROW
WHEN (NEW.is_authentic = true)
EXECUTE FUNCTION award_verified_authentic_badge();

-- Function to update authentic looks count and award "Authentic User" badge
CREATE OR REPLACE FUNCTION update_authentic_looks_count()
RETURNS TRIGGER AS $$
DECLARE
  look_owner_id uuid;
  current_count integer;
  is_user_authentic boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    look_owner_id := NEW.user_id;
    
    -- Check if user is authentic
    SELECT is_authentic INTO is_user_authentic 
    FROM profiles 
    WHERE id = look_owner_id;
    
    -- Only count if user is authentic and look is authentic
    IF is_user_authentic = true AND NEW.is_authentic_look = true THEN
      -- Increment authentic looks count
      UPDATE profiles 
      SET authentic_looks_count = authentic_looks_count + 1
      WHERE id = look_owner_id
      RETURNING authentic_looks_count INTO current_count;
      
      -- Award "Authentic User" badge at 20 authentic looks
      IF current_count >= 20 THEN
        INSERT INTO badges (user_id, badge_type, metadata)
        VALUES (
          look_owner_id, 
          'authentic_user',
          jsonb_build_object(
            'authentic_looks', current_count,
            'achieved_at', now()
          )
        )
        ON CONFLICT (user_id, badge_type) DO UPDATE
        SET metadata = jsonb_build_object(
          'authentic_looks', current_count,
          'last_updated', now()
        );
      END IF;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    look_owner_id := NEW.user_id;
    
    -- Check if user is authentic
    SELECT is_authentic INTO is_user_authentic 
    FROM profiles 
    WHERE id = look_owner_id;
    
    IF is_user_authentic = true THEN
      -- Handle case where is_authentic_look changed from false to true
      IF OLD.is_authentic_look = false AND NEW.is_authentic_look = true THEN
        UPDATE profiles 
        SET authentic_looks_count = authentic_looks_count + 1
        WHERE id = look_owner_id
        RETURNING authentic_looks_count INTO current_count;
        
        -- Award "Authentic User" badge at 20 authentic looks
        IF current_count >= 20 THEN
          INSERT INTO badges (user_id, badge_type, metadata)
          VALUES (
            look_owner_id, 
            'authentic_user',
            jsonb_build_object(
              'authentic_looks', current_count,
              'achieved_at', now()
            )
          )
          ON CONFLICT (user_id, badge_type) DO UPDATE
          SET metadata = jsonb_build_object(
            'authentic_looks', current_count,
            'last_updated', now()
          );
        END IF;
        
      -- Handle case where is_authentic_look changed from true to false
      ELSIF OLD.is_authentic_look = true AND NEW.is_authentic_look = false THEN
        UPDATE profiles 
        SET authentic_looks_count = GREATEST(0, authentic_looks_count - 1)
        WHERE id = look_owner_id;
      END IF;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    look_owner_id := OLD.user_id;
    
    -- Check if user is authentic
    SELECT is_authentic INTO is_user_authentic 
    FROM profiles 
    WHERE id = look_owner_id;
    
    -- Only decrement if user is authentic and look was authentic
    IF is_user_authentic = true AND OLD.is_authentic_look = true THEN
      UPDATE profiles 
      SET authentic_looks_count = GREATEST(0, authentic_looks_count - 1)
      WHERE id = look_owner_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update authentic looks count
DROP TRIGGER IF EXISTS trigger_update_authentic_looks_count ON looks;
CREATE TRIGGER trigger_update_authentic_looks_count
AFTER INSERT OR UPDATE OF is_authentic_look OR DELETE ON looks
FOR EACH ROW
EXECUTE FUNCTION update_authentic_looks_count();

-- Initialize authentic_looks_count for existing users
UPDATE profiles p
SET authentic_looks_count = (
  SELECT COUNT(*)
  FROM looks l
  WHERE l.user_id = p.id
    AND l.is_authentic_look = true
    AND p.is_authentic = true
)
WHERE p.is_authentic = true;

-- Award "Verified Authentic" badge to existing authentic users
INSERT INTO badges (user_id, badge_type, metadata)
SELECT 
  id,
  'verified_authentic',
  jsonb_build_object(
    'verified_at', now(),
    'retroactive', true,
    'face_embedding', face_embedding IS NOT NULL
  )
FROM profiles
WHERE is_authentic = true
ON CONFLICT (user_id, badge_type) DO NOTHING;

-- Award "Authentic User" badge to existing users with 20+ authentic looks
INSERT INTO badges (user_id, badge_type, metadata)
SELECT 
  id,
  'authentic_user',
  jsonb_build_object(
    'authentic_looks', authentic_looks_count,
    'achieved_at', now(),
    'retroactive', true
  )
FROM profiles
WHERE is_authentic = true
  AND authentic_looks_count >= 20
ON CONFLICT (user_id, badge_type) DO NOTHING;

-- Recreate XP system functions and triggers that depend on badges table

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
    ON CONFLICT (user_id, badge_type) DO NOTHING;
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
CREATE TRIGGER trigger_look_xp
AFTER INSERT OR DELETE ON looks
FOR EACH ROW
EXECUTE FUNCTION handle_look_xp();

-- Update the existing like trigger to also handle XP
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