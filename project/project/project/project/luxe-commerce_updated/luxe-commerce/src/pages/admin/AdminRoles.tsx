import { useState } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, Crown, ChevronRight } from 'lucide-react';
import { useAdminTable } from '@/hooks/useAdminTable';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/AdminComponents';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types';

const ROLE_ICONS: Record<string, typeof Crown> = {
  super_admin: Crown,
  company_owner: Crown,
  general_manager: ShieldCheck,
  warehouse_manager: ShieldCheck,
  branch_manager: ShieldCheck,
  inventory_employee: ShieldCheck,
  sales_employee: ShieldCheck,
  marketing: ShieldCheck,
  accountant: ShieldCheck,
  customer_support: ShieldCheck,
  customer: ShieldCheck,
};

interface RoleForm {
  name: string;
  description: string;
  hierarchy_level: string;
  parent_role_id: string;
}

const emptyForm: RoleForm = { name: '', description: '', hierarchy_level: '10', parent_role_id: '' };

export default function AdminRoles() {
  const { rows, loading, remove, insert, update } = useAdminTable<Role>('roles', 'hierarchy_level', true);
  const { toast } = useToast();
  const { canEdit } = useAuth();
  const editable = canEdit('roles.manage');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const sorted = [...rows].sort((a, b) => a.hierarchy_level - b.hierarchy_level);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (r: Role) => {
    if (r.is_system) return;
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description ?? '',
      hierarchy_level: String(r.hierarchy_level),
      parent_role_id: r.parent_role_id ?? '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast('Role name is required', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim().toLowerCase().replace(/\s+/g, '_'),
      description: form.description.trim() || null,
      hierarchy_level: parseInt(form.hierarchy_level, 10) || 99,
      parent_role_id: form.parent_role_id || null,
    };
    const { error } = editing ? await update(editing.id, payload) : await insert(payload);
    setSaving(false);
    if (error) {
      toast(error, 'error');
    } else {
      toast(editing ? 'Role updated' : 'Role added', 'success');
      setFormOpen(false);
    }
  };

  return (
    <div>
      <AdminPageHeader title="Roles" subtitle={`${rows.length} roles in hierarchy`} action={editable ? <Button onClick={openAdd}><Plus className="w-4 h-4" /> Add Role</Button> : undefined} />

      {/* Hierarchy tree */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-sm font-semibold text-ink-100 uppercase tracking-wider mb-4">Role Hierarchy</h3>
        <div className="space-y-1">
          {sorted.map((r, i) => {
            const Icon = ROLE_ICONS[r.name] ?? ShieldCheck;
            const indent = Math.min(r.hierarchy_level, 8) * 20;
            return (
              <div key={r.id} className="flex items-center gap-2 py-1.5" style={{ paddingLeft: `${indent}px` }}>
                <Icon className={`w-4 h-4 ${r.hierarchy_level <= 1 ? 'text-gold-400' : 'text-ink-400'}`} />
                <span className="text-sm font-medium text-ink-100">{r.name.replace(/_/g, ' ')}</span>
                <span className="text-xs text-ink-500">L{r.hierarchy_level}</span>
                {r.is_system && <Badge color="neutral">System</Badge>}
                {i < sorted.length - 1 && sorted[i + 1].hierarchy_level > r.hierarchy_level && <ChevronRight className="w-3 h-3 text-ink-600 ml-1" />}
              </div>
            );
          })}
        </div>
      </div>

      <DataTable<Role>
        loading={loading}
        rows={sorted}
        columns={[
          { key: 'name', label: 'Role', render: (r) => <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-gold-400" /><span className="font-medium text-ink-100 capitalize">{r.name.replace(/_/g, ' ')}</span>{r.is_system && <Badge color="neutral">System</Badge>}</div> },
          { key: 'hierarchy_level', label: 'Level', render: (r) => <Badge color={r.hierarchy_level <= 2 ? 'gold' : r.hierarchy_level <= 5 ? 'accent' : 'neutral'}>L{r.hierarchy_level}</Badge> },
          { key: 'description', label: 'Description', render: (r) => <span className="text-ink-300">{r.description ?? '—'}</span> },
          { key: 'parent_role_id', label: 'Reports To', render: (r) => {
            const parent = rows.find((x) => x.id === r.parent_role_id);
            return <span className="text-ink-300 text-xs">{parent ? parent.name.replace(/_/g, ' ') : '—'}</span>;
          } },
          { key: 'actions', label: '', render: (r) => (
            <div className="flex gap-2">
              {editable && <button onClick={() => openEdit(r)} className="text-ink-400 hover:text-gold-300" disabled={r.is_system}><Pencil className="w-4 h-4" /></button>}
              {editable && <button onClick={async () => { if (!r.is_system) { const { error } = await remove(r.id); if (error) toast(error, 'error'); else toast('Role deleted', 'info'); } }} className="text-ink-400 hover:text-error-500" disabled={r.is_system}><Trash2 className="w-4 h-4" /></button>}
            </div>
          ) },
        ]}
      />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Role' : 'Add Role'} size="sm">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. regional_manager" />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Hierarchy Level" type="number" value={form.hierarchy_level} onChange={(e) => setForm({ ...form, hierarchy_level: e.target.value })} hint="Lower number = higher authority" />
          <Select label="Reports To (Parent Role)" value={form.parent_role_id} onChange={(e) => setForm({ ...form, parent_role_id: e.target.value })}>
            <option value="">— None —</option>
            {rows.filter((r) => r.id !== editing?.id).map((r) => <option key={r.id} value={r.id}>{r.name.replace(/_/g, ' ')}</option>)}
          </Select>
          <Button onClick={handleSubmit} disabled={saving} className="w-full">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Role'}</Button>
        </div>
      </Modal>
    </div>
  );
}
