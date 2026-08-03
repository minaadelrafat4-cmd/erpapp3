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
