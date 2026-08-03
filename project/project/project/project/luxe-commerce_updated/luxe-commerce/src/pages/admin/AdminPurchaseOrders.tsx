import { useState, useEffect } from 'react';
import { Plus, Eye, Search, Package, CheckCircle2, XCircle, Truck } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable, StatCard } from '@/components/admin/AdminComponents';
import { Button } from '@/components/ui/Button';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { PurchaseOrder, PurchaseOrderItem, Supplier, Warehouse, Product } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function AdminPurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, Supplier>>({});
  const [warehouses, setWarehouses] = useState<Record<string, Warehouse>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<(PurchaseOrderItem & { product?: Product })[]>([]);
  const { toast } = useToast();
  const { canEdit } = useAuth();
  const editable = canEdit('purchase_orders.manage');
  const canReceive = canEdit('purchase_orders.receive') || editable;

  useEffect(() => {
    (async () => {
      const [{ data: pos }, { data: sups }, { data: whs }] = await Promise.all([
        supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*'),
        supabase.from('warehouses').select('*'),
      ]);
      setOrders((pos ?? []) as PurchaseOrder[]);
      setSuppliers(Object.fromEntries((sups ?? []).map((s) => [s.id, s])));
      setWarehouses(Object.fromEntries((whs ?? []).map((w) => [w.id, w])));
      setLoading(false);
    })();
  }, []);

  const filtered = orders.filter((o) => [o.po_number, o.status].join(' ').toLowerCase().includes(query.toLowerCase()));

  const view = async (po: PurchaseOrder) => {
    setSelected(po);
    const { data } = await supabase.from('purchase_order_items').select('*').eq('purchase_order_id', po.id);
    const itemRows = (data ?? []) as PurchaseOrderItem[];
    if (itemRows.length) {
      const pIds = [...new Set(itemRows.map((i) => i.product_id))];
      const { data: prods } = await supabase.from('products').select('*').in('id', pIds);
      const pMap = Object.fromEntries((prods ?? []).map((p) => [p.id, p]));
      setItems(itemRows.map((i) => ({ ...i, product: pMap[i.product_id] })));
    } else setItems([]);
  };

  const receive = async (po: PurchaseOrder) => {
    const { data, error } = await supabase.rpc('receive_purchase_order', { p_po_id: po.id });
    if (error) toast('Could not receive PO: ' + error.message, 'error');
    else {
      toast('PO received — inventory updated', 'success');
      setOrders((prev) => prev.map((o) => (o.id === po.id ? { ...o, status: 'received', received_at: new Date().toISOString() } : o)));
    }
  };

  const totalValue = orders.reduce((s, o) => s + Number(o.grand_total), 0);
  const pending = orders.filter((o) => o.status === 'sent' || o.status === 'partial').length;
  const received = orders.filter((o) => o.status === 'received').length;

  return (
    <div>
      <AdminPageHeader title="Purchase Orders" subtitle={`${orders.length} total POs`} action={editable ? <Button><Plus className="w-4 h-4" /> Create PO</Button> : undefined} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard icon={Package} label="Total POs" value={orders.length} accent="gold" />
            <StatCard icon={Truck} label="Pending" value={pending} accent="warning" />
            <StatCard icon={CheckCircle2} label="Received" value={received} accent="accent" />
            <StatCard icon={Package} label="Total Value" value={formatCurrency(totalValue)} accent="gold" />
          </>
        )}
      </div>

      <div className="max-w-md mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search POs…" className="input pl-11" />
        </div>
      </div>

      <DataTable<PurchaseOrder>
        loading={loading}
        rows={filtered}
        columns={[
          { key: 'po_number', label: 'PO #', render: (o) => <span className="font-mono text-gold-300">{o.po_number}</span> },
          { key: 'supplier_id', label: 'Supplier', render: (o) => <span className="text-ink-200">{suppliers[o.supplier_id]?.name ?? '—'}</span> },
          { key: 'warehouse_id', label: 'Warehouse', render: (o) => <span className="text-ink-300">{warehouses[o.warehouse_id ?? '']?.name ?? '—'}</span> },
          { key: 'status', label: 'Status', render: (o) => <Badge color={o.status === 'received' ? 'success' : o.status === 'cancelled' ? 'error' : o.status === 'sent' ? 'gold' : 'neutral'}>{o.status}</Badge> },
          { key: 'grand_total', label: 'Total', render: (o) => <span className="font-semibold text-ink-100">{formatCurrency(o.grand_total)}</span> },
          { key: 'created_at', label: 'Date', render: (o) => <span className="text-ink-400">{formatDate(o.created_at)}</span> },
          { key: 'actions', label: '', render: (o) => (
            <div className="flex gap-2">
              <button onClick={() => view(o)} className="text-ink-400 hover:text-gold-300"><Eye className="w-4 h-4" /></button>
              {canReceive && o.status !== 'received' && o.status !== 'cancelled' && (
                <button onClick={() => receive(o)} className="text-accent-400 hover:text-accent-300" title="Receive & update inventory"><CheckCircle2 className="w-4 h-4" /></button>
              )}
            </div>
          ) },
        ]}
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`PO ${selected?.po_number ?? ''}`} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Info label="Supplier" value={suppliers[selected.supplier_id]?.name ?? '—'} />
              <Info label="Warehouse" value={warehouses[selected.warehouse_id ?? '']?.name ?? '—'} />
              <Info label="Status" value={<Badge color="gold">{selected.status}</Badge>} />
              <Info label="Total" value={<span className="font-semibold text-gold-300">{formatCurrency(selected.grand_total)}</span>} />
              <Info label="Expected" value={selected.expected_at ? formatDate(selected.expected_at) : '—'} />
              <Info label="Received" value={selected.received_at ? formatDate(selected.received_at) : '—'} />
            </div>
            <div>
              <h4 className="font-semibold text-ink-50 mb-2">Items</h4>
              <div className="space-y-2">
                {items.length === 0 ? <p className="text-ink-400 text-sm">No items</p> : items.map((it) => (
                  <div key={it.id} className="flex justify-between text-sm border-b border-white/5 pb-2">
                    <div><p className="text-ink-100">{it.product?.name ?? 'Unknown product'}</p><p className="text-ink-400 text-xs">Qty {it.quantity} × {formatCurrency(it.unit_cost)}</p></div>
                    <span className="text-ink-100">{formatCurrency(it.line_total)}</span>
                  </div>
                ))}
              </div>
            </div>
            {canReceive && selected.status !== 'received' && selected.status !== 'cancelled' && (
              <Button onClick={() => { receive(selected); }} className="w-full"><CheckCircle2 className="w-4 h-4" /> Receive & Sync Inventory</Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs text-ink-500 uppercase tracking-wider mb-1">{label}</p><div className="text-ink-100">{value}</div></div>;
}
