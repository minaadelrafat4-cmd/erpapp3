/*
# POS Checkout Repair — fix schema-mismatched functions from 0016

## Overview
Migration 0016 (pos_checkout_and_barcodes) introduced two RPC functions —
`lookup_product_by_code()` and `process_pos_checkout()` — that the storefront
admin (AdminOrders.tsx) already calls for barcode/QR scanning and POS
checkout. Auditing against the actual schema shows both functions reference
columns that were never added to any table, meaning both have always errored
on invocation and no POS sale has ever been able to complete:

- `lookup_product_by_code()` selected `p.retail_price`, `p.cost_price`, and
  `p.track_inventory` — none exist on `products` (the real columns are
  `price` and `cost`; there is no `track_inventory` column in this schema).
- `process_pos_checkout()` inserted into `orders` using `cashier_id`,
  `payment_method`, `discount_amount`, and `tax_amount` — none of those
  columns exist on `orders` (the real columns, added in 0007, are
  `pos_operator_id`, `discount_total`, and `tax_total`; there is no
  `payment_method` column, so payment method is recorded in the order
  timeline/notes instead, matching how `create_branch_order` in 0007 already
  logs it).
- `process_pos_checkout()` also inserted into `inventory_transactions`
  without `balance_after`, which is `NOT NULL` on that table.
- `pos_operator_id` is a foreign key to `employees(id)` — a separate primary
  key from the authenticated `auth.users(id)`. Neither existing checkout
  function resolved the calling user to their employee record, so even if
  the column names had been correct, the insert would still fail (or,
  worse, silently record no employee link at all).
- `process_pos_checkout()` deducted only `inventory.quantity_on_hand`
  (branch-level) and never `products.stock` (the global counter every other
  stock-affecting function in this codebase keeps in sync — see
  `place_order`, `cancel_order`, `create_branch_order`), and validated stock
  against `inventory` only, without locking `products` — leaving the two
  counters inconsistent after any successful POS sale.
- `process_pos_checkout()` had no server-side staff/role check, so despite
  being reachable only from an admin route in the UI, the RPC itself (granted
  to `authenticated`) could be called directly by any signed-in customer.

This migration replaces both functions in place — same names, same
signatures — so no caller (frontend RPC calls, offline sync queue) needs to
change. It does not touch any table structure beyond what 0016/0018 already
added, and does not alter RLS policies; both functions remain
SECURITY DEFINER, consistent with every other order-mutating function in
this codebase (`place_order`, `cancel_order`, `issue_refund`,
`update_order_status`, `create_branch_order`).

## Safety
- Purely a function repair. No columns, tables, or constraints are added,
  dropped, or renamed.
- Both functions are recreated with `CREATE OR REPLACE FUNCTION` under their
  existing names/signatures — existing GRANTs from 0016 remain valid.
*/

-- 1. Fix lookup_product_by_code() to select real columns
CREATE OR REPLACE FUNCTION lookup_product_by_code(p_code TEXT)
RETURNS TABLE (
  product_id UUID,
  variant_id UUID,
  name TEXT,
  sku TEXT,
  barcode TEXT,
  price NUMERIC,
  cost_price NUMERIC,
  track_inventory BOOLEAN,
  is_variant BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS product_id,
    NULL::UUID AS variant_id,
    p.name,
    p.sku,
    p.barcode,
    p.price,
    p.cost AS cost_price,
    TRUE AS track_inventory, -- every product in this schema is stock-tracked via `inventory`/`products.stock`
    FALSE AS is_variant
  FROM products p
  WHERE p.is_active
    AND (LOWER(p.barcode) = LOWER(p_code)
      OR LOWER(p.sku) = LOWER(p_code)
      OR LOWER(p.qr_code) = LOWER(p_code))

  UNION ALL

  SELECT
    v.product_id,
    v.id AS variant_id,
    p.name || ' (' || v.name || ': ' || v.value || ')' AS name,
    v.sku,
    v.barcode,
    COALESCE(NULLIF(v.price, 0), p.price) AS price,
    p.cost AS cost_price,
    TRUE AS track_inventory,
    TRUE AS is_variant
  FROM product_variants v
  JOIN products p ON p.id = v.product_id
  WHERE p.is_active
    AND (LOWER(v.barcode) = LOWER(p_code)
      OR LOWER(v.sku) = LOWER(p_code)
      OR LOWER(v.qr_code) = LOWER(p_code))
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fix process_pos_checkout() to match the real orders/inventory schema,
--    resolve the calling employee, validate + deduct stock consistently
--    (inventory AND products.stock, both row-locked), and require staff.
CREATE OR REPLACE FUNCTION process_pos_checkout(
  p_branch_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_items JSONB,
  p_discount_amount NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_employee_id UUID;
  v_item JSONB;
  v_prod_id UUID;
  v_var_id UUID;
  v_qty INT;
  v_unit_price NUMERIC;
  v_subtotal NUMERIC := 0;
  v_grand_total NUMERIC := 0;
  v_branch_stock INT;
  v_global_stock INT;
  v_product_name TEXT;
  v_batch TEXT;
  v_serial TEXT;
  v_new_branch_balance INT;
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'Access denied: POS checkout requires staff privileges.';
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'A branch is required to process a POS sale.';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot checkout an empty cart.';
  END IF;

  -- Resolve the authenticated user to their employee record — this is what
  -- links every completed sale to the employee who rang it up.
  SELECT id INTO v_employee_id
  FROM employees
  WHERE user_id = p_cashier_id AND status = 'active'
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user is not linked to an active employee record and cannot process POS sales.';
  END IF;

  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- Pass 1: validate stock for every line, locking both the branch-level
  -- and global stock rows so concurrent checkouts can't oversell.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_prod_id;
    END IF;

    SELECT stock, name INTO v_global_stock, v_product_name
    FROM products WHERE id = v_prod_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_prod_id;
    END IF;

    IF v_global_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%": requested %, available %', v_product_name, v_qty, v_global_stock;
    END IF;

    SELECT quantity_on_hand INTO v_branch_stock
    FROM inventory
    WHERE product_id = v_prod_id AND branch_id = p_branch_id
    FOR UPDATE;

    IF v_branch_stock IS NULL OR v_branch_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient branch stock for "%": requested %, available %', v_product_name, v_qty, COALESCE(v_branch_stock, 0);
    END IF;

    v_subtotal := v_subtotal + ((v_item->>'unit_price')::NUMERIC * v_qty);
  END LOOP;

  v_grand_total := (v_subtotal - p_discount_amount) + p_tax_amount;

  INSERT INTO orders (
    order_number, branch_id, customer_id, pos_operator_id, source,
    status, payment_status, subtotal, discount_total,
    tax_total, grand_total, currency, notes, placed_at
  ) VALUES (
    v_order_number, p_branch_id, p_customer_id, v_employee_id, 'pos',
    'delivered', 'paid', v_subtotal, p_discount_amount,
    p_tax_amount, v_grand_total, 'USD', 'Payment method: ' || p_payment_method, NOW()
  ) RETURNING id INTO v_order_id;

  -- Pass 2: write line items and deduct stock (branch inventory + global).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'product_id')::UUID;
    v_var_id := (v_item->>'variant_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_batch := v_item->>'batch_number';
    v_serial := v_item->>'serial_number';

    SELECT name INTO v_product_name FROM products WHERE id = v_prod_id;

    INSERT INTO order_items (
      order_id, product_id, product_name, price, quantity, line_total, batch_number, serial_number
    ) VALUES (
      v_order_id, v_prod_id, COALESCE(v_product_name, 'Unknown product'), v_unit_price, v_qty, (v_qty * v_unit_price), v_batch, v_serial
    );

    UPDATE products
    SET stock = stock - v_qty
    WHERE id = v_prod_id;

    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand - v_qty,
        updated_at = NOW()
    WHERE product_id = v_prod_id AND branch_id = p_branch_id
    RETURNING quantity_on_hand INTO v_new_branch_balance;

    INSERT INTO inventory_transactions (
      product_id, branch_id, transaction_type, quantity, balance_after,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_prod_id, p_branch_id, 'sale', -v_qty, v_new_branch_balance,
      'order', v_order_id, 'POS sale' || CASE WHEN v_var_id IS NOT NULL THEN ' (variant)' ELSE '' END, p_cashier_id
    );
  END LOOP;

  PERFORM log_order_event(v_order_id, 'created', 'POS sale rung up at checkout.');
  PERFORM log_order_event(v_order_id, 'paid', 'POS sale completed (' || p_payment_method || ') — inventory updated.');

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'grand_total', v_grand_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Re-grant execution privileges (function signatures are unchanged, but
--    re-asserting these keeps this migration self-contained/idempotent).
GRANT EXECUTE ON FUNCTION lookup_product_by_code(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION process_pos_checkout(UUID, UUID, UUID, JSONB, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;
