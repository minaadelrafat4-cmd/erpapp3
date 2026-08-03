/*
# Fix: Allow staff to manage customer records

The customers table had owner-only RLS policies. Admin/staff users need to
view and update customer records from the admin dashboard.

## Changes
- SELECT: staff can read all customers; customers can read their own
- UPDATE: staff can update any customer; customers can update their own
- INSERT: staff can insert; customers can insert their own (preserved)
- DELETE: staff can delete any customer
*/

-- SELECT: staff read all, customer reads own
DROP POLICY IF EXISTS "select_own_customer" ON customers;
CREATE POLICY "select_own_customer" ON customers FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_staff());

-- UPDATE: staff update any, customer updates own
DROP POLICY IF EXISTS "update_own_customer" ON customers;
CREATE POLICY "update_own_customer" ON customers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_staff()) WITH CHECK (auth.uid() = user_id OR is_staff());

-- DELETE: staff only
DROP POLICY IF EXISTS "delete_own_customer" ON customers;
CREATE POLICY "delete_own_customer" ON customers FOR DELETE TO authenticated
  USING (is_staff());

-- Also fix addresses: staff need read access for order management
DROP POLICY IF EXISTS "select_own_addresses" ON addresses;
CREATE POLICY "select_own_addresses" ON addresses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM customers c WHERE c.id = addresses.customer_id AND c.user_id = auth.uid()) OR is_staff());

DROP POLICY IF EXISTS "update_own_addresses" ON addresses;
CREATE POLICY "update_own_addresses" ON addresses FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM customers c WHERE c.id = addresses.customer_id AND c.user_id = auth.uid()) OR is_staff())
  WITH CHECK (EXISTS (SELECT 1 FROM customers c WHERE c.id = addresses.customer_id AND c.user_id = auth.uid()) OR is_staff());

-- Also fix orders: staff need to update order status
DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_staff());

DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_staff()) WITH CHECK (auth.uid() = user_id OR is_staff());

-- Also fix order_items: staff need read access
DROP POLICY IF EXISTS "select_own_order_items" ON order_items;
CREATE POLICY "select_own_order_items" ON order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()) OR is_staff());

DROP POLICY IF EXISTS "update_own_order_items" ON order_items;
CREATE POLICY "update_own_order_items" ON order_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()) OR is_staff())
  WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()) OR is_staff());
