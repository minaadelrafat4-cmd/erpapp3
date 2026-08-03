import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Lock, Check, Truck } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { productImage } from '@/lib/images';

export default function Checkout() {
  const { lines, subtotal, clear } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<'info' | 'payment' | 'done'>('info');
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [form, setForm] = useState({
    email: user?.email ?? '', first: '', last: '', address: '', city: '', state: '', zip: '', country: 'United States',
    card: '', expiry: '', cvc: '',
  });

  const shipping = subtotal >= 75 ? 0 : 9.95;
  const tax = +(subtotal * 0.08).toFixed(2);
  const total = subtotal + shipping + tax;

  const validateInfo = (): boolean => {
    if (!form.email || !form.first || !form.last || !form.address || !form.city || !form.state || !form.zip) {
      toast('Please fill in all required fields', 'error');
      return false;
    }
    return true;
  };

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const items = lines.map((l) => ({
        product_id: l.product.id,
        quantity: l.cart.quantity,
      }));
      const shippingAddress = {
        line1: form.address, city: form.city, state: form.state, zip: form.zip,
        country: form.country, name: `${form.first} ${form.last}`,
      };
      const { data, error } = await supabase.rpc('place_customer_order', {
        p_user_id: user?.id ?? null,
        p_items: items as unknown as never,
        p_shipping_address: shippingAddress as unknown as never,
      });
      if (error) throw error;
      await clear();
      setOrderId((data as { order_number: string })?.order_number ?? '');
      setStep('done');
    } catch {
      toast('Could not place order. Please try again.', 'error');
    } finally {
      setPlacing(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="section py-20">
        <div className="glass-card max-w-lg mx-auto p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-5">
            <Check className="w-8 h-8 text-accent-400" />
          </div>
          <h1 className="text-3xl font-display font-semibold text-ink-50 mb-2">Order Confirmed</h1>
          <p className="text-ink-300 mb-1">Thank you, {form.first || 'friend'}! Your order has been placed.</p>
          <p className="text-gold-300 font-mono text-lg mb-6">{orderId}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/track-order')}><Truck className="w-4 h-4" /> Track Order</Button>
            <Link to="/shop"><Button variant="secondary">Continue Shopping</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  if (lines.length === 0) return <div className="section py-20"><EmptyState title="Nothing to checkout" description="Your cart is empty." action={<Link to="/shop"><Button>Browse Products</Button></Link>} /></div>;

  return (
    <div className="section py-10">
      <h1 className="text-3xl font-display font-semibold text-ink-50 mb-8">Checkout</h1>
      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm mb-2">
            <span className={`flex items-center gap-1.5 ${step === 'info' ? 'text-gold-300' : 'text-ink-400'}`}><span className="w-6 h-6 rounded-full bg-gold-500/20 flex items-center justify-center text-xs">1</span> Information</span>
            <span className="text-ink-600">—</span>
            <span className={`flex items-center gap-1.5 ${step === 'payment' ? 'text-gold-300' : 'text-ink-400'}`}><span className="w-6 h-6 rounded-full bg-gold-500/20 flex items-center justify-center text-xs">2</span> Payment</span>
          </div>

          {step === 'info' && (
            <div className="glass-card p-6 space-y-4">
              <h3 className="font-semibold text-ink-50">Contact &amp; Shipping</h3>
              <Input label="Email" type="email" name="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="First name" name="first" value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} required />
                <Input label="Last name" name="last" value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} required />
              </div>
              <Input label="Address" name="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
              <div className="grid sm:grid-cols-3 gap-4">
                <Input label="City" name="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
                <Input label="State" name="state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required />
                <Input label="ZIP" name="zip" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} required />
              </div>
              <Button onClick={() => { if (validateInfo()) setStep('payment'); }} className="w-full">Continue to Payment</Button>
            </div>
          )}

          {step === 'payment' && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-2 text-ink-300 text-sm"><Lock className="w-4 h-4 text-accent-400" /> Secure payment — your data is encrypted</div>
              <h3 className="font-semibold text-ink-50">Payment Details</h3>
              <Input label="Card number" name="card" value={form.card} onChange={(e) => setForm({ ...form, card: e.target.value })} placeholder="4242 4242 4242 4242" required />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Expiry" name="expiry" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} placeholder="MM/YY" required />
                <Input label="CVC" name="cvc" value={form.cvc} onChange={(e) => setForm({ ...form, cvc: e.target.value })} placeholder="123" required />
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep('info')}>Back</Button>
                <Button onClick={placeOrder} disabled={placing} className="flex-1"><CreditCard className="w-4 h-4" /> {placing ? 'Processing…' : `Pay ${formatCurrency(total)}`}</Button>
              </div>
              <p className="text-xs text-ink-500 text-center">Demo checkout — no real payment is processed.</p>
            </div>
          )}
        </div>

        <div className="glass-card p-6 h-fit lg:sticky lg:top-24">
          <h3 className="text-lg font-semibold text-ink-50 mb-4">Order Summary</h3>
          <div className="space-y-3 max-h-64 overflow-auto mb-4">
            {lines.map((l) => (
              <div key={l.cart.id} className="flex gap-3 text-sm">
                <div className="w-12 h-12 rounded-lg bg-ink-800 overflow-hidden shrink-0">
                  <img src={productImage(l.product.id + l.product.slug)} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ink-100 line-clamp-1">{l.product.name}</p>
                  <p className="text-ink-400">Qty {l.cart.quantity}</p>
                </div>
                <span className="text-ink-100">{formatCurrency((l.variant?.price ?? l.product.price) * l.cart.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm border-t border-white/10 pt-4">
            <div className="flex justify-between"><span className="text-ink-400">Subtotal</span><span className="text-ink-100">{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-ink-400">Shipping</span><span className="text-ink-100">{shipping === 0 ? 'Free' : formatCurrency(shipping)}</span></div>
            <div className="flex justify-between"><span className="text-ink-400">Tax</span><span className="text-ink-100">{formatCurrency(tax)}</span></div>
            <div className="pt-2 border-t border-white/10 flex justify-between text-base font-semibold"><span className="text-ink-100">Total</span><span className="text-gold-300">{formatCurrency(total)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
