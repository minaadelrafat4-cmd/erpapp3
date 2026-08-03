// Database row types — mirror the Supabase schema in src/lib/supabase.ts migration 0001.

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
  created_at: string;
  updated_at: string;
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
  qr_code: string | null;
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
  nicotine_strength: string | null;
  is_active: boolean;
  tags: string[];
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
  product_type: 'disposable' | 'refillable' | 'device' | 'e-liquid' | 'pod' | 'accessory' | 'coil' | 'battery' | 'charger' | null;
  is_age_restricted: boolean;
  nicotine_strength_mg: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  value: string;
  price: number;
  stock: number;
  sku: string | null;
  barcode: string | null;
  qr_code: string | null;
  created_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_approved: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  marketing_opt_in: boolean;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  customer_id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  is_default: boolean;
  created_at: string;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'failed';
export type FulfillmentStatus = 'unfulfilled' | 'fulfilled' | 'partial';

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  user_id: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  tax_total: number;
  grand_total: number;
  currency: string;
  shipping_address: Record<string, unknown> | null;
  billing_address: Record<string, unknown> | null;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  placed_at: string;
  created_at: string;
  updated_at: string;
  branch_id: string | null;
  source: 'website' | 'pos' | 'phone' | 'branch_transfer';
  pos_operator_id: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_subtotal: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

export interface CartItem {
  id: string;
  user_id: string | null;
  session_id: string | null;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  category_id: string | null;
  author: string | null;
  cover_image_url: string | null;
  tags: string[];
  is_published: boolean;
  published_at: string | null;
  reading_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface StoreLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  hours: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Career {
  id: string;
  title: string;
  slug: string;
  department: string | null;
  location: string | null;
  type: string | null;
  description: string;
  requirements: string | null;
  salary_range: string | null;
  is_open: boolean;
  posted_at: string;
  created_at: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

// ERP / Admin
export interface Branch {
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
  manager_id: string | null;
  opening_hours: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  position: string | null;
  branch_id: string | null;
  hire_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  payment_terms: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  product_id: string;
  branch_id: string | null;
  warehouse_id: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  reorder_point: number;
  max_stock: number;
  batch_number: string | null;
  expiry_date: string | null;
  last_stocked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  hierarchy_level: number;
  parent_role_id: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
  module: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

// ============================================================
// Backend extension types (migrations 0002–0004)
// ============================================================

export type UserRole = 'customer' | 'staff' | 'manager' | 'admin' | 'super_admin' | 'company_owner' | 'general_manager' | 'warehouse_manager' | 'branch_manager' | 'inventory_employee' | 'sales_employee' | 'marketing' | 'accountant' | 'customer_support';
export type UserStatus = 'active' | 'suspended' | 'locked';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
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

export type InventoryTransactionType =
  | 'purchase' | 'sale' | 'transfer_in' | 'transfer_out'
  | 'adjustment' | 'return' | 'reservation' | 'release';

export interface InventoryTransaction {
  id: string;
  product_id: string;
  warehouse_id: string | null;
  branch_id: string | null;
  transaction_type: InventoryTransactionType;
  quantity: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type StockAdjustmentType = 'increment' | 'decrement';
export type StockAdjustmentReason =
  | 'correction' | 'damage' | 'loss' | 'theft' | 'found' | 'recount' | 'other';

export interface StockAdjustment {
  id: string;
  product_id: string;
  warehouse_id: string | null;
  branch_id: string | null;
  adjustment_type: StockAdjustmentType;
  quantity: number;
  reason: StockAdjustmentReason;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type StockTransferStatus = 'pending' | 'in_transit' | 'received' | 'cancelled';

export interface StockTransfer {
  id: string;
  transfer_number: string;
  product_id: string;
  quantity: number;
  from_warehouse_id: string | null;
  from_branch_id: string | null;
  to_warehouse_id: string | null;
  to_branch_id: string | null;
  status: StockTransferStatus;
  shipped_at: string | null;
  received_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod =
  | 'card' | 'paypal' | 'apple_pay' | 'google_pay' | 'bank_transfer' | 'cash' | 'store_credit';
export type PaymentStatusType =
  | 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';

export interface Payment {
  id: string;
  order_id: string;
  payment_number: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatusType;
  gateway: string | null;
  gateway_transaction_id: string | null;
  gateway_response: Record<string, unknown> | null;
  processed_at: string | null;
  created_at: string;
}

export type InvoiceStatus =
  | 'draft' | 'sent' | 'paid' | 'partially_paid' | 'void' | 'overdue';

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  customer_id: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  shipping_total: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  status: InvoiceStatus;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  pdf_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  warehouse_id: string | null;
  status: PurchaseOrderStatus;
  subtotal: number;
  tax_total: number;
  shipping_total: number;
  grand_total: number;
  currency: string;
  expected_at: string | null;
  received_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  received_quantity: number;
  created_at: string;
}

export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  vendor: string | null;
  receipt_url: string | null;
  status: ExpenseStatus;
  approved_by: string | null;
  created_by: string | null;
  branch_id: string | null;
  warehouse_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  name: string;
  description: string | null;
  type: string;
  parameters: Record<string, unknown>;
  created_by: string | null;
  is_scheduled: boolean;
  schedule_cron: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Joined views used by the storefront
export interface ProductWithRelations extends Product {
  category?: Category | null;
  brand?: Brand | null;
  product_images?: ProductImage[];
  product_variants?: ProductVariant[];
}

export interface CartLine {
  cart: CartItem;
  product: Product;
  variant?: ProductVariant | null;
}

// ============================================================
// ERP extension types (migration 0005–0006)
// ============================================================

export interface SupplierContact {
  id: string;
  supplier_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SupplierPaymentMethod = 'bank_transfer' | 'check' | 'cash' | 'card' | 'wire' | 'other';
export type SupplierPaymentStatusType = 'pending' | 'completed' | 'cancelled' | 'bounced';

export interface SupplierPayment {
  id: string;
  payment_number: string;
  supplier_id: string;
  purchase_order_id: string | null;
  amount: number;
  currency: string;
  method: SupplierPaymentMethod;
  status: SupplierPaymentStatusType;
  paid_at: string;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type ProductBatchStatus = 'active' | 'expired' | 'depleted' | 'quarantined' | 'recalled';

export interface ProductBatch {
  id: string;
  product_id: string;
  batch_number: string;
  serial_number: string | null;
  supplier_id: string | null;
  purchase_order_id: string | null;
  warehouse_id: string | null;
  branch_id: string | null;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  unit_price: number;
  expiry_date: string | null;
  manufacture_date: string | null;
  status: ProductBatchStatus;
  received_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type StockAlertType = 'low_stock' | 'out_of_stock' | 'overstock' | 'expiring_soon' | 'expired' | 'reorder';
export type StockAlertSeverity = 'info' | 'warning' | 'critical';

export interface StockAlert {
  id: string;
  product_id: string;
  warehouse_id: string | null;
  branch_id: string | null;
  alert_type: StockAlertType;
  severity: StockAlertSeverity;
  message: string;
  quantity: number | null;
  threshold: number | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

// View result types
export interface InventoryValuation {
  product_id: string;
  product_name: string;
  sku: string | null;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  avg_unit_cost: number;
  total_cost_value: number;
  total_retail_value: number;
  total_potential_profit: number;
}

export interface BranchPerformance {
  branch_id: string;
  branch_name: string;
  branch_code: string;
  is_active: boolean;
  revenue: number;
  order_count: number;
  expenses: number;
  net_profit: number;
  employee_count: number;
}

export interface SupplierOutstanding {
  supplier_id: string;
  supplier_name: string;
  total_ordered: number;
  total_paid: number;
  outstanding_balance: number;
  po_count: number;
}

export interface InventoryTimelineEntry {
  id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  transaction_type: InventoryTransactionType;
  quantity: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  created_by: string | null;
  created_at: string;
}

// ============================================================
// Sales Management extension types (migration 0007)
// ============================================================

export type OrderTimelineEvent =
  | 'created' | 'processing' | 'paid' | 'payment_failed' | 'fulfilled'
  | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'refund_issued' | 'status_changed';

export interface OrderTimelineEntry {
  id: string;
  order_id: string;
  event: OrderTimelineEvent;
  description: string | null;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type OrderReturnStatus = 'pending' | 'approved' | 'rejected' | 'received' | 'restocked' | 'cancelled';
export type OrderReturnReason = 'damaged' | 'wrong_item' | 'not_as_described' | 'changed_mind' | 'quality_issue' | 'other';

export interface OrderReturn {
  id: string;
  return_number: string;
  order_id: string;
  customer_id: string | null;
  user_id: string | null;
  reason: OrderReturnReason;
  status: OrderReturnStatus;
  restocked: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderReturnItem {
  id: string;
  return_id: string;
  order_item_id: string;
  product_id: string | null;
  quantity: number;
  refund_amount: number;
  created_at: string;
}

export type OrderRefundStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type OrderRefundReason = 'customer_request' | 'damaged_goods' | 'wrong_item' | 'overcharge' | 'cancellation' | 'other';

export interface OrderRefund {
  id: string;
  refund_number: string;
  order_id: string;
  payment_id: string | null;
  return_id: string | null;
  amount: number;
  currency: string;
  reason: OrderRefundReason;
  status: OrderRefundStatus;
  processed_by: string | null;
  processed_at: string | null;
  gateway_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Advanced Inventory ERP extension types
// ============================================================

export type CycleCountStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type CycleCountType = 'full' | 'partial' | 'abc' | 'random' | 'spot';

export interface CycleCount {
  id: string;
  cycle_number: string;
  warehouse_id: string | null;
  branch_id: string | null;
  status: CycleCountStatus;
  count_type: CycleCountType;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  variance_total: number;
  variance_value_total: number;
  notes: string | null;
  created_by: string | null;
  supervised_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CycleCountItem {
  id: string;
  cycle_count_id: string;
  product_id: string;
  system_quantity: number;
  counted_quantity: number | null;
  variance: number;
  unit_cost: number;
  variance_value: number;
  counted_by: string | null;
  counted_at: string | null;
  notes: string | null;
  is_reconciled: boolean;
  created_at: string;
}

export type InventoryReservationStatus = 'active' | 'released' | 'fulfilled' | 'expired';

export interface InventoryReservation {
  id: string;
  reservation_number: string;
  product_id: string;
  order_id: string | null;
  quantity: number;
  warehouse_id: string | null;
  branch_id: string | null;
  status: InventoryReservationStatus;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type InventoryAdjustmentType = 'increment' | 'decrement' | 'set';
export type InventoryAdjustmentReason = 'correction' | 'damage' | 'loss' | 'theft' | 'found' | 'recount' | 'expired' | 'quarantine' | 'other';
export type InventoryAdjustmentCategory = 'lost_inventory' | 'damaged_inventory' | 'expired_inventory' | 'found_inventory' | 'correction' | 'other';

export interface InventoryAdjustment {
  id: string;
  adjustment_number: string;
  product_id: string;
  warehouse_id: string | null;
  branch_id: string | null;
  adjustment_type: InventoryAdjustmentType;
  quantity: number;
  new_quantity: number;
  reason: InventoryAdjustmentReason;
  category: InventoryAdjustmentCategory;
  unit_cost: number;
  total_value_impact: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type ReorderUrgency = 'critical' | 'high' | 'medium' | 'low';
export type ReorderStatus = 'pending' | 'ordered' | 'dismissed' | 'auto_ordered';

export interface ReorderSuggestion {
  id: string;
  product_id: string;
  warehouse_id: string | null;
  branch_id: string | null;
  current_stock: number;
  reorder_point: number;
  suggested_quantity: number;
  supplier_id: string | null;
  estimated_cost: number;
  urgency: ReorderUrgency;
  status: ReorderStatus;
  generated_at: string;
  ordered_at: string | null;
  purchase_order_id: string | null;
  created_at: string;
}

export interface InventoryAgingEntry {
  product_id: string;
  product_name: string;
  sku: string | null;
  stock: number;
  is_active: boolean;
  unit_cost: number;
  stock_value: number;
  total_sold_30d: number;
  movement_category: 'dead' | 'slow' | 'medium' | 'fast';
  days_of_supply: number;
  category_name: string | null;
}

export interface FastMovingProduct {
  product_id: string;
  product_name: string;
  sku: string;
  stock: number;
  qty_sold_30d: number;
  revenue_30d: number;
  turnover_ratio: number;
  category_name: string | null;
}

export interface SlowMovingProduct {
  product_id: string;
  product_name: string;
  sku: string;
  stock: number;
  qty_sold_30d: number;
  revenue_30d: number;
  tied_up_capital: number;
  category_name: string | null;
}

export interface DeadStockEntry {
  product_id: string;
  product_name: string;
  sku: string;
  stock: number;
  tied_up_capital: number;
  first_stocked: string;
  category_name: string | null;
}

export interface ReorderSuggestionView {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  current_stock: number;
  reorder_point: number;
  suggested_quantity: number;
  supplier_id: string | null;
  supplier_name: string | null;
  estimated_cost: number;
  urgency: ReorderUrgency;
  status: ReorderStatus;
  generated_at: string;
  purchase_order_id: string | null;
  warehouse_name: string | null;
  branch_name: string | null;
}

export interface InventoryReconciliationSummary {
  cycle_count_id: string;
  cycle_number: string;
  status: CycleCountStatus;
  count_type: CycleCountType;
  warehouse_id: string | null;
  warehouse_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_items: number;
  counted_items: number;
  variance_items: number;
  total_variance_qty: number;
  total_variance_value: number;
  reconciled_items: number;
}

export interface WarehouseActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
  user_role: string | null;
}

export interface BranchAnalytics {
  branch_id: string;
  branch_name: string;
  branch_code: string;
  city: string | null;
  is_active: boolean;
  total_revenue: number;
  order_count: number;
  avg_order_value: number;
}

// ============================================================
// Security types
// ============================================================

export interface SecurityEvent {
  id: string;
  event_type: string;
  user_id: string | null;
  email: string | null;
  ip_address: string | null;
  severity: 'info' | 'warning' | 'critical';
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface LoginHistoryEntry {
  id: string;
  email: string;
  ip_address: string | null;
  user_agent: string | null;
  device_id: string | null;
  successful: boolean;
  failure_reason: string | null;
  created_at: string;
}

export interface ActiveSession {
  id: string;
  device_id: string | null;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_active_at: string;
  expires_at: string;
  created_at: string;
}
