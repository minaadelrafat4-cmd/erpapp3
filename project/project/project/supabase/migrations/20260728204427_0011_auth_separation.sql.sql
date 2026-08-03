/*
# Auth Separation — Customer vs Employee Authentication

## Overview
Separates customer and employee authentication flows. Customers self-register via /signup;
employees are provisioned by authorized admin users via the admin dashboard.

## Changes
1. handle_new_user() trigger now reads role from user metadata — admin-created users get
   their assigned role (e.g. 'warehouse_manager'), customer signups default to 'customer'.
2. profiles: add must_change_password column for admin-created accounts.
3. New function: get_employee_permissions() — returns all permission names for the current
   user's employee role(s), used by the frontend for RBAC route protection.
4. New function: is_customer() — returns true if the current user has a customer role.
5. Seed role_permissions so each hierarchy role has appropriate module access.

## Security
- handle_new_user is SECURITY DEFINER — runs as the database owner, not the caller.
- get_employee_permissions is SECURITY DEFINER with fixed search_path.
- No RLS policy changes — existing is_staff() gate on ERP tables is preserved.
- Employee account creation happens via an edge function using the service role key
  (admin users cannot call auth.admin.createUser from the browser).
*/

-- 1. Add must_change_password to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN profiles.must_change_password IS 'True for admin-created employee accounts — prompts password change on first login.';

-- 2. Modify handle_new_user to respect role from metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_must_change boolean := false;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  IF NEW.raw_user_meta_data->>'created_by_admin' = 'true' THEN
    v_must_change := true;
  END IF;
  INSERT INTO profiles (id, email, full_name, role, status, must_change_password)
  VALUES (NEW.id, NEW.email, coalesce(NEW.raw_user_meta_data->>'full_name', ''), v_role, 'active', v_must_change);
  RETURN NEW;
END;
$$;

-- 3. get_employee_permissions() — returns permission names for the current user
CREATE OR REPLACE FUNCTION get_employee_permissions()
RETURNS TABLE (permission_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT perm.name
  FROM profiles p
  JOIN employees e ON e.user_id = p.id
  JOIN employee_roles er ON er.employee_id = e.id
  JOIN role_permissions rp ON rp.role_id = er.role_id
  JOIN permissions perm ON perm.id = rp.permission_id
  WHERE p.id = auth.uid()
  UNION ALL
  SELECT perm.name
  FROM profiles p
  JOIN role_permissions rp ON rp.role_id = (
    SELECT r.id FROM roles r WHERE r.name = p.role LIMIT 1
  )
  JOIN permissions perm ON perm.id = rp.permission_id
  WHERE p.id = auth.uid() AND p.role IN ('admin','super_admin','company_owner');
$$;

-- 4. is_customer() helper
CREATE OR REPLACE FUNCTION is_customer()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'customer' AND status = 'active'
  );
$$;

-- 5. Seed role_permissions — map hierarchy roles to module permissions
-- Super admin and company owner get ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('super_admin', 'company_owner')
ON CONFLICT DO NOTHING;

-- General manager: everything except roles.manage and permissions.manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'general_manager'
  AND p.name NOT IN ('roles.manage', 'permissions.manage')
ON CONFLICT DO NOTHING;

-- Warehouse manager: inventory + warehouses + stock transfers + purchase orders
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'warehouse_manager'
  AND p.name IN ('warehouses.manage', 'inventory.adjust', 'inventory.transfer',
    'inventory.valuation', 'purchase_orders.manage', 'purchase_orders.receive',
    'suppliers.manage', 'suppliers.payments', 'reports.financial')
ON CONFLICT DO NOTHING;

-- Branch manager: branches + inventory (view) + orders
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'branch_manager'
  AND p.name IN ('branches.manage', 'inventory.valuation', 'reports.financial')
ON CONFLICT DO NOTHING;

-- Inventory employee: stock only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'inventory_employee'
  AND p.name IN ('inventory.adjust', 'inventory.transfer', 'inventory.valuation')
ON CONFLICT DO NOTHING;

-- Sales employee: orders (no specific permission seeded yet — add basic)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'sales_employee'
  AND p.name IN ('inventory.valuation')
ON CONFLICT DO NOTHING;

-- Accountant: finance modules only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'accountant'
  AND p.name IN ('expenses.manage', 'reports.financial', 'suppliers.payments')
ON CONFLICT DO NOTHING;

-- Marketing: content (no specific permission seeded yet)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'marketing'
  AND p.name IN ('reports.financial')
ON CONFLICT DO NOTHING;

-- Customer support: reports only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'customer_support'
  AND p.name IN ('reports.financial')
ON CONFLICT DO NOTHING;
