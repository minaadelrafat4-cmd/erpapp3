// ============================================================
// ERP Domain Types — mirrors the existing database schema
// ============================================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  image_url: string | null;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  country: string | null;
  is_featured: boolean;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt: string | null;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  category_id: string | null;
  brand_id: string | null;
  price: number;
  compare_at_price: number | null;
  cost: number | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  low_stock_threshold: number;
  weight: number | null;
  is_featured: boolean;
  is_best_seller: boolean;
  is_new_arrival: boolean;
  is_flash_sale: boolean;
  flash_sale_ends_at: string | null;
  rating: number;
  review_count: number;
  is_active: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  // ERP extension fields
  serial_number: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  supplier_id: string | null;
  min_stock: number;
  max_stock: number;
  reorder_level: number;
  // Vape industry fields
  flavor: string | null;
  vg_pg_ratio: string | null;
  puff_count: number | null;
  battery_capacity_mah: number | null;
  tank_size_ml: number | null;
  resistance_ohm: number | null;
  coil_compatibility: string[];
  pod_compatibility: string[];
  product_type: string | null;
  is_age_restricted: boolean;
  nicotine_strength: string | null;
}

export interface ProductWithRelations extends Product {
  category_name: string | null;
  category_slug: string | null;
  brand_name: string | null;
  brand_slug: string | null;
}

export interface ProductDetail extends ProductWithRelations {
  images: ProductImage[];
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string | null;
  email: string | null;
  manager: string | null;
  is_active: boolean;
  state: string | null;
  postal_code: string | null;
  country: string;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  manager: string | null;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ERPNotification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface DashboardSummary {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_branches: number;
  total_warehouses: number;
}

export interface DashboardKpi {
  label: string;
  value: number | string;
  icon: string;
  color: string;
}

// ============================================================
// Inventory & Detail Types
// ============================================================

export interface InventoryItem {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  sku: string | null;
  category_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  reorder_point: number;
  min_stock: number;
  max_stock: number;
  batch_number: string | null;
  expiry_date: string | null;
  last_stocked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemWithStatus extends InventoryItem {
  available_stock: number;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  stock_status: 'out' | 'low' | 'ok';
}

export interface InventorySummary {
  total_products: number;
  total_units: number;
  total_reserved: number;
  total_available: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

export interface CategoryWithCount extends Category {
  product_count: number;
}

export interface BranchDetail extends Branch {
  product_count: number;
  total_stock: number;
  warehouse_id: string | null;
  warehouse_name: string | null;
}

export interface WarehouseDetail extends Warehouse {
  product_count: number;
  total_units: number;
  total_available: number;
  low_stock_count: number;
  utilization_pct: number;
}
