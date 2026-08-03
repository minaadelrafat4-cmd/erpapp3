import { supabase } from './supabase';

export interface ProcessSaleParams {
  productId: string;
  branchId: string;
  quantity: number;
  orderId: string;
  userId: string;
}

export interface ExecuteWarehouseTransferParams {
  productId: string;
  fromWarehouseId: string;
  toBranchId?: string;
  toWarehouseId?: string;
  quantity: number;
  userId: string;
}

export interface ReceiveInventoryParams {
  productId: string;
  locationId: string;
  isWarehouse: boolean;
  quantity: number;
  userId: string;
}

export interface AdjustInventoryParams {
  productId: string;
  locationId: string;
  isWarehouse: boolean;
  quantityDelta: number; // Positive for increase, negative for decrease
  reason: string;
  userId: string;
}

export interface ReserveStockParams {
  productId: string;
  branchId?: string;
  warehouseId?: string;
  quantity: number;
  userId?: string;
  expiresInMinutes?: number;
}

/**
 * 1. Process a Sale
 * Triggers `process_sale` RPC to deduct branch stock and record an immutable transaction.
 */
export async function processSale(params: ProcessSaleParams) {
  if (params.quantity <= 0) {
    throw new Error('Sale quantity must be greater than zero.');
  }

  const { data, error } = await supabase.rpc('process_sale', {
    p_product_id: params.productId,
    p_branch_id: params.branchId,
    p_qty: params.quantity,
    p_order_id: params.orderId,
    p_user_id: params.userId,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * 2. Transfer Inventory between Locations
 * Triggers `execute_warehouse_transfer` RPC to move stock between a warehouse and branch/warehouse.
 */
export async function executeWarehouseTransfer(params: ExecuteWarehouseTransferParams) {
  if (params.quantity <= 0) {
    throw new Error('Transfer quantity must be greater than zero.');
  }

  const { data, error } = await supabase.rpc('execute_warehouse_transfer', {
    p_product_id: params.productId,
    p_from_warehouse_id: params.fromWarehouseId,
    p_to_branch_id: params.toBranchId ?? null,
    p_to_warehouse_id: params.toWarehouseId ?? null,
    p_qty: params.quantity,
    p_user_id: params.userId,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * 3. Receive Stock from Supplier
 * Triggers `receive_inventory` RPC to credit location stock and record inventory transaction.
 */
export async function receiveInventory(params: ReceiveInventoryParams) {
  if (params.quantity <= 0) {
    throw new Error('Received quantity must be greater than zero.');
  }

  const { data, error } = await supabase.rpc('receive_inventory', {
    p_product_id: params.productId,
    p_location_id: params.locationId,
    p_is_warehouse: params.isWarehouse,
    p_qty: params.quantity,
    p_user_id: params.userId,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * 4. Adjust Inventory (Manual Corrections, Loss, Shrinkage)
 * Triggers `adjust_inventory` RPC to update stock balances safely with audit logs.
 */
export async function adjustInventory(params: AdjustInventoryParams) {
  if (params.quantityDelta === 0) {
    throw new Error('Adjustment quantity delta cannot be zero.');
  }

  const { data, error } = await supabase.rpc('adjust_inventory', {
    p_product_id: params.productId,
    p_location_id: params.locationId,
    p_is_warehouse: params.isWarehouse,
    p_qty_delta: params.quantityDelta,
    p_reason: params.reason,
    p_user_id: params.userId,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * 5. Reserve Stock during Checkout
 * Triggers `reserve_stock` RPC to hold stock for pending checkout workflows.
 */
export async function reserveStock(params: ReserveStockParams) {
  if (params.quantity <= 0) {
    throw new Error('Reservation quantity must be greater than zero.');
  }

  const { data, error } = await supabase.rpc('reserve_stock', {
    p_product_id: params.productId,
    p_branch_id: params.branchId ?? null,
    p_warehouse_id: params.warehouseId ?? null,
    p_qty: params.quantity,
    p_user_id: params.userId ?? null,
    p_expires_in_minutes: params.expiresInMinutes ?? 15,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * 6. Release an Inventory Reservation
 * Triggers `release_inventory_reservation` RPC to restore held stock.
 */
export async function releaseReservation(reservationId: string) {
  const { data, error } = await supabase.rpc('release_inventory_reservation', {
    p_reservation_id: reservationId,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * 7. Fetch Real-time Dashboard Summary
 * Queries `view_inventory_summary` for up-to-date reporting.
 */
export async function getInventorySummary(branchId?: string, warehouseId?: string) {
  let query = supabase.from('view_inventory_summary').select('*');

  if (branchId) {
    query = query.eq('branch_id', branchId);
  } else if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}