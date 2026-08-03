import { useEffect, useState } from 'react';
import { Search, Plus, Pencil, Trash2, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdminTable } from '@/hooks/useAdminTable';
import { useCategories, useBrands } from '@/hooks/useCatalog';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/AdminComponents';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ProductIdentifiers } from '@/components/admin/ProductIdentifiers';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { Product } from '@/types';
import { formatCurrency, slugify } from '@/lib/utils';
import { searchProducts } from '@/lib/productSearch';

interface ProductForm {
  name: string;
  slug: string;
  sku: string;
  category_id: string;
  brand_id: string;
  price: string;
  compare_at_price: string;
  cost: string;
  stock: string;
  low_stock_threshold: string;
  nicotine_strength: string;
  flavor: string;
  vg_pg_ratio: string;
  puff_count: string;
  battery_capacity_mah: string;
  tank_size_ml: string;
  resistance_ohm: string;
  product_type: Product['product_type'];
  is_age_restricted: boolean;
  nicotine_strength_mg: string;
  tags: string;
  short_description: string;
  description: string;
  is_active: boolean;
  is_featured: boolean;
  is_best_seller: boolean;
  is_new_arrival: boolean;
}

const emptyForm: ProductForm = {
  name: '', slug: '', sku: '', category_id: '', brand_id: '', price: '', compare_at_price: '', cost: '',
  stock: '0', low_stock_threshold: '5', nicotine_strength: '', flavor: '', vg_pg_ratio: '',
  puff_count: '', battery_capacity_mah: '', tank_size_ml: '', resistance_ohm: '',
  product_type: 'device', is_age_restricted: true, nicotine_strength_mg: '',
  tags: '', short_description: '', description: '',
  is_active: true, is_featured: false, is_best_seller: false, is_new_arrival: false,
};

export default function AdminProducts() {
  const { rows, loading, remove, insert, update, refetch } = useAdminTable<Product>('products', 'created_at', false);
  const { categories } = useCategories();
  const { brands } = useBrands();
  const { toast } = useToast();
  const { canEdit } = useAuth();
  const editable = canEdit('products.manage');
  const [query, setQuery] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Keep the open modal's identifiers in sync after a regenerate (or any
  // background refetch) updates the underlying row.
  useEffect(() => {
    if (!editing) return;
    const fresh = rows.find((r) => r.id === editing.id);
    if (fresh && (fresh.barcode !== editing.barcode || fresh.qr_code !== editing.qr_code || fresh.sku !== editing.sku)) {
      setEditing(fresh);
    }
  }, [rows, editing]);

  const handleRegenerateIdentifiers = async () => {
    if (!editing) return;
    setRegenerating(true);
    const { error } = await update(editing.id, { barcode: null, qr_code: null } as Partial<Product>);
    if (error) {
      toast(error, 'error');
    } else {
      await refetch();
      toast('Barcode & QR code regenerated', 'success');
    }
    setRegenerating(false);
  };

  const filtered = searchProducts(rows, query);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      slug: p.slug,
      sku: p.sku ?? '',
      category_id: p.category_id ?? '',
      brand_id: p.brand_id ?? '',
      price: String(p.price),
      compare_at_price: p.compare_at_price != null ? String(p.compare_at_price) : '',
      cost: p.cost != null ? String(p.cost) : '',
      stock: String(p.stock),
      low_stock_threshold: String(p.low_stock_threshold),
      nicotine_strength: p.nicotine_strength ?? '',
      flavor: p.flavor ?? '',
      vg_pg_ratio: p.vg_pg_ratio ?? '',
      puff_count: p.puff_count != null ? String(p.puff_count) : '',
      battery_capacity_mah: p.battery_capacity_mah != null ? String(p.battery_capacity_mah) : '',
      tank_size_ml: p.tank_size_ml != null ? String(p.tank_size_ml) : '',
      resistance_ohm: p.resistance_ohm != null ? String(p.resistance_ohm) : '',
      product_type: p.product_type ?? 'device',
      is_age_restricted: p.is_age_restricted ?? true,
      nicotine_strength_mg: p.nicotine_strength_mg != null ? String(p.nicotine_strength_mg) : '',
      tags: p.tags.join(', '),
      short_description: p.short_description ?? '',
      description: p.description ?? '',
      is_active: p.is_active,
      is_featured: p.is_featured,
      is_best_seller: p.is_best_seller,
      is_new_arrival: p.is_new_arrival,
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.price.trim()) {
      toast('Product name and price are required', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() ? slugify(form.slug) : slugify(form.name),
      sku: form.sku.trim() || null,
      category_id: form.category_id || null,
      brand_id: form.brand_id || null,
      price: parseFloat(form.price) || 0,
      compare_at_price: form.compare_at_price.trim() ? parseFloat(form.compare_at_price) : null,
      cost: form.cost.trim() ? parseFloat(form.cost) : null,
      stock: parseInt(form.stock, 10) || 0,
      low_stock_threshold: parseInt(form.low_stock_threshold, 10) || 5,
      nicotine_strength: form.nicotine_strength.trim() || null,
      flavor: form.flavor.trim() || null,
      vg_pg_ratio: form.vg_pg_ratio.trim() || null,
      puff_count: form.puff_count.trim() ? parseInt(form.puff_count, 10) : null,
      battery_capacity_mah: form.battery_capacity_mah.trim() ? parseInt(form.battery_capacity_mah, 10) : null,
      tank_size_ml: form.tank_size_ml.trim() ? parseFloat(form.tank_size_ml) : null,
      resistance_ohm: form.resistance_ohm.trim() ? parseFloat(form.resistance_ohm) : null,
      product_type: (form.product_type || 'device') as Product['product_type'],
      is_age_restricted: form.is_age_restricted,
      nicotine_strength_mg: form.nicotine_strength_mg.trim() ? parseFloat(form.nicotine_strength_mg) : null,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      short_description: form.short_description.trim() || null,
      description: form.description.trim() || null,
      is_active: form.is_active,
      is_featured: form.is_featured,
      is_best_seller: form.is_best_seller,
      is_new_arrival: form.is_new_arrival,
    };
    const { error } = editing ? await update(editing.id, payload) : await insert(payload);
    setSaving(false);
    if (error) {
      toast(error, 'error');
    } else {
      toast(editing ? 'Product updated' : 'Product added', 'success');
      setFormOpen(false);
    }
  };

  return (
    <div>
      <AdminPageHeader title="Products" subtitle={`${rows.length} products in catalog`} action={editable ? <Button onClick={openAdd}><Plus className="w-4 h-4" /> Add Product</Button> : undefined} />
      <div className="max-w-md mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by SKU or product name…" className="input pl-11" />
        </div>
      </div>
      <DataTable<Product>
        loading={loading}
        rows={filtered}
        columns={[
          { key: 'name', label: 'Product', render: (p) => <div><p className="font-medium text-ink-100">{p.name}</p><p className="text-xs text-ink-500">{p.sku ?? '—'}</p></div> },
          { key: 'price', label: 'Price', render: (p) => <span className="text-gold-300">{formatCurrency(p.price)}</span> },
          { key: 'stock', label: 'Stock', render: (p) => <Badge color={p.stock === 0 ? 'error' : p.stock < 10 ? 'warning' : 'accent'}>{p.stock}</Badge> },
          { key: 'is_featured', label: 'Flags', render: (p) => (
            <div className="flex flex-wrap gap-1">
              {p.is_featured && <Badge color="gold">F</Badge>}
              {p.is_best_seller && <Badge color="accent">BS</Badge>}
              {p.is_new_arrival && <Badge color="success">N</Badge>}
              {p.is_flash_sale && <Badge color="warning">FS</Badge>}
            </div>
          ) },
          { key: 'is_active', label: 'Status', render: (p) => <Badge color={p.is_active ? 'success' : 'neutral'}>{p.is_active ? 'Active' : 'Hidden'}</Badge> },
          { key: 'product_type', label: 'Type', render: (p) => <Badge color="neutral">{p.product_type ?? '—'}</Badge> },
          { key: 'actions', label: '', render: (p) => (
            <div className="flex gap-2">
              <Link to={`/product/${p.slug}`} className="text-ink-400 hover:text-gold-300"><Eye className="w-4 h-4" /></Link>
              {editable && <button onClick={() => openEdit(p)} className="text-ink-400 hover:text-gold-300"><Pencil className="w-4 h-4" /></button>}
              {editable && <button onClick={async () => { const { error } = await remove(p.id); if (error) toast(error, 'error'); else toast('Product deleted', 'info'); }} className="text-ink-400 hover:text-error-500"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ) },
        ]}
      />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Product' : 'Add Product'} size="xl">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} hint="Leave blank to auto-generate a unique SKU" />
          </div>
          <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} hint="Leave blank to auto-generate from the name" />

          <div>
            <p className="label mb-1.5">Identification</p>
            <ProductIdentifiers
              sku={editing?.sku}
              barcode={editing?.barcode}
              qrCode={editing?.qr_code}
              isNew={!editing}
              onRegenerate={handleRegenerateIdentifiers}
              regenerating={regenerating}
              canManage={editable}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Category" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Brand" value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })}>
              <option value="">— None —</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Input label="Price ($)" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <Input label="Compare-at Price ($)" type="number" step="0.01" value={form.compare_at_price} onChange={(e) => setForm({ ...form, compare_at_price: e.target.value })} />
            <Input label="Cost ($)" type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            <Input label="Low Stock Threshold" type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Nicotine Strength" value={form.nicotine_strength} onChange={(e) => setForm({ ...form, nicotine_strength: e.target.value })} placeholder="e.g. 5mg" />
            <Input label="Nicotine Strength (mg)" type="number" step="0.01" value={form.nicotine_strength_mg} onChange={(e) => setForm({ ...form, nicotine_strength_mg: e.target.value })} placeholder="e.g. 5.0" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Flavor" value={form.flavor} onChange={(e) => setForm({ ...form, flavor: e.target.value })} placeholder="e.g. Mango Ice" />
            <Input label="VG/PG Ratio" value={form.vg_pg_ratio} onChange={(e) => setForm({ ...form, vg_pg_ratio: e.target.value })} placeholder="e.g. 70/30" />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Select label="Product Type" value={form.product_type ?? 'device'} onChange={(e) => setForm({ ...form, product_type: e.target.value as Product['product_type'] })}>
              {['device','disposable','refillable','e-liquid','pod','accessory','coil','battery','charger'].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </Select>
            <Input label="Puff Count" type="number" value={form.puff_count} onChange={(e) => setForm({ ...form, puff_count: e.target.value })} placeholder="for disposables" />
            <Input label="Battery (mAh)" type="number" value={form.battery_capacity_mah} onChange={(e) => setForm({ ...form, battery_capacity_mah: e.target.value })} placeholder="for devices" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Tank Size (ml)" type="number" step="0.01" value={form.tank_size_ml} onChange={(e) => setForm({ ...form, tank_size_ml: e.target.value })} />
            <Input label="Resistance (ohm)" type="number" step="0.01" value={form.resistance_ohm} onChange={(e) => setForm({ ...form, resistance_ohm: e.target.value })} />
          </div>
          <label className="flex items-center justify-between glass rounded-xl px-3 py-2.5">
            <span className="text-xs text-ink-200">Age Restricted (18+)</span>
            <input type="checkbox" checked={form.is_age_restricted} onChange={(e) => setForm({ ...form, is_age_restricted: e.target.checked })} className="w-4 h-4 accent-gold-500" />
          </label>
          <Input label="Tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="comma, separated, tags" />
          <Input label="Short Description" value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              ['is_active', 'Active'],
              ['is_featured', 'Featured'],
              ['is_best_seller', 'Best Seller'],
              ['is_new_arrival', 'New Arrival'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between glass rounded-xl px-3 py-2.5">
                <span className="text-xs text-ink-200">{label}</span>
                <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} className="w-4 h-4 accent-gold-500" />
              </label>
            ))}
          </div>
          <Button onClick={handleSubmit} disabled={saving} className="w-full">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Product'}</Button>
        </div>
      </Modal>
    </div>
  );
}
