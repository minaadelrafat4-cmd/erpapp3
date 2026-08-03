import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, WishlistItem } from '@/types';
import { useAuth } from './AuthContext';

interface WishlistContextValue {
  items: WishlistItem[];
  products: Record<string, Product>;
  has: (productId: string) => boolean;
  toggle: (product: Product) => Promise<void>;
  count: number;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);

  const fetchWishlist = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase.from('wishlist_items').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    const rows = (data ?? []) as WishlistItem[];
    setItems(rows);
    if (rows.length) {
      const { data: pRows } = await supabase.from('products').select('*').in('id', rows.map((r) => r.product_id));
      setProducts(Object.fromEntries((pRows ?? []).map((p) => [p.id, p])));
    } else setProducts({});
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchWishlist(user.id);
    else { setItems([]); setProducts({}); setLoading(false); }
  }, [user?.id]);

  const has = (productId: string) => items.some((i) => i.product_id === productId);

  const toggle = async (product: Product) => {
    if (!user) return;
    const existing = items.find((i) => i.product_id === product.id);
    if (existing) {
      await supabase.from('wishlist_items').delete().eq('id', existing.id);
      setItems((prev) => prev.filter((i) => i.id !== existing.id));
    } else {
      const { data } = await supabase.from('wishlist_items').insert({ user_id: user.id, product_id: product.id }).select('*').single();
      if (data) setItems((prev) => [data as WishlistItem, ...prev]);
      setProducts((prev) => ({ ...prev, [product.id]: product }));
    }
  };

  return (
    <WishlistContext.Provider value={{ items, products, has, toggle, count: items.length, loading }}>
      {children}
    </WishlistContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
