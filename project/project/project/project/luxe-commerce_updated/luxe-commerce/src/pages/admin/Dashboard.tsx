import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, DollarSign, Package, Users, TrendingUp, TrendingDown, ArrowRight,
  Activity, Boxes, Building2, Warehouse, AlertTriangle, Award, UserCircle,
  Truck, FileText, BarChart3, Percent, Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { StatCard } from '@/components/admin/AdminComponents';
import { Skeleton, Badge } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';

interface DashboardSummary {
  today_revenue: number;
  month_revenue: number;
  year_revenue: number;
  month_profit: number;
  month_expenses: number;
  inventory_cost_value: number;
  inventory_retail_value: number;
  pending_orders: number;
  pending_transfers: number;
  pending_purchase_orders: number;
  low_stock_count: number;
  today_order_count: number;
}

interface RevenueChartPoint { sale_date: string; revenue: number; order_count: number }
interface TopProduct { product_id: string; product_name: string; sku: string | null; qty_sold: number; revenue: number; stock: number; price: number; category_name: string | null }
interface TopCustomer { customer_id: string; customer_name: string; email: string | null; lifetime_value: number; order_count: number; avg_order_value: number; last_order_date: string | null }
interface BranchComparison { branch_id: string; branch_name: string; branch_code: string; city: string | null; is_active: boolean; total_revenue: number; order_count: number; avg_order_value: number }
interface WarehouseComparison { warehouse_id: string; warehouse_name: string; warehouse_code: string; city: string | null; is_active: boolean; capacity: number | null; total_units: number; stock_cost_value: number; stock_retail_value: number; product_count: number; utilization_pct: number }
interface EmployeePerf { employee_id: string; employee_name: string; email: string | null; position: string | null; branch_name: string | null; total_sales: number; order_count: number; avg_sale_value: number }
interface LowStockProduct { id: string; name: string; sku: string | null; stock: number; low_stock_threshold: number }

export default function AdminDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [revenueChart, setRevenueChart] = useState<RevenueChartPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [worstProducts, setWorstProducts] = useState<TopProduct[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [branches, setBranches] = useState<BranchComparison[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseComparison[]>([]);
  const [employees, setEmployees] = useState<EmployeePerf[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<import('@/types').Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [
      sumRes, chartRes, topRes, worstRes, custRes,
      branchRes, whRes, empRes, lsRes, orderRes,
    ] = await Promise.all([
      supabase.from('v_dashboard_summary').select('*').limit(1).maybeSingle(),
      supabase.from('v_dashboard_revenue_chart').select('*').order('sale_date', { ascending: true }),
      supabase.from('v_dashboard_top_products').select('*'),
      supabase.from('v_dashboard_worst_products').select('*'),
      supabase.from('v_dashboard_top_customers').select('*'),
      supabase.from('v_dashboard_branch_comparison').select('*'),
      supabase.from('v_dashboard_warehouse_comparison').select('*'),
      supabase.from('v_dashboard_employee_performance').select('*').limit(10),
      supabase.from('products').select('id, name, sku, stock, low_stock_threshold').lt('stock', 10).eq('is_active', true).limit(8),
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
    ]);

    setSummary(sumRes.data as DashboardSummary | null);
    setRevenueChart((chartRes.data ?? []) as RevenueChartPoint[]);
    setTopProducts((topRes.data ?? []) as TopProduct[]);
    setWorstProducts((worstRes.data ?? []) as TopProduct[]);
    setTopCustomers((custRes.data ?? []) as TopCustomer[]);
    setBranches((branchRes.data ?? []) as BranchComparison[]);
    setWarehouses((whRes.data ?? []) as WarehouseComparison[]);
    setEmployees((empRes.data ?? []) as EmployeePerf[]);
    setLowStock((lsRes.data ?? []) as LowStockProduct[]);
    setRecentOrders((orderRes.data ?? []) as import('@/types').Order[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const maxRevenue = Math.max(...revenueChart.map(d => d.revenue), 1);
  const maxBranchRevenue = Math.max(...branches.map(b => b.total_revenue), 1);

  return (
    <div>
      <AdminPageHeader title="Dashboard" subtitle="Real-time business overview — revenue, inventory, and operations." />

      {/* Core KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard icon={DollarSign} label="Today's Revenue" value={formatCurrency(summary?.today_revenue ?? 0)} accent="gold" />
            <StatCard icon={Calendar} label="Monthly Revenue" value={formatCurrency(summary?.month_revenue ?? 0)} accent="gold" />
            <StatCard icon={TrendingUp} label="Yearly Revenue" value={formatCurrency(summary?.year_revenue ?? 0)} accent="gold" />
            <StatCard icon={Percent} label="Monthly Profit" value={formatCurrency(summary?.month_profit ?? 0)} accent="accent" />
            <StatCard icon={FileText} label="Monthly Expenses" value={formatCurrency(summary?.month_expenses ?? 0)} accent="warning" />
            <StatCard icon={Boxes} label="Inventory Cost" value={formatCurrency(summary?.inventory_cost_value ?? 0)} accent="warning" />
            <StatCard icon={Package} label="Inventory Value" value={formatCurrency(summary?.inventory_retail_value ?? 0)} accent="gold" />
            <StatCard icon={ShoppingCart} label="Today's Orders" value={summary?.today_order_count ?? 0} accent="accent" />
          </>
        )}
      </div>

      {/* Pending items + alerts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />) : (
          <>
            <Link to="/admin/orders" className="glass-card p-4 flex items-center gap-3 card-hover">
              <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center text-accent-400"><ShoppingCart className="w-5 h-5" /></div>
              <div><p className="text-2xl font-bold text-ink-50">{summary?.pending_orders ?? 0}</p><p className="text-xs text-ink-400">Pending Orders</p></div>
            </Link>
            <Link to="/admin/stock-transfers" className="glass-card p-4 flex items-center gap-3 card-hover">
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center text-gold-400"><Truck className="w-5 h-5" /></div>
              <div><p className="text-2xl font-bold text-ink-50">{summary?.pending_transfers ?? 0}</p><p className="text-xs text-ink-400">Pending Transfers</p></div>
            </Link>
            <Link to="/admin/purchase-orders" className="glass-card p-4 flex items-center gap-3 card-hover">
              <div className="w-10 h-10 rounded-xl bg-warning-500/10 flex items-center justify-center text-warning-400"><FileText className="w-5 h-5" /></div>
              <div><p className="text-2xl font-bold text-ink-50">{summary?.pending_purchase_orders ?? 0}</p><p className="text-xs text-ink-400">Pending POs</p></div>
            </Link>
            <Link to="/admin/inventory" className="glass-card p-4 flex items-center gap-3 card-hover">
              <div className="w-10 h-10 rounded-xl bg-error-500/10 flex items-center justify-center text-error-400"><AlertTriangle className="w-5 h-5" /></div>
              <div><p className="text-2xl font-bold text-ink-50">{summary?.low_stock_count ?? 0}</p><p className="text-xs text-ink-400">Low Stock Items</p></div>
            </Link>
          </>
        )}
      </div>

      {/* Revenue chart */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-50 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-gold-400" /> Revenue Trend (30 Days)</h2>
          <Badge color="gold">{revenueChart.length} days</Badge>
        </div>
        {loading ? <Skeleton className="h-48" /> : (
          <div className="flex items-end justify-between gap-1 h-48">
            {revenueChart.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <div
                  className="w-full bg-gradient-to-t from-gold-600 to-gold-400 rounded-t-lg transition-all hover:from-gold-500 hover:to-gold-300 cursor-pointer relative"
                  style={{ height: `${Math.max((d.revenue / maxRevenue) * 100, 2)}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition bg-ink-900 text-gold-300 text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                    {formatCurrency(d.revenue)}
                  </div>
                </div>
                {i % 5 === 0 && <span className="text-xs text-ink-500 truncate">{formatDate(d.sale_date).slice(0, 5)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top products + Low stock */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink-50 flex items-center gap-2"><Award className="w-5 h-5 text-gold-400" /> Top Products</h2>
            <Link to="/admin/reports" className="text-sm text-gold-300 hover:text-gold-200 flex items-center gap-1">Reports <ArrowRight className="w-4 h-4" /></Link>
          </div>
          {loading ? <Skeleton className="h-64" /> : (
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-white/10">
                  {['Product', 'Sold', 'Revenue', 'Stock'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {topProducts.map(p => (
                    <tr key={p.product_id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-ink-100">{p.product_name}</td>
                      <td className="px-4 py-3 text-sm text-ink-300">{p.qty_sold}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gold-300">{formatCurrency(p.revenue)}</td>
                      <td className="px-4 py-3"><Badge color={p.stock <= 5 ? 'error' : p.stock <= 10 ? 'warning' : 'success'}>{p.stock}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink-50 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-error-400" /> Low Stock Alert</h2>
            <Link to="/admin/inventory" className="text-sm text-gold-300 hover:text-gold-200 flex items-center gap-1">Manage <ArrowRight className="w-4 h-4" /></Link>
          </div>
          {loading ? <Skeleton className="h-48" /> : lowStock.length === 0 ? (
            <div className="glass-card p-8 text-center text-ink-400 text-sm">All products well stocked</div>
          ) : (
            <div className="space-y-2">
              {lowStock.map(p => (
                <div key={p.id} className="glass-card p-3 flex items-center justify-between">
                  <div><p className="text-sm font-medium text-ink-100">{p.name}</p><p className="text-xs text-ink-500">SKU: {p.sku ?? '—'}</p></div>
                  <Badge color={p.stock === 0 ? 'error' : 'warning'}>{p.stock} left</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Branch + Warehouse comparison */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-ink-50 mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-gold-400" /> Branch Comparison</h2>
          {loading ? <Skeleton className="h-48" /> : (
            <div className="space-y-3">
              {branches.slice(0, 5).map(b => (
                <div key={b.branch_id} className="glass-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div><p className="text-sm font-medium text-ink-100">{b.branch_name}</p><p className="text-xs text-ink-500">{b.city ?? '—'} · {b.order_count} orders</p></div>
                    <span className="text-sm font-semibold text-gold-300">{formatCurrency(b.total_revenue)}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-gold-600 to-gold-400 rounded-full" style={{ width: `${(b.total_revenue / maxBranchRevenue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-50 mb-4 flex items-center gap-2"><Warehouse className="w-5 h-5 text-gold-400" /> Warehouse Comparison</h2>
          {loading ? <Skeleton className="h-48" /> : (
            <div className="space-y-3">
              {warehouses.slice(0, 5).map(w => (
                <div key={w.warehouse_id} className="glass-card p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink-100">{w.warehouse_name}</p>
                    <p className="text-xs text-ink-500">{w.total_units.toLocaleString()} units · {w.product_count} SKUs</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gold-300">{formatCurrency(w.stock_cost_value)}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-400 rounded-full" style={{ width: `${w.utilization_pct}%` }} />
                      </div>
                      <span className="text-xs text-ink-500">{w.utilization_pct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top customers + Employee performance */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-ink-50 mb-4 flex items-center gap-2"><UserCircle className="w-5 h-5 text-gold-400" /> Top Customers</h2>
          {loading ? <Skeleton className="h-48" /> : (
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-white/10">
                  {['Customer', 'Orders', 'LTV'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {topCustomers.map(c => (
                    <tr key={c.customer_id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-ink-100">{c.customer_name}<p className="text-xs text-ink-500">{c.email ?? '—'}</p></td>
                      <td className="px-4 py-3 text-sm text-ink-300">{c.order_count}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gold-300">{formatCurrency(c.lifetime_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink-50 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-gold-400" /> Employee Performance</h2>
          {loading ? <Skeleton className="h-48" /> : (
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-white/10">
                  {['Employee', 'Sales', 'Orders', 'Avg Sale'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {employees.filter(e => e.order_count > 0).slice(0, 5).map(e => (
                    <tr key={e.employee_id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-ink-100">{e.employee_name}<p className="text-xs text-ink-500">{e.position ?? '—'}</p></td>
                      <td className="px-4 py-3 text-sm font-semibold text-gold-300">{formatCurrency(e.total_sales)}</td>
                      <td className="px-4 py-3 text-sm text-ink-300">{e.order_count}</td>
                      <td className="px-4 py-3 text-sm text-ink-200">{formatCurrency(e.avg_sale_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-50 flex items-center gap-2"><Activity className="w-5 h-5 text-gold-400" /> Recent Orders</h2>
          <Link to="/admin/orders" className="text-sm text-gold-300 hover:text-gold-200 flex items-center gap-1">View all <ArrowRight className="w-4 h-4" /></Link>
        </div>
        {loading ? <Skeleton className="h-48" /> : (
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-white/10">
                {['Order', 'Date', 'Status', 'Total'].map(h => <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{h}</th>)}
              </tr></thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-5 py-3.5 text-sm font-mono text-gold-300">{o.order_number}</td>
                    <td className="px-5 py-3.5 text-sm text-ink-300">{formatDate(o.placed_at)}</td>
                    <td className="px-5 py-3.5"><Badge color={o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'error' : 'gold'}>{o.status}</Badge></td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-ink-100">{formatCurrency(o.grand_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-ink-50 mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-gold-400" /> Quick Actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Add Product', to: '/admin/products', icon: Package },
            { label: 'View Orders', to: '/admin/orders', icon: ShoppingCart },
            { label: 'Manage Inventory', to: '/admin/inventory', icon: Boxes },
            { label: 'Add Employee', to: '/admin/employees', icon: Users },
            { label: 'View Reports', to: '/admin/reports', icon: BarChart3 },
            { label: 'Purchase Orders', to: '/admin/purchase-orders', icon: FileText },
            { label: 'Stock Transfers', to: '/admin/stock-transfers', icon: Truck },
            { label: 'Analytics', to: '/admin/analytics', icon: TrendingUp },
          ].map(a => (
            <Link key={a.label} to={a.to} className="glass-card p-5 card-hover flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center text-gold-400"><a.icon className="w-5 h-5" /></div>
              <span className="text-sm font-medium text-ink-100">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
