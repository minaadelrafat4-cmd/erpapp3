/*
# Product Search — SKU & Name Lookup Indexes

## Overview
The Admin Panel, Inventory, and product-selection dialogs all search products
by SKU and/or product name. That search has always run as a substring match
(`ILIKE '%term%'`-equivalent) against `products.name` and `products.sku`.

Today those searches are executed client-side against an already-loaded
result set, so this migration does not change any application behavior by
itself. It exists to make the same SKU/name search fast at the database
level as the catalog grows and as more of the app's product search moves to
(or is queried directly via) Supabase — without requiring any further
migration when that happens.

A plain B-tree index (like the existing `sku` UNIQUE constraint already
provides) only accelerates exact-match and prefix lookups. It cannot speed
up a "contains" search such as matching SKU "VP-5MG-002" against the query
"5mg". Trigram (pg_trgm) GIN indexes are the standard Postgres solution for
fast ILIKE '%term%' search on text columns, so this migration adds one for
`name` and one for `sku`. It also adds plain lower(...) B-tree indexes,
which speed up exact case-insensitive lookups (e.g. scanning a full SKU)
without the overhead of a trigram index.

## Safety
- Purely additive: no table, column, trigger, or existing index is dropped
  or altered. No data is modified.
- `pg_trgm` is a standard, widely-used Postgres extension (bundled with
  Supabase/Postgres) — enabling it does not affect any existing query.
- All index creation is wrapped in `IF NOT EXISTS`, so this migration is
  safe to re-run.
- Index creation only adds storage and a small write-time cost on
  `products` INSERT/UPDATE; it does not change read results, RLS behavior,
  or any existing query's output — only how fast a SKU/name search *can* be
  once one is written to use it.
- Barcode and QR code columns are intentionally NOT indexed here — that
  functionality is explicitly out of scope for this change.
*/

-- 1. Enable trigram support for fast partial/"contains" text search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Trigram indexes for ILIKE '%term%' search on product name and SKU.
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON products USING gin (sku gin_trgm_ops);

-- 3. Case-insensitive B-tree indexes for fast exact/prefix SKU & name lookups
--    (e.g. a staff member scanning or typing a full SKU).
CREATE INDEX IF NOT EXISTS idx_products_sku_lower ON products (lower(sku));
CREATE INDEX IF NOT EXISTS idx_products_name_lower ON products (lower(name));