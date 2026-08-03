import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Building2, Package, Activity } from 'lucide-react';
import { useAdminTable } from '@/hooks/useAdminTable';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable, StatCard } from '@/components/admin/AdminComponents';
import { Button } from '@/components/ui/Button';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Warehouse, Inventory, InventoryTransaction } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function AdminWarehouses() {
  const { rows, loading, remove } = useAdminTable<Warehouse>('warehouses', 'name', true);
  const { toast } = useToast();
  const { canEdit } = useAuth();
  const editable = canEdit('warehouses.manage');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Warehouse | null>(null);
  const [invCount, setInvCount] = useState(0);
  const [invValue, setInvValue] = useState(0);
  const [tab, setTab] = useState<'summary' | 'history' | 'valuation'>('summary');
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const filtered = rows.filter((w) => [w.name, w.code, w.city].join(' ').toLowerCase().includes(query.toLowerCase()));

  const viewInventory = async (w: Warehouse) => {
    setSelected(w);
    setTab('summary');
    const [{ data, error }, { data: valData }] = await Promise.all([
      supabase.from('inventory').select('quantity_on_hand, product_id').eq('warehouse_id', w.id),
      supabase.from('v_inventory_valuation').select('*').limit(100),
    ]);
    if (!error && data) {
      const items = data as Pick<Inventory, 'quantity_on_hand'>[];
      setInvCount(items.length);
      setInvValue(items.reduce((s, i) => s + i.quantity_on_hand, 0));
    }
  };

  const loadHistory = async (w: Warehouse) => {
    setHistoryLoading(true);
    const { data } = await supabase.from('inventory_transactions').select('*').eq('warehouse_id', w.id).order('created_at', { ascending: false }).limit(100);
    setTransactions((data ?? []) as InventoryTransaction[]);
    setHistoryLoading(false);
  };

  return (
    <div>
      <AdminPageHeader title="Warehouses" subtitle={`${rows.length} warehouses`} action={editable ? <Button><Plus className="w-4 h-4" /> Add Warehouse</Button> : undefined} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard icon={Building2} label="Total Warehouses" value={rows.length} accent="gold" />
            <StatCard icon={Building2} label="Active" value={rows.filter((w) => w.is_active).length} accent="accent" />
            <StatCard icon={Package} label="Total Capacity" value={rows.reduce((s, w) => s + (w.capacity ?? 0), 0).toLocaleString()} accent="warning" />
            <StatCard icon={Building2} label="Countries" value={new Set(rows.map((w) => w.country)).size} accent="gold" />
          </>
        )}
      </div>

      <div className="max-w-md mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search warehouses…" className="input pl-11" />
        </div>
      </div>

      <DataTable<Warehouse>
        loading={loading}
        rows={filtered}
        columns={[
          { key: 'name', label: 'Warehouse', render: (w) => <div><p className="font-medium text-ink-100">{w.name}</p><p className="text-xs text-ink-500 font-mono">{w.code}</p></div> },
          { key: 'address', label: 'Location', render: (w) => <span className="text-ink-300">{w.city}, {w.state ?? w.country}</span> },
          { key: 'manager', label: 'Manager', render: (w) => <span className="text-ink-300">{w.manager ?? '—'}</span> },
          { key: 'capacity', label: 'Capacity', render: (w) => <span className="text-ink-300">{w.capacity ? w.capacity.toLocaleString() : 'Unlimited'}</span> },
          { key: 'is_active', label: 'Status', render: (w) => <Badge color={w.is_active ? 'success' : 'neutral'}>{w.is_active ? 'Active' : 'Inactive'}</Badge> },
          { key: 'actions', label: '', render: (w) => (
            <div className="flex gap-2">
              <button onClick={() => viewInventory(w)} className="text-ink-400 hover:text-gold-300" title="View details"><Package className="w-4 h-4" /></button>
              {editable && <button className="text-ink-400 hover:text-gold-300"><Pencil className="w-4 h-4" /></button>}
              {editable && <button onClick={() => { remove(w.id); toast('Warehouse deleted', 'info'); }} className="text-ink-400 hover:text-error-500"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ) },
        ]}
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.name} — Warehouse Details` : ''} size="xl">
        {selected && (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-white/10">
              {([['summary', 'Summary'], ['history', 'Activity History'], ['valuation', 'Stock Valuation']] as const).map(([k, label]) => (
                <button key={k} onClick={() => {
                  setTab(k);
                  if (k === 'history') loadHistory(selected);
                }} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === k ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-100'}`}>{label}</button>
              ))}
            </div>

            {tab === 'summary' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass rounded-xl p-4"><p className="text-xs text-ink-500 uppercase">Products Stored</p><p className="text-2xl font-bold text-gold-300">{invCount}</p></div>
                  <div className="glass rounded-xl p-4"><p className="text-xs text-ink-500 uppercase">Total Units</p><p className="text-2xl font-bold text-gold-300">{invValue.toLocaleString()}</p></div>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-xs text-ink-500 uppercase mb-1">Manager</p><p className="text-ink-100">{selected.manager ?? '—'}</p>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-xs text-ink-500 uppercase mb-1">Address</p><p className="text-ink-100">{selected.address}, {selected.city}, {selected.state ?? ''} {selected.postal_code ?? ''}</p>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-xs text-ink-500 uppercase mb-1">Capacity</p><p className="text-ink-100">{selected.capacity ? selected.capacity.toLocaleString() : 'Unlimited'}</p>
                </div>
              </div>
            )}

            {tab === 'history' && (
              historyLoading ? <Skeleton className="h-40" /> : transactions.length === 0 ? (
                <p className="text-ink-400 text-sm">No activity recorded for this warehouse.</p>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-auto">
                  {transactions.map((t) => (
                    <div key={t.id} className="glass rounded-lg px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-gold-400" />
                        <div>
                          <p className="text-sm font-medium text-ink-100 capitalize">{t.transaction_type.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-ink-500">{t.notes ?? '—'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${t.quantity >= 0 ? 'text-accent-400' : 'text-error-400'}`}>{t.quantity >= 0 ? '+' : ''}{t.quantity}</p>
                        <p className="text-xs text-ink-500">Bal: {t.balance_after}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'valuation' && (
              <p className="text-ink-400 text-sm">Detailed stock valuation by product will appear here. Use the main Inventory page for full valuation across all locations.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
