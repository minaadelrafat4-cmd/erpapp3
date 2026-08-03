import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { StatCard } from '@/components/admin/AdminComponents';
import { Skeleton, Badge } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  DollarSign, ShoppingCart, Users, Package, TrendingUp, TrendingDown,
  Award, AlertTriangle, Building2, Percent,
} from 'lucide-react';

interface DailyRevenue {
  sale_date: string;
  total_grand: number;
  order_count: number;
}

interface ProductSale {
  id: string;
  product_name: string;
  total_revenue: number;
  total_qty_sold: number;
  total_profit: number;
}

interface TopCustomer {
  id: string;
  customer_name: string;
  email: string;
  total_spent: number;
  order_count: number;
}

interface BranchSale {
  id: string;
  branch_name: string;
  total_revenue: number;
  order_count: number;
}

interface InventoryVal {
  total_cost_value: number;
  total_retail_value: number;
  potential_profit: number;
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [topProducts, setTopProducts] = useState<ProductSale[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [branchSales, setBranchSales] = useState<BranchSale[]>([]);
  const [inventoryVal, setInventoryVal] = useState<InventoryVal>({ total_cost_value: 0, total_retail_value: 0, potential_profit: 0 });
  const [totals, setTotals] = useState({ revenue: 0, orders: 0, customers: 0, products: 0, profit: 0, margin: 0 });
  const [lowStockCount, setLowStockCount] = useState(0);
  const [prevRevenue, setPrevRevenue] = useState(0);

  useEffect(() => {
    (async () => {
      const [salesRes, productsRes, customersRes, invRes, lowStockRes, topProdRes, topCustRes, branchRes, invValRes] = await Promise.all([
        supabase.from('v_bi_sales_daily').select('*').limit(30).order('sale_date', { ascending: true }),
        supabase.from('orders').select('grand_total', { count: 'exact' }),
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('v_bi_low_stock').select('*', { count: 'exact', head: true }),
        supabase.from('v_bi_product_sales').select('*').order('total_revenue', { ascending: false }).limit(5),
        supabase.from('v_bi_top_customers').select('*').limit(5),
        supabase.from('v_bi_branch_sales').select('*').order('total_revenue', { ascending: false }).limit(5),
        supabase.from('v_bi_inventory_value').select('total_cost_value, total_retail_value, potential_profit'),
      ]);

      const sales = (salesRes.data ?? []) as DailyRevenue[];
      const totalRevenue = sales.reduce((s, d) => s + Number(d.total_grand), 0);
      const totalOrders = sales.reduce((s, d) => s + Number(d.order_count), 0);
      const prevRev = sales.slice(0, Math.floor(sales.length / 2)).reduce((s, d) => s + Number(d.total_grand), 0);
      const recentRev = sales.slice(Math.floor(sales.length / 2)).reduce((s, d) => s + Number(d.total_grand), 0);
      const growth = prevRev > 0 ? ((recentRev - prevRev) / prevRev) * 100 : 0;

      const topProds = ((topProdRes.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
        id: r.product_id as string,
        product_name: r.product_name as string,
        total_revenue: Number(r.total_revenue),
        total_qty_sold: Number(r.total_qty_sold),
        total_profit: Number(r.total_profit),
      }));

      const invVal = (invValRes.data ?? []) as unknown as InventoryVal[];
      const invTotals = invVal.reduce(
        (acc, r) => ({
          total_cost_value: acc.total_cost_value + r.total_cost_value,
          total_retail_value: acc.total_retail_value + r.total_retail_value,
          potential_profit: acc.potential_profit + r.potential_profit,
        }),
        { total_cost_value: 0, total_retail_value: 0, potential_profit: 0 },
      );

      const totalProfit = topProds.reduce((s, p) => s + p.total_profit, 0);
      const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      setDailyRevenue(sales);
      setTopProducts(topProds);
      setTopCustomers((topCustRes.data ?? []) as unknown as TopCustomer[]);
      setBranchSales((branchRes.data ?? []) as unknown as BranchSale[]);
      setInventoryVal(invTotals as InventoryVal);
      setLowStockCount(lowStockRes.count ?? 0);
      setTotals({
        revenue: totalRevenue,
        orders: totalOrders,
        customers: customersRes.count ?? 0,
        products: productsRes.count ?? 0,
        profit: totalProfit,
        margin,
      });
      setPrevRevenue(growth);
      setLoading(false);
    })();
  }, []);

  const maxRev = Math.max(...dailyRevenue.map((d) => Number(d.total_grand)), 1);
  const maxBranchRev = Math.max(...branchSales.map((b) => Number(b.total_revenue)), 1);

  return (
    <div>
      <AdminPageHeader title="Analytics" subtitle="Real-time business performance insights." />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard icon={DollarSign} label="Total Revenue" value={formatCurrency(totals.revenue)} change={prevRevenue} accent="gold" />
            <StatCard icon={ShoppingCart} label="Total Orders" value={totals.orders} accent="accent" />
            <StatCard icon={Percent} label="Profit Margin" value={`${totals.margin.toFixed(1)}%`} accent="warning" />
            <StatCard icon={Users} label="Customers" value={totals.customers} accent="gold" />
          </>
        )}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : (
          <>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-1"><Package className="w-4 h-4 text-ink-400" /><span className="text-xs text-ink-400">Products</span></div>
              <p className="text-xl font-bold text-ink-50">{totals.products}</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-accent-400" /><span className="text-xs text-ink-400">Inventory Value</span></div>
              <p className="text-xl font-bold text-ink-50">{formatCurrency(inventoryVal.total_cost_value)}</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-gold-400" /><span className="text-xs text-ink-400">Retail Value</span></div>
              <p className="text-xl font-bold text-ink-50">{formatCurrency(inventoryVal.total_retail_value)}</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-error-400" /><span className="text-xs text-ink-400">Low Stock Alerts</span></div>
              <p className="text-xl font-bold text-ink-50">{lowStockCount}</p>
            </div>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue chart */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-ink-50 mb-4">Revenue Trend (30 days)</h3>
          {loading ? <Skeleton className="h-48" /> : (
            <div className="flex items-end justify-between gap-1 h-48">
              {dailyRevenue.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full bg-gradient-to-t from-gold-600 to-gold-400 rounded-t transition-all hover:opacity-80 relative" style={{ height: `${(Number(d.total_grand) / maxRev) * 100}%` }}>
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition bg-ink-900 text-gold-300 text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                      {formatCurrency(d.total_grand)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between text-xs text-ink-500 mt-2">
            <span>{dailyRevenue.length > 0 ? formatDate(dailyRevenue[0].sale_date) : '—'}</span>
            <span>{dailyRevenue.length > 0 ? formatDate(dailyRevenue[dailyRevenue.length - 1].sale_date) : '—'}</span>
          </div>
        </div>

        {/* Branch comparison */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-ink-50 mb-4">Branch Comparison</h3>
          {loading ? <Skeleton className="h-48" /> : branchSales.length === 0 ? (
            <p className="text-ink-400 text-sm">No branch sales data.</p>
          ) : (
            <div className="space-y-3">
              {branchSales.map((b, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ink-200 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-ink-400" />{b.branch_name}</span>
                    <span className="text-ink-100 font-medium">{formatCurrency(b.total_revenue)}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-accent-600 to-accent-400 rounded-full transition-all" style={{ width: `${(Number(b.total_revenue) / maxBranchRev) * 100}%` }} />
                  </div>
                  <p className="text-xs text-ink-500 mt-0.5">{b.order_count} orders</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-ink-50 mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-gold-400" /> Top Products</h3>
          {loading ? <Skeleton className="h-40" /> : topProducts.length === 0 ? (
            <p className="text-ink-400 text-sm">No sales data yet.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gold-500/10 text-gold-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm text-ink-100">{p.product_name}</p>
                    <p className="text-xs text-ink-500">{p.total_qty_sold} sold · Profit {formatCurrency(p.total_profit)}</p>
                  </div>
                  <span className="text-sm font-semibold text-gold-300">{formatCurrency(p.total_revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top customers */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-ink-50 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-accent-400" /> Top Customers</h3>
          {loading ? <Skeleton className="h-40" /> : topCustomers.length === 0 ? (
            <p className="text-ink-400 text-sm">No customer data yet.</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent-500/10 text-accent-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm text-ink-100">{c.customer_name || 'Unknown'}</p>
                    <p className="text-xs text-ink-500">{c.email ?? '—'} · {c.order_count} orders</p>
                  </div>
                  <span className="text-sm font-semibold text-accent-300">{formatCurrency(c.total_spent)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
