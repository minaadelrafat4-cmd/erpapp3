import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, Heart, ShoppingBag, User, Menu, X, ChevronDown } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/shop', label: 'Shop' },
  { to: '/categories', label: 'Categories' },
  { to: '/brands', label: 'Brands' },
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setMobileOpen(false);
      setQuery('');
    }
  };

  return (
    <header className={cn('fixed top-0 inset-x-0 z-50 transition-all duration-300', scrolled ? 'glass-nav shadow-glass' : 'bg-transparent')}>
      <div className="section">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl font-display font-bold text-gradient-gold tracking-tight">LUXE</span>
            <span className="hidden sm:inline text-[10px] tracking-[0.3em] text-ink-400 uppercase border-l border-white/10 pl-2">Vape &amp; Smoking</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) => cn('px-3 py-2 text-sm font-medium rounded-lg transition link-underline', isActive ? 'text-gold-300' : 'text-ink-200 hover:text-ink-50')}
              >
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/store-locator" className="px-3 py-2 text-sm font-medium text-ink-200 hover:text-ink-50 rounded-lg transition">Stores</NavLink>
            <NavLink to="/careers" className="px-3 py-2 text-sm font-medium text-ink-200 hover:text-ink-50 rounded-lg transition">Careers</NavLink>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={() => setSearchOpen((s) => !s)} className="btn-ghost p-2.5" aria-label="Search">
              <Search className="w-5 h-5" />
            </button>
            <Link to="/wishlist" className="btn-ghost p-2.5 relative" aria-label="Wishlist">
              <Heart className="w-5 h-5" />
              {wishCount > 0 && <Counter n={wishCount} />}
            </Link>
            <Link to="/cart" className="btn-ghost p-2.5 relative" aria-label="Cart">
              <ShoppingBag className="w-5 h-5" />
              {count > 0 && <Counter n={count} />}
            </Link>
            <Link to={user ? '/account' : '/signin'} className="btn-ghost p-2.5" aria-label="Account">
              <User className="w-5 h-5" />
            </Link>
            <button onClick={() => setMobileOpen((s) => !s)} className="btn-ghost p-2.5 lg:hidden" aria-label="Menu">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <form onSubmit={submitSearch} className="pb-4 animate-slide-down">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search devices, e-liquids, accessories…"
                className="input pl-12 pr-4 py-3 text-base"
              />
            </div>
          </form>
        )}
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden glass-nav border-t border-white/10 animate-slide-down">
          <nav className="section py-4 flex flex-col gap-1">
            {[...navLinks, { to: '/store-locator', label: 'Store Locator' }, { to: '/careers', label: 'Careers' }].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn('px-3 py-3 rounded-lg text-base font-medium transition', isActive ? 'bg-gold-500/10 text-gold-300' : 'text-ink-200 hover:bg-white/5')}
              >
                {l.label}
              </NavLink>
            ))}
            <div className="flex items-center gap-2 px-3 pt-3 mt-2 border-t border-white/10">
              <Link to="/faq" onClick={() => setMobileOpen(false)} className="text-sm text-ink-300 flex-1">FAQ</Link>
              <ChevronDown className="w-4 h-4 text-ink-500" />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function Counter({ n }: { n: number }) {
  return (
    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold-sheen text-ink-950 text-[10px] font-bold flex items-center justify-center">
      {n > 99 ? '99+' : n}
    </span>
  );
}
