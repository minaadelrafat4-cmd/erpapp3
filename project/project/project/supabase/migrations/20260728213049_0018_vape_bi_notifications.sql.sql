/*
# Vape Industry Features + Dashboard BI + Notification System
Adds vape product columns, dashboard BI views, notification system tables, and performance indexes.
*/
-- 1. VAPE COLUMNS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='flavor') THEN ALTER TABLE products ADD COLUMN flavor text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='vg_pg_ratio') THEN ALTER TABLE products ADD COLUMN vg_pg_ratio text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='puff_count') THEN ALTER TABLE products ADD COLUMN puff_count integer; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='battery_capacity_mah') THEN ALTER TABLE products ADD COLUMN battery_capacity_mah integer; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='tank_size_ml') THEN ALTER TABLE products ADD COLUMN tank_size_ml numeric(8,2); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='resistance_ohm') THEN ALTER TABLE products ADD COLUMN resistance_ohm numeric(6,2); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='coil_compatibility') THEN ALTER TABLE products ADD COLUMN coil_compatibility text[] DEFAULT '{}'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='pod_compatibility') THEN ALTER TABLE products ADD COLUMN pod_compatibility text[] DEFAULT '{}'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='product_type') THEN ALTER TABLE products ADD COLUMN product_type text DEFAULT 'device' CHECK (product_type IN ('disposable','refillable','device','e-liquid','pod','accessory','coil','battery','charger')); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_age_restricted') THEN ALTER TABLE products ADD COLUMN is_age_restricted boolean NOT NULL DEFAULT true; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='nicotine_strength_mg') THEN ALTER TABLE products ADD COLUMN nicotine_strength_mg numeric(6,2); END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_age_restricted ON products(is_age_restricted) WHERE is_age_restricted = true;
CREATE INDEX IF NOT EXISTS idx_products_flavor ON products(flavor) WHERE flavor IS NOT NULL;

-- 2. DASHBOARD BI VIEWS
CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
  (SELECT COALESCE(SUM(grand_total), 0) FROM orders WHERE placed_at::date = now()::date AND status != 'cancelled') AS today_revenue,
  (SELECT COALESCE(SUM(grand_total), 0) FROM orders WHERE placed_at >= date_trunc('month', now()) AND status != 'cancelled') AS month_revenue,
  (SELECT COALESCE(SUM(grand_total), 0) FROM orders WHERE placed_at >= date_trunc('year', now()) AND status != 'cancelled') AS year_revenue,
  (SELECT COALESCE(SUM(grand_total - COALESCE((SELECT SUM(oi.quantity * p.cost) FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = orders.id), 0)), 0) FROM orders WHERE placed_at >= date_trunc('month', now()) AND status != 'cancelled') AS month_profit,
  (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE created_at >= date_trunc('month', now()) AND status = 'approved') AS month_expenses,
  (SELECT COALESCE(SUM(stock * cost), 0) FROM products WHERE is_active = true) AS inventory_cost_value,
  (SELECT COALESCE(SUM(stock * price), 0) FROM products WHERE is_active = true) AS inventory_retail_value,
  (SELECT count(*) FROM orders WHERE status IN ('pending', 'processing')) AS pending_orders,
  (SELECT count(*) FROM stock_transfers WHERE status = 'in_transit') AS pending_transfers,
  (SELECT count(*) FROM purchase_orders WHERE status IN ('pending', 'sent', 'partial')) AS pending_purchase_orders,
  (SELECT count(*) FROM products WHERE stock <= low_stock_threshold AND is_active = true) AS low_stock_count,
  (SELECT count(*) FROM orders WHERE placed_at::date = now()::date AND status != 'cancelled') AS today_order_count;

CREATE OR REPLACE VIEW v_dashboard_top_products AS
SELECT p.id AS product_id, p.name AS product_name, p.sku, COALESCE(SUM(oi.quantity), 0) AS qty_sold, COALESCE(SUM(oi.line_total), 0) AS revenue, p.stock, p.price, c.name AS category_name
FROM products p LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id AND o.placed_at >= now() - interval '30 days' AND o.status != 'cancelled'
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.is_active = true GROUP BY p.id, p.name, p.sku, p.stock, p.price, c.name ORDER BY revenue DESC LIMIT 10;

CREATE OR REPLACE VIEW v_dashboard_worst_products AS
SELECT p.id AS product_id, p.name AS product_name, p.sku, COALESCE(SUM(oi.quantity), 0) AS qty_sold, COALESCE(SUM(oi.line_total), 0) AS revenue, p.stock, c.name AS category_name
FROM products p LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id AND o.placed_at >= now() - interval '30 days' AND o.status != 'cancelled'
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.is_active = true GROUP BY p.id, p.name, p.sku, p.stock, c.name ORDER BY revenue ASC LIMIT 10;

CREATE OR REPLACE VIEW v_dashboard_top_customers AS
SELECT c.id AS customer_id, COALESCE(c.first_name || ' ' || c.last_name, 'Unknown') AS customer_name, u.email,
  COALESCE(SUM(o.grand_total), 0) AS lifetime_value, COUNT(o.id) AS order_count,
  COALESCE(AVG(o.grand_total), 0) AS avg_order_value, MAX(o.placed_at) AS last_order_date
FROM customers c LEFT JOIN auth.users u ON u.id = c.user_id
LEFT JOIN orders o ON o.user_id = c.user_id AND o.status != 'cancelled'
GROUP BY c.id, c.first_name, c.last_name, u.email ORDER BY lifetime_value DESC LIMIT 10;

CREATE OR REPLACE VIEW v_dashboard_branch_comparison AS
SELECT b.id AS branch_id, b.name AS branch_name, b.code AS branch_code, b.city, b.is_active,
  COALESCE(SUM(o.grand_total), 0) AS total_revenue, COUNT(o.id) AS order_count, COALESCE(AVG(o.grand_total), 0) AS avg_order_value
FROM branches b LEFT JOIN orders o ON o.branch_id = b.id AND o.status != 'cancelled'
GROUP BY b.id, b.name, b.code, b.city, b.is_active ORDER BY total_revenue DESC;

CREATE OR REPLACE VIEW v_dashboard_warehouse_comparison AS
SELECT w.id AS warehouse_id, w.name AS warehouse_name, w.code AS warehouse_code, w.city, w.is_active, w.capacity,
  COALESCE(SUM(i.quantity_on_hand), 0) AS total_units,
  COALESCE(SUM(i.quantity_on_hand * COALESCE(p.cost, 0)), 0) AS stock_cost_value,
  COALESCE(SUM(i.quantity_on_hand * COALESCE(p.price, 0)), 0) AS stock_retail_value,
  COUNT(DISTINCT i.product_id) AS product_count,
  CASE WHEN w.capacity > 0 THEN LEAST(100, ROUND(COALESCE(SUM(i.quantity_on_hand), 0)::numeric / w.capacity * 100, 1)) ELSE 0 END AS utilization_pct
FROM warehouses w LEFT JOIN inventory i ON i.warehouse_id = w.id LEFT JOIN products p ON p.id = i.product_id
GROUP BY w.id, w.name, w.code, w.city, w.is_active, w.capacity ORDER BY stock_cost_value DESC;

CREATE OR REPLACE VIEW v_dashboard_employee_performance AS
SELECT e.id AS employee_id, e.first_name || ' ' || e.last_name AS employee_name, e.email, e.position, b.name AS branch_name,
  COALESCE(SUM(o.grand_total), 0) AS total_sales, COUNT(o.id) AS order_count, COALESCE(AVG(o.grand_total), 0) AS avg_sale_value
FROM employees e LEFT JOIN branches b ON b.id = e.branch_id
LEFT JOIN orders o ON o.pos_operator_id = e.id AND o.status != 'cancelled'
GROUP BY e.id, e.first_name, e.last_name, e.email, e.position, b.name ORDER BY total_sales DESC;

CREATE OR REPLACE VIEW v_dashboard_revenue_chart AS
SELECT d::date AS sale_date, COALESCE(SUM(o.grand_total), 0) AS revenue, COUNT(o.id) AS order_count
FROM generate_series(now()::date - interval '29 days', now()::date, interval '1 day') d
LEFT JOIN orders o ON o.placed_at::date = d AND o.status != 'cancelled'
GROUP BY d ORDER BY d;

CREATE OR REPLACE VIEW v_bi_inventory_aging AS
SELECT p.id AS product_id, p.name AS product_name, p.sku, p.stock, p.is_active,
  COALESCE(p.cost, 0) AS unit_cost, p.stock * COALESCE(p.cost, 0) AS stock_value,
  COALESCE(s.qty_30d, 0) AS total_sold_30d,
  CASE WHEN COALESCE(s.qty_30d, 0) >= 10 THEN 'fast' WHEN COALESCE(s.qty_30d, 0) >= 1 THEN 'medium'
       WHEN COALESCE(s.qty_30d, 0) = 0 AND p.stock > 0 THEN 'slow' ELSE 'dead' END AS movement_category,
  CASE WHEN COALESCE(s.qty_30d, 0) > 0 THEN GREATEST(1, p.stock / NULLIF(s.qty_30d, 0))::integer * 30 ELSE 999 END AS days_of_supply,
  c.name AS category_name
FROM products p LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN (SELECT oi.product_id, SUM(oi.quantity) AS qty_30d FROM order_items oi JOIN orders o ON o.id = oi.order_id AND o.placed_at >= now() - interval '30 days' AND o.status != 'cancelled' GROUP BY oi.product_id) s ON s.product_id = p.id
WHERE p.is_active = true;

CREATE OR REPLACE VIEW v_bi_warehouse_performance AS
SELECT w.id AS warehouse_id, w.name AS warehouse_name, w.code, w.city, w.is_active, w.capacity,
  COALESCE(SUM(i.quantity_on_hand), 0) AS total_units,
  COALESCE(SUM(i.quantity_on_hand * COALESCE(p.cost, 0)), 0) AS stock_value,
  COUNT(DISTINCT i.product_id) AS sku_count,
  COALESCE(SUM(CASE WHEN p.stock <= p.low_stock_threshold THEN 1 ELSE 0 END), 0) AS low_stock_items,
  CASE WHEN w.capacity > 0 THEN LEAST(100, ROUND(COALESCE(SUM(i.quantity_on_hand), 0)::numeric / w.capacity * 100, 1)) ELSE 0 END AS utilization_pct
FROM warehouses w LEFT JOIN inventory i ON i.warehouse_id = w.id LEFT JOIN products p ON p.id = i.product_id
GROUP BY w.id, w.name, w.code, w.city, w.is_active, w.capacity ORDER BY stock_value DESC;

CREATE OR REPLACE VIEW v_bi_customer_ltv AS
SELECT c.id AS customer_id, COALESCE(c.first_name || ' ' || c.last_name, 'Unknown') AS customer_name, u.email,
  COALESCE(SUM(o.grand_total), 0) AS lifetime_value, COUNT(o.id) AS order_count,
  COALESCE(AVG(o.grand_total), 0) AS avg_order_value, MIN(o.placed_at) AS first_order_date, MAX(o.placed_at) AS last_order_date
FROM customers c LEFT JOIN auth.users u ON u.id = c.user_id
LEFT JOIN orders o ON o.user_id = c.user_id AND o.status != 'cancelled'
GROUP BY c.id, c.first_name, c.last_name, u.email ORDER BY lifetime_value DESC;

CREATE OR REPLACE VIEW v_bi_top_employees AS
SELECT e.id AS employee_id, e.first_name || ' ' || e.last_name AS employee_name, e.email, e.position, b.name AS branch_name,
  COALESCE(SUM(o.grand_total), 0) AS total_sales, COUNT(o.id) AS order_count, COALESCE(AVG(o.grand_total), 0) AS avg_sale_value
FROM employees e LEFT JOIN branches b ON b.id = e.branch_id
LEFT JOIN orders o ON o.pos_operator_id = e.id AND o.status != 'cancelled'
GROUP BY e.id, e.first_name, e.last_name, e.email, e.position, b.name ORDER BY total_sales DESC;

CREATE OR REPLACE VIEW v_bi_slow_moving AS
SELECT p.id AS product_id, p.name AS product_name, p.sku, p.stock, COALESCE(p.cost, 0) * p.stock AS tied_up_capital, c.name AS category_name, COALESCE(s.qty_30d, 0) AS qty_sold_30d
FROM products p LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN (SELECT oi.product_id, SUM(oi.quantity) AS qty_30d FROM order_items oi JOIN orders o ON o.id = oi.order_id AND o.placed_at >= now() - interval '30 days' AND o.status != 'cancelled' GROUP BY oi.product_id) s ON s.product_id = p.id
WHERE p.is_active = true AND p.stock > 0 AND COALESCE(s.qty_30d, 0) BETWEEN 1 AND 9 ORDER BY tied_up_capital DESC;

CREATE OR REPLACE VIEW v_bi_dead_stock AS
SELECT p.id AS product_id, p.name AS product_name, p.sku, p.stock, COALESCE(p.cost, 0) * p.stock AS tied_up_capital, c.name AS category_name, p.created_at::date AS first_stocked
FROM products p LEFT JOIN categories c ON c.id = p.category_id
WHERE p.is_active = true AND p.stock > 0 AND p.id NOT IN (
  SELECT DISTINCT oi.product_id FROM order_items oi JOIN orders o ON o.id = oi.order_id AND o.placed_at >= now() - interval '90 days'
) ORDER BY tied_up_capital DESC;

-- 3. NOTIFICATION SYSTEM
CREATE TABLE IF NOT EXISTS notification_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE NOT NULL, description text,
  category text NOT NULL DEFAULT 'system' CHECK (category IN ('system','inventory','orders','payments','security','suppliers','transfers')),
  is_enabled_by_default boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notification_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_select_notif_types" ON notification_types FOR SELECT TO authenticated USING (is_staff());

CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL, is_enabled boolean NOT NULL DEFAULT true, email_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_type)
);
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_notif_settings" ON notification_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_notif_settings" ON notification_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_notif_settings" ON notification_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_notif_settings" ON notification_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

INSERT INTO notification_types (name, description, category) VALUES
  ('low_stock', 'Product stock is below the reorder threshold', 'inventory'),
  ('out_of_stock', 'Product is completely out of stock', 'inventory'),
  ('new_order', 'A new order has been placed', 'orders'),
  ('order_status_change', 'An order status has changed', 'orders'),
  ('purchase_request', 'A purchase order needs approval', 'suppliers'),
  ('transfer_request', 'A stock transfer needs attention', 'transfers'),
  ('supplier_delivery', 'A supplier delivery has been received', 'suppliers'),
  ('inventory_mismatch', 'Cycle count variance detected', 'inventory'),
  ('failed_payment', 'A payment has failed', 'payments'),
  ('security_alert', 'Security event detected', 'security'),
  ('employee_activity', 'New employee account activity', 'system'),
  ('dashboard_summary', 'Daily dashboard summary', 'system')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION generate_dashboard_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_summary record; v_staff_id uuid;
BEGIN
  SELECT * INTO v_summary FROM v_dashboard_summary;
  FOR v_staff_id IN SELECT id FROM profiles WHERE status = 'active' AND role IN (
    'admin','super_admin','company_owner','general_manager',
    'warehouse_manager','branch_manager','inventory_employee',
    'sales_employee','marketing','accountant','customer_support','staff','manager'
  ) LOOP
    IF v_summary.low_stock_count > 0 THEN
      INSERT INTO notifications (user_id, type, title, message, is_read)
      SELECT v_staff_id, 'warning', 'Low Stock Alert', v_summary.low_stock_count || ' products are below their reorder threshold', false
      WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_staff_id AND title = 'Low Stock Alert' AND created_at > now() - interval '24 hours');
    END IF;
    IF v_summary.pending_orders > 0 THEN
      INSERT INTO notifications (user_id, type, title, message, is_read)
      SELECT v_staff_id, 'info', 'Pending Orders', v_summary.pending_orders || ' orders need attention', false
      WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_staff_id AND title = 'Pending Orders' AND created_at > now() - interval '24 hours');
    END IF;
    IF v_summary.pending_transfers > 0 THEN
      INSERT INTO notifications (user_id, type, title, message, is_read)
      SELECT v_staff_id, 'info', 'Pending Transfers', v_summary.pending_transfers || ' stock transfers are in transit', false
      WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_staff_id AND title = 'Pending Transfers' AND created_at > now() - interval '24 hours');
    END IF;
    IF v_summary.pending_purchase_orders > 0 THEN
      INSERT INTO notifications (user_id, type, title, message, is_read)
      SELECT v_staff_id, 'info', 'Pending Purchase Orders', v_summary.pending_purchase_orders || ' purchase orders need processing', false
      WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_staff_id AND title = 'Pending Purchase Orders' AND created_at > now() - interval '24 hours');
    END IF;
  END LOOP;
END;
$$;

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_order_items_product_join ON order_items(product_id, order_id);
CREATE INDEX IF NOT EXISTS idx_products_cost_active ON products(cost) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_product ON inventory(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = false;