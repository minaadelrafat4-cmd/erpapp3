/*
# ERP views & functions — inventory sync, supplier payments, alerts
*/
-- VIEWS
CREATE OR REPLACE VIEW v_inventory_valuation AS
SELECT p.id AS product_id, p.name AS product_name, p.sku,
  coalesce(sum(i.quantity_on_hand), 0) AS total_on_hand,
  coalesce(sum(i.quantity_reserved), 0) AS total_reserved,
  coalesce(sum(i.quantity_on_hand) - sum(i.quantity_reserved), 0) AS total_available,
  coalesce(avg(p.cost), 0) AS avg_unit_cost,
  coalesce(sum(p.cost * i.quantity_on_hand), 0) AS total_cost_value,
  coalesce(sum(p.price * i.quantity_on_hand), 0) AS total_retail_value,
  coalesce(sum((p.price - coalesce(p.cost, 0)) * i.quantity_on_hand), 0) AS total_potential_profit
FROM products p LEFT JOIN inventory i ON i.product_id = p.id
WHERE p.is_active = true GROUP BY p.id, p.name, p.sku;

CREATE OR REPLACE VIEW v_branch_performance AS
SELECT b.id AS branch_id, b.name AS branch_name, b.code AS branch_code, b.is_active,
  0 AS revenue, 0 AS order_count,
  coalesce(sum(e.amount) FILTER (WHERE e.status IN ('approved','paid')), 0) AS expenses,
  0 AS net_profit, count(DISTINCT emp.id) AS employee_count
FROM branches b LEFT JOIN expenses e ON e.branch_id = b.id LEFT JOIN employees emp ON emp.branch_id = b.id
GROUP BY b.id, b.name, b.code, b.is_active;

CREATE OR REPLACE VIEW v_supplier_outstanding AS
SELECT s.id AS supplier_id, s.name AS supplier_name,
  coalesce(sum(po.grand_total), 0) AS total_ordered,
  coalesce(sum(sp.amount) FILTER (WHERE sp.status = 'completed'), 0) AS total_paid,
  coalesce(sum(po.grand_total), 0) - coalesce(sum(sp.amount) FILTER (WHERE sp.status = 'completed'), 0) AS outstanding_balance,
  count(DISTINCT po.id) AS po_count
FROM suppliers s
LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.status NOT IN ('cancelled','draft')
LEFT JOIN supplier_payments sp ON sp.supplier_id = s.id
GROUP BY s.id, s.name;

CREATE OR REPLACE VIEW v_inventory_timeline AS
SELECT t.id, t.product_id, p.name AS product_name, p.sku, t.transaction_type, t.quantity, t.balance_after,
  t.reference_type, t.reference_id, t.notes, t.warehouse_id, wh.name AS warehouse_name,
  t.branch_id, br.name AS branch_name, t.created_by, t.created_at
FROM inventory_transactions t JOIN products p ON p.id = t.product_id
LEFT JOIN warehouses wh ON wh.id = t.warehouse_id LEFT JOIN branches br ON br.id = t.branch_id
ORDER BY t.created_at DESC;

CREATE OR REPLACE VIEW v_product_batches_detail AS
SELECT pb.id, pb.batch_number, pb.serial_number, p.name AS product_name, p.sku, s.name AS supplier_name,
  wh.name AS warehouse_name, br.name AS branch_name, pb.quantity_received, pb.quantity_remaining,
  pb.unit_cost, pb.unit_price, pb.expiry_date, pb.manufacture_date, pb.status, pb.received_at, pb.created_at
FROM product_batches pb JOIN products p ON p.id = pb.product_id
LEFT JOIN suppliers s ON s.id = pb.supplier_id
LEFT JOIN warehouses wh ON wh.id = pb.warehouse_id
LEFT JOIN branches br ON br.id = pb.branch_id
ORDER BY pb.created_at DESC;

CREATE OR REPLACE VIEW v_stock_alerts_detail AS
SELECT sa.id, sa.alert_type, sa.severity, sa.message, sa.quantity, sa.threshold, sa.is_resolved, sa.resolved_at, sa.created_at,
  p.name AS product_name, p.sku, wh.name AS warehouse_name, br.name AS branch_name
FROM stock_alerts sa JOIN products p ON p.id = sa.product_id
LEFT JOIN warehouses wh ON wh.id = sa.warehouse_id LEFT JOIN branches br ON br.id = sa.branch_id
ORDER BY sa.is_resolved ASC, sa.created_at DESC;

-- FUNCTIONS
CREATE OR REPLACE FUNCTION receive_purchase_order(p_po_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_po purchase_orders%ROWTYPE; v_item purchase_order_items%ROWTYPE; v_product products%ROWTYPE;
  v_batch_id uuid; v_balance_after integer; v_received_count integer := 0;
BEGIN
  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF v_po.status = 'received' THEN RAISE EXCEPTION 'PO already received'; END IF;
  FOR v_item IN SELECT * FROM purchase_order_items WHERE purchase_order_id = p_po_id LOOP
    SELECT * INTO v_product FROM products WHERE id = v_item.product_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    INSERT INTO product_batches (product_id, batch_number, serial_number, supplier_id, purchase_order_id, warehouse_id, quantity_received, quantity_remaining, unit_cost, unit_price)
    VALUES (v_product.id, 'BATCH-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
            v_product.serial_number, v_po.supplier_id, p_po_id, v_po.warehouse_id,
            v_item.quantity, v_item.quantity, v_item.unit_cost, v_product.price)
    RETURNING id INTO v_batch_id;
    UPDATE products SET cost = v_item.unit_cost, stock = stock + v_item.quantity WHERE id = v_product.id RETURNING stock INTO v_balance_after;
    INSERT INTO inventory (product_id, warehouse_id, quantity_on_hand, quantity_reserved, reorder_point)
    VALUES (v_product.id, v_po.warehouse_id, v_item.quantity, 0, v_product.reorder_level)
    ON CONFLICT DO NOTHING;
    UPDATE inventory SET quantity_on_hand = quantity_on_hand + v_item.quantity, last_stocked_at = now()
    WHERE product_id = v_product.id AND warehouse_id = v_po.warehouse_id;
    INSERT INTO inventory_transactions (product_id, warehouse_id, transaction_type, quantity, balance_after, reference_type, reference_id, notes)
    VALUES (v_product.id, v_po.warehouse_id, 'purchase', v_item.quantity, v_balance_after, 'purchase_order', p_po_id, 'Received PO ' || v_po.po_number);
    v_received_count := v_received_count + 1;
  END LOOP;
  UPDATE purchase_orders SET status = 'received', received_at = now() WHERE id = p_po_id;
  RETURN jsonb_build_object('po_id', p_po_id, 'po_number', v_po.po_number, 'items_received', v_received_count);
END;
$$;

CREATE OR REPLACE FUNCTION record_supplier_payment(
  p_supplier_id uuid, p_amount numeric, p_method text DEFAULT 'bank_transfer',
  p_purchase_order_id uuid DEFAULT NULL, p_reference text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_payment_id uuid; v_payment_number text;
BEGIN
  v_payment_number := 'SP-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
  INSERT INTO supplier_payments (payment_number, supplier_id, purchase_order_id, amount, method, status, reference, notes, created_by)
  VALUES (v_payment_number, p_supplier_id, p_purchase_order_id, p_amount, p_method, 'completed', p_reference, p_notes, auth.uid())
  RETURNING id INTO v_payment_id;
  RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION create_stock_alert(
  p_product_id uuid, p_alert_type text, p_severity text DEFAULT 'warning',
  p_message text DEFAULT NULL, p_quantity integer DEFAULT NULL,
  p_threshold integer DEFAULT NULL, p_warehouse_id uuid DEFAULT NULL, p_branch_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_alert_id uuid;
BEGIN
  INSERT INTO stock_alerts (product_id, warehouse_id, branch_id, alert_type, severity, message, quantity, threshold)
  VALUES (p_product_id, p_warehouse_id, p_branch_id, p_alert_type, p_severity, coalesce(p_message, p_alert_type), p_quantity, p_threshold)
  RETURNING id INTO v_alert_id;
  RETURN v_alert_id;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_stock_alert(p_alert_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE stock_alerts SET is_resolved = true, resolved_at = now(), resolved_by = auth.uid() WHERE id = p_alert_id;
END;
$$;
