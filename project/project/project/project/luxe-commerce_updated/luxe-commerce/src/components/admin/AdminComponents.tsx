import { type ReactNode } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Card';

export function StatCard({ icon: Icon, label, value, change, accent = 'gold' }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  change?: number;
  accent?: 'gold' | 'accent' | 'error' | 'warning';
}) {
  const accents = {
    gold: 'bg-gold-500/10 text-gold-400',
    accent: 'bg-accent-500/10 text-accent-400',
    error: 'bg-error-500/10 text-error-400',
    warning: 'bg-warning-500/10 text-warning-400',
  };
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', accents[accent])}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <span className={cn('flex items-center gap-0.5 text-xs font-medium', change >= 0 ? 'text-accent-400' : 'text-error-400')}>
            {change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-ink-50">{value}</p>
      <p className="text-sm text-ink-400 mt-0.5">{label}</p>
    </div>
  );
}

interface Column<T> { key: string; label: string; render?: (row: T) => ReactNode; className?: string; }
export function DataTable<T extends { id: string }>({ columns, rows, loading, empty }: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  empty?: ReactNode;
}) {
  if (loading) return <div className="glass-card p-4"><div className="space-y-3">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-12"/>)}</div></div>;
  if (rows.length === 0) return <div className="glass-card p-8 text-center text-ink-400">{empty ?? 'No data available'}</div>;
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map((c) => <th key={c.key} className={cn('text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-400', c.className)}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition">
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-5 py-3.5 text-sm text-ink-200', c.className)}>
                    {c.render ? c.render(row) : (row as Record<string, unknown>)[c.key] as ReactNode}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
