/*
  # Recreate get_current_week function and fix trigger

  The get_current_week function was missing, causing profile creation to fail.
  This migration recreates it and ensures the trigger works correctly.
*/

CREATE OR REPLACE FUNCTION get_current_week()
RETURNS TABLE(week_number integer, year integer)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(WEEK FROM CURRENT_DATE)::integer AS week_number,
    EXTRACT(YEAR FROM CURRENT_DATE)::integer AS year;
END;
$$;
