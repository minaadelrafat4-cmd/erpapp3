/*
# ERP schema extension — branches, inventory, suppliers, roles

ADDITIVE changes only. Extends existing schema with full ERP data model.

## Changes
- branches: state, postal_code, country, opening_hours (jsonb), manager_id (FK employees)
- products: serial_number, batch_number, expiry_date, supplier_id, min/max stock, reorder_level
- inventory: warehouse_id, batch_number, expiry_date, max_stock; unique index on (product, branch, warehouse)
- roles: hierarchy_level, parent_role_id (self-ref)
- expenses: branch_id, warehouse_id
- New tables: supplier_contacts, supplier_payments, product_batches, stock_alerts
- Seed 11 hierarchy roles + extended permissions

## Security
- RLS on all new tables with is_staff() gate.
*/

-- BRANCH EXTENSIONS
ALTER TABLE branches ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'United States';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS opening_hours jsonb NOT NULL DEFAULT '{}';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES employees(id) ON DELETE SET NULL;

-- PRODUCT EXTENSIONS
ALTER TABLE products ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS batch_number text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date date;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_stock integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level integer NOT NULL DEFAULT 10;
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_batch ON products(batch_number);
CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date);

-- INVENTORY EXTENSIONS
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id) ON DELETE CASCADE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS batch_number text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expiry_date date;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS max_stock integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_product_id_branch_id_key' AND contype = 'u') THEN
    ALTER TABLE inventory DROP CONSTRAINT inventory_product_id_branch_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_product_branch_warehouse
  ON inventory (product_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batch ON inventory(batch_number);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory(expiry_date);

-- ROLE HIERARCHY EXTENSIONS
ALTER TABLE roles ADD COLUMN IF NOT EXISTS hierarchy_level integer NOT NULL DEFAULT 99;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS parent_role_id uuid REFERENCES roles(id) ON DELETE SET NULL;

-- EXPENSE EXTENSIONS
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);

-- SUPPLIER CONTACTS
CREATE TABLE IF NOT EXISTS supplier_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name text NOT NULL, email text, phone text, position text, is_primary boolean NOT NULL DEFAULT false,
  notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier ON supplier_contacts(supplier_id);

-- SUPPLIER PAYMENTS
CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_number text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'USD',
  method text NOT NULL DEFAULT 'bank_transfer', status text NOT NULL DEFAULT 'completed',
  paid_at timestamptz NOT NULL DEFAULT now(), reference text, notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_supplier_pay_method CHECK (method IN ('bank_transfer','check','cash','card','wire','other')),
  CONSTRAINT chk_supplier_pay_status CHECK (status IN ('pending','completed','cancelled','bounced'))
);
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_po ON supplier_payments(purchase_order_id);

-- PRODUCT BATCHES
CREATE TABLE IF NOT EXISTS product_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number text NOT NULL, serial_number text,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  quantity_received integer NOT NULL DEFAULT 0, quantity_remaining integer NOT NULL DEFAULT 0,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0, unit_price numeric(12,2) NOT NULL DEFAULT 0,
  expiry_date date, manufacture_date date, status text NOT NULL DEFAULT 'active',
  received_at timestamptz NOT NULL DEFAULT now(), notes text,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_batch_status CHECK (status IN ('active','expired','depleted','quarantined','recalled')),
  UNIQUE (product_id, batch_number)
);
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_product_batches_product ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_supplier ON product_batches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON product_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_product_batches_status ON product_batches(status);

-- STOCK ALERTS
CREATE TABLE IF NOT EXISTS stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  alert_type text NOT NULL, severity text NOT NULL DEFAULT 'warning', message text NOT NULL,
  quantity integer, threshold integer, is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz, resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_alert_type CHECK (alert_type IN ('low_stock','out_of_stock','overstock','expiring_soon','expired','reorder')),
  CONSTRAINT chk_alert_severity CHECK (severity IN ('info','warning','critical'))
);
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_resolved ON stock_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_type ON stock_alerts(alert_type);

-- RLS POLICIES for new tables (staff-only)
DROP POLICY IF EXISTS "staff_select_supplier_contacts" ON supplier_contacts;
CREATE POLICY "staff_select_supplier_contacts" ON supplier_contacts FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "staff_insert_supplier_contacts" ON supplier_contacts;
CREATE POLICY "staff_insert_supplier_contacts" ON supplier_contacts FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_supplier_contacts" ON supplier_contacts;
CREATE POLICY "staff_update_supplier_contacts" ON supplier_contacts FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_delete_supplier_contacts" ON supplier_contacts;
CREATE POLICY "staff_delete_supplier_contacts" ON supplier_contacts FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "staff_select_supplier_payments" ON supplier_payments;
CREATE POLICY "staff_select_supplier_payments" ON supplier_payments FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "staff_insert_supplier_payments" ON supplier_payments;
CREATE POLICY "staff_insert_supplier_payments" ON supplier_payments FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_supplier_payments" ON supplier_payments;
CREATE POLICY "staff_update_supplier_payments" ON supplier_payments FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_delete_supplier_payments" ON supplier_payments;
CREATE POLICY "staff_delete_supplier_payments" ON supplier_payments FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "staff_select_product_batches" ON product_batches;
CREATE POLICY "staff_select_product_batches" ON product_batches FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "staff_insert_product_batches" ON product_batches;
CREATE POLICY "staff_insert_product_batches" ON product_batches FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_product_batches" ON product_batches;
CREATE POLICY "staff_update_product_batches" ON product_batches FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_delete_product_batches" ON product_batches;
CREATE POLICY "staff_delete_product_batches" ON product_batches FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "staff_select_stock_alerts" ON stock_alerts;
CREATE POLICY "staff_select_stock_alerts" ON stock_alerts FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "staff_insert_stock_alerts" ON stock_alerts;
CREATE POLICY "staff_insert_stock_alerts" ON stock_alerts FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_stock_alerts" ON stock_alerts;
CREATE POLICY "staff_update_stock_alerts" ON stock_alerts FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_delete_stock_alerts" ON stock_alerts;
CREATE POLICY "staff_delete_stock_alerts" ON stock_alerts FOR DELETE TO authenticated USING (is_staff());

-- updated_at triggers for new tables
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['supplier_contacts','supplier_payments','product_batches','stock_alerts'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON %I; CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

-- SEED ROLE HIERARCHY (11 roles)
INSERT INTO roles (name, description, is_system, hierarchy_level) VALUES
  ('super_admin', 'Full system access — all modules', true, 0),
  ('company_owner', 'Business owner — full access except system config', true, 1),
  ('general_manager', 'Oversees all branches and warehouses', true, 2),
  ('warehouse_manager', 'Manages warehouses and inventory transfers', true, 3),
  ('branch_manager', 'Manages a single branch and its staff', true, 4),
  ('inventory_employee', 'Manages stock, adjustments, transfers', true, 5),
  ('sales_employee', 'Processes orders and customer interactions', true, 6),
  ('marketing', 'Manages blog, promotions, content', true, 7),
  ('accountant', 'Manages expenses, payments, invoices', true, 8),
  ('customer_support', 'Handles customer inquiries and tickets', true, 9),
  ('customer', 'Storefront customer — no admin access', true, 100)
ON CONFLICT (name) DO UPDATE SET hierarchy_level = EXCLUDED.hierarchy_level, description = EXCLUDED.description, is_system = true;

UPDATE roles SET parent_role_id = (SELECT id FROM roles WHERE name = 'super_admin') WHERE name = 'company_owner';
UPDATE roles SET parent_role_id = (SELECT id FROM roles WHERE name = 'company_owner') WHERE name = 'general_manager';
UPDATE roles SET parent_role_id = (SELECT id FROM roles WHERE name = 'general_manager') WHERE name = 'warehouse_manager';
UPDATE roles SET parent_role_id = (SELECT id FROM roles WHERE name = 'general_manager') WHERE name = 'branch_manager';
UPDATE roles SET parent_role_id = (SELECT id FROM roles WHERE name = 'warehouse_manager') WHERE name = 'inventory_employee';
UPDATE roles SET parent_role_id = (SELECT id FROM roles WHERE name = 'branch_manager') WHERE name = 'sales_employee';
UPDATE roles SET parent_role_id = (SELECT id FROM roles WHERE name = 'general_manager') WHERE name = 'marketing';
UPDATE roles SET parent_role_id = (SELECT id FROM roles WHERE name = 'general_manager') WHERE name = 'accountant';
UPDATE roles SET parent_role_id = (SELECT id FROM roles WHERE name = 'general_manager') WHERE name = 'customer_support';

-- SEED EXTENDED PERMISSIONS
INSERT INTO permissions (name, description, module) VALUES
  ('branches.manage', 'Manage branches and opening hours', 'operations'),
  ('warehouses.manage', 'Manage warehouses', 'operations'),
  ('inventory.adjust', 'Adjust stock levels', 'operations'),
  ('inventory.transfer', 'Transfer stock between locations', 'operations'),
  ('inventory.valuation', 'View inventory valuation', 'operations'),
  ('suppliers.manage', 'Manage suppliers and contacts', 'purchasing'),
  ('suppliers.payments', 'Record supplier payments', 'purchasing'),
  ('purchase_orders.manage', 'Manage purchase orders', 'purchasing'),
  ('purchase_orders.receive', 'Receive purchase orders', 'purchasing'),
  ('expenses.manage', 'Manage expenses', 'finance'),
  ('reports.financial', 'View financial reports', 'insights'),
  ('roles.manage', 'Manage roles and hierarchy', 'admin'),
  ('permissions.manage', 'Manage permissions', 'admin')
ON CONFLICT (name) DO NOTHING;
