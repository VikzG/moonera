/*
  # Add 'follow' to notifications type constraint

  1. Changes
    - Drops the existing `notifications_type_check` constraint
    - Re-creates it with 'follow' added to the allowed types

  2. Notes
    - This unblocks the follow system which was failing because the trigger
      tried to insert a notification of type 'follow' which was not allowed
*/

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'like',
    'badge_earned',
    'top_100',
    'level_up',
    'duel_challenge',
    'duel_accepted',
    'duel_won',
    'duel_lost',
    'duel_tie',
    'challenge_completed',
    'follow'
  ]));