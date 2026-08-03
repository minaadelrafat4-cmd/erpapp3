import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { productImage } from '@/lib/images';
import { formatCurrency } from '@/lib/utils';

export default function Cart() {
  const { lines, subtotal, updateQty, remove, loading } = useCart();
  const { toast } = useToast();
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);
  const [applying, setApplying] = useState(false);

  const shipping = subtotal >= 75 || subtotal === 0 ? 0 : 9.95;
  const tax = +(subtotal * 0.08).toFixed(2);
  const total = Math.max(0, subtotal - discount) + shipping + tax;

  const applyCoupon = async () => {
    if (!coupon) return;
    setApplying(true);
    const { data } = await supabase.from('coupons').select('*').eq('code', coupon.toUpperCase()).eq('is_active', true).maybeSingle();
    setApplying(false);
    if (!data) { toast('Invalid coupon code', 'error'); return; }
    const d = data.discount_type === 'percentage' ? +(subtotal * (data.discount_value / 100)).toFixed(2) : data.discount_value;
    setDiscount(d);
    toast(`Coupon applied — you saved ${formatCurrency(d)}`, 'success');
  };

  if (loading) return <div className="section py-10"><div className="glass-card h-96 animate-shimmer" /></div>;

  return (
    <div className="section py-10">
      <h1 className="text-3xl font-display font-semibold text-ink-50 mb-8">Shopping Cart</h1>
      {lines.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-12 h-12" />}
          title="Your cart is empty"
          description="Looks like you haven't added anything yet."
          action={<Link to="/shop"><Button>Start Shopping</Button></Link>}
        />
      ) : (
        <div className="grid lg:grid-cols-[1fr_380px] gap-8">
          <div className="space-y-4">
            {lines.map((l) => (
              <div key={l.cart.id} className="glass-card p-4 flex gap-4">
                <Link to={`/product/${l.product.slug}`} className="w-24 h-24 rounded-lg overflow-hidden bg-ink-800 shrink-0">
                  <img src={productImage(l.product.id + l.product.slug)} alt={l.product.name} className="w-full h-full object-cover" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/product/${l.product.slug}`}><h3 className="font-semibold text-ink-50 hover:text-gold-300 transition line-clamp-1">{l.product.name}</h3></Link>
                  {l.variant && <p className="text-sm text-ink-400 mt-0.5">{l.variant.name}: {l.variant.value}</p>}
                  <p className="text-gold-300 font-semibold mt-1">{formatCurrency(l.variant?.price ?? l.product.price)}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center glass rounded-lg">
                      <button onClick={() => updateQty(l.cart.id, l.cart.quantity - 1)} className="p-2 text-ink-300 hover:text-gold-300" aria-label="Decrease"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="w-8 text-center text-sm">{l.cart.quantity}</span>
                      <button onClick={() => updateQty(l.cart.id, l.cart.quantity + 1)} className="p-2 text-ink-300 hover:text-gold-300" aria-label="Increase"><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                    <button onClick={() => remove(l.cart.id)} className="text-ink-400 hover:text-error-500 transition" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-ink-50">{formatCurrency((l.variant?.price ?? l.product.price) * l.cart.quantity)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="glass-card p-6 h-fit lg:sticky lg:top-24">
            <h3 className="text-lg font-semibold text-ink-50 mb-4">Order Summary</h3>
            <div className="flex gap-2 mb-4">
              <Input placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} className="text-sm" />
              <Button variant="secondary" onClick={applyCoupon} disabled={applying} size="sm"><Tag className="w-4 h-4" /> Apply</Button>
            </div>
            <div className="space-y-2.5 text-sm">
              <Row label="Subtotal" value={formatCurrency(subtotal)} />
              {discount > 0 && <Row label="Discount" value={`-${formatCurrency(discount)}`} accent />}
              <Row label="Shipping" value={shipping === 0 ? 'Free' : formatCurrency(shipping)} />
              <Row label="Tax (8%)" value={formatCurrency(tax)} />
              <div className="pt-3 border-t border-white/10 flex justify-between text-base font-semibold">
                <span className="text-ink-100">Total</span>
                <span className="text-gold-300">{formatCurrency(total)}</span>
              </div>
            </div>
            <Link to="/checkout"><Button className="w-full mt-6" size="lg">Checkout <ArrowRight className="w-4 h-4" /></Button></Link>
            <Link to="/shop" className="block text-center mt-3 text-sm text-ink-400 hover:text-gold-300">Continue shopping</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-400">{label}</span>
      <span className={accent ? 'text-accent-400' : 'text-ink-100'}>{value}</span>
    </div>
  );
}
