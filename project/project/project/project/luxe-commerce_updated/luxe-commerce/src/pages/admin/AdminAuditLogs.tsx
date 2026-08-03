import { useEffect, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/AdminComponents';
import { Badge, Skeleton } from '@/components/ui/Card';
import type { AuditLog } from '@/types';
import { formatDateTime } from '@/lib/utils';

export default function AdminAuditLogs() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
      setRows((data ?? []) as AuditLog[]);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((l) => [l.action, l.entity_type].join(' ').toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <AdminPageHeader title="Audit Logs" subtitle={`${rows.length} recent activities`} />
      <div className="max-w-md mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search logs…" className="input pl-11" />
        </div>
      </div>
      {loading ? <Skeleton className="h-64" /> : (
        <DataTable<AuditLog>
          rows={filtered}
          columns={[
            { key: 'action', label: 'Action', render: (l) => <div className="flex items-center gap-2"><ScrollText className="w-4 h-4 text-gold-400" /><span className="font-mono text-sm text-ink-100">{l.action}</span></div> },
            { key: 'entity_type', label: 'Entity', render: (l) => <Badge color="neutral">{l.entity_type ?? '—'}</Badge> },
            { key: 'ip_address', label: 'IP', render: (l) => <span className="font-mono text-xs text-ink-400">{l.ip_address ?? '—'}</span> },
            { key: 'created_at', label: 'Timestamp', render: (l) => <span className="text-ink-300">{formatDateTime(l.created_at)}</span> },
          ]}
        />
      )}
    </div>
  );
}
