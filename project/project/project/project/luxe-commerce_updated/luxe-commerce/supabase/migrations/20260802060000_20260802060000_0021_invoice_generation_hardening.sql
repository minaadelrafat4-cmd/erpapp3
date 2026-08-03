/*
# Invoice generation hardening — required to safely wire up printable
# receipts/invoices for completed orders

## Overview
`generate_invoice(p_order_id)` was added in migration 0003 but has never
been called from anywhere in the application (no frontend RPC call, no
trigger). This migration is a prerequisite for actually wiring it up to
the order detail screen so staff can print a receipt/invoice for a
completed order. Auditing the existing function surfaced two defects that
must be fixed before it's safe to call from the client:

1. No staff check. Every other order-mutating SECURITY DEFINER function in
   this codebase (`process_pos_checkout`, `cancel_order`, `issue_refund`,
   `update_order_status`) gates on `is_staff()`. `generate_invoice()` did
   not, so any authenticated customer could call the RPC directly (e.g.
   from the browser console) with an arbitrary `p_order_id` belonging to
   someone else and create a real row in `invoices` for it, bypassing the
   `staff_insert_invoices` RLS policy that SECURITY DEFINER functions run
   above. This migration adds the same `is_staff()` guard used everywhere
   else in this schema.

2. Incorrect paid/balance state. The function unconditionally inserted new
   invoices with `status = 'sent'`, `amount_paid = 0`, and
   `balance_due = grand_total` — even for orders whose `payment_status` is
   already `'paid'` (every POS sale via `process_pos_checkout`, and every
   online order via `place_customer_order`, is marked paid at the moment
   the order is created). Printing an invoice for an already-paid order
   would incorrectly show it as outstanding. This migration makes the
   invoice reflect the order's actual `payment_status` at generation time.

No table, column, or RLS policy is added, dropped, or changed — this is a
function-only repair, consistent with how 0020 repaired
`process_pos_checkout()`.

## Safety
- `CREATE OR REPLACE FUNCTION` under the existing name/signature; no
  caller needs to change.
- Idempotent: safe to re-run.
*/

CREATE OR REPLACE FUNCTION generate_invoice(p_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_number text;
  v_order orders%ROWTYPE;
  v_status text;
  v_amount_paid numeric(12,2);
  v_balance_due numeric(12,2);
  v_paid_at timestamptz;
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'Access denied: generating an invoice requires staff privileges.';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  -- Idempotent: reuse the existing invoice for this order rather than
  -- creating a duplicate.
  SELECT id INTO v_invoice_id FROM invoices WHERE order_id = p_order_id LIMIT 1;
  IF FOUND THEN RETURN v_invoice_id; END IF;

  IF v_order.payment_status = 'paid' THEN
    v_status := 'paid';
    v_amount_paid := v_order.grand_total;
    v_balance_due := 0;
    v_paid_at := now();
  ELSIF v_order.payment_status = 'refunded' THEN
    v_status := 'void';
    v_amount_paid := 0;
    v_balance_due := 0;
    v_paid_at := NULL;
  ELSE
    v_status := 'sent';
    v_amount_paid := 0;
    v_balance_due := v_order.grand_total;
    v_paid_at := NULL;
  END IF;

  v_invoice_number := 'INV-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
  INSERT INTO invoices (
    invoice_number, order_id, customer_id, subtotal, discount_total, tax_total,
    shipping_total, grand_total, amount_paid, balance_due, status, issued_at, due_at, paid_at
  )
  VALUES (
    v_invoice_number, p_order_id, v_order.customer_id, v_order.subtotal, v_order.discount_total,
    v_order.tax_total, v_order.shipping_total, v_order.grand_total, v_amount_paid, v_balance_due,
    v_status, now(), now() + interval '30 days', v_paid_at
  )
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_invoice(uuid) TO authenticated, service_role;
