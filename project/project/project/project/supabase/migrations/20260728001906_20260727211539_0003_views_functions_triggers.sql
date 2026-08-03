/*
# Views, Functions & Triggers — enterprise business logic

Security helper functions (is_staff, has_permission), read-model views, business functions
(place_order, adjust_stock, transfer_stock, generate_invoice, recalc_product_rating),
and triggers (auto-profile, audit, rating recalc).

## Security
- Helper functions are SECURITY DEFINER with fixed search_path to prevent injection.
- Idempotent: CREATE OR REPLACE for functions/views; DROP trigger IF EXISTS before create.
*/

-- SECURITY HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin','manager','staff') AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION has_permission(p_permission text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    JOIN employee_roles er ON er.employee_id = (SELECT e.id FROM employees e WHERE e.user_id = p.id LIMIT 1)
    JOIN role_permissions rp ON rp.role_id = er.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE p.id = auth.uid() AND perm.name = p_permission
  ) OR EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin');
$$;

-- VIEWS
CREATE OR REPLACE VIEW v_order_summary AS
SELECT o.id, o.order_number, o.status, o.payment_status, o.grand_total, o.currency, o.placed_at, o.created_at,
  c.first_name, c.last_name,
  (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
FROM orders o LEFT JOIN customers c ON c.id = o.customer_id;

CREATE OR REPLACE VIEW v_inventory_summary AS
SELECT i.id, i.quantity_on_hand, i.quantity_reserved, i.reorder_point,
  p.name AS product_name, p.sku, p.price, b.name AS branch_name, b.code AS branch_code
FROM inventory i JOIN products p ON p.id = i.product_id LEFT JOIN branches b ON b.id = i.branch_id;

CREATE OR REPLACE VIEW v_product_catalog AS
SELECT p.id, p.name, p.slug, p.price, p.compare_at_price, p.stock, p.is_active, p.is_featured,
  p.is_best_seller, p.is_new_arrival, p.is_flash_sale, p.rating, p.review_count, p.sku,
  c.name AS category_name, c.slug AS category_slug, br.name AS brand_name, br.slug AS brand_slug
FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN brands br ON br.id = p.brand_id;

CREATE OR REPLACE VIEW v_low_stock AS
SELECT p.id, p.name, p.sku, p.stock, p.low_stock_threshold, c.name AS category_name
FROM products p LEFT JOIN categories c ON c.id = p.category_id
WHERE p.stock <= p.low_stock_threshold AND p.is_active = true ORDER BY p.stock ASC;

CREATE OR REPLACE VIEW v_sales_analytics AS
SELECT date_trunc('day', o.placed_at) AS sale_date, count(*) AS order_count,
  coalesce(sum(o.subtotal), 0) AS total_revenue, coalesce(sum(o.discount_total), 0) AS total_discount,
  coalesce(sum(o.tax_total), 0) AS total_tax, coalesce(sum(o.shipping_total), 0) AS total_shipping,
  coalesce(sum(o.grand_total), 0) AS total_grand, coalesce(avg(o.grand_total), 0) AS avg_order_value
FROM orders o WHERE o.status NOT IN ('cancelled','refunded') GROUP BY 1 ORDER BY 1 DESC;

CREATE OR REPLACE VIEW v_customer_summary AS
SELECT c.id, c.user_id, c.first_name, c.last_name, pr.email, c.loyalty_points, c.created_at,
  coalesce(count(o.id), 0) AS order_count, coalesce(sum(o.grand_total), 0) AS total_spent, max(o.placed_at) AS last_order_at
FROM customers c LEFT JOIN profiles pr ON pr.id = c.user_id LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.user_id, c.first_name, c.last_name, pr.email, c.loyalty_points, c.created_at;

-- BUSINESS FUNCTIONS
CREATE OR REPLACE FUNCTION recalc_product_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE avg_rating numeric; cnt integer; v_product_id uuid;
BEGIN
  v_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;
  SELECT coalesce(avg(rating), 0), count(*) INTO avg_rating, cnt
  FROM product_reviews WHERE product_id = v_product_id AND is_approved = true;
  UPDATE products SET rating = round(avg_rating::numeric, 2), review_count = cnt WHERE id = v_product_id;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION place_order(
  p_user_id uuid, p_items jsonb, p_shipping_address jsonb,
  p_billing_address jsonb DEFAULT NULL, p_shipping_total numeric DEFAULT 0,
  p_tax_total numeric DEFAULT 0, p_discount_total numeric DEFAULT 0,
  p_coupon_code text DEFAULT NULL, p_currency text DEFAULT 'USD'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid; v_order_number text; v_subtotal numeric := 0; v_grand numeric;
  v_item jsonb; v_line_total numeric; v_product products%ROWTYPE; v_customer_id uuid;
BEGIN
  v_order_number := 'LX-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
  SELECT id INTO v_customer_id FROM customers WHERE user_id = p_user_id LIMIT 1;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found: %', v_item->>'product_id'; END IF;
    v_line_total := v_product.price * ((v_item->>'quantity')::integer);
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;
  v_grand := v_subtotal - p_discount_total + p_shipping_total + p_tax_total;
  INSERT INTO orders (order_number, customer_id, user_id, status, payment_status,
    subtotal, discount_total, shipping_total, tax_total, grand_total, currency, shipping_address, billing_address)
  VALUES (v_order_number, v_customer_id, p_user_id, 'pending', 'unpaid',
    v_subtotal, p_discount_total, p_shipping_total, p_tax_total, v_grand, p_currency, p_shipping_address, p_billing_address)
  RETURNING id INTO v_order_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid;
    v_line_total := v_product.price * ((v_item->>'quantity')::integer);
    INSERT INTO order_items (order_id, product_id, product_name, variant_name, sku, price, quantity, line_total)
    VALUES (v_order_id, v_product.id, v_product.name, v_item->>'variant_name', v_product.sku, v_product.price, (v_item->>'quantity')::integer, v_line_total);
    UPDATE products SET stock = stock - (v_item->>'quantity')::integer WHERE id = v_product.id;
    INSERT INTO inventory_transactions (product_id, transaction_type, quantity, balance_after, reference_type, reference_id)
    VALUES (v_product.id, 'sale', -((v_item->>'quantity')::integer), (SELECT stock FROM products WHERE id = v_product.id), 'order', v_order_id);
  END LOOP;
  IF p_coupon_code IS NOT NULL THEN
    UPDATE coupons SET used_count = used_count + 1 WHERE code = p_coupon_code;
  END IF;
  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'grand_total', v_grand);
END;
$$;

CREATE OR REPLACE FUNCTION adjust_stock(
  p_product_id uuid, p_branch_id uuid DEFAULT NULL, p_warehouse_id uuid DEFAULT NULL,
  p_adjustment_type text DEFAULT 'increment', p_quantity integer DEFAULT 0,
  p_reason text DEFAULT 'correction', p_notes text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_adj_id uuid; v_new_balance integer;
BEGIN
  IF p_adjustment_type = 'increment' THEN
    UPDATE products SET stock = stock + p_quantity WHERE id = p_product_id RETURNING stock INTO v_new_balance;
  ELSE
    UPDATE products SET stock = stock - p_quantity WHERE id = p_product_id RETURNING stock INTO v_new_balance;
  END IF;
  INSERT INTO stock_adjustments (product_id, branch_id, warehouse_id, adjustment_type, quantity, reason, notes, created_by)
  VALUES (p_product_id, p_branch_id, p_warehouse_id, p_adjustment_type, p_quantity, p_reason, p_notes, auth.uid())
  RETURNING id INTO v_adj_id;
  INSERT INTO inventory_transactions (product_id, branch_id, warehouse_id, transaction_type, quantity, balance_after, reference_type, reference_id, notes)
  VALUES (p_product_id, p_branch_id, p_warehouse_id, 'adjustment',
    CASE WHEN p_adjustment_type = 'increment' THEN p_quantity ELSE -p_quantity END,
    v_new_balance, 'stock_adjustment', v_adj_id, p_notes);
  RETURN v_adj_id;
END;
$$;

CREATE OR REPLACE FUNCTION transfer_stock(
  p_product_id uuid, p_quantity integer,
  p_from_branch_id uuid DEFAULT NULL, p_to_branch_id uuid DEFAULT NULL,
  p_from_warehouse_id uuid DEFAULT NULL, p_to_warehouse_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_transfer_id uuid; v_transfer_number text;
BEGIN
  v_transfer_number := 'TR-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
  INSERT INTO stock_transfers (transfer_number, product_id, quantity, from_branch_id, to_branch_id, from_warehouse_id, to_warehouse_id, status, notes, created_by)
  VALUES (v_transfer_number, p_product_id, p_quantity, p_from_branch_id, p_to_branch_id, p_from_warehouse_id, p_to_warehouse_id, 'in_transit', p_notes, auth.uid())
  RETURNING id INTO v_transfer_id;
  INSERT INTO inventory_transactions (product_id, branch_id, warehouse_id, transaction_type, quantity, balance_after, reference_type, reference_id, notes)
  VALUES (p_product_id, p_from_branch_id, p_from_warehouse_id, 'transfer_out', -p_quantity, (SELECT stock FROM products WHERE id = p_product_id), 'stock_transfer', v_transfer_id, 'Transfer out: ' || v_transfer_number);
  INSERT INTO inventory_transactions (product_id, branch_id, warehouse_id, transaction_type, quantity, balance_after, reference_type, reference_id, notes)
  VALUES (p_product_id, p_to_branch_id, p_to_warehouse_id, 'transfer_in', p_quantity, (SELECT stock FROM products WHERE id = p_product_id), 'stock_transfer', v_transfer_id, 'Transfer in: ' || v_transfer_number);
  RETURN v_transfer_id;
END;
$$;

CREATE OR REPLACE FUNCTION generate_invoice(p_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invoice_id uuid; v_invoice_number text; v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT id INTO v_invoice_id FROM invoices WHERE order_id = p_order_id LIMIT 1;
  IF FOUND THEN RETURN v_invoice_id; END IF;
  v_invoice_number := 'INV-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
  INSERT INTO invoices (invoice_number, order_id, customer_id, subtotal, discount_total, tax_total, shipping_total, grand_total, amount_paid, balance_due, status, issued_at, due_at)
  VALUES (v_invoice_number, p_order_id, v_order.customer_id, v_order.subtotal, v_order.discount_total, v_order.tax_total, v_order.shipping_total, v_order.grand_total, 0, v_order.grand_total, 'sent', now(), now() + interval '30 days')
  RETURNING id INTO v_invoice_id;
  RETURN v_invoice_id;
END;
$$;

-- TRIGGERS
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (NEW.id, NEW.email, coalesce(NEW.raw_user_meta_data->>'full_name', ''), 'customer', 'active');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS trg_recalc_rating_on_review_insert ON product_reviews;
CREATE TRIGGER trg_recalc_rating_on_review_insert AFTER INSERT ON product_reviews FOR EACH ROW EXECUTE FUNCTION recalc_product_rating();
DROP TRIGGER IF EXISTS trg_recalc_rating_on_review_update ON product_reviews;
CREATE TRIGGER trg_recalc_rating_on_review_update AFTER UPDATE ON product_reviews FOR EACH ROW EXECUTE FUNCTION recalc_product_rating();
DROP TRIGGER IF EXISTS trg_recalc_rating_on_review_delete ON product_reviews;
CREATE TRIGGER trg_recalc_rating_on_review_delete AFTER DELETE ON product_reviews FOR EACH ROW EXECUTE FUNCTION recalc_product_rating();

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['orders','payments','invoices','inventory','stock_adjustments','stock_transfers','purchase_orders','employees','roles','permissions'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%s ON %I; CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();', t, t, t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION log_activity(
  p_action text, p_entity_type text DEFAULT NULL, p_entity_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT NULL
)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata);
$$;
