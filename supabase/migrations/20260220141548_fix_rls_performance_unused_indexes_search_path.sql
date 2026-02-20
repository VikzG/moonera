/*
  # Fix Security and Performance Issues

  1. RLS Policy Optimizations
    - Replace `auth.uid()` with `(select auth.uid())` in policies on:
      - `daily_challenges` (view, update)
      - `look_items` (insert, update, delete)
      - `follows` (insert/follow, delete/unfollow)
    - This prevents re-evaluation of auth functions per row

  2. Drop Unused Indexes
    - Remove 38 unused indexes across multiple tables to reduce write overhead

  3. Fix Mutable Search Path
    - Set explicit `search_path = ''` on 9 public functions to prevent
      search_path injection vulnerabilities
*/

-- ============================================
-- 1. FIX RLS POLICIES (use select auth.uid())
-- ============================================

-- daily_challenges: "Users can view their own daily challenges"
DROP POLICY IF EXISTS "Users can view their own daily challenges" ON public.daily_challenges;
CREATE POLICY "Users can view their own daily challenges"
  ON public.daily_challenges FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- daily_challenges: "Users can update their own daily challenges"
DROP POLICY IF EXISTS "Users can update their own daily challenges" ON public.daily_challenges;
CREATE POLICY "Users can update their own daily challenges"
  ON public.daily_challenges FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- look_items: "Users can insert items for their own looks"
DROP POLICY IF EXISTS "Users can insert items for their own looks" ON public.look_items;
CREATE POLICY "Users can insert items for their own looks"
  ON public.look_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.looks
      WHERE looks.id = look_items.look_id
      AND looks.user_id = (select auth.uid())
    )
  );

-- look_items: "Users can update their own look items"
DROP POLICY IF EXISTS "Users can update their own look items" ON public.look_items;
CREATE POLICY "Users can update their own look items"
  ON public.look_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.looks
      WHERE looks.id = look_items.look_id
      AND looks.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.looks
      WHERE looks.id = look_items.look_id
      AND looks.user_id = (select auth.uid())
    )
  );

-- look_items: "Users can delete their own look items"
DROP POLICY IF EXISTS "Users can delete their own look items" ON public.look_items;
CREATE POLICY "Users can delete their own look items"
  ON public.look_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.looks
      WHERE looks.id = look_items.look_id
      AND looks.user_id = (select auth.uid())
    )
  );

-- follows: "Users can follow others"
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = follower_id);

-- follows: "Users can unfollow others"
DROP POLICY IF EXISTS "Users can unfollow others" ON public.follows;
CREATE POLICY "Users can unfollow others"
  ON public.follows FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = follower_id);


-- ============================================
-- 2. DROP UNUSED INDEXES
-- ============================================

DROP INDEX IF EXISTS public.idx_looks_user_id;
DROP INDEX IF EXISTS public.idx_looks_created_at;
DROP INDEX IF EXISTS public.idx_looks_weekly_ranking;
DROP INDEX IF EXISTS public.idx_likes_look_id;
DROP INDEX IF EXISTS public.idx_likes_user_id;
DROP INDEX IF EXISTS public.idx_notifications_read;
DROP INDEX IF EXISTS public.idx_duels_challenger;
DROP INDEX IF EXISTS public.idx_duels_challenged;
DROP INDEX IF EXISTS public.idx_duels_status_created;
DROP INDEX IF EXISTS public.idx_user_challenges_user_id;
DROP INDEX IF EXISTS public.idx_looks_ai_analysis;
DROP INDEX IF EXISTS public.idx_verification_logs_created_at;
DROP INDEX IF EXISTS public.idx_verification_logs_user_id;
DROP INDEX IF EXISTS public.idx_duels_status;
DROP INDEX IF EXISTS public.idx_duels_category;
DROP INDEX IF EXISTS public.idx_duels_created_at;
DROP INDEX IF EXISTS public.idx_duel_votes_duel_user;
DROP INDEX IF EXISTS public.idx_duel_votes_user;
DROP INDEX IF EXISTS public.idx_badges_user_id;
DROP INDEX IF EXISTS public.idx_badges_type;
DROP INDEX IF EXISTS public.idx_looks_is_authentic;
DROP INDEX IF EXISTS public.idx_looks_requires_verification;
DROP INDEX IF EXISTS public.idx_clans_leader;
DROP INDEX IF EXISTS public.idx_clan_members_clan;
DROP INDEX IF EXISTS public.idx_clan_members_user;
DROP INDEX IF EXISTS public.idx_clan_invitations_invited_user;
DROP INDEX IF EXISTS public.idx_clan_invitations_clan;
DROP INDEX IF EXISTS public.idx_clan_invitations_expires;
DROP INDEX IF EXISTS public.idx_clan_invitations_inviter_id;
DROP INDEX IF EXISTS public.idx_duels_challenged_look_id;
DROP INDEX IF EXISTS public.idx_duels_challenger_look_id;
DROP INDEX IF EXISTS public.idx_notifications_related_look_id;
DROP INDEX IF EXISTS public.idx_notifications_related_user_id;
DROP INDEX IF EXISTS public.idx_weekly_top_history_look_id;
DROP INDEX IF EXISTS public.idx_weekly_top_history_user_id;
DROP INDEX IF EXISTS public.idx_follows_following_id;
DROP INDEX IF EXISTS public.idx_daily_challenges_user_id;
DROP INDEX IF EXISTS public.idx_daily_challenges_date;
DROP INDEX IF EXISTS public.idx_daily_challenges_completed;
DROP INDEX IF EXISTS public.idx_look_items_look_id;
DROP INDEX IF EXISTS public.idx_follows_follower_id;


-- ============================================
-- 3. FIX MUTABLE SEARCH_PATH ON FUNCTIONS
-- ============================================

ALTER FUNCTION public.update_follow_counts() SET search_path = '';
ALTER FUNCTION public.notify_on_follow() SET search_path = '';
ALTER FUNCTION public.update_look_likes_count() SET search_path = '';
ALTER FUNCTION public.initialize_daily_challenges(uuid) SET search_path = '';
ALTER FUNCTION public.handle_look_challenges() SET search_path = '';
ALTER FUNCTION public.handle_duel_challenges() SET search_path = '';
ALTER FUNCTION public.initialize_user_challenges(uuid) SET search_path = '';
ALTER FUNCTION public.update_daily_challenge_progress(uuid, text, integer) SET search_path = '';
ALTER FUNCTION public.handle_like_challenges() SET search_path = '';
