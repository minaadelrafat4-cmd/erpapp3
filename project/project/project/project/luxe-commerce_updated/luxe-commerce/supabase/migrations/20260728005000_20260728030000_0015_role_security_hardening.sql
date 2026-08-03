/*
# Role Security Hardening

## Problem
1. handle_new_user() previously read `role` straight from auth signup metadata
   (raw_user_meta_data), which is fully controlled by whoever calls
   supabase.auth.signUp() — including anonymous callers hitting the API
   directly (not just through the app UI). Anyone could self-signup with
   {"role": "super_admin"} and be granted staff/admin access.
2. auto_promote_first_user() promoted the first row in `profiles` to
   super_admin based on a plain COUNT(*), which is racy and — because it
   re-evaluates on every insert — could theoretically fire again if the
   profiles table were ever emptied.
3. profiles.role could be updated directly by any authenticated staff
   member via the client SDK (`staff_update_profile` policy only checked
   is_staff(), not which columns changed), letting a low-privilege staff
   account promote itself.
4. employee_roles could be inserted/deleted directly by any staff member
   via the client SDK (RLS only checked is_staff()), bypassing the
   hierarchy checks that only existed inside the admin-create-employee
   edge function — and only for *new* employees, not role edits on
   existing ones.
5. role_permissions (which permissions a role grants) could be modified
   by any staff member, letting low-privilege staff grant their own role
   additional permissions.

## Fix
- handle_new_user() now ALWAYS inserts role = 'customer'. Signup metadata
  is never trusted for role assignment, full stop.
- A dedicated, RLS-locked singleton table (system_bootstrap) tracks
  whether the one-time "first user becomes super_admin" step has already
  run, and claims it atomically (UPDATE ... WHERE completed = false) so
  it can only ever fire once, for exactly one user, even under concurrent
  signups — and can never re-fire later even if all profiles are deleted.
- A new prevent_role_self_escalation trigger blocks any change to
  profiles.role / status / must_change_password unless the request comes
  from the service role (i.e. an edge function or the SQL editor) —
  ordinary authenticated staff can no longer touch these columns on any
  profile, including their own, via the client SDK.
- A role-rank hierarchy (get_role_rank / can_assign_role) is enforced by
  a trigger on employee_roles for both INSERT and DELETE, so the "who can
  assign/remove which role" rule is enforced in the database itself, not
  only inside the edge function.
- role_permissions writes are restricted to top-tier roles only
  (rank >= 100), since editing what a role can do is equivalent to
  granting permissions.
*/

-- =========================================================
-- 1. handle_new_user(): never trust client-supplied role
-- =========================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_must_change boolean := false;
BEGIN
  -- created_by_admin is only ever used to decide whether to prompt a
  -- password change on first login. It is NEVER used to grant a role —
  -- even if a client sets it themselves during self-signup, the worst
  -- case is an extra "change your password" prompt, not a privilege gain.
  IF NEW.raw_user_meta_data->>'created_by_admin' = 'true' THEN
    v_must_change := true;
  END IF;

  -- Every new auth.users row becomes a plain customer profile, no
  -- exceptions. Employee accounts are promoted afterwards, exclusively
  -- by the admin-create-employee edge function running as service_role
  -- (see prevent_role_self_escalation below for why that's still safe).
  INSERT INTO profiles (id, email, full_name, role, status, must_change_password)
  VALUES (NEW.id, NEW.email, coalesce(NEW.raw_user_meta_data->>'full_name', ''), 'customer', 'active', v_must_change);
  RETURN NEW;
END;
$$;

-- =========================================================
-- 2. One-time, race-safe bootstrap of the first super_admin
-- =========================================================
CREATE TABLE IF NOT EXISTS system_bootstrap (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true), -- enforces a single row
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES profiles(id)
);

-- If this migration is applied to a database that already has at least
-- one owner/admin-tier account (i.e. this is an existing production
-- system, not a brand new deployment), the bootstrap slot must start
-- as already-consumed — otherwise the very next public signup after
-- this migration runs would become super_admin, reopening the exact
-- hole this migration closes.
INSERT INTO system_bootstrap (id, completed, completed_at)
SELECT true,
       EXISTS (SELECT 1 FROM profiles WHERE role IN ('super_admin', 'company_owner', 'admin')),
       CASE WHEN EXISTS (SELECT 1 FROM profiles WHERE role IN ('super_admin', 'company_owner', 'admin'))
            THEN now() END
ON CONFLICT (id) DO NOTHING;

ALTER TABLE system_bootstrap ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: nobody can read or write this table through
-- the client SDK (anon or authenticated). Only SECURITY DEFINER functions
-- owned by the table owner (below) can touch it.

DROP TRIGGER IF EXISTS trg_auto_promote_first_user ON profiles;
DROP FUNCTION IF EXISTS auto_promote_first_user();

CREATE OR REPLACE FUNCTION bootstrap_owner_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_claimed boolean := false;
BEGIN
  -- Only ordinary self-signups (role = 'customer', not an admin-created
  -- employee account) are eligible to claim the bootstrap slot. This is
  -- a defensive exclusion, not a trust decision: created_by_admin can
  -- only ever remove eligibility, never grant a role.
  IF NEW.role = 'customer' AND NEW.must_change_password = false THEN
    UPDATE system_bootstrap
    SET completed = true, completed_at = now(), completed_by = NEW.id
    WHERE id = true AND completed = false
    RETURNING true INTO v_claimed;

    IF v_claimed THEN
      NEW.role := 'super_admin';
      NEW.status := 'active';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bootstrap_owner_account
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION bootstrap_owner_account();

-- =========================================================
-- 3. Role hierarchy (single source of truth in the DB)
-- =========================================================
CREATE OR REPLACE FUNCTION get_role_rank(p_role text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_role
    WHEN 'super_admin'        THEN 100
    WHEN 'company_owner'      THEN 100
    WHEN 'admin'              THEN 100
    WHEN 'general_manager'    THEN 80
    WHEN 'warehouse_manager'  THEN 60
    WHEN 'branch_manager'     THEN 60
    WHEN 'manager'            THEN 60
    WHEN 'inventory_employee' THEN 40
    WHEN 'sales_employee'     THEN 40
    WHEN 'marketing'          THEN 40
    WHEN 'accountant'         THEN 40
    WHEN 'customer_support'   THEN 40
    WHEN 'staff'              THEN 20
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION current_staff_rank()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(get_role_rank(role), 0) FROM profiles WHERE id = auth.uid();
$$;

-- Owner/admin tier (100) can assign any role, including other owners/admins.
-- Everyone else may only assign a STRICTLY lower-ranked role, and must
-- themselves be at least manager-tier (60) to assign anything at all.
CREATE OR REPLACE FUNCTION can_assign_role(p_target_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_staff_rank() >= 60
     AND (current_staff_rank() >= 100 OR current_staff_rank() > get_role_rank(p_target_role));
$$;

-- =========================================================
-- 4. Block direct client-side role/status changes on profiles
-- =========================================================
CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- The service role (edge functions, e.g. admin-create-employee) and
  -- direct SQL execution (dashboard/migrations, no JWT context) bypass
  -- this check — they are already trusted, privileged contexts.
  IF COALESCE(auth.role(), 'service_role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'role, status and must_change_password can only be changed through the employee management system';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_self_escalation();

-- =========================================================
-- 5. Enforce hierarchy on employee_roles writes (DB-level,
--    independent of the edge function)
-- =========================================================
CREATE OR REPLACE FUNCTION enforce_employee_role_hierarchy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role_name text;
  v_role_id uuid;
BEGIN
  IF COALESCE(auth.role(), 'service_role') = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_role_id := COALESCE(NEW.role_id, OLD.role_id);
  SELECT name INTO v_role_name FROM roles WHERE id = v_role_id;

  IF NOT can_assign_role(v_role_name) THEN
    RAISE EXCEPTION 'insufficient privileges to assign or remove role %', v_role_name;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_employee_role_hierarchy_ins ON employee_roles;
CREATE TRIGGER trg_enforce_employee_role_hierarchy_ins
  BEFORE INSERT ON employee_roles
  FOR EACH ROW EXECUTE FUNCTION enforce_employee_role_hierarchy();

DROP TRIGGER IF EXISTS trg_enforce_employee_role_hierarchy_del ON employee_roles;
CREATE TRIGGER trg_enforce_employee_role_hierarchy_del
  BEFORE DELETE ON employee_roles
  FOR EACH ROW EXECUTE FUNCTION enforce_employee_role_hierarchy();

-- =========================================================
-- 6. role_permissions: top-tier only (self-permission-granting fix)
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_role_permissions" ON role_permissions;
CREATE POLICY "topier_insert_role_permissions" ON role_permissions
  FOR INSERT TO authenticated WITH CHECK (current_staff_rank() >= 100);

DROP POLICY IF EXISTS "staff_delete_role_permissions" ON role_permissions;
CREATE POLICY "topier_delete_role_permissions" ON role_permissions
  FOR DELETE TO authenticated USING (current_staff_rank() >= 100);
