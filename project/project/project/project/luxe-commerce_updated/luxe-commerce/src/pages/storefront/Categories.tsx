import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCategories } from '@/hooks/useCatalog';
import { SectionHeading, Skeleton, EmptyState } from '@/components/ui/Card';
import { productImage } from '@/lib/images';

export default function Categories() {
  const { categories, loading } = useCategories();

  return (
    <div className="section py-10">
      <SectionHeading eyebrow="Browse" title="All Categories" subtitle="Explore our curated departments — from devices to e-liquids and accessories." center />
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-56"/>)}</div>
      ) : categories.length === 0 ? (
        <EmptyState title="Categories coming soon" description="We're curating our departments. Check back shortly." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((c) => (
            <Link key={c.id} to={`/shop?category=${c.slug}`} className="group glass-card overflow-hidden card-hover flex flex-col">
              <div className="aspect-[16/10] overflow-hidden bg-ink-800 relative">
                <img src={c.image_url || productImage(c.id)} alt={c.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="text-lg font-display font-semibold text-ink-50 group-hover:text-gold-300 transition">{c.name}</h3>
                {c.description && <p className="mt-1.5 text-sm text-ink-400 line-clamp-2 flex-1">{c.description}</p>}
                <span className="mt-4 text-sm text-gold-300 flex items-center gap-1 group-hover:gap-2 transition-all">Shop now <ArrowRight className="w-4 h-4" /></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
