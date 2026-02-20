/*
  # Update Duel Completion System

  ## Overview
  This migration updates the duel completion system to:
  - Award XP to participants (100 XP to winner, 25 XP to loser)
  - Send notifications to both participants about the duel result
  - Automatically complete duels after 6 hours
  - Hide completed duels from active duels list

  ## Changes

  ### 1. Update complete_duel function
  - Award 100 XP to winner
  - Award 25 XP to loser
  - Send notifications to both participants
  - Update look statistics (duel_wins/duel_losses)
  - Mark duel as completed

  ### 2. Add auto_complete_expired_duels function
  - Automatically complete duels that are active for more than 6 hours
  - Called periodically to clean up expired duels

  ### 3. Security
  - All functions use SECURITY DEFINER for proper access control
  - RLS policies already in place for duels table
*/

-- ============================================
-- 1. Update complete_duel function with XP and notifications
-- ============================================

DROP FUNCTION IF EXISTS complete_duel(uuid);

CREATE OR REPLACE FUNCTION complete_duel(p_duel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_duel duels%ROWTYPE;
  v_winner_id uuid;
  v_loser_id uuid;
  v_winner_look_id uuid;
  v_loser_look_id uuid;
  v_is_tie boolean;
BEGIN
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id;

  IF v_duel.id IS NULL THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;

  IF v_duel.status = 'completed' THEN
    RETURN;
  END IF;

  IF v_duel.challenger_votes > v_duel.challenged_votes THEN
    v_winner_id := v_duel.challenger_id;
    v_loser_id := v_duel.challenged_id;
    v_winner_look_id := v_duel.challenger_look_id;
    v_loser_look_id := v_duel.challenged_look_id;
    v_is_tie := false;
  ELSIF v_duel.challenged_votes > v_duel.challenger_votes THEN
    v_winner_id := v_duel.challenged_id;
    v_loser_id := v_duel.challenger_id;
    v_winner_look_id := v_duel.challenged_look_id;
    v_loser_look_id := v_duel.challenger_look_id;
    v_is_tie := false;
  ELSE
    v_is_tie := true;
  END IF;

  IF v_is_tie THEN
    UPDATE profiles SET xp = xp + 25 WHERE id = v_duel.challenger_id;
    UPDATE profiles SET xp = xp + 25 WHERE id = v_duel.challenged_id;

    PERFORM create_notification(
      v_duel.challenger_id,
      'duel_tie',
      'Duel terminé',
      'Égalité parfaite ! +25 XP',
      v_duel.challenger_look_id,
      NULL,
      jsonb_build_object('duel_id', p_duel_id, 'xp_gained', 25)
    );

    PERFORM create_notification(
      v_duel.challenged_id,
      'duel_tie',
      'Duel terminé',
      'Égalité parfaite ! +25 XP',
      v_duel.challenged_look_id,
      NULL,
      jsonb_build_object('duel_id', p_duel_id, 'xp_gained', 25)
    );
  ELSE
    UPDATE profiles SET xp = xp + 100 WHERE id = v_winner_id;
    UPDATE profiles SET xp = xp + 25 WHERE id = v_loser_id;

    IF v_winner_look_id IS NOT NULL THEN
      UPDATE looks SET duel_wins = duel_wins + 1 WHERE id = v_winner_look_id;
    END IF;

    IF v_loser_look_id IS NOT NULL THEN
      UPDATE looks SET duel_losses = duel_losses + 1 WHERE id = v_loser_look_id;
    END IF;

    PERFORM create_notification(
      v_winner_id,
      'duel_won',
      'Victoire au duel !',
      'Vous avez gagné le duel ! +100 XP',
      v_winner_look_id,
      NULL,
      jsonb_build_object('duel_id', p_duel_id, 'votes', v_duel.total_votes, 'xp_gained', 100)
    );

    PERFORM create_notification(
      v_loser_id,
      'duel_lost',
      'Duel terminé',
      'Vous avez perdu le duel. +25 XP',
      v_loser_look_id,
      NULL,
      jsonb_build_object('duel_id', p_duel_id, 'votes', v_duel.total_votes, 'xp_gained', 25)
    );
  END IF;

  UPDATE duels SET status = 'completed' WHERE id = p_duel_id;
END;
$$;

-- ============================================
-- 2. Add function to auto-complete expired duels
-- ============================================

CREATE OR REPLACE FUNCTION auto_complete_expired_duels()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_duel_record RECORD;
  v_six_hours_ago timestamptz;
BEGIN
  v_six_hours_ago := NOW() - INTERVAL '6 hours';

  FOR v_duel_record IN
    SELECT id
    FROM duels
    WHERE status = 'active'
    AND created_at < v_six_hours_ago
  LOOP
    PERFORM complete_duel(v_duel_record.id);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION complete_duel(uuid) IS 'Completes a duel by awarding XP (100 to winner, 25 to loser), updating stats, and sending notifications';
COMMENT ON FUNCTION auto_complete_expired_duels() IS 'Automatically completes all active duels that have been running for more than 6 hours';
