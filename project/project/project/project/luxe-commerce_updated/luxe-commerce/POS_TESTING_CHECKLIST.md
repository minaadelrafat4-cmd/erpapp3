# POS Checkout Repair — Manual Testing Checklist

## What changed
- **New migration `0020_pos_checkout_repair.sql`** fixes two RPC functions from
  migration `0016` (`lookup_product_by_code`, `process_pos_checkout`) that
  referenced columns which never existed in the schema — meaning barcode/QR
  lookups and POS checkout have never worked until now. No table, RLS
  policy, or existing function signature was changed; only the two
  function bodies were repaired.
- **`AdminOrders.tsx`** now has a working "New Sale (POS)" panel — cart,
  live barcode/QR scanning, manual code entry, branch/customer selection,
  discount/tax/payment fields, and an offline-queue sync indicator. This
  UI didn't exist before; the checkout/scanner logic was defined in code
  but never wired to anything.

## 0. Setup (one-time, before testing)
- [ ] Apply migration `0020_pos_checkout_repair.sql` (run all pending
      migrations in order — it depends on `0016` and `0018` already being applied).
- [ ] Confirm the admin user you'll test with has a **linked, active
      employee record** (Admin → Employees → the employee's `user_id`
      must match your logged-in `auth.users.id`, `status = 'active'`).
      This is required — `process_pos_checkout` now rejects sales from
      any authenticated user who isn't linked to an active employee, by
      design (this is what links a sale to the employee who rang it up).
      Use the `admin-create-employee` edge function / Admin → Employees
      page to create this link if needed.
- [ ] Confirm at least one branch exists with `inventory` rows
      (`quantity_on_hand > 0`) for the product(s) you'll test with.
- [ ] Confirm your admin login has the `orders.manage` permission (needed
      to reach `/admin/orders` at all).

## 1. Barcode / QR lookup (`lookup_product_by_code`)
- [ ] Open `/admin/orders`, click **New Sale (POS)**.
- [ ] With a physical USB/Bluetooth barcode scanner connected: scan a
      product's barcode (find it under Admin → Products → a product's
      barcode/QR display). Confirm it's added to the cart automatically
      with the correct name and price.
- [ ] Scan a product's **QR code** the same way — confirm it resolves via
      the same path (no separate QR scanner needed; the scanner hardware
      emits the same rapid-keystroke pattern for either symbology, and the
      lookup matches barcode, SKU, or QR value).
- [ ] Without a scanner: type a product's barcode value into the manual
      "Type a barcode, SKU, or QR code…" field and click **Add** (or press
      Enter). Confirm it adds to the cart.
- [ ] Try a SKU value in the manual field — confirm it also resolves.
- [ ] Try an invalid/unknown code — confirm you get a "No product found"
      toast and nothing is added.
- [ ] Scan/enter a product that has variants — confirm the variant name is
      shown distinctly and the variant's own price is used (not the
      parent product's).

## 2. Cart behavior
- [ ] Scan/add the same product twice — confirm quantity increments on the
      existing line rather than creating a duplicate row.
- [ ] Use the +/- buttons to adjust quantity; confirm the line total and
      cart subtotal update live.
- [ ] Reduce a line to 0 via "-" — confirm it's removed from the cart.
- [ ] Remove a line via the trash icon.
- [ ] Enter a Discount and Tax amount — confirm the grand total at the
      bottom recalculates correctly: `max(0, subtotal - discount) + tax`.

## 3. Stock validation (must reject, not silently oversell)
- [ ] Pick a product with **low stock at the selected branch** (check
      Admin → Inventory for the branch's `quantity_on_hand`).
- [ ] Add more units to the cart than are available at that branch.
- [ ] Click **Complete Sale** — confirm you get a clear "Insufficient
      branch stock" error and **no order is created** (check Admin →
      Orders — nothing new appears; check Inventory — stock unchanged).
- [ ] Repeat with a quantity that exceeds the product's *global* `stock`
      value (Admin → Products) even if branch stock looks sufficient —
      confirm this is also rejected ("Insufficient stock for...").
- [ ] Reduce quantity to something in stock and confirm the sale now
      completes successfully.

## 4. Successful checkout — inventory deduction
- [ ] Note a product's branch `quantity_on_hand` and global `stock` before
      the sale.
- [ ] Complete a sale for a known quantity (e.g. 2 units).
- [ ] Confirm both the branch inventory (Admin → Inventory) **and** the
      product's global stock (Admin → Products) dropped by exactly that
      quantity.
- [ ] Confirm a new row appears in inventory transactions/history for that
      product with transaction type `sale` and the correct negative
      quantity.

## 5. Employee linkage
- [ ] After a successful sale, open the order in Admin → Orders and
      confirm the order detail shows source **"Branch"** (POS) and the
      correct branch.
- [ ] Confirm (via DB or an Employees/Orders report if available) that
      `orders.pos_operator_id` on the new order matches the employee
      record linked to the account that was logged in when the sale was
      made — not `NULL`, and not the raw auth user ID.
- [ ] Log in as a user who has **no** linked employee record (or a staff
      account whose employee row is `status = 'inactive'`) and attempt a
      POS sale — confirm it's rejected with a clear error rather than
      creating an order with a missing/incorrect operator link.

## 6. Customer linking (optional field)
- [ ] Leave the customer email blank and complete a sale — confirm it's
      recorded as a walk-in (`customer_id` is null on the order).
- [ ] Enter a known customer's email and tab/click away — confirm a
      "Customer found and linked" toast appears, then complete the sale
      and confirm that order's `customer_id` matches that customer.
- [ ] Enter an email with no matching account — confirm a "No customer
      found" warning appears and the sale still proceeds as a walk-in.

## 7. Offline queueing
- [ ] Open dev tools → Network → set to Offline (or disconnect Wi-Fi).
- [ ] Confirm the header shows an "Offline" badge.
- [ ] Complete a sale while offline — confirm it's queued locally
      ("Offline mode active…" toast) rather than erroring, and the
      "Sync N pending" button appears in the header.
- [ ] Go back online — confirm the sale auto-syncs (or click "Sync N
      pending" manually) and the order then appears in Admin → Orders
      with correct inventory deduction.

## 8. Regression — existing order management untouched
- [ ] Confirm the Orders table, filters, and search still work as before.
- [ ] Open an existing order's detail view — confirm items, timeline, and
      refund history still display correctly.
- [ ] Change an order's status via the dropdown — confirm it still works.
- [ ] Issue a refund on an existing order — confirm it still works.
- [ ] Cancel an order — confirm stock is still restored as before.
- [ ] Update shipment/tracking info on an order — confirm it still saves.
- [ ] Confirm non-staff / customer accounts still cannot reach `/admin/orders`
      or call `process_pos_checkout` directly (should be rejected by the
      new staff check even if they bypass the UI).

## 9. RBAC / RLS sanity
- [ ] Log in as a staff role that does **not** have `orders.manage` —
      confirm `/admin/orders` (and therefore POS) is inaccessible per the
      existing `PermissionRoute` guard (unchanged by this work).
- [ ] Confirm other admin pages (Products, Inventory, Customers, etc.)
      behave exactly as before — this repair touched only two SQL
      functions and one page component.
