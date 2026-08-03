import { useEffect, useState } from 'react';
import { ClipboardCheck, Plus, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable, StatCard } from '@/components/admin/AdminComponents';
import { Badge, Skeleton, EmptyState } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select, Input } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { CycleCount, CycleCountItem, Product, Warehouse, Branch } from '@/types';
import { formatDateTime, formatCurrency } from '@/lib/utils';

export default function AdminCycleCounts() {
  const { toast } = useToast();
  const { canEdit } = useAuth();
  const editable = canEdit('inventory.valuation');
  const [counts, setCounts] = useState<CycleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ warehouse_id: '', branch_id: '', count_type: 'partial', notes: '' });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<CycleCount | null>(null);
  const [items, setItems] = useState<(CycleCountItem & { product?: Product })[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: cc }, { data: whs }, { data: brs }] = await Promise.all([
        supabase.from('cycle_counts').select('*').order('created_at', { ascending: false }),
        supabase.from('warehouses').select('*').order('name'),
        supabase.from('branches').select('*').order('name'),
      ]);
      setCounts((cc ?? []) as CycleCount[]);
      setWarehouses((whs ?? []) as Warehouse[]);
      setBranches((brs ?? []) as Branch[]);
      setLoading(false);
    })();
  }, []);

  const createCount = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('create_cycle_count', {
        p_warehouse_id: form.warehouse_id || null,
        p_branch_id: form.branch_id || null,
        p_count_type: form.count_type,
        p_notes: form.notes || null,
      });
      if (error) throw error;
      toast('Cycle count created', 'success');
      setCreateOpen(false);
      setForm({ warehouse_id: '', branch_id: '', count_type: 'partial', notes: '' });
      const { data: updated } = await supabase.from('cycle_counts').select('*').order('created_at', { ascending: false });
      setCounts((updated ?? []) as CycleCount[]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create cycle count', 'error');
    }
    setSaving(false);
  };

  const viewItems = async (cc: CycleCount) => {
    setSelected(cc);
    setItemsLoading(true);
    const { data } = await supabase.from('cycle_count_items').select('*').eq('cycle_count_id', cc.id);
    const itemRows = (data ?? []) as CycleCountItem[];
    if (itemRows.length) {
      const pIds = [...new Set(itemRows.map((i) => i.product_id))];
      const { data: prods } = await supabase.from('products').select('*').in('id', pIds);
      const pMap = Object.fromEntries((prods ?? []).map((p) => [p.id, p]));
      setItems(itemRows.map((i) => ({ ...i, product: pMap[i.product_id] })));
    } else setItems([]);
    setItemsLoading(false);
  };

  const submitCount = async (itemId: string, countedQty: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || !selected) return;
    const { error } = await supabase.rpc('submit_cycle_count_item', {
      p_cycle_count_id: selected.id,
      p_product_id: item.product_id,
      p_counted_quantity: countedQty,
    });
    if (error) toast('Failed to submit count', 'error');
    else {
      toast('Count submitted', 'success');
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, counted_quantity: countedQty } : i)));
    }
  };

  const completeCount = async () => {
    if (!selected) return;
    try {
      const { data, error } = await supabase.rpc('complete_cycle_count', { p_cycle_count_id: selected.id });
      if (error) throw error;
      toast('Cycle count completed — stock adjusted', 'success');
      const result = data as { adjusted_items: number; total_variance: number };
      setSelected((prev) => (prev ? { ...prev, status: 'completed', completed_at: new Date().toISOString(), variance_total: result.total_variance } : null));
      setCounts((prev) => prev.map((c) => (c.id === selected.id ? { ...c, status: 'completed', completed_at: new Date().toISOString() } : c)));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to complete cycle count', 'error');
    }
  };

  const inProgress = counts.filter((c) => c.status === 'in_progress').length;
  const completed = counts.filter((c) => c.status === 'completed').length;
  const totalVariance = counts.reduce((s, c) => s + c.variance_total, 0);

  return (
    <div>
      <AdminPageHeader title="Cycle Counts" subtitle="Physical stock counting and reconciliation" action={editable ? <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> New Count</Button> : undefined} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard icon={ClipboardCheck} label="Total Counts" value={counts.length} accent="gold" />
            <StatCard icon={Clock} label="In Progress" value={inProgress} accent="warning" />
            <StatCard icon={CheckCircle2} label="Completed" value={completed} accent="accent" />
            <StatCard icon={AlertTriangle} label="Total Variance" value={totalVariance} accent="error" />
          </>
        )}
      </div>

      {loading ? <Skeleton className="h-64" /> : counts.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="w-10 h-10" />} title="No cycle counts yet" description="Create a cycle count to start physical stock reconciliation." action={editable ? <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> New Count</Button> : undefined} />
      ) : (
        <DataTable<CycleCount>
          rows={counts}
          columns={[
            { key: 'cycle_number', label: 'Count #', render: (c) => <span className="font-mono text-gold-300">{c.cycle_number}</span> },
            { key: 'count_type', label: 'Type', render: (c) => <Badge color="neutral">{c.count_type}</Badge> },
            { key: 'location', label: 'Location', render: (c) => {
              const wh = warehouses.find((w) => w.id === c.warehouse_id);
              const br = branches.find((b) => b.id === c.branch_id);
              return <span className="text-ink-300 text-sm">{wh?.name ?? br?.name ?? 'All locations'}</span>;
            } },
            { key: 'status', label: 'Status', render: (c) => <Badge color={c.status === 'completed' ? 'success' : c.status === 'in_progress' ? 'warning' : 'neutral'}>{c.status.replace(/_/g, ' ')}</Badge> },
            { key: 'variance_total', label: 'Variance', render: (c) => <span className={c.variance_total === 0 ? 'text-ink-400' : c.variance_total > 0 ? 'text-accent-400' : 'text-error-400'}>{c.variance_total > 0 ? '+' : ''}{c.variance_total}</span> },
            { key: 'variance_value_total', label: 'Value Impact', render: (c) => <span className="text-ink-200">{formatCurrency(c.variance_value_total)}</span> },
            { key: 'created_at', label: 'Created', render: (c) => <span className="text-ink-400 text-xs">{formatDateTime(c.created_at)}</span> },
            { key: 'actions', label: '', render: (c) => <button onClick={() => viewItems(c)} className="text-gold-300 hover:text-gold-200 text-sm">View →</button> },
          ]}
        />
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Cycle Count" size="md">
        <div className="space-y-4">
          <Select label="Warehouse (optional)" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value, branch_id: '' })}>
            <option value="">— All / Branch —</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
          {!form.warehouse_id && (
            <Select label="Branch (optional)" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
              <option value="">— All Locations —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          <Select label="Count Type" value={form.count_type} onChange={(e) => setForm({ ...form, count_type: e.target.value })}>
            <option value="partial">Partial</option>
            <option value="full">Full</option>
            <option value="abc">ABC Analysis</option>
            <option value="random">Random Sample</option>
            <option value="spot">Spot Count</option>
          </Select>
          <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
          <Button onClick={createCount} disabled={saving} className="w-full">{saving ? 'Creating…' : 'Create Cycle Count'}</Button>
        </div>
      </Modal>

      {/* Items modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Cycle Count ${selected.cycle_number}` : ''} size="xl">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge color={selected.status === 'completed' ? 'success' : 'warning'}>{selected.status.replace(/_/g, ' ')}</Badge>
                <Badge color="neutral">{selected.count_type}</Badge>
              </div>
              {selected.status === 'in_progress' && editable && (
                <Button onClick={completeCount} size="sm"><CheckCircle2 className="w-4 h-4" /> Complete & Reconcile</Button>
              )}
            </div>

            {itemsLoading ? <Skeleton className="h-40" /> : items.length === 0 ? (
              <p className="text-ink-400 text-sm">No items in this cycle count.</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-auto">
                {items.map((item) => (
                  <div key={item.id} className="glass rounded-xl p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-ink-100">{item.product?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-ink-500">{item.product?.sku ?? '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-ink-500">System</p>
                      <p className="text-sm font-semibold text-ink-200">{item.system_quantity}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-ink-500">Counted</p>
                      {item.counted_quantity !== null ? (
                        <p className="text-sm font-semibold text-ink-100">{item.counted_quantity}</p>
                      ) : (
                        <input
                          type="number"
                          placeholder="—"
                          className="input w-20 py-1 text-sm text-center"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              submitCount(item.id, parseInt((e.target as HTMLInputElement).value, 10) || 0);
                            }
                          }}
                        />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-ink-500">Variance</p>
                      <p className={`text-sm font-semibold ${item.counted_quantity === null ? 'text-ink-500' : item.variance === 0 ? 'text-ink-200' : item.variance > 0 ? 'text-accent-400' : 'text-error-400'}`}>
                        {item.counted_quantity !== null ? (item.variance > 0 ? '+' : '') + item.variance : '—'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-ink-500">Value</p>
                      <p className="text-xs text-ink-400">{formatCurrency(Math.abs(item.variance_value))}</p>
                    </div>
                    {item.is_reconciled && <Badge color="success">Reconciled</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
