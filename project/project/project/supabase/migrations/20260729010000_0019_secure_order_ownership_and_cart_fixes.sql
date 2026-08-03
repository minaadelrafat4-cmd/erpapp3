/*
# Post-Audit Fixes: Order Ownership, Cart Concurrency, Guest Cart Merge, RLS Consistency

This migration implements the agreed follow-up improvements from the engineering
audit. It does not change any table shapes and preserves all existing behavior
for legitimate use — it only closes gaps that allowed spoofing or race conditions.

## 1. Secure order ownership
`place_order()` accepted a client-supplied `p_user_id` and trusted it verbatim
when inserting into `orders.user_id` and `inventory_transactions.created_by`.
Any authenticated caller could pass an arbitrary UUID and create orders that
appear to belong to a different customer. We now always derive the owner from
`auth.uid()` (the server-verified session), ignoring the client-supplied value.
Guest checkout (no session) still results in a NULL user_id, exactly as before.

## 2. Eliminate cart race conditions
`cart_items` had no uniqueness constraint, so the app's "insert, and on error
fall back to select+update" pattern could create duplicate rows or lose
increments under concurrent "Add to Cart" clicks (e.g. double-click, multiple
tabs). We add partial unique indexes (separately for signed-in vs guest carts,
and for variant vs no-variant) and a single atomic `upsert_cart_item()`
function using INSERT ... ON CONFLICT ... DO UPDATE.

## 3. Improve guest cart merge
The merge-on-login logic lived entirely in the client, looping per guest item
with multiple round trips (select, then per-row update/delete). This is now a
single SECURITY DEFINER function, `merge_guest_cart()`, executed as one
transaction on the server.

## 4. RLS consistency for orders / order_items / payments
Migration 0017 introduced a permission-based model (`has_perm()`) for ERP
writes and specifically created `orders.manage` / `payments.manage` for this
purpose. Two policies were left inconsistent with that model:
  - `orders` / `order_items` UPDATE policies still allowed ANY staff member
    (via blanket `is_staff()`) to modify orders, even though `orders.manage`
    exists and is only granted to manager+ / sales roles.
  - `payments` INSERT policy checked `orders.manage OR orders.view` —
    `orders.view` is granted to every staff role, so this check was equivalent
    to blanket staff access even though a dedicated `payments.manage`
    permission already exists and is granted only to admin/accountant roles.
This migration tightens those three policies to use the permission that was
actually intended for them. Read access (SELECT) is untouched.
*/

-- =========================================================
-- 1. SECURE ORDER OWNERSHIP
-- =========================================================
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
  v_owner_id uuid;
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
  -- SECURITY: never trust the client-supplied p_user_id. The order always
  -- belongs to the authenticated session (or NULL for a guest checkout).
  v_owner_id := auth.uid();

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
  VALUES (v_order_number, v_owner_id, 'pending', 'unpaid', 'unfulfilled',
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
    SELECT v_product_id, 'sale', -v_qty, stock, 'order', v_order_id, v_owner_id
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

-- place_customer_order() forwards to place_order() unchanged; place_order()
-- now ignores the client-supplied p_user_id, so this stays secure too.

-- =========================================================
-- 2. CART CONCURRENCY — dedupe existing rows, then add unique indexes
-- =========================================================

-- Merge quantities of any pre-existing duplicate cart rows (same owner +
-- product + variant) into the earliest row before we enforce uniqueness.
WITH grouped AS (
  SELECT
    COALESCE(user_id::text, '') AS uid_key,
    COALESCE(session_id, '') AS sid_key,
    product_id,
    COALESCE(variant_id::text, '') AS variant_key,
    array_agg(id ORDER BY created_at ASC) AS ids,
    sum(quantity) AS total_qty
  FROM cart_items
  WHERE user_id IS NOT NULL OR session_id IS NOT NULL
  GROUP BY 1, 2, 3, 4
  HAVING count(*) > 1
)
UPDATE cart_items c SET quantity = g.total_qty, updated_at = now()
FROM grouped g WHERE c.id = g.ids[1];

WITH grouped AS (
  SELECT
    COALESCE(user_id::text, '') AS uid_key,
    COALESCE(session_id, '') AS sid_key,
    product_id,
    COALESCE(variant_id::text, '') AS variant_key,
    array_agg(id ORDER BY created_at ASC) AS ids
  FROM cart_items
  WHERE user_id IS NOT NULL OR session_id IS NOT NULL
  GROUP BY 1, 2, 3, 4
  HAVING count(*) > 1
)
DELETE FROM cart_items c
USING grouped g
WHERE c.id = ANY (g.ids[2:array_length(g.ids, 1)]);

-- One row per (owner, product, variant) combination, split by
-- signed-in vs guest and by variant vs no-variant (NULL is not distinct
-- from itself in a plain UNIQUE index, so a partial index per case is used).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_user_variant
  ON cart_items (user_id, product_id, variant_id)
  WHERE user_id IS NOT NULL AND variant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_user_novariant
  ON cart_items (user_id, product_id)
  WHERE user_id IS NOT NULL AND variant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_session_variant
  ON cart_items (session_id, product_id, variant_id)
  WHERE session_id IS NOT NULL AND user_id IS NULL AND variant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_session_novariant
  ON cart_items (session_id, product_id)
  WHERE session_id IS NOT NULL AND user_id IS NULL AND variant_id IS NULL;

-- Atomic add-to-cart: one round trip, no read-then-write race.
CREATE OR REPLACE FUNCTION upsert_cart_item(
  p_product_id uuid,
  p_variant_id uuid DEFAULT NULL,
  p_quantity integer DEFAULT 1,
  p_session_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  IF v_user_id IS NOT NULL THEN
    IF p_variant_id IS NOT NULL THEN
      INSERT INTO cart_items (user_id, product_id, variant_id, quantity)
      VALUES (v_user_id, p_product_id, p_variant_id, p_quantity)
      ON CONFLICT (user_id, product_id, variant_id) WHERE (user_id IS NOT NULL AND variant_id IS NOT NULL)
      DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = now();
    ELSE
      INSERT INTO cart_items (user_id, product_id, variant_id, quantity)
      VALUES (v_user_id, p_product_id, NULL, p_quantity)
      ON CONFLICT (user_id, product_id) WHERE (user_id IS NOT NULL AND variant_id IS NULL)
      DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = now();
    END IF;
  ELSE
    IF p_session_id IS NULL THEN
      RAISE EXCEPTION 'Session id required for guest cart';
    END IF;
    IF p_variant_id IS NOT NULL THEN
      INSERT INTO cart_items (session_id, product_id, variant_id, quantity)
      VALUES (p_session_id, p_product_id, p_variant_id, p_quantity)
      ON CONFLICT (session_id, product_id, variant_id) WHERE (session_id IS NOT NULL AND user_id IS NULL AND variant_id IS NOT NULL)
      DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = now();
    ELSE
      INSERT INTO cart_items (session_id, product_id, variant_id, quantity)
      VALUES (p_session_id, p_product_id, NULL, p_quantity)
      ON CONFLICT (session_id, product_id) WHERE (session_id IS NOT NULL AND user_id IS NULL AND variant_id IS NULL)
      DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = now();
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_cart_item(uuid, uuid, integer, text) TO anon, authenticated;

-- =========================================================
-- 3. GUEST CART MERGE — single transactional function
-- =========================================================
CREATE OR REPLACE FUNCTION merge_guest_cart(p_session_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR p_session_id IS NULL THEN
    RETURN;
  END IF;

  -- Fold guest quantities into any matching existing item in the user's cart.
  UPDATE cart_items u
  SET quantity = u.quantity + g.quantity, updated_at = now()
  FROM cart_items g
  WHERE g.session_id = p_session_id AND g.user_id IS NULL
    AND u.user_id = v_user_id
    AND u.product_id = g.product_id
    AND u.variant_id IS NOT DISTINCT FROM g.variant_id;

  -- Remove the guest rows that were just folded in above.
  DELETE FROM cart_items g
  WHERE g.session_id = p_session_id AND g.user_id IS NULL
    AND EXISTS (
      SELECT 1 FROM cart_items u
      WHERE u.user_id = v_user_id AND u.product_id = g.product_id
        AND u.variant_id IS NOT DISTINCT FROM g.variant_id
    );

  -- Re-home any remaining guest items (no counterpart) to the signed-in user.
  UPDATE cart_items
  SET user_id = v_user_id, session_id = NULL, updated_at = now()
  WHERE session_id = p_session_id AND user_id IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION merge_guest_cart(text) TO authenticated;

-- =========================================================
-- 4. RLS CONSISTENCY — orders / order_items / payments
-- =========================================================
DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_perm('orders.manage'))
  WITH CHECK (auth.uid() = user_id OR has_perm('orders.manage'));

DROP POLICY IF EXISTS "update_own_order_items" ON order_items;
CREATE POLICY "update_own_order_items" ON order_items FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
    OR has_perm('orders.manage')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
    OR has_perm('orders.manage')
  );

DROP POLICY IF EXISTS "perm_insert_payments" ON payments;
CREATE POLICY "perm_insert_payments" ON payments
  FOR INSERT TO authenticated WITH CHECK (has_perm('payments.manage'));
