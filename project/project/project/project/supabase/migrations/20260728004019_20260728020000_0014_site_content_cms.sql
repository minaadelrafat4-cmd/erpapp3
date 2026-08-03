/*
# Site Content Management System

Creates a key-value store for all editable website content so the company
can update homepage text, hero sections, about content, contact info,
footer info, social links, promotional banners, and store information
without touching code.

## New Table: site_settings
- `id` (uuid PK)
- `key` (text, unique) — identifies the setting (e.g. 'hero_title')
- `value` (jsonb) — the setting value (string, object, or array)
- `category` (text) — groups settings for the admin UI (hero, about, contact, footer, social, promo, store, faq, blog)
- `label` (text) — human-readable label shown in admin
- `updated_at` (timestamptz)

## Security
- RLS enabled
- Public read (anon + authenticated) so storefront loads without login
- Staff-only write (is_staff())
*/

CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'general',
  label text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Public read
DROP POLICY IF EXISTS "public_read_site_settings" ON site_settings;
CREATE POLICY "public_read_site_settings" ON site_settings FOR SELECT
  TO anon, authenticated USING (true);

-- Staff-only insert
DROP POLICY IF EXISTS "staff_insert_site_settings" ON site_settings;
CREATE POLICY "staff_insert_site_settings" ON site_settings FOR INSERT
  TO authenticated WITH CHECK (is_staff());

-- Staff-only update
DROP POLICY IF EXISTS "staff_update_site_settings" ON site_settings;
CREATE POLICY "staff_update_site_settings" ON site_settings FOR UPDATE
  TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- Staff-only delete
DROP POLICY IF EXISTS "staff_delete_site_settings" ON site_settings;
CREATE POLICY "staff_delete_site_settings" ON site_settings FOR DELETE
  TO authenticated USING (is_staff());

-- Seed default content
INSERT INTO site_settings (key, value, category, label) VALUES
  -- Hero
  ('hero_badge', '"New Season Collection"', 'hero', 'Hero Badge'),
  ('hero_title', '"The Art of Fine Smoking"', 'hero', 'Hero Title'),
  ('hero_subtitle', '"Discover a curated collection of premium vape devices, artisan e-liquids, and refined smoking accessories — engineered for the discerning connoisseur."', 'hero', 'Hero Subtitle'),
  ('hero_image_url', '""', 'hero', 'Hero Image URL (leave blank for default)'),
  -- Editorial banner
  ('editorial_badge', '"The LUXE Standard"', 'promo', 'Editorial Badge'),
  ('editorial_title', '"Crafted for those who refuse ordinary"', 'promo', 'Editorial Title'),
  ('editorial_body', '"Every product in our collection is hand-selected by our experts and backed by our authenticity guarantee. No compromises. No counterfeits."', 'promo', 'Editorial Body'),
  ('editorial_image_url', '""', 'promo', 'Editorial Image URL (leave blank for default)'),
  -- CTA
  ('cta_title', '"Become a LUXE Member"', 'promo', 'CTA Title'),
  ('cta_body', '"Join thousands of members enjoying exclusive pricing, early access, and rewards on every purchase."', 'promo', 'CTA Body'),
  -- About
  ('about_title', '"Crafted for the connoisseur"', 'about', 'About Title'),
  ('about_subtitle', '"LUXE was founded on a single belief: that the art of smoking deserves the same reverence as fine wine and craft spirits. We curate only the finest."', 'about', 'About Subtitle'),
  ('about_image_url', '""', 'about', 'About Image URL (leave blank for default)'),
  ('about_stat1_value', '"12K+"', 'about', 'Stat 1 Value'),
  ('about_stat1_label', '"Happy customers"', 'about', 'Stat 1 Label'),
  ('about_stat2_value', '"300+"', 'about', 'Stat 2 Value'),
  ('about_stat2_label', '"Curated products"', 'about', 'Stat 2 Label'),
  ('about_stat3_value', '"40+"', 'about', 'Stat 3 Value'),
  ('about_stat3_label', '"Premium brands"', 'about', 'Stat 3 Label'),
  -- Contact
  ('contact_address', '"1 Liberty Plaza, New York, NY 10006"', 'contact', 'Address'),
  ('contact_phone', '"+1 (800) 585-2937"', 'contact', 'Phone'),
  ('contact_email', '"hello@luxe.co"', 'contact', 'Email'),
  ('contact_support_email', '"support@luxe.co"', 'contact', 'Support Email'),
  ('contact_hours', '"Mon–Fri, 9am–6pm EST"', 'contact', 'Hours'),
  -- Footer
  ('footer_tagline', '"Premium vape & smoking essentials for the modern connoisseur. Crafted experiences, curated quality."', 'footer', 'Footer Tagline'),
  ('footer_copyright', '"LUXE Vape & Smoking Co. All rights reserved."', 'footer', 'Copyright'),
  ('footer_warning', '"For adults 21+. Products contain nicotine — a highly addictive substance."', 'footer', 'Age Warning'),
  -- Social
  ('social_instagram', '"https://instagram.com/luxe"', 'social', 'Instagram URL'),
  ('social_twitter', '"https://twitter.com/luxe"', 'social', 'Twitter/X URL'),
  ('social_facebook', '"https://facebook.com/luxe"', 'social', 'Facebook URL'),
  ('social_youtube', '"https://youtube.com/@luxe"', 'social', 'YouTube URL'),
  -- Store
  ('store_name', '"LUXE Vape & Smoking Co."', 'store', 'Store Name'),
  ('store_currency', '"USD"', 'store', 'Currency'),
  ('store_min_order', '"25"', 'store', 'Minimum Order'),
  ('store_free_shipping', '"75"', 'store', 'Free Shipping Threshold')
ON CONFLICT (key) DO NOTHING;
