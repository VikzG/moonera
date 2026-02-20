/*
  # Add follow notifications

  1. New trigger
    - `trigger_notify_on_follow` fires after INSERT on follows table
    - Creates a notification for the followed user with type 'follow'
    - Includes follower username and ID in the notification

  2. Notes
    - Uses existing `create_notification` function
    - Notification type is 'follow'
*/

CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER AS $$
DECLARE
  follower_username text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT username INTO follower_username FROM profiles WHERE id = NEW.follower_id;

    PERFORM create_notification(
      NEW.following_id,
      'follow',
      'Nouveau follower !',
      '@' || follower_username || ' a commence a te suivre',
      NEW.follower_id,
      NULL,
      jsonb_build_object('follower_id', NEW.follower_id, 'follower_username', follower_username)
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_notify_on_follow'
  ) THEN
    CREATE TRIGGER trigger_notify_on_follow
      AFTER INSERT ON follows
      FOR EACH ROW
      EXECUTE FUNCTION notify_on_follow();
  END IF;
END $$;