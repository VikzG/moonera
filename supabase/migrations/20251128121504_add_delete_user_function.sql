/*
  # Add delete user function
  
  ## Changes
  - Creates a function to allow users to delete their own account
  - The function deletes the user's profile which cascades to all related data
  - Uses auth.uid() to ensure users can only delete their own account
  
  ## Security
  - Function is SECURITY DEFINER to allow deletion
  - Only authenticated users can call it
  - Only deletes data for the calling user
*/

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;