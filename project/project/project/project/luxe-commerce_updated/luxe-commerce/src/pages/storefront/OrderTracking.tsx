import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Package, CheckCircle2, Truck, Clock, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge, EmptyState } from '@/components/ui/Card';
import type { Order, OrderItem, OrderTimelineEntry } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const STEPS = ['pending', 'processing', 'shipped', 'delivered'] as const;

export default function OrderTracking() {
  const [params, setParams] = useSearchParams();
  const [num, setNum] = useState(params.get('n') ?? '');
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [timeline, setTimeline] = useState<OrderTimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const track = async (n: string) => {
    if (!n) return;
    setLoading(true); setSearched(true);
    const { data } = await supabase.from('orders').select('*').eq('order_number', n).maybeSingle();
    setOrder(data as Order | null);
    if (data) {
      const [oiRes, tlRes] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', data.id),
        supabase.from('order_timeline').select('*').eq('order_id', data.id).order('created_at', { ascending: true }),
      ]);
      setItems((oiRes.data ?? []) as OrderItem[]);
      setTimeline((tlRes.data ?? []) as OrderTimelineEntry[]);
    } else { setItems([]); setTimeline([]); }
    setLoading(false);
  };

  useEffect(() => {
    if (params.get('n')) track(params.get('n') as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStep = order ? STEPS.indexOf(order.status as typeof STEPS[number]) : -1;

  return (
    <div className="section py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-display font-semibold text-ink-50 mb-2">Track Your Order</h1>
        <p className="text-ink-400">Enter your order number to see the latest status.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setParams({ n: num }); track(num); }} className="max-w-lg mx-auto flex gap-3 mb-10">
        <Input placeholder="LX-XXXXXX" value={num} onChange={(e) => setNum(e.target.value)} />
        <Button type="submit" disabled={loading}><Search className="w-4 h-4" /> Track</Button>
      </form>

      {loading && <div className="glass-card h-64 animate-shimmer max-w-2xl mx-auto" />}

      {!loading && searched && !order && (
        <EmptyState icon={<Package className="w-10 h-10" />} title="Order not found" description="Check your order number and try again." />
      )}

      {!loading && order && (
        <div className="max-w-3xl mx-auto">
          <div className="glass-card p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <p className="text-xs text-ink-400 uppercase tracking-wider">Order</p>
                <p className="font-mono text-lg text-gold-300">{order.order_number}</p>
              </div>
              <div className="flex gap-2">
                <Badge color={order.status === 'delivered' ? 'success' : 'gold'}>{order.status}</Badge>
                <Badge color={order.payment_status === 'paid' ? 'accent' : 'warning'}>{order.payment_status}</Badge>
              </div>
            </div>

            {/* Progress */}
            {order.status === 'cancelled' ? (
              <div className="glass-card p-4 mb-4 text-center">
                <Badge color="error">Order Cancelled</Badge>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  {STEPS.map((s, i) => (
                    <div key={s} className="flex flex-col items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition ${i <= currentStep ? 'bg-gold-sheen text-ink-950' : 'bg-ink-800 text-ink-500'}`}>
                        {i < currentStep ? <CheckCircle2 className="w-5 h-5" /> : i === 0 ? <Clock className="w-5 h-5" /> : i === 1 ? <Package className="w-5 h-5" /> : i === 2 ? <Truck className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                      </div>
                      <span className="text-xs mt-2 capitalize text-ink-300">{s}</span>
                    </div>
                  ))}
                </div>
                <div className="relative h-1 bg-ink-800 rounded-full overflow-hidden -mt-7 mb-3">
                  <div className="absolute inset-y-0 left-0 bg-gold-sheen transition-all" style={{ width: `${currentStep >= 0 ? (currentStep / (STEPS.length - 1)) * 100 : 0}%` }} />
                </div>
              </>
            )}

            {order.tracking_number && (
              <p className="text-sm text-ink-300 mt-4">Tracking number: <span className="font-mono text-gold-300">{order.tracking_number}</span> ({order.carrier})</p>
            )}
            <p className="text-xs text-ink-500 mt-2">Placed {formatDateTime(order.placed_at)}</p>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-semibold text-ink-50 mb-4">Items</h3>
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="flex justify-between text-sm">
                  <div>
                    <p className="text-ink-100">{it.product_name}</p>
                    {it.variant_name && <p className="text-ink-400 text-xs">{it.variant_name}</p>}
                    <p className="text-ink-400 text-xs">Qty {it.quantity}</p>
                  </div>
                  <span className="text-ink-100">{formatCurrency(it.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="pt-4 mt-4 border-t border-white/10 flex justify-between font-semibold">
              <span className="text-ink-100">Total</span>
              <span className="text-gold-300">{formatCurrency(order.grand_total)}</span>
            </div>
          </div>

          {timeline.length > 0 && (
            <div className="glass-card p-6 mt-6">
              <h3 className="font-semibold text-ink-50 mb-4">Order History</h3>
              <div className="space-y-3">
                {timeline.map((t) => (
                  <div key={t.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold-500/10 flex items-center justify-center text-gold-400 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink-100 capitalize">{t.event.replace(/_/g, ' ')}</p>
                      {t.description && <p className="text-xs text-ink-400">{t.description}</p>}
                      <p className="text-xs text-ink-500 mt-0.5">{formatDateTime(t.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center mt-6"><Link to="/account"><Button variant="secondary">View all orders</Button></Link></div>
        </div>
      )}
    </div>
  );
}
