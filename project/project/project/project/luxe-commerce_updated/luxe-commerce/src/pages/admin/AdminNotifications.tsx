import { useEffect, useState, useCallback } from 'react';
import { Bell, Check, Trash2, Settings, X, Mail, ShieldAlert, Package, ShoppingCart, Truck, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { Badge, EmptyState, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { Notification } from '@/types';
import { timeAgo } from '@/lib/utils';

type FilterType = 'all' | 'unread' | 'warning' | 'info' | 'contact';

interface NotifSetting {
  id: string;
  notification_type: string;
  is_enabled: boolean;
  email_enabled: boolean;
}

interface NotifType {
  id: string;
  name: string;
  description: string | null;
  category: string;
}

const CATEGORY_ICONS: Record<string, typeof Bell> = {
  inventory: Package,
  orders: ShoppingCart,
  suppliers: Truck,
  transfers: Truck,
  payments: AlertTriangle,
  security: ShieldAlert,
  system: Bell,
};

export default function AdminNotifications() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifTypes, setNotifTypes] = useState<NotifType[]>([]);
  const [settings, setSettings] = useState<NotifSetting[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const fetchNotifs = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setRows((data ?? []) as Notification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setRows((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = rows.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setRows((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const remove = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setRows((prev) => prev.filter((n) => n.id !== id));
  };

  const openSettings = async () => {
    setSettingsOpen(true);
    setSettingsLoading(true);
    const [typesRes, settingsRes] = await Promise.all([
      supabase.from('notification_types').select('*').order('category, name'),
      user ? supabase.from('notification_settings').select('*').eq('user_id', user.id) : Promise.resolve({ data: [] }),
    ]);
    setNotifTypes((typesRes.data ?? []) as NotifType[]);
    setSettings((settingsRes.data ?? []) as NotifSetting[]);
    setSettingsLoading(false);
  };

  const toggleSetting = async (notifType: string, field: 'is_enabled' | 'email_enabled', value: boolean) => {
    if (!user) return;
    const existing = settings.find((s) => s.notification_type === notifType);
    if (existing) {
      await supabase.from('notification_settings').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', existing.id);
      setSettings((prev) => prev.map((s) => (s.id === existing.id ? { ...s, [field]: value } : s)));
    } else {
      const { data } = await supabase.from('notification_settings').insert({
        user_id: user.id, notification_type: notifType, is_enabled: field === 'is_enabled' ? value : true, email_enabled: field === 'email_enabled' ? value : false,
      }).select().single();
      if (data) setSettings((prev) => [...prev, data as NotifSetting]);
    }
  };

  const filtered = rows.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.is_read;
    if (filter === 'warning') return n.type === 'warning';
    if (filter === 'info') return n.type === 'info';
    if (filter === 'contact') return n.type === 'contact';
    return true;
  });

  const unread = rows.filter((n) => !n.is_read).length;

  const filterTabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'unread', label: 'Unread', count: unread },
    { key: 'warning', label: 'Warnings', count: rows.filter((n) => n.type === 'warning').length },
    { key: 'info', label: 'Info', count: rows.filter((n) => n.type === 'info').length },
    { key: 'contact', label: 'Contact', count: rows.filter((n) => n.type === 'contact').length },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Notifications"
        subtitle={`${unread} unread of ${rows.length} total`}
        action={<Button variant="ghost" onClick={openSettings}><Settings className="w-4 h-4" /> Settings</Button>}
      />

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
        {filterTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${filter === t.key ? 'bg-gold-500/15 text-gold-300 border border-gold-500/30' : 'glass text-ink-400 hover:text-ink-100 border border-transparent'}`}
          >
            {t.label} {t.count > 0 && <span className="text-xs text-ink-500">({t.count})</span>}
          </button>
        ))}
        {unread > 0 && (
          <Button size="sm" variant="ghost" onClick={markAllRead} className="ml-auto"><Check className="w-4 h-4" /> Mark all read</Button>
        )}
      </div>

      {loading ? <Skeleton className="h-64" /> : filtered.length === 0 ? (
        <EmptyState icon={<Bell className="w-10 h-10" />} title="No notifications" description={filter === 'unread' ? "You're all caught up." : 'No notifications in this category.'} />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const Icon = n.type === 'warning' ? AlertTriangle : n.type === 'contact' ? Mail : Bell;
            return (
              <div key={n.id} className={`glass-card p-4 flex items-start gap-3 ${!n.is_read ? 'border-gold-500/30' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${n.type === 'warning' ? 'bg-error-500/10 text-error-400' : n.type === 'contact' ? 'bg-accent-500/10 text-accent-400' : 'bg-gold-500/10 text-gold-400'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink-100">{n.title}</p>
                    {!n.is_read && <Badge color="gold">New</Badge>}
                    {n.type === 'warning' && <Badge color="error">Warning</Badge>}
                  </div>
                  <p className="text-sm text-ink-400 mt-0.5">{n.message}</p>
                  <p className="text-xs text-ink-500 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!n.is_read && <button onClick={() => markRead(n.id)} className="p-2 text-ink-400 hover:text-accent-400" aria-label="Mark read"><Check className="w-4 h-4" /></button>}
                  <button onClick={() => remove(n.id)} className="p-2 text-ink-400 hover:text-error-500" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settings modal */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Notification Settings" size="md">
        {settingsLoading ? <Skeleton className="h-48" /> : (
          <div className="space-y-4">
            <p className="text-sm text-ink-400">Choose which notifications you receive and whether to also get them by email.</p>
            {notifTypes.length === 0 ? (
              <p className="text-ink-400 text-sm">No notification types configured.</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-auto">
                {notifTypes.map((nt) => {
                  const setting = settings.find((s) => s.notification_type === nt.name);
                  const Icon = CATEGORY_ICONS[nt.category] ?? Bell;
                  return (
                    <div key={nt.id} className="glass rounded-xl p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gold-500/10 flex items-center justify-center text-gold-400 shrink-0"><Icon className="w-4 h-4" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-100 capitalize">{nt.name.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-ink-500">{nt.description ?? nt.category}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={setting?.is_enabled ?? true} onChange={(e) => toggleSetting(nt.name, 'is_enabled', e.target.checked)} className="rounded border-white/20 bg-white/5 text-gold-500 focus:ring-gold-500" />
                          <span className="text-xs text-ink-400">In-app</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={setting?.email_enabled ?? false} onChange={(e) => toggleSetting(nt.name, 'email_enabled', e.target.checked)} className="rounded border-white/20 bg-white/5 text-gold-500 focus:ring-gold-500" />
                          <span className="text-xs text-ink-400"><Mail className="w-3 h-3 inline" /> Email</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
