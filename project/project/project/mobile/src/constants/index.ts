import type { UserRole, NavItemConfig, NavGroupConfig, IconName } from '@apptypes';

// ============================================================
// Role Labels
// ============================================================

export const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Customer',
  staff: 'Staff',
  manager: 'Manager',
  admin: 'Admin',
  super_admin: 'Super Admin',
  company_owner: 'Company Owner',
  general_manager: 'General Manager',
  warehouse_manager: 'Warehouse Manager',
  branch_manager: 'Branch Manager',
  inventory_employee: 'Inventory Employee',
  sales_employee: 'Sales Employee',
  marketing: 'Marketing',
  accountant: 'Accountant',
  customer_support: 'Customer Support',
  delivery_driver: 'Delivery Driver',
};

export function roleLabel(role: UserRole | string | null | undefined): string {
  return ROLE_LABELS[role as UserRole] ?? 'User';
}

// ============================================================
// App Config
// ============================================================

export const APP_CONFIG = {
  name: 'LUXE ERP',
  sessionTimeoutMs: 8 * 60 * 60 * 1000,
  lowStockThreshold: 10,
  currency: 'USD',
  itemsPerPage: 20,
} as const;

// ============================================================
// Navigation Group Definitions
// ============================================================

export const NAV_GROUPS: NavGroupConfig[] = [
  { key: 'overview', label: 'Overview', icon: 'dashboard' },
  { key: 'commerce', label: 'Commerce', icon: 'shopping-cart' },
  { key: 'inventory', label: 'Inventory', icon: 'box' },
  { key: 'operations', label: 'Operations', icon: 'gear' },
  { key: 'purchasing', label: 'Purchasing', icon: 'truck' },
  { key: 'insights', label: 'Insights', icon: 'bar-chart' },
  { key: 'administration', label: 'Administration', icon: 'shield' },
];

// ============================================================
// Navigation Item Definitions — each screen with its minRank
// ============================================================

export const NAV_ITEMS: NavItemConfig[] = [
  // Overview
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', minRank: 20, group: 'overview', description: 'Business overview and KPIs' },
  { key: 'notifications', label: 'Notifications', icon: 'bell', minRank: 20, group: 'overview', description: 'Alerts and announcements' },
  { key: 'tasks', label: 'Tasks', icon: 'clipboard', minRank: 20, group: 'overview', description: 'Assigned and tracked tasks' },

  // Commerce
  { key: 'pos', label: 'POS', icon: 'credit-card', minRank: 20, group: 'commerce', description: 'Point of sale checkout' },
  { key: 'sales-orders', label: 'Sales Orders', icon: 'shopping-cart', minRank: 20, group: 'commerce', description: 'Customer orders and fulfillment' },
  { key: 'customers', label: 'Customers', icon: 'users', minRank: 40, group: 'commerce', description: 'Customer accounts and history' },
  { key: 'products', label: 'Products', icon: 'package', minRank: 40, group: 'commerce', description: 'Product catalog management' },
  { key: 'categories', label: 'Categories', icon: 'tag', minRank: 40, group: 'commerce', description: 'Product categories and taxonomy' },

  // Inventory
  { key: 'inventory', label: 'Inventory', icon: 'box', minRank: 40, group: 'inventory', description: 'Stock levels and adjustments' },
  { key: 'warehouses', label: 'Warehouses', icon: 'warehouse', minRank: 60, group: 'inventory', description: 'Warehouse locations' },
  { key: 'branches', label: 'Branches', icon: 'building', minRank: 60, group: 'inventory', description: 'Branch and store locations' },

  // Operations
  { key: 'employees', label: 'Employees', icon: 'users', minRank: 60, group: 'operations', description: 'Staff management' },

  // Purchasing
  { key: 'suppliers', label: 'Suppliers', icon: 'truck', minRank: 40, group: 'purchasing', description: 'Vendor management' },
  { key: 'purchase-orders', label: 'Purchase Orders', icon: 'clipboard', minRank: 40, group: 'purchasing', description: 'Procurement orders' },

  // Insights
  { key: 'reports', label: 'Reports', icon: 'file', minRank: 40, group: 'insights', description: 'Business reports' },
  { key: 'analytics', label: 'Analytics', icon: 'bar-chart', minRank: 60, group: 'insights', description: 'Advanced analytics' },

  // Administration
  { key: 'settings', label: 'Settings', icon: 'gear', minRank: 20, group: 'administration', description: 'App and account settings' },
  { key: 'help', label: 'Help & Support', icon: 'question', minRank: 0, group: 'administration', description: 'Support and documentation' },
];

export function navMinRank(key: string): number {
  return NAV_ITEMS.find((i) => i.key === key)?.minRank ?? 0;
}

// ============================================================
// Bottom Tab Items — varies by role
// ============================================================

export interface TabConfig {
  key: string;
  label: string;
  icon: IconName;
  minRank: number;
}

export const TAB_ITEMS: TabConfig[] = [
  { key: 'dashboard', label: 'Home', icon: 'dashboard', minRank: 20 },
  { key: 'pos', label: 'POS', icon: 'credit-card', minRank: 20 },
  { key: 'inventory', label: 'Inventory', icon: 'box', minRank: 40 },
  { key: 'more', label: 'More', icon: 'menu', minRank: 20 },
];

// ============================================================
// Role-Specific Quick Actions
// ============================================================

export const ROLE_QUICK_ACTIONS: Partial<Record<UserRole, string[]>> = {
  super_admin: ['dashboard', 'analytics', 'reports', 'employees', 'settings'],
  admin: ['dashboard', 'reports', 'employees', 'inventory', 'settings'],
  manager: ['dashboard', 'sales-orders', 'inventory', 'reports', 'tasks'],
  warehouse_manager: ['inventory', 'warehouses', 'purchase-orders', 'tasks'],
  branch_manager: ['pos', 'sales-orders', 'inventory', 'branches'],
  inventory_employee: ['inventory', 'warehouses', 'tasks'],
  sales_employee: ['pos', 'sales-orders', 'customers'],
  general_manager: ['dashboard', 'reports', 'analytics', 'employees'],
  accountant: ['reports', 'analytics', 'purchase-orders'],
  marketing: ['products', 'categories', 'customers', 'analytics'],
  customer_support: ['customers', 'sales-orders', 'notifications', 'tasks'],
  delivery_driver: ['tasks', 'sales-orders', 'notifications'],
  staff: ['dashboard', 'notifications', 'tasks'],
  customer: ['dashboard', 'notifications', 'help'],
};
