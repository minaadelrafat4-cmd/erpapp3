import { type ReactNode, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, FolderTree, Users, Boxes, Building2,
  UserCog, Truck, BarChart3, Bell, Settings, ShieldCheck, KeyRound, ScrollText, FileText,
  Menu, X, LogOut, Search, ChevronDown, Clock, ArrowLeftRight, Warehouse, PackageCheck,
  RotateCcw, ClipboardCheck, Lightbulb, Lock, Shield,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const nav = [
  { group: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, permission: 'dashboard.view' }] },
  {
    group: 'Commerce', items: [
      { to: '/admin/orders', label: 'Orders', icon: ShoppingCart, permission: 'orders.manage' },
      { to: '/admin/returns-refunds', label: 'Returns & Refunds', icon: RotateCcw, permission: 'returns_refunds.manage' },
      { to: '/admin/products', label: 'Products', icon: Package, permission: 'products.manage' },
      { to: '/admin/categories', label: 'Categories', icon: FolderTree, permission: 'categories.manage' },
      { to: '/admin/customers', label: 'Customers', icon: Users, permission: 'customers.manage' },
    ],
  },
  {
    group: 'Inventory', items: [
      { to: '/admin/inventory', label: 'Inventory', icon: Boxes, permission: 'inventory.valuation' },
      { to: '/admin/inventory-timeline', label: 'Timeline', icon: Clock, permission: 'inventory.valuation' },
      { to: '/admin/cycle-counts', label: 'Cycle Counts', icon: ClipboardCheck, permission: 'inventory.valuation' },
      { to: '/admin/reorder-suggestions', label: 'Reorder & Dead Stock', icon: Lightbulb, permission: 'inventory.valuation' },
      { to: '/admin/inventory-reservations', label: 'Reservations', icon: Lock, permission: 'inventory.valuation' },
      { to: '/admin/security', label: 'Security Center', icon: Shield, permission: 'reports.financial' },
      { to: '/admin/stock-transfers', label: 'Stock Transfers', icon: ArrowLeftRight, permission: 'inventory.transfer' },
    ],
  },
  {
    group: 'Operations', items: [
      { to: '/admin/branches', label: 'Branches', icon: Building2, permission: 'branches.manage' },
      { to: '/admin/warehouses', label: 'Warehouses', icon: Warehouse, permission: 'warehouses.manage' },
      { to: '/admin/employees', label: 'Employees', icon: UserCog, permission: 'employees.manage' },
    ],
  },
  {
    group: 'Purchasing', items: [
      { to: '/admin/suppliers', label: 'Suppliers', icon: Truck, permission: 'suppliers.manage' },
      { to: '/admin/purchase-orders', label: 'Purchase Orders', icon: PackageCheck, permission: 'purchase_orders.manage' },
    ],
  },
  {
    group: 'Insights', items: [
      { to: '/admin/reports', label: 'Reports', icon: BarChart3, permission: 'reports.financial' },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, permission: 'reports.financial' },
      { to: '/admin/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    group: 'Administration', items: [
      { to: '/admin/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
      { to: '/admin/content', label: 'Website Content', icon: FileText, permission: 'content.manage' },
      { to: '/admin/roles', label: 'Roles', icon: ShieldCheck, permission: 'roles.manage' },
      { to: '/admin/permissions', label: 'Access Control', icon: KeyRound, permission: 'permissions.manage' },
      { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText, permission: 'audit_logs.view' },
    ],
  },
];

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile, signOut, canView } = useAuth();
  const navigate = useNavigate();

  // Nav visibility is entirely driven by the role \u2194 permission grants managed
  // on the Access Control page (Administration > Access Control) — no
  // hardcoded per-role path lists here. A superadmin can change what any
  // custom role sees without touching code.
  const hasPermission = (item: { permission?: string }) => !item.permission || canView(item.permission);

  const roleLabel = profile?.role ? profile.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Administrator';

  return (
    <div className="min-h-screen bg-ink-950 flex">
      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:sticky top-0 inset-y-0 left-0 z-50 w-64 bg-ink-900/80 backdrop-blur-xl border-r border-white/10 flex flex-col h-screen transition-transform',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10 shrink-0">
          <Link to="/admin" className="text-xl font-display font-bold text-gradient-gold">LUXE Admin</Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-ink-400"><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 no-scrollbar">
          {nav.map((section) => {
            const visibleItems = section.items.filter((item) => hasPermission(item));
            
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.group}>
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-500">{section.group}</p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={(item as { end?: boolean }).end}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) => cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
                        isActive ? 'bg-gold-500/15 text-gold-300 border border-gold-500/20' : 'text-ink-300 hover:bg-white/5 hover:text-ink-100',
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10 shrink-0">
          <button onClick={async () => { await signOut(); navigate('/'); }} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-error-400 hover:bg-error-500/10 transition">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-ink-950/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 sticky top-0 z-30 glass-nav flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-ink-300"><Menu className="w-5 h-5" /></button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input placeholder="Search…" className="input pl-9 py-2 text-sm w-64" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-ink-300 hover:text-gold-300">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gold-400" />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-white/10">
              <div className="w-8 h-8 rounded-full bg-gold-sheen flex items-center justify-center text-ink-950 text-sm font-bold">
                {(user?.email ?? 'A').charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-ink-100">{user?.email ?? 'Admin'}</p>
                <p className="text-xs text-ink-500">{roleLabel}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-ink-400 hidden sm:block" />
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminPageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-ink-50">{title}</h1>
        {subtitle && <p className="text-sm text-ink-400 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}