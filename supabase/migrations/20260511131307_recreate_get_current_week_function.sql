/*
  # Recreate get_current_week function

  This function was missing from the database, causing signup to fail.
  It returns the current ISO week number and year, used by challenge initialization.
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
