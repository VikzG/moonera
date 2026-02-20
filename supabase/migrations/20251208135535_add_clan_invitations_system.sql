/*
  # Système d'invitations de clan

  1. Nouvelle table
    - `clan_invitations`
      - `id` (uuid, clé primaire)
      - `clan_id` (uuid, référence vers clans)
      - `inviter_id` (uuid, référence vers profiles - celui qui invite)
      - `invited_user_id` (uuid, référence vers profiles - celui qui est invité)
      - `status` (text, statut de l'invitation: pending/accepted/declined)
      - `created_at` (timestamp)
      - `expires_at` (timestamp, expiration après 7 jours)

  2. Sécurité
    - Activer RLS sur la table
    - Seul l'inviteur (leader du clan) peut créer une invitation
    - L'utilisateur invité peut voir ses invitations et les accepter/refuser
    - Les membres du clan peuvent voir les invitations en attente

  3. Contraintes
    - Une seule invitation en attente par utilisateur et par clan
    - L'utilisateur invité ne doit pas déjà être membre d'un clan
*/

-- Créer la table des invitations de clan
CREATE TABLE IF NOT EXISTS clan_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  
  -- Empêcher les invitations en double pour le même clan et utilisateur
  UNIQUE(clan_id, invited_user_id, status)
);

-- Activer RLS
ALTER TABLE clan_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Les leaders peuvent créer des invitations pour leur clan
CREATE POLICY "Clan leaders can create invitations"
  ON clan_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clans
      WHERE clans.id = clan_id
      AND clans.leader_id = auth.uid()
    )
  );

-- Policy: Les utilisateurs peuvent voir les invitations qui leur sont destinées
CREATE POLICY "Users can view their invitations"
  ON clan_invitations FOR SELECT
  TO authenticated
  USING (
    invited_user_id = auth.uid()
    OR inviter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM clans
      WHERE clans.id = clan_id
      AND clans.leader_id = auth.uid()
    )
  );

-- Policy: Les utilisateurs peuvent accepter/refuser leurs invitations
CREATE POLICY "Users can update their invitations"
  ON clan_invitations FOR UPDATE
  TO authenticated
  USING (invited_user_id = auth.uid())
  WITH CHECK (invited_user_id = auth.uid());

-- Policy: Les leaders peuvent supprimer les invitations de leur clan
CREATE POLICY "Clan leaders can delete invitations"
  ON clan_invitations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clans
      WHERE clans.id = clan_id
      AND clans.leader_id = auth.uid()
    )
  );

-- Fonction pour marquer les invitations expirées
CREATE OR REPLACE FUNCTION expire_old_clan_invitations()
RETURNS void AS $$
BEGIN
  UPDATE clan_invitations
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_clan_invitations_invited_user ON clan_invitations(invited_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_clan_invitations_clan ON clan_invitations(clan_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_clan_invitations_expires ON clan_invitations(expires_at) WHERE status = 'pending';