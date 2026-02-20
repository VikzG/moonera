/*
  # Fix Security and Performance Issues
  
  ## Overview
  This migration addresses performance and security issues identified in the database audit:
  1. Add missing indexes on foreign keys
  2. Optimize RLS policies to use select subqueries
  3. Set proper search_path for all functions
  4. Remove unused indexes
  
  ## Changes
  
  ### 1. Add Missing Foreign Key Indexes
  - Add indexes for notifications foreign keys (related_look_id, related_user_id)
  - Add indexes for weekly_top_history foreign keys (look_id, user_id)
  
  ### 2. Optimize RLS Policies
  - Replace auth.uid() with (select auth.uid()) in all policies
  - This prevents re-evaluation for each row, improving performance at scale
  
  ### 3. Fix Function Security
  - Add STABLE and proper search_path to all functions
  - This prevents search_path injection attacks
  
  ### 4. Clean Up Unused Indexes
  - Remove indexes that are not being used by queries
*/

-- ============================================
-- 1. Add Missing Foreign Key Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notifications_related_look_id ON notifications(related_look_id);
CREATE INDEX IF NOT EXISTS idx_notifications_related_user_id ON notifications(related_user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_top_history_look_id ON weekly_top_history(look_id);
CREATE INDEX IF NOT EXISTS idx_weekly_top_history_user_id ON weekly_top_history(user_id);

-- ============================================
-- 2. Remove Unused Indexes
-- ============================================

DROP INDEX IF EXISTS idx_badges_type;
DROP INDEX IF EXISTS idx_user_challenges_completed;
DROP INDEX IF EXISTS idx_looks_image_urls;
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_weekly_top_week;

-- ============================================
-- 3. Optimize RLS Policies
-- ============================================

-- Profiles table policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Looks table policies
DROP POLICY IF EXISTS "Users can insert their own looks" ON looks;
CREATE POLICY "Users can insert their own looks"
  ON looks FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own looks" ON looks;
CREATE POLICY "Users can update their own looks"
  ON looks FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own looks" ON looks;
CREATE POLICY "Users can delete their own looks"
  ON looks FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Likes table policies
DROP POLICY IF EXISTS "Users can insert their own likes" ON likes;
CREATE POLICY "Users can insert their own likes"
  ON likes FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own likes" ON likes;
CREATE POLICY "Users can delete their own likes"
  ON likes FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- User challenges policies
DROP POLICY IF EXISTS "Users can view their own challenges" ON user_challenges;
CREATE POLICY "Users can view their own challenges"
  ON user_challenges FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own challenges" ON user_challenges;
CREATE POLICY "Users can update their own challenges"
  ON user_challenges FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Notifications policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================
-- 4. Fix Function Security (search_path)
-- ============================================

-- get_daily_post_count
CREATE OR REPLACE FUNCTION get_daily_post_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  post_count integer;
BEGIN
  SELECT COUNT(*) INTO post_count
  FROM looks
  WHERE user_id = p_user_id
    AND DATE(created_at) = CURRENT_DATE;
  
  RETURN post_count;
END;
$$;

-- handle_look_xp
CREATE OR REPLACE FUNCTION handle_look_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  daily_count integer;
  xp_amount integer := 0;
BEGIN
  daily_count := get_daily_post_count(NEW.user_id);
  
  IF daily_count <= 3 THEN
    xp_amount := 10;
  END IF;
  
  IF xp_amount > 0 THEN
    PERFORM award_xp(NEW.user_id, xp_amount, 'post_look');
  END IF;
  
  RETURN NEW;
END;
$$;

-- auto_initialize_challenges_for_new_user
CREATE OR REPLACE FUNCTION auto_initialize_challenges_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM initialize_user_challenges(NEW.id);
  RETURN NEW;
END;
$$;

-- check_not_own_look
CREATE OR REPLACE FUNCTION check_not_own_look()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  look_owner_id uuid;
BEGIN
  SELECT user_id INTO look_owner_id FROM looks WHERE id = NEW.look_id;
  
  IF NEW.user_id = look_owner_id THEN
    RAISE EXCEPTION 'Users cannot like their own looks';
  END IF;
  
  RETURN NEW;
END;
$$;

-- create_notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_related_user_id uuid DEFAULT NULL,
  p_related_look_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    related_user_id,
    related_look_id,
    metadata
  )
  VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_related_user_id,
    p_related_look_id,
    p_metadata
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- notify_on_like
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  look_owner_id uuid;
  liker_username text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO look_owner_id FROM looks WHERE id = NEW.look_id;
    SELECT username INTO liker_username FROM profiles WHERE id = NEW.user_id;
    
    IF look_owner_id != NEW.user_id THEN
      PERFORM create_notification(
        look_owner_id,
        'like',
        'Nouveau like !',
        '@' || liker_username || ' a aimé ta tenue',
        NEW.user_id,
        NEW.look_id,
        jsonb_build_object('liker_id', NEW.user_id, 'liker_username', liker_username)
      );
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$;

-- update_look_likes_count
CREATE OR REPLACE FUNCTION update_look_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE looks SET likes_count = likes_count + 1 WHERE id = NEW.look_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE looks SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.look_id;
  END IF;
  RETURN NULL;
END;
$$;

-- update_profile_updated_at
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- delete_user
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Drop and recreate calculate_user_level
DROP FUNCTION IF EXISTS calculate_user_level(integer);
CREATE FUNCTION calculate_user_level(xp integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN FLOOR(POWER(xp / 100.0, 0.5))::integer + 1;
END;
$$;

-- award_xp
CREATE OR REPLACE FUNCTION award_xp(p_user_id uuid, p_amount integer, p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_xp integer;
  new_level integer;
  old_level integer;
BEGIN
  SELECT level INTO old_level FROM profiles WHERE id = p_user_id;
  
  UPDATE profiles 
  SET 
    xp = xp + p_amount,
    level = calculate_user_level(xp + p_amount)
  WHERE id = p_user_id
  RETURNING xp, level INTO new_xp, new_level;
  
  IF new_level > old_level THEN
    PERFORM create_notification(
      p_user_id,
      'level_up',
      'Niveau supérieur !',
      'Félicitations ! Vous avez atteint le niveau ' || new_level,
      NULL,
      NULL,
      jsonb_build_object('new_level', new_level, 'xp', new_xp)
    );
  END IF;
END;
$$;

-- Drop and recreate get_current_week
DROP FUNCTION IF EXISTS get_current_week();
CREATE FUNCTION get_current_week()
RETURNS TABLE(week_number integer, year integer)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(WEEK FROM CURRENT_DATE)::integer AS week_number,
    EXTRACT(YEAR FROM CURRENT_DATE)::integer AS year;
END;
$$;

-- initialize_user_challenges
CREATE OR REPLACE FUNCTION initialize_user_challenges(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_week integer;
  current_year integer;
BEGIN
  SELECT week_number, year INTO current_week, current_year FROM get_current_week();
  
  INSERT INTO user_challenges (user_id, challenge_type, week_number, year, current_count, target_count, xp_reward)
  VALUES 
    (p_user_id, 'post_3_looks', current_week, current_year, 0, 3, 50),
    (p_user_id, 'receive_10_likes', current_week, current_year, 0, 10, 75),
    (p_user_id, 'give_5_likes', current_week, current_year, 0, 5, 25)
  ON CONFLICT (user_id, challenge_type, week_number, year) DO NOTHING;
END;
$$;

-- update_challenge_progress
CREATE OR REPLACE FUNCTION update_challenge_progress(
  p_user_id uuid,
  p_challenge_type text,
  p_increment integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_week integer;
  current_year integer;
  challenge_record RECORD;
BEGIN
  SELECT week_number, year INTO current_week, current_year FROM get_current_week();
  
  UPDATE user_challenges
  SET current_count = current_count + p_increment
  WHERE user_id = p_user_id
    AND challenge_type = p_challenge_type
    AND week_number = current_week
    AND year = current_year
    AND completed = false
  RETURNING * INTO challenge_record;
  
  IF challenge_record.current_count >= challenge_record.target_count THEN
    UPDATE user_challenges
    SET 
      completed = true,
      completed_at = now()
    WHERE id = challenge_record.id;
    
    PERFORM award_xp(p_user_id, challenge_record.xp_reward, 'challenge_' || p_challenge_type);
    
    PERFORM create_notification(
      p_user_id,
      'badge_earned',
      'Défi complété !',
      'Vous avez terminé le défi : ' || 
      CASE p_challenge_type
        WHEN 'post_3_looks' THEN 'Poster 3 tenues'
        WHEN 'receive_10_likes' THEN 'Recevoir 10 likes'
        WHEN 'give_5_likes' THEN 'Donner 5 likes'
        ELSE p_challenge_type
      END,
      NULL,
      NULL,
      jsonb_build_object('challenge_type', p_challenge_type, 'xp_earned', challenge_record.xp_reward)
    );
  END IF;
END;
$$;

-- handle_post_look_challenge
CREATE OR REPLACE FUNCTION handle_post_look_challenge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM update_challenge_progress(NEW.user_id, 'post_3_looks', 1);
  RETURN NEW;
END;
$$;

-- handle_like_challenges
CREATE OR REPLACE FUNCTION handle_like_challenges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  look_owner_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO look_owner_id FROM looks WHERE id = NEW.look_id;
    
    PERFORM update_challenge_progress(NEW.user_id, 'give_5_likes', 1);
    PERFORM update_challenge_progress(look_owner_id, 'receive_10_likes', 1);
  END IF;
  
  RETURN NULL;
END;
$$;