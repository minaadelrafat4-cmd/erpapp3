import { Link } from 'react-router-dom';
import { ArrowRight, Globe } from 'lucide-react';
import { useBrands } from '@/hooks/useCatalog';
import { SectionHeading, Skeleton, EmptyState } from '@/components/ui/Card';

export default function Brands() {
  const { brands, loading } = useBrands();
  return (
    <div className="section py-10">
      <SectionHeading eyebrow="Partners" title="Our Brands" subtitle="We carry the most respected names in the industry — each vetted for authenticity and quality." center />
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-40"/>)}</div>
      ) : brands.length === 0 ? (
        <EmptyState title="Brands coming soon" description="We're finalizing our brand partnerships." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {brands.map((b) => (
            <Link key={b.id} to={`/brands/${b.slug}`} className="group glass-card p-6 card-hover flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-gold-500/10 flex items-center justify-center text-gold-300 font-display font-bold text-xl">
                  {b.name.charAt(0)}
                </div>
                {b.country && (
                  <span className="flex items-center gap-1 text-xs text-ink-400"><Globe className="w-3 h-3" /> {b.country}</span>
                )}
              </div>
              <h3 className="text-xl font-display font-semibold text-ink-50 group-hover:text-gold-300 transition">{b.name}</h3>
              {b.description && <p className="mt-2 text-sm text-ink-400 line-clamp-3 flex-1">{b.description}</p>}
              <span className="mt-4 text-sm text-gold-300 flex items-center gap-1 group-hover:gap-2 transition-all">View products <ArrowRight className="w-4 h-4" /></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
