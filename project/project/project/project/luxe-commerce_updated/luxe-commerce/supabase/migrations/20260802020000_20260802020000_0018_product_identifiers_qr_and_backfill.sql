/*
# Product Identification System — QR Code Completion & Identifier Backfill

## Overview
Migration 0016 (pos_checkout_and_barcodes) added `sku`, `barcode`, and `qr_code`
columns to `products` and `product_variants`, and wired up a trigger
(`auto_generate_product_identifiers`) that auto-fills `sku` and `barcode` when
missing. However that trigger never populated `qr_code` — the column has sat
unused since it was introduced, and `lookup_product_by_code()` (also from 0016)
already queries it, meaning QR lookups have never had anything to match against.
Additionally, a unique constraint was added for `product_variants.qr_code` but
the equivalent constraint on `products.qr_code` was never added.

This migration:
1. Adds the missing `uq_products_qr_code` unique constraint.
2. Replaces `auto_generate_product_identifiers()` so it also fills `qr_code`
   (only when null/empty, exactly like it already does for sku/barcode), for
   both products and product_variants — no new trigger needed since both
   tables already share this function via existing triggers.
3. Backfills `sku`, `barcode`, and `qr_code` for any existing products or
   variants that are missing one or more of them, so every row — old or new —
   ends up with a full, unique set of identifiers.

## Safety
- Purely additive: no existing column, table, trigger, or row is dropped.
- Existing sku/barcode values are never touched or regenerated — only NULL or
  empty-string identifiers are filled in, both in the trigger and the backfill.
- The generation formulas for sku/barcode are unchanged from 0016 (only salted
  with the row id for extra collision resistance); only qr_code generation is
  new. Any product created before this migration keeps its existing sku and
  barcode exactly as they were.
- If the (astronomically unlikely) case of a generated value colliding with an
  existing one occurs, the unique constraint will reject it and the migration
  will fail loudly rather than silently duplicating an identifier — safe to
  simply re-run the migration in that case.
*/

-- 1. Add the unique constraint that was missed for products.qr_code in 0016
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_products_qr_code') THEN
    ALTER TABLE products ADD CONSTRAINT uq_products_qr_code UNIQUE (qr_code);
  END IF;
END $$;

-- 2. Extend the existing auto-generation trigger function to also cover qr_code
CREATE OR REPLACE FUNCTION auto_generate_product_identifiers()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sku IS NULL OR NEW.sku = '' THEN
    NEW.sku := 'SKU-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NEW.id::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
  END IF;

  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := 'BC' || LPAD(FLOOR(RANDOM() * 9000000000 + 1000000000)::BIGINT::TEXT, 10, '0');
  END IF;

  -- QR code: a distinct, unique, scannable payload (looked up the same way as
  -- sku/barcode via lookup_product_by_code). Previously never generated.
  IF NEW.qr_code IS NULL OR NEW.qr_code = '' THEN
    NEW.qr_code := 'QR' || UPPER(SUBSTRING(MD5(NEW.id::TEXT || RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 12));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Existing triggers on products and product_variants already call this
-- function BEFORE INSERT OR UPDATE, so no new trigger objects are required.

-- 3. Backfill: fill in any missing identifiers on existing rows.
-- Each statement only ever touches rows where the specific column is
-- currently null/empty, and only ever sets that one column.
UPDATE products
SET sku = 'SKU-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8))
WHERE sku IS NULL OR sku = '';

UPDATE products
SET barcode = 'BC' || LPAD(FLOOR(RANDOM() * 9000000000 + 1000000000)::BIGINT::TEXT, 10, '0')
WHERE barcode IS NULL OR barcode = '';

UPDATE products
SET qr_code = 'QR' || UPPER(SUBSTRING(MD5(id::TEXT || RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 12))
WHERE qr_code IS NULL OR qr_code = '';

UPDATE product_variants
SET sku = 'SKU-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8))
WHERE sku IS NULL OR sku = '';

UPDATE product_variants
SET barcode = 'BC' || LPAD(FLOOR(RANDOM() * 9000000000 + 1000000000)::BIGINT::TEXT, 10, '0')
WHERE barcode IS NULL OR barcode = '';

UPDATE product_variants
SET qr_code = 'QR' || UPPER(SUBSTRING(MD5(id::TEXT || RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 12))
WHERE qr_code IS NULL OR qr_code = '';
