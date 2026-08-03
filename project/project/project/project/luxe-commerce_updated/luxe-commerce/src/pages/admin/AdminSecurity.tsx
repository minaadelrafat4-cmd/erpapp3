import { useEffect, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Activity, Lock, Monitor, LogOut, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { StatCard } from '@/components/admin/AdminComponents';
import { Badge, Skeleton, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { SecurityEvent, LoginHistoryEntry, ActiveSession } from '@/types';
import { formatDateTime } from '@/lib/utils';

type Tab = 'events' | 'logins' | 'sessions';

export default function AdminSecurity() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [logins, setLogins] = useState<LoginHistoryEntry[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await Promise.all([loadEvents(), loadLogins(), loadSessions()]);
      setLoading(false);
    })();
  }, []);

  const loadEvents = async () => {
    try {
      const { data } = await supabase.rpc('get_security_events', { p_limit: 50 });
      setEvents((data ?? []) as unknown as SecurityEvent[]);
    } catch { setEvents([]); }
  };

  const loadLogins = async () => {
    try {
      const { data } = await supabase.rpc('get_my_login_history', { p_limit: 20 });
      setLogins((data ?? []) as unknown as LoginHistoryEntry[]);
    } catch { setLogins([]); }
  };

  const loadSessions = async () => {
    try {
      const { data } = await supabase.rpc('get_my_active_sessions');
      setSessions((data ?? []) as unknown as ActiveSession[]);
    } catch { setSessions([]); }
  };

  const revokeSession = async (id: string) => {
    try {
      const { error } = await supabase.rpc('revoke_session', { p_session_id: id });
      if (error) throw error;
      toast('Session revoked', 'success');
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast('Could not revoke session', 'error');
    }
  };

  const criticalCount = events.filter((e) => e.severity === 'critical').length;
  const warningCount = events.filter((e) => e.severity === 'warning').length;
  const failedLogins = logins.filter((l) => !l.successful).length;

  return (
    <div>
      <AdminPageHeader title="Security Center" subtitle="Monitor security events, login history, and active sessions" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard icon={ShieldAlert} label="Critical Events" value={criticalCount} accent="error" />
            <StatCard icon={Shield} label="Warning Events" value={warningCount} accent="warning" />
            <StatCard icon={Lock} label="Failed Logins" value={failedLogins} accent="gold" />
            <StatCard icon={Monitor} label="Active Sessions" value={sessions.length} accent="accent" />
          </>
        )}
      </div>

      <div className="flex gap-1 border-b border-white/10 mb-4 overflow-x-auto no-scrollbar">
        {([['events', `Security Events (${events.length})`], ['logins', `Login History (${logins.length})`], ['sessions', `Active Sessions (${sessions.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-5 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${tab === k ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-100'}`}>{label}</button>
        ))}
      </div>

      {tab === 'events' && (
        loading ? <Skeleton className="h-64" /> : events.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="w-10 h-10" />} title="No security events" description="Security events like account lockouts, suspicious logins, and role changes will appear here." />
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="glass rounded-xl p-4 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${e.severity === 'critical' ? 'bg-error-500/10 text-error-400' : e.severity === 'warning' ? 'bg-warning-500/10 text-warning-400' : 'bg-accent-500/10 text-accent-400'}`}>
                  {e.severity === 'critical' ? <ShieldAlert className="w-5 h-5" /> : e.severity === 'warning' ? <Shield className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-ink-100">{e.event_type.replace(/_/g, ' ')}</p>
                    <Badge color={e.severity === 'critical' ? 'error' : e.severity === 'warning' ? 'warning' : 'accent'}>{e.severity}</Badge>
                  </div>
                  <p className="text-sm text-ink-400 mt-0.5">
                    {e.email ?? '—'} {e.ip_address ? `from ${e.ip_address}` : ''}
                  </p>
                  {e.details && <p className="text-xs text-ink-500 mt-1">{JSON.stringify(e.details)}</p>}
                </div>
                <span className="text-xs text-ink-500 shrink-0">{formatDateTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'logins' && (
        loading ? <Skeleton className="h-64" /> : logins.length === 0 ? (
          <EmptyState icon={<Clock className="w-10 h-10" />} title="No login history" description="Your recent login attempts will be recorded here." />
        ) : (
          <div className="space-y-2">
            {logins.map((l) => (
              <div key={l.id} className="glass rounded-xl p-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${l.successful ? 'bg-accent-500/10 text-accent-400' : 'bg-error-500/10 text-error-400'}`}>
                  {l.successful ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink-100">{l.email}</p>
                  <p className="text-xs text-ink-500">
                    {l.ip_address ?? 'Unknown IP'} {l.device_id ? `· ${l.device_id.slice(0, 8)}…` : ''}
                    {!l.successful && l.failure_reason ? ` · ${l.failure_reason}` : ''}
                  </p>
                </div>
                <Badge color={l.successful ? 'success' : 'error'}>{l.successful ? 'Success' : 'Failed'}</Badge>
                <span className="text-xs text-ink-500 shrink-0">{formatDateTime(l.created_at)}</span>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'sessions' && (
        loading ? <Skeleton className="h-64" /> : sessions.length === 0 ? (
          <EmptyState icon={<Monitor className="w-10 h-10" />} title="No active sessions" description="Your active device sessions will appear here. You can revoke any session to force logout." />
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="glass rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center text-gold-400 shrink-0">
                  <Monitor className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink-100">{s.device_name ?? s.device_id?.slice(0, 12) ?? 'Unknown Device'}</p>
                  <p className="text-xs text-ink-500">
                    {s.ip_address ?? 'Unknown IP'} · Last active {formatDateTime(s.last_active_at)}
                  </p>
                  <p className="text-xs text-ink-500">Expires {formatDateTime(s.expires_at)}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revokeSession(s.id)}>
                  <LogOut className="w-4 h-4" /> Revoke
                </Button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
