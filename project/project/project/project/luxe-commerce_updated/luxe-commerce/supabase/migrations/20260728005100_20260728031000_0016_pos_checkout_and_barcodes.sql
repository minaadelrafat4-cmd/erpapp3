-- 1. Safe column & constraint verification
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS qr_code TEXT;

ALTER TABLE product_variants 
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- 2. Safely add UNIQUE constraints on products and variants
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_products_barcode') THEN
    ALTER TABLE products ADD CONSTRAINT uq_products_barcode UNIQUE (barcode);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_products_sku') THEN
    ALTER TABLE products ADD CONSTRAINT uq_products_sku UNIQUE (sku);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_variants_barcode') THEN
    ALTER TABLE product_variants ADD CONSTRAINT uq_variants_barcode UNIQUE (barcode);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_variants_sku') THEN
    ALTER TABLE product_variants ADD CONSTRAINT uq_variants_sku UNIQUE (sku);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_variants_qr_code') THEN
    ALTER TABLE product_variants ADD CONSTRAINT uq_variants_qr_code UNIQUE (qr_code);
  END IF;
END \$\$;

-- 3. Add Batch and Serial Tracking to Order Items
ALTER TABLE order_items 
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- 4. Auto-generate missing barcodes/SKUs Trigger
CREATE OR REPLACE FUNCTION auto_generate_product_identifiers()
RETURNS TRIGGER AS \$\$
BEGIN
  IF NEW.sku IS NULL OR NEW.sku = '' THEN
    NEW.sku := 'SKU-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  END IF;

  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := 'BC' || LPAD(FLOOR(RANDOM() * 1000000000)::TEXT, 10, '0');
  END IF;

  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_identifiers_products ON products;
CREATE TRIGGER trg_auto_identifiers_products
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION auto_generate_product_identifiers();

DROP TRIGGER IF EXISTS trg_auto_identifiers_variants ON product_variants;
CREATE TRIGGER trg_auto_identifiers_variants
  BEFORE INSERT OR UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION auto_generate_product_identifiers();

-- 5. Unified Barcode / QR / SKU Lookup RPC Procedure
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
) AS \$\$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS product_id,
    NULL::UUID AS variant_id,
    p.name,
    p.sku,
    p.barcode,
    p.retail_price AS price,
    p.cost_price,
    p.track_inventory,
    FALSE AS is_variant
  FROM products p
  WHERE LOWER(p.barcode) = LOWER(p_code)
     OR LOWER(p.sku) = LOWER(p_code)
     OR LOWER(p.qr_code) = LOWER(p_code)
  
  UNION ALL
  
  SELECT 
    v.product_id,
    v.id AS variant_id,
    p.name || ' (' || v.name || ')' AS name,
    v.sku,
    v.barcode,
    COALESCE(v.price, p.retail_price) AS price,
    COALESCE(v.cost_price, p.cost_price) AS cost_price,
    p.track_inventory,
    TRUE AS is_variant
  FROM product_variants v
  JOIN products p ON p.id = v.product_id
  WHERE LOWER(v.barcode) = LOWER(p_code)
     OR LOWER(v.sku) = LOWER(p_code)
     OR LOWER(v.qr_code) = LOWER(p_code)
  LIMIT 1;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Atomic POS Checkout RPC Procedure
CREATE OR REPLACE FUNCTION process_pos_checkout(
  p_branch_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_items JSONB,
  p_discount_amount NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS JSONB AS \$\$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_item JSONB;
  v_prod_id UUID;
  v_var_id UUID;
  v_qty INT;
  v_unit_price NUMERIC;
  v_subtotal NUMERIC := 0;
  v_grand_total NUMERIC := 0;
  v_current_stock INT;
  v_batch TEXT;
  v_serial TEXT;
BEGIN
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    
    SELECT quantity_on_hand INTO v_current_stock
    FROM inventory
    WHERE product_id = v_prod_id AND branch_id = p_branch_id
    FOR UPDATE;

    IF v_current_stock IS NULL OR v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product ID % at this branch. Requested: %, Available: %', 
        v_prod_id, v_qty, COALESCE(v_current_stock, 0);
    END IF;

    v_subtotal := v_subtotal + ((v_item->>'unit_price')::NUMERIC * v_qty);
  END LOOP;

  v_grand_total := (v_subtotal - p_discount_amount) + p_tax_amount;

  INSERT INTO orders (
    order_number, branch_id, customer_id, cashier_id, source,
    status, payment_status, payment_method, subtotal, discount_amount,
    tax_amount, grand_total, placed_at
  ) VALUES (
    v_order_number, p_branch_id, p_customer_id, p_cashier_id, 'pos',
    'delivered', 'paid', p_payment_method, v_subtotal, p_discount_amount,
    p_tax_amount, v_grand_total, NOW()
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'product_id')::UUID;
    v_var_id := (v_item->>'variant_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_batch := v_item->>'batch_number';
    v_serial := v_item->>'serial_number';

    INSERT INTO order_items (
      order_id, product_id, variant_id, quantity, price, line_total, batch_number, serial_number
    ) VALUES (
      v_order_id, v_prod_id, v_var_id, v_qty, v_unit_price, (v_qty * v_unit_price), v_batch, v_serial
    );

    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand - v_qty,
        updated_at = NOW()
    WHERE product_id = v_prod_id AND branch_id = p_branch_id;

    INSERT INTO inventory_transactions (
      product_id, branch_id, transaction_type, quantity, reference_id, created_by
    ) VALUES (
      v_prod_id, p_branch_id, 'sale', -v_qty, v_order_id, p_cashier_id
    );
  END LOOP;

  INSERT INTO order_timeline (order_id, event, description, actor_id)
  VALUES (v_order_id, 'paid', 'POS sale completed and inventory updated.', p_cashier_id);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'grand_total', v_grand_total
  );
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant execution privileges to RPC functions
GRANT EXECUTE ON FUNCTION lookup_product_by_code(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION process_pos_checkout(UUID, UUID, UUID, JSONB, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;
