/*
# Seed demo data — catalog, content, ERP
Idempotent: uses ON CONFLICT DO NOTHING for unique-constrained columns, NOT EXISTS guards otherwise.
*/
-- CATEGORIES
INSERT INTO categories (name, slug, description, is_featured, sort_order) VALUES
  ('Vape Devices', 'vape-devices', 'Premium vape mods, pod systems, and devices', true, 1),
  ('E-Liquids', 'e-liquids', 'Artisan e-liquids and refills', true, 2),
  ('Disposables', 'disposables', 'Single-use disposable vapes', true, 3),
  ('Accessories', 'accessories', 'Batteries, chargers, cases, and more', false, 4),
  ('Smoking', 'smoking', 'Premium smoking accessories', true, 5),
  ('CBD', 'cbd', 'CBD products and wellness', false, 6)
ON CONFLICT (slug) DO NOTHING;

-- BRANDS
INSERT INTO brands (name, slug, description, country, is_featured) VALUES
  ('Vaporesso', 'vaporesso', 'Innovative vaping technology from Switzerland', 'Switzerland', true),
  ('SMOK', 'smok', 'Industry-leading vape hardware manufacturer', 'China', true),
  ('JUUL', 'juul', 'Premium pod system pioneer', 'United States', true),
  ('PAX', 'pax', 'Luxury dry herb vaporizers', 'United States', true),
  ('Storz & Bickel', 'storz-bickel', 'German-engineered desktop vaporizers', 'Germany', true),
  ('RAW', 'raw', 'Natural rolling papers and accessories', 'Spain', false)
ON CONFLICT (slug) DO NOTHING;

-- PRODUCTS
DO $$
DECLARE
  v_cat_devices uuid; v_cat_liquids uuid; v_cat_disposables uuid; v_cat_accessories uuid; v_cat_smoking uuid; v_cat_cbd uuid;
  v_brand_vapo uuid; v_brand_smok uuid; v_brand_juul uuid; v_brand_pax uuid; v_brand_storz uuid; v_brand_raw uuid;
BEGIN
  SELECT id INTO v_cat_devices FROM categories WHERE slug='vape-devices';
  SELECT id INTO v_cat_liquids FROM categories WHERE slug='e-liquids';
  SELECT id INTO v_cat_disposables FROM categories WHERE slug='disposables';
  SELECT id INTO v_cat_accessories FROM categories WHERE slug='accessories';
  SELECT id INTO v_cat_smoking FROM categories WHERE slug='smoking';
  SELECT id INTO v_cat_cbd FROM categories WHERE slug='cbd';
  SELECT id INTO v_brand_vapo FROM brands WHERE slug='vaporesso';
  SELECT id INTO v_brand_smok FROM brands WHERE slug='smok';
  SELECT id INTO v_brand_juul FROM brands WHERE slug='juul';
  SELECT id INTO v_brand_pax FROM brands WHERE slug='pax';
  SELECT id INTO v_brand_storz FROM brands WHERE slug='storz-bickel';
  SELECT id INTO v_brand_raw FROM brands WHERE slug='raw';

  INSERT INTO products (name, slug, description, short_description, category_id, brand_id, price, compare_at_price, cost, sku, stock, low_stock_threshold, is_featured, is_best_seller, is_new_arrival, is_flash_sale, rating, review_count, nicotine_strength, tags) VALUES
    ('Vaporesso Luxe XR Max', 'vaporesso-luxe-xr-max', 'The Vaporesso Luxe XR Max delivers up to 80W of power with a sleek zinc-alloy frame and AXON chipset for rapid firing and precision control.', '80W pod mod with AXON chip', v_cat_devices, v_brand_vapo, 89.99, 119.99, 42.00, 'VLX-XR-MAX', 45, 10, true, true, true, false, 4.8, 124, '5%', ARRAY['mod','pod-system','80w']),
    ('SMOK Nord 5 Kit', 'smok-nord-5-kit', 'The SMOK Nord 5 is a compact pod system with 80W output, 2000mAh battery, and adjustable airflow for MTL and DTL vaping.', 'Compact 80W pod mod', v_cat_devices, v_brand_smok, 49.99, 64.99, 22.00, 'SMK-NORD5', 120, 15, true, true, false, false, 4.7, 89, '5%', ARRAY['pod-system','compact']),
    ('PAX Plus Vaporizer', 'pax-plus-vaporizer', 'The PAX Plus is a premium dry herb vaporizer with four experience modes, 3-hour battery, and aerospace-grade build.', 'Premium dry herb vaporizer', v_cat_devices, v_brand_pax, 249.99, NULL, 165.00, 'PAX-PLUS', 18, 8, true, true, true, false, 4.9, 67, NULL, ARRAY['dry-herb','premium']),
    ('Storz & Bickel Mighty+', 'storz-bickel-mighty-plus', 'The Mighty+ delivers desktop-quality vapor in a portable form with precise temperature control and hybrid heating.', 'Portable hybrid vaporizer', v_cat_devices, v_brand_storz, 399.00, NULL, 280.00, 'SB-MIGHTY-PLUS', 8, 5, true, false, true, false, 4.9, 34, NULL, ARRAY['dry-herb','portable','premium']),
    ('Mango Ice E-Liquid 60ml', 'mango-ice-e-liquid-60ml', 'Tropical mango with a cool menthol finish. 70/30 VG/PG ratio for dense clouds and smooth throat hit.', 'Tropical mango menthol', v_cat_liquids, v_brand_vapo, 24.99, 32.99, 8.50, 'ELQ-MANGO-60', 200, 20, true, true, false, true, 4.6, 156, '3mg', ARRAY['e-liquid','mango','menthol']),
    ('Blue Raspberry E-Liquid 100ml', 'blue-raspberry-e-liquid-100ml', 'Sweet blue raspberry with balanced tartness. 70/30 VG/PG, available in multiple nicotine strengths.', 'Sweet blue raspberry', v_cat_liquids, v_brand_smok, 29.99, NULL, 10.00, 'ELQ-BLUE-RASP-100', 80, 15, false, true, false, false, 4.5, 78, '3mg', ARRAY['e-liquid','blue-raspberry']),
    ('JUUL Mango Nectar Pods', 'juul-mango-nectar-pods', 'JUUL-compatible mango nectar pods. Pack of 4, 5% nicotine strength.', 'Mango nectar pods 4-pack', v_cat_disposables, v_brand_juul, 19.99, 24.99, 7.00, 'JUL-MANGO-4PK', 150, 30, true, true, false, false, 4.4, 203, '5%', ARRAY['pods','juul','mango']),
    ('Elf Bar BC5000', 'elf-bar-bc5000', 'Disposable vape with 5000 puffs, 650mAh rechargeable battery, and dual mesh coil for consistent flavor.', '5000-puff disposable', v_cat_disposables, v_brand_smok, 16.99, 21.99, 5.50, 'ELF-BC5000', 300, 50, true, true, true, true, 4.7, 312, '5%', ARRAY['disposable','5000-puffs']),
    ('RAW Rolling Papers King Size', 'raw-rolling-papers-king-size', 'Natural unrefined rolling papers made from pure hemp. King size, 32 leaves per pack.', 'Natural hemp rolling papers', v_cat_smoking, v_brand_raw, 3.99, NULL, 1.20, 'RAW-KING-32', 500, 100, false, true, false, false, 4.8, 445, NULL, ARRAY['papers','hemp','king-size']),
    ('Premium Grinder 4-Piece', 'premium-grinder-4-piece', 'CNC-machined aluminum grinder with sharp diamond teeth, pollen screen, and magnetic lid.', 'Aluminum 4-piece grinder', v_cat_accessories, v_brand_raw, 34.99, 44.99, 14.00, 'ACC-GRIND-4P', 75, 10, true, false, true, false, 4.7, 92, NULL, ARRAY['grinder','accessory','aluminum']),
    ('CBD Relief Balm 500mg', 'cbd-relief-balm-500mg', 'Full-spectrum CBD topical balm with 500mg CBD for targeted relief. Natural ingredients, third-party tested.', '500mg CBD topical balm', v_cat_cbd, v_brand_pax, 39.99, 49.99, 18.00, 'CBD-BALM-500', 60, 15, false, false, true, false, 4.6, 41, '0%', ARRAY['cbd','topical','relief'])
  ON CONFLICT (slug) DO NOTHING;
END $$;

-- PRODUCT IMAGES
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT p.id, 'https://images.pexels.com/photos/2836486/pexels-photo-2836486.jpeg?auto=compress&cs=tinysrgb&w=800', p.name, 0
FROM products p
WHERE NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id);

-- BRANCHES
INSERT INTO branches (name, code, address, city, state, postal_code, country, phone, email, manager, opening_hours, is_active) VALUES
  ('LUXE Manhattan Flagship', 'NYC-01', '1 Liberty Plaza', 'New York', 'NY', '10006', 'United States', '+1 (212) 555-0142', 'manhattan@luxe.co', 'Sarah Chen', '{"Monday":"9:00-22:00","Tuesday":"9:00-22:00","Wednesday":"9:00-22:00","Thursday":"9:00-22:00","Friday":"9:00-23:00","Saturday":"10:00-23:00","Sunday":"11:00-20:00"}', true),
  ('LUXE Brooklyn', 'BKLN-02', '150 Court Street', 'Brooklyn', 'NY', '11201', 'United States', '+1 (718) 555-0198', 'brooklyn@luxe.co', 'Marcus Johnson', '{"Monday":"10:00-21:00","Tuesday":"10:00-21:00","Wednesday":"10:00-21:00","Thursday":"10:00-21:00","Friday":"10:00-22:00","Saturday":"10:00-22:00","Sunday":"11:00-19:00"}', true),
  ('LUXE Los Angeles', 'LA-03', '8200 Sunset Blvd', 'Los Angeles', 'CA', '90046', 'United States', '+1 (213) 555-0177', 'la@luxe.co', 'Elena Rodriguez', '{"Monday":"9:00-22:00","Tuesday":"9:00-22:00","Wednesday":"9:00-22:00","Thursday":"9:00-22:00","Friday":"9:00-23:00","Saturday":"10:00-23:00","Sunday":"11:00-20:00"}', true),
  ('LUXE Miami Beach', 'MIA-04', '1100 Ocean Drive', 'Miami Beach', 'FL', '33139', 'United States', '+1 (305) 555-0156', 'miami@luxe.co', 'Carlos Mendez', '{"Monday":"10:00-22:00","Tuesday":"10:00-22:00","Wednesday":"10:00-22:00","Thursday":"10:00-22:00","Friday":"9:00-23:00","Saturday":"10:00-23:00","Sunday":"11:00-21:00"}', true)
ON CONFLICT (code) DO NOTHING;

-- WAREHOUSES
INSERT INTO warehouses (name, code, address, city, state, postal_code, country, manager, capacity, is_active) VALUES
  ('East Coast Distribution', 'WH-EAST', '500 Industrial Blvd', 'Newark', 'NJ', '07105', 'United States', 'David Kim', 50000, true),
  ('West Coast Distribution', 'WH-WEST', '2200 Logistics Way', 'Long Beach', 'CA', '90802', 'United States', 'Lisa Park', 75000, true)
ON CONFLICT (code) DO NOTHING;

-- SUPPLIERS
INSERT INTO suppliers (name, contact_name, email, phone, address, city, country, payment_terms, is_active)
SELECT 'VapeTech Distribution', 'Michael Brown', 'mike@vapetech.com', '+1 (732) 555-0111', '100 Commerce Drive', 'New Brunswick', 'United States', 'Net 30', true
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name='VapeTech Distribution');

INSERT INTO suppliers (name, contact_name, email, phone, address, city, country, payment_terms, is_active)
SELECT 'Global Vape Supply', 'Anna Schmidt', 'anna@globalvape.de', '+49 30 5550 0222', 'Hauptstrasse 45', 'Berlin', 'Germany', 'Net 45', true
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name='Global Vape Supply');

INSERT INTO suppliers (name, contact_name, email, phone, address, city, country, payment_terms, is_active)
SELECT 'Premium Accessories Co', 'James Wilson', 'james@premacc.com', '+1 (415) 555-0333', '300 Market Street', 'San Francisco', 'United States', 'Net 15', true
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name='Premium Accessories Co');

-- EMPLOYEES
INSERT INTO employees (first_name, last_name, email, phone, position, branch_id, hire_date, status) VALUES
  ('Sarah', 'Chen', 'sarah.chen@luxe.co', '+1 (212) 555-0142', 'Branch Manager', (SELECT id FROM branches WHERE code='NYC-01'), '2023-03-15', 'active'),
  ('Marcus', 'Johnson', 'marcus.johnson@luxe.co', '+1 (718) 555-0198', 'Branch Manager', (SELECT id FROM branches WHERE code='BKLN-02'), '2023-06-01', 'active'),
  ('Elena', 'Rodriguez', 'elena.rodriguez@luxe.co', '+1 (213) 555-0177', 'Branch Manager', (SELECT id FROM branches WHERE code='LA-03'), '2023-01-20', 'active'),
  ('David', 'Kim', 'david.kim@luxe.co', '+1 (732) 555-0111', 'Warehouse Manager', NULL, '2022-11-10', 'active'),
  ('Lisa', 'Park', 'lisa.park@luxe.co', '+1 (424) 555-0123', 'Warehouse Manager', NULL, '2023-04-05', 'active')
ON CONFLICT (email) DO NOTHING;

UPDATE branches SET manager_id = (SELECT id FROM employees WHERE email='sarah.chen@luxe.co') WHERE code='NYC-01';
UPDATE branches SET manager_id = (SELECT id FROM employees WHERE email='marcus.johnson@luxe.co') WHERE code='BKLN-02';
UPDATE branches SET manager_id = (SELECT id FROM employees WHERE email='elena.rodriguez@luxe.co') WHERE code='LA-03';

-- INVENTORY
DO $$
DECLARE p uuid; b uuid; w uuid;
BEGIN
  FOR p IN SELECT id FROM products LOOP
    FOR b IN SELECT id FROM branches LOOP
      INSERT INTO inventory (product_id, branch_id, quantity_on_hand, quantity_reserved, reorder_point, last_stocked_at)
      VALUES (p, b, 25 + (random() * 50)::integer, 0, 10, now() - (random() * interval '7 days'))
      ON CONFLICT DO NOTHING;
    END LOOP;
    FOR w IN SELECT id FROM warehouses LOOP
      INSERT INTO inventory (product_id, warehouse_id, quantity_on_hand, quantity_reserved, reorder_point, last_stocked_at)
      VALUES (p, w, 100 + (random() * 200)::integer, 0, 50, now() - (random() * interval '3 days'))
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- BLOG POSTS
INSERT INTO blog_posts (title, slug, excerpt, body, author, tags, is_published, published_at, reading_minutes) VALUES
  ('The Complete Guide to Choosing Your First Vape Device', 'guide-first-vape-device', 'Everything you need to know to pick the perfect starter device — from pod systems to box mods.', 'Choosing your first vape device can feel overwhelming with the sheer variety available. In this guide, we break down the key factors: battery life, power output, coil compatibility, and ease of use.

Pod systems like the SMOK Nord 5 are ideal for beginners — compact, simple, and satisfying. For those wanting more control, a regulated box mod offers adjustable wattage and temperature.

Consider your vaping style: MTL (mouth-to-lung) mimics smoking and works best with higher-resistance coils, while DTL (direct-to-lung) produces larger clouds and works with sub-ohm setups.', 'LUXE Editorial', ARRAY['guide','beginner','devices'], true, now() - interval '5 days', 7),
  ('Understanding E-Liquid: VG/PG Ratios Explained', 'understanding-e-liquid-vg-pg', 'A deep dive into vegetable glycerin and propylene glycol — the two bases that define your vaping experience.', 'Every e-liquid is a blend of VG (vegetable glycerin) and PG (propylene glycol). The ratio determines cloud production, throat hit, and flavor intensity.

High VG (70/30) produces dense clouds and a smoother hit — ideal for sub-ohm DTL vaping. A 50/50 blend offers a balance suited to pod systems and MTL.

Nicotine strength also matters: 3mg is standard for sub-ohm, while 12-20mg suits MTL pod systems.', 'LUXE Editorial', ARRAY['e-liquid','guide'], true, now() - interval '12 days', 5),
  ('The Art of Dry Herb Vaporization', 'art-of-dry-herb-vaporization', 'Why convection and conduction heating matter, and how to get the most from your dry herb vaporizer.', 'Dry herb vaporizers heat material without combustion, delivering pure flavor and reduced harmful byproducts. Conduction (direct contact) heats faster but can unevenly roast material. Convection (hot air passing through) offers even extraction and superior flavor.

The PAX Plus and Mighty+ both use hybrid heating — a blend of both methods for balanced results.

Pro tip: grind medium-fine, pack loosely, and start at a lower temperature (360F) to extract terpenes before raising to 420F for full extraction.', 'LUXE Editorial', ARRAY['dry-herb','vaporizer','guide'], true, now() - interval '20 days', 6)
ON CONFLICT (slug) DO NOTHING;

-- STORE LOCATIONS
INSERT INTO store_locations (name, address, city, state, postal_code, country, phone, email, hours, is_active)
SELECT 'LUXE Manhattan', '1 Liberty Plaza', 'New York', 'NY', '10006', 'United States', '+1 (212) 555-0142', 'manhattan@luxe.co', 'Mon-Sun: 9am-10pm', true
WHERE NOT EXISTS (SELECT 1 FROM store_locations WHERE name='LUXE Manhattan' AND address='1 Liberty Plaza');

INSERT INTO store_locations (name, address, city, state, postal_code, country, phone, email, hours, is_active)
SELECT 'LUXE Brooklyn', '150 Court Street', 'Brooklyn', 'NY', '11201', 'United States', '+1 (718) 555-0198', 'brooklyn@luxe.co', 'Mon-Sun: 10am-9pm', true
WHERE NOT EXISTS (SELECT 1 FROM store_locations WHERE name='LUXE Brooklyn' AND address='150 Court Street');

INSERT INTO store_locations (name, address, city, state, postal_code, country, phone, email, hours, is_active)
SELECT 'LUXE Los Angeles', '8200 Sunset Blvd', 'Los Angeles', 'CA', '90046', 'United States', '+1 (213) 555-0177', 'la@luxe.co', 'Mon-Sun: 9am-10pm', true
WHERE NOT EXISTS (SELECT 1 FROM store_locations WHERE name='LUXE Los Angeles' AND address='8200 Sunset Blvd');

INSERT INTO store_locations (name, address, city, state, postal_code, country, phone, email, hours, is_active)
SELECT 'LUXE Miami Beach', '1100 Ocean Drive', 'Miami Beach', 'FL', '33139', 'United States', '+1 (305) 555-0156', 'miami@luxe.co', 'Mon-Sun: 10am-10pm', true
WHERE NOT EXISTS (SELECT 1 FROM store_locations WHERE name='LUXE Miami Beach' AND address='1100 Ocean Drive');

-- CAREERS
INSERT INTO careers (title, slug, department, location, type, description, requirements, salary_range, is_open, posted_at) VALUES
  ('Store Manager — Manhattan', 'store-manager-manhattan', 'Retail', 'New York, NY', 'Full-time', 'Lead our flagship Manhattan boutique, overseeing daily operations, team management, and customer experience.', '3+ years retail management, premium brand experience, strong leadership skills.', '$65k-$85k + commission', true, now() - interval '7 days'),
  ('E-Commerce Specialist', 'ecommerce-specialist', 'Digital', 'Remote', 'Full-time', 'Drive online sales growth through site optimization, merchandising, and digital marketing campaigns.', 'Experience with Shopify/Supabase, analytics, and conversion optimization.', '$55k-$70k', true, now() - interval '14 days'),
  ('Inventory Analyst', 'inventory-analyst', 'Operations', 'Newark, NJ', 'Full-time', 'Manage stock levels across branches and warehouses, forecast demand, and optimize purchasing.', 'Supply chain experience, Excel proficiency, analytical mindset.', '$50k-$65k', true, now() - interval '3 days')
ON CONFLICT (slug) DO NOTHING;

-- FAQ
INSERT INTO faq_entries (question, answer, category, sort_order, is_published)
SELECT 'What is the legal smoking age to purchase from LUXE?', 'You must be 21 years or older to purchase any products from LUXE. We verify age at checkout and upon delivery.', 'General', 1, true
WHERE NOT EXISTS (SELECT 1 FROM faq_entries WHERE question='What is the legal smoking age to purchase from LUXE?');

INSERT INTO faq_entries (question, answer, category, sort_order, is_published)
SELECT 'How long does shipping take?', 'Standard shipping takes 3-5 business days. Expedited shipping (1-2 days) is available at checkout for an additional fee.', 'Shipping', 2, true
WHERE NOT EXISTS (SELECT 1 FROM faq_entries WHERE question='How long does shipping take?');

INSERT INTO faq_entries (question, answer, category, sort_order, is_published)
SELECT 'What is your return policy?', 'We accept returns within 30 days of delivery for unopened products in original packaging. See our Terms of Service for details.', 'Returns', 3, true
WHERE NOT EXISTS (SELECT 1 FROM faq_entries WHERE question='What is your return policy?');

INSERT INTO faq_entries (question, answer, category, sort_order, is_published)
SELECT 'Are your products authentic?', 'Yes. We source directly from manufacturers and authorized distributors. Every product comes with an authenticity guarantee.', 'Products', 4, true
WHERE NOT EXISTS (SELECT 1 FROM faq_entries WHERE question='Are your products authentic?');

INSERT INTO faq_entries (question, answer, category, sort_order, is_published)
SELECT 'Do you ship internationally?', 'Currently we ship within the United States only. We are working on expanding to select international markets.', 'Shipping', 5, true
WHERE NOT EXISTS (SELECT 1 FROM faq_entries WHERE question='Do you ship internationally?');

INSERT INTO faq_entries (question, answer, category, sort_order, is_published)
SELECT 'How do I track my order?', 'Once your order ships, you will receive a tracking number via email. You can also track your order anytime at our Track Order page.', 'Orders', 6, true
WHERE NOT EXISTS (SELECT 1 FROM faq_entries WHERE question='How do I track my order?');

INSERT INTO faq_entries (question, answer, category, sort_order, is_published)
SELECT 'What payment methods do you accept?', 'We accept all major credit cards, Apple Pay, and Google Pay. All payments are processed securely.', 'Payment', 7, true
WHERE NOT EXISTS (SELECT 1 FROM faq_entries WHERE question='What payment methods do you accept?');

-- COUPONS
INSERT INTO coupons (code, description, discount_type, discount_value, min_subtotal, max_uses, is_active) VALUES
  ('WELCOME10', '10% off your first order', 'percentage', 10, 0, 1000, true),
  ('LUXE20', '$20 off orders over $100', 'fixed', 20, 100, 500, true),
  ('FLASH15', '15% off — flash sale', 'percentage', 15, 0, 200, true)
ON CONFLICT (code) DO NOTHING;
