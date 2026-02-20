/*
  # Fix Clan Member Count Default Value

  1. Changes
    - Change default member_count from 1 to 0 in clans table
    - This ensures correct counting when the leader is automatically added as the first member
  
  2. Why This Fix
    - Currently: clan starts at member_count=1, then trigger adds +1 when leader joins = 2 total
    - After fix: clan starts at member_count=0, then trigger adds +1 when leader joins = 1 total (correct)
*/

-- Drop the existing constraint
ALTER TABLE clans 
DROP CONSTRAINT IF EXISTS clans_member_count_check;

-- Change the default value to 0
ALTER TABLE clans 
ALTER COLUMN member_count SET DEFAULT 0;

-- Add the updated constraint (0 to 50 members)
ALTER TABLE clans 
ADD CONSTRAINT clans_member_count_check 
CHECK (member_count >= 0 AND member_count <= 50);

-- Update any existing clans that have incorrect member_count
UPDATE clans
SET member_count = (
  SELECT COUNT(*)
  FROM clan_members
  WHERE clan_members.clan_id = clans.id
);