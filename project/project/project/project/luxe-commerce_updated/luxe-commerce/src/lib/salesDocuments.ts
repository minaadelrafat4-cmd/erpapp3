/*
 * Sales documents — receipt & invoice generation for completed orders.
 *
 * This does NOT introduce a new invoice/receipt system. It completes the
 * one that already exists in the schema:
 *   - `invoices` table (migration 0002)
 *   - `generate_invoice(order_id)` RPC (migration 0003, hardened in 0021)
 * A "receipt" and an "invoice" are two print layouts over the same
 * underlying order + invoice record — a receipt is the compact proof of
 * sale, an invoice is the formal billing document. Neither is stored
 * separately from the order; both are always regenerated from live data
 * and are therefore always in sync with the order they came from.
 *
 * Printing reuses the same window.open() + write() + window.print()
 * pattern already used by `exportToPdf()` in `src/lib/export.ts`, rather
 * than introducing a new PDF/printing approach.
 */

import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { Order, OrderItem, Branch, Invoice } from '@/types';

// Existing brand identity already used elsewhere in this codebase
// (Footer.tsx, AdminSettings.tsx default values, AgeVerification.tsx) —
// reused here rather than inventing new branding. There is no
// company-logo image or persisted company-settings table anywhere in
// this project, so the header uses the same "LUXE" wordmark treatment
// already used site-wide in Navbar.tsx/Footer.tsx.
const COMPANY = {
  name: 'LUXE Vape & Smoking Co.',
  address: '1 Liberty Plaza, New York, NY',
  phone: '+1 (800) 585-2937',
  email: 'hello@luxe.co',
};

export interface DocumentCustomerInfo {
  name: string;
  email: string | null;
  phone: string | null;
}

export interface DocumentCashierInfo {
  name: string;
}

/**
 * Resolves the customer's display name, email, and phone for a given
 * order — preferring the linked customer/profile record, and falling
 * back to the shipping address captured at checkout for guest orders.
 */
export async function resolveCustomerInfo(order: Order): Promise<DocumentCustomerInfo> {
  if (order.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('first_name, last_name, phone, user_id')
      .eq('id', order.customer_id)
      .maybeSingle();
    if (customer) {
      let email: string | null = null;
      if (customer.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', customer.user_id)
          .maybeSingle();
        email = profile?.email ?? null;
      }
      const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
      return { name: name || 'Guest Customer', email, phone: customer.phone ?? null };
    }
  }

  if (order.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name, phone')
      .eq('id', order.user_id)
      .maybeSingle();
    if (profile) {
      return { name: profile.full_name || 'Guest Customer', email: profile.email ?? null, phone: profile.phone ?? null };
    }
  }

  const shipping = order.shipping_address as Record<string, unknown> | null;
  const shippingName = typeof shipping?.name === 'string' ? shipping.name : null;
  return { name: shippingName || 'Walk-in Customer', email: null, phone: null };
}

/**
 * Resolves the cashier/staff member who processed the order (POS sales
 * only — website orders have no operator and are labeled accordingly).
 */
export async function resolveCashierInfo(order: Order): Promise<DocumentCashierInfo> {
  if (order.pos_operator_id) {
    const { data: employee } = await supabase
      .from('employees')
      .select('first_name, last_name')
      .eq('id', order.pos_operator_id)
      .maybeSingle();
    if (employee) {
      const name = [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim();
      if (name) return { name };
    }
  }
  return { name: order.source === 'pos' ? 'Staff' : 'Online Store' };
}

/**
 * Resolves the payment method used for the order. POS sales record it as
 * free text in `orders.notes` (`process_pos_checkout` writes
 * "Payment method: cash") since there is no dedicated column on `orders`;
 * this reads that same value back rather than adding a new column.
 * Falls back to a `payments` row if one exists, then to a sensible label
 * based on order source/payment_status.
 */
export async function resolvePaymentMethod(order: Order): Promise<string> {
  const notesMatch = order.notes?.match(/Payment method:\s*([a-z_ ]+)/i);
  if (notesMatch) return titleCase(notesMatch[1].trim());

  const { data: payment } = await supabase
    .from('payments')
    .select('method')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (payment?.method) return titleCase(payment.method);

  if (order.source === 'website' || order.source === 'phone') {
    return order.payment_status === 'paid' ? 'Online Payment' : 'Not Paid';
  }
  return 'Not Specified';
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Ensures an invoice row exists for the order (creating one via the
 * existing `generate_invoice` RPC if needed) and returns it. Safe to call
 * repeatedly — `generate_invoice` is idempotent per order_id.
 */
export async function getOrCreateInvoice(orderId: string): Promise<Invoice> {
  const { data: invoiceId, error: rpcError } = await supabase.rpc('generate_invoice', { p_order_id: orderId });
  if (rpcError) throw new Error(rpcError.message);

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId as string)
    .single();
  if (fetchError || !invoice) throw new Error(fetchError?.message ?? 'Invoice could not be loaded');
  return invoice as Invoice;
}

export interface SalesDocumentData {
  kind: 'receipt' | 'invoice';
  order: Order;
  items: OrderItem[];
  invoice: Invoice;
  branch: Branch | null;
  customer: DocumentCustomerInfo;
  cashier: DocumentCashierInfo;
  paymentMethod: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDocumentHtml(data: SalesDocumentData): string {
  const { kind, order, items, invoice, branch, customer, cashier, paymentMethod } = data;
  const isInvoice = kind === 'invoice';
  const docTitle = isInvoice ? 'Sales Invoice' : 'Sales Receipt';
  const docNumber = invoice.invoice_number;

  const itemRows = items
    .map(
      (it) => `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(it.product_name)}</div>
            ${it.variant_name ? `<div class="item-sub">${escapeHtml(it.variant_name)}</div>` : ''}
            ${it.sku ? `<div class="item-sub">SKU: ${escapeHtml(it.sku)}</div>` : ''}
          </td>
          <td class="num">${it.quantity}</td>
          <td class="num">${escapeHtml(formatCurrency(it.price, order.currency))}</td>
          <td class="num">${escapeHtml(formatCurrency(it.line_total, order.currency))}</td>
        </tr>`,
    )
    .join('');

  const totalsRows = [
    ['Subtotal', invoice.subtotal],
    ['Discount', -invoice.discount_total],
    ['Shipping', invoice.shipping_total],
    ['Tax', invoice.tax_total],
  ]
    .filter(([, amount]) => Number(amount) !== 0)
    .map(
      ([label, amount]) => `
        <tr>
          <td class="totals-label">${label}</td>
          <td class="num">${escapeHtml(formatCurrency(amount as number, order.currency))}</td>
        </tr>`,
    )
    .join('');

  const invoiceOnlyBlock = isInvoice
    ? `
      <div class="meta-col">
        <p class="meta-label">Amount Paid</p>
        <p class="meta-value">${escapeHtml(formatCurrency(invoice.amount_paid, order.currency))}</p>
      </div>
      <div class="meta-col">
        <p class="meta-label">Balance Due</p>
        <p class="meta-value">${escapeHtml(formatCurrency(invoice.balance_due, order.currency))}</p>
      </div>
      <div class="meta-col">
        <p class="meta-label">Due Date</p>
        <p class="meta-value">${invoice.due_at ? escapeHtml(formatDate(invoice.due_at)) : '—'}</p>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(docTitle)} ${escapeHtml(docNumber)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; color: #1f2937; padding: 40px; max-width: 720px; margin: 0 auto; }
  .brand { font-size: 26px; font-weight: 800; letter-spacing: 0.04em; color: #92722a; }
  .brand-sub { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; margin-bottom: 24px; }
  .doc-title { font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1a1a2e; text-align: right; }
  .doc-number { font-size: 13px; color: #6b7280; text-align: right; margin-top: 4px; font-family: monospace; }
  .meta-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 24px; }
  .meta-col { flex: 1; min-width: 140px; }
  .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 3px; }
  .meta-value { font-size: 13px; color: #1f2937; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; padding: 8px 6px; border-bottom: 2px solid #1a1a2e; }
  thead th.num, td.num { text-align: right; }
  tbody td { padding: 10px 6px; border-bottom: 1px solid #e5e7eb; font-size: 13px; vertical-align: top; }
  .item-name { font-weight: 600; }
  .item-sub { font-size: 11px; color: #6b7280; }
  .totals { width: 260px; margin-left: auto; margin-bottom: 24px; }
  .totals td { padding: 5px 6px; font-size: 13px; border: none; }
  .totals-label { color: #6b7280; }
  .totals .grand td { border-top: 2px solid #1a1a2e; font-weight: 800; font-size: 16px; color: #1a1a2e; padding-top: 10px; }
  .footer { border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${escapeHtml(COMPANY.name.split(' ')[0])}</div>
      <div class="brand-sub">${escapeHtml(COMPANY.name)}</div>
      <div class="brand-sub">${escapeHtml(COMPANY.address)}</div>
      <div class="brand-sub">${escapeHtml(COMPANY.phone)} · ${escapeHtml(COMPANY.email)}</div>
    </div>
    <div>
      <div class="doc-title">${escapeHtml(docTitle)}</div>
      <div class="doc-number">${escapeHtml(docNumber)}</div>
      <div class="doc-number">Order ${escapeHtml(order.order_number)}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-col">
      <p class="meta-label">Billed To</p>
      <p class="meta-value">${escapeHtml(customer.name)}</p>
      ${customer.email ? `<p class="brand-sub">${escapeHtml(customer.email)}</p>` : ''}
      ${customer.phone ? `<p class="brand-sub">${escapeHtml(customer.phone)}</p>` : ''}
    </div>
    <div class="meta-col">
      <p class="meta-label">Date</p>
      <p class="meta-value">${escapeHtml(formatDateTime(order.placed_at))}</p>
    </div>
    <div class="meta-col">
      <p class="meta-label">Branch</p>
      <p class="meta-value">${escapeHtml(branch?.name ?? 'Online Store')}</p>
    </div>
    <div class="meta-col">
      <p class="meta-label">Served By</p>
      <p class="meta-value">${escapeHtml(cashier.name)}</p>
    </div>
    <div class="meta-col">
      <p class="meta-label">Payment Method</p>
      <p class="meta-value">${escapeHtml(paymentMethod)}</p>
    </div>
    ${invoiceOnlyBlock}
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="num">Qty</th>
        <th class="num">Unit Price</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <table class="totals">
    ${totalsRows}
    <tr class="grand">
      <td class="totals-label">Total</td>
      <td class="num">${escapeHtml(formatCurrency(invoice.grand_total, order.currency))}</td>
    </tr>
  </table>

  <div class="footer">
    <p>Thank you for shopping with ${escapeHtml(COMPANY.name)}.</p>
    <p>${escapeHtml(docTitle)} generated ${escapeHtml(formatDateTime(new Date()))}</p>
  </div>

  <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
</body>
</html>`;
}

/**
 * Opens a print-ready window for the given receipt/invoice data, matching
 * the existing window.open + write + auto-print pattern used by
 * `exportToPdf()` in `src/lib/export.ts`.
 */
export function printSalesDocument(data: SalesDocumentData): boolean {
  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) return false;
  printWindow.document.write(buildDocumentHtml(data));
  printWindow.document.close();
  return true;
}
