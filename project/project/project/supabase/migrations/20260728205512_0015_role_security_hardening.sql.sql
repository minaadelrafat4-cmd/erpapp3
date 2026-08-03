/*
# Role Security Hardening
- handle_new_user() always inserts role = 'customer' (never trusts client metadata)
- One-time race-safe bootstrap of first super_admin via system_bootstrap table
- prevent_role_self_escalation trigger blocks client-side role/status changes
- enforce_employee_role_hierarchy trigger on employee_roles INSERT/DELETE
- role_permissions writes restricted to rank >= 100
*/

-- 1. handle_new_user(): never trust client-supplied role
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_must_change boolean := false;
BEGIN
  IF NEW.raw_user_meta_data->>'created_by_admin' = 'true' THEN
    v_must_change := true;
  END IF;
  INSERT INTO profiles (id, email, full_name, role, status, must_change_password)
  VALUES (NEW.id, NEW.email, coalesce(NEW.raw_user_meta_data->>'full_name', ''), 'customer', 'active', v_must_change);
  RETURN NEW;
END;
$$;

-- 2. One-time race-safe bootstrap
CREATE TABLE IF NOT EXISTS system_bootstrap (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES profiles(id)
);

INSERT INTO system_bootstrap (id, completed, completed_at)
SELECT true,
       EXISTS (SELECT 1 FROM profiles WHERE role IN ('super_admin', 'company_owner', 'admin')),
       CASE WHEN EXISTS (SELECT 1 FROM profiles WHERE role IN ('super_admin', 'company_owner', 'admin'))
            THEN now() END
ON CONFLICT (id) DO NOTHING;

ALTER TABLE system_bootstrap ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_auto_promote_first_user ON profiles;
DROP FUNCTION IF EXISTS auto_promote_first_user();

CREATE OR REPLACE FUNCTION bootstrap_owner_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_claimed boolean := false;
BEGIN
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

-- 3. Role hierarchy
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

CREATE OR REPLACE FUNCTION can_assign_role(p_target_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_staff_rank() >= 60
     AND (current_staff_rank() >= 100 OR current_staff_rank() > get_role_rank(p_target_role));
$$;

-- 4. Block direct client-side role/status changes
CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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

-- 5. Enforce hierarchy on employee_roles writes
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

-- 6. role_permissions: top-tier only
DROP POLICY IF EXISTS "staff_insert_role_permissions" ON role_permissions;
CREATE POLICY "topier_insert_role_permissions" ON role_permissions
  FOR INSERT TO authenticated WITH CHECK (current_staff_rank() >= 100);

DROP POLICY IF EXISTS "staff_delete_role_permissions" ON role_permissions;
CREATE POLICY "topier_delete_role_permissions" ON role_permissions
  FOR DELETE TO authenticated USING (current_staff_rank() >= 100);