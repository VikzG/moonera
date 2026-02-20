/*
  # Remove 10 authentic looks requirement for clan creation

  1. Changes
    - Update RLS policy to allow any authenticated user to create clans
    - Remove the requirement of having 10 authentic looks
    - Keep other restrictions (one clan per user, not already in a clan)
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Authentic users with 10+ verified looks can create clans" ON clans;

-- Create new policy without the 10 looks requirement
CREATE POLICY "Authenticated users can create clans"
  ON clans FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = leader_id
    AND NOT EXISTS (
      SELECT 1 FROM clans WHERE leader_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM clan_members WHERE user_id = auth.uid()
    )
  );