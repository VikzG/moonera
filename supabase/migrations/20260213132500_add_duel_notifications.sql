/*
  # Ajout des notifications pour les duels

  ## Vue d'ensemble
  Ajoute des notifications manquantes pour le système de duels :
  - Notification quand un utilisateur reçoit une demande de duel
  - Notification quand une demande de duel est acceptée

  ## Changements

  ### 1. Mise à jour des types de notifications
  - Ajout de 'duel_challenge' (demande de duel reçue)
  - Ajout de 'duel_accepted' (duel accepté)
  - Ajout de 'duel_won', 'duel_lost', 'duel_tie' (déjà utilisés)
  - Ajout de 'challenge_completed' (défi complété)

  ### 2. Création de fonctions de notification
  - Fonction pour notifier quand une demande de duel est créée
  - Fonction pour notifier quand un duel est accepté

  ### 3. Création de triggers
  - Trigger sur INSERT de duels (demande de duel)
  - Trigger sur UPDATE de duels (acceptation de duel)

  ## Sécurité
  - Utilise SECURITY DEFINER pour permettre l'insertion de notifications
  - RLS déjà configuré sur la table notifications
*/

-- ============================================
-- 1. Mettre à jour la contrainte des types de notifications
-- ============================================

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'like',
    'badge_earned',
    'top_100',
    'level_up',
    'duel_challenge',
    'duel_accepted',
    'duel_won',
    'duel_lost',
    'duel_tie',
    'challenge_completed'
  ));

-- ============================================
-- 2. Fonction pour notifier lors d'une demande de duel
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_duel_challenge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_challenger_username text;
BEGIN
  -- Seulement pour les nouveaux duels avec status 'pending'
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Récupérer le nom du challenger
    SELECT username INTO v_challenger_username
    FROM profiles
    WHERE id = NEW.challenger_id;

    -- Créer une notification pour le challengé
    PERFORM create_notification(
      NEW.challenged_id,
      'duel_challenge',
      'Défi de duel !',
      '@' || v_challenger_username || ' vous défie en duel !',
      NEW.challenger_id,
      NULL,
      jsonb_build_object(
        'duel_id', NEW.id,
        'challenger_id', NEW.challenger_id,
        'challenger_username', v_challenger_username
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- 3. Fonction pour notifier lors de l'acceptation d'un duel
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_duel_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_challenged_username text;
BEGIN
  -- Seulement si le status passe de 'pending' à 'accepted'
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'pending'
     AND NEW.status = 'accepted' THEN

    -- Récupérer le nom du challengé
    SELECT username INTO v_challenged_username
    FROM profiles
    WHERE id = NEW.challenged_id;

    -- Créer une notification pour le challenger
    PERFORM create_notification(
      NEW.challenger_id,
      'duel_accepted',
      'Duel accepté !',
      '@' || v_challenged_username || ' a accepté votre défi !',
      NEW.challenged_id,
      NULL,
      jsonb_build_object(
        'duel_id', NEW.id,
        'challenged_id', NEW.challenged_id,
        'challenged_username', v_challenged_username
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- 4. Créer les triggers
-- ============================================

-- Trigger pour les demandes de duel
DROP TRIGGER IF EXISTS trigger_notify_on_duel_challenge ON duels;
CREATE TRIGGER trigger_notify_on_duel_challenge
AFTER INSERT ON duels
FOR EACH ROW
EXECUTE FUNCTION notify_on_duel_challenge();

-- Trigger pour les acceptations de duel
DROP TRIGGER IF EXISTS trigger_notify_on_duel_accepted ON duels;
CREATE TRIGGER trigger_notify_on_duel_accepted
AFTER UPDATE ON duels
FOR EACH ROW
EXECUTE FUNCTION notify_on_duel_accepted();

COMMENT ON FUNCTION notify_on_duel_challenge() IS 'Notifie un utilisateur quand il reçoit une demande de duel';
COMMENT ON FUNCTION notify_on_duel_accepted() IS 'Notifie le challenger quand son défi est accepté';
