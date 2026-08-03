import { useSearchParams } from 'react-router-dom';
import { useProducts } from '@/hooks/useCatalog';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Input } from '@/components/ui/Input';
import { SectionHeading, Skeleton, EmptyState } from '@/components/ui/Card';
import { Search as SearchIcon } from 'lucide-react';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const { products, loading } = useProducts({ search: q });

  return (
    <div className="section py-10">
      <SectionHeading eyebrow="Search" title={q ? `Results for "${q}"` : 'Search'} subtitle="Find exactly what you're looking for across our entire catalog." />
      <form onSubmit={(e) => e.preventDefault()} className="max-w-xl mb-8">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {})}
            placeholder="Search products…"
            className="input pl-12"
          />
        </div>
      </form>
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-96"/>)}</div>
      ) : products.length === 0 ? (
        <EmptyState title={q ? `No results for "${q}"` : 'Start typing to search'} description={q ? 'Try different keywords or browse our categories.' : undefined} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
