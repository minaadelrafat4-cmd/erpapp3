import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, KeyRound, Eye, EyeOff, Check, Info } from 'lucide-react';
import { useAdminTable } from '@/hooks/useAdminTable';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/AdminComponents';
import { Button } from '@/components/ui/Button';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { roleRank } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Permission, Role } from '@/types';

interface PermissionForm {
  name: string;
  description: string;
  module: string;
}

const emptyForm: PermissionForm = { name: '', description: '', module: 'general' };

// Roles below always have full access everywhere and aren't shown as editable
// columns in the matrix — there's nothing to configure for them.
const FULL_ACCESS_ROLE_NAMES = ['super_admin', 'company_owner'];

type AccessState = 'none' | 'view' | 'edit';

function accessStateOf(grant: { can_edit: boolean } | undefined): AccessState {
  if (!grant) return 'none';
  return grant.can_edit ? 'edit' : 'view';
}

function AccessControlMatrix() {
  const { role: myRole } = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  // grants[roleId][permissionId] = { can_edit }
  const [grants, setGrants] = useState<Record<string, Record<string, { can_edit: boolean }>>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Only top-tier ranked users (100) can actually write grants — this matches
  // the database's own RLS rule, so we keep the UI in sync with what will
  // actually be allowed to save rather than showing controls that will fail.
  const canEditGrants = roleRank(myRole) >= 100;

  const loadAll = async () => {
    setLoading(true);
    const [rolesRes, permsRes, grantsRes] = await Promise.all([
      supabase.from('roles').select('*').order('hierarchy_level', { ascending: true }),
      supabase.from('permissions').select('*').order('module', { ascending: true }).order('name', { ascending: true }),
      supabase.from('role_permissions').select('role_id, permission_id, can_edit'),
    ]);
    setRoles((rolesRes.data as Role[]) ?? []);
    setPermissions((permsRes.data as Permission[]) ?? []);
    const map: Record<string, Record<string, { can_edit: boolean }>> = {};
    for (const row of (grantsRes.data as { role_id: string; permission_id: string; can_edit: boolean }[]) ?? []) {
      map[row.role_id] = map[row.role_id] ?? {};
      map[row.role_id][row.permission_id] = { can_edit: row.can_edit };
    }
    setGrants(map);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const editableRoles = useMemo(
    () => roles.filter((r) => !FULL_ACCESS_ROLE_NAMES.includes(r.name) && r.name !== 'customer'),
    [roles],
  );
  const fullAccessRoles = useMemo(
    () => roles.filter((r) => FULL_ACCESS_ROLE_NAMES.includes(r.name)),
    [roles],
  );

  const modules = useMemo(() => Array.from(new Set(permissions.map((p) => p.module))), [permissions]);

  const cycleState = async (roleId: string, permissionId: string) => {
    if (!canEditGrants) return;
    const current = accessStateOf(grants[roleId]?.[permissionId]);
    const key = `${roleId}:${permissionId}`;
    setSavingKey(key);

    try {
      if (current === 'none') {
        // none -> view: create a view-only grant
        const { error } = await supabase.from('role_permissions').insert({ role_id: roleId, permission_id: permissionId, can_edit: false });
        if (error) throw error;
        setGrants((prev) => ({ ...prev, [roleId]: { ...prev[roleId], [permissionId]: { can_edit: false } } }));
      } else if (current === 'view') {
        // view -> edit: upgrade the existing grant
        const { error } = await supabase.from('role_permissions').update({ can_edit: true }).eq('role_id', roleId).eq('permission_id', permissionId);
        if (error) throw error;
        setGrants((prev) => ({ ...prev, [roleId]: { ...prev[roleId], [permissionId]: { can_edit: true } } }));
      } else {
        // edit -> none: remove the grant entirely
        const { error } = await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission_id', permissionId);
        if (error) throw error;
        setGrants((prev) => {
          const next = { ...prev, [roleId]: { ...prev[roleId] } };
          delete next[roleId][permissionId];
          return next;
        });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update access', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const roleLabel = (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return <div className="glass-card p-4"><div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div></div>;
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex items-start gap-3 text-sm text-ink-300">
        <Info className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
        <div>
          <p><span className="text-ink-100 font-medium">{fullAccessRoles.map((r) => roleLabel(r.name)).join(' and ')}</span> always have full access to every module and aren't shown below. Click a cell to cycle it: <span className="text-ink-400">No Access → View Only → Can Edit → No Access</span>.</p>
          {!canEditGrants && <p className="mt-1 text-ink-400">Your role can view this matrix but only top-tier admins can change it.</p>}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-400 sticky left-0 bg-ink-900 z-10">Module / Permission</th>
                {editableRoles.map((r) => (
                  <th key={r.id} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-ink-400 text-center whitespace-nowrap">{roleLabel(r.name)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => (
                <>
                  <tr key={`mod-${mod}`} className="bg-white/5">
                    <td colSpan={editableRoles.length + 1} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-gold-400 sticky left-0">{mod}</td>
                  </tr>
                  {permissions.filter((p) => p.module === mod).map((perm) => (
                    <tr key={perm.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-4 py-2.5 text-sm text-ink-200 sticky left-0 bg-ink-900/95 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-3.5 h-3.5 text-ink-500 shrink-0" />
                          <div>
                            <div className="font-mono text-xs text-ink-100">{perm.name}</div>
                            {perm.description && <div className="text-[11px] text-ink-500">{perm.description}</div>}
                          </div>
                        </div>
                      </td>
                      {editableRoles.map((r) => {
                        const state = accessStateOf(grants[r.id]?.[perm.id]);
                        const key = `${r.id}:${perm.id}`;
                        const isSaving = savingKey === key;
                        return (
                          <td key={r.id} className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              disabled={!canEditGrants || isSaving}
                              onClick={() => cycleState(r.id, perm.id)}
                              title={state === 'none' ? 'No access — click to grant view access' : state === 'view' ? 'View only — click to allow editing' : 'Can view and edit — click to remove access'}
                              className={cn(
                                'w-8 h-8 rounded-lg inline-flex items-center justify-center border transition disabled:cursor-not-allowed disabled:opacity-60',
                                state === 'none' && 'border-white/10 text-ink-600 hover:border-white/20 hover:text-ink-400',
                                state === 'view' && 'border-gold-400/40 bg-gold-400/10 text-gold-300',
                                state === 'edit' && 'border-accent-400/40 bg-accent-400/10 text-accent-400',
                              )}
                            >
                              {isSaving ? (
                                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : state === 'none' ? (
                                <EyeOff className="w-4 h-4" />
                              ) : state === 'view' ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-ink-400 px-1">
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-white/10 inline-flex items-center justify-center"><EyeOff className="w-3 h-3" /></span> No access</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-gold-400/40 bg-gold-400/10 text-gold-300 inline-flex items-center justify-center"><Eye className="w-3 h-3" /></span> View only</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-accent-400/40 bg-accent-400/10 text-accent-400 inline-flex items-center justify-center"><Check className="w-3 h-3" /></span> Can view and edit</span>
      </div>
    </div>
  );
}

function PermissionsCatalog() {
  const { rows, loading, remove, insert, update } = useAdminTable<Permission>('permissions', 'module', true);
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Permission | null>(null);
  const [form, setForm] = useState<PermissionForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const modules = Array.from(new Set(rows.map((r) => r.module))).sort();

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (p: Permission) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? '', module: p.module });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.module.trim()) {
      toast('Permission name and module are required', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      module: form.module.trim(),
    };
    const { error } = editing ? await update(editing.id, payload) : await insert(payload);
    setSaving(false);
    if (error) {
      toast(error, 'error');
    } else {
      toast(editing ? 'Permission updated' : 'Permission added', 'success');
      setFormOpen(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={openAdd}><Plus className="w-4 h-4" /> Add Permission</Button>
      </div>
      <DataTable<Permission>
        loading={loading}
        rows={rows}
        columns={[
          { key: 'name', label: 'Permission', render: (p) => <div className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-gold-400" /><span className="font-mono text-sm text-ink-100">{p.name}</span></div> },
          { key: 'description', label: 'Description', render: (p) => <span className="text-ink-300">{p.description ?? '—'}</span> },
          { key: 'module', label: 'Module', render: (p) => <Badge color="gold">{p.module}</Badge> },
          { key: 'actions', label: '', render: (p) => (
            <div className="flex gap-2">
              <button onClick={() => openEdit(p)} className="text-ink-400 hover:text-gold-300"><Pencil className="w-4 h-4" /></button>
              <button onClick={async () => { const { error } = await remove(p.id); if (error) toast(error, 'error'); else toast('Permission deleted', 'info'); }} className="text-ink-400 hover:text-error-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ) },
        ]}
      />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Permission' : 'Add Permission'} size="sm">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. products.delete" />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Module" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} placeholder="e.g. products" list="permission-modules" />
          <datalist id="permission-modules">
            {modules.map((m) => <option key={m} value={m} />)}
          </datalist>
          <Button onClick={handleSubmit} disabled={saving} className="w-full">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Permission'}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default function AdminPermissions() {
  const [tab, setTab] = useState<'matrix' | 'catalog'>('matrix');

  return (
    <div>
      <AdminPageHeader
        title="Access Control"
        subtitle="Control which roles can see, and which can edit, each part of the admin panel"
      />

      <div className="flex gap-2 mb-5 border-b border-white/10">
        <button
          onClick={() => setTab('matrix')}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition', tab === 'matrix' ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-200')}
        >
          Role Access Matrix
        </button>
        <button
          onClick={() => setTab('catalog')}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition', tab === 'catalog' ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-200')}
        >
          Permissions Catalog
        </button>
      </div>

      {tab === 'matrix' ? <AccessControlMatrix /> : <PermissionsCatalog />}
    </div>
  );
}
