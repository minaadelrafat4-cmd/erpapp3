/*
# Sales Management — orders, returns, refunds, timeline, notifications automation
*/
-- ORDER TIMELINE
CREATE TABLE IF NOT EXISTS order_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event text NOT NULL,
  description text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_timeline_event CHECK (event IN ('created','processing','paid','payment_failed','fulfilled','shipped','delivered','cancelled','returned','refund_issued','status_changed'))
);
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_order_timeline_order ON order_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_order_timeline_created ON order_timeline(created_at);

-- ORDER RETURNS
CREATE TABLE IF NOT EXISTS order_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'pending',
  restocked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_return_status CHECK (status IN ('pending','approved','rejected','received','restocked','cancelled')),
  CONSTRAINT chk_return_reason CHECK (reason IN ('damaged','wrong_item','not_as_described','changed_mind','quality_issue','other'))
);
ALTER TABLE order_returns ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_order_returns_order ON order_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_status ON order_returns(status);

CREATE TABLE IF NOT EXISTS order_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES order_returns(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  refund_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE order_return_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_order_return_items_return ON order_return_items(return_id);

-- ORDER REFUNDS
CREATE TABLE IF NOT EXISTS order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  return_id uuid REFERENCES order_returns(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  reason text NOT NULL DEFAULT 'customer_request',
  status text NOT NULL DEFAULT 'pending',
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz,
  gateway_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_refund_status CHECK (status IN ('pending','completed','failed','cancelled')),
  CONSTRAINT chk_refund_reason CHECK (reason IN ('customer_request','damaged_goods','wrong_item','overcharge','cancellation','other'))
);
ALTER TABLE order_refunds ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_order_refunds_order ON order_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_status ON order_refunds(status);

-- BRANCH ORDERS (POS-ready foundation)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'website';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pos_operator_id uuid REFERENCES employees(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_source_check' AND contype = 'c') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_source_check CHECK (source IN ('website','pos','phone','branch_transfer'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);

-- RLS POLICIES for new tables
DROP POLICY IF EXISTS "select_own_timeline" ON order_timeline;
CREATE POLICY "select_own_timeline" ON order_timeline FOR SELECT TO authenticated
  USING (is_staff() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = order_timeline.order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "staff_insert_timeline" ON order_timeline;
CREATE POLICY "staff_insert_timeline" ON order_timeline FOR INSERT TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "select_own_returns" ON order_returns;
CREATE POLICY "select_own_returns" ON order_returns FOR SELECT TO authenticated
  USING (is_staff() OR auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_returns" ON order_returns;
CREATE POLICY "insert_own_returns" ON order_returns FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "staff_update_returns" ON order_returns;
CREATE POLICY "staff_update_returns" ON order_returns FOR UPDATE TO authenticated
  USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "select_own_return_items" ON order_return_items;
CREATE POLICY "select_own_return_items" ON order_return_items FOR SELECT TO authenticated
  USING (is_staff() OR EXISTS (SELECT 1 FROM order_returns r WHERE r.id = order_return_items.return_id AND r.user_id = auth.uid()));
DROP POLICY IF EXISTS "staff_insert_return_items" ON order_return_items;
CREATE POLICY "staff_insert_return_items" ON order_return_items FOR INSERT TO authenticated
  WITH CHECK (is_staff() OR EXISTS (SELECT 1 FROM order_returns r WHERE r.id = order_return_items.return_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS "select_own_refunds" ON order_refunds;
CREATE POLICY "select_own_refunds" ON order_refunds FOR SELECT TO authenticated
  USING (is_staff() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = order_refunds.order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "staff_insert_refunds" ON order_refunds;
CREATE POLICY "staff_insert_refunds" ON order_refunds FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_refunds" ON order_refunds;
CREATE POLICY "staff_update_refunds" ON order_refunds FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['order_returns','order_refunds'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON %I; CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

-- BUSINESS FUNCTIONS
CREATE OR REPLACE FUNCTION log_order_event(p_order_id uuid, p_event text, p_description text DEFAULT NULL, p_metadata jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO order_timeline (order_id, event, description, actor_id, metadata)
  VALUES (p_order_id, p_event, p_description, auth.uid(), p_metadata);
END;
$$;

CREATE OR REPLACE FUNCTION cancel_order(p_order_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order orders%ROWTYPE; v_item order_items%ROWTYPE; v_product products%ROWTYPE; v_new_balance integer;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status = 'cancelled' THEN RAISE EXCEPTION 'Order already cancelled'; END IF;

  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    UPDATE products SET stock = stock + v_item.quantity WHERE id = v_item.product_id RETURNING stock INTO v_new_balance;
    INSERT INTO inventory_transactions (product_id, transaction_type, quantity, balance_after, reference_type, reference_id, notes)
    VALUES (v_item.product_id, 'return', v_item.quantity, v_new_balance, 'order_cancellation', p_order_id, 'Restored from cancelled order');
  END LOOP;

  UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = p_order_id;
  PERFORM log_order_event(p_order_id, 'cancelled', coalesce(p_reason, 'Order cancelled'));
  PERFORM create_notification('order_cancelled', 'Order Cancelled', 'Order ' || v_order.order_number || ' has been cancelled.', 'order');

  RETURN jsonb_build_object('order_id', p_order_id, 'status', 'cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION process_return(
  p_order_id uuid, p_reason text, p_items jsonb, p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_return_id uuid; v_return_number text; v_order orders%ROWTYPE;
  v_item jsonb; v_oi order_items%ROWTYPE; v_product products%ROWTYPE;
  v_new_balance integer; v_total_refund numeric := 0; v_refund_id uuid;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  v_return_number := 'RET-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
  INSERT INTO order_returns (return_number, order_id, customer_id, user_id, reason, status, notes)
  VALUES (v_return_number, p_order_id, v_order.customer_id, v_order.user_id, p_reason, 'received', p_notes)
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_oi FROM order_items WHERE id = (v_item->>'order_item_id')::uuid;
    IF NOT FOUND THEN CONTINUE; END IF;
    v_total_refund := v_total_refund + ((v_item->>'refund_amount')::numeric);

    INSERT INTO order_return_items (return_id, order_item_id, product_id, quantity, refund_amount)
    VALUES (v_return_id, v_oi.id, v_oi.product_id, (v_item->>'quantity')::integer, (v_item->>'refund_amount')::numeric);

    IF v_oi.product_id IS NOT NULL THEN
      UPDATE products SET stock = stock + (v_item->>'quantity')::integer WHERE id = v_oi.product_id RETURNING stock INTO v_new_balance;
      INSERT INTO inventory_transactions (product_id, transaction_type, quantity, balance_after, reference_type, reference_id, notes)
      VALUES (v_oi.product_id, 'return', (v_item->>'quantity')::integer, v_new_balance, 'order_return', v_return_id, 'Restocked from return');
    END IF;
  END LOOP;

  UPDATE order_returns SET status = 'restocked', restocked = true WHERE id = v_return_id;

  INSERT INTO order_refunds (refund_number, order_id, return_id, amount, reason, status, processed_by, processed_at)
  VALUES ('REF-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8)), p_order_id, v_return_id, v_total_refund, 'customer_request', 'completed', auth.uid(), now())
  RETURNING id INTO v_refund_id;

  IF v_total_refund >= v_order.grand_total THEN
    UPDATE orders SET payment_status = 'refunded', status = 'refunded' WHERE id = p_order_id;
  ELSE
    UPDATE orders SET payment_status = 'refunded' WHERE id = p_order_id;
  END IF;

  PERFORM log_order_event(p_order_id, 'returned', 'Return processed: ' || v_return_number);
  PERFORM log_order_event(p_order_id, 'refund_issued', 'Refund issued: ' || formatCurrency(v_total_refund));
  PERFORM create_notification('return_processed', 'Return Processed', 'Return ' || v_return_number || ' processed. Refund: ' || v_total_refund, 'order');

  RETURN jsonb_build_object('return_id', v_return_id, 'refund_id', v_refund_id, 'refund_amount', v_total_refund);
END;
$$;

CREATE OR REPLACE FUNCTION issue_refund(
  p_order_id uuid, p_amount numeric, p_reason text DEFAULT 'customer_request', p_notes text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_refund_id uuid; v_order orders%ROWTYPE; v_refund_number text;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  v_refund_number := 'REF-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
  INSERT INTO order_refunds (refund_number, order_id, amount, reason, status, processed_by, processed_at, notes)
  VALUES (v_refund_number, p_order_id, p_amount, p_reason, 'completed', auth.uid(), now(), p_notes)
  RETURNING id INTO v_refund_id;
  IF p_amount >= v_order.grand_total THEN
    UPDATE orders SET payment_status = 'refunded' WHERE id = p_order_id;
  ELSE
    UPDATE orders SET payment_status = 'refunded' WHERE id = p_order_id;
  END IF;
  PERFORM log_order_event(p_order_id, 'refund_issued', 'Refund issued: ' || v_refund_number || ' (' || p_amount || ')');
  PERFORM create_notification('refund_issued', 'Refund Issued', 'Refund ' || v_refund_number || ' for ' || p_amount, 'order');
  RETURN v_refund_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_order_status(p_order_id uuid, p_status text, p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old_status text; v_event text;
BEGIN
  SELECT status INTO v_old_status FROM orders WHERE id = p_order_id;
  UPDATE orders SET status = p_status, updated_at = now() WHERE id = p_order_id;
  v_event := CASE p_status
    WHEN 'processing' THEN 'processing'
    WHEN 'shipped' THEN 'shipped'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE 'status_changed'
  END;
  PERFORM log_order_event(p_order_id, v_event, coalesce(p_notes, 'Status: ' || v_old_status || ' -> ' || p_status));
  IF p_status = 'delivered' THEN
    PERFORM create_notification('order_delivered', 'Order Delivered', 'Order delivered successfully', 'order');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION create_notification(
  p_type text, p_title text, p_message text, p_category text DEFAULT 'system', p_user_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_notif_id uuid; v_staff_user uuid;
BEGIN
  IF p_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (p_user_id, p_title, p_message, p_type, NULL)
    RETURNING id INTO v_notif_id;
  ELSE
    FOR v_staff_user IN SELECT id FROM profiles WHERE role IN ('admin','manager','staff') AND status = 'active' LOOP
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (v_staff_user, p_title, p_message, p_type, NULL)
      RETURNING id INTO v_notif_id;
    END LOOP;
  END IF;
  RETURN v_notif_id;
END;
$$;

CREATE OR REPLACE FUNCTION create_branch_order(
  p_branch_id uuid, p_items jsonb, p_customer_email text DEFAULT NULL,
  p_payment_method text DEFAULT 'cash', p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid; v_order_number text; v_subtotal numeric := 0; v_grand numeric;
  v_item jsonb; v_line_total numeric; v_product products%ROWTYPE; v_new_balance integer;
  v_customer_id uuid; v_tax numeric;
BEGIN
  v_order_number := 'LX-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
  IF p_customer_email IS NOT NULL THEN
    SELECT c.id INTO v_customer_id FROM customers c JOIN profiles p ON p.id = c.user_id WHERE p.email = p_customer_email LIMIT 1;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found: %', v_item->>'product_id'; END IF;
    v_line_total := v_product.price * ((v_item->>'quantity')::integer);
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  v_tax := v_subtotal * 0.08;
  v_grand := v_subtotal + v_tax;

  INSERT INTO orders (order_number, customer_id, branch_id, source, pos_operator_id, status, payment_status,
    subtotal, tax_total, grand_total, currency, notes)
  VALUES (v_order_number, v_customer_id, p_branch_id, 'pos', auth.uid(), 'processing', 'paid',
    v_subtotal, v_tax, v_grand, 'USD', p_notes)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid;
    v_line_total := v_product.price * ((v_item->>'quantity')::integer);
    INSERT INTO order_items (order_id, product_id, product_name, sku, price, quantity, line_total)
    VALUES (v_order_id, v_product.id, v_product.name, v_product.sku, v_product.price, (v_item->>'quantity')::integer, v_line_total);
    UPDATE products SET stock = stock - (v_item->>'quantity')::integer WHERE id = v_product.id RETURNING stock INTO v_new_balance;
    UPDATE inventory SET quantity_on_hand = quantity_on_hand - (v_item->>'quantity')::integer, last_stocked_at = now()
    WHERE product_id = v_product.id AND branch_id = p_branch_id;
    INSERT INTO inventory_transactions (product_id, branch_id, transaction_type, quantity, balance_after, reference_type, reference_id, notes)
    VALUES (v_product.id, p_branch_id, 'sale', -((v_item->>'quantity')::integer), v_new_balance, 'order', v_order_id, 'Branch POS sale');
  END LOOP;

  PERFORM log_order_event(v_order_id, 'created', 'Branch order created');
  PERFORM log_order_event(v_order_id, 'paid', 'Payment received (' || p_payment_method || ')');
  PERFORM create_notification('new_order', 'New Branch Order', 'Order ' || v_order_number || ' placed at branch', 'order');

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'grand_total', v_grand);
END;
$$;

-- AUTOMATION TRIGGERS
CREATE OR REPLACE FUNCTION order_created_timeline_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO order_timeline (order_id, event, description, actor_id, metadata)
  VALUES (NEW.id, 'created', 'Order placed: ' || NEW.order_number, NEW.user_id, jsonb_build_object('total', NEW.grand_total, 'source', NEW.source));
  PERFORM create_notification('new_order', 'New Order Received', 'Order ' || NEW.order_number || ' — ' || NEW.grand_total, 'order');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_order_created_timeline ON orders;
CREATE TRIGGER trg_order_created_timeline AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION order_created_timeline_fn();

CREATE OR REPLACE FUNCTION low_stock_alert_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stock <= NEW.reorder_level AND (OLD IS NULL OR OLD.stock > NEW.reorder_level) THEN
    INSERT INTO stock_alerts (product_id, alert_type, severity, message, quantity, threshold)
    VALUES (NEW.id, CASE WHEN NEW.stock = 0 THEN 'out_of_stock' ELSE 'low_stock' END,
      CASE WHEN NEW.stock = 0 THEN 'critical' ELSE 'warning' END,
      NEW.name || ' is ' || CASE WHEN NEW.stock = 0 THEN 'out of stock' ELSE 'low on stock' END,
      NEW.stock, NEW.reorder_level);
    PERFORM create_notification('low_stock', 'Low Stock Alert', NEW.name || ': ' || NEW.stock || ' remaining (reorder at ' || NEW.reorder_level || ')', 'inventory');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_low_stock_alert ON products;
CREATE TRIGGER trg_low_stock_alert AFTER INSERT OR UPDATE OF stock ON products FOR EACH ROW EXECUTE FUNCTION low_stock_alert_fn();

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['order_returns','order_refunds','order_timeline'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%s ON %I; CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();', t, t, t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION formatCurrency(n numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '$' || to_char(n, 'FM999,999,990.00'); $$;
