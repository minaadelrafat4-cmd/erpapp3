import { Link, Navigate } from 'react-router-dom';
import { Heart, Trash2, ShoppingBag } from 'lucide-react';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Card';
import { productImage } from '@/lib/images';
import { formatCurrency } from '@/lib/utils';

export default function Wishlist() {
  const { items, products, loading, toggle } = useWishlist();
  const { add } = useCart();
  const { toast } = useToast();

  if (loading) return <div className="section py-10"><div className="grid grid-cols-2 lg:grid-cols-4 gap-5">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-96"/>)}</div></div>;

  return (
    <div className="section py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ink-50">Your Wishlist</h1>
          <p className="text-ink-400 mt-1">{items.length} saved item{items.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/shop"><Button variant="secondary">Continue Shopping</Button></Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Heart className="w-12 h-12" />}
          title="Your wishlist is empty"
          description="Save items you love to find them quickly later."
          action={<Link to="/shop"><Button>Browse Products</Button></Link>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => {
            const p = products[item.product_id];
            if (!p) return null;
            return (
              <div key={item.id} className="glass-card overflow-hidden flex flex-col">
                <Link to={`/product/${p.slug}`} className="block aspect-square overflow-hidden bg-ink-800">
                  <img src={productImage(p.id + p.slug)} alt={p.name} className="w-full h-full object-cover hover:scale-105 transition" />
                </Link>
                <div className="p-5 flex flex-col flex-1">
                  <Link to={`/product/${p.slug}`}><h3 className="font-semibold text-ink-50 hover:text-gold-300 transition line-clamp-2">{p.name}</h3></Link>
                  <span className="text-lg font-bold text-gold-300 mt-2">{formatCurrency(p.price)}</span>
                  <div className="mt-4 flex gap-2">
                    <Button onClick={() => { add(p); toast('Added to cart', 'success'); }} className="flex-1" size="sm"><ShoppingBag className="w-4 h-4" /> Add</Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(p)} aria-label="Remove"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
