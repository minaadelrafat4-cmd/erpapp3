/*
# Business Intelligence — analytics views & export helpers
*/
-- 1. Daily sales aggregates
CREATE OR REPLACE VIEW v_bi_sales_daily AS
SELECT
  date_trunc('day', o.placed_at)::date AS sale_date,
  count(*) AS order_count,
  coalesce(sum(o.subtotal), 0) AS total_revenue,
  coalesce(sum(o.discount_total), 0) AS total_discount,
  coalesce(sum(o.tax_total), 0) AS total_tax,
  coalesce(sum(o.shipping_total), 0) AS total_shipping,
  coalesce(sum(o.grand_total), 0) AS total_grand,
  coalesce(avg(o.grand_total), 0) AS avg_order_value,
  coalesce(sum(oi.qty), 0) AS items_sold
FROM orders o
LEFT JOIN LATERAL (
  SELECT sum(quantity) AS qty FROM order_items WHERE order_id = o.id
) oi ON true
WHERE o.status NOT IN ('cancelled')
GROUP BY 1
ORDER BY 1 DESC;

-- 2. Product sales (best/worst sellers)
CREATE OR REPLACE VIEW v_bi_product_sales AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.sku,
  p.price,
  coalesce(p.cost, 0) AS cost,
  p.stock AS current_stock,
  c.name AS category_name,
  coalesce(sum(oi.quantity), 0) AS total_qty_sold,
  coalesce(sum(oi.line_total), 0) AS total_revenue,
  coalesce(sum(oi.line_total) - sum(oi.quantity * coalesce(p.cost, 0)), 0) AS total_profit,
  count(DISTINCT o.id) AS order_count
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled')
LEFT JOIN categories c ON c.id = p.category_id
GROUP BY p.id, p.name, p.sku, p.price, p.cost, p.stock, c.name;

-- 3. Category sales
CREATE OR REPLACE VIEW v_bi_category_sales AS
SELECT
  c.id AS category_id,
  c.name AS category_name,
  coalesce(sum(oi.quantity), 0) AS total_qty_sold,
  coalesce(sum(oi.line_total), 0) AS total_revenue,
  count(DISTINCT o.id) AS order_count
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled')
GROUP BY c.id, c.name;

-- 4. Branch sales
CREATE OR REPLACE VIEW v_bi_branch_sales AS
SELECT
  b.id AS branch_id,
  b.name AS branch_name,
  b.code AS branch_code,
  b.city,
  b.is_active,
  coalesce(sum(o.grand_total), 0) AS total_revenue,
  count(o.id) AS order_count,
  coalesce(avg(o.grand_total), 0) AS avg_order_value
FROM branches b
LEFT JOIN orders o ON o.branch_id = b.id AND o.status NOT IN ('cancelled')
GROUP BY b.id, b.name, b.code, b.city, b.is_active;

-- 5. Employee performance (via POS operator)
CREATE OR REPLACE VIEW v_bi_employee_performance AS
SELECT
  e.id AS employee_id,
  e.first_name || ' ' || e.last_name AS employee_name,
  e.email,
  e.position,
  b.name AS branch_name,
  coalesce(sum(o.grand_total), 0) AS total_sales,
  count(o.id) AS order_count,
  coalesce(avg(o.grand_total), 0) AS avg_sale_value,
  max(o.placed_at) AS last_sale_at
FROM employees e
LEFT JOIN orders o ON o.pos_operator_id = e.id AND o.status NOT IN ('cancelled')
LEFT JOIN branches b ON b.id = e.branch_id
GROUP BY e.id, e.first_name, e.last_name, e.email, e.position, b.name;

-- 6. Inventory valuation
CREATE OR REPLACE VIEW v_bi_inventory_value AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.sku,
  p.stock,
  coalesce(p.cost, 0) AS unit_cost,
  p.price AS unit_price,
  p.stock * coalesce(p.cost, 0) AS total_cost_value,
  p.stock * p.price AS total_retail_value,
  (p.price - coalesce(p.cost, 0)) * p.stock AS potential_profit
FROM products p
WHERE p.is_active = true;

-- 7. Low stock report
CREATE OR REPLACE VIEW v_bi_low_stock AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.sku,
  p.stock,
  p.reorder_level,
  p.low_stock_threshold,
  c.name AS category_name,
  CASE WHEN p.stock = 0 THEN 'out_of_stock'
       WHEN p.stock <= p.low_stock_threshold THEN 'critical'
       ELSE 'low' END AS severity
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.stock <= p.reorder_level AND p.is_active = true
ORDER BY p.stock ASC;

-- 8. Supplier summary
CREATE OR REPLACE VIEW v_bi_supplier_summary AS
SELECT
  s.id AS supplier_id,
  s.name AS supplier_name,
  s.contact_name,
  s.country,
  coalesce(sum(po.grand_total), 0) AS total_ordered,
  coalesce(sum(sp.amount) FILTER (WHERE sp.status = 'completed'), 0) AS total_paid,
  coalesce(sum(po.grand_total), 0) - coalesce(sum(sp.amount) FILTER (WHERE sp.status = 'completed'), 0) AS outstanding_balance,
  count(DISTINCT po.id) AS po_count
FROM suppliers s
LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.status NOT IN ('cancelled', 'draft')
LEFT JOIN supplier_payments sp ON sp.supplier_id = s.id
GROUP BY s.id, s.name, s.contact_name, s.country;

-- 9. Purchase order summary
CREATE OR REPLACE VIEW v_bi_purchase_summary AS
SELECT
  po.status,
  count(*) AS po_count,
  coalesce(sum(po.subtotal), 0) AS total_subtotal,
  coalesce(sum(po.grand_total), 0) AS total_grand,
  coalesce(avg(po.grand_total), 0) AS avg_po_value
FROM purchase_orders po
GROUP BY po.status;

-- 10. Expense summary
CREATE OR REPLACE VIEW v_bi_expense_summary AS
SELECT
  category,
  status,
  count(*) AS expense_count,
  coalesce(sum(amount), 0) AS total_amount,
  coalesce(avg(amount), 0) AS avg_amount
FROM expenses
GROUP BY category, status;

-- 11. Top customers
CREATE OR REPLACE VIEW v_bi_top_customers AS
SELECT
  c.id AS customer_id,
  c.first_name || ' ' || coalesce(c.last_name, '') AS customer_name,
  pr.email,
  c.loyalty_points,
  coalesce(sum(o.grand_total), 0) AS total_spent,
  count(o.id) AS order_count,
  coalesce(avg(o.grand_total), 0) AS avg_order_value,
  max(o.placed_at) AS last_order_at
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status NOT IN ('cancelled')
LEFT JOIN profiles pr ON pr.id = c.user_id
GROUP BY c.id, c.first_name, c.last_name, pr.email, c.loyalty_points
ORDER BY total_spent DESC;

-- 12. Profit analysis
CREATE OR REPLACE VIEW v_bi_profit_analysis AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.sku,
  p.price,
  coalesce(p.cost, 0) AS cost,
  p.price - coalesce(p.cost, 0) AS unit_profit,
  CASE WHEN p.price > 0 THEN ((p.price - coalesce(p.cost, 0)) / p.price) * 100 ELSE 0 END AS profit_margin_pct,
  coalesce(sum(oi.quantity), 0) AS qty_sold,
  coalesce(sum(oi.line_total), 0) AS revenue,
  coalesce(sum(oi.quantity * coalesce(p.cost, 0)), 0) AS cogs,
  coalesce(sum(oi.line_total) - sum(oi.quantity * coalesce(p.cost, 0)), 0) AS gross_profit
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled')
GROUP BY p.id, p.name, p.sku, p.price, p.cost;

-- FUNCTIONS for custom date range queries
CREATE OR REPLACE FUNCTION get_revenue_analytics(p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL)
RETURNS TABLE (
  sale_date date,
  order_count bigint,
  total_revenue numeric,
  total_discount numeric,
  total_tax numeric,
  total_shipping numeric,
  total_grand numeric,
  avg_order_value numeric,
  items_sold bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    date_trunc('day', o.placed_at)::date AS sale_date,
    count(*) AS order_count,
    coalesce(sum(o.subtotal), 0) AS total_revenue,
    coalesce(sum(o.discount_total), 0) AS total_discount,
    coalesce(sum(o.tax_total), 0) AS total_tax,
    coalesce(sum(o.shipping_total), 0) AS total_shipping,
    coalesce(sum(o.grand_total), 0) AS total_grand,
    coalesce(avg(o.grand_total), 0) AS avg_order_value,
    coalesce(sum(oi.qty), 0) AS items_sold
  FROM orders o
  LEFT JOIN LATERAL (SELECT sum(quantity) AS qty FROM order_items WHERE order_id = o.id) oi ON true
  WHERE o.status NOT IN ('cancelled')
    AND (p_start_date IS NULL OR o.placed_at >= p_start_date)
    AND (p_end_date IS NULL OR o.placed_at < p_end_date + interval '1 day')
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION get_product_sales_report(p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  sku text,
  category_name text,
  total_qty_sold bigint,
  total_revenue numeric,
  total_profit numeric,
  order_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.sku,
    c.name AS category_name,
    coalesce(sum(oi.quantity), 0) AS total_qty_sold,
    coalesce(sum(oi.line_total), 0) AS total_revenue,
    coalesce(sum(oi.line_total) - sum(oi.quantity * coalesce(p.cost, 0)), 0) AS total_profit,
    count(DISTINCT o.id) AS order_count
  FROM products p
  LEFT JOIN order_items oi ON oi.product_id = p.id
  LEFT JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled')
    AND (p_start_date IS NULL OR o.placed_at >= p_start_date)
    AND (p_end_date IS NULL OR o.placed_at < p_end_date + interval '1 day')
  LEFT JOIN categories c ON c.id = p.category_id
  GROUP BY p.id, p.name, p.sku, c.name
  ORDER BY total_revenue DESC;
$$;
