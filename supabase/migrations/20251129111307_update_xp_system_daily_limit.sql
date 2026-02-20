/*
  # Update XP System - Daily Post Limit
  
  ## Overview
  Modifies the XP system to only reward XP for the first 3 outfit posts per day.
  Removes XP rewards for likes/unlikes.
  
  ## Changes
  
  ### XP Rules (New)
  1. **Publishing Looks**: +25 XP for the first 3 looks posted per day
  2. **Deleting Looks**: -25 XP when look is deleted (only if it was within the first 3 of the day)
  3. **Likes**: No longer award XP
  
  ### Level System
  - Unchanged: 100 XP per level (level 2 = 100 XP, level 3 = 200 XP, etc.)
  - Formula: level = floor(xp / 100) + 1
  
  ## Implementation
  
  1. Remove XP rewards from like/unlike trigger
  2. Add daily post counter to track first 3 posts
  3. Update look XP function to check daily post count
  
  ## Security
  - RLS policies maintained
  - Automatic XP calculation through triggers
*/

-- Update the likes trigger to remove XP rewards
CREATE OR REPLACE FUNCTION update_look_likes_count()
RETURNS TRIGGER AS $$
DECLARE
  look_owner_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get the look owner
    SELECT user_id INTO look_owner_id FROM looks WHERE id = NEW.look_id;
    
    -- Update likes count (no XP)
    UPDATE looks SET likes_count = likes_count + 1 WHERE id = NEW.look_id;
    UPDATE profiles SET total_likes = total_likes + 1 WHERE id = look_owner_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Get the look owner
    SELECT user_id INTO look_owner_id FROM looks WHERE id = OLD.look_id;
    
    -- Update likes count (no XP)
    UPDATE looks SET likes_count = likes_count - 1 WHERE id = OLD.look_id;
    UPDATE profiles SET total_likes = total_likes - 1 WHERE id = look_owner_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to check if user has posted 3 or more looks today
CREATE OR REPLACE FUNCTION get_daily_post_count(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  post_count integer;
BEGIN
  SELECT COUNT(*) INTO post_count
  FROM looks
  WHERE user_id = p_user_id
    AND DATE(created_at) = CURRENT_DATE;
  
  RETURN post_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update look XP function to only award for first 3 posts per day
CREATE OR REPLACE FUNCTION handle_look_xp()
RETURNS TRIGGER AS $$
DECLARE
  daily_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get the count of posts today BEFORE this post (exclusive of current)
    SELECT COUNT(*) INTO daily_count
    FROM looks
    WHERE user_id = NEW.user_id
      AND DATE(created_at) = CURRENT_DATE
      AND id != NEW.id;
    
    -- Only award XP if this is one of the first 3 posts today
    IF daily_count < 3 THEN
      PERFORM award_xp(NEW.user_id, 25);
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Get the post position for the deleted look (1st, 2nd, 3rd, etc.)
    SELECT COUNT(*) INTO daily_count
    FROM looks
    WHERE user_id = OLD.user_id
      AND DATE(created_at) = DATE(OLD.created_at)
      AND created_at < OLD.created_at;
    
    -- Only deduct XP if this was one of the first 3 posts that day
    IF daily_count < 3 THEN
      PERFORM award_xp(OLD.user_id, -25);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;