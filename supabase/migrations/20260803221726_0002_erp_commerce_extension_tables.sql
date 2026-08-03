-- PROFILES (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL, full_name text, avatar_url text, phone text,
  role text NOT NULL DEFAULT 'customer', status text NOT NULL DEFAULT 'active',
  failed_login_attempts integer NOT NULL DEFAULT 0, locked_until timestamptz, last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- WAREHOUSES
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, code text NOT NULL UNIQUE,
  address text NOT NULL, city text NOT NULL, state text, postal_code text,
  country text NOT NULL DEFAULT 'United States', phone text, email text, manager text,
  capacity integer, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_warehouses_active ON warehouses(is_active);

-- INVENTORY TRANSACTIONS (immutable ledger)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  transaction_type text NOT NULL, quantity integer NOT NULL, balance_after integer NOT NULL,
  reference_type text, reference_id uuid, notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_inv_tx_type CHECK (transaction_type IN ('purchase','sale','transfer_in','transfer_out','adjustment','return','reservation','release'))
);
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_inv_tx_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inv_tx_created ON inventory_transactions(created_at);

-- STOCK ADJUSTMENTS
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  adjustment_type text NOT NULL DEFAULT 'increment', quantity integer NOT NULL,
  reason text NOT NULL DEFAULT 'correction', notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_adj_type CHECK (adjustment_type IN ('increment','decrement')),
  CONSTRAINT chk_adj_reason CHECK (reason IN ('correction','damage','loss','theft','found','recount','other'))
);
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_stock_adj_product ON stock_adjustments(product_id);

-- STOCK TRANSFERS
CREATE TABLE IF NOT EXISTS stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transfer_number text NOT NULL UNIQUE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE, quantity integer NOT NULL CHECK (quantity > 0),
  from_warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  from_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  to_warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  to_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending', shipped_at timestamptz, received_at timestamptz, notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_transfer_status CHECK (status IN ('pending','in_transit','received','cancelled'))
);
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_stock_transfers_product ON stock_transfers(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_number text NOT NULL UNIQUE, amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD', method text NOT NULL DEFAULT 'card',
  status text NOT NULL DEFAULT 'pending', gateway text, gateway_transaction_id text,
  gateway_response jsonb, processed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_pay_status CHECK (status IN ('pending','completed','failed','refunded','partially_refunded')),
  CONSTRAINT chk_pay_method CHECK (method IN ('card','paypal','apple_pay','google_pay','bank_transfer','cash','store_credit'))
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0, discount_total numeric(12,2) NOT NULL DEFAULT 0,
  tax_total numeric(12,2) NOT NULL DEFAULT 0, shipping_total numeric(12,2) NOT NULL DEFAULT 0,
  grand_total numeric(12,2) NOT NULL DEFAULT 0, amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  balance_due numeric(12,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft',
  issued_at timestamptz NOT NULL DEFAULT now(), due_at timestamptz, paid_at timestamptz,
  pdf_url text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_invoice_status CHECK (status IN ('draft','sent','paid','partially_paid','void','overdue'))
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), po_number text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric(12,2) NOT NULL DEFAULT 0, tax_total numeric(12,2) NOT NULL DEFAULT 0,
  shipping_total numeric(12,2) NOT NULL DEFAULT 0, grand_total numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD', expected_at timestamptz, received_at timestamptz, notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_po_status CHECK (status IN ('draft','sent','partial','received','cancelled'))
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0), unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0, received_quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items(product_id);

-- EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category text NOT NULL DEFAULT 'general',
  description text NOT NULL, amount numeric(12,2) NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'USD',
  expense_date date NOT NULL DEFAULT CURRENT_DATE, vendor text, receipt_url text,
  status text NOT NULL DEFAULT 'pending', approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_expense_status CHECK (status IN ('pending','approved','rejected','paid'))
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- REPORTS
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text,
  type text NOT NULL DEFAULT 'custom', parameters jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  is_scheduled boolean NOT NULL DEFAULT false, schedule_cron text, last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, entity_type text, entity_id uuid, metadata jsonb, ip_address text, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);

-- updated_at triggers for new tables
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'profiles','warehouses','stock_transfers','invoices','purchase_orders',
    'purchase_order_items','expenses','reports'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I; '
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t
    );
  END LOOP;
END $$;