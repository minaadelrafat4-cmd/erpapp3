import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { useProducts, useCategories, useBrands } from '@/hooks/useCatalog';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState, SectionHeading, Skeleton } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const { categories } = useCategories();
  const { brands } = useBrands();

  const filter = params.get('filter') ?? '';
  const categorySlug = params.get('category') ?? '';
  const brandSlug = params.get('brand') ?? '';
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const minPrice = params.get('min') ?? '';
  const maxPrice = params.get('max') ?? '';

  const categoryId = useMemo(() => categories.find((c) => c.slug === categorySlug)?.id, [categories, categorySlug]);
  const brandId = useMemo(() => brands.find((b) => b.slug === brandSlug)?.id, [brands, brandSlug]);

  const opts = useMemo(() => ({
    featured: filter === 'featured',
    bestSeller: filter === 'bestseller',
    newArrival: filter === 'new',
    flashSale: filter === 'sale',
    categoryId,
    brandId,
    search: q,
  }), [filter, categoryId, brandId, q]);

  const { products, loading } = useProducts(opts);

  const sorted = useMemo(() => {
    const arr = [...products];
    if (sort === 'price_asc') arr.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') arr.sort((a, b) => b.price - a.price);
    else if (sort === 'rating') arr.sort((a, b) => b.rating - a.rating);
    return arr;
  }, [products, sort]);

  const filtered = useMemo(() => {
    return sorted.filter((p) => {
      if (minPrice && p.price < parseFloat(minPrice)) return false;
      if (maxPrice && p.price > parseFloat(maxPrice)) return false;
      return true;
    });
  }, [sorted, minPrice, maxPrice]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  const [mobileFilters, setMobileFilters] = useState(false);

  return (
    <div className="section py-10">
      <SectionHeading eyebrow="Collection" title="Shop All Products" subtitle="Browse our complete catalog of premium vape & smoking essentials." />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button variant="secondary" size="sm" onClick={() => setMobileFilters(true)} className="lg:hidden">
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </Button>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { k: 'filter', v: '', label: 'All' },
            { k: 'filter', v: 'new', label: 'New' },
            { k: 'filter', v: 'bestseller', label: 'Best Sellers' },
            { k: 'filter', v: 'featured', label: 'Featured' },
            { k: 'filter', v: 'sale', label: 'Flash Sale' },
          ].map((f) => (
            <button
              key={f.label}
              onClick={() => setParam('filter', f.v)}
              className={`chip border whitespace-nowrap ${filter === f.v ? 'bg-gold-sheen text-ink-950 border-transparent' : 'bg-white/5 text-ink-300 border-white/10 hover:bg-white/10'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={sort} onChange={(e) => setParam('sort', e.target.value)} className="w-auto py-2 text-sm">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-8">
        <aside className={`${mobileFilters ? 'fixed inset-0 z-50 p-4 bg-ink-950/95 backdrop-blur overflow-auto' : 'hidden'} lg:block lg:sticky lg:top-24 lg:h-fit`}>
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <h3 className="text-lg font-semibold">Filters</h3>
            <button onClick={() => setMobileFilters(false)}><X className="w-5 h-5" /></button>
          </div>
          <FilterGroup title="Category">
            <button onClick={() => setParam('category', '')} className={`block w-full text-left text-sm py-1.5 ${!categorySlug ? 'text-gold-300' : 'text-ink-300 hover:text-ink-100'}`}>All categories</button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setParam('category', c.slug)} className={`block w-full text-left text-sm py-1.5 ${categorySlug === c.slug ? 'text-gold-300' : 'text-ink-300 hover:text-ink-100'}`}>{c.name}</button>
            ))}
          </FilterGroup>
          <FilterGroup title="Brand">
            <button onClick={() => setParam('brand', '')} className={`block w-full text-left text-sm py-1.5 ${!brandSlug ? 'text-gold-300' : 'text-ink-300 hover:text-ink-100'}`}>All brands</button>
            {brands.map((b) => (
              <button key={b.id} onClick={() => setParam('brand', b.slug)} className={`block w-full text-left text-sm py-1.5 ${brandSlug === b.slug ? 'text-gold-300' : 'text-ink-300 hover:text-ink-100'}`}>{b.name}</button>
            ))}
          </FilterGroup>
          <FilterGroup title="Price">
            <div className="flex items-center gap-2">
              <input type="number" placeholder="Min" value={minPrice} onChange={(e) => setParam('min', e.target.value)} className="input py-2 text-sm" />
              <span className="text-ink-500">—</span>
              <input type="number" placeholder="Max" value={maxPrice} onChange={(e) => setParam('max', e.target.value)} className="input py-2 text-sm" />
            </div>
          </FilterGroup>
        </aside>

        <div>
          <p className="text-sm text-ink-400 mb-4">{loading ? 'Loading…' : `${filtered.length} products`}</p>
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{Array.from({length: 8}).map((_,i)=><Skeleton key={i} className="h-96"/>)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No products match your filters" description="Try adjusting or clearing filters." action={<Button onClick={() => setParams(new URLSearchParams())}>Clear filters</Button>} />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-white/10 py-4">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center justify-between w-full mb-3">
        <h4 className="text-sm font-semibold text-ink-100 uppercase tracking-wider">{title}</h4>
        <ChevronDown className={`w-4 h-4 text-ink-400 transition ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  );
}
