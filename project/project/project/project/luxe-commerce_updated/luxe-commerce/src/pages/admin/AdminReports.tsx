import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { StatCard, DataTable } from '@/components/admin/AdminComponents';
import { Skeleton, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from '@/lib/export';
import {
  DollarSign, ShoppingCart, TrendingUp, Package, Boxes, AlertTriangle,
  FileText, Download, FileSpreadsheet, Printer, Users, Building2, Truck,
  BarChart3, Percent, Award, ArrowDown, Calendar, ChevronRight,
} from 'lucide-react';

type ReportType =
  | 'sales' | 'inventory' | 'revenue' | 'profit' | 'expense'
  | 'branch' | 'supplier' | 'purchase' | 'employee'
  | 'best_sellers' | 'worst_sellers' | 'low_stock'
  | 'inventory_aging' | 'warehouse_perf' | 'customer_ltv'
  | 'top_employees' | 'slow_moving' | 'dead_stock';

type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

interface Row {
  id: string;
  [key: string]: unknown;
}

const REPORT_LABELS: Record<ReportType, string> = {
  sales: 'Sales Report', inventory: 'Inventory Report', revenue: 'Revenue Report',
  profit: 'Profit Report', expense: 'Expense Report', branch: 'Branch Report',
  supplier: 'Supplier Report', purchase: 'Purchase Report', employee: 'Employee Performance',
  best_sellers: 'Best Selling Products', worst_sellers: 'Worst Selling Products',
  low_stock: 'Low Stock Report',
  inventory_aging: 'Inventory Aging', warehouse_perf: 'Warehouse Performance',
  customer_ltv: 'Customer LTV', top_employees: 'Top Employees',
  slow_moving: 'Slow Moving', dead_stock: 'Dead Stock',
};

const REPORT_ICONS: Record<ReportType, typeof DollarSign> = {
  sales: ShoppingCart, inventory: Boxes, revenue: DollarSign, profit: Percent,
  expense: FileText, branch: Building2, supplier: Truck, purchase: Truck,
  employee: Users, best_sellers: Award, worst_sellers: ArrowDown, low_stock: AlertTriangle,
  inventory_aging: Boxes, warehouse_perf: Building2, customer_ltv: Users,
  top_employees: Award, slow_moving: ArrowDown, dead_stock: AlertTriangle,
};

export default function AdminReports() {
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [period, setPeriod] = useState<Period>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [chartData, setChartData] = useState<{ label: string; value: number }[]>([]);
  const [summary, setSummary] = useState({ total: 0, count: 0, avg: 0, secondary: 0 });
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; first_name: string; last_name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [bRes, cRes, eRes] = await Promise.all([
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('categories').select('id, name').order('name'),
        supabase.from('employees').select('id, first_name, last_name').order('first_name'),
      ]);
      setBranches(bRes.data ?? []);
      setCategories(cRes.data ?? []);
      setEmployees(eRes.data ?? []);
    })();
  }, []);

  // Compute date range from period
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    if (period === 'custom') {
      start = startDate ? new Date(startDate) : null;
      end = endDate ? new Date(endDate) : null;
    } else {
      end = now;
      switch (period) {
        case 'daily': start = new Date(now.getTime() - 1 * 86400000); break;
        case 'weekly': start = new Date(now.getTime() - 7 * 86400000); break;
        case 'monthly': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'quarterly': start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
        case 'yearly': start = new Date(now.getFullYear(), 0, 1); break;
      }
    }
    return { start, end };
  }, [period, startDate, endDate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const startStr = dateRange.start ? dateRange.start.toISOString().split('T')[0] : null;
      const endStr = dateRange.end ? dateRange.end.toISOString().split('T')[0] : null;

      try {
        let data: Row[] = [];
        let chart: { label: string; value: number }[] = [];
        let s = { total: 0, count: 0, avg: 0, secondary: 0 };

        switch (reportType) {
          case 'sales': {
            const { data: d } = await supabase.rpc('get_revenue_analytics', {
              p_start_date: startStr, p_end_date: endStr,
            });
            data = (d ?? []).map((r: Record<string, unknown>, i: number) => ({
              id: `row-${i}`,
              sale_date: r.sale_date,
              order_count: r.order_count,
              total_revenue: r.total_revenue,
              total_discount: r.total_discount,
              total_grand: r.total_grand,
              avg_order_value: r.avg_order_value,
              items_sold: r.items_sold,
            }));
            chart = data.slice(0, 30).reverse().map((r) => ({
              label: formatDate(r.sale_date as string).slice(0, 6),
              value: Number(r.total_grand),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.total_grand), 0),
              count: data.reduce((sum, r) => sum + Number(r.order_count), 0),
              avg: data.length ? data.reduce((sum, r) => sum + Number(r.avg_order_value), 0) / data.length : 0,
              secondary: data.reduce((sum, r) => sum + Number(r.items_sold), 0),
            };
            break;
          }
          case 'revenue': {
            const { data: d } = await supabase.rpc('get_revenue_analytics', {
              p_start_date: startStr, p_end_date: endStr,
            });
            data = (d ?? []).map((r: Record<string, unknown>, i: number) => ({
              id: `row-${i}`,
              sale_date: r.sale_date,
              total_revenue: r.total_revenue,
              total_discount: r.total_discount,
              total_tax: r.total_tax,
              total_shipping: r.total_shipping,
              total_grand: r.total_grand,
              order_count: r.order_count,
            }));
            chart = data.slice(0, 30).reverse().map((r) => ({
              label: formatDate(r.sale_date as string).slice(0, 6),
              value: Number(r.total_revenue),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.total_revenue), 0),
              count: data.reduce((sum, r) => sum + Number(r.order_count), 0),
              avg: data.length ? s.total / data.length : 0,
              secondary: data.reduce((sum, r) => sum + Number(r.total_tax), 0),
            };
            break;
          }
          case 'best_sellers': {
            const { data: d } = await supabase.rpc('get_product_sales_report', {
              p_start_date: startStr, p_end_date: endStr,
            });
            data = (d ?? [])
              .filter((r: Record<string, unknown>) => Number(r.total_qty_sold) > 0)
              .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.total_revenue) - Number(a.total_revenue))
              .slice(0, 20)
              .map((r: Record<string, unknown>, i: number) => ({
                id: (r.product_id as string) ?? `row-${i}`,
                product_name: r.product_name,
                sku: r.sku,
                category_name: r.category_name,
                total_qty_sold: r.total_qty_sold,
                total_revenue: r.total_revenue,
                total_profit: r.total_profit,
                order_count: r.order_count,
              }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.product_name as string).slice(0, 12),
              value: Number(r.total_revenue),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.total_revenue), 0),
              count: data.reduce((sum, r) => sum + Number(r.total_qty_sold), 0),
              avg: data.length ? s.total / data.length : 0,
              secondary: data.reduce((sum, r) => sum + Number(r.total_profit), 0),
            };
            break;
          }
          case 'worst_sellers': {
            const { data: d } = await supabase.rpc('get_product_sales_report', {
              p_start_date: startStr, p_end_date: endStr,
            });
            data = (d ?? [])
              .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.total_revenue) - Number(b.total_revenue))
              .slice(0, 20)
              .map((r: Record<string, unknown>, i: number) => ({
                id: (r.product_id as string) ?? `row-${i}`,
                product_name: r.product_name,
                sku: r.sku,
                category_name: r.category_name,
                total_qty_sold: r.total_qty_sold,
                total_revenue: r.total_revenue,
                total_profit: r.total_profit,
                order_count: r.order_count,
              }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.product_name as string).slice(0, 12),
              value: Number(r.total_revenue),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.total_revenue), 0),
              count: data.reduce((sum, r) => sum + Number(r.total_qty_sold), 0),
              avg: data.length ? s.total / data.length : 0,
              secondary: data.length,
            };
            break;
          }
          case 'profit': {
            const { data: d } = await supabase.from('v_bi_profit_analysis').select('*');
            data = (d ?? [])
              .filter((r: Row) => Number(r.revenue) > 0)
              .sort((a: Row, b: Row) => Number(b.gross_profit) - Number(a.gross_profit))
              .map((r: Row) => ({ ...r, id: r.product_id as string }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.product_name as string).slice(0, 12),
              value: Number(r.gross_profit),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.revenue), 0),
              count: data.reduce((sum, r) => sum + Number(r.cogs), 0),
              avg: data.reduce((sum, r) => sum + Number(r.gross_profit), 0),
              secondary: data.length ? (data.reduce((sum, r) => sum + Number(r.gross_profit), 0) / data.reduce((sum, r) => sum + Number(r.revenue), 0)) * 100 : 0,
            };
            break;
          }
          case 'inventory': {
            const { data: d } = await supabase.from('v_bi_inventory_value').select('*');
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: (r.product_id as string) ?? `row-${i}` }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.total_cost_value), 0),
              count: data.reduce((sum, r) => sum + Number(r.stock), 0),
              avg: data.reduce((sum, r) => sum + Number(r.total_retail_value), 0),
              secondary: data.reduce((sum, r) => sum + Number(r.potential_profit), 0),
            };
            break;
          }
          case 'low_stock': {
            const { data: d } = await supabase.from('v_bi_low_stock').select('*');
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: (r.product_id as string) ?? `row-${i}` }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.product_name as string).slice(0, 12),
              value: Number(r.stock),
            }));
            s = {
              total: data.length,
              count: data.filter((r) => r.severity === 'out_of_stock').length,
              avg: data.filter((r) => r.severity === 'critical').length,
              secondary: data.filter((r) => r.severity === 'low').length,
            };
            break;
          }
          case 'inventory_aging': {
            const { data: d } = await supabase.from('v_bi_inventory_aging').select('*');
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: (r.product_id as string) ?? `row-${i}` }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.product_name as string).slice(0, 12),
              value: Number(r.stock_value),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.stock_value), 0),
              count: data.length,
              avg: data.filter((r) => r.movement_category === 'fast').length,
              secondary: data.filter((r) => r.movement_category === 'dead').length,
            };
            break;
          }
          case 'warehouse_perf': {
            const { data: d } = await supabase.from('v_bi_warehouse_performance').select('*');
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: (r.warehouse_id as string) ?? `row-${i}` }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.warehouse_name as string).slice(0, 12),
              value: Number(r.stock_value),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.stock_value), 0),
              count: data.reduce((sum, r) => sum + Number(r.sku_count), 0),
              avg: data.length ? s.total / data.length : 0,
              secondary: data.reduce((sum, r) => sum + Number(r.low_stock_items), 0),
            };
            break;
          }
          case 'customer_ltv': {
            const { data: d } = await supabase.from('v_bi_customer_ltv').select('*').limit(100);
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: (r.customer_id as string) ?? `row-${i}` }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.customer_name as string).slice(0, 12),
              value: Number(r.lifetime_value),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.lifetime_value), 0),
              count: data.reduce((sum, r) => sum + Number(r.order_count), 0),
              avg: data.length ? s.total / data.length : 0,
              secondary: data.length,
            };
            break;
          }
          case 'top_employees': {
            const { data: d } = await supabase.from('v_bi_top_employees').select('*').order('total_sales', { ascending: false }).limit(20);
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: (r.employee_id as string) ?? `row-${i}` }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.employee_name as string).slice(0, 12),
              value: Number(r.total_sales),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.total_sales), 0),
              count: data.reduce((sum, r) => sum + Number(r.order_count), 0),
              avg: data.length ? s.total / data.length : 0,
              secondary: data.filter((r) => Number(r.order_count) > 0).length,
            };
            break;
          }
          case 'slow_moving': {
            const { data: d } = await supabase.from('v_bi_slow_moving').select('*');
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: (r.product_id as string) ?? `row-${i}` }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.product_name as string).slice(0, 12),
              value: Number(r.tied_up_capital),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.tied_up_capital), 0),
              count: data.length,
              avg: data.length ? s.total / data.length : 0,
              secondary: data.reduce((sum, r) => sum + Number(r.qty_sold_30d), 0),
            };
            break;
          }
          case 'dead_stock': {
            const { data: d } = await supabase.from('v_bi_dead_stock').select('*');
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: (r.product_id as string) ?? `row-${i}` }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.product_name as string).slice(0, 12),
              value: Number(r.tied_up_capital),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.tied_up_capital), 0),
              count: data.length,
              avg: data.length ? s.total / data.length : 0,
              secondary: data.reduce((sum, r) => sum + Number(r.stock), 0),
            };
            break;
          }
          case 'branch': {
            let q = supabase.from('v_bi_branch_sales').select('*');
            if (branchFilter) q = q.eq('branch_id', branchFilter);
            const { data: d } = await q.order('total_revenue', { ascending: false });
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: (r.branch_id as string) ?? `row-${i}` }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.branch_name as string).slice(0, 12),
              value: Number(r.total_revenue),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.total_revenue), 0),
              count: data.reduce((sum, r) => sum + Number(r.order_count), 0),
              avg: data.length ? s.total / data.length : 0,
              secondary: data.filter((r) => r.is_active).length,
            };
            break;
          }
          case 'supplier': {
            const { data: d } = await supabase.from('v_bi_supplier_summary').select('*').order('total_ordered', { ascending: false });
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: (r.supplier_id as string) ?? `row-${i}` }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.supplier_name as string).slice(0, 12),
              value: Number(r.total_ordered),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.total_ordered), 0),
              count: data.reduce((sum, r) => sum + Number(r.po_count), 0),
              avg: data.reduce((sum, r) => sum + Number(r.outstanding_balance), 0),
              secondary: data.length,
            };
            break;
          }
          case 'purchase': {
            const { data: d } = await supabase.from('v_bi_purchase_summary').select('*');
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: `row-${i}` }));
            chart = data.map((r) => ({
              label: (r.status as string) ?? '—',
              value: Number(r.total_grand),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.total_grand), 0),
              count: data.reduce((sum, r) => sum + Number(r.po_count), 0),
              avg: data.length ? s.total / data.length : 0,
              secondary: data.length,
            };
            break;
          }
          case 'expense': {
            const { data: d } = await supabase.from('v_bi_expense_summary').select('*');
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: `row-${i}` }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.category as string) ?? '—',
              value: Number(r.total_amount),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.total_amount), 0),
              count: data.reduce((sum, r) => sum + Number(r.expense_count), 0),
              avg: data.length ? s.total / data.length : 0,
              secondary: data.filter((r) => r.status === 'pending').length,
            };
            break;
          }
          case 'employee': {
            let q = supabase.from('v_bi_employee_performance').select('*');
            if (employeeFilter) q = q.eq('employee_id', employeeFilter);
            const { data: d } = await q.order('total_sales', { ascending: false });
            data = (d ?? []).map((r: Row, i: number) => ({ ...r, id: (r.employee_id as string) ?? `row-${i}` }));
            chart = data.slice(0, 10).map((r) => ({
              label: (r.employee_name as string).slice(0, 12),
              value: Number(r.total_sales),
            }));
            s = {
              total: data.reduce((sum, r) => sum + Number(r.total_sales), 0),
              count: data.reduce((sum, r) => sum + Number(r.order_count), 0),
              avg: data.length ? s.total / data.length : 0,
              secondary: data.filter((r) => Number(r.order_count) > 0).length,
            };
            break;
          }
        }

        // Apply category filter to product-based reports
        if (categoryFilter && ['best_sellers', 'worst_sellers', 'inventory', 'profit', 'low_stock', 'inventory_aging', 'slow_moving', 'dead_stock'].includes(reportType)) {
          data = data.filter((r) => {
            const cat = r.category_name as string | undefined;
            return cat === categories.find((c) => c.id === categoryFilter)?.name;
          });
        }

        setRows(data);
        setChartData(chart);
        setSummary(s);
      } catch {
        toast('Failed to load report data', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [reportType, period, startDate, endDate, branchFilter, categoryFilter, employeeFilter]);

  const columns = useMemo<ExportColumn[]>(() => {
    const fmtMoney = (v: unknown) => formatCurrency(Number(v));
    switch (reportType) {
      case 'sales':
        return [
          { key: 'sale_date', label: 'Date', format: (v) => formatDate(v as string) },
          { key: 'order_count', label: 'Orders' },
          { key: 'total_revenue', label: 'Revenue', format: fmtMoney },
          { key: 'total_discount', label: 'Discount', format: fmtMoney },
          { key: 'total_grand', label: 'Grand Total', format: fmtMoney },
          { key: 'avg_order_value', label: 'Avg Order', format: fmtMoney },
          { key: 'items_sold', label: 'Items Sold' },
        ];
      case 'revenue':
        return [
          { key: 'sale_date', label: 'Date', format: (v) => formatDate(v as string) },
          { key: 'total_revenue', label: 'Revenue', format: fmtMoney },
          { key: 'total_discount', label: 'Discount', format: fmtMoney },
          { key: 'total_tax', label: 'Tax', format: fmtMoney },
          { key: 'total_shipping', label: 'Shipping', format: fmtMoney },
          { key: 'total_grand', label: 'Grand Total', format: fmtMoney },
          { key: 'order_count', label: 'Orders' },
        ];
      case 'best_sellers':
      case 'worst_sellers':
        return [
          { key: 'product_name', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'category_name', label: 'Category' },
          { key: 'total_qty_sold', label: 'Qty Sold' },
          { key: 'total_revenue', label: 'Revenue', format: fmtMoney },
          { key: 'total_profit', label: 'Profit', format: fmtMoney },
          { key: 'order_count', label: 'Orders' },
        ];
      case 'profit':
        return [
          { key: 'product_name', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'price', label: 'Price', format: fmtMoney },
          { key: 'cost', label: 'Cost', format: fmtMoney },
          { key: 'unit_profit', label: 'Unit Profit', format: fmtMoney },
          { key: 'profit_margin_pct', label: 'Margin %', format: (v) => `${Number(v).toFixed(1)}%` },
          { key: 'qty_sold', label: 'Qty Sold' },
          { key: 'revenue', label: 'Revenue', format: fmtMoney },
          { key: 'cogs', label: 'COGS', format: fmtMoney },
          { key: 'gross_profit', label: 'Gross Profit', format: fmtMoney },
        ];
      case 'inventory':
        return [
          { key: 'product_name', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'stock', label: 'Stock' },
          { key: 'unit_cost', label: 'Unit Cost', format: fmtMoney },
          { key: 'unit_price', label: 'Unit Price', format: fmtMoney },
          { key: 'total_cost_value', label: 'Cost Value', format: fmtMoney },
          { key: 'total_retail_value', label: 'Retail Value', format: fmtMoney },
          { key: 'potential_profit', label: 'Potential Profit', format: fmtMoney },
        ];
      case 'low_stock':
        return [
          { key: 'product_name', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'category_name', label: 'Category' },
          { key: 'stock', label: 'Stock' },
          { key: 'reorder_level', label: 'Reorder Level' },
          { key: 'severity', label: 'Severity' },
        ];
      case 'inventory_aging':
        return [
          { key: 'product_name', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'category_name', label: 'Category' },
          { key: 'stock', label: 'Stock' },
          { key: 'stock_value', label: 'Stock Value', format: fmtMoney },
          { key: 'total_sold_30d', label: 'Sold (30d)' },
          { key: 'movement_category', label: 'Movement' },
          { key: 'days_of_supply', label: 'Days Supply' },
        ];
      case 'warehouse_perf':
        return [
          { key: 'warehouse_name', label: 'Warehouse' },
          { key: 'code', label: 'Code' },
          { key: 'city', label: 'City' },
          { key: 'total_units', label: 'Total Units' },
          { key: 'stock_value', label: 'Stock Value', format: fmtMoney },
          { key: 'sku_count', label: 'SKU Count' },
          { key: 'low_stock_items', label: 'Low Stock' },
          { key: 'utilization_pct', label: 'Utilization %', format: (v) => `${Number(v).toFixed(1)}%` },
        ];
      case 'customer_ltv':
        return [
          { key: 'customer_name', label: 'Customer' },
          { key: 'email', label: 'Email' },
          { key: 'lifetime_value', label: 'LTV', format: fmtMoney },
          { key: 'order_count', label: 'Orders' },
          { key: 'avg_order_value', label: 'Avg Order', format: fmtMoney },
          { key: 'first_order_date', label: 'First Order', format: (v) => v ? formatDate(v as string) : '—' },
          { key: 'last_order_date', label: 'Last Order', format: (v) => v ? formatDate(v as string) : '—' },
        ];
      case 'top_employees':
      case 'employee':
        return [
          { key: 'employee_name', label: 'Employee' },
          { key: 'email', label: 'Email' },
          { key: 'position', label: 'Position' },
          { key: 'branch_name', label: 'Branch' },
          { key: 'total_sales', label: 'Total Sales', format: fmtMoney },
          { key: 'order_count', label: 'Orders' },
          { key: 'avg_sale_value', label: 'Avg Sale', format: fmtMoney },
        ];
      case 'slow_moving':
        return [
          { key: 'product_name', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'category_name', label: 'Category' },
          { key: 'stock', label: 'Stock' },
          { key: 'tied_up_capital', label: 'Tied-up Capital', format: fmtMoney },
          { key: 'qty_sold_30d', label: 'Sold (30d)' },
        ];
      case 'dead_stock':
        return [
          { key: 'product_name', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'category_name', label: 'Category' },
          { key: 'stock', label: 'Stock' },
          { key: 'tied_up_capital', label: 'Tied-up Capital', format: fmtMoney },
          { key: 'first_stocked', label: 'First Stocked', format: (v) => v ? formatDate(v as string) : '—' },
        ];
      case 'branch':
        return [
          { key: 'branch_name', label: 'Branch' },
          { key: 'branch_code', label: 'Code' },
          { key: 'city', label: 'City' },
          { key: 'is_active', label: 'Active', format: (v) => (v ? 'Yes' : 'No') },
          { key: 'total_revenue', label: 'Revenue', format: fmtMoney },
          { key: 'order_count', label: 'Orders' },
          { key: 'avg_order_value', label: 'Avg Order', format: fmtMoney },
        ];
      case 'supplier':
        return [
          { key: 'supplier_name', label: 'Supplier' },
          { key: 'contact_name', label: 'Contact' },
          { key: 'country', label: 'Country' },
          { key: 'total_ordered', label: 'Total Ordered', format: fmtMoney },
          { key: 'total_paid', label: 'Total Paid', format: fmtMoney },
          { key: 'outstanding_balance', label: 'Outstanding', format: fmtMoney },
          { key: 'po_count', label: 'POs' },
        ];
      case 'purchase':
        return [
          { key: 'status', label: 'Status' },
          { key: 'po_count', label: 'PO Count' },
          { key: 'total_subtotal', label: 'Subtotal', format: fmtMoney },
          { key: 'total_grand', label: 'Grand Total', format: fmtMoney },
          { key: 'avg_po_value', label: 'Avg PO', format: fmtMoney },
        ];
      case 'expense':
        return [
          { key: 'category', label: 'Category' },
          { key: 'status', label: 'Status' },
          { key: 'expense_count', label: 'Count' },
          { key: 'total_amount', label: 'Total', format: fmtMoney },
          { key: 'avg_amount', label: 'Average', format: fmtMoney },
        ];
      
      default:
        return [];
    }
  }, [reportType]);

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const filename = `${reportType}_report_${new Date().toISOString().split('T')[0]}`;
    if (format === 'csv') exportToCsv(filename, columns, rows as unknown as Record<string, unknown>[]);
    else if (format === 'excel') exportToExcel(filename, columns, rows as unknown as Record<string, unknown>[]);
    else exportToPdf(filename, REPORT_LABELS[reportType], columns, rows as unknown as Record<string, unknown>[]);
    toast(`Report exported as ${format.toUpperCase()}`, 'success');
  };

  const showBranchFilter = ['sales', 'revenue', 'branch'].includes(reportType);
  const showCategoryFilter = ['best_sellers', 'worst_sellers', 'inventory', 'profit', 'low_stock', 'inventory_aging', 'slow_moving', 'dead_stock'].includes(reportType);
  const showEmployeeFilter = reportType === 'employee' || reportType === 'top_employees';

  const summaryLabels = useMemo(() => {
    switch (reportType) {
      case 'sales': return ['Total Revenue', 'Total Orders', 'Avg Order', 'Items Sold'];
      case 'revenue': return ['Net Revenue', 'Orders', 'Avg Daily', 'Tax Collected'];
      case 'best_sellers': return ['Total Revenue', 'Units Sold', 'Avg Revenue/Product', 'Total Profit'];
      case 'worst_sellers': return ['Total Revenue', 'Units Sold', 'Avg Revenue/Product', 'Products Listed'];
      case 'profit': return ['Total Revenue', 'Total COGS', 'Gross Profit', 'Avg Margin %'];
      case 'inventory': return ['Cost Value', 'Total Units', 'Retail Value', 'Potential Profit'];
      case 'low_stock': return ['Total Alerts', 'Out of Stock', 'Critical', 'Low'];
      case 'branch': return ['Total Revenue', 'Total Orders', 'Avg per Branch', 'Active Branches'];
      case 'supplier': return ['Total Ordered', 'Total POs', 'Outstanding', 'Suppliers'];
      case 'purchase': return ['Total Value', 'Total POs', 'Avg PO Value', 'Statuses'];
      case 'expense': return ['Total Expenses', 'Total Entries', 'Avg Expense', 'Pending'];
      case 'employee': return ['Total Sales', 'Total Orders', 'Avg per Employee', 'Active Sellers'];
      case 'inventory_aging': return ['Total Stock Value', 'Products', 'Fast Moving', 'Dead Stock'];
      case 'warehouse_perf': return ['Total Stock Value', 'Total SKUs', 'Avg per Warehouse', 'Low Stock Items'];
      case 'customer_ltv': return ['Total LTV', 'Total Orders', 'Avg LTV', 'Customers'];
      case 'top_employees': return ['Total Sales', 'Total Orders', 'Avg per Employee', 'Active Sellers'];
      case 'slow_moving': return ['Tied-up Capital', 'Products', 'Avg Capital/Product', 'Units Sold (30d)'];
      case 'dead_stock': return ['Tied-up Capital', 'Products', 'Avg Capital/Product', 'Total Units'];
      default: return ['Total', 'Count', 'Average', 'Secondary'];
    }
  }, [reportType]);

  const maxChartValue = Math.max(...chartData.map((d) => d.value), 1);

  return (
    <div>
      <AdminPageHeader title="Reports" subtitle="Business intelligence and analytics — real-time data." />

      {/* Report type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {(Object.keys(REPORT_LABELS) as ReportType[]).map((rt) => {
          const Icon = REPORT_ICONS[rt];
          return (
            <button
              key={rt}
              onClick={() => setReportType(rt)}
              className={`glass-card p-3 flex flex-col items-center gap-2 transition text-center ${
                reportType === rt ? 'ring-2 ring-gold-400 bg-gold-500/5' : 'hover:bg-white/5'
              }`}
            >
              <Icon className={`w-5 h-5 ${reportType === rt ? 'text-gold-300' : 'text-ink-400'}`} />
              <span className={`text-xs font-medium ${reportType === rt ? 'text-gold-300' : 'text-ink-300'}`}>
                {REPORT_LABELS[rt]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Period</label>
            <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-auto">
              <option value="daily">Today</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="quarterly">This Quarter</option>
              <option value="yearly">This Year</option>
              <option value="custom">Custom Range</option>
            </Select>
          </div>
          {period === 'custom' && (
            <>
              <div>
                <label className="label">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
              </div>
            </>
          )}
          {showBranchFilter && (
            <div>
              <label className="label">Branch</label>
              <Select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-auto">
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
          )}
          {showCategoryFilter && (
            <div>
              <label className="label">Category</label>
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-auto">
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          )}
          {showEmployeeFilter && (
            <div>
              <label className="label">Employee</label>
              <Select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="w-auto">
                <option value="">All Employees</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </Select>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleExport('csv')}><Download className="w-4 h-4" /> CSV</Button>
            <Button variant="ghost" size="sm" onClick={() => handleExport('excel')}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
            <Button variant="ghost" size="sm" onClick={() => handleExport('pdf')}><Printer className="w-4 h-4" /> PDF</Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard icon={DollarSign} label={summaryLabels[0]} value={reportType === 'low_stock' ? summary.total : formatCurrency(summary.total)} accent="gold" />
            <StatCard icon={ShoppingCart} label={summaryLabels[1]} value={summary.count} accent="accent" />
            <StatCard icon={TrendingUp} label={summaryLabels[2]} value={reportType === 'profit' ? `${summary.secondary.toFixed(1)}%` : formatCurrency(summary.avg)} accent="warning" />
            <StatCard icon={BarChart3} label={summaryLabels[3]} value={reportType === 'low_stock' ? summary.secondary : formatCurrency(summary.secondary)} accent="error" />
          </>
        )}
      </div>

      {/* Chart */}
      {!loading && chartData.length > 0 && (
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink-50">
              {reportType === 'low_stock' ? 'Stock Levels' : 'Revenue Trend'}
            </h3>
            <Badge color="gold">{chartData.length} data points</Badge>
          </div>
          <div className="flex items-end justify-between gap-1.5 h-48">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div
                  className="w-full bg-gradient-to-t from-gold-600 to-gold-400 rounded-t-lg transition-all hover:from-gold-500 hover:to-gold-300 cursor-pointer relative"
                  style={{ height: `${(d.value / maxChartValue) * 100}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition bg-ink-900 text-gold-300 text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                    {reportType === 'low_stock' ? `${d.value} units` : formatCurrency(d.value)}
                  </div>
                </div>
                <span className="text-xs text-ink-500 truncate w-full text-center">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-ink-50 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gold-400" />
            {REPORT_LABELS[reportType]}
          </h3>
          {!loading && <span className="text-sm text-ink-400">{rows.length} records</span>}
        </div>
        {loading ? (
          <div className="glass-card p-4"><div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div></div>
        ) : rows.length === 0 ? (
          <div className="glass-card p-8 text-center text-ink-400">No data available for the selected filters.</div>
        ) : (
          <DataTable<Row>
            rows={rows}
            columns={columns.map((c) => ({
              key: c.key,
              label: c.label,
              render: c.format
                ? (row: Row) => <span>{c.format!(row[c.key], row as unknown as Record<string, unknown>)}</span>
                : undefined,
            }))}
          />
        )}
      </div>
    </div>
  );
}
