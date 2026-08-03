import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AdminTableOptions {
  /**
   * Optional cap on rows fetched, for tables that grow without bound
   * (e.g. orders). Omit to keep the existing "fetch everything" behavior —
   * this only changes behavior for callers that explicitly opt in.
   */
  limit?: number;
}

export function useAdminTable<T extends { id: string }>(
  table: string,
  orderBy = 'created_at',
  ascending = false,
  options: AdminTableOptions = {},
) {
  const { limit } = options;
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase.from(table).select('*').order(orderBy, { ascending });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) setError(error.message);
    setRows((data ?? []) as T[]);
    setLoading(false);
  }, [table, orderBy, ascending, limit]);

  useEffect(() => { fetch(); }, [fetch]);

  const remove = async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return { error: error.message };
    setRows((prev) => prev.filter((r) => r.id !== id));
    return { error: null };
  };

  const update = async (id: string, patch: Partial<T>): Promise<{ error: string | null }> => {
    const { error } = await supabase.from(table).update(patch).eq('id', id);
    if (error) return { error: error.message };
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    return { error: null };
  };

  const insert = async (payload: Partial<T>): Promise<{ error: string | null }> => {
    const { error } = await supabase.from(table).insert(payload);
    if (error) return { error: error.message };
    await fetch();
    return { error: null };
  };

  return { rows, loading, error, refetch: fetch, remove, update, insert };
}
