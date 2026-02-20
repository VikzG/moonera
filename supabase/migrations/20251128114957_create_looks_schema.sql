/*
  # LOOKS App - Database Schema V1
  
  ## Overview
  Complete database structure for the LOOKS fashion app MVP, focusing on visual style sharing,
  likes, weekly rankings, and badge progression system.
  
  ## New Tables
  
  ### `profiles`
  User profile information extending Supabase auth.users
  - `id` (uuid, primary key) - References auth.users
  - `username` (text, unique) - User's display name
  - `full_name` (text) - Optional full name
  - `bio` (text) - Optional user biography
  - `avatar_url` (text) - Profile picture URL
  - `total_likes` (integer) - Cumulative likes across all looks
  - `weekly_top_count` (integer) - Number of times in weekly top 100
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last profile update
  
  ### `looks`
  Fashion outfit posts by users
  - `id` (uuid, primary key) - Unique look identifier
  - `user_id` (uuid, foreign key) - References profiles(id)
  - `image_url` (text) - Main look image URL
  - `category` (text) - Style category (streetwear, chic, casual, vintage, sport, etc.)
  - `likes_count` (integer) - Current number of likes
  - `is_weekly_top` (boolean) - Currently in weekly top 100
  - `week_number` (integer) - ISO week number for tracking
  - `year` (integer) - Year for weekly tracking
  - `created_at` (timestamptz) - Publication timestamp
  
  ### `likes`
  User likes on looks (one like per user per look)
  - `id` (uuid, primary key) - Unique like identifier
  - `user_id` (uuid, foreign key) - User who liked
  - `look_id` (uuid, foreign key) - Look that was liked
  - `created_at` (timestamptz) - Like timestamp
  - Unique constraint on (user_id, look_id)
  
  ### `weekly_top_history`
  Historical record of weekly top 100 looks
  - `id` (uuid, primary key) - Unique record identifier
  - `look_id` (uuid, foreign key) - Look in top 100
  - `user_id` (uuid, foreign key) - Look owner
  - `week_number` (integer) - ISO week number
  - `year` (integer) - Year
  - `rank` (integer) - Position in top 100 (1-100)
  - `likes_count` (integer) - Likes at time of ranking
  - `created_at` (timestamptz) - Record creation timestamp
  
  ### `badges`
  User achievement badges for weekly top appearances
  - `id` (uuid, primary key) - Unique badge identifier
  - `user_id` (uuid, foreign key) - Badge owner
  - `badge_type` (text) - Badge level: 'rising_star', 'elite_style', 'legend'
  - `achieved_at` (timestamptz) - Badge achievement timestamp
  - `weekly_top_count` (integer) - Number of weekly tops at achievement
  
  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can read all public data
  - Users can only modify their own data
  - Like system prevents duplicate likes
  - Anti-fraud measures through unique constraints
  
  ## Indexes
  - Optimized queries for feed (created_at DESC)
  - Weekly rankings (week_number, year, likes_count DESC)
  - User lookups (username, user_id)
  - Like counting (look_id)
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text,
  bio text,
  avatar_url text,
  total_likes integer DEFAULT 0,
  weekly_top_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create looks table
CREATE TABLE IF NOT EXISTS looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  category text NOT NULL,
  likes_count integer DEFAULT 0,
  is_weekly_top boolean DEFAULT false,
  week_number integer,
  year integer,
  created_at timestamptz DEFAULT now()
);

-- Create likes table
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  look_id uuid NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, look_id)
);

-- Create weekly_top_history table
CREATE TABLE IF NOT EXISTS weekly_top_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  look_id uuid NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  year integer NOT NULL,
  rank integer NOT NULL,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create badges table
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_type text NOT NULL CHECK (badge_type IN ('rising_star', 'elite_style', 'legend')),
  achieved_at timestamptz DEFAULT now(),
  weekly_top_count integer NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_looks_user_id ON looks(user_id);
CREATE INDEX IF NOT EXISTS idx_looks_created_at ON looks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_looks_weekly_ranking ON looks(week_number, year, likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_likes_look_id ON likes(look_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_top_week ON weekly_top_history(week_number, year, rank);
CREATE INDEX IF NOT EXISTS idx_badges_user_id ON badges(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE looks ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_top_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Looks policies
CREATE POLICY "Looks are viewable by everyone"
  ON looks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own looks"
  ON looks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own looks"
  ON looks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own looks"
  ON looks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Likes policies
CREATE POLICY "Likes are viewable by everyone"
  ON likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own likes"
  ON likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Weekly top history policies
CREATE POLICY "Weekly top history is viewable by everyone"
  ON weekly_top_history FOR SELECT
  TO authenticated
  USING (true);

-- Badges policies
CREATE POLICY "Badges are viewable by everyone"
  ON badges FOR SELECT
  TO authenticated
  USING (true);

-- Function to update look likes count
CREATE OR REPLACE FUNCTION update_look_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE looks SET likes_count = likes_count + 1 WHERE id = NEW.look_id;
    UPDATE profiles SET total_likes = total_likes + 1 WHERE id = (SELECT user_id FROM looks WHERE id = NEW.look_id);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE looks SET likes_count = likes_count - 1 WHERE id = OLD.look_id;
    UPDATE profiles SET total_likes = total_likes - 1 WHERE id = (SELECT user_id FROM looks WHERE id = OLD.look_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update likes count
CREATE TRIGGER trigger_update_look_likes_count
AFTER INSERT OR DELETE ON likes
FOR EACH ROW
EXECUTE FUNCTION update_look_likes_count();

-- Function to update profile updated_at
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update profile updated_at
CREATE TRIGGER trigger_update_profile_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profile_updated_at();