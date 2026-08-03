import { useState } from 'react';
import { Search, Pencil, Mail, Award } from 'lucide-react';
import { useAdminTable } from '@/hooks/useAdminTable';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/AdminComponents';
import { Badge } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { Customer } from '@/types';
import { formatDate } from '@/lib/utils';

interface CustomerForm {
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth: string;
  loyalty_points: string;
  marketing_opt_in: boolean;
}

export default function AdminCustomers() {
  const { rows, loading, update } = useAdminTable<Customer>('customers', 'created_at', false);
  const { toast } = useToast();
  const { canEdit } = useAuth();
  const editable = canEdit('customers.manage');
  const [query, setQuery] = useState('');
  const filtered = rows.filter((c) => [c.first_name, c.last_name, c.phone].join(' ').toLowerCase().includes(query.toLowerCase()));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>({ first_name: '', last_name: '', phone: '', date_of_birth: '', loyalty_points: '0', marketing_opt_in: false });
  const [saving, setSaving] = useState(false);

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      first_name: c.first_name ?? '',
      last_name: c.last_name ?? '',
      phone: c.phone ?? '',
      date_of_birth: c.date_of_birth ?? '',
      loyalty_points: String(c.loyalty_points),
      marketing_opt_in: c.marketing_opt_in,
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = {
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      loyalty_points: parseInt(form.loyalty_points, 10) || 0,
      marketing_opt_in: form.marketing_opt_in,
    };
    const { error } = await update(editing.id, payload);
    setSaving(false);
    if (error) {
      toast(error, 'error');
    } else {
      toast('Customer updated', 'success');
      setFormOpen(false);
    }
  };

  return (
    <div>
      <AdminPageHeader title="Customers" subtitle={`${rows.length} registered customers`} />
      <div className="max-w-md mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers…" className="input pl-11" />
        </div>
      </div>
      <DataTable<Customer>
        loading={loading}
        rows={filtered}
        columns={[
          { key: 'name', label: 'Name', render: (c) => <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-gold-500/15 text-gold-300 flex items-center justify-center text-sm font-bold">{(c.first_name ?? 'U').charAt(0)}</div><span className="font-medium text-ink-100">{c.first_name} {c.last_name}</span></div> },
          { key: 'phone', label: 'Phone', render: (c) => <span className="text-ink-300">{c.phone ?? '—'}</span> },
          { key: 'loyalty_points', label: 'Loyalty', render: (c) => <Badge color="gold"><Award className="w-3 h-3" /> {c.loyalty_points}</Badge> },
          { key: 'marketing_opt_in', label: 'Marketing', render: (c) => <Badge color={c.marketing_opt_in ? 'accent' : 'neutral'}>{c.marketing_opt_in ? 'Opted in' : 'Out'}</Badge> },
          { key: 'created_at', label: 'Joined', render: (c) => <span className="text-ink-300">{formatDate(c.created_at)}</span> },
          { key: 'actions', label: '', render: (c) => (
            <>{editable && <button onClick={() => openEdit(c)} className="text-ink-400 hover:text-gold-300"><Pencil className="w-4 h-4" /></button>}</>
          ) },
        ]}
      />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Edit Customer" size="md">
        {editing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <Mail className="w-3.5 h-3.5" /> Account email and login are managed via customer sign-up and can't be changed here.
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="First Name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              <Input label="Last Name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <Input label="Loyalty Points" type="number" value={form.loyalty_points} onChange={(e) => setForm({ ...form, loyalty_points: e.target.value })} />
            <label className="flex items-center justify-between glass rounded-xl px-4 py-3">
              <span className="text-sm text-ink-200">Marketing opt-in</span>
              <input type="checkbox" checked={form.marketing_opt_in} onChange={(e) => setForm({ ...form, marketing_opt_in: e.target.checked })} className="w-5 h-5 accent-gold-500" />
            </label>
            <Button onClick={handleSubmit} disabled={saving} className="w-full">{saving ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
