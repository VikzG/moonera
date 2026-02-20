/*
  # Add Clans System

  1. New Tables
    - `clans`
      - `id` (uuid, primary key)
      - `name` (text, unique, 3-20 characters)
      - `description` (text, max 300 characters)
      - `image_url` (text, clan logo/image)
      - `leader_id` (uuid, references profiles)
      - `member_count` (integer, default 1)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `clan_members`
      - `id` (uuid, primary key)
      - `clan_id` (uuid, references clans)
      - `user_id` (uuid, references profiles, unique - one clan per user)
      - `joined_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Public can view clans
    - Only Authentic Users with 10+ verified looks can create clans
    - Only clan leader can update/delete clan
    - Users can join/leave clans
    - One user = one clan maximum
    - One user can lead only one clan
    - Maximum 50 members per clan

  3. Functions
    - Auto-update member_count when members join/leave
    - Check user eligibility before clan creation
    - Prevent duplicate clan membership
*/

-- Create clans table
CREATE TABLE IF NOT EXISTS clans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL CHECK (char_length(name) >= 3 AND char_length(name) <= 20),
  description text CHECK (char_length(description) <= 300),
  image_url text,
  leader_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  member_count integer DEFAULT 1 CHECK (member_count >= 1 AND member_count <= 50),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create clan_members table
CREATE TABLE IF NOT EXISTS clan_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid REFERENCES clans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  joined_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clans_leader ON clans(leader_id);
CREATE INDEX IF NOT EXISTS idx_clan_members_clan ON clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_members_user ON clan_members(user_id);

-- Enable RLS
ALTER TABLE clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE clan_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clans table

-- Everyone can view clans (public)
CREATE POLICY "Anyone can view clans"
  ON clans FOR SELECT
  TO authenticated
  USING (true);

-- Only Authentic Users with 10+ verified looks can create clans
CREATE POLICY "Authentic users with 10+ verified looks can create clans"
  ON clans FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = leader_id
    AND NOT EXISTS (
      SELECT 1 FROM clans WHERE leader_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM clan_members WHERE user_id = auth.uid()
    )
    AND (
      SELECT COUNT(*)
      FROM looks
      WHERE user_id = auth.uid()
        AND is_authentic_look = true
    ) >= 10
  );

-- Only clan leader can update clan
CREATE POLICY "Clan leader can update clan"
  ON clans FOR UPDATE
  TO authenticated
  USING (auth.uid() = leader_id)
  WITH CHECK (auth.uid() = leader_id);

-- Only clan leader can delete clan
CREATE POLICY "Clan leader can delete clan"
  ON clans FOR DELETE
  TO authenticated
  USING (auth.uid() = leader_id);

-- RLS Policies for clan_members table

-- Everyone can view clan members
CREATE POLICY "Anyone can view clan members"
  ON clan_members FOR SELECT
  TO authenticated
  USING (true);

-- Users can join clans (if eligible)
CREATE POLICY "Users can join clans"
  ON clan_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM clan_members WHERE user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM clans WHERE leader_id = auth.uid()
    )
    AND (
      SELECT member_count FROM clans WHERE id = clan_id
    ) < 50
  );

-- Clan leader can remove members
CREATE POLICY "Clan leader can remove members"
  ON clan_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clans 
      WHERE id = clan_members.clan_id 
        AND leader_id = auth.uid()
    )
    OR auth.uid() = user_id
  );

-- Function to update member count when members join
CREATE OR REPLACE FUNCTION update_clan_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE clans 
    SET member_count = member_count + 1,
        updated_at = now()
    WHERE id = NEW.clan_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE clans 
    SET member_count = member_count - 1,
        updated_at = now()
    WHERE id = OLD.clan_id;
    
    -- Delete clan if no members left
    DELETE FROM clans 
    WHERE id = OLD.clan_id 
      AND member_count <= 0;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update member count
DROP TRIGGER IF EXISTS trigger_update_clan_member_count ON clan_members;
CREATE TRIGGER trigger_update_clan_member_count
  AFTER INSERT OR DELETE ON clan_members
  FOR EACH ROW
  EXECUTE FUNCTION update_clan_member_count();

-- Function to automatically add leader as first member
CREATE OR REPLACE FUNCTION add_leader_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO clan_members (clan_id, user_id)
  VALUES (NEW.id, NEW.leader_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to add leader as first member
DROP TRIGGER IF EXISTS trigger_add_leader_as_member ON clans;
CREATE TRIGGER trigger_add_leader_as_member
  AFTER INSERT ON clans
  FOR EACH ROW
  EXECUTE FUNCTION add_leader_as_member();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS trigger_update_clan_updated_at ON clans;
CREATE TRIGGER trigger_update_clan_updated_at
  BEFORE UPDATE ON clans
  FOR EACH ROW
  EXECUTE FUNCTION update_clan_updated_at();