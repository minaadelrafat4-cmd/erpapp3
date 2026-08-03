import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, Minus, Plus, Star, Truck, ShieldCheck, RotateCcw, ChevronRight, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, ProductVariant, ProductImage, ProductReview } from '@/types';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Badge, Skeleton, EmptyState } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/StarRating';
import { Textarea, Input } from '@/components/ui/Input';
import { productImage } from '@/lib/images';
import { SmartImage } from '@/components/ui/SmartImage';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ProductCard } from '@/components/storefront/ProductCard';
import { BarcodeImage } from '@/components/admin/BarcodeImage';
import { QrCodeImage } from '@/components/admin/QrCodeImage';

export default function ProductDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const { user } = useAuth();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [tab, setTab] = useState<'description' | 'specs' | 'reviews'>('description');
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', body: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from('products').select('*').eq('slug', slug).maybeSingle();
      const p = data as Product | null;
      setProduct(p);
      if (p) {
        const [v, imgs, revs] = await Promise.all([
          supabase.from('product_variants').select('*').eq('product_id', p.id).order('name'),
          supabase.from('product_images').select('*').eq('product_id', p.id).order('sort_order'),
          supabase.from('product_reviews').select('*').eq('product_id', p.id).eq('is_approved', true).order('created_at', { ascending: false }),
        ]);
        setVariants((v.data ?? []) as ProductVariant[]);
        setImages((imgs.data ?? []) as ProductImage[]);
        setReviews((revs.data ?? []) as ProductReview[]);
        if (user) {
          await supabase.from('recently_viewed').insert({ user_id: user.id, product_id: p.id });
        }
        const { data: rel } = await supabase.from('products').select('*').eq('category_id', p.category_id ?? '').neq('id', p.id).eq('is_active', true).limit(4);
        setRelated((rel ?? []) as Product[]);
        setActiveImage(0);
        setQty(1);
        setSelectedVariant(null);
      }
      setLoading(false);
    })();
  }, [slug, user?.id]);

  if (loading) return <div className="section py-10"><div className="grid lg:grid-cols-2 gap-10"><Skeleton className="aspect-square" /><div className="space-y-4"><Skeleton className="h-10" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-24" /><Skeleton className="h-12" /></div></div></div>;
  if (!product) return <div className="section py-20"><EmptyState title="Product not found" action={<Button onClick={() => navigate('/shop')}>Back to shop</Button>} /></div>;

  const gallery = images.length ? images : [{ id: 'p', product_id: product.id, url: productImage(product.id + product.slug), alt: product.name, sort_order: 0, created_at: '' }];
  const price = selectedVariant?.price ?? product.price;
  const inWishlist = has(product.id);
  const discount = product.compare_at_price && product.compare_at_price > price ? Math.round((1 - price / product.compare_at_price) * 100) : 0;

  const addToCart = async () => {
    await add(product, selectedVariant, qty);
    toast('Added to cart', 'success');
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast('Please sign in to leave a review', 'info'); navigate('/signin'); return; }
    setSubmitting(true);
    const { data } = await supabase.from('product_reviews').insert({
      product_id: product.id, user_id: user.id, rating: reviewForm.rating, title: reviewForm.title, body: reviewForm.body,
    }).select('*').single();
    setSubmitting(false);
    if (data) {
      setReviewForm({ rating: 5, title: '', body: '' });
      toast('Review submitted — pending approval', 'success');
    } else {
      toast('Could not submit review', 'error');
    }
  };

  return (
    <div className="section py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
        <Link to="/" className="hover:text-gold-300">Home</Link><ChevronRight className="w-3 h-3" />
        <Link to="/shop" className="hover:text-gold-300">Shop</Link><ChevronRight className="w-3 h-3" />
        <span className="text-ink-200 truncate">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Gallery */}
        <div>
          <div className="glass-card overflow-hidden aspect-square mb-4">
            <SmartImage src={gallery[activeImage]?.url ?? ''} alt={gallery[activeImage]?.alt ?? product.name} aspect="w-full h-full" eager className="w-full h-full object-cover" />
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {gallery.map((img, i) => (
                <button key={img.id} onClick={() => setActiveImage(i)} className={`aspect-square rounded-lg overflow-hidden border-2 transition ${i === activeImage ? 'border-gold-400' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                  <SmartImage src={img.url} alt={img.alt ?? product.name} aspect="w-full h-full" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {product.is_new_arrival && <Badge color="accent">New Arrival</Badge>}
            {product.is_best_seller && <Badge color="gold">Best Seller</Badge>}
            {product.is_flash_sale && <Badge color="warning">Flash Sale</Badge>}
            {discount > 0 && <Badge color="error">-{discount}% OFF</Badge>}
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-ink-50 leading-tight">{product.name}</h1>
          <div className="mt-3 flex items-center gap-3">
            <StarRating value={product.rating} size={18} />
            <span className="text-sm text-ink-400">{product.rating.toFixed(1)} · {product.review_count} reviews</span>
          </div>
          {product.short_description && <p className="mt-4 text-ink-300">{product.short_description}</p>}

          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-gold-300">{formatCurrency(price)}</span>
            {product.compare_at_price && product.compare_at_price > price && (
              <span className="text-lg text-ink-400 line-through">{formatCurrency(product.compare_at_price)}</span>
            )}
          </div>

          {/* Variants */}
          {variants.length > 0 && (
            <div className="mt-6">
              <p className="label">Select {variants[0]?.name || 'variant'}</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-4 py-2 rounded-xl border text-sm transition ${selectedVariant?.id === v.id ? 'border-gold-400 bg-gold-500/10 text-gold-300' : 'border-white/10 bg-white/5 text-ink-200 hover:border-white/20'}`}
                  >
                    {v.value} {v.price > product.price && <span className="text-xs text-ink-400">+{formatCurrency(v.price - product.price)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Qty + add */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center glass rounded-xl">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-3 text-ink-300 hover:text-gold-300" aria-label="Decrease"><Minus className="w-4 h-4" /></button>
              <span className="w-10 text-center font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="p-3 text-ink-300 hover:text-gold-300" aria-label="Increase"><Plus className="w-4 h-4" /></button>
            </div>
            <Button onClick={addToCart} size="lg" className="flex-1" disabled={product.stock <= 0}>
              <ShoppingBag className="w-5 h-5" /> {product.stock > 0 ? 'Add to Cart' : 'Sold Out'}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => toggle(product)} className={inWishlist ? 'text-error-500' : ''} aria-label="Wishlist">
              <Heart className="w-5 h-5" fill={inWishlist ? 'currentColor' : 'none'} />
            </Button>
          </div>

          {product.stock <= 5 && product.stock > 0 && (
            <p className="mt-3 text-sm text-warning-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning-400 animate-pulse" /> Only {product.stock} left in stock</p>
          )}

          {/* Trust */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[{ icon: Truck, t: 'Free shipping over $75' }, { icon: ShieldCheck, t: 'Authenticity guaranteed' }, { icon: RotateCcw, t: '30-day returns' }].map((f, i) => (
              <div key={i} className="glass rounded-xl p-3 text-center">
                <f.icon className="w-5 h-5 text-gold-400 mx-auto mb-1.5" />
                <p className="text-xs text-ink-300">{f.t}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-12">
        <div className="flex gap-1 border-b border-white/10 mb-6 overflow-x-auto no-scrollbar">
          {([['description', 'Description'], ['specs', 'Specifications'], ['reviews', `Reviews (${reviews.length})`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-5 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${tab === k ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-100'}`}>{label}</button>
          ))}
        </div>

        {tab === 'description' && (
          <div className="prose prose-invert max-w-none text-ink-300 leading-relaxed">
            <p>{product.description || product.short_description || 'Detailed product description coming soon.'}</p>
          </div>
        )}
        {tab === 'specs' && (
          <div className="max-w-2xl">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ['SKU', product.sku ?? '—'],
                ['Barcode', product.barcode ?? '—'],
                ['Nicotine strength', product.nicotine_strength ?? '—'],
                ['Weight', product.weight ? `${product.weight}g` : '—'],
                ['Stock', String(product.stock)],
                ['Tags', product.tags.join(', ') || '—'],
              ].map(([k, v]) => (
                <div key={k} className="glass rounded-xl px-4 py-3 flex justify-between">
                  <span className="text-ink-400 text-sm">{k}</span>
                  <span className="text-ink-100 text-sm font-medium">{v}</span>
                </div>
              ))}
            </div>
            {(product.barcode || product.qr_code) && (
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                {product.barcode && (
                  <div className="glass rounded-xl p-4 flex flex-col items-center gap-2">
                    <p className="text-xs text-ink-400 self-start">Barcode</p>
                    <BarcodeImage value={product.barcode} />
                  </div>
                )}
                {product.qr_code && (
                  <div className="glass rounded-xl p-4 flex flex-col items-center gap-2">
                    <p className="text-xs text-ink-400 self-start">QR Code</p>
                    <QrCodeImage value={product.qr_code} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {tab === 'reviews' && (
          <div className="grid lg:grid-cols-[1fr_360px] gap-8">
            <div>
              {reviews.length === 0 ? (
                <EmptyState title="No reviews yet" description="Be the first to share your experience." />
              ) : (
                <div className="space-y-4">
                  {reviews.map((r) => (
                    <div key={r.id} className="glass-card p-5">
                      <div className="flex items-center justify-between mb-2">
                        <StarRating value={r.rating} size={14} />
                        <span className="text-xs text-ink-500">{formatDate(r.created_at)}</span>
                      </div>
                      {r.title && <h4 className="font-semibold text-ink-100">{r.title}</h4>}
                      <p className="text-sm text-ink-300 mt-1">{r.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="glass-card p-6 h-fit">
              <h4 className="font-semibold text-ink-50 mb-4">Write a Review</h4>
              <form onSubmit={submitReview} className="space-y-4">
                <div>
                  <label className="label">Rating</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((n) => (
                      <button key={n} type="button" onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}>
                        <Star className={`w-6 h-6 ${n <= reviewForm.rating ? 'text-gold-400' : 'text-ink-600'}`} fill={n <= reviewForm.rating ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>
                <Input label="Title" value={reviewForm.title} onChange={(e) => setReviewForm((f) => ({ ...f, title: e.target.value }))} />
                <Textarea label="Your review" value={reviewForm.body} onChange={(e) => setReviewForm((f) => ({ ...f, body: e.target.value }))} />
                <Button type="submit" disabled={submitting} className="w-full">{submitting ? 'Submitting…' : 'Submit Review'}</Button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-display font-semibold text-ink-50 mb-6">You may also like</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}
