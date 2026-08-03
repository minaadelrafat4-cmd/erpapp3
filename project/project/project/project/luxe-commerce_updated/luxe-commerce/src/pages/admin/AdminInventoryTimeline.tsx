import { useState, useEffect } from 'react';
import { Search, Clock, ArrowDown, ArrowUp, Filter } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable, StatCard } from '@/components/admin/AdminComponents';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import type { InventoryTimelineEntry, InventoryTransactionType } from '@/types';
import { formatDateTime } from '@/lib/utils';

const TYPE_COLORS: Record<InventoryTransactionType, 'success' | 'error' | 'gold' | 'warning' | 'accent' | 'neutral'> = {
  purchase: 'success', sale: 'error', transfer_in: 'accent', transfer_out: 'warning',
  adjustment: 'gold', return: 'success', reservation: 'neutral', release: 'neutral',
};

export default function AdminInventoryTimeline() {
  const [entries, setEntries] = useState<InventoryTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('v_inventory_timeline').select('*').limit(200);
      setEntries((data ?? []) as InventoryTimelineEntry[]);
      setLoading(false);
    })();
  }, []);

  const filtered = entries.filter((e) => {
    const matchesQuery = [e.product_name, e.sku, e.notes].join(' ').toLowerCase().includes(query.toLowerCase());
    const matchesType = !typeFilter || e.transaction_type === typeFilter;
    return matchesQuery && matchesType;
  });

  const totalIn = entries.filter((e) => e.quantity > 0).reduce((s, e) => s + e.quantity, 0);
  const totalOut = entries.filter((e) => e.quantity < 0).reduce((s, e) => s + Math.abs(e.quantity), 0);

  return (
    <div>
      <AdminPageHeader title="Inventory Timeline" subtitle="Complete stock movement history across all locations." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard icon={ArrowDown} label="Stock In" value={totalIn.toLocaleString()} accent="accent" />
            <StatCard icon={ArrowUp} label="Stock Out" value={totalOut.toLocaleString()} accent="error" />
            <StatCard icon={Clock} label="Total Events" value={entries.length} accent="gold" />
            <StatCard icon={Clock} label="Net Movement" value={(totalIn - totalOut).toLocaleString()} accent="warning" />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search timeline…" className="input pl-11" />
        </div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto">
          <option value="">All types</option>
          <option value="purchase">Purchase</option>
          <option value="sale">Sale</option>
          <option value="transfer_in">Transfer In</option>
          <option value="transfer_out">Transfer Out</option>
          <option value="adjustment">Adjustment</option>
          <option value="return">Return</option>
        </Select>
      </div>

      <DataTable<InventoryTimelineEntry>
        loading={loading}
        rows={filtered}
        columns={[
          { key: 'created_at', label: 'Timestamp', render: (e) => <span className="text-ink-300 text-xs">{formatDateTime(e.created_at)}</span> },
          { key: 'product_name', label: 'Product', render: (e) => <div><p className="text-ink-100">{e.product_name}</p><p className="text-xs text-ink-500">{e.sku ?? '—'}</p></div> },
          { key: 'transaction_type', label: 'Type', render: (e) => <Badge color={TYPE_COLORS[e.transaction_type] ?? 'neutral'}>{e.transaction_type}</Badge> },
          { key: 'quantity', label: 'Qty', render: (e) => <span className={e.quantity >= 0 ? 'text-accent-400 font-semibold' : 'text-error-400 font-semibold'}>{e.quantity >= 0 ? '+' : ''}{e.quantity}</span> },
          { key: 'balance_after', label: 'Balance', render: (e) => <span className="text-ink-200">{e.balance_after}</span> },
          { key: 'location', label: 'Location', render: (e) => <span className="text-ink-300 text-xs">{e.warehouse_name ?? e.branch_name ?? '—'}</span> },
          { key: 'notes', label: 'Notes', render: (e) => <span className="text-ink-400 text-xs">{e.notes ?? '—'}</span> },
        ]}
      />
    </div>
  );
}
