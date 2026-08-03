import { useEffect, useState } from 'react';
import { Plus, Pencil, KeyRound, ShieldCheck } from 'lucide-react';
import { useAdminTable } from '@/hooks/useAdminTable';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/AdminComponents';
import { Button } from '@/components/ui/Button';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Eye, Trash } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Employee, Branch, Role, Permission } from '@/types';
import { canAssignRole, canManageEmployees } from '@/lib/auth';

interface EmployeeForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  branch_id: string;
  hire_date: string;
  status: string;
  role: string;
  password: string;
}

const emptyForm: EmployeeForm = {
  first_name: '', last_name: '', email: '', phone: '', position: '', branch_id: '', hire_date: '', status: 'active',
  role: 'sales_employee', password: '',
};

const STAFF_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'company_owner', label: 'Company Owner' },
  { value: 'general_manager', label: 'General Manager' },
  { value: 'warehouse_manager', label: 'Warehouse Manager' },
  { value: 'branch_manager', label: 'Branch Manager' },
  { value: 'inventory_employee', label: 'Inventory Employee' },
  { value: 'sales_employee', label: 'Sales Employee' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'customer_support', label: 'Customer Support' },
];

export default function AdminEmployees() {
  const { rows, loading, remove, update, refetch } = useAdminTable<Employee>('employees', 'created_at', false);
  const { toast } = useToast();
  const { profile, refreshProfile, canEdit } = useAuth();
  const canManage = canManageEmployees(profile?.role) || canEdit('employees.manage');
  const assignableRoles = STAFF_ROLES.filter((r) => canAssignRole(profile?.role, r.value));
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [, setPermissions] = useState<Permission[]>([]);
  const [employeeRoles, setEmployeeRoles] = useState<Record<string, string[]>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [detailRoles, setDetailRoles] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: r }, { data: p }] = await Promise.all([
        supabase.from('branches').select('*').order('name'),
        supabase.from('roles').select('*').order('hierarchy_level', { ascending: true }),
        supabase.from('permissions').select('*').order('module', { ascending: true }).order('name', { ascending: true }),
      ]);
      setBranches((b ?? []) as Branch[]);
      setRoles((r ?? []) as Role[]);
      setPermissions((p ?? []) as Permission[]);
    })();
  }, []);

  // Load employee role assignments
  useEffect(() => {
    if (rows.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from('employee_roles')
        .select('employee_id, role_id, roles!inner(name)')
        .order('employee_id');
      const map: Record<string, string[]> = {};
      for (const er of (data ?? []) as unknown as { employee_id: string; roles: { name: string } }[]) {
        if (!map[er.employee_id]) map[er.employee_id] = [];
        map[er.employee_id].push(er.roles.name);
      }
      setEmployeeRoles(map);
    })();
  }, [rows]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (e: Employee) => {
    setEditing(e);
    setForm({
      first_name: e.first_name,
      last_name: e.last_name,
      email: e.email,
      phone: e.phone ?? '',
      position: e.position ?? '',
      branch_id: e.branch_id ?? '',
      hire_date: e.hire_date ?? '',
      status: e.status,
      role: employeeRoles[e.id]?.[0] ?? 'sales_employee',
      password: '',
    });
    setFormOpen(true);
  };

  // Synchronize Position text automatically whenever the Role dropdown changes in the form modal
  const handleRoleChange = (selectedRoleName: string) => {
    const formattedPosition = selectedRoleName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    setForm({
      ...form,
      role: selectedRoleName,
      position: formattedPosition, // Auto-updates the position field cleanly
    });
  };

  const viewDetail = async (e: Employee) => {
    setDetailEmployee(e);
    setDetailLoading(true);
    const { data } = await supabase
      .from('employee_roles')
      .select('role_id, roles!inner(name, description)')
      .eq('employee_id', e.id);
    setDetailRoles((data ?? []).map((r: unknown) => (r as { roles: { name: string } }).roles.name));
    setDetailLoading(false);
  };

  // Syncs profiles.role for an employee through the admin-sync-employee-role
  // edge function. This MUST go through the edge function (service role)
  // rather than a direct client update: migration 0015's
  // trg_prevent_role_self_escalation trigger rejects any client-side write to
  // profiles.role/status, so a plain
  // `supabase.from('profiles').update({ role })` silently fails to change
  // anything while still "succeeding" from the caller's point of view.
  // employee_roles is unaffected — that table is written directly by the
  // caller and isn't blocked by anything.
  const syncEmployeeRole = async (employeeId: string, roleName: string): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke('admin-sync-employee-role', {
      body: { employee_id: employeeId, role: roleName },
    });
    if (error) return error.message ?? 'Failed to update role';
    if (data?.error) return data.error as string;
    return null;
  };

  const assignRole = async (employeeId: string, roleName: string) => {
    const targetRole = roles.find((r) => r.name === roleName);
    if (!targetRole) return;

    const { error } = await supabase.from('employee_roles').insert({
      employee_id: employeeId,
      role_id: targetRole.id,
    });

    if (error) {
      if (error.code === '23505') toast('Role already assigned', 'info');
      else toast(error.message, 'error');
    } else {
      const syncError = await syncEmployeeRole(employeeId, roleName);
      if (syncError) toast(syncError, 'error');

      await refreshProfile();
      toast(`Role "${roleName}" assigned`, 'success');
      setDetailRoles((prev) => [...prev, roleName]);
      refetch();
    }
  };

  const removeRole = async (employeeId: string, roleName: string) => {
    const targetRole = roles.find((r) => r.name === roleName);
    if (!targetRole) return;
    const { error } = await supabase
      .from('employee_roles')
      .delete()
      .eq('employee_id', employeeId)
      .eq('role_id', targetRole.id);
    if (error) toast(error.message, 'error');
    else {
      await refreshProfile();
      toast(`Role "${roleName}" removed`, 'info');
      setDetailRoles((prev) => prev.filter((r) => r !== roleName));
      refetch();
    }
  };

  const handleSubmit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      toast('First name, last name and email are required', 'error');
      return;
    }
    if (!editing && !form.password.trim()) {
      toast('Password is required for new employee accounts', 'error');
      return;
    }
    if (!editing && form.password.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }
    if (!canAssignRole(profile?.role, form.role)) {
      toast('You are not authorized to assign that role', 'error');
      return;
    }
    setSaving(true);

    if (editing) {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        position: form.position.trim() || null, // Synchronized position value
        branch_id: form.branch_id || null,
        hire_date: form.hire_date || null,
        status: form.status,
      };
      const { error } = await update(editing.id, payload);
      if (error) {
        toast(error, 'error');
        setSaving(false);
        return;
      }

      const currentRoles = employeeRoles[editing.id] ?? [];
      if (form.role && !currentRoles.includes(form.role)) {
        // 1) employee_roles: this write was never blocked — RLS/the hierarchy
        //    trigger already allow it for a sufficiently-ranked authenticated
        //    caller — so it's kept exactly as before.
        for (const oldRole of currentRoles) {
          const rObj = roles.find((r) => r.name === oldRole);
          if (rObj) {
            await supabase.from('employee_roles').delete().eq('employee_id', editing.id).eq('role_id', rObj.id);
          }
        }
        const newObj = roles.find((r) => r.name === form.role);
        if (newObj) {
          await supabase.from('employee_roles').insert({ employee_id: editing.id, role_id: newObj.id });
        }

        // 2) profiles.role: this is the piece that was actually broken.
        //    Migration 0015's trg_prevent_role_self_escalation rejects any
        //    client-side write to profiles.role/status, so the previous
        //    direct `supabase.from('profiles').update({ role })` (matched by
        //    lower-cased email text, no less) silently did nothing. Routing
        //    through the service-role edge function is the only way past
        //    that trigger, and is also what actually drives is_staff(),
        //    current_staff_rank() and the has_permission() admin bypass —
        //    i.e. what the employee can actually do.
        const syncError = await syncEmployeeRole(editing.id, form.role);
        if (syncError) {
          toast(syncError, 'error');
          setSaving(false);
          return;
        }
      }

      await refreshProfile();
      toast('Employee updated successfully', 'success');
      setFormOpen(false);
      refetch();
    } else {
      try {
        const { data, error } = await supabase.functions.invoke('admin-create-employee', {
          body: {
            email: form.email.trim(),
            password: form.password,
            full_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
            role: form.role,
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            phone: form.phone.trim(),
            position: form.position.trim(),
            branch_id: form.branch_id || null,
            hire_date: form.hire_date || null,
            status: form.status,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast('Employee account created successfully', 'success');
        setFormOpen(false);
        refetch();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to create employee account', 'error');
      }
    }
    setSaving(false);
  };

  const handleDelete = async (e: Employee) => {
    const { error } = await remove(e.id);
    if (error) toast(error, 'error');
    else {
      toast('Employee record removed', 'info');
      refetch();
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Employees"
        subtitle={`${rows.length} team members`}
        action={canManage ? (
          <Button onClick={openAdd}><Plus className="w-4 h-4" /> Create Employee Account</Button>
        ) : undefined}
      />

      <DataTable<Employee>
        loading={loading}
        rows={rows}
        columns={[
          {
            key: 'name', label: 'Name',
            render: (e) => (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gold-500/15 text-gold-300 flex items-center justify-center text-sm font-bold">
                  {e.first_name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-ink-100">{e.first_name} {e.last_name}</p>
                  <p className="text-xs text-ink-500">{e.email}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'roles', label: 'Roles',
            render: (e) => (
              <div className="flex flex-wrap gap-1">
                {(employeeRoles[e.id] ?? []).map((r) => (
                  <Badge key={r} color="gold">{r.replace(/_/g, ' ')}</Badge>
                ))}
                {(!employeeRoles[e.id] || employeeRoles[e.id].length === 0) && (
                  <span className="text-ink-500 text-xs">No role assigned</span>
                )}
              </div>
            ),
          },
          { key: 'position', label: 'Position', render: (e) => <span className="text-ink-300">{e.position ?? '—'}</span> },
          { key: 'branch', label: 'Branch', render: (e) => {
            const b = branches.find((br) => br.id === e.branch_id);
            return <span className="text-ink-300 text-xs">{b?.name ?? '—'}</span>;
          }},
          { key: 'status', label: 'Status', render: (e) => <Badge color={e.status === 'active' ? 'success' : 'neutral'}>{e.status}</Badge> },
          {
            key: 'actions',
            label: '',
            render: (e) => (
              <div className="flex gap-2">
                <button onClick={() => viewDetail(e)} className="text-ink-400 hover:text-gold-300" title="View"><Eye className="w-4 h-4" /></button>
                {canManage && <button onClick={() => openEdit(e)} className="text-ink-400 hover:text-gold-300"><Pencil className="w-4 h-4" /></button>}
                {canManage && <button onClick={() => handleDelete(e)} className="text-ink-400 hover:text-error-500"><Trash className="w-4 h-4" /></button>}
              </div>
            ),
          },
        ]}
      />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Employee' : 'Create Employee Account'} size="md">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
          {!editing && (
            <div className="glass rounded-xl p-3 text-xs text-ink-400 flex items-start gap-2">
              <KeyRound className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
              <span>
                This creates a new staff account with login credentials. The employee will be able to sign in at <span className="text-gold-300 font-mono">/admin/login</span>.
              </span>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="First Name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <Input label="Last Name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} hint={editing ? 'Email cannot be changed after account creation' : undefined} />
          {!editing && (
            <Input label="Temporary Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint="Min 6 characters" />
          )}
          <Select label="Role" value={form.role} onChange={(e) => handleRoleChange(e.target.value)}>
            {assignableRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Position" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="e.g. Sales Associate" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Branch" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
              <option value="">— Unassigned —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Input label="Hire Date" type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
          </div>
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </Select>
          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Employee Account'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!detailEmployee} onClose={() => setDetailEmployee(null)} title={`Roles & Permissions — ${detailEmployee?.first_name ?? ''} ${detailEmployee?.last_name ?? ''}`} size="lg">
        {detailEmployee && (
          <div className="space-y-5">
            <div>
              <h4 className="font-semibold text-ink-50 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gold-400" /> Assigned Roles
              </h4>
              {detailLoading ? (
                <Skeleton className="h-16" />
              ) : detailRoles.length === 0 ? (
                <p className="text-ink-400 text-sm">No roles assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {detailRoles.map((r) => {
                    const role = roles.find((rr) => rr.name === r);
                    return (
                      <div key={r} className="glass rounded-xl px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-ink-100 capitalize">{r.replace(/_/g, ' ')}</p>
                          {role?.description && <p className="text-xs text-ink-400">{role.description}</p>}
                        </div>
                        {canAssignRole(profile?.role, r) && (
                          <button
                            onClick={() => removeRole(detailEmployee.id, r)}
                            className="text-ink-400 hover:text-error-500 text-xs"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="label">Assign Additional Role</label>
              <Select
                value=""
                onChange={(e) => { if (e.target.value) assignRole(detailEmployee.id, e.target.value); }}
              >
                <option value="">— Select a role to assign —</option>
                {roles
                  .filter((r) => r.name !== 'customer' && !detailRoles.includes(r.name))
                  .map((r) => <option key={r.id} value={r.name}>{r.name.replace(/_/g, ' ')}</option>)}
              </Select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}