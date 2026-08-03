import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface SiteSetting {
  key: string;
  value: unknown;
  category: string;
  label: string;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('site_settings').select('*');
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else if (data) {
        const map: Record<string, unknown> = {};
        for (const row of data as SiteSetting[]) {
          map[row.key] = row.value;
        }
        setSettings(map);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Helper: get a string value, falling back to default
  const get = (key: string, fallback = ''): string => {
    const v = settings[key];
    if (typeof v === 'string') return v;
    return fallback;
  };

  return { settings, get, loading, error };
}
