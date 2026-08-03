import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Eye } from 'lucide-react';
import type { Product } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useToast } from '@/context/ToastContext';
import { Badge } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/StarRating';
import { SmartImage } from '@/components/ui/SmartImage';
import { productImage } from '@/lib/images';

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const { toast } = useToast();
  const inWishlist = has(product.id);
  const discount = product.compare_at_price && product.compare_at_price > product.price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : 0;

  return (
    <div className="group relative glass-card overflow-hidden card-hover flex flex-col">
      <Link to={`/product/${product.slug}`} className="block relative aspect-square overflow-hidden bg-ink-800">
        <SmartImage
          src={productImageFor(product)}
          alt={product.name}
          aspect="absolute inset-0"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.is_new_arrival && <Badge color="accent">New</Badge>}
          {product.is_best_seller && <Badge color="gold">Best Seller</Badge>}
          {discount > 0 && <Badge color="error">-{discount}%</Badge>}
          {product.is_flash_sale && <Badge color="warning">Flash</Badge>}
        </div>
      </Link>

      <button
        onClick={() => toggle(product)}
        className={`absolute top-3 right-3 p-2 rounded-full glass transition hover:scale-110 ${inWishlist ? 'text-error-500' : 'text-ink-200'}`}
        aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart className="w-4 h-4" fill={inWishlist ? 'currentColor' : 'none'} />
      </button>

      <div className="p-4 flex flex-col flex-1">
        <p className="text-xs text-gold-400 uppercase tracking-wider mb-1">{product.nicotine_strength ?? 'Premium'}</p>
        <Link to={`/product/${product.slug}`}>
          <h3 className="font-semibold text-ink-50 line-clamp-2 hover:text-gold-300 transition leading-snug">{product.name}</h3>
        </Link>
        <div className="mt-1.5 flex items-center gap-2">
          <StarRating value={product.rating} size={14} />
          <span className="text-xs text-ink-400">({product.review_count})</span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-gold-300">{formatCurrency(product.price)}</span>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <span className="text-sm text-ink-400 line-through">{formatCurrency(product.compare_at_price)}</span>
            )}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => { add(product); toast('Added to cart', 'success'); }}
            className="btn-primary flex-1 text-sm py-2"
            disabled={product.stock <= 0}
          >
            <ShoppingBag className="w-4 h-4" />
            {product.stock > 0 ? 'Add' : 'Sold out'}
          </button>
          <Link to={`/product/${product.slug}`} className="btn-secondary px-3" aria-label="Quick view">
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function productImageFor(p: Product): string {
  return productImage(p.id + p.slug);
}
