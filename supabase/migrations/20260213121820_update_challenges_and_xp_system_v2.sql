/*
  # Mise à jour du système de défis et d'XP
  
  ## Vue d'ensemble
  Restructure complètement le système d'XP pour que les joueurs ne puissent gagner de l'XP
  QUE par la complétion de défis journaliers et hebdomadaires.
  
  ## Changements majeurs
  
  ### 1. Suppression des gains d'XP directs
  - Suppression des XP pour poster des looks directement
  - Suppression des XP pour recevoir des likes
  - Suppression des XP pour tout autre action directe
  
  ### 2. Nouveaux défis journaliers
  - **Poster une tenue** (+10 XP) - Poster 1 tenue dans la journée
  - **Défier un joueur** (+10 XP) - Créer 1 duel dans la journée
  - **Liker une tenue** (+5 XP) - Liker 1 tenue dans la journée
  
  ### 3. Nouveaux défis hebdomadaires
  - **Poster 3 tenues** (+20 XP) - Poster 3 tenues dans la semaine
  - **Défier 3 joueurs** (+20 XP) - Créer 3 duels dans la semaine
  - **Liker 10 tenues** (+10 XP) - Liker 10 tenues dans la semaine
  
  ## Structure des tables
  
  ### Modification de `challenges`
  - Ajout du champ `frequency` ('daily' ou 'weekly')
  
  ### Création de `daily_challenges`
  - Même structure que `user_challenges` mais pour les défis journaliers
  - Réinitialisation quotidienne au lieu d'hebdomadaire
  
  ## Sécurité
  - RLS maintenu sur toutes les tables
  - L'XP est UNIQUEMENT attribué via la complétion de défis
*/

-- Étape 1: Supprimer les anciens triggers qui donnent de l'XP direct
DROP TRIGGER IF EXISTS trigger_handle_look_xp ON looks;
DROP FUNCTION IF EXISTS handle_look_xp CASCADE;

-- Étape 2: Mettre à jour la fonction de likes pour ne plus donner d'XP
CREATE OR REPLACE FUNCTION update_look_likes_count()
RETURNS TRIGGER AS $$
DECLARE
  look_owner_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO look_owner_id FROM looks WHERE id = NEW.look_id;
    UPDATE looks SET likes_count = likes_count + 1 WHERE id = NEW.look_id;
    UPDATE profiles SET total_likes = total_likes + 1 WHERE id = look_owner_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    SELECT user_id INTO look_owner_id FROM looks WHERE id = OLD.look_id;
    UPDATE looks SET likes_count = likes_count - 1 WHERE id = OLD.look_id;
    UPDATE profiles SET total_likes = total_likes - 1 WHERE id = look_owner_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 3: Ajouter le champ frequency à la table challenges si absent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'frequency'
  ) THEN
    ALTER TABLE challenges ADD COLUMN frequency text DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly'));
  END IF;
END $$;

-- Étape 4: Créer la table daily_challenges pour les défis journaliers
CREATE TABLE IF NOT EXISTS daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_type text NOT NULL,
  day_date date NOT NULL,
  current_count integer DEFAULT 0,
  target_count integer NOT NULL,
  xp_reward integer NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, challenge_type, day_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_challenges_user_id ON daily_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_date ON daily_challenges(day_date);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_completed ON daily_challenges(completed);

-- Enable RLS
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily challenges"
  ON daily_challenges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily challenges"
  ON daily_challenges FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Étape 5: Supprimer les anciens défis et en créer de nouveaux
DELETE FROM user_challenges;
DELETE FROM daily_challenges;
DELETE FROM challenges;

-- Insérer les nouveaux défis journaliers
INSERT INTO challenges (challenge_type, title, description, target_count, xp_reward, frequency, is_active)
VALUES
  ('daily_post_look', 'Poste une tenue', 'Publie une tenue aujourd''hui', 1, 10, 'daily', true),
  ('daily_create_duel', 'Défie un joueur', 'Crée un duel aujourd''hui', 1, 10, 'daily', true),
  ('daily_like_look', 'Like une tenue', 'Like une tenue aujourd''hui', 1, 5, 'daily', true);

-- Insérer les nouveaux défis hebdomadaires
INSERT INTO challenges (challenge_type, title, description, target_count, xp_reward, frequency, is_active)
VALUES
  ('weekly_post_3_looks', 'Poste 3 tenues', 'Publie 3 tenues cette semaine', 3, 20, 'weekly', true),
  ('weekly_create_3_duels', 'Défie 3 joueurs', 'Crée 3 duels cette semaine', 3, 20, 'weekly', true),
  ('weekly_like_10_looks', 'Like 10 tenues', 'Like 10 tenues cette semaine', 10, 10, 'weekly', true);

-- Étape 6: Fonctions pour initialiser les défis journaliers
CREATE OR REPLACE FUNCTION initialize_daily_challenges(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_challenge RECORD;
BEGIN
  FOR v_challenge IN SELECT * FROM challenges WHERE frequency = 'daily' AND is_active = true
  LOOP
    INSERT INTO daily_challenges (
      user_id, 
      challenge_type, 
      day_date, 
      target_count, 
      xp_reward
    )
    VALUES (
      p_user_id,
      v_challenge.challenge_type,
      v_today,
      v_challenge.target_count,
      v_challenge.xp_reward
    )
    ON CONFLICT (user_id, challenge_type, day_date) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 7: Mettre à jour la fonction d'initialisation des défis hebdomadaires
CREATE OR REPLACE FUNCTION initialize_user_challenges(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_week integer;
  v_year integer;
  v_challenge RECORD;
BEGIN
  SELECT week_number, year INTO v_week, v_year FROM get_current_week();
  
  FOR v_challenge IN SELECT * FROM challenges WHERE frequency = 'weekly' AND is_active = true
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

-- Étape 8: Fonction pour mettre à jour les défis journaliers
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
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 9: Mettre à jour les triggers pour les défis
CREATE OR REPLACE FUNCTION handle_look_challenges()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Défis journaliers
    PERFORM update_daily_challenge_progress(NEW.user_id, 'daily_post_look', 1);
    -- Défis hebdomadaires
    PERFORM update_challenge_progress(NEW.user_id, 'weekly_post_3_looks', 1);
  ELSIF TG_OP = 'DELETE' THEN
    -- Décrementer si pas encore complété
    PERFORM update_daily_challenge_progress(OLD.user_id, 'daily_post_look', -1);
    PERFORM update_challenge_progress(OLD.user_id, 'weekly_post_3_looks', -1);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_like_challenges()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Défis journaliers
    PERFORM update_daily_challenge_progress(NEW.user_id, 'daily_like_look', 1);
    -- Défis hebdomadaires
    PERFORM update_challenge_progress(NEW.user_id, 'weekly_like_10_looks', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_daily_challenge_progress(OLD.user_id, 'daily_like_look', -1);
    PERFORM update_challenge_progress(OLD.user_id, 'weekly_like_10_looks', -1);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_duel_challenges()
RETURNS TRIGGER AS $$
DECLARE
  v_look_owner_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Trouver le propriétaire du look_1 (le créateur du duel)
    SELECT user_id INTO v_look_owner_id FROM looks WHERE id = NEW.look_1_id;
    
    IF v_look_owner_id IS NOT NULL THEN
      -- Défis journaliers
      PERFORM update_daily_challenge_progress(v_look_owner_id, 'daily_create_duel', 1);
      -- Défis hebdomadaires
      PERFORM update_challenge_progress(v_look_owner_id, 'weekly_create_3_duels', 1);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 10: Créer/Recréer les triggers
DROP TRIGGER IF EXISTS trigger_look_challenges ON looks;
CREATE TRIGGER trigger_look_challenges
AFTER INSERT OR DELETE ON looks
FOR EACH ROW
EXECUTE FUNCTION handle_look_challenges();

DROP TRIGGER IF EXISTS trigger_like_challenges ON likes;
CREATE TRIGGER trigger_like_challenges
AFTER INSERT OR DELETE ON likes
FOR EACH ROW
EXECUTE FUNCTION handle_like_challenges();

DROP TRIGGER IF EXISTS trigger_duel_challenges ON duels;
CREATE TRIGGER trigger_duel_challenges
AFTER INSERT ON duels
FOR EACH ROW
EXECUTE FUNCTION handle_duel_challenges();

-- Étape 11: Initialiser les défis pour tous les utilisateurs existants
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM profiles
  LOOP
    PERFORM initialize_daily_challenges(user_record.id);
    PERFORM initialize_user_challenges(user_record.id);
  END LOOP;
END $$;