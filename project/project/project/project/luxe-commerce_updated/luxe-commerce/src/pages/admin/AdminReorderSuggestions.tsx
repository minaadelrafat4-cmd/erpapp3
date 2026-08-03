import { useEffect, useState } from 'react';
import { ShoppingCart, TrendingDown, AlertTriangle, RefreshCw, XCircle, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable, StatCard } from '@/components/admin/AdminComponents';
import { Badge, Skeleton, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { ReorderSuggestionView, DeadStockEntry, FastMovingProduct, SlowMovingProduct } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

type Tab = 'reorder' | 'fast' | 'slow' | 'dead';

export default function AdminReorderSuggestions() {
  const { toast } = useToast();
  const { canEdit } = useAuth();
  const editable = canEdit('inventory.valuation');
  const [tab, setTab] = useState<Tab>('reorder');
  const [reorder, setReorder] = useState<ReorderSuggestionView[]>([]);
  const [deadStock, setDeadStock] = useState<DeadStockEntry[]>([]);
  const [fastMoving, setFastMoving] = useState<FastMovingProduct[]>([]);
  const [slowMoving, setSlowMoving] = useState<SlowMovingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      await loadAll();
      setLoading(false);
    })();
  }, []);

  const loadAll = async () => {
    const [reorderRes, deadRes, fastRes, slowRes] = await Promise.all([
      supabase.from('v_reorder_suggestions').select('*').order('urgency', { ascending: true }),
      supabase.from('v_dead_stock').select('*'),
      supabase.from('v_fast_moving_products').select('*').limit(50),
      supabase.from('v_slow_moving_products').select('*').limit(50),
    ]);
    setReorder((reorderRes.data ?? []) as unknown as ReorderSuggestionView[]);
    setDeadStock((deadRes.data ?? []) as unknown as DeadStockEntry[]);
    setFastMoving((fastRes.data ?? []) as unknown as FastMovingProduct[]);
    setSlowMoving((slowRes.data ?? []) as unknown as SlowMovingProduct[]);
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.rpc('generate_reorder_suggestions');
      if (error) throw error;
      toast('Reorder suggestions generated', 'success');
      await loadAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to generate suggestions', 'error');
    }
    setGenerating(false);
  };

  const dismiss = async (id: string) => {
    const { error } = await supabase.from('reorder_suggestions').update({ status: 'dismissed' }).eq('id', id);
    if (error) toast('Could not dismiss suggestion', 'error');
    else {
      toast('Suggestion dismissed', 'info');
      setReorder((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const totalEstimatedCost = reorder.filter((r) => r.status === 'pending').reduce((s, r) => s + Number(r.estimated_cost), 0);
  const criticalCount = reorder.filter((r) => r.urgency === 'critical').length;
  const deadStockValue = deadStock.reduce((s, d) => s + Number(d.tied_up_capital), 0);

  return (
    <div>
      <AdminPageHeader
        title="Inventory Intelligence"
        subtitle="Reorder suggestions, fast/slow/dead stock analysis"
        action={editable ? <Button onClick={generate} disabled={generating}><RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} /> {generating ? 'Generating…' : 'Generate Suggestions'}</Button> : undefined}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard icon={ShoppingCart} label="Pending Reorders" value={reorder.filter((r) => r.status === 'pending').length} accent="gold" />
            <StatCard icon={AlertTriangle} label="Critical (Out of Stock)" value={criticalCount} accent="error" />
            <StatCard icon={TrendingDown} label="Est. Reorder Cost" value={formatCurrency(totalEstimatedCost)} accent="warning" />
            <StatCard icon={TrendingDown} label="Dead Stock Value" value={formatCurrency(deadStockValue)} accent="error" />
          </>
        )}
      </div>

      <div className="flex gap-1 border-b border-white/10 mb-4 overflow-x-auto no-scrollbar">
        {([['reorder', `Reorder Suggestions (${reorder.length})`], ['fast', `Fast Moving (${fastMoving.length})`], ['slow', `Slow Moving (${slowMoving.length})`], ['dead', `Dead Stock (${deadStock.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-5 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${tab === k ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-100'}`}>{label}</button>
        ))}
      </div>

      {tab === 'reorder' && (
        loading ? <Skeleton className="h-64" /> : reorder.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="w-10 h-10" />} title="No reorder suggestions" description="Click 'Generate Suggestions' to scan inventory and create reorder recommendations." />
        ) : (
          <DataTable<ReorderSuggestionView & { id: string }>
            rows={reorder}
            columns={[
              { key: 'product_name', label: 'Product', render: (r) => <div><p className="font-medium text-ink-100">{r.product_name}</p><p className="text-xs text-ink-500">{r.sku ?? '—'}</p></div> },
              { key: 'warehouse_name', label: 'Location', render: (r) => <span className="text-ink-300 text-sm">{r.warehouse_name ?? r.branch_name ?? 'All'}</span> },
              { key: 'current_stock', label: 'Current', render: (r) => <span className="text-error-400 font-semibold">{r.current_stock}</span> },
              { key: 'reorder_point', label: 'Reorder At' },
              { key: 'suggested_quantity', label: 'Suggested Qty', render: (r) => <span className="text-accent-400 font-semibold">{r.suggested_quantity}</span> },
              { key: 'supplier_name', label: 'Supplier', render: (r) => <span className="text-ink-300 text-sm">{r.supplier_name ?? '—'}</span> },
              { key: 'estimated_cost', label: 'Est. Cost', render: (r) => <span className="text-ink-100">{formatCurrency(r.estimated_cost)}</span> },
              { key: 'urgency', label: 'Urgency', render: (r) => <Badge color={r.urgency === 'critical' ? 'error' : r.urgency === 'high' ? 'warning' : r.urgency === 'medium' ? 'gold' : 'neutral'}>{r.urgency}</Badge> },
              { key: 'status', label: 'Status', render: (r) => <Badge color={r.status === 'pending' ? 'gold' : r.status === 'ordered' ? 'accent' : 'neutral'}>{r.status}</Badge> },
              { key: 'actions', label: '', render: (r) => r.status === 'pending' && editable ? <button onClick={() => dismiss(r.id)} className="text-ink-400 hover:text-error-500" title="Dismiss"><XCircle className="w-4 h-4" /></button> : null },
            ]}
          />
        )
      )}

      {tab === 'fast' && (
        loading ? <Skeleton className="h-64" /> : fastMoving.length === 0 ? (
          <EmptyState icon={<Zap className="w-10 h-10" />} title="No fast-moving products" description="Products with 10+ sales in the last 30 days will appear here." />
        ) : (
          <DataTable<FastMovingProduct & { id: string }>
            rows={fastMoving.map((f) => ({ ...f, id: f.product_id }))}
            columns={[
              { key: 'product_name', label: 'Product', render: (f) => <div><p className="font-medium text-ink-100">{f.product_name}</p><p className="text-xs text-ink-500">{f.sku}</p></div> },
              { key: 'category_name', label: 'Category', render: (f) => <Badge color="neutral">{f.category_name ?? '—'}</Badge> },
              { key: 'stock', label: 'Current Stock', render: (f) => <span className="text-ink-100 font-semibold">{f.stock}</span> },
              { key: 'qty_sold_30d', label: 'Sold (30d)', render: (f) => <span className="text-accent-400 font-semibold">{f.qty_sold_30d}</span> },
              { key: 'revenue_30d', label: 'Revenue (30d)', render: (f) => <span className="text-gold-300">{formatCurrency(f.revenue_30d)}</span> },
              { key: 'turnover_ratio', label: 'Turnover Ratio', render: (f) => <span className="text-ink-200">{f.turnover_ratio?.toFixed(2) ?? '—'}x</span> },
            ]}
          />
        )
      )}

      {tab === 'slow' && (
        loading ? <Skeleton className="h-64" /> : slowMoving.length === 0 ? (
          <EmptyState icon={<TrendingDown className="w-10 h-10" />} title="No slow-moving products" description="Products with 1-9 sales in 30 days and stock > 0 will appear here." />
        ) : (
          <DataTable<SlowMovingProduct & { id: string }>
            rows={slowMoving.map((s) => ({ ...s, id: s.product_id }))}
            columns={[
              { key: 'product_name', label: 'Product', render: (s) => <div><p className="font-medium text-ink-100">{s.product_name}</p><p className="text-xs text-ink-500">{s.sku}</p></div> },
              { key: 'category_name', label: 'Category', render: (s) => <Badge color="neutral">{s.category_name ?? '—'}</Badge> },
              { key: 'stock', label: 'Stock', render: (s) => <span className="text-warning-400 font-semibold">{s.stock}</span> },
              { key: 'qty_sold_30d', label: 'Sold (30d)', render: (s) => <span className="text-ink-300">{s.qty_sold_30d}</span> },
              { key: 'revenue_30d', label: 'Revenue (30d)', render: (s) => <span className="text-ink-200">{formatCurrency(s.revenue_30d)}</span> },
              { key: 'tied_up_capital', label: 'Tied-up Capital', render: (s) => <span className="text-error-400">{formatCurrency(s.tied_up_capital)}</span> },
            ]}
          />
        )
      )}

      {tab === 'dead' && (
        loading ? <Skeleton className="h-64" /> : deadStock.length === 0 ? (
          <EmptyState icon={<TrendingDown className="w-10 h-10" />} title="No dead stock" description="Products with zero sales in 90+ days will appear here." />
        ) : (
          <DataTable<DeadStockEntry & { id: string }>
            rows={deadStock.map((d) => ({ ...d, id: d.product_id }))}
            columns={[
              { key: 'product_name', label: 'Product', render: (d) => <div><p className="font-medium text-ink-100">{d.product_name}</p><p className="text-xs text-ink-500">{d.sku}</p></div> },
              { key: 'category_name', label: 'Category', render: (d) => <Badge color="neutral">{d.category_name ?? '—'}</Badge> },
              { key: 'stock', label: 'Stock', render: (d) => <span className="text-error-400 font-semibold">{d.stock}</span> },
              { key: 'tied_up_capital', label: 'Tied-up Capital', render: (d) => <span className="text-error-400 font-bold">{formatCurrency(d.tied_up_capital)}</span> },
              { key: 'first_stocked', label: 'First Stocked', render: (d) => <span className="text-ink-400 text-xs">{formatDate(d.first_stocked)}</span> },
            ]}
          />
        )
      )}
    </div>
  );
}
