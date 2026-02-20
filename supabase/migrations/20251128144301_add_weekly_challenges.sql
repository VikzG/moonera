/*
  # Add Weekly Challenges System
  
  ## Overview
  Implements a weekly challenges system where users can complete challenges to earn bonus XP.
  Challenges reset every week (Monday).
  
  ## New Tables
  
  ### `challenges`
  Available challenge types that can be assigned to users
  - `id` (uuid, primary key) - Unique challenge identifier
  - `challenge_type` (text) - Type of challenge: 'post_look', 'get_likes', 'give_likes'
  - `title` (text) - Challenge title displayed to users
  - `description` (text) - Challenge description
  - `target_count` (integer) - Number of actions needed to complete
  - `xp_reward` (integer) - XP awarded upon completion
  - `is_active` (boolean) - Whether this challenge type is currently active
  
  ### `user_challenges`
  Tracks user progress on weekly challenges
  - `id` (uuid, primary key) - Unique record identifier
  - `user_id` (uuid, foreign key) - References profiles(id)
  - `challenge_type` (text) - Type of challenge
  - `week_number` (integer) - ISO week number
  - `year` (integer) - Year
  - `current_count` (integer) - Current progress (0 to target_count)
  - `target_count` (integer) - Number needed to complete
  - `xp_reward` (integer) - XP reward for completion
  - `completed` (boolean) - Whether challenge is completed
  - `completed_at` (timestamptz) - When challenge was completed
  - `created_at` (timestamptz) - When challenge was assigned
  
  ## Initial Challenges
  
  1. **Post a Look** (+25 XP)
     - Post 1 outfit during the week
  
  2. **Get 10 Likes** (+25 XP)
     - Receive 10 likes on your looks this week
  
  3. **Like 10 Looks** (+25 XP)
     - Give 10 likes to other users' looks this week
  
  ## Challenge Logic
  
  - Challenges are assigned to all users at the start of each week
  - Progress is tracked automatically via triggers
  - XP is awarded automatically when a challenge is completed
  - Challenges reset every Monday (ISO week start)
  
  ## Security
  
  - RLS enabled on all tables
  - Users can only view and update their own challenges
  - Challenge completion is managed by database functions
*/

-- Create challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_type text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  target_count integer NOT NULL,
  xp_reward integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create user_challenges table
CREATE TABLE IF NOT EXISTS user_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_type text NOT NULL,
  week_number integer NOT NULL,
  year integer NOT NULL,
  current_count integer DEFAULT 0,
  target_count integer NOT NULL,
  xp_reward integer NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, challenge_type, week_number, year)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id ON user_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenges_week ON user_challenges(week_number, year);
CREATE INDEX IF NOT EXISTS idx_user_challenges_completed ON user_challenges(completed);

-- Enable RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;

-- Challenges policies (everyone can view active challenges)
CREATE POLICY "Active challenges are viewable by everyone"
  ON challenges FOR SELECT
  TO authenticated
  USING (is_active = true);

-- User challenges policies
CREATE POLICY "Users can view their own challenges"
  ON user_challenges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenges"
  ON user_challenges FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Insert default challenges
INSERT INTO challenges (challenge_type, title, description, target_count, xp_reward, is_active)
VALUES
  ('post_look', 'Poste une tenue', 'Publie une tenue cette semaine', 1, 25, true),
  ('get_likes', 'Obtiens 10 Likes', 'Reçois 10 likes sur tes tenues cette semaine', 10, 25, true),
  ('give_likes', 'Like 10 tenues', 'Like 10 tenues d''autres utilisateurs cette semaine', 10, 25, true)
ON CONFLICT (challenge_type) DO NOTHING;

-- Function to get current ISO week and year
CREATE OR REPLACE FUNCTION get_current_week()
RETURNS TABLE(week_num integer, year_num integer) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(WEEK FROM CURRENT_DATE)::integer as week_num,
    EXTRACT(ISOYEAR FROM CURRENT_DATE)::integer as year_num;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to initialize user challenges for current week
CREATE OR REPLACE FUNCTION initialize_user_challenges(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_week integer;
  v_year integer;
  v_challenge RECORD;
BEGIN
  SELECT week_num, year_num INTO v_week, v_year FROM get_current_week();
  
  FOR v_challenge IN SELECT * FROM challenges WHERE is_active = true
  LOOP
    INSERT INTO user_challenges (
      user_id, 
      challenge_type, 
      week_number, 
      year, 
      target_count, 
      xp_reward
    )
    VALUES (
      p_user_id,
      v_challenge.challenge_type,
      v_week,
      v_year,
      v_challenge.target_count,
      v_challenge.xp_reward
    )
    ON CONFLICT (user_id, challenge_type, week_number, year) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update challenge progress
CREATE OR REPLACE FUNCTION update_challenge_progress(
  p_user_id uuid,
  p_challenge_type text,
  p_increment integer DEFAULT 1
)
RETURNS void AS $$
DECLARE
  v_week integer;
  v_year integer;
  v_current_count integer;
  v_target_count integer;
  v_xp_reward integer;
  v_completed boolean;
BEGIN
  SELECT week_num, year_num INTO v_week, v_year FROM get_current_week();
  
  -- Ensure user has challenges initialized
  PERFORM initialize_user_challenges(p_user_id);
  
  -- Update challenge progress
  UPDATE user_challenges
  SET current_count = current_count + p_increment
  WHERE user_id = p_user_id
    AND challenge_type = p_challenge_type
    AND week_number = v_week
    AND year = v_year
    AND completed = false
  RETURNING current_count, target_count, xp_reward, completed
  INTO v_current_count, v_target_count, v_xp_reward, v_completed;
  
  -- Check if challenge is now completed
  IF v_current_count >= v_target_count AND NOT v_completed THEN
    UPDATE user_challenges
    SET completed = true, completed_at = now()
    WHERE user_id = p_user_id
      AND challenge_type = p_challenge_type
      AND week_number = v_week
      AND year = v_year;
    
    -- Award XP
    PERFORM award_xp(p_user_id, v_xp_reward);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle post_look challenge
CREATE OR REPLACE FUNCTION handle_post_look_challenge()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM update_challenge_progress(NEW.user_id, 'post_look', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_challenge_progress(OLD.user_id, 'post_look', -1);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle get_likes and give_likes challenges
CREATE OR REPLACE FUNCTION handle_like_challenges()
RETURNS TRIGGER AS $$
DECLARE
  look_owner_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get the look owner for get_likes challenge
    SELECT user_id INTO look_owner_id FROM looks WHERE id = NEW.look_id;
    
    -- Update get_likes challenge for look owner
    PERFORM update_challenge_progress(look_owner_id, 'get_likes', 1);
    
    -- Update give_likes challenge for the user who liked
    PERFORM update_challenge_progress(NEW.user_id, 'give_likes', 1);
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Get the look owner
    SELECT user_id INTO look_owner_id FROM looks WHERE id = OLD.look_id;
    
    -- Decrease get_likes challenge for look owner
    PERFORM update_challenge_progress(look_owner_id, 'get_likes', -1);
    
    -- Decrease give_likes challenge for the user who unliked
    PERFORM update_challenge_progress(OLD.user_id, 'give_likes', -1);
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for challenges
DROP TRIGGER IF EXISTS trigger_post_look_challenge ON looks;
CREATE TRIGGER trigger_post_look_challenge
AFTER INSERT OR DELETE ON looks
FOR EACH ROW
EXECUTE FUNCTION handle_post_look_challenge();

DROP TRIGGER IF EXISTS trigger_like_challenges ON likes;
CREATE TRIGGER trigger_like_challenges
AFTER INSERT OR DELETE ON likes
FOR EACH ROW
EXECUTE FUNCTION handle_like_challenges();

-- Function to initialize challenges for existing users (run once)
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM profiles
  LOOP
    PERFORM initialize_user_challenges(user_record.id);
  END LOOP;
END $$;