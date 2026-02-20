/*
  # Add follows system

  1. New Tables
    - `follows`
      - `id` (uuid, primary key)
      - `follower_id` (uuid, references profiles.id) - the user who follows
      - `following_id` (uuid, references profiles.id) - the user being followed
      - `created_at` (timestamptz, default now())
    - Unique constraint on (follower_id, following_id) to prevent duplicate follows
    - Check constraint to prevent self-follows

  2. New Columns on `profiles`
    - `followers_count` (integer, default 0) - cached count of followers
    - `following_count` (integer, default 0) - cached count of following

  3. Security
    - Enable RLS on `follows` table
    - Authenticated users can view all follows
    - Authenticated users can insert follows where they are the follower
    - Authenticated users can delete follows where they are the follower

  4. Triggers
    - Auto-increment/decrement followers_count and following_count on profiles
*/

CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT follows_unique UNIQUE (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view follows"
  ON follows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can follow others"
  ON follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others"
  ON follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'followers_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN followers_count integer DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'following_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN following_count integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    UPDATE profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_follow_counts'
  ) THEN
    CREATE TRIGGER trigger_update_follow_counts
      AFTER INSERT OR DELETE ON follows
      FOR EACH ROW
      EXECUTE FUNCTION update_follow_counts();
  END IF;
END $$;