/*
  # Add Authentic Verification System

  1. Changes to profiles table
    - Add `is_authentic` (boolean) - Whether user completed verification
    - Add `face_embedding` (text) - Face embedding as JSON string for duplicate detection
    - Add `verification_attempts` (integer) - Track verification attempts
    - Add `verification_status` (text) - Status: 'libre', 'pending', 'verified', 'failed'
    
  2. New Tables
    - `verification_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `step` (text) - 'liveness' or 'ai_detection'
      - `status` (text) - 'success' or 'failed'
      - `details` (jsonb) - Additional verification details
      - `created_at` (timestamp)
  
  3. Security
    - Enable RLS on verification_logs
    - Add policies for users to read their own verification logs
    - Add policies for authenticated users to insert verification logs
    
  4. Important Notes
    - Users can retry verification multiple times
    - Face embeddings are used to prevent duplicate accounts
    - Verification logs help track the verification process
*/

-- Add verification columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_authentic'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_authentic boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'face_embedding'
  ) THEN
    ALTER TABLE profiles ADD COLUMN face_embedding text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'verification_attempts'
  ) THEN
    ALTER TABLE profiles ADD COLUMN verification_attempts integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN verification_status text DEFAULT 'libre' CHECK (verification_status IN ('libre', 'pending', 'verified', 'failed'));
  END IF;
END $$;

-- Create verification logs table
CREATE TABLE IF NOT EXISTS verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  step text NOT NULL CHECK (step IN ('liveness', 'ai_detection')),
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;

-- Policies for verification_logs
CREATE POLICY "Users can read own verification logs"
  ON verification_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification logs"
  ON verification_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Index for verification logs
CREATE INDEX IF NOT EXISTS idx_verification_logs_user_id 
  ON verification_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_verification_logs_created_at 
  ON verification_logs(created_at DESC);