import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import type { Product } from '@/types';
import { searchProducts } from '@/lib/productSearch';
import { cn } from '@/lib/utils';

interface ProductPickerProps {
  /** Full candidate list to search against — already loaded by the parent page. */
  products: Product[];
  /** Selected product id, or '' for none selected. */
  value: string;
  onChange: (productId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  id?: string;
  /** Max number of matches shown in the dropdown at once. */
  maxResults?: number;
}

/**
 * Searchable product selection field: type a SKU or product name, pick from
 * the filtered results. Replaces raw "paste the product UUID" inputs with an
 * actual product-selection dialog, while still ultimately just producing a
 * product id via `onChange` — so it's a drop-in replacement wherever a
 * `productId` string was being collected before.
 */
export function ProductPicker({
  products,
  value,
  onChange,
  label,
  placeholder = 'Search by SKU or product name…',
  required,
  disabled,
  hint,
  id,
  maxResults = 25,
}: ProductPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => products.find((p) => p.id === value) ?? null, [products, value]);

  // Keep the visible text in sync with an externally-changed/reset value
  // (e.g. the parent form clearing itself after submit).
  useEffect(() => {
    if (!open) setQuery('');
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  const results = useMemo(() => searchProducts(products, query).slice(0, maxResults), [products, query, maxResults]);

  const pick = (p: Product) => {
    onChange(p.id);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
  };

  const inputId = id ?? 'product-picker';

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}{required && <span className="text-error-500"> *</span>}
        </label>
      )}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
        <input
          id={inputId}
          disabled={disabled}
          className="input pl-11 pr-16"
          placeholder={selected ? undefined : placeholder}
          value={open ? query : selected ? `${selected.name}${selected.sku ? ` — ${selected.sku}` : ''}` : query}
          onFocus={() => { setOpen(true); setQuery(''); setHighlight(0); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); const p = results[highlight]; if (p) pick(p); }
            else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
          }}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {selected && !disabled && (
            <button type="button" onClick={clear} className="text-ink-400 hover:text-error-500" aria-label="Clear selected product">
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown className="w-4 h-4 text-ink-500" />
        </div>

        {open && (
          <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto glass-card p-1.5 shadow-xl">
            {results.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-ink-400">
                {products.length === 0 ? 'No products loaded.' : 'No products match that SKU or name.'}
              </p>
            ) : (
              results.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p)}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-3 transition',
                    i === highlight ? 'bg-gold-500/10' : 'hover:bg-white/5',
                    p.id === value && 'ring-1 ring-gold-500/40',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink-100 truncate">{p.name}</span>
                    <span className="block text-xs text-ink-500 font-mono">{p.sku ?? 'No SKU'}</span>
                  </span>
                  <span className="text-xs text-ink-400 shrink-0">{p.stock} in stock</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
