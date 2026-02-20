/*
  # Add Notifications System and Prevent Self-Likes
  
  ## Overview
  Implements a notification system to alert users when they receive likes.
  Prevents users from liking their own looks.
  
  ## New Tables
  
  ### `notifications`
  User notifications for various activities
  - `id` (uuid, primary key) - Unique notification identifier
  - `user_id` (uuid, foreign key) - User who receives the notification
  - `type` (text) - Notification type: 'like', 'badge_earned', 'top_100'
  - `title` (text) - Notification title
  - `message` (text) - Notification message
  - `read` (boolean) - Whether notification has been read
  - `related_user_id` (uuid) - User who triggered the notification (e.g., who liked)
  - `related_look_id` (uuid) - Related look if applicable
  - `metadata` (jsonb) - Additional data (e.g., badge info)
  - `created_at` (timestamptz) - Notification timestamp
  
  ## Changes
  
  1. Create notifications table with RLS
  2. Add CHECK constraint to prevent users from liking their own looks
  3. Add function to create notifications
  4. Add trigger to create notification when a like is received
  
  ## Security
  
  - RLS enabled on notifications table
  - Users can only view and update their own notifications
  - CHECK constraint prevents self-likes at database level
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'badge_earned', 'top_100', 'level_up')),
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  related_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  related_look_id uuid REFERENCES looks(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add constraint to prevent users from liking their own looks
-- First, we need to add a function to check if user is not the look owner
CREATE OR REPLACE FUNCTION check_not_own_look()
RETURNS TRIGGER AS $$
DECLARE
  look_owner_id uuid;
BEGIN
  -- Get the owner of the look being liked
  SELECT user_id INTO look_owner_id FROM looks WHERE id = NEW.look_id;
  
  -- Prevent self-likes
  IF NEW.user_id = look_owner_id THEN
    RAISE EXCEPTION 'Users cannot like their own looks';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to prevent self-likes
DROP TRIGGER IF EXISTS trigger_prevent_self_likes ON likes;
CREATE TRIGGER trigger_prevent_self_likes
BEFORE INSERT ON likes
FOR EACH ROW
EXECUTE FUNCTION check_not_own_look();

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_related_user_id uuid DEFAULT NULL,
  p_related_look_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    related_user_id,
    related_look_id,
    metadata
  )
  VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_related_user_id,
    p_related_look_id,
    p_metadata
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification when someone likes a look
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER AS $$
DECLARE
  look_owner_id uuid;
  liker_username text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get the look owner
    SELECT user_id INTO look_owner_id FROM looks WHERE id = NEW.look_id;
    
    -- Get the username of the person who liked
    SELECT username INTO liker_username FROM profiles WHERE id = NEW.user_id;
    
    -- Create notification for look owner (only if not liking their own look)
    IF look_owner_id != NEW.user_id THEN
      PERFORM create_notification(
        look_owner_id,
        'like',
        'Nouveau like !',
        '@' || liker_username || ' a aimé ta tenue',
        NEW.user_id,
        NEW.look_id,
        jsonb_build_object('liker_id', NEW.user_id, 'liker_username', liker_username)
      );
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to create notification on like
DROP TRIGGER IF EXISTS trigger_notify_on_like ON likes;
CREATE TRIGGER trigger_notify_on_like
AFTER INSERT ON likes
FOR EACH ROW
EXECUTE FUNCTION notify_on_like();