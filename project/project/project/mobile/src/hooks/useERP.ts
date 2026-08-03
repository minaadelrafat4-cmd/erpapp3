import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchDashboardSummary,
  fetchRecentNotifications,
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  fetchProducts,
  fetchProductById,
  fetchCategories,
  fetchCategoriesWithCounts,
  fetchCategoryById,
  fetchInventory,
  fetchBranches,
  fetchBranchById,
  fetchWarehouses,
  fetchWarehouseById,
  fetchProfileWithBranch,
  updateProfile,
  uploadProfileAvatar,
  fetchCustomers,
  fetchCustomerById,
  fetchSuppliers,
  fetchSupplierById,
  type ProductListResult,
  type ProductListItem,
  type InventoryFilter,
  type ProfileUpdate,
  type ProfileWithBranch,
} from '@services/erpService';
import { APP_CONFIG } from '@constants';
import type {
  DashboardSummary,
  ERPNotification,
  Category,
  CategoryWithCount,
  InventoryItemWithStatus,
  Branch,
  BranchDetail,
  Warehouse,
  WarehouseDetail,
  ProductDetail,
  CustomerDetail,
  CustomerListItem,
  CustomerListResult,
  SupplierDetail,
  SupplierListItem,
  SupplierListResult,
} from '@apptypes/erp';
import type { Profile } from '@apptypes';

// ============================================================
// Query Keys
// ============================================================

export const erpKeys = {
  dashboard: ['erp', 'dashboard'] as const,
  notifications: (limit: number) => ['erp', 'notifications', limit] as const,
  products: ['erp', 'products'] as const,
  productsList: (search: string, categoryId: string | null) => ['erp', 'products', 'list', search, categoryId] as const,
  product: (id: string) => ['erp', 'products', 'detail', id] as const,
  categories: ['erp', 'categories'] as const,
  category: (id: string) => ['erp', 'categories', 'detail', id] as const,
  inventory: (filters: InventoryFilter) => ['erp', 'inventory', filters] as const,
  branches: ['erp', 'branches'] as const,
  branch: (id: string) => ['erp', 'branches', 'detail', id] as const,
  warehouses: ['erp', 'warehouses'] as const,
  warehouse: (id: string) => ['erp', 'warehouses', 'detail', id] as const,
  notificationsAll: (userId: string) => ['erp', 'notifications', 'all', userId] as const,
  profileWithBranch: (userId: string) => ['erp', 'profile', userId] as const,
  customersList: (search: string) => ['erp', 'customers', 'list', search] as const,
  customer: (id: string) => ['erp', 'customers', 'detail', id] as const,
  suppliersList: (search: string) => ['erp', 'suppliers', 'list', search] as const,
  supplier: (id: string) => ['erp', 'suppliers', 'detail', id] as const,
};

// ============================================================
// Dashboard Hooks
// ============================================================

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: erpKeys.dashboard,
    queryFn: fetchDashboardSummary,
    staleTime: 60_000,
  });
}

export function useRecentNotifications(userId: string | null | undefined, limit = 5) {
  return useQuery<ERPNotification[]>({
    queryKey: erpKeys.notifications(limit),
    queryFn: () => fetchRecentNotifications(userId!, limit),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ============================================================
// Product Hooks
// ============================================================

export function useProducts(search: string, categoryId: string | null) {
  return useInfiniteQuery<ProductListResult>({
    queryKey: erpKeys.productsList(search, categoryId ?? 'all'),
    queryFn: ({ pageParam }) =>
      fetchProducts({
        search: search || undefined,
        categoryId: categoryId ?? undefined,
        cursor: (pageParam as string | null) ?? null,
        limit: APP_CONFIG.itemsPerPage,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}

export function useProduct(id: string | null) {
  return useQuery<ProductDetail>({
    queryKey: erpKeys.product(id ?? ''),
    queryFn: () => fetchProductById(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export type { ProductListItem, ProductListResult };

// ============================================================
// Category Hooks
// ============================================================

export function useCategories() {
  return useQuery<CategoryWithCount[]>({
    queryKey: erpKeys.categories,
    queryFn: fetchCategoriesWithCounts,
    staleTime: 5 * 60_000,
  });
}

export function useCategoryDetail(id: string | null) {
  return useQuery<CategoryWithCount>({
    queryKey: erpKeys.category(id ?? ''),
    queryFn: () => fetchCategoryById(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// ============================================================
// Inventory Hooks
// ============================================================

export function useInventory(filters: InventoryFilter = {}) {
  return useQuery<InventoryItemWithStatus[]>({
    queryKey: erpKeys.inventory(filters),
    queryFn: () => fetchInventory(filters),
    staleTime: 30_000,
  });
}

// ============================================================
// Branches & Warehouses Hooks
// ============================================================

export function useBranches() {
  return useQuery<Branch[]>({
    queryKey: erpKeys.branches,
    queryFn: fetchBranches,
    staleTime: 5 * 60_000,
  });
}

export function useBranchDetail(id: string | null) {
  return useQuery<BranchDetail>({
    queryKey: erpKeys.branch(id ?? ''),
    queryFn: () => fetchBranchById(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useWarehouses() {
  return useQuery<Warehouse[]>({
    queryKey: erpKeys.warehouses,
    queryFn: fetchWarehouses,
    staleTime: 5 * 60_000,
  });
}

export function useWarehouseDetail(id: string | null) {
  return useQuery<WarehouseDetail>({
    queryKey: erpKeys.warehouse(id ?? ''),
    queryFn: () => fetchWarehouseById(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// ============================================================
// Refresh Helper
// ============================================================

export function useRefreshERP() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ['erp'] });
  };
}

// ============================================================
// Notification Hooks
// ============================================================

export function useNotifications(userId: string | null) {
  return useQuery<ERPNotification[]>({
    queryKey: erpKeys.notificationsAll(userId ?? ''),
    queryFn: () => fetchNotifications(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  return async (id: string, userId: string) => {
    await markNotificationAsRead(id);
    await queryClient.invalidateQueries({ queryKey: erpKeys.notificationsAll(userId) });
  };
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  return async (userId: string) => {
    await markAllNotificationsAsRead(userId);
    await queryClient.invalidateQueries({ queryKey: erpKeys.notificationsAll(userId) });
  };
}

// ============================================================
// Profile Hooks
// ============================================================

export function useProfileWithBranch(userId: string | null) {
  return useQuery<ProfileWithBranch>({
    queryKey: erpKeys.profileWithBranch(userId ?? ''),
    queryFn: () => fetchProfileWithBranch(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return async (userId: string, updates: ProfileUpdate): Promise<Profile> => {
    const updated = await updateProfile(userId, updates);
    await queryClient.invalidateQueries({ queryKey: erpKeys.profileWithBranch(userId) });
    return updated;
  };
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return async (userId: string, fileUri: string, mimeType: string): Promise<string> => {
    const publicUrl = await uploadProfileAvatar(userId, fileUri, mimeType);
    await queryClient.invalidateQueries({ queryKey: erpKeys.profileWithBranch(userId) });
    return publicUrl;
  };
}

// ============================================================
// Customer Hooks
// ============================================================

export function useCustomers(search: string) {
  return useInfiniteQuery<CustomerListResult>({
    queryKey: erpKeys.customersList(search),
    queryFn: ({ pageParam }) =>
      fetchCustomers({
        search: search || undefined,
        cursor: (pageParam as string | null) ?? null,
        limit: APP_CONFIG.itemsPerPage,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}

export function useCustomerDetail(id: string | null) {
  return useQuery<CustomerDetail>({
    queryKey: erpKeys.customer(id ?? ''),
    queryFn: () => fetchCustomerById(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export type { CustomerListItem, CustomerListResult };

// ============================================================
// Supplier Hooks
// ============================================================

export function useSuppliers(search: string) {
  return useInfiniteQuery<SupplierListResult>({
    queryKey: erpKeys.suppliersList(search),
    queryFn: ({ pageParam }) =>
      fetchSuppliers({
        search: search || undefined,
        cursor: (pageParam as string | null) ?? null,
        limit: APP_CONFIG.itemsPerPage,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}

export function useSupplierDetail(id: string | null) {
  return useQuery<SupplierDetail>({
    queryKey: erpKeys.supplier(id ?? ''),
    queryFn: () => fetchSupplierById(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export type { SupplierListItem, SupplierListResult };
