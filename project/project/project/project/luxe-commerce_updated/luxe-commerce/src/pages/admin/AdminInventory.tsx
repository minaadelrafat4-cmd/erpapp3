import { useEffect, useState, useCallback } from 'react';
import { 
  Search, AlertTriangle, Package, DollarSign, TrendingUp, Bell, Zap, Clock, 
  ArrowRightLeft, PlusCircle, SlidersHorizontal, RefreshCw 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  getInventorySummary, executeWarehouseTransfer, receiveInventory, adjustInventory 
} from '@/lib/inventoryService';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable, StatCard } from '@/components/admin/AdminComponents';
import { ProductPicker } from '@/components/admin/ProductPicker';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import type { Product, Inventory, Branch, Warehouse, StockAlert, InventoryValuation, InventoryAgingEntry } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { matchesProductQuery } from '@/lib/productSearch';
import { useAuth } from '@/context/AuthContext';

type InventoryTab = 'stock' | 'valuation' | 'alerts' | 'aging';

export default function AdminInventory() {
  const { canEdit } = useAuth();
  const editable = canEdit('inventory.valuation');
  const [rows, setRows] = useState<(Inventory & { product?: Product; branch?: Branch; warehouse?: Warehouse })[]>([]);
  const [productList, setProductList] = useState<Product[]>([]);
  const [valuations, setValuations] = useState<InventoryValuation[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [aging, setAging] = useState<InventoryAgingEntry[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<InventoryTab>('stock');
  const [selectedAlert, setSelectedAlert] = useState<StockAlert | null>(null);

  // Modal States
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    productId: '',
    fromWarehouseId: '',
    toBranchId: '',
    quantity: 1,
  });

  // Receive Form State
  const [receiveForm, setReceiveForm] = useState({
    productId: '',
    locationId: '',
    isWarehouse: true,
    quantity: 1,
  });

  // Adjust Form State
  const [adjustForm, setAdjustForm] = useState({
    productId: '',
    locationId: '',
    isWarehouse: true,
    quantityDelta: 0,
    reason: 'correction',
  });

  const fetchInventoryData = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, { data: prods }, { data: brs }, { data: whs }, { data: val }, { data: alts }, { data: agingData }] = await Promise.all([
        getInventorySummary(),
        supabase.from('products').select('*'),
        supabase.from('branches').select('*'),
        supabase.from('warehouses').select('*'),
        supabase.from('v_inventory_valuation').select('*').limit(100),
        supabase.from('stock_alerts').select('*').eq('is_resolved', false).order('created_at', { ascending: false }).limit(50),
        supabase.from('v_inventory_aging').select('*').limit(200),
      ]);

      const pMap = Object.fromEntries((prods ?? []).map((p) => [p.id, p]));
      const bMap = Object.fromEntries((brs ?? []).map((b) => [b.id, b]));
      const wMap = Object.fromEntries((whs ?? []).map((w) => [w.id, w]));

      setBranches(brs ?? []);
      setWarehouses(whs ?? []);
      setProductList((prods ?? []) as Product[]);
      setRows((inv ?? []).map((i) => ({ 
        ...(i as Inventory), 
        product: pMap[(i as Inventory).product_id], 
        branch: bMap[(i as Inventory).branch_id ?? ''], 
        warehouse: wMap[(i as Inventory).warehouse_id ?? ''] 
      })));
      setValuations((val ?? []) as InventoryValuation[]);
      setAlerts((alts ?? []) as StockAlert[]);
      setAging((agingData ?? []) as unknown as InventoryAgingEntry[]);
    } catch (error) {
      console.error('Failed to load inventory data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  const filtered = rows.filter((r) => matchesProductQuery(r.product ?? {}, query));

  const totalUnits = rows.reduce((s, r) => s + r.quantity_on_hand, 0);
  const totalValue = valuations.reduce((s, v) => s + Number(v.total_cost_value), 0);
  const totalRetail = valuations.reduce((s, v) => s + Number(v.total_retail_value), 0);

  const resolveAlert = async (id: string) => {
    await supabase.rpc('resolve_stock_alert', { p_alert_id: id });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setSelectedAlert(null);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.productId) { alert('Please select a product'); return; }
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    setActionLoading(true);
    try {
      await executeWarehouseTransfer({
        productId: transferForm.productId,
        fromWarehouseId: transferForm.fromWarehouseId,
        toBranchId: transferForm.toBranchId,
        quantity: transferForm.quantity,
        userId: user.id,
      });
      setTransferModalOpen(false);
      await fetchInventoryData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveForm.productId) { alert('Please select a product'); return; }
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    setActionLoading(true);
    try {
      await receiveInventory({
        productId: receiveForm.productId,
        locationId: receiveForm.locationId,
        isWarehouse: receiveForm.isWarehouse,
        quantity: receiveForm.quantity,
        userId: user.id,
      });
      setReceiveModalOpen(false);
      await fetchInventoryData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Stock receiving failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm.productId) { alert('Please select a product'); return; }
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    setActionLoading(true);
    try {
      await adjustInventory({
        productId: adjustForm.productId,
        locationId: adjustForm.locationId,
        isWarehouse: adjustForm.isWarehouse,
        quantityDelta: adjustForm.quantityDelta,
        reason: adjustForm.reason,
        userId: user.id,
      });
      setAdjustModalOpen(false);
      await fetchInventoryData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Adjustment failed');
    } finally {
      setActionLoading(false);
    }
  };

  const fastCount = aging.filter((a) => a.movement_category === 'fast').length;
  const slowCount = aging.filter((a) => a.movement_category === 'slow').length;
  const deadCount = aging.filter((a) => a.movement_category === 'dead').length;

  return (
    <div>
      <AdminPageHeader 
        title="Inventory" 
        subtitle="Track stock across branches and warehouses." 
      />

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard icon={Package} label="Total Units" value={totalUnits.toLocaleString()} accent="gold" />
            <StatCard icon={DollarSign} label="Cost Value" value={formatCurrency(totalValue)} accent="accent" />
            <StatCard icon={TrendingUp} label="Retail Value" value={formatCurrency(totalRetail)} accent="gold" />
            <StatCard icon={AlertTriangle} label="Active Alerts" value={alerts.length} accent="warning" />
          </>
        )}
      </div>

      {/* Movement summary */}
      {!loading && aging.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center text-accent-400"><Zap className="w-5 h-5" /></div>
            <div><p className="text-xl font-bold text-ink-50">{fastCount}</p><p className="text-xs text-ink-400">Fast Moving</p></div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning-500/10 flex items-center justify-center text-warning-400"><Clock className="w-5 h-5" /></div>
            <div><p className="text-xl font-bold text-ink-50">{slowCount}</p><p className="text-xs text-ink-400">Slow Moving</p></div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-error-500/10 flex items-center justify-center text-error-400"><AlertTriangle className="w-5 h-5" /></div>
            <div><p className="text-xl font-bold text-ink-50">{deadCount}</p><p className="text-xs text-ink-400">Dead Stock</p></div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 mb-4 overflow-x-auto no-scrollbar">
        {([['stock', 'Stock Levels'], ['valuation', 'Inventory Valuation'], ['alerts', `Stock Alerts (${alerts.length})`], ['aging', 'Aging & Movement']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-5 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${tab === k ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-100'}`}>{label}</button>
        ))}
      </div>

      {tab === 'stock' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search inventory by name or SKU…" className="input pl-11" />
            </div>

            {/* Inventory Action Buttons */}
            <div className="flex items-center gap-2">
              {canEdit('inventory.transfer') && (
                <button onClick={() => setTransferModalOpen(true)} className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-gold-300" /> Transfer
                </button>
              )}
              {editable && (
                <button onClick={() => setReceiveModalOpen(true)} className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3">
                  <PlusCircle className="w-3.5 h-3.5 text-accent-400" /> Receive
                </button>
              )}
              {editable && (
                <button onClick={() => setAdjustModalOpen(true)} className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-warning-400" /> Adjust
                </button>
              )}
              <button onClick={fetchInventoryData} className="btn-secondary py-2 px-2.5 text-xs" title="Refresh">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <DataTable
            loading={loading}
            rows={filtered}
            columns={[
              { key: 'product', label: 'Product', render: (r) => <div><p className="font-medium text-ink-100">{r.product?.name ?? '—'}</p><p className="text-xs text-ink-500">{r.product?.sku ?? '—'}</p></div> },
              { key: 'location', label: 'Location', render: (r) => (
                <div className="flex items-center gap-1.5">
                  <Badge color={r.warehouse ? 'neutral' : 'gold'}>
                    {r.warehouse ? 'WH' : 'BR'}
                  </Badge>
                  <span className="text-ink-300">{r.warehouse?.name ?? r.branch?.name ?? '—'}</span>
                </div>
              )},
              { key: 'batch_number', label: 'Batch', render: (r) => <span className="font-mono text-xs text-ink-400">{r.batch_number ?? '—'}</span> },
              { key: 'expiry_date', label: 'Expiry', render: (r) => <span className="text-ink-300 text-xs">{r.expiry_date ? formatDate(r.expiry_date) : '—'}</span> },
              { key: 'quantity_on_hand', label: 'On Hand', render: (r) => <span className="font-semibold text-ink-100">{r.quantity_on_hand}</span> },
              { key: 'quantity_reserved', label: 'Reserved', render: (r) => <span className="text-ink-400">{r.quantity_reserved}</span> },
              { key: 'available', label: 'Available', render: (r) => <span className="text-accent-400 font-semibold">{r.quantity_on_hand - r.quantity_reserved}</span> },
              { key: 'reorder_point', label: 'Reorder At' },
              { key: 'status', label: 'Status', render: (r) => <Badge color={r.quantity_on_hand === 0 ? 'error' : r.quantity_on_hand <= r.reorder_point ? 'warning' : 'success'}>{r.quantity_on_hand === 0 ? 'Out' : r.quantity_on_hand <= r.reorder_point ? 'Low' : 'OK'}</Badge> },
            ]}
          />
        </>
      )}

      {tab === 'valuation' && (
        <DataTable<InventoryValuation & { id: string }>
          loading={loading}
          rows={valuations.map((v) => ({ ...v, id: v.product_id }))}
          columns={[
            { key: 'product_name', label: 'Product', render: (v) => <div><p className="font-medium text-ink-100">{v.product_name}</p><p className="text-xs text-ink-500">{v.sku ?? '—'}</p></div> },
            { key: 'total_on_hand', label: 'On Hand', render: (v) => <span className="font-semibold text-ink-100">{v.total_on_hand}</span> },
            { key: 'total_available', label: 'Available', render: (v) => <span className="text-accent-400">{v.total_available}</span> },
            { key: 'avg_unit_cost', label: 'Unit Cost', render: (v) => <span className="text-ink-300">{formatCurrency(v.avg_unit_cost)}</span> },
            { key: 'total_cost_value', label: 'Cost Value', render: (v) => <span className="text-ink-100">{formatCurrency(v.total_cost_value)}</span> },
            { key: 'total_retail_value', label: 'Retail Value', render: (v) => <span className="text-gold-300">{formatCurrency(v.total_retail_value)}</span> },
            { key: 'total_potential_profit', label: 'Potential Profit', render: (v) => <span className="text-accent-400 font-semibold">{formatCurrency(v.total_potential_profit)}</span> },
          ]}
        />
      )}

      {tab === 'alerts' && (
        <div>
          {loading ? <Skeleton className="h-32" /> : alerts.length === 0 ? (
            <div className="glass-card p-8 text-center text-ink-400"><Bell className="w-8 h-8 mx-auto mb-2 text-accent-400" /><p>No active stock alerts — all inventory is healthy.</p></div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className={`glass-card p-4 flex items-start gap-3 ${a.severity === 'critical' ? 'border-error-500/30' : ''}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.severity === 'critical' ? 'bg-error-500/15 text-error-400' : a.severity === 'warning' ? 'bg-warning-500/15 text-warning-400' : 'bg-white/5 text-ink-400'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge color={a.alert_type === 'out_of_stock' ? 'error' : a.alert_type === 'expired' ? 'error' : 'warning'}>{a.alert_type}</Badge>
                      <span className="text-sm text-ink-100">{a.message}</span>
                    </div>
                    {a.quantity !== null && <p className="text-xs text-ink-400 mt-1">Current: {a.quantity} / Threshold: {a.threshold ?? '—'}</p>}
                    <p className="text-xs text-ink-500 mt-1">{formatDate(a.created_at)}</p>
                  </div>
                  <button onClick={() => setSelectedAlert(a)} className="text-gold-300 hover:text-gold-200 text-sm shrink-0">Resolve →</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'aging' && (
        <DataTable<InventoryAgingEntry & { id: string }>
          loading={loading}
          rows={aging.map((a) => ({ ...a, id: a.product_id }))}
          columns={[
            { key: 'product_name', label: 'Product', render: (a) => <div><p className="font-medium text-ink-100">{a.product_name}</p><p className="text-xs text-ink-500">{a.sku ?? '—'}</p></div> },
            { key: 'category_name', label: 'Category', render: (a) => <Badge color="neutral">{a.category_name ?? '—'}</Badge> },
            { key: 'stock', label: 'Stock', render: (a) => <span className="font-semibold text-ink-100">{a.stock}</span> },
            { key: 'stock_value', label: 'Stock Value', render: (a) => <span className="text-gold-300">{formatCurrency(a.stock_value)}</span> },
            { key: 'total_sold_30d', label: 'Sold (30d)', render: (a) => <span className="text-ink-200">{a.total_sold_30d}</span> },
            { key: 'movement_category', label: 'Movement', render: (a) => (
              <Badge color={a.movement_category === 'fast' ? 'accent' : a.movement_category === 'medium' ? 'gold' : a.movement_category === 'slow' ? 'warning' : 'error'}>
                {a.movement_category === 'fast' && <Zap className="w-3 h-3" />}
                {a.movement_category}
              </Badge>
            ) },
            { key: 'days_of_supply', label: 'Days of Supply', render: (a) => <span className="text-ink-300">{a.days_of_supply === 999 ? '∞' : a.days_of_supply}</span> },
          ]}
        />
      )}

      {/* Transfer Stock Modal */}
      <Modal open={transferModalOpen} onClose={() => setTransferModalOpen(false)} title="Transfer Stock" size="md">
        <form onSubmit={handleExecuteTransfer} className="space-y-4">
          <ProductPicker
            label="Product"
            required
            products={productList}
            value={transferForm.productId}
            onChange={(productId) => setTransferForm({ ...transferForm, productId })}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-300 mb-1">From Warehouse</label>
              <select required value={transferForm.fromWarehouseId} onChange={(e) => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })} className="input">
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-300 mb-1">To Branch</label>
              <select required value={transferForm.toBranchId} onChange={(e) => setTransferForm({ ...transferForm, toBranchId: e.target.value })} className="input">
                <option value="">Select Branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-300 mb-1">Quantity</label>
            <input type="number" min="1" required value={transferForm.quantity} onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })} className="input" />
          </div>
          <button type="submit" disabled={actionLoading} className="btn-primary w-full py-2.5">
            {actionLoading ? 'Executing Transfer…' : 'Execute Transfer'}
          </button>
        </form>
      </Modal>

      {/* Receive Stock Modal */}
      <Modal open={receiveModalOpen} onClose={() => setReceiveModalOpen(false)} title="Receive Stock" size="md">
        <form onSubmit={handleReceiveStock} className="space-y-4">
          <ProductPicker
            label="Product"
            required
            products={productList}
            value={receiveForm.productId}
            onChange={(productId) => setReceiveForm({ ...receiveForm, productId })}
          />
          <div>
            <label className="block text-xs font-medium text-ink-300 mb-1">Location Type</label>
            <select value={receiveForm.isWarehouse ? 'wh' : 'br'} onChange={(e) => setReceiveForm({ ...receiveForm, isWarehouse: e.target.value === 'wh', locationId: '' })} className="input">
              <option value="wh">Warehouse</option>
              <option value="br">Branch</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-300 mb-1">Destination Location</label>
            <select required value={receiveForm.locationId} onChange={(e) => setReceiveForm({ ...receiveForm, locationId: e.target.value })} className="input">
              <option value="">Select Location</option>
              {receiveForm.isWarehouse
                ? warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)
                : branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-300 mb-1">Quantity Received</label>
            <input type="number" min="1" required value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: Number(e.target.value) })} className="input" />
          </div>
          <button type="submit" disabled={actionLoading} className="btn-primary w-full py-2.5">
            {actionLoading ? 'Receiving Stock…' : 'Receive Stock'}
          </button>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal open={adjustModalOpen} onClose={() => setAdjustModalOpen(false)} title="Adjust Stock" size="md">
        <form onSubmit={handleAdjustStock} className="space-y-4">
          <ProductPicker
            label="Product"
            required
            products={productList}
            value={adjustForm.productId}
            onChange={(productId) => setAdjustForm({ ...adjustForm, productId })}
          />
          <div>
            <label className="block text-xs font-medium text-ink-300 mb-1">Location Type</label>
            <select value={adjustForm.isWarehouse ? 'wh' : 'br'} onChange={(e) => setAdjustForm({ ...adjustForm, isWarehouse: e.target.value === 'wh', locationId: '' })} className="input">
              <option value="wh">Warehouse</option>
              <option value="br">Branch</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-300 mb-1">Location</label>
            <select required value={adjustForm.locationId} onChange={(e) => setAdjustForm({ ...adjustForm, locationId: e.target.value })} className="input">
              <option value="">Select Location</option>
              {adjustForm.isWarehouse
                ? warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)
                : branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-300 mb-1">Adjustment Delta (+/-)</label>
              <input type="number" required value={adjustForm.quantityDelta} onChange={(e) => setAdjustForm({ ...adjustForm, quantityDelta: Number(e.target.value) })} className="input" placeholder="e.g. -5 or 10" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-300 mb-1">Reason</label>
              <select value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} className="input">
                <option value="correction">Correction</option>
                <option value="damage">Damaged Goods</option>
                <option value="shrinkage">Shrinkage / Theft</option>
                <option value="audit">Audit Balance</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={actionLoading} className="btn-primary w-full py-2.5">
            {actionLoading ? 'Saving Adjustment…' : 'Save Adjustment'}
          </button>
        </form>
      </Modal>

      {/* Resolve Alert Modal */}
      <Modal open={!!selectedAlert} onClose={() => setSelectedAlert(null)} title="Resolve Alert" size="sm">
        {selectedAlert && (
          <div className="space-y-4">
            <p className="text-ink-300">Mark this <span className="text-gold-300">{selectedAlert.alert_type}</span> alert as resolved?</p>
            <p className="text-sm text-ink-400">{selectedAlert.message}</p>
            {editable && <button onClick={() => resolveAlert(selectedAlert.id)} className="btn-primary w-full py-2.5">Resolve Alert</button>}
          </div>
        )}
      </Modal>
    </div>
  );
}