import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { User, Package, Heart, MapPin, LogOut, Settings, Ticket } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge, EmptyState, Skeleton } from '@/components/ui/Card';
import type { Order, Address } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { productImage } from '@/lib/images';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'addresses', label: 'Addresses', icon: MapPin },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
] as const;

export default function Account() {
  const { user, customer, loading, signOut, refreshCustomer } = useAuth();
  const { items: wishItems, products, toggle } = useWishlist();
  const [tab, setTab] = useState<typeof tabs[number]['id']>('profile');
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ first: '', last: '', phone: '' });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: o }, { data: a }] = await Promise.all([
        supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('addresses').select('*, customers!inner(user_id)').eq('customers.user_id', user.id).order('created_at', { ascending: false }),
      ]);
      setOrders((o ?? []) as Order[]);
      setAddresses((a ?? []) as Address[]);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (customer) setProfile({ first: customer.first_name ?? '', last: customer.last_name ?? '', phone: customer.phone ?? '' });
  }, [customer]);

  if (loading) return <div className="section py-20"><Skeleton className="h-96" /></div>;
  if (!user) return <Navigate to="/signin" replace />;

  const saveProfile = async () => {
    setSaving(true);
    await supabase.from('customers').update({ first_name: profile.first, last_name: profile.last, phone: profile.phone }).eq('user_id', user.id);
    await refreshCustomer();
    setSaving(false);
  };

  return (
    <div className="section py-10">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-gold-sheen flex items-center justify-center text-ink-950 text-2xl font-bold">
          {(profile.first || user.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-display font-semibold text-ink-50">{profile.first ? `${profile.first} ${profile.last}` : 'Welcome back'}</h1>
          <p className="text-ink-400 text-sm">{user.email}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-8">
        <aside className="glass-card p-2 h-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition ${tab === t.id ? 'bg-gold-500/10 text-gold-300' : 'text-ink-300 hover:bg-white/5'}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
              {t.id === 'wishlist' && wishItems.length > 0 && <span className="ml-auto text-xs bg-gold-500/20 px-2 py-0.5 rounded-full">{wishItems.length}</span>}
            </button>
          ))}
          <button onClick={signOut} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-error-400 hover:bg-error-500/10 transition">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </aside>

        <div>
          {tab === 'profile' && (
            <div className="glass-card p-6 max-w-lg">
              <h3 className="text-lg font-semibold text-ink-50 mb-4">Personal Information</h3>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input label="First name" value={profile.first} onChange={(e) => setProfile({ ...profile, first: e.target.value })} />
                  <Input label="Last name" value={profile.last} onChange={(e) => setProfile({ ...profile, last: e.target.value })} />
                </div>
                <Input label="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                <Input label="Email" value={user.email ?? ''} disabled />
                <Button onClick={saveProfile} disabled={saving}><Settings className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}</Button>
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div>
              {orders.length === 0 ? (
                <EmptyState icon={<Package className="w-10 h-10" />} title="No orders yet" description="When you place an order it will appear here." action={<Link to="/shop"><Button>Browse Products</Button></Link>} />
              ) : (
                <div className="space-y-4">
                  {orders.map((o) => (
                    <div key={o.id} className="glass-card p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="font-mono text-gold-300">{o.order_number}</p>
                          <p className="text-xs text-ink-400">{formatDate(o.placed_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color={o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'error' : 'gold'}>{o.status}</Badge>
                          <Badge color={o.payment_status === 'paid' ? 'accent' : 'warning'}>{o.payment_status}</Badge>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-ink-400">{o.tracking_number ? `Tracking: ${o.tracking_number}` : 'Processing'}</span>
                        <span className="font-semibold text-ink-50">{formatCurrency(o.grand_total)}</span>
                      </div>
                      <Link to={`/track-order?n=${o.order_number}`} className="text-sm text-gold-300 hover:text-gold-200 mt-2 inline-block">Track →</Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'addresses' && (
            <div>
              {addresses.length === 0 ? (
                <EmptyState icon={<MapPin className="w-10 h-10" />} title="No saved addresses" description="Add an address during checkout to save it here." />
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {addresses.map((a) => (
                    <div key={a.id} className="glass-card p-5">
                      {a.is_default && <Badge color="gold" className="mb-2">Default</Badge>}
                      <p className="text-ink-100 font-medium">{a.line1}</p>
                      <p className="text-sm text-ink-400">{a.city}, {a.state} {a.postal_code}</p>
                      <p className="text-sm text-ink-400">{a.country}</p>
                      {a.phone && <p className="text-sm text-ink-400 mt-1">{a.phone}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'wishlist' && (
            <div>
              {wishItems.length === 0 ? (
                <EmptyState icon={<Heart className="w-10 h-10" />} title="No saved items" description="Tap the heart on any product to save it." action={<Link to="/shop"><Button>Browse Products</Button></Link>} />
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {wishItems.map((item) => {
                    const p = products[item.product_id];
                    if (!p) return null;
                    return (
                      <div key={item.id} className="glass-card p-4 flex gap-4">
                        <Link to={`/product/${p.slug}`} className="w-20 h-20 rounded-lg bg-ink-800 overflow-hidden shrink-0">
                          <img src={productImage(p.id + p.slug)} alt="" className="w-full h-full object-cover" />
                        </Link>
                        <div className="flex-1">
                          <Link to={`/product/${p.slug}`}><h4 className="font-medium text-ink-100 hover:text-gold-300 line-clamp-1">{p.name}</h4></Link>
                          <p className="text-gold-300 font-semibold mt-1">{formatCurrency(p.price)}</p>
                          <button onClick={() => toggle(p)} className="text-xs text-ink-400 hover:text-error-500 mt-1">Remove</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
