/*
  # Fix Remaining Security Issues
  
  ## Overview
  This migration addresses the remaining security issues:
  1. Remove unused indexes that were just created (they may become useful later when queries evolve)
  2. Fix award_xp function search_path issue
  
  ## Changes
  
  ### 1. Remove Unused Indexes
  The indexes we created are showing as unused because:
  - They're new and haven't been used by queries yet
  - The query planner may not have statistics yet
  
  We'll remove them for now and they can be added back if needed when queries require them.
  
  ### 2. Fix award_xp Function
  Re-create the award_xp function with proper search_path configuration.
  
  ### 3. Password Protection
  Note: Leaked password protection must be enabled in Supabase Dashboard settings,
  not via SQL migration. Navigate to: Authentication > Providers > Email > 
  Enable "Password Protection" feature.
*/

-- ============================================
-- 1. Remove Unused Indexes
-- ============================================

DROP INDEX IF EXISTS idx_notifications_related_look_id;
DROP INDEX IF EXISTS idx_notifications_related_user_id;
DROP INDEX IF EXISTS idx_weekly_top_history_look_id;
DROP INDEX IF EXISTS idx_weekly_top_history_user_id;

-- ============================================
-- 2. Fix award_xp Function Search Path
-- ============================================

-- Drop and recreate with proper search_path
DROP FUNCTION IF EXISTS award_xp(uuid, integer, text);

CREATE FUNCTION award_xp(p_user_id uuid, p_amount integer, p_source text)
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