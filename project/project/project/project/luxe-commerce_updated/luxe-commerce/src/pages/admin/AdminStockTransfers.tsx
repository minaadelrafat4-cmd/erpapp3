import { useState, useEffect } from 'react';
import { Plus, Search, ArrowRight, Truck, CheckCircle2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable, StatCard } from '@/components/admin/AdminComponents';
import { Button } from '@/components/ui/Button';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { StockTransfer, Product, Branch, Warehouse } from '@/types';
import { formatDate } from '@/lib/utils';

export default function AdminStockTransfers() {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [branches, setBranches] = useState<Record<string, Branch>>({});
  const [warehouses, setWarehouses] = useState<Record<string, Warehouse>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const { toast } = useToast();
  const { canEdit } = useAuth();
  const editable = canEdit('inventory.transfer');

  useEffect(() => {
    (async () => {
      const [{ data: trs }, { data: prods }, { data: brs }, { data: whs }] = await Promise.all([
        supabase.from('stock_transfers').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*'),
        supabase.from('branches').select('*'),
        supabase.from('warehouses').select('*'),
      ]);
      setTransfers((trs ?? []) as StockTransfer[]);
      setProducts(Object.fromEntries((prods ?? []).map((p) => [p.id, p])));
      setBranches(Object.fromEntries((brs ?? []).map((b) => [b.id, b])));
      setWarehouses(Object.fromEntries((whs ?? []).map((w) => [w.id, w])));
      setLoading(false);
    })();
  }, []);

  const filtered = transfers.filter((t) => [t.transfer_number, t.status].join(' ').toLowerCase().includes(query.toLowerCase()));

  const markReceived = async (t: StockTransfer) => {
    const { error } = await supabase.from('stock_transfers').update({ status: 'received', received_at: new Date().toISOString() }).eq('id', t.id);
    if (error) toast('Could not update transfer', 'error');
    else {
      toast('Transfer marked received', 'success');
      setTransfers((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: 'received', received_at: new Date().toISOString() } : x)));
    }
  };

  const locName = (branchId: string | null, whId: string | null) => {
    if (branchId) return branches[branchId]?.name ?? 'Branch';
    if (whId) return warehouses[whId]?.name ?? 'Warehouse';
    return '—';
  };

  const inTransit = transfers.filter((t) => t.status === 'in_transit').length;
  const received = transfers.filter((t) => t.status === 'received').length;

  return (
    <div>
      <AdminPageHeader title="Stock Transfers" subtitle={`${transfers.length} transfers`} action={editable ? <Button><Plus className="w-4 h-4" /> New Transfer</Button> : undefined} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard icon={Truck} label="Total Transfers" value={transfers.length} accent="gold" />
            <StatCard icon={ArrowRight} label="In Transit" value={inTransit} accent="warning" />
            <StatCard icon={CheckCircle2} label="Received" value={received} accent="accent" />
            <StatCard icon={Truck} label="Pending" value={transfers.filter((t) => t.status === 'pending').length} accent="gold" />
          </>
        )}
      </div>

      <div className="max-w-md mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transfers…" className="input pl-11" />
        </div>
      </div>

      <DataTable<StockTransfer>
        loading={loading}
        rows={filtered}
        columns={[
          { key: 'transfer_number', label: 'Transfer #', render: (t) => <span className="font-mono text-gold-300">{t.transfer_number}</span> },
          { key: 'product_id', label: 'Product', render: (t) => <span className="text-ink-200">{products[t.product_id]?.name ?? '—'}</span> },
          { key: 'from', label: 'From', render: (t) => <span className="text-ink-300">{locName(t.from_branch_id, t.from_warehouse_id)}</span> },
          { key: 'to', label: 'To', render: (t) => <div className="flex items-center gap-1"><ArrowRight className="w-3 h-3 text-ink-500" /><span className="text-ink-300">{locName(t.to_branch_id, t.to_warehouse_id)}</span></div> },
          { key: 'quantity', label: 'Qty', render: (t) => <span className="font-semibold text-ink-100">{t.quantity}</span> },
          { key: 'status', label: 'Status', render: (t) => <Badge color={t.status === 'received' ? 'success' : t.status === 'cancelled' ? 'error' : t.status === 'in_transit' ? 'warning' : 'neutral'}>{t.status}</Badge> },
          { key: 'created_at', label: 'Date', render: (t) => <span className="text-ink-400">{formatDate(t.created_at)}</span> },
          { key: 'actions', label: '', render: (t) => (
            t.status === 'in_transit' && editable ? <button onClick={() => markReceived(t)} className="text-accent-400 hover:text-accent-300" title="Mark received"><CheckCircle2 className="w-4 h-4" /></button> : null
          ) },
        ]}
      />
    </div>
  );
}
