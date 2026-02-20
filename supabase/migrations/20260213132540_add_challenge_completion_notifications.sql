/*
  # Ajout des notifications de complétion de défis

  ## Vue d'ensemble
  Met à jour les fonctions de progression des défis pour envoyer des notifications
  lorsqu'un défi (journalier ou hebdomadaire) est complété.

  ## Changements

  ### 1. Mise à jour de update_daily_challenge_progress
  - Ajoute une notification quand un défi journalier est complété

  ### 2. Mise à jour de update_challenge_progress
  - Change le type de notification de 'badge_earned' à 'challenge_completed'
  - Améliore le message pour les nouveaux défis

  ## Sécurité
  - Utilise SECURITY DEFINER pour permettre l'insertion de notifications
  - RLS déjà configuré sur la table notifications
*/

-- ============================================
-- 1. Mettre à jour update_daily_challenge_progress
-- ============================================

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
  v_challenge_title text;
BEGIN
  -- Ensure user has daily challenges initialized
  PERFORM initialize_daily_challenges(p_user_id);
  
  -- Update challenge progress
  UPDATE daily_challenges
  SET current_count = current_count + p_increment
  WHERE user_id = p_user_id
    AND challenge_type = p_challenge_type
    AND day_date = v_today
    AND completed = false
  RETURNING current_count, target_count, xp_reward, completed
  INTO v_current_count, v_target_count, v_xp_reward, v_completed;
  
  -- Check if challenge is now completed
  IF v_current_count >= v_target_count AND NOT v_completed THEN
    UPDATE daily_challenges
    SET completed = true, completed_at = now()
    WHERE user_id = p_user_id
      AND challenge_type = p_challenge_type
      AND day_date = v_today;
    
    -- Award XP
    PERFORM award_xp(p_user_id, v_xp_reward);
    
    -- Get challenge title
    v_challenge_title := CASE p_challenge_type
      WHEN 'daily_post_look' THEN 'Poste une tenue'
      WHEN 'daily_create_duel' THEN 'Défie un joueur'
      WHEN 'daily_like_look' THEN 'Like une tenue'
      ELSE p_challenge_type
    END;
    
    -- Send notification
    PERFORM create_notification(
      p_user_id,
      'challenge_completed',
      'Défi journalier complété !',
      'Vous avez terminé : ' || v_challenge_title || ' (+' || v_xp_reward || ' XP)',
      NULL,
      NULL,
      jsonb_build_object(
        'challenge_type', p_challenge_type,
        'xp_earned', v_xp_reward,
        'frequency', 'daily'
      )
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Mettre à jour update_challenge_progress (hebdomadaires)
-- ============================================

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
  v_challenge_title text;
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
    
    -- Get challenge title
    v_challenge_title := CASE p_challenge_type
      WHEN 'weekly_post_3_looks' THEN 'Poste 3 tenues'
      WHEN 'weekly_create_3_duels' THEN 'Défie 3 joueurs'
      WHEN 'weekly_like_10_looks' THEN 'Like 10 tenues'
      WHEN 'post_3_looks' THEN 'Poster 3 tenues'
      WHEN 'receive_10_likes' THEN 'Recevoir 10 likes'
      WHEN 'give_5_likes' THEN 'Donner 5 likes'
      ELSE p_challenge_type
    END;
    
    PERFORM create_notification(
      p_user_id,
      'challenge_completed',
      'Défi hebdomadaire complété !',
      'Vous avez terminé : ' || v_challenge_title || ' (+' || challenge_record.xp_reward || ' XP)',
      NULL,
      NULL,
      jsonb_build_object(
        'challenge_type', p_challenge_type,
        'xp_earned', challenge_record.xp_reward,
        'frequency', 'weekly'
      )
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION update_daily_challenge_progress(uuid, text, integer) IS 'Met à jour la progression d''un défi journalier et envoie une notification si complété';
COMMENT ON FUNCTION update_challenge_progress(uuid, text, integer) IS 'Met à jour la progression d''un défi hebdomadaire et envoie une notification si complété';
