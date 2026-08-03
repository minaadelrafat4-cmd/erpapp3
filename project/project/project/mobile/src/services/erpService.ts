import { supabase } from '@lib/supabase';
import { ApiError, toApiError } from '@lib/errors';
import type {
  Product,
  ProductDetail,
  ProductImage,
  Branch,
  Warehouse,
  ERPNotification,
  Category,
  DashboardSummary,
  InventoryItem,
  InventoryItemWithStatus,
  InventorySummary,
  CategoryWithCount,
  BranchDetail,
  WarehouseDetail,
  Customer,
  CustomerSummary,
  CustomerListItem,
  CustomerListResult,
  CustomerOrderSummary,
  CustomerAddress,
  CustomerDetail,
  Supplier,
  SupplierListItem,
  SupplierListResult,
  PurchaseOrderSummary,
  SupplierDetail,
  PurchaseOrderListItem,
  PurchaseOrderListResult,
  PurchaseOrderItem,
  PurchaseOrderDetail,
  SalesOrderListItem,
  SalesOrderListResult,
  SalesOrderItem,
  SalesOrderDetail,
} from '@apptypes/erp';
import { APP_CONFIG } from '@constants';
import type { Profile } from '@apptypes';

// ============================================================
// Dashboard Service — reuses v_dashboard_summary view
// ============================================================

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  // Reuse the existing BI view for low_stock_count (per-product threshold)
  const [summaryRes, productsRes, branchesRes, warehousesRes] = await Promise.all([
    supabase.from('v_dashboard_summary').select('low_stock_count').limit(1).maybeSingle(),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('warehouses').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  const errors = [summaryRes, productsRes, branchesRes, warehousesRes].filter((r) => r.error);
  if (errors.length > 0) throw toApiError(errors[0]!.error);

  // Out-of-stock: stock <= 0
  const outStockRes = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .lte('stock', 0);
  if (outStockRes.error) throw toApiError(outStockRes.error);

  const summaryRow = summaryRes.data as { low_stock_count: number } | null;

  return {
    total_products: productsRes.count ?? 0,
    low_stock_count: summaryRow?.low_stock_count ?? 0,
    out_of_stock_count: outStockRes.count ?? 0,
    total_branches: branchesRes.count ?? 0,
    total_warehouses: warehousesRes.count ?? 0,
  };
}

export async function fetchRecentNotifications(userId: string, limit = 5): Promise<ERPNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw toApiError(error);
  return (data ?? []) as ERPNotification[];
}

// ============================================================
// Products Service
// ============================================================

const PRODUCT_SELECT = `
  *,
  categories!inner(name, slug),
  brands(name, slug),
  product_images(id, url, alt, sort_order)
`;

export interface ProductListItem extends Product {
  category_name: string | null;
  category_slug: string | null;
  brand_name: string | null;
  brand_slug: string | null;
  image_url: string | null;
}

export interface ProductListResult {
  items: ProductListItem[];
  nextCursor: string | null;
}

export async function fetchProducts(opts: {
  search?: string;
  categoryId?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<ProductListResult> {
  const limit = opts.limit ?? APP_CONFIG.itemsPerPage;
  let query = supabase.from('products').select(PRODUCT_SELECT, { count: 'exact' }).eq('is_active', true);

  if (opts.search) {
    query = query.or(`name.ilike.%${opts.search}%,sku.ilike.%${opts.search}%,barcode.ilike.%${opts.search}%`);
  }
  if (opts.categoryId) {
    query = query.eq('category_id', opts.categoryId);
  }
  if (opts.cursor) {
    query = query.lt('created_at', opts.cursor);
  }

  query = query.order('created_at', { ascending: false }).limit(limit + 1);

  const { data, error } = await query;
  if (error) throw toApiError(error);

  const rows = (data ?? []) as unknown as Array<Product & {
    categories: { name: string; slug: string } | null;
    brands: { name: string; slug: string } | null;
    product_images: ProductImage[];
  }>;

  const items: ProductListItem[] = rows.slice(0, limit).map((row) => {
    const sortedImages = [...(row.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    return {
      ...row,
      category_name: row.categories?.name ?? null,
      category_slug: row.categories?.slug ?? null,
      brand_name: row.brands?.name ?? null,
      brand_slug: row.brands?.slug ?? null,
      image_url: sortedImages[0]?.url ?? null,
    };
  });

  const nextCursor = rows.length > limit ? rows[limit - 1]!.created_at : null;

  return { items, nextCursor };
}

export async function fetchProductById(id: string): Promise<ProductDetail> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw toApiError(error);
  if (!data) throw new ApiError('Product not found.');

  const row = data as unknown as Product & {
    categories: { name: string; slug: string } | null;
    brands: { name: string; slug: string } | null;
    product_images: ProductImage[];
  };

  const images: ProductImage[] = [...(row.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return {
    ...row,
    category_name: row.categories?.name ?? null,
    category_slug: row.categories?.slug ?? null,
    brand_name: row.brands?.name ?? null,
    brand_slug: row.brands?.slug ?? null,
    images,
  };
}

// ============================================================
// Categories Service
// ============================================================

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw toApiError(error);
  return (data ?? []) as Category[];
}

export async function fetchCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (catError) throw toApiError(catError);

  const { data: counts, error: countError } = await supabase
    .from('products')
    .select('category_id')
    .not('category_id', 'is', null);

  if (countError) throw toApiError(countError);

  const countMap = new Map<string, number>();
  for (const row of counts ?? []) {
    const cid = row.category_id as string;
    countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
  }

  return (categories ?? []).map((cat: Category) => ({
    ...cat,
    product_count: countMap.get(cat.id) ?? 0,
  }));
}

// ============================================================
// Branches & Warehouses Service
// ============================================================

export async function fetchBranches(): Promise<Branch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw toApiError(error);
  return (data ?? []) as Branch[];
}

export async function fetchWarehouses(): Promise<Warehouse[]> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw toApiError(error);
  return (data ?? []) as Warehouse[];
}

// ============================================================
// Inventory Service
// ============================================================

const INVENTORY_SELECT = `
  id,
  product_id,
  branch_id,
  warehouse_id,
  quantity_on_hand,
  quantity_reserved,
  reorder_point,
  min_stock,
  max_stock,
  batch_number,
  expiry_date,
  last_stocked_at,
  created_at,
  updated_at,
  products!inner (
    name,
    slug,
    sku,
    categories!left (
      name
    )
  ),
  branches!left (
    name
  ),
  warehouses!left (
    name
  )
`;

export interface InventoryFilter {
  branchId?: string;
  warehouseId?: string;
  categoryId?: string;
}

export async function fetchInventory(opts: InventoryFilter = {}): Promise<InventoryItemWithStatus[]> {
  let query = supabase
    .from('inventory')
    .select(INVENTORY_SELECT)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (opts.branchId) query = query.eq('branch_id', opts.branchId);
  if (opts.warehouseId) query = query.eq('warehouse_id', opts.warehouseId);
  if (opts.categoryId) query = query.eq('products.category_id', opts.categoryId);

  const { data, error } = await query;
  if (error) throw toApiError(error);

  const items: InventoryItemWithStatus[] = (data ?? []).map((row: Record<string, unknown>) => {
    const productData = row.products as { name: string; slug: string; sku: string | null; categories: { name: string } | null } | null;
    const branchData = row.branches as { name: string } | null;
    const warehouseData = row.warehouses as { name: string } | null;

    const base: InventoryItem = {
      id: row.id as string,
      product_id: row.product_id as string,
      product_name: productData?.name ?? 'Unknown Product',
      product_slug: productData?.slug ?? '',
      sku: productData?.sku ?? null,
      category_name: productData?.categories?.name ?? null,
      branch_id: row.branch_id as string | null,
      branch_name: branchData?.name ?? null,
      warehouse_id: row.warehouse_id as string | null,
      warehouse_name: warehouseData?.name ?? null,
      quantity_on_hand: row.quantity_on_hand as number,
      quantity_reserved: row.quantity_reserved as number,
      reorder_point: row.reorder_point as number,
      min_stock: row.min_stock as number,
      max_stock: row.max_stock as number,
      batch_number: row.batch_number as string | null,
      expiry_date: row.expiry_date as string | null,
      last_stocked_at: row.last_stocked_at as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };

    const available = base.quantity_on_hand - base.quantity_reserved;
    const isOut = base.quantity_on_hand <= 0;
    const isLow = !isOut && available <= base.reorder_point;

    return {
      ...base,
      available_stock: available,
      is_low_stock: isLow,
      is_out_of_stock: isOut,
      stock_status: isOut ? 'out' : isLow ? 'low' : 'ok',
    };
  });

  return items;
}

// ============================================================
// Category Detail Service
// ============================================================

export async function fetchCategoryById(id: string): Promise<CategoryWithCount> {
  const { data: categoryData, error: categoryError } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single();

  if (categoryError) throw toApiError(categoryError);
  if (!categoryData) throw new ApiError('Category not found.', '404', 404);

  const { count, error: countError } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id);

  if (countError) throw toApiError(countError);

  return { ...(categoryData as Category), product_count: count ?? 0 };
}

// ============================================================
// Warehouse Detail Service
// ============================================================

export async function fetchWarehouseById(id: string): Promise<WarehouseDetail> {
  const { data: whData, error: whError } = await supabase
    .from('warehouses')
    .select('*')
    .eq('id', id)
    .single();

  if (whError) throw toApiError(whError);
  if (!whData) throw new ApiError('Warehouse not found.', '404', 404);

  const wh = whData as Warehouse;

  const { data: invData, error: invError } = await supabase
    .from('inventory')
    .select('quantity_on_hand, quantity_reserved, reorder_point')
    .eq('warehouse_id', id);

  if (invError) throw toApiError(invError);

  const rows = invData ?? [];
  const totalUnits = rows.reduce((sum: number, r: { quantity_on_hand: number }) => sum + (r.quantity_on_hand ?? 0), 0);
  const totalReserved = rows.reduce((sum: number, r: { quantity_reserved: number }) => sum + (r.quantity_reserved ?? 0), 0);
  const totalAvailable = totalUnits - totalReserved;
  const lowStockCount = rows.filter((r: { quantity_on_hand: number; quantity_reserved: number; reorder_point: number }) => {
    const avail = (r.quantity_on_hand ?? 0) - (r.quantity_reserved ?? 0);
    return (r.quantity_on_hand ?? 0) > 0 && avail <= (r.reorder_point ?? 0);
  }).length;
  const productCount = rows.length;
  const utilizationPct = wh.capacity && wh.capacity > 0 ? Math.min(100, Math.round((totalUnits / wh.capacity) * 100)) : 0;

  return {
    ...wh,
    product_count: productCount,
    total_units: totalUnits,
    total_available: totalAvailable,
    low_stock_count: lowStockCount,
    utilization_pct: utilizationPct,
  };
}

// ============================================================
// Branch Detail Service
// ============================================================

export async function fetchBranchById(id: string): Promise<BranchDetail> {
  const { data: branchData, error: branchError } = await supabase
    .from('branches')
    .select('*')
    .eq('id', id)
    .single();

  if (branchError) throw toApiError(branchError);
  if (!branchData) throw new ApiError('Branch not found.', '404', 404);

  const branch = branchData as Branch;

  const { data: invData, error: invError } = await supabase
    .from('inventory')
    .select(`
      quantity_on_hand,
      warehouse_id,
      warehouses!left (
        name
      )
    `)
    .eq('branch_id', id);

  if (invError) throw toApiError(invError);

  const rows = invData ?? [];
  const totalStock = rows.reduce((sum: number, r: { quantity_on_hand: number }) => sum + (r.quantity_on_hand ?? 0), 0);
  const productCount = rows.length;

  const whRows = rows.filter((r: { warehouse_id: string | null }) => r.warehouse_id != null);
  let warehouseId: string | null = null;
  let warehouseName: string | null = null;
  if (whRows.length > 0) {
    const firstWh = whRows[0] as { warehouse_id: string; warehouses: { name: string }[] | null };
    const whName = Array.isArray(firstWh.warehouses) ? (firstWh.warehouses[0]?.name ?? null) : null;
    warehouseId = firstWh.warehouse_id;
    warehouseName = whName;
  }

  return {
    ...branch,
    product_count: productCount,
    total_stock: totalStock,
    warehouse_id: warehouseId,
    warehouse_name: warehouseName,
  };
}

// ============================================================
// Notification Service
// ============================================================

export async function fetchNotifications(userId: string, limit = 50): Promise<ERPNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw toApiError(error);
  return (data ?? []) as ERPNotification[];
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);

  if (error) throw toApiError(error);
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq('is_read', false);

  if (error) throw toApiError(error);
}

// ============================================================
// Profile Service
// ============================================================

export interface ProfileUpdate {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
}

export interface ProfileWithBranch extends Profile {
  branch_id: string | null;
  branch_name: string | null;
  position: string | null;
}

export async function fetchProfileWithBranch(userId: string): Promise<ProfileWithBranch> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw toApiError(profileError);
  if (!profile) throw new ApiError('Profile not found.', '404', 404);

  const { data: employee } = await supabase
    .from('employees')
    .select('branch_id, position, branches!left(name)')
    .eq('user_id', userId)
    .maybeSingle();

  const empData = employee as { branch_id: string | null; position: string | null; branches: { name: string } | null } | null;

  return {
    ...(profile as Profile),
    branch_id: empData?.branch_id ?? null,
    branch_name: empData?.branches?.name ?? null,
    position: empData?.position ?? null,
  };
}

export async function updateProfile(userId: string, updates: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw toApiError(error);
  return data as Profile;
}

export async function uploadProfileAvatar(userId: string, fileUri: string, mimeType: string): Promise<string> {
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, { uri: fileUri, type: mimeType } as unknown as Blob, {
      upsert: true,
      contentType: mimeType,
    });

  if (uploadError) throw toApiError(uploadError);

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

// ============================================================
// Customer Service
// ============================================================

export interface CustomerListParams {
  search?: string;
  cursor?: string | null;
  limit?: number;
}

export async function fetchCustomers(opts: CustomerListParams = {}): Promise<CustomerListResult> {
  const limit = opts.limit ?? APP_CONFIG.itemsPerPage;
  let query = supabase
    .from('v_customer_summary')
    .select('id, user_id, first_name, last_name, email, loyalty_points, created_at, order_count, total_spent, last_order_at');

  if (opts.search) {
    const s = opts.search.trim();
    query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%`);
  }

  if (opts.cursor) {
    query = query.lt('created_at', opts.cursor);
  }

  query = query.order('created_at', { ascending: false }).limit(limit + 1);

  const { data, error } = await query;
  if (error) throw toApiError(error);

  const rows = (data ?? []) as CustomerSummary[];
  const items: CustomerListItem[] = rows.slice(0, limit).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    loyalty_points: row.loyalty_points,
    created_at: row.created_at,
    order_count: row.order_count,
    total_spent: row.total_spent,
    last_order_at: row.last_order_at,
  }));

  const nextCursor = rows.length > limit ? rows[limit - 1]!.created_at : null;

  return { items, nextCursor };
}

export async function fetchCustomerById(id: string): Promise<CustomerDetail> {
  const { data: summaryData, error: summaryError } = await supabase
    .from('v_customer_summary')
    .select('id, user_id, first_name, last_name, email, loyalty_points, created_at, order_count, total_spent, last_order_at')
    .eq('id', id)
    .maybeSingle();

  if (summaryError) throw toApiError(summaryError);
  if (!summaryData) throw new ApiError('Customer not found.', '404', 404);

  const summary = summaryData as CustomerSummary;

  const { data: profileData } = await supabase
    .from('profiles')
    .select('email, phone, status, avatar_url, full_name')
    .eq('id', summary.user_id)
    .maybeSingle();

  const { data: addressRows, error: addressError } = await supabase
    .from('addresses')
    .select('id, customer_id, label, line1, line2, city, state, postal_code, country, phone, is_default, created_at')
    .eq('customer_id', id)
    .order('is_default', { ascending: false });

  if (addressError) throw toApiError(addressError);

  const { data: orderRows, error: orderError } = await supabase
    .from('v_order_summary')
    .select('id, order_number, status, payment_status, grand_total, currency, placed_at, created_at, item_count')
    .eq('customer_id', id)
    .order('placed_at', { ascending: false })
    .limit(5);

  if (orderError) throw toApiError(orderError);

  const profile = profileData as { email: string | null; phone: string | null; status: string | null; avatar_url: string | null; full_name: string | null } | null;

  return {
    id: summary.id,
    user_id: summary.user_id,
    first_name: summary.first_name,
    last_name: summary.last_name,
    phone: profile?.phone ?? null,
    email: profile?.email ?? summary.email,
    date_of_birth: null,
    marketing_opt_in: false,
    loyalty_points: summary.loyalty_points,
    created_at: summary.created_at,
    updated_at: summary.created_at,
    order_count: summary.order_count,
    total_spent: summary.total_spent,
    last_order_at: summary.last_order_at,
    addresses: (addressRows ?? []) as CustomerAddress[],
    recent_orders: (orderRows ?? []) as CustomerOrderSummary[],
  };
}

// ============================================================
// Supplier Service
// ============================================================

export interface SupplierListParams {
  search?: string;
  cursor?: string | null;
  limit?: number;
}

export async function fetchSuppliers(opts: SupplierListParams = {}): Promise<SupplierListResult> {
  const limit = opts.limit ?? APP_CONFIG.itemsPerPage;
  let query = supabase
    .from('suppliers')
    .select('id, name, contact_name, email, phone, address, city, country, payment_terms, is_active, created_at, updated_at');

  if (opts.search) {
    const s = opts.search.trim();
    query = query.or(`name.ilike.%${s}%,contact_name.ilike.%${s}%,email.ilike.%${s}%`);
  }

  if (opts.cursor) {
    query = query.lt('created_at', opts.cursor);
  }

  query = query.order('created_at', { ascending: false }).limit(limit + 1);

  const { data, error } = await query;
  if (error) throw toApiError(error);

  const rows = (data ?? []) as Supplier[];
  const items: SupplierListItem[] = rows.slice(0, limit).map((row) => ({
    id: row.id,
    name: row.name,
    contact_name: row.contact_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    country: row.country,
    payment_terms: row.payment_terms,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const nextCursor = rows.length > limit ? rows[limit - 1]!.created_at : null;

  return { items, nextCursor };
}

export async function fetchSupplierById(id: string): Promise<SupplierDetail> {
  const { data: supplierData, error: supplierError } = await supabase
    .from('suppliers')
    .select('id, name, contact_name, email, phone, address, city, country, payment_terms, is_active, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (supplierError) throw toApiError(supplierError);
  if (!supplierData) throw new ApiError('Supplier not found.', '404', 404);

  const supplier = supplierData as Supplier;

  const { data: poRows, error: poError } = await supabase
    .from('purchase_orders')
    .select('id, po_number, supplier_id, warehouse_id, status, grand_total, currency, expected_at, received_at, created_at')
    .eq('supplier_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (poError) throw toApiError(poError);

  return {
    ...supplier,
    purchase_orders: (poRows ?? []) as PurchaseOrderSummary[],
  };
}

// ============================================================
// Purchase Orders
// ============================================================

export interface PurchaseOrderListParams {
  search?: string;
  status?: string;
  cursor?: string | null;
  limit?: number;
}

export async function fetchPurchaseOrders(params: PurchaseOrderListParams): Promise<PurchaseOrderListResult> {
  const { search, status, cursor, limit = 20 } = params;
  let query = supabase
    .from('purchase_orders')
    .select('id, po_number, supplier_id, supplier:suppliers(name), warehouse_id, warehouse:warehouses(name), status, grand_total, currency, expected_at, received_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (search) {
    query = query.or(`po_number.ilike.%${search}%`);
  }
  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw toApiError(error);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    po_number: string;
    supplier_id: string;
    supplier: { name: string } | null;
    warehouse_id: string | null;
    warehouse: { name: string } | null;
    status: string;
    grand_total: number;
    currency: string;
    expected_at: string | null;
    received_at: string | null;
    created_at: string;
  }>;

  const items: PurchaseOrderListItem[] = rows.slice(0, limit).map((r) => ({
    id: r.id,
    po_number: r.po_number,
    supplier_id: r.supplier_id,
    supplier_name: r.supplier?.name ?? 'Unknown',
    warehouse_id: r.warehouse_id,
    warehouse_name: r.warehouse?.name ?? null,
    status: r.status,
    grand_total: Number(r.grand_total),
    currency: r.currency,
    expected_at: r.expected_at,
    received_at: r.received_at,
    created_at: r.created_at,
  }));

  const nextCursor = rows.length > limit ? items[items.length - 1].created_at : null;

  return { items, nextCursor };
}

export async function fetchPurchaseOrderById(id: string): Promise<PurchaseOrderDetail> {
  const { data: poRow, error: poError } = await supabase
    .from('purchase_orders')
    .select('id, po_number, supplier_id, supplier:suppliers(name), warehouse_id, warehouse:warehouses(name), status, subtotal, tax_total, shipping_total, grand_total, currency, expected_at, received_at, notes, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (poError) throw toApiError(poError);
  if (!poRow) throw new ApiError('Purchase order not found.', '404', 404);

  const po = poRow as unknown as {
    id: string;
    po_number: string;
    supplier_id: string;
    supplier: { name: string } | null;
    warehouse_id: string | null;
    warehouse: { name: string } | null;
    status: string;
    subtotal: number;
    tax_total: number;
    shipping_total: number;
    grand_total: number;
    currency: string;
    expected_at: string | null;
    received_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  };

  const { data: itemRows, error: itemError } = await supabase
    .from('purchase_order_items')
    .select('id, purchase_order_id, product_id, product:products(name), quantity, unit_cost, line_total, received_quantity')
    .eq('purchase_order_id', id)
    .order('created_at', { ascending: true });

  if (itemError) throw toApiError(itemError);

  const items: PurchaseOrderItem[] = ((itemRows ?? []) as unknown as Array<{
    id: string;
    purchase_order_id: string;
    product_id: string;
    product: { name: string } | null;
    quantity: number;
    unit_cost: number;
    line_total: number;
    received_quantity: number;
  }>).map((r) => ({
    id: r.id,
    purchase_order_id: r.purchase_order_id,
    product_id: r.product_id,
    product_name: r.product?.name ?? 'Unknown Product',
    quantity: r.quantity,
    unit_cost: Number(r.unit_cost),
    line_total: Number(r.line_total),
    received_quantity: r.received_quantity,
  }));

  return {
    id: po.id,
    po_number: po.po_number,
    supplier_id: po.supplier_id,
    supplier_name: po.supplier?.name ?? 'Unknown',
    warehouse_id: po.warehouse_id,
    warehouse_name: po.warehouse?.name ?? null,
    status: po.status,
    subtotal: Number(po.subtotal),
    tax_total: Number(po.tax_total),
    shipping_total: Number(po.shipping_total),
    grand_total: Number(po.grand_total),
    currency: po.currency,
    expected_at: po.expected_at,
    received_at: po.received_at,
    notes: po.notes,
    created_at: po.created_at,
    updated_at: po.updated_at,
    items,
  };
}

// ============================================================
// Sales Orders
// ============================================================

export interface SalesOrderListParams {
  search?: string;
  status?: string;
  cursor?: string | null;
  limit?: number;
}

export async function fetchSalesOrders(params: SalesOrderListParams): Promise<SalesOrderListResult> {
  const { search, status, cursor, limit = 20 } = params;
  let query = supabase
    .from('orders')
    .select('id, order_number, customer_id, customer:customers(first_name,last_name), status, payment_status, fulfillment_status, grand_total, currency, placed_at, created_at')
    .order('placed_at', { ascending: false })
    .limit(limit + 1);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (search) {
    query = query.or(`order_number.ilike.%${search}%`);
  }
  if (cursor) {
    query = query.lt('placed_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw toApiError(error);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    order_number: string;
    customer_id: string | null;
    customer: { first_name: string; last_name: string } | null;
    status: string;
    payment_status: string;
    fulfillment_status: string;
    grand_total: number;
    currency: string;
    placed_at: string;
    created_at: string;
  }>;

  const items: SalesOrderListItem[] = rows.slice(0, limit).map((r) => {
    const name = r.customer
      ? [r.customer.first_name, r.customer.last_name].filter(Boolean).join(' ').trim() || 'Unknown'
      : 'Guest Customer';
    return {
      id: r.id,
      order_number: r.order_number,
      customer_id: r.customer_id,
      customer_name: name,
      status: r.status,
      payment_status: r.payment_status,
      fulfillment_status: r.fulfillment_status,
      grand_total: Number(r.grand_total),
      currency: r.currency,
      placed_at: r.placed_at,
      created_at: r.created_at,
    };
  });

  const nextCursor = rows.length > limit ? items[items.length - 1].placed_at : null;

  return { items, nextCursor };
}

export async function fetchSalesOrderById(id: string): Promise<SalesOrderDetail> {
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, customer_id, customer:customers(first_name,last_name), status, payment_status, fulfillment_status, subtotal, discount_total, shipping_total, tax_total, grand_total, currency, tracking_number, carrier, notes, placed_at, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (orderError) throw toApiError(orderError);
  if (!orderRow) throw new ApiError('Sales order not found.', '404', 404);

  const o = orderRow as unknown as {
    id: string;
    order_number: string;
    customer_id: string | null;
    customer: { first_name: string; last_name: string } | null;
    status: string;
    payment_status: string;
    fulfillment_status: string;
    subtotal: number;
    discount_total: number;
    shipping_total: number;
    tax_total: number;
    grand_total: number;
    currency: string;
    tracking_number: string | null;
    carrier: string | null;
    notes: string | null;
    placed_at: string;
    created_at: string;
    updated_at: string;
  };

  const { data: itemRows, error: itemError } = await supabase
    .from('order_items')
    .select('id, order_id, product_id, product_name, variant_name, sku, price, quantity, line_total')
    .eq('order_id', id)
    .order('created_at', { ascending: true });

  if (itemError) throw toApiError(itemError);

  const items: SalesOrderItem[] = ((itemRows ?? []) as unknown as Array<{
    id: string;
    order_id: string;
    product_id: string | null;
    product_name: string;
    variant_name: string | null;
    sku: string | null;
    price: number;
    quantity: number;
    line_total: number;
  }>).map((r) => ({
    id: r.id,
    order_id: r.order_id,
    product_id: r.product_id,
    product_name: r.product_name,
    variant_name: r.variant_name,
    sku: r.sku,
    price: Number(r.price),
    quantity: r.quantity,
    line_total: Number(r.line_total),
  }));

  const customerName = o.customer
    ? [o.customer.first_name, o.customer.last_name].filter(Boolean).join(' ').trim() || 'Unknown'
    : 'Guest Customer';

  return {
    id: o.id,
    order_number: o.order_number,
    customer_id: o.customer_id,
    customer_name: customerName,
    status: o.status,
    payment_status: o.payment_status,
    fulfillment_status: o.fulfillment_status,
    subtotal: Number(o.subtotal),
    discount_total: Number(o.discount_total),
    shipping_total: Number(o.shipping_total),
    tax_total: Number(o.tax_total),
    grand_total: Number(o.grand_total),
    currency: o.currency,
    tracking_number: o.tracking_number,
    carrier: o.carrier,
    notes: o.notes,
    placed_at: o.placed_at,
    created_at: o.created_at,
    updated_at: o.updated_at,
    items,
  };
}
