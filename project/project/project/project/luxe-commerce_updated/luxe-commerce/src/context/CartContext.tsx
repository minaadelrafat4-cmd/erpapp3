import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getSessionId } from '@/lib/utils';
import type { CartLine, CartItem, Product, ProductVariant } from '@/types';
import { useAuth } from './AuthContext';

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  loading: boolean;
  add: (product: Product, variant?: ProductVariant | null, qty?: number) => Promise<void>;
  updateQty: (cartId: string, qty: number) => Promise<void>;
  remove: (cartId: string) => Promise<void>;
  clear: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [variants, setVariants] = useState<Record<string, ProductVariant>>({});
  const [loading, setLoading] = useState(true);

  const session = useMemo(() => (user ? null : getSessionId()), [user]);

  const fetchCart = async (uid: string | null, sid: string | null) => {
    setLoading(true);
    let q = supabase.from('cart_items').select('*');
    if (uid) q = q.eq('user_id', uid);
    else if (sid) q = q.eq('session_id', sid).is('user_id', null);
    else {
      setItems([]); setProducts({}); setVariants({}); setLoading(false); return;
    }
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) { setItems([]); setLoading(false); return; }
    const cart = (data ?? []) as CartItem[];
    setItems(cart);
    if (cart.length) {
      const pIds = [...new Set(cart.map((c) => c.product_id))];
      const vIds = cart.map((c) => c.variant_id).filter(Boolean) as string[];
      const [{ data: pRows }, { data: vRows }] = await Promise.all([
        supabase.from('products').select('*').in('id', pIds),
        vIds.length ? supabase.from('product_variants').select('*').in('id', vIds) : Promise.resolve({ data: [] }),
      ]);
      setProducts(Object.fromEntries((pRows ?? []).map((p) => [p.id, p as unknown as Product])));
      setVariants(Object.fromEntries((vRows ?? []).map((v) => [v.id, v as unknown as ProductVariant])));
    } else {
      setProducts({}); setVariants({});
    }
    setLoading(false);
  };

  // Merge guest cart into user cart on login — one atomic server-side transaction
  useEffect(() => {
    if (!user) return;
    const sid = getSessionId();
    (async () => {
      const { error } = await supabase.rpc('merge_guest_cart', { p_session_id: sid });
      if (!error) fetchCart(user.id, null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    fetchCart(user?.id ?? null, session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session]);

  const add = async (product: Product, variant?: ProductVariant | null, qty = 1) => {
    const { error } = await supabase.rpc('upsert_cart_item', {
      p_product_id: product.id,
      p_variant_id: variant?.id ?? null,
      p_quantity: qty,
      p_session_id: user ? null : getSessionId(),
    });
    if (error) throw new Error('Failed to update cart');
    await fetchCart(user?.id ?? null, session);
  };

  const updateQty = async (cartId: string, qty: number) => {
    if (qty <= 0) return remove(cartId);
    const { error } = await supabase.from('cart_items').update({ quantity: qty }).eq('id', cartId);
    if (error) throw new Error('Failed to update quantity');
    setItems((prev) => prev.map((i) => (i.id === cartId ? { ...i, quantity: qty } : i)));
  };

  const remove = async (cartId: string) => {
    const { error } = await supabase.from('cart_items').delete().eq('id', cartId);
    if (error) throw new Error('Failed to remove item');
    setItems((prev) => prev.filter((i) => i.id !== cartId));
  };

  const clear = async () => {
    if (user) {
      const { error } = await supabase.from('cart_items').delete().eq('user_id', user.id);
      if (error) throw new Error('Failed to clear cart');
    } else if (session) {
      const { error } = await supabase.from('cart_items').delete().eq('session_id', session).is('user_id', null);
      if (error) throw new Error('Failed to clear cart');
    }
    setItems([]);
  };

  const lines: CartLine[] = items
    .map((cart) => {
      const product = products[cart.product_id];
      if (!product) return null;
      return { cart, product, variant: cart.variant_id ? variants[cart.variant_id] : null };
    })
    .filter(Boolean) as CartLine[];

  const subtotal = lines.reduce((sum, l) => sum + (l.variant?.price ?? l.product.price) * l.cart.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ lines, count, subtotal, loading, add, updateQty, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
