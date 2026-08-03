import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Twitter, Facebook, Youtube, Mail, MapPin, Phone, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const cols = [
  {
    title: 'Shop',
    links: [
      { to: '/shop', label: 'All Products' },
      { to: '/categories', label: 'Categories' },
      { to: '/brands', label: 'Brands' },
      { to: '/shop?filter=new', label: 'New Arrivals' },
      { to: '/shop?filter=bestseller', label: 'Best Sellers' },
      { to: '/shop?filter=sale', label: 'Flash Sales' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About Us' },
      { to: '/blog', label: 'Blog' },
      { to: '/careers', label: 'Careers' },
      { to: '/store-locator', label: 'Store Locator' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Support',
    links: [
      { to: '/faq', label: 'FAQ' },
      { to: '/track-order', label: 'Track Order' },
      { to: '/account', label: 'My Account' },
      { to: '/wishlist', label: 'Wishlist' },
      { to: '/cart', label: 'Shopping Cart' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy Policy' },
      { to: '/terms', label: 'Terms of Service' },
      { to: '/cookies', label: 'Cookie Policy' },
    ],
  },
];

export function Footer() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { get } = useSiteSettings();

  const tagline = get('footer_tagline', 'Premium vape & smoking essentials for the modern connoisseur. Crafted experiences, curated quality.');
  const copyright = get('footer_copyright', 'LUXE Vape & Smoking Co. All rights reserved.');
  const warning = get('footer_warning', 'For adults 21+. Products contain nicotine — a highly addictive substance.');

  const socials = [
    { Icon: Instagram, url: get('social_instagram', '#') },
    { Icon: Twitter, url: get('social_twitter', '#') },
    { Icon: Facebook, url: get('social_facebook', '#') },
    { Icon: Youtube, url: get('social_youtube', '#') },
  ];

  const contactInfo = [
    { icon: MapPin, label: get('contact_address', '1 Liberty Plaza, New York, NY') },
    { icon: Phone, label: get('contact_phone', '+1 (800) 585-2937') },
    { icon: Mail, label: get('contact_email', 'hello@luxe.co') },
  ];

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    const { error } = await supabase.from('newsletter_subscribers').insert({ email });
    setBusy(false);
    if (error) {
      if (error.code === '23505') toast('You are already subscribed!', 'info');
      else toast('Could not subscribe. Try again.', 'error');
    } else {
      toast('Welcome to LUXE! Check your inbox.', 'success');
      setEmail('');
    }
  };

  return (
    <footer className="relative mt-24 border-t border-white/10 bg-ink-950/80">
      <div className="section py-16">
        {/* Newsletter */}
        <div className="glass-card p-8 md:p-12 -mt-32 mb-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-dark-radial pointer-events-none" />
          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl md:text-3xl font-display font-semibold text-ink-50 mb-2">Join the LUXE Circle</h3>
              <p className="text-ink-300">Exclusive drops, member pricing, and early access to new arrivals — straight to your inbox.</p>
            </div>
            <form onSubmit={subscribe} className="flex flex-col sm:flex-row gap-3">
              <Input type="email" name="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" aria-label="Email address" />
              <Button type="submit" disabled={busy} className="sm:w-auto">
                <Send className="w-4 h-4" /> {busy ? 'Subscribing…' : 'Subscribe'}
              </Button>
            </form>
          </div>
        </div>

        {/* Main */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          <div className="col-span-2 md:col-span-2">
            <Link to="/" className="text-2xl font-display font-bold text-gradient-gold mb-4 inline-block">LUXE</Link>
            <p className="text-sm text-ink-400 max-w-xs mb-6">{tagline}</p>
            <div className="flex gap-3">
              {socials.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full glass flex items-center justify-center text-ink-300 hover:text-gold-300 hover:scale-110 transition" aria-label="Social link">
                  <s.Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-ink-100 mb-4 uppercase tracking-wider">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-ink-400 hover:text-gold-300 transition link-underline">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact info */}
        <div className="grid sm:grid-cols-3 gap-4 py-6 border-t border-white/10">
          {contactInfo.map((c, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-ink-300">
              <c.icon className="w-4 h-4 text-gold-400 shrink-0" />
              {c.label}
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-ink-500">© {new Date().getFullYear()} {copyright}</p>
          <p className="text-xs text-ink-500">⚠️ {warning}</p>
        </div>
      </div>
    </footer>
  );
}
