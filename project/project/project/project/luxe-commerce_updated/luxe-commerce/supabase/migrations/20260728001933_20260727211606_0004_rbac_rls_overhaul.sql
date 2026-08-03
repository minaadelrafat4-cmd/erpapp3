/*
# RBAC Row Level Security overhaul

Tightens RLS from "any authenticated user can write" to proper role-based access control.
Storefront public-read policies preserved. Admin/ERP write policies now require is_staff().
profiles allows self read + staff read-all.

## Security model
- PUBLIC READ: products, categories, brands, product_variants, product_images, blog_posts, etc.
- OWNER-SCOPED: customers, addresses, orders, order_items, wishlist_items, cart_items, etc.
- STAFF-ONLY (is_staff()): branches, employees, suppliers, inventory, roles, permissions, etc.
- profiles: self read/update; staff read all.
*/

-- PROFILES — self read/update, staff read all
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id OR is_staff());
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "staff_update_profile" ON profiles;
CREATE POLICY "staff_update_profile" ON profiles FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_delete_profile" ON profiles;
CREATE POLICY "staff_delete_profile" ON profiles FOR DELETE TO authenticated USING (is_staff());

-- WAREHOUSES — staff only
DROP POLICY IF EXISTS "staff_select_warehouses" ON warehouses;
CREATE POLICY "staff_select_warehouses" ON warehouses FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "staff_insert_warehouses" ON warehouses;
CREATE POLICY "staff_insert_warehouses" ON warehouses FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_warehouses" ON warehouses;
CREATE POLICY "staff_update_warehouses" ON warehouses FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_delete_warehouses" ON warehouses;
CREATE POLICY "staff_delete_warehouses" ON warehouses FOR DELETE TO authenticated USING (is_staff());

-- INVENTORY TRANSACTIONS — staff only
DROP POLICY IF EXISTS "staff_select_inv_tx" ON inventory_transactions;
CREATE POLICY "staff_select_inv_tx" ON inventory_transactions FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "staff_insert_inv_tx" ON inventory_transactions;
CREATE POLICY "staff_insert_inv_tx" ON inventory_transactions FOR INSERT TO authenticated WITH CHECK (is_staff());

-- STOCK ADJUSTMENTS — staff only
DROP POLICY IF EXISTS "staff_select_stock_adj" ON stock_adjustments;
CREATE POLICY "staff_select_stock_adj" ON stock_adjustments FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "staff_insert_stock_adj" ON stock_adjustments;
CREATE POLICY "staff_insert_stock_adj" ON stock_adjustments FOR INSERT TO authenticated WITH CHECK (is_staff());

-- STOCK TRANSFERS — staff only
DROP POLICY IF EXISTS "staff_select_stock_transfers" ON stock_transfers;
CREATE POLICY "staff_select_stock_transfers" ON stock_transfers FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "staff_insert_stock_transfers" ON stock_transfers;
CREATE POLICY "staff_insert_stock_transfers" ON stock_transfers FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_stock_transfers" ON stock_transfers;
CREATE POLICY "staff_update_stock_transfers" ON stock_transfers FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- PAYMENTS — owner (via order) read, staff full
DROP POLICY IF EXISTS "select_own_payments" ON payments;
CREATE POLICY "select_own_payments" ON payments FOR SELECT TO authenticated USING (is_staff() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = payments.order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "staff_insert_payments" ON payments;
CREATE POLICY "staff_insert_payments" ON payments FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_payments" ON payments;
CREATE POLICY "staff_update_payments" ON payments FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- INVOICES — owner (via order) read, staff full
DROP POLICY IF EXISTS "select_own_invoices" ON invoices;
CREATE POLICY "select_own_invoices" ON invoices FOR SELECT TO authenticated USING (is_staff() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = invoices.order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "staff_insert_invoices" ON invoices;
CREATE POLICY "staff_insert_invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_invoices" ON invoices;
CREATE POLICY "staff_update_invoices" ON invoices FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- PURCHASE ORDERS — staff only
DROP POLICY IF EXISTS "staff_select_po" ON purchase_orders;
CREATE POLICY "staff_select_po" ON purchase_orders FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "staff_insert_po" ON purchase_orders;
CREATE POLICY "staff_insert_po" ON purchase_orders FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_po" ON purchase_orders;
CREATE POLICY "staff_update_po" ON purchase_orders FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_delete_po" ON purchase_orders;
CREATE POLICY "staff_delete_po" ON purchase_orders FOR DELETE TO authenticated USING (is_staff());

-- PURCHASE ORDER ITEMS — staff only
DROP POLICY IF EXISTS "staff_select_po_items" ON purchase_order_items;
CREATE POLICY "staff_select_po_items" ON purchase_order_items FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "staff_insert_po_items" ON purchase_order_items;
CREATE POLICY "staff_insert_po_items" ON purchase_order_items FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_po_items" ON purchase_order_items;
CREATE POLICY "staff_update_po_items" ON purchase_order_items FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_delete_po_items" ON purchase_order_items;
CREATE POLICY "staff_delete_po_items" ON purchase_order_items FOR DELETE TO authenticated USING (is_staff());

-- EXPENSES — staff only
DROP POLICY IF EXISTS "staff_select_expenses" ON expenses;
CREATE POLICY "staff_select_expenses" ON expenses FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "staff_insert_expenses" ON expenses;
CREATE POLICY "staff_insert_expenses" ON expenses FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_expenses" ON expenses;
CREATE POLICY "staff_update_expenses" ON expenses FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_delete_expenses" ON expenses;
CREATE POLICY "staff_delete_expenses" ON expenses FOR DELETE TO authenticated USING (is_staff());

-- REPORTS — staff only
DROP POLICY IF EXISTS "staff_select_reports" ON reports;
CREATE POLICY "staff_select_reports" ON reports FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "staff_insert_reports" ON reports;
CREATE POLICY "staff_insert_reports" ON reports FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_update_reports" ON reports;
CREATE POLICY "staff_update_reports" ON reports FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_delete_reports" ON reports;
CREATE POLICY "staff_delete_reports" ON reports FOR DELETE TO authenticated USING (is_staff());

-- ACTIVITY LOGS — staff read, self insert
DROP POLICY IF EXISTS "staff_select_activity" ON activity_logs;
CREATE POLICY "staff_select_activity" ON activity_logs FOR SELECT TO authenticated USING (is_staff() OR auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_activity" ON activity_logs;
CREATE POLICY "insert_own_activity" ON activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- TIGHTEN EXISTING ADMIN TABLES (replace broad authenticated with is_staff)
DROP POLICY IF EXISTS "auth_select_branches" ON branches;
CREATE POLICY "staff_select_branches" ON branches FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "auth_insert_branches" ON branches;
CREATE POLICY "staff_insert_branches" ON branches FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_branches" ON branches;
CREATE POLICY "staff_update_branches" ON branches FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_branches" ON branches;
CREATE POLICY "staff_delete_branches" ON branches FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_select_employees" ON employees;
CREATE POLICY "staff_select_employees" ON employees FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "auth_insert_employees" ON employees;
CREATE POLICY "staff_insert_employees" ON employees FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_employees" ON employees;
CREATE POLICY "staff_update_employees" ON employees FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_employees" ON employees;
CREATE POLICY "staff_delete_employees" ON employees FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_select_suppliers" ON suppliers;
CREATE POLICY "staff_select_suppliers" ON suppliers FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "auth_insert_suppliers" ON suppliers;
CREATE POLICY "staff_insert_suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_suppliers" ON suppliers;
CREATE POLICY "staff_update_suppliers" ON suppliers FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_suppliers" ON suppliers;
CREATE POLICY "staff_delete_suppliers" ON suppliers FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_select_inventory" ON inventory;
CREATE POLICY "staff_select_inventory" ON inventory FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "auth_insert_inventory" ON inventory;
CREATE POLICY "staff_insert_inventory" ON inventory FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_inventory" ON inventory;
CREATE POLICY "staff_update_inventory" ON inventory FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_inventory" ON inventory;
CREATE POLICY "staff_delete_inventory" ON inventory FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_select_roles" ON roles;
CREATE POLICY "staff_select_roles" ON roles FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "auth_insert_roles" ON roles;
CREATE POLICY "staff_insert_roles" ON roles FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_roles" ON roles;
CREATE POLICY "staff_update_roles" ON roles FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_roles" ON roles;
CREATE POLICY "staff_delete_roles" ON roles FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_select_permissions" ON permissions;
CREATE POLICY "staff_select_permissions" ON permissions FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "auth_insert_permissions" ON permissions;
CREATE POLICY "staff_insert_permissions" ON permissions FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_permissions" ON permissions;
CREATE POLICY "staff_update_permissions" ON permissions FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_permissions" ON permissions;
CREATE POLICY "staff_delete_permissions" ON permissions FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_select_role_permissions" ON role_permissions;
CREATE POLICY "staff_select_role_permissions" ON role_permissions FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "auth_insert_role_permissions" ON role_permissions;
CREATE POLICY "staff_insert_role_permissions" ON role_permissions FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_role_permissions" ON role_permissions;
CREATE POLICY "staff_delete_role_permissions" ON role_permissions FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_select_employee_roles" ON employee_roles;
CREATE POLICY "staff_select_employee_roles" ON employee_roles FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "auth_insert_employee_roles" ON employee_roles;
CREATE POLICY "staff_insert_employee_roles" ON employee_roles FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_employee_roles" ON employee_roles;
CREATE POLICY "staff_delete_employee_roles" ON employee_roles FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_select_audit_logs" ON audit_logs;
CREATE POLICY "staff_select_audit_logs" ON audit_logs FOR SELECT TO authenticated USING (is_staff());
DROP POLICY IF EXISTS "auth_insert_audit_logs" ON audit_logs;
CREATE POLICY "staff_insert_audit_logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (is_staff());

-- TIGHTEN CONTENT WRITE POLICIES to staff only (public read stays)
DROP POLICY IF EXISTS "auth_insert_categories" ON categories;
CREATE POLICY "staff_insert_categories" ON categories FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_categories" ON categories;
CREATE POLICY "staff_update_categories" ON categories FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_categories" ON categories;
CREATE POLICY "staff_delete_categories" ON categories FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_brands" ON brands;
CREATE POLICY "staff_insert_brands" ON brands FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_brands" ON brands;
CREATE POLICY "staff_update_brands" ON brands FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_brands" ON brands;
CREATE POLICY "staff_delete_brands" ON brands FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_products" ON products;
CREATE POLICY "staff_insert_products" ON products FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_products" ON products;
CREATE POLICY "staff_update_products" ON products FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_products" ON products;
CREATE POLICY "staff_delete_products" ON products FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_product_variants" ON product_variants;
CREATE POLICY "staff_insert_product_variants" ON product_variants FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_product_variants" ON product_variants;
CREATE POLICY "staff_update_product_variants" ON product_variants FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_product_variants" ON product_variants;
CREATE POLICY "staff_delete_product_variants" ON product_variants FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_product_images" ON product_images;
CREATE POLICY "staff_insert_product_images" ON product_images FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_product_images" ON product_images;
CREATE POLICY "staff_update_product_images" ON product_images FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_product_images" ON product_images;
CREATE POLICY "staff_delete_product_images" ON product_images FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_coupons" ON coupons;
CREATE POLICY "staff_insert_coupons" ON coupons FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_coupons" ON coupons;
CREATE POLICY "staff_update_coupons" ON coupons FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_coupons" ON coupons;
CREATE POLICY "staff_delete_coupons" ON coupons FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_blog_categories" ON blog_categories;
CREATE POLICY "staff_insert_blog_categories" ON blog_categories FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_blog_categories" ON blog_categories;
CREATE POLICY "staff_update_blog_categories" ON blog_categories FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_blog_categories" ON blog_categories;
CREATE POLICY "staff_delete_blog_categories" ON blog_categories FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_blog_posts" ON blog_posts;
CREATE POLICY "staff_insert_blog_posts" ON blog_posts FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_blog_posts" ON blog_posts;
CREATE POLICY "staff_update_blog_posts" ON blog_posts FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_blog_posts" ON blog_posts;
CREATE POLICY "staff_delete_blog_posts" ON blog_posts FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_store_locations" ON store_locations;
CREATE POLICY "staff_insert_store_locations" ON store_locations FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_store_locations" ON store_locations;
CREATE POLICY "staff_update_store_locations" ON store_locations FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_store_locations" ON store_locations;
CREATE POLICY "staff_delete_store_locations" ON store_locations FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_careers" ON careers;
CREATE POLICY "staff_insert_careers" ON careers FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_careers" ON careers;
CREATE POLICY "staff_update_careers" ON careers FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_careers" ON careers;
CREATE POLICY "staff_delete_careers" ON careers FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_faq_entries" ON faq_entries;
CREATE POLICY "staff_insert_faq_entries" ON faq_entries FOR INSERT TO authenticated WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_update_faq_entries" ON faq_entries;
CREATE POLICY "staff_update_faq_entries" ON faq_entries FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_faq_entries" ON faq_entries;
CREATE POLICY "staff_delete_faq_entries" ON faq_entries FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_update_newsletter" ON newsletter_subscribers;
CREATE POLICY "staff_update_newsletter" ON newsletter_subscribers FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
DROP POLICY IF EXISTS "auth_delete_newsletter" ON newsletter_subscribers;
CREATE POLICY "staff_delete_newsletter" ON newsletter_subscribers FOR DELETE TO authenticated USING (is_staff());
