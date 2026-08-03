/*
# Permission Matrix & View/Edit Access Levels

## Overview
Today, granting a role a permission is all-or-nothing, and several admin modules
(Orders, Products, Categories, Customers, Employees, Settings, Website Content,
Audit Logs, Returns & Refunds) have no permission row at all — meaning they can't
be restricted per role through any UI. On top of that, the frontend route guard
(PermissionRoute) silently ignored the `permission` prop entirely, so none of the
existing permission checks were actually enforced.

This migration:
1. Adds a `can_edit` flag to role_permissions, so a role can be granted read-only
   ("can view") or full ("can view and edit") access to a module, instead of only
   an all-or-nothing grant.
2. Adds the missing permission rows for every admin module so each one can be
   controlled from the new Access Control screen.
3. Seeds sensible default grants for existing roles so nobody loses access they
   currently rely on day to day (see inline comments for the reasoning per role).
4. Updates get_employee_permissions() to also return the can_edit flag per
   permission, so the frontend can tell "view only" apart from "can edit".

## Safety
- All existing role_permissions rows default can_edit = true, so today's
  behavior (full access wherever a permission was already granted) is unchanged.
- New permission rows start with zero grants except where explicitly seeded
  below — see comments for why each grant was added.
- Purely additive: no existing column, table, or row is removed.
*/

-- 1. View/edit granularity on role_permissions
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS can_edit boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN role_permissions.can_edit IS 'true = role can view and modify this module; false = view-only access';

-- 2. Fill in permission rows for every admin module that didn't have one yet
INSERT INTO permissions (name, description, module) VALUES
  ('dashboard.view', 'View the admin dashboard overview', 'overview'),
  ('orders.manage', 'View and manage customer orders', 'commerce'),
  ('returns_refunds.manage', 'View and process returns & refunds', 'commerce'),
  ('products.manage', 'View and manage the product catalog', 'commerce'),
  ('categories.manage', 'View and manage product categories', 'commerce'),
  ('customers.manage', 'View and manage customer accounts', 'commerce'),
  ('employees.manage', 'View and manage employee accounts and roles', 'operations'),
  ('settings.manage', 'View and manage store settings', 'administration'),
  ('content.manage', 'View and manage website content', 'administration'),
  ('audit_logs.view', 'View the audit log history', 'administration')
ON CONFLICT (name) DO NOTHING;

-- 3. Grant top-tier roles the new permissions too (they already get everything
--    that existed before this migration via the 0011 seed; this keeps that rule
--    true for the newly added rows as well).
INSERT INTO role_permissions (role_id, permission_id, can_edit)
SELECT r.id, p.id, true FROM roles r, permissions p
WHERE r.name IN ('super_admin', 'company_owner')
  AND p.name IN ('dashboard.view','orders.manage','returns_refunds.manage','products.manage',
    'categories.manage','customers.manage','employees.manage','settings.manage',
    'content.manage','audit_logs.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- general_manager already gets "everything except roles.manage/permissions.manage"
-- via a NOT IN wildcard seeded in migration 0011, so it automatically picks up
-- these new permissions too — nothing to do here.

-- dashboard.view: every staff role needs to be able to land on /admin after
-- login, or they'd hit an access-restricted wall immediately after signing in.
-- Grant it to every non-customer role, present and future-seeded ones included.
INSERT INTO role_permissions (role_id, permission_id, can_edit)
SELECT r.id, p.id, false FROM roles r, permissions p
WHERE r.name <> 'customer' AND p.name = 'dashboard.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- sales_employee: "Processes orders and customer interactions" — needs actual
-- order and customer access to do that job; the original seed only gave it
-- inventory.valuation, leaving no path to Orders/Customers at all.
INSERT INTO role_permissions (role_id, permission_id, can_edit)
SELECT r.id, p.id, true FROM roles r, permissions p
WHERE r.name = 'sales_employee' AND p.name IN ('orders.manage','customers.manage','returns_refunds.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- branch_manager: description says "manages a single branch and its staff",
-- and the 0011 comment for this role already said "branches + inventory (view)
-- + orders" — but the actual grant list never included orders. Fixing that gap,
-- and adding view-only access to products/customers so they can see (not edit)
-- what's happening at their branch.
INSERT INTO role_permissions (role_id, permission_id, can_edit)
SELECT r.id, p.id, true FROM roles r, permissions p
WHERE r.name = 'branch_manager' AND p.name = 'orders.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, can_edit)
SELECT r.id, p.id, false FROM roles r, permissions p
WHERE r.name = 'branch_manager' AND p.name IN ('products.manage','customers.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- warehouse_manager / inventory_employee: need to see product info while
-- doing stock work, but shouldn't edit product listings — view-only.
INSERT INTO role_permissions (role_id, permission_id, can_edit)
SELECT r.id, p.id, false FROM roles r, permissions p
WHERE r.name IN ('warehouse_manager','inventory_employee') AND p.name = 'products.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- marketing: "Manages blog, promotions, content" — the 0011 comment for this
-- role already said "content (no specific permission seeded yet)" but never
-- actually granted anything content-related. Fixing that gap.
INSERT INTO role_permissions (role_id, permission_id, can_edit)
SELECT r.id, p.id, true FROM roles r, permissions p
WHERE r.name = 'marketing' AND p.name = 'content.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- customer_support: "Handles customer inquiries and tickets" — needs to look
-- up customers and orders. Can edit customer records (e.g. contact info) but
-- gets view-only on orders (can look up status, shouldn't edit/cancel orders
-- directly) — a deliberate example of the new view/edit split in action.
INSERT INTO role_permissions (role_id, permission_id, can_edit)
SELECT r.id, p.id, true FROM roles r, permissions p
WHERE r.name = 'customer_support' AND p.name = 'customers.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, can_edit)
SELECT r.id, p.id, false FROM roles r, permissions p
WHERE r.name = 'customer_support' AND p.name IN ('orders.manage','returns_refunds.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. role_permissions never had an UPDATE policy (it was a pure existence
--    junction table until can_edit was added above). Add one, restricted to
--    the same top-tier-only rule already used for insert/delete on this table.
DROP POLICY IF EXISTS "topier_update_role_permissions" ON role_permissions;
CREATE POLICY "topier_update_role_permissions" ON role_permissions
  FOR UPDATE TO authenticated USING (current_staff_rank() >= 100) WITH CHECK (current_staff_rank() >= 100);

-- 4. get_employee_permissions() now also returns whether each permission is
--    view-only or full edit access, so the frontend can tell them apart.
DROP FUNCTION IF EXISTS get_employee_permissions();
CREATE OR REPLACE FUNCTION get_employee_permissions()
RETURNS TABLE (permission_name text, can_edit boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT perm.name, bool_or(grants.can_edit)
  FROM (
    SELECT rp.permission_id, rp.can_edit
    FROM profiles p
    JOIN employees e ON e.user_id = p.id
    JOIN employee_roles er ON er.employee_id = e.id
    JOIN role_permissions rp ON rp.role_id = er.role_id
    WHERE p.id = auth.uid()
    UNION ALL
    SELECT rp.permission_id, rp.can_edit
    FROM profiles p
    JOIN role_permissions rp ON rp.role_id = (
      SELECT r.id FROM roles r WHERE r.name = p.role LIMIT 1
    )
    WHERE p.id = auth.uid() AND p.role IN ('admin','super_admin','company_owner')
  ) grants
  JOIN permissions perm ON perm.id = grants.permission_id
  GROUP BY perm.name;
$$;
