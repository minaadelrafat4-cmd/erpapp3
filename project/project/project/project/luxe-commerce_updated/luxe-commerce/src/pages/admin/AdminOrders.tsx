import { useState, useEffect, useCallback } from 'react';
import { 
  Search, Eye, Truck, CheckCircle2, XCircle, RotateCcw, 
  DollarSign, Clock, MapPin, User, Mail, Phone, Edit3, RefreshCw,
  ScanLine, Plus, Minus, Trash2, ShoppingCart, WifiOff, UploadCloud,
  Printer, FileText,
} from 'lucide-react';
import { useAdminTable } from '@/hooks/useAdminTable';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { queueOfflineSale, syncOfflineSales, getPendingOfflineCount } from '@/lib/offlineSync';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable, StatCard } from '@/components/admin/AdminComponents';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Select, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderTimelineEntry, OrderRefund, Branch } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  getOrCreateInvoice, resolveCustomerInfo, resolveCashierInfo, resolvePaymentMethod, printSalesDocument,
} from '@/lib/salesDocuments';

interface CartLine {
  key: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  sku: string | null;
  unit_price: number;
  quantity: number;
}

interface ScannedProduct {
  product_id: string;
  variant_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  is_variant: boolean;
}

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;

export default function AdminOrders() {
  const { rows, loading, refetch } = useAdminTable<Order>('orders', 'created_at', false);
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [timeline, setTimeline] = useState<OrderTimelineEntry[]>([]);
  const [refunds, setRefunds] = useState<OrderRefund[]>([]);
  const [branches, setBranches] = useState<Record<string, Branch>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [printingKind, setPrintingKind] = useState<'receipt' | 'invoice' | null>(null);

  // Directory of customer_id -> display name/email/phone. Orders don't
  // carry these denormalized fields on the `orders` table itself, so the
  // "Customer" column/search/detail view resolve them from `customers`
  // (joined to `profiles` for email) once up front, the same way branches
  // are loaded in full below.
  const [customerDirectory, setCustomerDirectory] = useState<Record<string, { name: string; email: string | null; phone: string | null }>>({});

  // Refund Modal State
  const [refundModal, setRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('customer_request');

  // Tracking Modal State
  const [trackingModal, setTrackingModal] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  // POS / New Sale Panel State
  const [posOpen, setPosOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [posBranchId, setPosBranchId] = useState('');
  const [posCustomerEmail, setPosCustomerEmail] = useState('');
  const [posCustomerId, setPosCustomerId] = useState<string | null>(null);
  const [posDiscount, setPosDiscount] = useState('0');
  const [posTax, setPosTax] = useState('0');
  const [posPaymentMethod, setPosPaymentMethod] = useState('cash');
  const [posProcessing, setPosProcessing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

 // Generic POS / Manual Order Checkout Handler (Supports Offline Sync & Supabase RPC)
const handleCheckout = async (
  items: Array<{ product_id: string; variant_id?: string | null; quantity: number; unit_price: number }>,
  branchId?: string,
  customerId?: string | null,
  discountAmount: number = 0,
  taxAmount: number = 0,
  paymentMethod: string = 'cash'
): Promise<boolean> => {
  if (!items || items.length === 0) {
    toast('No items to checkout', 'error');
    return false;
  }

  const targetBranch = branchId || Object.keys(branches)[0] || '';
  if (!targetBranch) {
    toast('Select a branch before checking out', 'error');
    return false;
  }

  const { data: { user } } = await supabase.auth.getUser();

  const payload = {
    p_branch_id: targetBranch,
    p_cashier_id: user?.id || '',
    p_customer_id: customerId || null,
    p_items: items.map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      batch_number: null,
      serial_number: null,
    })),
    p_discount_amount: discountAmount,
    p_tax_amount: taxAmount,
    p_payment_method: paymentMethod,
  };

  // 1. Offline Mode: Save to IndexedDB if network drops
  if (!navigator.onLine) {
    try {
      await queueOfflineSale(payload);
      toast('Offline mode active: Order queued locally! It will sync when connected.', 'warning');
      refreshPendingOfflineCount();
      return true;
    } catch (err) {
      toast('Failed to save offline sale locally', 'error');
      return false;
    }
  }

  // 2. Online Mode: Execute Atomic RPC Checkout
  try {
    const { data, error } = await supabase.rpc('process_pos_checkout', payload);

    if (error) {
      toast(`Checkout error: ${error.message}`, 'error');
      return false;
    }

    toast(`Order #${data.order_number} successfully processed!`, 'success');
    refetch(); // Reload orders table
    return true;
  } catch (err: any) {
    toast(`Unexpected checkout error: ${err.message}`, 'error');
    return false;
  }
};

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('branches').select('*');
      const map = Object.fromEntries((data ?? []).map((b) => [b.id, b]));
      setBranches(map);
      setPosBranchId((prev) => prev || Object.keys(map)[0] || '');
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: customersData } = await supabase.from('customers').select('id, first_name, last_name, phone, user_id');
      const userIds = (customersData ?? []).map((c) => c.user_id).filter((id): id is string => !!id);
      const { data: profilesData } = userIds.length
        ? await supabase.from('profiles').select('id, email').in('id', userIds)
        : { data: [] as { id: string; email: string }[] };
      const emailByUser = Object.fromEntries((profilesData ?? []).map((p) => [p.id, p.email]));
      const map = Object.fromEntries(
        (customersData ?? []).map((c) => [
          c.id,
          {
            name: [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Guest',
            email: c.user_id ? (emailByUser[c.user_id] ?? null) : null,
            phone: c.phone ?? null,
          },
        ]),
      );
      setCustomerDirectory(map);
    })();
  }, []);

  const refreshPendingOfflineCount = useCallback(() => {
    getPendingOfflineCount().then(setPendingOfflineCount).catch(() => {});
  }, []);

  // Track connectivity + queued offline sales so cashiers can see when a
  // sale was queued locally and trigger a manual sync once back online.
  useEffect(() => {
    refreshPendingOfflineCount();
    const handleOnline = () => { setIsOnline(true); refreshPendingOfflineCount(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const interval = setInterval(refreshPendingOfflineCount, 15000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingOfflineCount]);

  const handleManualSync = async () => {
    const result = await syncOfflineSales();
    if (result.synced > 0) toast(`Synced ${result.synced} offline sale(s)`, 'success');
    if (result.failed > 0) toast(`${result.failed} offline sale(s) failed to sync`, 'error');
    refreshPendingOfflineCount();
    refetch();
  };

  // Adds a scanned/looked-up product to the active cart, merging quantity
  // if the same product+variant is already present.
  const addToCart = (item: ScannedProduct) => {
    const key = `${item.product_id}:${item.variant_id ?? ''}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          product_id: item.product_id,
          variant_id: item.variant_id,
          name: item.name,
          sku: item.sku,
          unit_price: Number(item.price),
          quantity: 1,
        },
      ];
    });
    toast(`Added: ${item.name} (${formatCurrency(item.price)})`, 'success');
  };

  const lookupCode = async (code: string): Promise<ScannedProduct | null> => {
    const { data, error } = await supabase.rpc('lookup_product_by_code', { p_code: code });
    if (error || !data || data.length === 0) {
      toast(`No product found for code: ${code}`, 'error');
      return null;
    }
    const item = data[0];
    return {
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
      price: Number(item.price),
      is_variant: item.is_variant,
    };
  };

  const handleManualLookup = async () => {
    const code = manualCode.trim();
    if (!code) return;
    setLookingUp(true);
    const item = await lookupCode(code);
    setLookingUp(false);
    if (item) {
      addToCart(item);
      setManualCode('');
    }
  };

  const updateCartQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const removeCartLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  const cartSubtotal = cart.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const cartDiscount = Number(posDiscount) || 0;
  const cartTax = Number(posTax) || 0;
  const cartGrandTotal = Math.max(0, cartSubtotal - cartDiscount) + cartTax;

  const lookupCustomerByEmail = async (email: string) => {
    if (!email.trim()) { setPosCustomerId(null); return; }
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email.trim()).maybeSingle();
    if (!profile) { setPosCustomerId(null); toast('No customer found with that email — sale will be recorded as a walk-in', 'warning'); return; }
    const { data: customer } = await supabase.from('customers').select('id').eq('user_id', profile.id).maybeSingle();
    setPosCustomerId(customer?.id ?? null);
    if (customer) toast('Customer found and linked to this sale', 'success');
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      toast('Cart is empty', 'error');
      return;
    }
    setPosProcessing(true);
    const success = await handleCheckout(
      cart.map((l) => ({ product_id: l.product_id, variant_id: l.variant_id, quantity: l.quantity, unit_price: l.unit_price })),
      posBranchId,
      posCustomerId,
      cartDiscount,
      cartTax,
      posPaymentMethod,
    );
    setPosProcessing(false);
    if (success) {
      setCart([]);
      setPosDiscount('0');
      setPosTax('0');
      setPosCustomerEmail('');
      setPosCustomerId(null);
      setPosOpen(false);
    }
  };

// 1. Listen for standard USB/Bluetooth barcode scanner input (also reads QR
// payloads — hardware scanners emit the same rapid keystroke pattern for
// either symbology, and lookup_product_by_code() matches on barcode, sku,
// or qr_code, so no separate QR code path is needed).
useBarcodeScanner({
  onScan: async (scannedCode) => {
    const item = await lookupCode(scannedCode);
    if (!item) return;
    if (posOpen) {
      addToCart(item);
    } else {
      toast(`Scanned: ${item.name} (${formatCurrency(item.price)}) — open "New Sale" to add it to a cart`, 'success');
    }
  },
});
  const filtered = rows.filter((o) => {
    const info = o.customer_id ? customerDirectory[o.customer_id] : null;
    const matchesQuery = [o.order_number, o.status, o.source, info?.name ?? '', info?.email ?? '']
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesStatus = !statusFilter || o.status === statusFilter;
    const matchesSource = !sourceFilter || o.source === sourceFilter;
    return matchesQuery && matchesStatus && matchesSource;
  });

  const totalRevenue = rows
    .filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
    .reduce((s, o) => s + Number(o.grand_total), 0);
  const pendingCount = rows.filter((o) => o.status === 'pending' || o.status === 'processing').length;
  const deliveredCount = rows.filter((o) => o.status === 'delivered').length;
  const cancelledCount = rows.filter((o) => o.status === 'cancelled').length;

  const view = async (o: Order) => {
    setSelected(o);
    setCarrier(o.carrier ?? '');
    setTrackingNumber(o.tracking_number ?? '');
    setDetailLoading(true);
    try {
      const [itemsRes, timelineRes, refundsRes] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', o.id),
        supabase.from('order_timeline').select('*').eq('order_id', o.id).order('created_at', { ascending: true }),
        supabase.from('order_refunds').select('*').eq('order_id', o.id).order('created_at', { ascending: false }),
      ]);
      setItems((itemsRes.data ?? []) as OrderItem[]);
      setTimeline((timelineRes.data ?? []) as OrderTimelineEntry[]);
      setRefunds((refundsRes.data ?? []) as OrderRefund[]);
    } catch (err) {
      console.error('Failed to load order details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    setUpdating(true);
    const { error } = await supabase.rpc('update_order_status', { p_order_id: orderId, p_status: status });
    setUpdating(false);
    if (error) {
      toast('Could not update status: ' + error.message, 'error');
    } else {
      toast(`Order marked as ${status}`, 'success');
      setSelected((prev) => (prev ? { ...prev, status: status as Order['status'] } : prev));
      refetch();
      if (selected) view({ ...selected, status: status as Order['status'] });
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order? Stock will be restored.')) return;
    setUpdating(true);
    const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
    setUpdating(false);
    if (error) {
      toast('Could not cancel order: ' + error.message, 'error');
    } else {
      toast('Order cancelled — inventory restored', 'success');
      setSelected((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
      refetch();
      if (selected) view({ ...selected, status: 'cancelled' });
    }
  };

  const issueRefund = async () => {
    if (!selected || !refundAmount) return;
    const numericAmount = parseFloat(refundAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast('Please enter a valid refund amount', 'error');
      return;
    }

    setUpdating(true);
    const { error } = await supabase.rpc('issue_refund', {
      p_order_id: selected.id,
      p_amount: numericAmount,
      p_reason: refundReason,
    });
    setUpdating(false);

    if (error) {
      toast('Could not issue refund: ' + error.message, 'error');
    } else {
      toast('Refund issued successfully', 'success');
      setRefundModal(false);
      setRefundAmount('');
      refetch();
      view(selected);
    }
  };

  // Prints a receipt or invoice for the currently-selected order. Both
  // documents are generated on the fly from the order's live data plus
  // the existing `invoices` record (created via the existing
  // `generate_invoice` RPC if one doesn't exist yet) — nothing is stored
  // separately, so the printed document always matches the order.
  const handlePrint = async (kind: 'receipt' | 'invoice') => {
    if (!selected) return;
    setPrintingKind(kind);
    try {
      const [invoice, customer, cashier, paymentMethod] = await Promise.all([
        getOrCreateInvoice(selected.id),
        resolveCustomerInfo(selected),
        resolveCashierInfo(selected),
        resolvePaymentMethod(selected),
      ]);
      const branch = selected.branch_id ? (branches[selected.branch_id] ?? null) : null;
      const opened = printSalesDocument({ kind, order: selected, items, invoice, branch, customer, cashier, paymentMethod });
      if (!opened) {
        toast('Please allow pop-ups to print this document', 'error');
      }
    } catch (err: any) {
      toast(`Could not generate ${kind}: ${err.message ?? 'Unknown error'}`, 'error');
    } finally {
      setPrintingKind(null);
    }
  };

  const updateTracking = async () => {
    if (!selected) return;
    setUpdating(true);
    const { error } = await supabase
      .from('orders')
      .update({ carrier, tracking_number: trackingNumber, status: 'shipped' })
      .eq('id', selected.id);

    setUpdating(false);
    if (error) {
      toast('Could not update tracking: ' + error.message, 'error');
    } else {
      toast('Tracking details updated', 'success');
      setTrackingModal(false);
      refetch();
      view({ ...selected, carrier, tracking_number: trackingNumber, status: 'shipped' });
    }
  };

  const EVENT_ICONS: Record<string, typeof Clock> = {
    created: Clock,
    paid: CheckCircle2,
    payment_failed: XCircle,
    shipped: Truck,
    delivered: MapPin,
    cancelled: XCircle,
    returned: RotateCcw,
    refund_issued: DollarSign,
    processing: Clock,
    fulfilled: CheckCircle2,
    status_changed: Clock,
  };

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        subtitle={`${rows.length} total orders recorded`}
        action={
          <div className="flex items-center gap-2">
            {!isOnline && (
              <Badge color="warning" className="flex items-center gap-1"><WifiOff className="w-3 h-3" /> Offline</Badge>
            )}
            {pendingOfflineCount > 0 && (
              <Button variant="secondary" size="sm" onClick={handleManualSync} title="Sync queued offline sales">
                <UploadCloud className="w-3.5 h-3.5" /> Sync {pendingOfflineCount} pending
              </Button>
            )}
            <Button onClick={() => setPosOpen(true)}>
              <ScanLine className="w-4 h-4" /> New Sale (POS)
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard icon={DollarSign} label="Net Revenue" value={formatCurrency(totalRevenue)} accent="gold" />
            <StatCard icon={Clock} label="Pending / Processing" value={pendingCount} accent="warning" />
            <StatCard icon={CheckCircle2} label="Delivered" value={deliveredCount} accent="accent" />
            <StatCard icon={XCircle} label="Cancelled" value={cancelledCount} accent="error" />
          </>
        )}
      </div>

      {/* Controls & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by order #, customer, or status…"
              className="input pl-11"
            />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-auto">
            <option value="">All sources</option>
            <option value="website">Website</option>
            <option value="pos">POS / Branch</option>
            <option value="phone">Phone</option>
          </Select>
        </div>

        <button onClick={() => refetch()} className="btn-secondary py-2 px-2.5 text-xs" title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Table */}
      <DataTable<Order>
        loading={loading}
        rows={filtered}
        columns={[
          { key: 'order_number', label: 'Order #', render: (o) => <span className="font-mono text-gold-300 font-medium">{o.order_number}</span> },
          { key: 'customer', label: 'Customer', render: (o) => {
            const info = o.customer_id ? customerDirectory[o.customer_id] : null;
            return (
              <div>
                <p className="text-sm font-medium text-ink-100">{info?.name ?? 'Guest'}</p>
                <p className="text-xs text-ink-400">{info?.email ?? '—'}</p>
              </div>
            );
          }},
          { key: 'source', label: 'Source', render: (o) => <Badge color={o.source === 'pos' ? 'accent' : 'neutral'}>{o.source === 'pos' ? 'Branch' : o.source}</Badge> },
          { key: 'placed_at', label: 'Date', render: (o) => <span className="text-ink-300 text-xs">{formatDateTime(o.placed_at)}</span> },
          { key: 'status', label: 'Status', render: (o) => <Badge color={o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'error' : o.status === 'refunded' ? 'warning' : 'gold'}>{o.status}</Badge> },
          { key: 'payment_status', label: 'Payment', render: (o) => <Badge color={o.payment_status === 'paid' ? 'accent' : 'warning'}>{o.payment_status}</Badge> },
          { key: 'branch_id', label: 'Branch', render: (o) => <span className="text-ink-400 text-xs">{o.branch_id ? (branches[o.branch_id]?.name ?? '—') : '—'}</span> },
          { key: 'grand_total', label: 'Total', render: (o) => <span className="font-semibold text-ink-100">{formatCurrency(o.grand_total)}</span> },
          { key: 'actions', label: '', render: (o) => <button onClick={() => view(o)} className="text-gold-300 hover:text-gold-200 p-1"><Eye className="w-4 h-4" /></button> },
        ]}
      />

      {/* Order Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Order ${selected?.order_number ?? ''}`} size="xl">
        {selected && (
          <div className="space-y-5">
            {/* Summary Banner */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="glass rounded-xl p-4">
                <p className="text-xs text-ink-500 uppercase mb-2">Order Status</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge color={selected.status === 'delivered' ? 'success' : selected.status === 'cancelled' ? 'error' : 'gold'}>{selected.status}</Badge>
                  <Badge color={selected.payment_status === 'paid' ? 'accent' : 'warning'}>{selected.payment_status}</Badge>
                  <Badge color="neutral">{selected.source}</Badge>
                </div>
                {selected.branch_id && <p className="text-xs text-ink-400 mt-2">Branch: {branches[selected.branch_id]?.name ?? '—'}</p>}
              </div>

              <div className="glass rounded-xl p-4">
                <p className="text-xs text-ink-500 uppercase mb-2">Customer</p>
                {(() => {
                  const info = selected.customer_id ? customerDirectory[selected.customer_id] : null;
                  return (
                    <>
                      <p className="text-sm font-semibold text-ink-100 flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-gold-400" /> {info?.name ?? 'Guest'}</p>
                      {info?.email && <p className="text-xs text-ink-400 flex items-center gap-1.5 mt-1"><Mail className="w-3.5 h-3.5 text-ink-500" /> {info.email}</p>}
                      {info?.phone && <p className="text-xs text-ink-400 flex items-center gap-1.5 mt-1"><Phone className="w-3.5 h-3.5 text-ink-500" /> {info.phone}</p>}
                    </>
                  );
                })()}
              </div>

              <div className="glass rounded-xl p-4">
                <p className="text-xs text-ink-500 uppercase mb-2">Total & Date</p>
                <p className="text-2xl font-bold text-gold-300">{formatCurrency(selected.grand_total)}</p>
                <p className="text-xs text-ink-400 mt-1">Placed {formatDateTime(selected.placed_at)}</p>
              </div>
            </div>

            {/* Sales Documents — available once the order has been paid */}
            {selected.payment_status === 'paid' && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                <span className="text-xs text-ink-400 font-medium mr-2">Sales Documents:</span>
                <Button variant="secondary" size="sm" onClick={() => handlePrint('receipt')} disabled={printingKind !== null}>
                  <Printer className="w-3.5 h-3.5" /> {printingKind === 'receipt' ? 'Preparing…' : 'Print Receipt'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handlePrint('invoice')} disabled={printingKind !== null}>
                  <FileText className="w-3.5 h-3.5" /> {printingKind === 'invoice' ? 'Preparing…' : 'Print Invoice'}
                </Button>
              </div>
            )}

            {/* Action Bar */}
            {selected.status !== 'cancelled' && selected.status !== 'refunded' && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                <span className="text-xs text-ink-400 font-medium mr-2">Change Status:</span>
                <Select value={selected.status} onChange={(e) => updateStatus(selected.id, e.target.value)} className="w-auto text-xs py-1" disabled={updating}>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Button variant="secondary" size="sm" onClick={() => setTrackingModal(true)}>
                  <Truck className="w-3.5 h-3.5" /> Shipment & Tracking
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setRefundModal(true)}>
                  <DollarSign className="w-3.5 h-3.5" /> Issue Refund
                </Button>
                <Button variant="ghost" size="sm" onClick={() => cancelOrder(selected.id)} disabled={updating} className="text-error-400 hover:text-error-300">
                  <XCircle className="w-3.5 h-3.5" /> Cancel Order
                </Button>
              </div>
            )}

            {/* Tracking Info Panel */}
            {selected.tracking_number && (
              <div className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-500 uppercase mb-1">Shipment Tracking</p>
                  <p className="text-sm text-ink-100 font-mono"><span className="text-ink-400 font-sans">{selected.carrier ?? 'Carrier'}:</span> {selected.tracking_number}</p>
                </div>
                <button onClick={() => setTrackingModal(true)} className="text-gold-300 hover:text-gold-200 text-xs flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            )}

            {/* Line Items */}
            <div>
              <h4 className="font-semibold text-ink-50 mb-2">Order Items</h4>
              <div className="space-y-2 glass rounded-xl p-4">
                {items.map((it) => (
                  <div key={it.id} className="flex justify-between items-center text-sm border-b border-white/5 last:border-0 pb-2 last:pb-0">
                    <div>
                      <p className="text-ink-100 font-medium">{it.product_name}</p>
                      {it.variant_name && <p className="text-ink-400 text-xs">{it.variant_name}</p>}
                      <p className="text-ink-400 text-xs">Qty {it.quantity} × {formatCurrency(it.price)}</p>
                    </div>
                    <span className="text-ink-100 font-semibold">{formatCurrency(it.line_total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Refund Log */}
            {refunds.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink-50 mb-2">Refund History</h4>
                <div className="space-y-2 glass rounded-xl p-4">
                  {refunds.map((r) => (
                    <div key={r.id} className="flex justify-between items-center text-sm border-b border-white/5 last:border-0 pb-2 last:pb-0">
                      <div>
                        <p className="font-mono text-gold-300 text-xs">{r.refund_number}</p>
                        <p className="text-ink-400 text-xs">{formatDateTime(r.created_at)} · Reason: {r.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color={r.status === 'completed' ? 'accent' : 'warning'}>{r.status}</Badge>
                        <span className="text-ink-100 font-semibold">{formatCurrency(r.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Log */}
            <div>
              <h4 className="font-semibold text-ink-50 mb-3">Order History & Timeline</h4>
              {detailLoading ? (
                <Skeleton className="h-32" />
              ) : timeline.length === 0 ? (
                <p className="text-ink-400 text-sm">No timeline events recorded.</p>
              ) : (
                <div className="space-y-3 glass rounded-xl p-4">
                  {timeline.map((t) => {
                    const Icon = EVENT_ICONS[t.event] ?? Clock;
                    return (
                      <div key={t.id} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-gold-500/10 flex items-center justify-center text-gold-400 shrink-0 mt-0.5">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-ink-100 capitalize">{t.event.replace(/_/g, ' ')}</p>
                          {t.description && <p className="text-xs text-ink-400">{t.description}</p>}
                          <p className="text-[10px] text-ink-500 mt-0.5">{formatDateTime(t.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Issue Refund Modal */}
      <Modal open={refundModal} onClose={() => setRefundModal(false)} title="Issue Refund" size="sm">
        <div className="space-y-4">
          <div className="glass rounded-xl p-3">
            <p className="text-xs text-ink-500">Order Grand Total</p>
            <p className="text-lg font-bold text-gold-300">{selected ? formatCurrency(selected.grand_total) : '—'}</p>
          </div>
          <div>
            <label className="label">Refund Amount ($)</label>
            <input
              type="number"
              step="0.01"
              max={selected?.grand_total}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="0.00"
              className="input"
            />
          </div>
          <div>
            <label className="label">Reason</label>
            <select value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="input">
              <option value="customer_request">Customer Request</option>
              <option value="damaged_goods">Damaged Goods</option>
              <option value="wrong_item">Wrong Item</option>
              <option value="overcharge">Overcharge</option>
              <option value="cancellation">Cancellation</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Button onClick={issueRefund} disabled={updating || !refundAmount} className="w-full">
            <DollarSign className="w-4 h-4" /> {updating ? 'Processing…' : 'Issue Refund'}
          </Button>
        </div>
      </Modal>

      {/* New Sale (POS) Modal */}
      <Modal open={posOpen} onClose={() => setPosOpen(false)} title="New Sale — POS Checkout" size="xl">
        <div className="space-y-5">
          <div className="glass rounded-xl p-3 flex items-center gap-2 text-xs text-ink-300">
            <ScanLine className="w-4 h-4 text-gold-400 shrink-0" />
            Scanner ready — scan a barcode or QR code with a connected USB/Bluetooth scanner and it will be added to the cart automatically. You can also type a barcode, SKU, or QR value below.
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Select label="Branch" value={posBranchId} onChange={(e) => setPosBranchId(e.target.value)}>
              <option value="">Select branch…</option>
              {Object.values(branches).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
            <Input
              label="Customer Email (optional)"
              placeholder="Leave blank for walk-in sale"
              value={posCustomerEmail}
              onChange={(e) => setPosCustomerEmail(e.target.value)}
              onBlur={(e) => lookupCustomerByEmail(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Type a barcode, SKU, or QR code…"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
            />
            <Button variant="secondary" onClick={handleManualLookup} disabled={lookingUp || !manualCode.trim()}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>

          {/* Cart */}
          <div className="glass rounded-xl p-4">
            <h4 className="font-semibold text-ink-50 mb-3 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-gold-400" /> Cart</h4>
            {cart.length === 0 ? (
              <p className="text-sm text-ink-400">No items yet — scan a product or add one manually.</p>
            ) : (
              <div className="space-y-2">
                {cart.map((line) => (
                  <div key={line.key} className="flex items-center justify-between gap-3 text-sm border-b border-white/5 last:border-0 pb-2 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-ink-100 font-medium truncate">{line.name}</p>
                      <p className="text-ink-400 text-xs">{line.sku ?? '—'} · {formatCurrency(line.unit_price)} each</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => updateCartQty(line.key, -1)} className="p-1 text-ink-400 hover:text-ink-100"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="w-6 text-center text-ink-100">{line.quantity}</span>
                      <button onClick={() => updateCartQty(line.key, 1)} className="p-1 text-ink-400 hover:text-ink-100"><Plus className="w-3.5 h-3.5" /></button>
                      <span className="w-20 text-right text-ink-100 font-semibold">{formatCurrency(line.unit_price * line.quantity)}</span>
                      <button onClick={() => removeCartLine(line.key)} className="p-1 text-error-400 hover:text-error-300"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Input label="Discount ($)" type="number" step="0.01" min="0" value={posDiscount} onChange={(e) => setPosDiscount(e.target.value)} />
            <Input label="Tax ($)" type="number" step="0.01" min="0" value={posTax} onChange={(e) => setPosTax(e.target.value)} />
            <Select label="Payment Method" value={posPaymentMethod} onChange={(e) => setPosPaymentMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mobile_wallet">Mobile Wallet</option>
            </Select>
          </div>

          <div className="glass rounded-xl p-4 flex items-center justify-between">
            <div className="text-xs text-ink-400 space-y-0.5">
              <p>Subtotal: {formatCurrency(cartSubtotal)}</p>
              <p>Discount: −{formatCurrency(cartDiscount)} · Tax: +{formatCurrency(cartTax)}</p>
            </div>
            <p className="text-2xl font-bold text-gold-300">{formatCurrency(cartGrandTotal)}</p>
          </div>

          <Button onClick={completeSale} disabled={posProcessing || cart.length === 0 || !posBranchId} className="w-full">
            <DollarSign className="w-4 h-4" /> {posProcessing ? 'Processing…' : 'Complete Sale'}
          </Button>
        </div>
      </Modal>

      {/* Shipment & Tracking Modal */}
      <Modal open={trackingModal} onClose={() => setTrackingModal(false)} title="Update Shipment & Tracking" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Carrier Name</label>
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="e.g. DHL, FedEx, Aramex"
              className="input"
            />
          </div>
          <div>
            <label className="label">Tracking Number</label>
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Enter tracking number"
              className="input"
            />
          </div>
          <Button onClick={updateTracking} disabled={updating || !trackingNumber} className="w-full">
            <Truck className="w-4 h-4" /> {updating ? 'Saving…' : 'Save Shipment Details'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}