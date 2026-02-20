/*
  # Fix Performance and Security Issues

  This migration addresses several performance and security issues identified by Supabase's security scanner:

  ## 1. Missing Indexes on Foreign Keys
  Adds indexes on foreign key columns that don't have covering indexes:
    - `clan_invitations.inviter_id`
    - `duels.challenged_look_id`
    - `duels.challenger_look_id`
    - `notifications.related_look_id`
    - `notifications.related_user_id`
    - `weekly_top_history.look_id`
    - `weekly_top_history.user_id`

  ## 2. RLS Policy Optimization
  Optimizes Row Level Security policies by wrapping auth functions in subqueries to prevent re-evaluation for each row:
    - Updates all policies using `auth.uid()` to use `(select auth.uid())`
    - Improves query performance at scale

  ## 3. Function Search Path Security
  Sets immutable search_path for all functions to prevent security vulnerabilities:
    - Ensures functions use the correct schema
    - Prevents search_path manipulation attacks

  ## Notes
  - Unused indexes are kept as they may be utilized as the application scales
  - Auth DB Connection Strategy must be configured in Supabase project settings
*/

-- ============================================================================
-- 1. ADD MISSING INDEXES ON FOREIGN KEYS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_clan_invitations_inviter_id 
  ON clan_invitations(inviter_id);

CREATE INDEX IF NOT EXISTS idx_duels_challenged_look_id 
  ON duels(challenged_look_id);

CREATE INDEX IF NOT EXISTS idx_duels_challenger_look_id 
  ON duels(challenger_look_id);

CREATE INDEX IF NOT EXISTS idx_notifications_related_look_id 
  ON notifications(related_look_id);

CREATE INDEX IF NOT EXISTS idx_notifications_related_user_id 
  ON notifications(related_user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_top_history_look_id 
  ON weekly_top_history(look_id);

CREATE INDEX IF NOT EXISTS idx_weekly_top_history_user_id 
  ON weekly_top_history(user_id);

-- ============================================================================
-- 2. OPTIMIZE RLS POLICIES - WRAP AUTH FUNCTIONS IN SUBQUERIES
-- ============================================================================

-- Drop and recreate clan_invitations policies
DROP POLICY IF EXISTS "Users can update their invitations" ON clan_invitations;
CREATE POLICY "Users can update their invitations"
  ON clan_invitations
  FOR UPDATE
  TO authenticated
  USING (invited_user_id = (select auth.uid()))
  WITH CHECK (invited_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clan leaders can create invitations" ON clan_invitations;
CREATE POLICY "Clan leaders can create invitations"
  ON clan_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clans 
      WHERE clans.id = clan_invitations.clan_id 
      AND clans.leader_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view their invitations" ON clan_invitations;
CREATE POLICY "Users can view their invitations"
  ON clan_invitations
  FOR SELECT
  TO authenticated
  USING (invited_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clan leaders can delete invitations" ON clan_invitations;
CREATE POLICY "Clan leaders can delete invitations"
  ON clan_invitations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clans 
      WHERE clans.id = clan_invitations.clan_id 
      AND clans.leader_id = (select auth.uid())
    )
  );

-- Drop and recreate duel_votes policies
DROP POLICY IF EXISTS "Authenticated users can vote" ON duel_votes;
CREATE POLICY "Authenticated users can vote"
  ON duel_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- Drop and recreate duels policies
DROP POLICY IF EXISTS "Users can view their duels" ON duels;
CREATE POLICY "Users can view their duels"
  ON duels
  FOR SELECT
  TO authenticated
  USING (
    challenger_id = (select auth.uid()) OR 
    challenged_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can create duel challenges" ON duels;
CREATE POLICY "Users can create duel challenges"
  ON duels
  FOR INSERT
  TO authenticated
  WITH CHECK (challenger_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their duels" ON duels;
CREATE POLICY "Users can update their duels"
  ON duels
  FOR UPDATE
  TO authenticated
  USING (challenged_id = (select auth.uid()))
  WITH CHECK (challenged_id = (select auth.uid()));

-- Drop and recreate verification_logs policies
DROP POLICY IF EXISTS "Users can read own verification logs" ON verification_logs;
CREATE POLICY "Users can read own verification logs"
  ON verification_logs
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own verification logs" ON verification_logs;
CREATE POLICY "Users can insert own verification logs"
  ON verification_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- Drop and recreate clans policies
DROP POLICY IF EXISTS "Clan leader can update clan" ON clans;
CREATE POLICY "Clan leader can update clan"
  ON clans
  FOR UPDATE
  TO authenticated
  USING (leader_id = (select auth.uid()))
  WITH CHECK (leader_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clan leader can delete clan" ON clans;
CREATE POLICY "Clan leader can delete clan"
  ON clans
  FOR DELETE
  TO authenticated
  USING (leader_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create clans" ON clans;
CREATE POLICY "Authenticated users can create clans"
  ON clans
  FOR INSERT
  TO authenticated
  WITH CHECK (leader_id = (select auth.uid()));

-- Drop and recreate clan_members policies
DROP POLICY IF EXISTS "Users can join clans" ON clan_members;
CREATE POLICY "Users can join clans"
  ON clan_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clan leader can remove members" ON clan_members;
CREATE POLICY "Clan leader can remove members"
  ON clan_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clans 
      WHERE clans.id = clan_members.clan_id 
      AND clans.leader_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 3. SET IMMUTABLE SEARCH_PATH FOR ALL FUNCTIONS
-- ============================================================================

ALTER FUNCTION update_clan_member_count() SET search_path = public, pg_temp;
ALTER FUNCTION add_leader_as_member() SET search_path = public, pg_temp;
ALTER FUNCTION update_clan_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION expire_old_clan_invitations() SET search_path = public, pg_temp;
ALTER FUNCTION calculate_user_level(integer) SET search_path = public, pg_temp;
ALTER FUNCTION award_xp(uuid, integer, text) SET search_path = public, pg_temp;
ALTER FUNCTION award_xp(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION handle_look_xp() SET search_path = public, pg_temp;
ALTER FUNCTION update_look_likes_count() SET search_path = public, pg_temp;
ALTER FUNCTION award_authentic_user_badge() SET search_path = public, pg_temp;
ALTER FUNCTION update_authentic_looks_count() SET search_path = public, pg_temp;
ALTER FUNCTION auto_complete_expired_duels() SET search_path = public, pg_temp;
ALTER FUNCTION auto_initialize_challenges_for_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION check_not_own_look() SET search_path = public, pg_temp;
ALTER FUNCTION complete_duel(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION create_notification(uuid, text, text, text, uuid, uuid, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION delete_user() SET search_path = public, pg_temp;
ALTER FUNCTION expire_old_duels() SET search_path = public, pg_temp;
ALTER FUNCTION find_similar_level_players(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION get_current_week() SET search_path = public, pg_temp;
ALTER FUNCTION get_daily_post_count(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION handle_like_challenges() SET search_path = public, pg_temp;
ALTER FUNCTION handle_post_look_challenge() SET search_path = public, pg_temp;
ALTER FUNCTION initialize_user_challenges(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION notify_on_like() SET search_path = public, pg_temp;
ALTER FUNCTION update_challenge_progress(uuid, text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION update_duel_stats() SET search_path = public, pg_temp;
ALTER FUNCTION update_profile_updated_at() SET search_path = public, pg_temp;
