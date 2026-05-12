/*
  # Fix all broken trigger functions (search_path issues)

  Several functions were failing with "does not exist" errors due to missing
  search_path configuration. This migration fixes all affected functions.
*/

-- Fix initialize_daily_challenges
CREATE OR REPLACE FUNCTION initialize_daily_challenges(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_challenge RECORD;
BEGIN
  FOR v_challenge IN SELECT * FROM challenges WHERE frequency = 'daily' AND is_active = true
  LOOP
    INSERT INTO daily_challenges (user_id, challenge_type, day_date, target_count, xp_reward)
    VALUES (p_user_id, v_challenge.challenge_type, v_today, v_challenge.target_count, v_challenge.xp_reward)
    ON CONFLICT (user_id, challenge_type, day_date) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Fix update_daily_challenge_progress
CREATE OR REPLACE FUNCTION update_daily_challenge_progress(
  p_user_id uuid,
  p_challenge_type text,
  p_increment integer DEFAULT 1
)
RETURNS void AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_current_count integer;
  v_target_count integer;
  v_xp_reward integer;
  v_completed boolean;
BEGIN
  PERFORM initialize_daily_challenges(p_user_id);

  UPDATE daily_challenges
  SET current_count = current_count + p_increment
  WHERE user_id = p_user_id
    AND challenge_type = p_challenge_type
    AND day_date = v_today
    AND completed = false
  RETURNING current_count, target_count, xp_reward, completed
  INTO v_current_count, v_target_count, v_xp_reward, v_completed;

  IF v_current_count >= v_target_count AND NOT COALESCE(v_completed, false) THEN
    UPDATE daily_challenges
    SET completed = true, completed_at = now()
    WHERE user_id = p_user_id
      AND challenge_type = p_challenge_type
      AND day_date = v_today;

    PERFORM award_xp(p_user_id, v_xp_reward);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Fix handle_look_challenges
CREATE OR REPLACE FUNCTION handle_look_challenges()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM update_daily_challenge_progress(NEW.user_id, 'daily_post_look', 1);
    PERFORM update_challenge_progress(NEW.user_id, 'weekly_post_3_looks', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_daily_challenge_progress(OLD.user_id, 'daily_post_look', -1);
    PERFORM update_challenge_progress(OLD.user_id, 'weekly_post_3_looks', -1);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Fix handle_like_challenges
CREATE OR REPLACE FUNCTION handle_like_challenges()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM update_daily_challenge_progress(NEW.user_id, 'daily_like_look', 1);
    PERFORM update_challenge_progress(NEW.user_id, 'weekly_like_10_looks', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_daily_challenge_progress(OLD.user_id, 'daily_like_look', -1);
    PERFORM update_challenge_progress(OLD.user_id, 'weekly_like_10_looks', -1);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Fix handle_duel_challenges
CREATE OR REPLACE FUNCTION handle_duel_challenges()
RETURNS TRIGGER AS $$
DECLARE
  v_look_owner_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO v_look_owner_id FROM looks WHERE id = NEW.look_1_id;
    IF v_look_owner_id IS NOT NULL THEN
      PERFORM update_daily_challenge_progress(v_look_owner_id, 'daily_create_duel', 1);
      PERFORM update_challenge_progress(v_look_owner_id, 'weekly_create_3_duels', 1);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Fix auto_initialize_challenges_for_new_user
CREATE OR REPLACE FUNCTION auto_initialize_challenges_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_user_challenges(NEW.id);
  PERFORM initialize_daily_challenges(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
