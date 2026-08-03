import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Truck, ShieldCheck, RotateCcw, Headphones, Star, Zap, TrendingUp, Clock } from 'lucide-react';
import { useProducts, useCategories, useBrands, useBlogPosts } from '@/hooks/useCatalog';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Button } from '@/components/ui/Button';
import { Badge, SectionHeading, Skeleton, EmptyState } from '@/components/ui/Card';
import { SmartImage } from '@/components/ui/SmartImage';
import { heroImage, promoImage, blogImage, resolveImage, categoryImage } from '@/lib/images';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { formatCurrency } from '@/lib/utils';
import { useEffect, useState } from 'react';

export default function Home() {
  const { products: featured, loading: lf } = useProducts({ featured: true, limit: 8 });
  const { products: bestSellers, loading: lb } = useProducts({ bestSeller: true, limit: 4 });
  const { products: newArrivals, loading: ln } = useProducts({ newArrival: true, limit: 4 });
  const { products: flash, loading: lfl } = useProducts({ flashSale: true, limit: 4 });
  const { categories, loading: lc } = useCategories();
  const { brands, loading: lbr } = useBrands();
  const { posts, loading: lbp } = useBlogPosts(3);
  const { get } = useSiteSettings();

  const heroBadge = get('hero_badge', 'New Season Collection');
  const heroTitle = get('hero_title', 'The Art of Fine Smoking');
  const heroSubtitle = get('hero_subtitle', 'Discover a curated collection of premium vape devices, artisan e-liquids, and refined smoking accessories — engineered for the discerning connoisseur.');
  const heroImg = resolveImage(get('hero_image_url'), heroImage(0));

  const editorialBadge = get('editorial_badge', 'The LUXE Standard');
  const editorialTitle = get('editorial_title', 'Crafted for those who refuse ordinary');
  const editorialBody = get('editorial_body', 'Every product in our collection is hand-selected by our experts and backed by our authenticity guarantee. No compromises. No counterfeits.');
  const editorialImg = resolveImage(get('editorial_image_url'), promoImage(0));

  const ctaTitle = get('cta_title', 'Become a LUXE Member');
  const ctaBody = get('cta_body', 'Join thousands of members enjoying exclusive pricing, early access, and rewards on every purchase.');

  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[88vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <SmartImage src={heroImg} alt="" aspect="absolute inset-0 w-full h-full" eager className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/40" />
        </div>
        <div className="relative section py-24">
          <div className="max-w-2xl animate-fade-up">
            <Badge color="gold" className="mb-5"><Sparkles className="w-3 h-3" /> {heroBadge}</Badge>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-ink-50 leading-[1.05] text-balance">
              {heroTitle.split(' ').slice(0, -2).join(' ')} <span className="text-gradient-gold">{heroTitle.split(' ').slice(-2).join(' ')}</span>
            </h1>
            <p className="mt-6 text-lg text-ink-300 max-w-xl">
              {heroSubtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/shop"><Button size="lg">Shop Collection <ArrowRight className="w-4 h-4" /></Button></Link>
              <Link to="/categories"><Button size="lg" variant="secondary">Browse Categories</Button></Link>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm text-ink-400">
              <div className="flex items-center gap-2"><div className="flex">{Array.from({length:5}).map((_,i)=><Star key={i} className="w-4 h-4 text-gold-400" fill="currentColor"/>)}</div><span>4.9 · 12k+ reviews</span></div>
              <div className="hidden sm:flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent-400" /> Authentic guarantee</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="section -mt-8 relative z-10">
        <div className="glass-card grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
          {[
            { icon: Truck, title: 'Free Shipping', desc: 'On orders over $75' },
            { icon: ShieldCheck, title: 'Authentic', desc: '100% genuine products' },
            { icon: RotateCcw, title: 'Easy Returns', desc: '30-day return policy' },
            { icon: Headphones, title: '24/7 Support', desc: 'Dedicated concierge' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-5">
              <div className="w-11 h-11 rounded-xl bg-gold-500/10 flex items-center justify-center text-gold-400 shrink-0">
                <f.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-100">{f.title}</p>
                <p className="text-xs text-ink-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="section py-20">
        <SectionHeading eyebrow="Explore" title="Shop by Category" subtitle="Find exactly what you're looking for across our curated departments." center />
        {lc ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState title="Categories coming soon" description="We're curating our departments. Check back shortly." />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((c) => (
              <Link key={c.id} to={`/shop?category=${c.slug}`} className="group glass-card overflow-hidden card-hover aspect-square relative flex flex-col justify-end p-4">
                <SmartImage src={resolveImage(c.image_url, categoryImage(c.slug))} alt={c.name} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 to-transparent" />
                <div className="relative">
                  <p className="font-display text-lg font-semibold text-ink-50 group-hover:text-gold-300 transition">{c.name}</p>
                  <p className="text-xs text-ink-400 mt-0.5">Explore →</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Featured */}
      <section className="section py-12">
        <div className="flex items-end justify-between mb-8">
          <SectionHeading eyebrow="Handpicked" title="Featured Products" />
          <Link to="/shop?filter=featured" className="text-sm text-gold-300 hover:text-gold-200 link-underline hidden md:inline">View all →</Link>
        </div>
        <ProductGrid products={featured} loading={lf} />
      </section>

      {/* Flash sale */}
      {flash.length > 0 && (
        <section className="section py-12">
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-warning-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-warning-500/20 flex items-center justify-center text-warning-400 animate-pulse">
                  <Zap className="w-5 h-5" fill="currentColor" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-semibold text-ink-50">Flash Sale</h3>
                  <p className="text-xs text-ink-400">Limited time — while stock lasts</p>
                </div>
              </div>
              <FlashCountdown />
            </div>
            <div className="p-6">
              <ProductGrid products={flash} loading={lfl} cols={4} />
            </div>
          </div>
        </section>
      )}

      {/* Best sellers + New arrivals split */}
      <section className="section py-12 grid lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-gold-400" />
            <h3 className="text-2xl font-display font-semibold text-ink-50">Best Sellers</h3>
          </div>
          <ProductGrid products={bestSellers} loading={lb} cols={2} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-accent-400" />
            <h3 className="text-2xl font-display font-semibold text-ink-50">New Arrivals</h3>
          </div>
          <ProductGrid products={newArrivals} loading={ln} cols={2} />
        </div>
      </section>

      {/* Brands */}
      <section className="section py-12">
        <SectionHeading eyebrow="Trusted names" title="Our Brands" subtitle="We partner with the world's most respected manufacturers." center />
        {lbr ? (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-20"/>)}</div>
        ) : brands.length === 0 ? (
          <EmptyState title="Brands coming soon" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {brands.slice(0, 12).map((b) => (
              <Link key={b.id} to={`/brands/${b.slug}`} className="glass-card h-20 flex items-center justify-center text-center p-4 hover:border-gold-400/40 transition group">
                <span className="font-display font-semibold text-ink-200 group-hover:text-gold-300 transition">{b.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Editorial banner */}
      <section className="section py-20">
        <div className="relative glass-card overflow-hidden min-h-[420px] flex items-center">
          <div className="absolute inset-0">
            <SmartImage src={editorialImg} alt="" className="w-full h-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink-950 to-transparent" />
          </div>
          <div className="relative p-10 md:p-16 max-w-xl">
            <Badge color="gold" className="mb-4">{editorialBadge}</Badge>
            <h2 className="text-3xl md:text-5xl font-display font-semibold text-ink-50 leading-tight text-balance">
              {editorialTitle}
            </h2>
            <p className="mt-4 text-ink-300">{editorialBody}</p>
            <Link to="/about" className="mt-6 inline-block"><Button variant="outline">Our Story <ArrowRight className="w-4 h-4" /></Button></Link>
          </div>
        </div>
      </section>

      {/* Blog */}
      <section className="section py-12">
        <div className="flex items-end justify-between mb-8">
          <SectionHeading eyebrow="Journal" title="From the Blog" />
          <Link to="/blog" className="text-sm text-gold-300 hover:text-gold-200 link-underline hidden md:inline">All articles →</Link>
        </div>
        {lbp ? (
          <div className="grid md:grid-cols-3 gap-6">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-72"/>)}</div>
        ) : posts.length === 0 ? (
          <EmptyState title="Articles coming soon" />
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {posts.map((p) => (
              <Link key={p.id} to={`/blog/${p.slug}`} className="group glass-card overflow-hidden card-hover flex flex-col">
                <SmartImage src={resolveImage(p.cover_image_url, blogImage(p.slug))} alt={p.title} aspect="aspect-[16/10]" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="p-5 flex flex-col flex-1">
                  <p className="text-xs text-gold-400 uppercase tracking-wider mb-2">{p.author ?? 'LUXE Editorial'}</p>
                  <h3 className="font-semibold text-ink-50 line-clamp-2 group-hover:text-gold-300 transition">{p.title}</h3>
                  <p className="mt-2 text-sm text-ink-400 line-clamp-2 flex-1">{p.excerpt}</p>
                  <p className="mt-4 text-xs text-ink-500">{p.reading_minutes} min read</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="section py-20">
        <div className="glass-card p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-dark-radial" />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-display font-semibold text-ink-50 text-balance">{ctaTitle}</h2>
            <p className="mt-4 text-ink-300 max-w-xl mx-auto">{ctaBody}</p>
            <Link to="/signup" className="mt-8 inline-block"><Button size="lg">Create Free Account <ArrowRight className="w-4 h-4" /></Button></Link>
          </div>
        </div>
      </section>
    </>
  );
}

function ProductGrid({ products, loading, cols = 4 }: { products: import('@/types').Product[]; loading: boolean; cols?: number }) {
  const colsClass = cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
  if (loading) return <div className={`grid grid-cols-1 ${colsClass} gap-5`}>{Array.from({length: cols}).map((_,i)=><Skeleton key={i} className="h-96"/>)}</div>;
  if (products.length === 0) return <EmptyState title="No products found" description="Check back soon as we restock our shelves." />;
  return <div className={`grid grid-cols-1 ${colsClass} gap-5`}>{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>;
}

function FlashCountdown() {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const end = new Date(); end.setHours(23,59,59,999);
    const tick = () => {
      const diff = end.getTime() - Date.now();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 text-warning-400 font-mono font-semibold">
      <Clock className="w-4 h-4" />
      <span className="text-lg">{remaining}</span>
    </div>
  );
}
