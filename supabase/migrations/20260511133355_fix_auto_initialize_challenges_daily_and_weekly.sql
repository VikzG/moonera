/*
  # Fix auto-initialization of challenges for new users

  ## Problem
  The trigger auto_initialize_challenges_for_new_user only initialized weekly challenges,
  not daily challenges. New users had no challenges available on signup.

  ## Changes
  - Update the trigger function to initialize BOTH daily and weekly challenges
  - Re-initialize challenges for all existing profiles that have none
*/

-- Fix the trigger to also initialize daily challenges
CREATE OR REPLACE FUNCTION auto_initialize_challenges_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_user_challenges(NEW.id);
  PERFORM initialize_daily_challenges(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_auto_initialize_challenges ON profiles;
CREATE TRIGGER trigger_auto_initialize_challenges
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_initialize_challenges_for_new_user();

-- Initialize for existing profiles that have no challenges
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN
    SELECT id FROM profiles
    WHERE id NOT IN (SELECT DISTINCT user_id FROM user_challenges)
       OR id NOT IN (SELECT DISTINCT user_id FROM daily_challenges WHERE day_date = CURRENT_DATE)
  LOOP
    PERFORM initialize_user_challenges(user_record.id);
    PERFORM initialize_daily_challenges(user_record.id);
  END LOOP;
END $$;
