CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CATALOG
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text NOT NULL UNIQUE, description text,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  image_url text, is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text NOT NULL UNIQUE, description text,
  logo_url text, country text, is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text NOT NULL UNIQUE, description text, short_description text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  price numeric(12,2) NOT NULL DEFAULT 0, compare_at_price numeric(12,2), cost numeric(12,2),
  sku text UNIQUE, barcode text, stock integer NOT NULL DEFAULT 0, low_stock_threshold integer NOT NULL DEFAULT 5,
  weight numeric(8,2), is_featured boolean NOT NULL DEFAULT false, is_best_seller boolean NOT NULL DEFAULT false,
  is_new_arrival boolean NOT NULL DEFAULT false, is_flash_sale boolean NOT NULL DEFAULT false,
  flash_sale_ends_at timestamptz, rating numeric(3,2) NOT NULL DEFAULT 0, review_count integer NOT NULL DEFAULT 0,
  nicotine_strength text, is_active boolean NOT NULL DEFAULT true, tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL, value text NOT NULL, price numeric(12,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0, sku text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL, alt text, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5), title text, body text,
  is_approved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS recently_viewed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;

-- COMMERCE
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text, last_name text, phone text, date_of_birth date,
  marketing_opt_in boolean NOT NULL DEFAULT false, loyalty_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label text, line1 text NOT NULL, line2 text, city text NOT NULL, state text,
  postal_code text, country text NOT NULL DEFAULT 'United States', phone text,
  is_default boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE, customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending', payment_status text NOT NULL DEFAULT 'unpaid',
  fulfillment_status text NOT NULL DEFAULT 'unfulfilled',
  subtotal numeric(12,2) NOT NULL DEFAULT 0, discount_total numeric(12,2) NOT NULL DEFAULT 0,
  shipping_total numeric(12,2) NOT NULL DEFAULT 0, tax_total numeric(12,2) NOT NULL DEFAULT 0,
  grand_total numeric(12,2) NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'USD',
  shipping_address jsonb, billing_address jsonb, tracking_number text, carrier text, notes text,
  placed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL, variant_name text, sku text,
  price numeric(12,2) NOT NULL DEFAULT 0, quantity integer NOT NULL DEFAULT 1,
  line_total numeric(12,2) NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, description text,
  discount_type text NOT NULL DEFAULT 'percentage', discount_value numeric(12,2) NOT NULL DEFAULT 0,
  min_subtotal numeric(12,2) NOT NULL DEFAULT 0, max_uses integer, used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz, ends_at timestamptz, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, session_id text,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- CONTENT
CREATE TABLE IF NOT EXISTS blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE,
  description text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, slug text NOT NULL UNIQUE,
  excerpt text, body text NOT NULL, category_id uuid REFERENCES blog_categories(id) ON DELETE SET NULL,
  author text, cover_image_url text, tags text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false, published_at timestamptz,
  reading_minutes integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS store_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, address text NOT NULL,
  city text NOT NULL, state text, postal_code text, country text NOT NULL DEFAULT 'United States',
  phone text, email text, hours text, latitude numeric(9,6), longitude numeric(9,6),
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE store_locations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS careers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, slug text NOT NULL UNIQUE,
  department text, location text, type text, description text NOT NULL, requirements text,
  salary_range text, is_open boolean NOT NULL DEFAULT true, posted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE careers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS faq_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), question text NOT NULL, answer text NOT NULL,
  category text, sort_order integer NOT NULL DEFAULT 0, is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE faq_entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, name text,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- ADMIN / ERP FOUNDATION
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, code text NOT NULL UNIQUE,
  address text NOT NULL, city text NOT NULL, phone text, email text, manager text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL UNIQUE,
  phone text, position text, branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  hire_date date, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, contact_name text,
  email text, phone text, address text, city text, country text, payment_terms text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  quantity_on_hand integer NOT NULL DEFAULT 0, quantity_reserved integer NOT NULL DEFAULT 0,
  reorder_point integer NOT NULL DEFAULT 10, last_stocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, branch_id)
);
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, description text,
  is_system boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, description text,
  module text NOT NULL DEFAULT 'general', created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS employee_roles (
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (employee_id, role_id)
);
ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, entity_type text, entity_id uuid, details jsonb, ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL, message text NOT NULL, type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false, link text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user ON recently_viewed(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_session ON cart_items(session_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(is_published);
CREATE INDEX IF NOT EXISTS idx_store_locations_active ON store_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_careers_open ON careers(is_open);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- POLICIES — CATALOG (public read, authenticated owner write)
DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_categories" ON categories;
CREATE POLICY "auth_insert_categories" ON categories FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_categories" ON categories;
CREATE POLICY "auth_update_categories" ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_categories" ON categories;
CREATE POLICY "auth_delete_categories" ON categories FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_brands" ON brands;
CREATE POLICY "anon_select_brands" ON brands FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_brands" ON brands;
CREATE POLICY "auth_insert_brands" ON brands FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_brands" ON brands;
CREATE POLICY "auth_update_brands" ON brands FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_brands" ON brands;
CREATE POLICY "auth_delete_brands" ON brands FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT TO anon, authenticated USING (is_active = true OR auth.role() = 'authenticated');
DROP POLICY IF EXISTS "auth_insert_products" ON products;
CREATE POLICY "auth_insert_products" ON products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_products" ON products;
CREATE POLICY "auth_update_products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_products" ON products;
CREATE POLICY "auth_delete_products" ON products FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_product_variants" ON product_variants;
CREATE POLICY "anon_select_product_variants" ON product_variants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_product_variants" ON product_variants;
CREATE POLICY "auth_insert_product_variants" ON product_variants FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_product_variants" ON product_variants;
CREATE POLICY "auth_update_product_variants" ON product_variants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_product_variants" ON product_variants;
CREATE POLICY "auth_delete_product_variants" ON product_variants FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_product_images" ON product_images;
CREATE POLICY "anon_select_product_images" ON product_images FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_product_images" ON product_images;
CREATE POLICY "auth_insert_product_images" ON product_images FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_product_images" ON product_images;
CREATE POLICY "auth_update_product_images" ON product_images FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_product_images" ON product_images;
CREATE POLICY "auth_delete_product_images" ON product_images FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_product_reviews" ON product_reviews;
CREATE POLICY "anon_select_product_reviews" ON product_reviews FOR SELECT TO anon, authenticated USING (is_approved = true OR auth.uid() = user_id);
DROP POLICY IF EXISTS "auth_insert_product_reviews" ON product_reviews;
CREATE POLICY "auth_insert_product_reviews" ON product_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "auth_update_product_reviews" ON product_reviews;
CREATE POLICY "auth_update_product_reviews" ON product_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "auth_delete_product_reviews" ON product_reviews;
CREATE POLICY "auth_delete_product_reviews" ON product_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_recently_viewed" ON recently_viewed;
CREATE POLICY "select_own_recently_viewed" ON recently_viewed FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_recently_viewed" ON recently_viewed;
CREATE POLICY "insert_own_recently_viewed" ON recently_viewed FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_recently_viewed" ON recently_viewed;
CREATE POLICY "delete_own_recently_viewed" ON recently_viewed FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- POLICIES — COMMERCE (owner-scoped)
DROP POLICY IF EXISTS "select_own_customer" ON customers;
CREATE POLICY "select_own_customer" ON customers FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_customer" ON customers;
CREATE POLICY "insert_own_customer" ON customers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_customer" ON customers;
CREATE POLICY "update_own_customer" ON customers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_customer" ON customers;
CREATE POLICY "delete_own_customer" ON customers FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_addresses" ON addresses;
CREATE POLICY "select_own_addresses" ON addresses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM customers c WHERE c.id = addresses.customer_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_addresses" ON addresses;
CREATE POLICY "insert_own_addresses" ON addresses FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM customers c WHERE c.id = addresses.customer_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_addresses" ON addresses;
CREATE POLICY "update_own_addresses" ON addresses FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM customers c WHERE c.id = addresses.customer_id AND c.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM customers c WHERE c.id = addresses.customer_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_addresses" ON addresses;
CREATE POLICY "delete_own_addresses" ON addresses FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM customers c WHERE c.id = addresses.customer_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_orders" ON orders;
CREATE POLICY "delete_own_orders" ON orders FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_order_items" ON order_items;
CREATE POLICY "select_own_order_items" ON order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_order_items" ON order_items;
CREATE POLICY "insert_own_order_items" ON order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_order_items" ON order_items;
CREATE POLICY "update_own_order_items" ON order_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_order_items" ON order_items;
CREATE POLICY "delete_own_order_items" ON order_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_select_coupons" ON coupons;
CREATE POLICY "anon_select_coupons" ON coupons FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "auth_insert_coupons" ON coupons;
CREATE POLICY "auth_insert_coupons" ON coupons FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_coupons" ON coupons;
CREATE POLICY "auth_update_coupons" ON coupons FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_coupons" ON coupons;
CREATE POLICY "auth_delete_coupons" ON coupons FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "select_own_wishlist" ON wishlist_items;
CREATE POLICY "select_own_wishlist" ON wishlist_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_wishlist" ON wishlist_items;
CREATE POLICY "insert_own_wishlist" ON wishlist_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_wishlist" ON wishlist_items;
CREATE POLICY "delete_own_wishlist" ON wishlist_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_cart" ON cart_items;
CREATE POLICY "select_own_cart" ON cart_items FOR SELECT TO anon, authenticated USING (auth.uid() = user_id OR (user_id IS NULL AND session_id IS NOT NULL));
DROP POLICY IF EXISTS "insert_own_cart" ON cart_items;
CREATE POLICY "insert_own_cart" ON cart_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_own_cart" ON cart_items;
CREATE POLICY "update_own_cart" ON cart_items FOR UPDATE TO anon, authenticated USING (auth.uid() = user_id OR (user_id IS NULL AND session_id IS NOT NULL)) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_own_cart" ON cart_items;
CREATE POLICY "delete_own_cart" ON cart_items FOR DELETE TO anon, authenticated USING (auth.uid() = user_id OR (user_id IS NULL AND session_id IS NOT NULL));

-- POLICIES — CONTENT (public read, authenticated write)
DROP POLICY IF EXISTS "anon_select_blog_categories" ON blog_categories;
CREATE POLICY "anon_select_blog_categories" ON blog_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_blog_categories" ON blog_categories;
CREATE POLICY "auth_insert_blog_categories" ON blog_categories FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_blog_categories" ON blog_categories;
CREATE POLICY "auth_update_blog_categories" ON blog_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_blog_categories" ON blog_categories;
CREATE POLICY "auth_delete_blog_categories" ON blog_categories FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_blog_posts" ON blog_posts;
CREATE POLICY "anon_select_blog_posts" ON blog_posts FOR SELECT TO anon, authenticated USING (is_published = true OR auth.role() = 'authenticated');
DROP POLICY IF EXISTS "auth_insert_blog_posts" ON blog_posts;
CREATE POLICY "auth_insert_blog_posts" ON blog_posts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_blog_posts" ON blog_posts;
CREATE POLICY "auth_update_blog_posts" ON blog_posts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_blog_posts" ON blog_posts;
CREATE POLICY "auth_delete_blog_posts" ON blog_posts FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_store_locations" ON store_locations;
CREATE POLICY "anon_select_store_locations" ON store_locations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_store_locations" ON store_locations;
CREATE POLICY "auth_insert_store_locations" ON store_locations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_store_locations" ON store_locations;
CREATE POLICY "auth_update_store_locations" ON store_locations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_store_locations" ON store_locations;
CREATE POLICY "auth_delete_store_locations" ON store_locations FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_careers" ON careers;
CREATE POLICY "anon_select_careers" ON careers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_careers" ON careers;
CREATE POLICY "auth_insert_careers" ON careers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_careers" ON careers;
CREATE POLICY "auth_update_careers" ON careers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_careers" ON careers;
CREATE POLICY "auth_delete_careers" ON careers FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_faq_entries" ON faq_entries;
CREATE POLICY "anon_select_faq_entries" ON faq_entries FOR SELECT TO anon, authenticated USING (is_published = true);
DROP POLICY IF EXISTS "auth_insert_faq_entries" ON faq_entries;
CREATE POLICY "auth_insert_faq_entries" ON faq_entries FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_faq_entries" ON faq_entries;
CREATE POLICY "auth_update_faq_entries" ON faq_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_faq_entries" ON faq_entries;
CREATE POLICY "auth_delete_faq_entries" ON faq_entries FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_newsletter" ON newsletter_subscribers;
CREATE POLICY "anon_insert_newsletter" ON newsletter_subscribers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_select_newsletter" ON newsletter_subscribers;
CREATE POLICY "auth_select_newsletter" ON newsletter_subscribers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_update_newsletter" ON newsletter_subscribers;
CREATE POLICY "auth_update_newsletter" ON newsletter_subscribers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_newsletter" ON newsletter_subscribers;
CREATE POLICY "auth_delete_newsletter" ON newsletter_subscribers FOR DELETE TO authenticated USING (true);

-- POLICIES — ADMIN / ERP (authenticated only)
DROP POLICY IF EXISTS "auth_select_branches" ON branches;
CREATE POLICY "auth_select_branches" ON branches FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_branches" ON branches;
CREATE POLICY "auth_insert_branches" ON branches FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_branches" ON branches;
CREATE POLICY "auth_update_branches" ON branches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_branches" ON branches;
CREATE POLICY "auth_delete_branches" ON branches FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_select_employees" ON employees;
CREATE POLICY "auth_select_employees" ON employees FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_employees" ON employees;
CREATE POLICY "auth_insert_employees" ON employees FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_employees" ON employees;
CREATE POLICY "auth_update_employees" ON employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_employees" ON employees;
CREATE POLICY "auth_delete_employees" ON employees FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_select_suppliers" ON suppliers;
CREATE POLICY "auth_select_suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_suppliers" ON suppliers;
CREATE POLICY "auth_insert_suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_suppliers" ON suppliers;
CREATE POLICY "auth_update_suppliers" ON suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_suppliers" ON suppliers;
CREATE POLICY "auth_delete_suppliers" ON suppliers FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_select_inventory" ON inventory;
CREATE POLICY "auth_select_inventory" ON inventory FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_inventory" ON inventory;
CREATE POLICY "auth_insert_inventory" ON inventory FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_inventory" ON inventory;
CREATE POLICY "auth_update_inventory" ON inventory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_inventory" ON inventory;
CREATE POLICY "auth_delete_inventory" ON inventory FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_select_roles" ON roles;
CREATE POLICY "auth_select_roles" ON roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_roles" ON roles;
CREATE POLICY "auth_insert_roles" ON roles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_roles" ON roles;
CREATE POLICY "auth_update_roles" ON roles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_roles" ON roles;
CREATE POLICY "auth_delete_roles" ON roles FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_select_permissions" ON permissions;
CREATE POLICY "auth_select_permissions" ON permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_permissions" ON permissions;
CREATE POLICY "auth_insert_permissions" ON permissions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_permissions" ON permissions;
CREATE POLICY "auth_update_permissions" ON permissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_permissions" ON permissions;
CREATE POLICY "auth_delete_permissions" ON permissions FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_select_role_permissions" ON role_permissions;
CREATE POLICY "auth_select_role_permissions" ON role_permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_role_permissions" ON role_permissions;
CREATE POLICY "auth_insert_role_permissions" ON role_permissions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_role_permissions" ON role_permissions;
CREATE POLICY "auth_delete_role_permissions" ON role_permissions FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_select_employee_roles" ON employee_roles;
CREATE POLICY "auth_select_employee_roles" ON employee_roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_employee_roles" ON employee_roles;
CREATE POLICY "auth_insert_employee_roles" ON employee_roles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_employee_roles" ON employee_roles;
CREATE POLICY "auth_delete_employee_roles" ON employee_roles FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_select_audit_logs" ON audit_logs;
CREATE POLICY "auth_select_audit_logs" ON audit_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_audit_logs" ON audit_logs;
CREATE POLICY "auth_insert_audit_logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'categories','brands','products','customers','orders','coupons','cart_items',
    'blog_posts','branches','employees','suppliers','inventory'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I; '
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t
    );
  END LOOP;
END $$;