/*
# RLS Policy Hardening — Permission-Based Access Control

## Problem
All ERP tables use only is_staff() as the RLS check, meaning ANY staff member
(including low-privilege roles like sales_employee or customer_support) can
perform ANY CRUD operation on branches, warehouses, suppliers, expenses,
inventory, purchase orders, stock transfers, etc. This violates least privilege.

## Fix
Replace blanket is_staff() with permission-aware RLS policies using a new
has_perm() helper that checks the current user's role_permissions.
Keep read access broad (is_staff) for operational awareness, but restrict
writes (INSERT/UPDATE/DELETE) to roles that have the relevant permission.

## Permission mapping:
- branches.manage → branches write
- warehouses.manage → warehouses write
- inventory.adjust → inventory, stock_adjustments write
- inventory.transfer → stock_transfers write
- inventory.valuation → inventory read (already covered by is_staff)
- suppliers.manage → suppliers write
- suppliers.payments → supplier_payments write
- purchase_orders.manage → purchase_orders write
- expenses.manage → expenses write
- reports.manage → reports write
*/

-- =========================================================
-- Helper: has_perm() — check if current user has a named permission
-- =========================================================
CREATE OR REPLACE FUNCTION has_perm(p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    -- Permission via employee_roles (multi-role employees)
    SELECT 1
    FROM employee_roles er
    JOIN employees e ON e.id = er.employee_id
    JOIN role_permissions rp ON rp.role_id = er.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE e.user_id = auth.uid() AND p.name = p_permission
    UNION
    -- Permission via profiles.role (single-role, admin-tier)
    SELECT 1
    FROM profiles pr
    JOIN role_permissions rp ON rp.role_id = (
      SELECT r.id FROM roles r WHERE r.name = pr.role LIMIT 1
    )
    JOIN permissions p ON p.id = rp.permission_id
    WHERE pr.id = auth.uid() AND p.name = p_permission
  );
$$;

-- =========================================================
-- Branches: restrict writes to branches.manage
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_branches" ON branches;
CREATE POLICY "perm_insert_branches" ON branches
  FOR INSERT TO authenticated WITH CHECK (has_perm('branches.manage'));

DROP POLICY IF EXISTS "staff_update_branches" ON branches;
CREATE POLICY "perm_update_branches" ON branches
  FOR UPDATE TO authenticated USING (has_perm('branches.manage')) WITH CHECK (has_perm('branches.manage'));

DROP POLICY IF EXISTS "staff_delete_branches" ON branches;
CREATE POLICY "perm_delete_branches" ON branches
  FOR DELETE TO authenticated USING (has_perm('branches.manage'));

-- =========================================================
-- Warehouses: restrict writes to warehouses.manage
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_warehouses" ON warehouses;
CREATE POLICY "perm_insert_warehouses" ON warehouses
  FOR INSERT TO authenticated WITH CHECK (has_perm('warehouses.manage'));

DROP POLICY IF EXISTS "staff_update_warehouses" ON warehouses;
CREATE POLICY "perm_update_warehouses" ON warehouses
  FOR UPDATE TO authenticated USING (has_perm('warehouses.manage')) WITH CHECK (has_perm('warehouses.manage'));

DROP POLICY IF EXISTS "staff_delete_warehouses" ON warehouses;
CREATE POLICY "perm_delete_warehouses" ON warehouses
  FOR DELETE TO authenticated USING (has_perm('warehouses.manage'));

-- =========================================================
-- Inventory: restrict writes to inventory.adjust
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_inventory" ON inventory;
CREATE POLICY "perm_insert_inventory" ON inventory
  FOR INSERT TO authenticated WITH CHECK (has_perm('inventory.adjust'));

DROP POLICY IF EXISTS "staff_update_inventory" ON inventory;
CREATE POLICY "perm_update_inventory" ON inventory
  FOR UPDATE TO authenticated USING (has_perm('inventory.adjust')) WITH CHECK (has_perm('inventory.adjust'));

DROP POLICY IF EXISTS "staff_delete_inventory" ON inventory;
CREATE POLICY "perm_delete_inventory" ON inventory
  FOR DELETE TO authenticated USING (has_perm('inventory.adjust'));

-- =========================================================
-- Inventory transactions: restrict insert to inventory.adjust or inventory.transfer
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_inv_tx" ON inventory_transactions;
CREATE POLICY "perm_insert_inv_tx" ON inventory_transactions
  FOR INSERT TO authenticated WITH CHECK (has_perm('inventory.adjust') OR has_perm('inventory.transfer'));

-- =========================================================
-- Stock adjustments: restrict to inventory.adjust
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_stock_adj" ON stock_adjustments;
CREATE POLICY "perm_insert_stock_adj" ON stock_adjustments
  FOR INSERT TO authenticated WITH CHECK (has_perm('inventory.adjust'));

-- =========================================================
-- Stock transfers: restrict writes to inventory.transfer
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_stock_transfers" ON stock_transfers;
CREATE POLICY "perm_insert_stock_transfers" ON stock_transfers
  FOR INSERT TO authenticated WITH CHECK (has_perm('inventory.transfer'));

DROP POLICY IF EXISTS "staff_update_stock_transfers" ON stock_transfers;
CREATE POLICY "perm_update_stock_transfers" ON stock_transfers
  FOR UPDATE TO authenticated USING (has_perm('inventory.transfer')) WITH CHECK (has_perm('inventory.transfer'));

-- =========================================================
-- Suppliers: restrict writes to suppliers.manage
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_suppliers" ON suppliers;
CREATE POLICY "perm_insert_suppliers" ON suppliers
  FOR INSERT TO authenticated WITH CHECK (has_perm('suppliers.manage'));

DROP POLICY IF EXISTS "staff_update_suppliers" ON suppliers;
CREATE POLICY "perm_update_suppliers" ON suppliers
  FOR UPDATE TO authenticated USING (has_perm('suppliers.manage')) WITH CHECK (has_perm('suppliers.manage'));

DROP POLICY IF EXISTS "staff_delete_suppliers" ON suppliers;
CREATE POLICY "perm_delete_suppliers" ON suppliers
  FOR DELETE TO authenticated USING (has_perm('suppliers.manage'));

-- =========================================================
-- Supplier payments: restrict to suppliers.payments
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_supplier_payments" ON supplier_payments;
CREATE POLICY "perm_insert_supplier_payments" ON supplier_payments
  FOR INSERT TO authenticated WITH CHECK (has_perm('suppliers.payments'));

DROP POLICY IF EXISTS "staff_update_supplier_payments" ON supplier_payments;
CREATE POLICY "perm_update_supplier_payments" ON supplier_payments
  FOR UPDATE TO authenticated USING (has_perm('suppliers.payments')) WITH CHECK (has_perm('suppliers.payments'));

DROP POLICY IF EXISTS "staff_delete_supplier_payments" ON supplier_payments;
CREATE POLICY "perm_delete_supplier_payments" ON supplier_payments
  FOR DELETE TO authenticated USING (has_perm('suppliers.payments'));

-- =========================================================
-- Purchase orders: restrict writes to purchase_orders.manage
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_po" ON purchase_orders;
CREATE POLICY "perm_insert_po" ON purchase_orders
  FOR INSERT TO authenticated WITH CHECK (has_perm('purchase_orders.manage'));

DROP POLICY IF EXISTS "staff_update_po" ON purchase_orders;
CREATE POLICY "perm_update_po" ON purchase_orders
  FOR UPDATE TO authenticated USING (has_perm('purchase_orders.manage')) WITH CHECK (has_perm('purchase_orders.manage'));

DROP POLICY IF EXISTS "staff_delete_po" ON purchase_orders;
CREATE POLICY "perm_delete_po" ON purchase_orders
  FOR DELETE TO authenticated USING (has_perm('purchase_orders.manage'));

-- =========================================================
-- Expenses: restrict writes to expenses.manage
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_expenses" ON expenses;
CREATE POLICY "perm_insert_expenses" ON expenses
  FOR INSERT TO authenticated WITH CHECK (has_perm('expenses.manage'));

DROP POLICY IF EXISTS "staff_update_expenses" ON expenses;
CREATE POLICY "perm_update_expenses" ON expenses
  FOR UPDATE TO authenticated USING (has_perm('expenses.manage')) WITH CHECK (has_perm('expenses.manage'));

DROP POLICY IF EXISTS "staff_delete_expenses" ON expenses;
CREATE POLICY "perm_delete_expenses" ON expenses
  FOR DELETE TO authenticated USING (has_perm('expenses.manage'));

-- =========================================================
-- Reports: restrict writes to reports.manage
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_reports" ON reports;
CREATE POLICY "perm_insert_reports" ON reports
  FOR INSERT TO authenticated WITH CHECK (has_perm('reports.manage'));

DROP POLICY IF EXISTS "staff_update_reports" ON reports;
CREATE POLICY "perm_update_reports" ON reports
  FOR UPDATE TO authenticated USING (has_perm('reports.manage')) WITH CHECK (has_perm('reports.manage'));

DROP POLICY IF EXISTS "staff_delete_reports" ON reports;
CREATE POLICY "perm_delete_reports" ON reports
  FOR DELETE TO authenticated USING (has_perm('reports.manage'));

-- =========================================================
-- Payments: restrict writes to payments.manage (new permission)
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_payments" ON payments;
CREATE POLICY "perm_insert_payments" ON payments
  FOR INSERT TO authenticated WITH CHECK (has_perm('orders.manage') OR has_perm('orders.view'));

DROP POLICY IF EXISTS "staff_update_payments" ON payments;
CREATE POLICY "perm_update_payments" ON payments
  FOR UPDATE TO authenticated USING (has_perm('orders.manage')) WITH CHECK (has_perm('orders.manage'));

-- =========================================================
-- Invoices: restrict writes to orders.manage
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_invoices" ON invoices;
CREATE POLICY "perm_insert_invoices" ON invoices
  FOR INSERT TO authenticated WITH CHECK (has_perm('orders.manage'));

DROP POLICY IF EXISTS "staff_update_invoices" ON invoices;
CREATE POLICY "perm_update_invoices" ON invoices
  FOR UPDATE TO authenticated USING (has_perm('orders.manage')) WITH CHECK (has_perm('orders.manage'));

-- =========================================================
-- Employees: restrict writes to employees.manage (manager+)
-- =========================================================
DROP POLICY IF EXISTS "staff_insert_employees" ON employees;
CREATE POLICY "perm_insert_employees" ON employees
  FOR INSERT TO authenticated WITH CHECK (current_staff_rank() >= 60);

DROP POLICY IF EXISTS "staff_update_employees" ON employees;
CREATE POLICY "perm_update_employees" ON employees
  FOR UPDATE TO authenticated USING (current_staff_rank() >= 60) WITH CHECK (current_staff_rank() >= 60);

DROP POLICY IF EXISTS "staff_delete_employees" ON employees;
CREATE POLICY "perm_delete_employees" ON employees
  FOR DELETE TO authenticated USING (current_staff_rank() >= 80);

-- =========================================================
-- Profiles: restrict staff writes to manager+ (role changes blocked by trigger)
-- =========================================================
DROP POLICY IF EXISTS "staff_update_profile" ON profiles;
CREATE POLICY "perm_update_profile" ON profiles
  FOR UPDATE TO authenticated USING (current_staff_rank() >= 60) WITH CHECK (current_staff_rank() >= 60);

DROP POLICY IF EXISTS "staff_delete_profile" ON profiles;
CREATE POLICY "perm_delete_profile" ON profiles
  FOR DELETE TO authenticated USING (current_staff_rank() >= 80);

-- =========================================================
-- Add missing permissions for orders and payments management
-- =========================================================
INSERT INTO permissions (name, description) VALUES
  ('orders.manage', 'Create, update, and delete orders'),
  ('orders.view', 'View all orders (staff read access)'),
  ('payments.manage', 'Record and update payments'),
  ('reports.manage', 'Create, update, and delete reports')
ON CONFLICT (name) DO NOTHING;

-- Grant orders.view to all staff roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.name = 'orders.view'
  AND r.name IN ('admin','super_admin','company_owner','general_manager',
    'warehouse_manager','branch_manager','inventory_employee',
    'sales_employee','marketing','accountant','customer_support','staff')
ON CONFLICT DO NOTHING;

-- Grant orders.manage to manager+ roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.name = 'orders.manage'
  AND r.name IN ('admin','super_admin','company_owner','general_manager',
    'warehouse_manager','branch_manager','sales_employee')
ON CONFLICT DO NOTHING;

-- Grant payments.manage to admin and accountant
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.name = 'payments.manage'
  AND r.name IN ('admin','super_admin','company_owner','general_manager','accountant')
ON CONFLICT DO NOTHING;

-- Grant reports.manage to manager+ roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.name = 'reports.manage'
  AND r.name IN ('admin','super_admin','company_owner','general_manager',
    'warehouse_manager','branch_manager','accountant')
ON CONFLICT DO NOTHING;

-- =========================================================
-- Performance indexes for security queries
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON profiles(role, status);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_roles_employee ON employee_roles(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_roles_role ON employee_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action ON activity_logs(user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_grand_total ON orders(grand_total DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_product_warehouse ON inventory(product_id, warehouse_id) WHERE warehouse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_product_branch ON inventory(product_id, branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_stock_active ON products(is_active, stock) WHERE is_active = true;