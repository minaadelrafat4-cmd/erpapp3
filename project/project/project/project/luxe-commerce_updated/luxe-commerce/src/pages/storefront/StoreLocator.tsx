import { useEffect, useState } from 'react';
import { MapPin, Phone, Mail, Clock, Navigation } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SectionHeading, Skeleton, EmptyState } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Card';
import type { StoreLocation } from '@/types';

export default function StoreLocator() {
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('store_locations').select('*').eq('is_active', true).order('name');
      setStores((data ?? []) as StoreLocation[]);
      setLoading(false);
    })();
  }, []);

  const filtered = stores.filter((s) => [s.name, s.city, s.state, s.country].join(' ').toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="section py-10">
      <SectionHeading eyebrow="Find us" title="Store Locator" subtitle="Visit one of our premium boutiques and experience LUXE in person." center />
      <div className="relative max-w-xl mx-auto mb-8">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by city, state, or country…" className="input pl-12" />
      </div>
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-48"/>)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<MapPin className="w-10 h-10" />} title="No stores found" description="Try a different search or check back as we expand." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s) => (
            <div key={s.id} className="glass-card p-6 card-hover">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-display text-lg font-semibold text-ink-50">{s.name}</h3>
                <Badge color="accent">Open</Badge>
              </div>
              <div className="space-y-2 text-sm text-ink-300">
                <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" /> {s.address}, {s.city}, {s.state} {s.postal_code}</p>
                {s.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-gold-400" /> {s.phone}</p>}
                {s.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-gold-400" /> {s.email}</p>}
                {s.hours && <p className="flex items-start gap-2"><Clock className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" /> {s.hours}</p>}
              </div>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.address} ${s.city}`)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-gold-300 hover:text-gold-200">
                <Navigation className="w-4 h-4" /> Get directions
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
