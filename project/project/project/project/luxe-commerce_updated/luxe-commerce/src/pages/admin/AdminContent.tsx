import { useEffect, useState } from 'react';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/Card';

interface SettingRow {
  key: string;
  value: unknown;
  category: string;
  label: string;
}

const CATEGORIES = [
  { id: 'hero', label: 'Homepage Hero' },
  { id: 'promo', label: 'Promotional Banners' },
  { id: 'about', label: 'About Page' },
  { id: 'contact', label: 'Contact Information' },
  { id: 'footer', label: 'Footer' },
  { id: 'social', label: 'Social Links' },
  { id: 'store', label: 'Store Settings' },
];

function extractString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  try { return JSON.stringify(v); } catch { return ''; }
}

export default function AdminContent() {
  const { toast } = useToast();
  const { canEdit } = useAuth();
  const editable = canEdit('content.manage');
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState('hero');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('site_settings').select('*').order('category, key');
      if (error) setError(error.message);
      if (data) {
        const settingRows = data as SettingRow[];
        setRows(settingRows);
        const d: Record<string, string> = {};
        for (const r of settingRows) d[r.key] = extractString(r.value);
        setDrafts(d);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => r.category === activeCat);

  const save = async () => {
    setSaving(true);
    const toUpdate = filtered.map((r) => ({
      key: r.key,
      value: drafts[r.key] ?? '',
    }));
    let errors = 0;
    for (const item of toUpdate) {
      const { error } = await supabase
        .from('site_settings')
        .update({ value: item.value, updated_at: new Date().toISOString() })
        .eq('key', item.key);
      if (error) errors++;
    }
    setSaving(false);
    if (errors > 0) toast(`${errors} setting(s) could not be saved`, 'error');
    else toast('Content updated successfully', 'success');
  };

  if (loading) {
    return (
      <div>
        <AdminPageHeader title="Website Content" subtitle="Edit text and images shown across your storefront." />
        <div className="grid lg:grid-cols-[200px_1fr] gap-6">
          <div className="glass-card p-2 h-fit"><Skeleton className="h-40" /></div>
          <div className="glass-card p-6 space-y-4"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-24" /></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <AdminPageHeader title="Website Content" subtitle="Edit text and images shown across your storefront." />
        <div className="glass-card p-8 text-center">
          <AlertCircle className="w-10 h-10 text-error-400 mx-auto mb-4" />
          <p className="text-ink-300">Could not load content: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Website Content"
        subtitle="Edit text and images shown across your storefront."
        action={
          editable ? (
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          ) : undefined
        }
      />
      <div className="grid lg:grid-cols-[200px_1fr] gap-6">
        <aside className="glass-card p-2 h-fit">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition ${activeCat === c.id ? 'bg-gold-500/10 text-gold-300' : 'text-ink-300 hover:bg-white/5'}`}
            >
              {c.label}
            </button>
          ))}
        </aside>
        <div className="glass-card p-6 space-y-4 max-w-2xl">
          {filtered.length === 0 && <p className="text-ink-400 text-sm">No editable fields in this section.</p>}
          {filtered.map((r) => {
            const val = drafts[r.key] ?? '';
            const isLong = val.length > 80 || r.label.includes('Body') || r.label.includes('Subtitle') || r.label.includes('Tagline') || r.label.includes('Warning');
            const isUrl = r.label.includes('URL') || r.key.includes('image');
            return (
              <div key={r.key}>
                <label className="block text-sm font-medium text-ink-200 mb-1.5">{r.label}</label>
                {isLong ? (
                  <Textarea
                    value={val}
                    onChange={(e) => setDrafts({ ...drafts, [r.key]: e.target.value })}
                    rows={isUrl ? 2 : 4}
                    placeholder={isUrl ? 'Leave blank to use the default image' : ''}
                    disabled={!editable}
                  />
                ) : (
                  <Input
                    value={val}
                    onChange={(e) => setDrafts({ ...drafts, [r.key]: e.target.value })}
                    placeholder={isUrl ? 'Leave blank to use the default image' : ''}
                    disabled={!editable}
                  />
                )}
                {isUrl && (
                  <p className="text-xs text-ink-500 mt-1">
                    Paste an image URL here. In the future, you will be able to upload images directly to Supabase Storage.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
