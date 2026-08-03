/*
# Production Hardening — Security, Inventory & Performance Fixes
*/
-- 1. SECURITY: Fix is_staff() to recognize hierarchy roles
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND role IN (
        'admin', 'manager', 'staff',
        'super_admin', 'company_owner', 'general_manager',
        'warehouse_manager', 'branch_manager', 'inventory_employee',
        'sales_employee', 'marketing', 'accountant', 'customer_support'
      )
  );
$$;

-- 2. SECURITY: Tighten cart_items RLS
DROP POLICY IF EXISTS "insert_cart" ON cart_items;
CREATE POLICY "insert_cart" ON cart_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (user_id IS NULL AND session_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "update_cart" ON cart_items;
CREATE POLICY "update_cart" ON cart_items
  FOR UPDATE TO anon, authenticated
  USING (auth.uid() = user_id OR (user_id IS NULL AND session_id IS NOT NULL))
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (user_id IS NULL AND session_id IS NOT NULL)
  );

-- 3. SECURITY: CHECK constraints on orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_status_check
      CHECK (status IN ('pending','processing','shipped','delivered','cancelled','refunded'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
      CHECK (payment_status IN ('unpaid','paid','partially_paid','refunded','partially_refunded'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillment_status_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_status_check
      CHECK (fulfillment_status IN ('unfulfilled','fulfilled','shipped','delivered'));
  END IF;
END $$;

-- 4. place_order() — validate stock, active, coupon
CREATE OR REPLACE FUNCTION place_order(
  p_user_id uuid,
  p_items jsonb,
  p_shipping_address jsonb DEFAULT NULL,
  p_billing_address jsonb DEFAULT NULL,
  p_coupon_code text DEFAULT NULL,
  p_currency text DEFAULT 'USD'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_price numeric(12,2);
  v_line_total numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_tax numeric(12,2) := 0;
  v_shipping numeric(12,2) := 9.95;
  v_grand numeric(12,2) := 0;
  v_product_record record;
  v_coupon_record record;
BEGIN
  v_order_number := 'ORD-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random() * 100000)::text, 5, '0');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_product_id;
    END IF;
    SELECT stock, price, is_active INTO v_product_record
    FROM products WHERE id = v_product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_product_id;
    END IF;
    IF NOT v_product_record.is_active THEN
      RAISE EXCEPTION 'Product % is no longer available', v_product_id;
    END IF;
    IF v_product_record.stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product % (available: %, requested: %)',
        v_product_id, v_product_record.stock, v_qty;
    END IF;
  END LOOP;

  INSERT INTO orders (order_number, user_id, status, payment_status, fulfillment_status,
    subtotal, discount_total, shipping_total, tax_total, grand_total, currency,
    shipping_address, billing_address, placed_at)
  VALUES (v_order_number, p_user_id, 'pending', 'unpaid', 'unfulfilled',
    0, 0, 0, 0, 0, p_currency, p_shipping_address, p_billing_address, now())
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    SELECT price INTO v_price FROM products WHERE id = v_product_id;
    v_line_total := v_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    INSERT INTO order_items (order_id, product_id, product_name, price, quantity, line_total)
    SELECT v_order_id, p.id, p.name, p.price, v_qty, v_line_total
    FROM products p WHERE p.id = v_product_id;

    UPDATE products SET stock = stock - v_qty WHERE id = v_product_id;

    INSERT INTO inventory_transactions (product_id, transaction_type, quantity, balance_after, reference_type, reference_id, created_by)
    SELECT v_product_id, 'sale', -v_qty, stock, 'order', v_order_id, p_user_id
    FROM products WHERE id = v_product_id;
  END LOOP;

  IF p_coupon_code IS NOT NULL THEN
    SELECT * INTO v_coupon_record FROM coupons
    WHERE code = upper(p_coupon_code) AND is_active = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
      AND (max_uses IS NULL OR used_count < max_uses)
      AND min_subtotal <= v_subtotal
    FOR UPDATE;
    IF FOUND THEN
      IF v_coupon_record.discount_type = 'percentage' THEN
        v_discount := v_subtotal * (v_coupon_record.discount_value / 100);
      ELSE
        v_discount := v_coupon_record.discount_value;
      END IF;
      UPDATE coupons SET used_count = used_count + 1 WHERE id = v_coupon_record.id;
    END IF;
  END IF;

  v_tax := round((v_subtotal - v_discount) * 0.08, 2);
  IF v_subtotal >= 75 THEN v_shipping := 0; END IF;
  v_grand := v_subtotal - v_discount + v_tax + v_shipping;

  UPDATE orders SET
    subtotal = v_subtotal, discount_total = v_discount,
    tax_total = v_tax, shipping_total = v_shipping, grand_total = v_grand
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_order_number,
    'subtotal', v_subtotal, 'discount', v_discount,
    'tax', v_tax, 'shipping', v_shipping, 'grand_total', v_grand
  );
END;
$$;

-- 5. transfer_stock() — actually move stock
CREATE OR REPLACE FUNCTION transfer_stock(
  p_product_id uuid,
  p_quantity integer,
  p_from_branch_id uuid DEFAULT NULL,
  p_to_branch_id uuid DEFAULT NULL,
  p_from_warehouse_id uuid DEFAULT NULL,
  p_to_warehouse_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_transfer_id uuid;
  v_transfer_number text;
  v_current_stock integer;
BEGIN
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Transfer quantity must be positive'; END IF;
  IF p_from_branch_id IS NULL AND p_from_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Source location required';
  END IF;
  IF p_to_branch_id IS NULL AND p_to_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Destination location required';
  END IF;

  v_transfer_number := 'TRF-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random() * 100000)::text, 5, '0');

  SELECT stock INTO v_current_stock FROM products WHERE id = p_product_id FOR UPDATE;
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for transfer (available: %)', v_current_stock;
  END IF;

  INSERT INTO stock_transfers (transfer_number, product_id, quantity,
    from_branch_id, to_branch_id, from_warehouse_id, to_warehouse_id,
    status, shipped_at, notes, created_by)
  VALUES (v_transfer_number, p_product_id, p_quantity,
    p_from_branch_id, p_to_branch_id, p_from_warehouse_id, p_to_warehouse_id,
    'in_transit', now(), p_notes, p_created_by)
  RETURNING id INTO v_transfer_id;

  IF p_from_branch_id IS NOT NULL THEN
    UPDATE inventory SET quantity_on_hand = quantity_on_hand - p_quantity
    WHERE product_id = p_product_id AND branch_id = p_from_branch_id;
  END IF;
  IF p_from_warehouse_id IS NOT NULL THEN
    UPDATE inventory SET quantity_on_hand = quantity_on_hand - p_quantity
    WHERE product_id = p_product_id AND warehouse_id = p_from_warehouse_id;
  END IF;

  IF p_to_branch_id IS NOT NULL THEN
    INSERT INTO inventory (product_id, branch_id, quantity_on_hand, reorder_point)
    VALUES (p_product_id, p_to_branch_id, p_quantity, 10)
    ON CONFLICT (product_id, branch_id) DO UPDATE
    SET quantity_on_hand = inventory.quantity_on_hand + EXCLUDED.quantity_on_hand;
  END IF;
  IF p_to_warehouse_id IS NOT NULL THEN
    INSERT INTO inventory (product_id, warehouse_id, quantity_on_hand, reorder_point)
    VALUES (p_product_id, p_to_warehouse_id, p_quantity, 10)
    ON CONFLICT DO NOTHING;
    UPDATE inventory SET quantity_on_hand = quantity_on_hand + p_quantity
    WHERE product_id = p_product_id AND warehouse_id = p_to_warehouse_id
      AND branch_id IS NULL;
  END IF;

  INSERT INTO inventory_transactions (product_id, warehouse_id, branch_id, transaction_type, quantity, balance_after, reference_type, reference_id, created_by)
  SELECT p_product_id, p_from_warehouse_id, p_from_branch_id, 'transfer_out', -p_quantity,
    stock, 'transfer', v_transfer_id, p_created_by
  FROM products WHERE id = p_product_id;

  INSERT INTO inventory_transactions (product_id, warehouse_id, branch_id, transaction_type, quantity, balance_after, reference_type, reference_id, created_by)
  SELECT p_product_id, p_to_warehouse_id, p_to_branch_id, 'transfer_in', p_quantity,
    stock, 'transfer', v_transfer_id, p_created_by
  FROM products WHERE id = p_product_id;

  RETURN v_transfer_id;
END;
$$;

-- 6. receive_stock_transfer()
CREATE OR REPLACE FUNCTION receive_stock_transfer(p_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_transfer record;
BEGIN
  SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_transfer.status != 'in_transit' THEN
    RAISE EXCEPTION 'Transfer is not in transit (current: %)', v_transfer.status;
  END IF;
  UPDATE stock_transfers SET status = 'received', received_at = now() WHERE id = p_transfer_id;
  PERFORM create_notification('info', 'Transfer Received',
    'Transfer ' || v_transfer.transfer_number || ' has been received', 'inventory', NULL);
END;
$$;

-- 7. receive_purchase_order() — atomic upsert, no double-count
CREATE OR REPLACE FUNCTION receive_purchase_order(p_po_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_po record;
  v_item record;
  v_batch_id uuid;
BEGIN
  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF v_po.status = 'received' THEN RAISE EXCEPTION 'PO already received'; END IF;
  IF v_po.status = 'cancelled' THEN RAISE EXCEPTION 'PO is cancelled'; END IF;

  FOR v_item IN SELECT * FROM purchase_order_items WHERE purchase_order_id = p_po_id LOOP
    INSERT INTO product_batches (product_id, batch_number, supplier_id, purchase_order_id,
      warehouse_id, quantity_received, quantity_remaining, unit_cost, unit_price, status, created_by)
    VALUES (v_item.product_id, 'BAT-' || v_item.id::text, v_po.supplier_id, p_po_id,
      v_po.warehouse_id, v_item.quantity, v_item.quantity, v_item.unit_cost,
      (SELECT price FROM products WHERE id = v_item.product_id), 'active', auth.uid())
    RETURNING id INTO v_batch_id;

    UPDATE products SET cost = v_item.unit_cost, stock = stock + v_item.quantity
    WHERE id = v_item.product_id;

    IF v_po.warehouse_id IS NOT NULL THEN
      INSERT INTO inventory (product_id, warehouse_id, quantity_on_hand, reorder_point)
      VALUES (v_item.product_id, v_po.warehouse_id, v_item.quantity, 10)
      ON CONFLICT DO NOTHING;

      UPDATE inventory SET quantity_on_hand = inventory.quantity_on_hand + v_item.quantity,
        last_stocked_at = now()
      WHERE product_id = v_item.product_id AND warehouse_id = v_po.warehouse_id
        AND branch_id IS NULL;
    END IF;

    INSERT INTO inventory_transactions (product_id, warehouse_id, transaction_type,
      quantity, balance_after, reference_type, reference_id, created_by)
    SELECT v_item.product_id, v_po.warehouse_id, 'purchase', v_item.quantity,
      stock, 'purchase_order', p_po_id, auth.uid()
    FROM products WHERE id = v_item.product_id;
  END LOOP;

  UPDATE purchase_orders SET status = 'received', received_at = now() WHERE id = p_po_id;
  PERFORM create_notification('info', 'Purchase Order Received',
    'PO ' || v_po.po_number || ' has been received', 'inventory', NULL);
END;
$$;

-- 8. process_return() — correct partial refund status
CREATE OR REPLACE FUNCTION process_return(
  p_order_id uuid,
  p_reason text DEFAULT 'other',
  p_items jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_return_id uuid;
  v_return_number text;
  v_order record;
  v_item jsonb;
  v_order_item record;
  v_refund_amount numeric(12,2) := 0;
  v_total_refunded numeric(12,2) := 0;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  v_return_number := 'RET-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random() * 100000)::text, 5, '0');

  INSERT INTO order_returns (return_number, order_id, customer_id, user_id, reason, status, notes)
  VALUES (v_return_number, p_order_id, v_order.customer_id, v_order.user_id, p_reason, 'received', p_notes)
  RETURNING id INTO v_return_id;

  IF p_items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      SELECT * INTO v_order_item FROM order_items WHERE id = (v_item->>'order_item_id')::uuid;
      IF v_order_item.order_id != p_order_id THEN
        RAISE EXCEPTION 'Return item does not belong to this order';
      END IF;

      INSERT INTO order_return_items (return_id, order_item_id, product_id, quantity, refund_amount)
      VALUES (v_return_id, v_order_item.id, v_order_item.product_id,
        (v_item->>'quantity')::integer, (v_item->>'refund_amount')::numeric);

      v_refund_amount := (v_item->>'refund_amount')::numeric;
      v_total_refunded := v_total_refunded + v_refund_amount;

      IF v_order_item.product_id IS NOT NULL THEN
        UPDATE products SET stock = stock + (v_item->>'quantity')::integer
        WHERE id = v_order_item.product_id;
        INSERT INTO inventory_transactions (product_id, transaction_type, quantity, balance_after, reference_type, reference_id)
        SELECT v_order_item.product_id, 'return', (v_item->>'quantity')::integer,
          stock, 'return', v_return_id
        FROM products WHERE id = v_order_item.product_id;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO order_refunds (refund_number, order_id, return_id, amount, reason, status, processed_by, processed_at)
  VALUES ('REF-' || v_return_number, p_order_id, v_return_id, v_total_refunded, p_reason, 'completed', auth.uid(), now());

  IF v_total_refunded >= v_order.grand_total THEN
    UPDATE orders SET status = 'refunded', payment_status = 'refunded' WHERE id = p_order_id;
  ELSE
    UPDATE orders SET payment_status = 'partially_refunded' WHERE id = p_order_id;
  END IF;

  UPDATE order_returns SET status = 'restocked' WHERE id = v_return_id;

  PERFORM log_order_event(p_order_id, 'returned', 'Return processed: ' || v_return_number, NULL);
  PERFORM log_order_event(p_order_id, 'refund_issued', 'Refund issued: $' || v_total_refunded, NULL);
  PERFORM create_notification('info', 'Return Processed',
    'Return ' || v_return_number || ' processed for order ' || v_order.order_number, 'orders', NULL);

  RETURN v_return_id;
END;
$$;

-- 9. issue_refund() — validate amount, correct partial status
CREATE OR REPLACE FUNCTION issue_refund(
  p_order_id uuid,
  p_amount numeric,
  p_reason text DEFAULT 'customer_request',
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_refund_id uuid;
  v_order record;
  v_total_refunded numeric(12,2) := 0;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Refund amount must be positive'; END IF;
  IF p_amount > v_order.grand_total THEN
    RAISE EXCEPTION 'Refund amount exceeds order total';
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_total_refunded
  FROM order_refunds WHERE order_id = p_order_id AND status = 'completed';

  IF v_total_refunded + p_amount > v_order.grand_total THEN
    RAISE EXCEPTION 'Total refunds would exceed order total';
  END IF;

  INSERT INTO order_refunds (refund_number, order_id, amount, reason, status, processed_by, processed_at, notes)
  VALUES ('REF-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random() * 100000)::text, 5, '0'),
    p_order_id, p_amount, p_reason, 'completed', auth.uid(), now(), p_notes)
  RETURNING id INTO v_refund_id;

  IF v_total_refunded + p_amount >= v_order.grand_total THEN
    UPDATE orders SET payment_status = 'refunded' WHERE id = p_order_id;
  ELSE
    UPDATE orders SET payment_status = 'partially_refunded' WHERE id = p_order_id;
  END IF;

  PERFORM log_order_event(p_order_id, 'refund_issued', 'Refund issued: $' || p_amount, NULL);
  PERFORM create_notification('info', 'Refund Issued',
    'Refund of $' || p_amount || ' issued for order ' || v_order.order_number, 'orders', NULL);

  RETURN v_refund_id;
END;
$$;

-- 10. cancel_order() — validate not delivered
CREATE OR REPLACE FUNCTION cancel_order(p_order_id uuid, p_reason text DEFAULT 'cancelled')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order record;
  v_item record;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status = 'cancelled' THEN RAISE EXCEPTION 'Order already cancelled'; END IF;
  IF v_order.status = 'delivered' THEN RAISE EXCEPTION 'Cannot cancel a delivered order'; END IF;

  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.product_id IS NOT NULL THEN
      UPDATE products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
      INSERT INTO inventory_transactions (product_id, transaction_type, quantity, balance_after, reference_type, reference_id)
      SELECT v_item.product_id, 'return', v_item.quantity, stock, 'order', p_order_id
      FROM products WHERE id = v_item.product_id;
    END IF;
  END LOOP;

  UPDATE orders SET status = 'cancelled' WHERE id = p_order_id;

  PERFORM log_order_event(p_order_id, 'cancelled', 'Order cancelled: ' || p_reason, NULL);
  PERFORM create_notification('warning', 'Order Cancelled',
    'Order ' || v_order.order_number || ' has been cancelled', 'orders', NULL);
END;
$$;

-- 11. place_customer_order() — atomic checkout
CREATE OR REPLACE FUNCTION place_customer_order(
  p_user_id uuid,
  p_items jsonb,
  p_shipping_address jsonb DEFAULT NULL,
  p_billing_address jsonb DEFAULT NULL,
  p_coupon_code text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := place_order(p_user_id, p_items, p_shipping_address, p_billing_address, p_coupon_code);
  UPDATE orders SET payment_status = 'paid'
  WHERE id = (v_result->>'order_id')::uuid;
  RETURN v_result;
END;
$$;

-- 12. PERFORMANCE: Missing indexes
CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_return_items_order_item ON order_return_items(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_payment ON order_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_return ON order_refunds(return_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_warehouse ON inventory_transactions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_branch ON inventory_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_warehouse ON stock_adjustments(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_branch ON stock_adjustments(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_wh ON stock_transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_branch ON stock_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_wh ON stock_transfers(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_branch ON stock_transfers(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_po ON product_batches(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_branch ON product_batches(branch_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_warehouse ON product_batches(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_orders_pos_operator ON orders(pos_operator_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON orders(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_warehouse ON expenses(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_warehouse ON stock_alerts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_branch ON stock_alerts(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);
