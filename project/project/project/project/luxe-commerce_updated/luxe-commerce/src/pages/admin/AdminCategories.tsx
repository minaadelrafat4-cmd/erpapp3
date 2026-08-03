import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAdminTable } from '@/hooks/useAdminTable';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/AdminComponents';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { Category } from '@/types';
import { slugify } from '@/lib/utils';

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  parent_id: string;
  image_url: string;
  sort_order: string;
  is_featured: boolean;
}

const emptyForm: CategoryForm = {
  name: '', slug: '', description: '', parent_id: '', image_url: '', sort_order: '0', is_featured: false,
};

export default function AdminCategories() {
  const { rows, loading, remove, insert, update } = useAdminTable<Category>('categories', 'sort_order', true);
  const { toast } = useToast();
  const { canEdit } = useAuth();
  const editable = canEdit('categories.manage');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description ?? '',
      parent_id: c.parent_id ?? '',
      image_url: c.image_url ?? '',
      sort_order: String(c.sort_order),
      is_featured: c.is_featured,
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast('Category name is required', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() ? slugify(form.slug) : slugify(form.name),
      description: form.description.trim() || null,
      parent_id: form.parent_id || null,
      image_url: form.image_url.trim() || null,
      sort_order: parseInt(form.sort_order, 10) || 0,
      is_featured: form.is_featured,
    };
    const { error } = editing ? await update(editing.id, payload) : await insert(payload);
    setSaving(false);
    if (error) {
      toast(error, 'error');
    } else {
      toast(editing ? 'Category updated' : 'Category added', 'success');
      setFormOpen(false);
    }
  };

  return (
    <div>
      <AdminPageHeader title="Categories" subtitle={`${rows.length} categories`} action={editable ? <Button onClick={openAdd}><Plus className="w-4 h-4" /> Add Category</Button> : undefined} />
      <DataTable<Category>
        loading={loading}
        rows={rows}
        columns={[
          { key: 'name', label: 'Name', render: (c) => <span className="font-medium text-ink-100">{c.name}</span> },
          { key: 'slug', label: 'Slug', render: (c) => <span className="font-mono text-xs text-ink-400">{c.slug}</span> },
          { key: 'sort_order', label: 'Order' },
          { key: 'is_featured', label: 'Featured', render: (c) => <Badge color={c.is_featured ? 'gold' : 'neutral'}>{c.is_featured ? 'Yes' : 'No'}</Badge> },
          { key: 'actions', label: '', render: (c) => (
            <div className="flex gap-2">
              {editable && <button onClick={() => openEdit(c)} className="text-ink-400 hover:text-gold-300"><Pencil className="w-4 h-4" /></button>}
              {editable && <button onClick={async () => { const { error } = await remove(c.id); if (error) toast(error, 'error'); else toast('Category deleted', 'info'); }} className="text-ink-400 hover:text-error-500"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ) },
        ]}
      />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Category' : 'Add Category'} size="md">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Disposables" />
          <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated from name if left blank" hint="Leave blank to auto-generate from the name" />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Select label="Parent Category" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
            <option value="">— None (top level) —</option>
            {rows.filter((r) => r.id !== editing?.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
          <Input label="Image URL" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Sort Order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            <label className="flex items-center justify-between glass rounded-xl px-4 py-3 mt-6">
              <span className="text-sm text-ink-200">Featured</span>
              <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="w-5 h-5 accent-gold-500" />
            </label>
          </div>
          <Button onClick={handleSubmit} disabled={saving} className="w-full">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Category'}</Button>
        </div>
      </Modal>
    </div>
  );
}
