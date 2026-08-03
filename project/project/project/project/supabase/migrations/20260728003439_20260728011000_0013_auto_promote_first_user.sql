/*
# Auto-promote first user to super_admin

Ensures the first user who signs up gets super_admin role so they can
access the admin dashboard and create employee accounts.
Uses a trigger on profiles that fires AFTER INSERT.
*/

CREATE OR REPLACE FUNCTION auto_promote_first_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_count integer;
BEGIN
  SELECT count(*) INTO v_user_count FROM profiles;
  -- If this is the very first user, promote them to super_admin
  IF v_user_count = 1 AND NEW.role = 'customer' THEN
    NEW.role := 'super_admin';
    NEW.must_change_password := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_promote_first_user ON profiles;
CREATE TRIGGER trg_auto_promote_first_user
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION auto_promote_first_user();
