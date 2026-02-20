/*
  # Auto-initialize Challenges for New Users
  
  ## Overview
  Ensures that weekly challenges are automatically created for new users when they sign up.
  
  ## Changes
  - Add trigger to automatically initialize challenges when a new profile is created
  - This fixes the issue where new users don't have any challenges available
  
  ## Security
  - Uses SECURITY DEFINER to ensure proper execution
  - RLS policies remain unchanged
*/

-- Function to auto-initialize challenges for new users
CREATE OR REPLACE FUNCTION auto_initialize_challenges_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Initialize challenges for the new user
  PERFORM initialize_user_challenges(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-initialize challenges when a new profile is created
DROP TRIGGER IF EXISTS trigger_auto_initialize_challenges ON profiles;
CREATE TRIGGER trigger_auto_initialize_challenges
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_initialize_challenges_for_new_user();