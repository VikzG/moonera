/*
  # Swap Authentic Badges Logic
  
  ## Overview
  Inverts the logic for the two authentic badges:
  
  ### Badge "Authentic User" 🟣
  - **Was**: 20+ authentic looks
  - **Now**: Immediate upon identity verification
  - **Requirements**: Pass liveness check + AI detection + face matching
  - **Purpose**: Instant recognition for completing identity verification
  
  ### Badge "Verified Authentic" 🟢
  - **Was**: Immediate upon identity verification
  - **Now**: 20+ authentic looks
  - **Requirements**: 20+ authentic looks posted and verified
  - **Purpose**: Recognition for consistent, high-quality authentic content
  
  ## Changes
  
  1. **Remove existing badges**
     - Delete all 'verified_authentic' and 'authentic_user' badges
  
  2. **Update trigger functions**
     - Swap badge attribution logic
     - "Authentic User" now awarded on is_authentic = true
     - "Verified Authentic" now awarded at 20+ authentic looks
  
  3. **Re-award badges**
     - Award new badges to existing users with correct logic
*/

-- Remove existing authentic badges to reset
DELETE FROM badges WHERE badge_type IN ('verified_authentic', 'authentic_user');

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trigger_award_verified_authentic_badge ON profiles;
DROP TRIGGER IF EXISTS trigger_update_authentic_looks_count ON looks;
DROP FUNCTION IF EXISTS award_verified_authentic_badge();
DROP FUNCTION IF EXISTS update_authentic_looks_count();

-- Function to award "Authentic User" badge (now awarded immediately on verification)
CREATE OR REPLACE FUNCTION award_authentic_user_badge()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if is_authentic was just set to true
  IF NEW.is_authentic = true AND (OLD.is_authentic IS NULL OR OLD.is_authentic = false) THEN
    -- Award the "Authentic User" badge
    INSERT INTO badges (user_id, badge_type, metadata)
    VALUES (
      NEW.id, 
      'authentic_user',
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

-- Trigger to award "Authentic User" badge on profile update
CREATE TRIGGER trigger_award_authentic_user_badge
AFTER UPDATE OF is_authentic ON profiles
FOR EACH ROW
WHEN (NEW.is_authentic = true)
EXECUTE FUNCTION award_authentic_user_badge();

-- Function to update authentic looks count and award "Verified Authentic" badge (now at 20 looks)
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
      
      -- Award "Verified Authentic" badge at 20 authentic looks
      IF current_count >= 20 THEN
        INSERT INTO badges (user_id, badge_type, metadata)
        VALUES (
          look_owner_id, 
          'verified_authentic',
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
        
        -- Award "Verified Authentic" badge at 20 authentic looks
        IF current_count >= 20 THEN
          INSERT INTO badges (user_id, badge_type, metadata)
          VALUES (
            look_owner_id, 
            'verified_authentic',
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
CREATE TRIGGER trigger_update_authentic_looks_count
AFTER INSERT OR UPDATE OF is_authentic_look OR DELETE ON looks
FOR EACH ROW
EXECUTE FUNCTION update_authentic_looks_count();

-- Award "Authentic User" badge to existing authentic users (immediate badge)
INSERT INTO badges (user_id, badge_type, metadata)
SELECT 
  id,
  'authentic_user',
  jsonb_build_object(
    'verified_at', now(),
    'retroactive', true,
    'face_embedding', face_embedding IS NOT NULL
  )
FROM profiles
WHERE is_authentic = true
ON CONFLICT (user_id, badge_type) DO NOTHING;

-- Award "Verified Authentic" badge to existing users with 20+ authentic looks (rare badge)
INSERT INTO badges (user_id, badge_type, metadata)
SELECT 
  id,
  'verified_authentic',
  jsonb_build_object(
    'authentic_looks', authentic_looks_count,
    'achieved_at', now(),
    'retroactive', true
  )
FROM profiles
WHERE is_authentic = true
  AND authentic_looks_count >= 20
ON CONFLICT (user_id, badge_type) DO NOTHING;