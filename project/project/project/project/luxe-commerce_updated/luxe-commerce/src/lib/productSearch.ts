import { normalizeSearchTerm } from '@/lib/utils';

/**
 * Minimal shape needed to search a product — deliberately narrow so this
 * works against full `Product` rows as well as lighter product-ish records
 * (e.g. inventory rows carrying an embedded `product`).
 *
 * Only `name` and `sku` are considered, by design: barcode/QR matching is
 * out of scope here (see AdminProducts / ProductIdentifiers for that).
 */
export interface SearchableProduct {
  name?: string | null;
  sku?: string | null;
}

/**
 * Does this product match a free-text search query by SKU and/or name?
 *
 * The query is split into whitespace-separated tokens and every token must
 * appear somewhere in the combined "name + sku" text (order-independent,
 * case-insensitive). This means a query like "mango 5mg" matches a product
 * named "Mango Ice" with SKU "VP-5MG-002", even though neither field alone
 * contains the full query string.
 *
 * A blank/whitespace-only query matches everything, matching the previous
 * "no filter applied" behavior when the search box is empty.
 */
export function matchesProductQuery(product: SearchableProduct, query: string): boolean {
  const q = normalizeSearchTerm(query);
  if (!q) return true;
  const haystack = `${product.name ?? ''} ${product.sku ?? ''}`.toLowerCase();
  return q.split(' ').every((token) => haystack.includes(token));
}

/**
 * Ranks a match for sorting: exact SKU match first, then SKU/name prefix
 * matches, then any other substring match. Lower is better.
 */
function rankProductMatch(product: SearchableProduct, q: string): number {
  const sku = (product.sku ?? '').toLowerCase();
  const name = (product.name ?? '').toLowerCase();
  if (sku === q) return 0;
  if (sku.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (sku.includes(q)) return 3;
  return 4;
}

/**
 * Filters a list of products by SKU/name against a free-text query, and —
 * only when a query is actually present — sorts the matches so the most
 * relevant results (exact/prefix SKU or name matches) surface first.
 *
 * With an empty query, the input order is preserved unchanged (so pages
 * that rely on their existing default ordering, e.g. "newest first", keep
 * that ordering when the search box is empty, exactly as before).
 */
export function searchProducts<T extends SearchableProduct>(products: T[], query: string): T[] {
  const q = normalizeSearchTerm(query);
  if (!q) return products;
  return products
    .filter((p) => matchesProductQuery(p, q))
    .sort((a, b) => rankProductMatch(a, q) - rankProductMatch(b, q));
}
