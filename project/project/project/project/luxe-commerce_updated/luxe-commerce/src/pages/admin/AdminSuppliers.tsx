import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Phone, Mail, DollarSign, TrendingDown, Users, CreditCard } from 'lucide-react';
import { useAdminTable } from '@/hooks/useAdminTable';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable, StatCard } from '@/components/admin/AdminComponents';
import { Button } from '@/components/ui/Button';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Supplier, SupplierContact, SupplierPayment, SupplierOutstanding, PurchaseOrder } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function AdminSuppliers() {
  const { rows, loading, remove } = useAdminTable<Supplier>('suppliers', 'name', true);
  const { toast } = useToast();
  const { canEdit } = useAuth();
  const editable = canEdit('suppliers.manage');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [tab, setTab] = useState<'contacts' | 'payments' | 'orders'>('contacts');
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [outstanding, setOutstanding] = useState<SupplierOutstanding | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');

  const filtered = rows.filter((s) => [s.name, s.contact_name, s.email].join(' ').toLowerCase().includes(query.toLowerCase()));

  const viewDetail = async (s: Supplier) => {
    setSelected(s);
    setDetailLoading(true);
    const [{ data: cts }, { data: pays }, { data: ords }, { data: outs }] = await Promise.all([
      supabase.from('supplier_contacts').select('*').eq('supplier_id', s.id).order('is_primary', { ascending: false }),
      supabase.from('supplier_payments').select('*').eq('supplier_id', s.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('purchase_orders').select('*').eq('supplier_id', s.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('v_supplier_outstanding').select('*').eq('supplier_id', s.id).maybeSingle(),
    ]);
    setContacts((cts ?? []) as SupplierContact[]);
    setPayments((pays ?? []) as SupplierPayment[]);
    setOrders((ords ?? []) as PurchaseOrder[]);
    setOutstanding(outs as SupplierOutstanding | null);
    setDetailLoading(false);
  };

  const recordPayment = async () => {
    if (!selected || !payAmount) return;
    const { error } = await supabase.rpc('record_supplier_payment', {
      p_supplier_id: selected.id, p_amount: parseFloat(payAmount), p_method: payMethod,
    });
    if (error) toast('Could not record payment', 'error');
    else {
      toast('Payment recorded', 'success');
      setPayModal(false);
      setPayAmount('');
      viewDetail(selected);
    }
  };

  const totalOutstanding = rows.length;

  return (
    <div>
      <AdminPageHeader title="Suppliers" subtitle={`${rows.length} suppliers`} action={editable ? <Button><Plus className="w-4 h-4" /> Add Supplier</Button> : undefined} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard icon={Users} label="Total Suppliers" value={rows.length} accent="gold" />
            <StatCard icon={Users} label="Active" value={rows.filter((s) => s.is_active).length} accent="accent" />
            <StatCard icon={CreditCard} label="With Contacts" value={rows.filter((s) => s.contact_name).length} accent="warning" />
            <StatCard icon={DollarSign} label="Countries" value={new Set(rows.map((s) => s.country)).size} accent="gold" />
          </>
        )}
      </div>

      <div className="max-w-md mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search suppliers…" className="input pl-11" />
        </div>
      </div>

      <DataTable<Supplier>
        loading={loading}
        rows={filtered}
        columns={[
          { key: 'name', label: 'Supplier', render: (s) => <div><p className="font-medium text-ink-100">{s.name}</p>{s.contact_name && <p className="text-xs text-ink-500">{s.contact_name}</p>}</div> },
          { key: 'email', label: 'Email', render: (s) => <span className="text-ink-300">{s.email ?? '—'}</span> },
          { key: 'phone', label: 'Phone', render: (s) => <span className="text-ink-300">{s.phone ?? '—'}</span> },
          { key: 'payment_terms', label: 'Terms', render: (s) => <span className="text-ink-300">{s.payment_terms ?? '—'}</span> },
          { key: 'country', label: 'Country', render: (s) => <span className="text-ink-300">{s.country ?? '—'}</span> },
          { key: 'is_active', label: 'Status', render: (s) => <Badge color={s.is_active ? 'success' : 'neutral'}>{s.is_active ? 'Active' : 'Inactive'}</Badge> },
          { key: 'actions', label: '', render: (s) => (
            <div className="flex gap-2">
              <button onClick={() => viewDetail(s)} className="text-ink-400 hover:text-gold-300" title="View details"><Users className="w-4 h-4" /></button>
              {editable && <button className="text-ink-400 hover:text-gold-300"><Pencil className="w-4 h-4" /></button>}
              {editable && <button onClick={() => { remove(s.id); toast('Supplier removed', 'info'); }} className="text-ink-400 hover:text-error-500"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ) },
        ]}
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''} size="lg">
        {selected && (
          <div className="space-y-5">
            {/* Outstanding balance */}
            {outstanding && (
              <div className="grid grid-cols-3 gap-3">
                <div className="glass rounded-xl p-3"><p className="text-xs text-ink-500 uppercase">Total Ordered</p><p className="text-lg font-bold text-ink-100">{formatCurrency(outstanding.total_ordered)}</p></div>
                <div className="glass rounded-xl p-3"><p className="text-xs text-ink-500 uppercase">Total Paid</p><p className="text-lg font-bold text-accent-400">{formatCurrency(outstanding.total_paid)}</p></div>
                <div className="glass rounded-xl p-3"><p className="text-xs text-ink-500 uppercase">Outstanding</p><p className={`text-lg font-bold ${Number(outstanding.outstanding_balance) > 0 ? 'text-error-400' : 'text-accent-400'}`}>{formatCurrency(outstanding.outstanding_balance)}</p></div>
              </div>
            )}

            {Number(outstanding?.outstanding_balance ?? 0) > 0 && (
              <button onClick={() => setPayModal(true)} className="btn-primary w-full py-2.5 text-sm"><CreditCard className="w-4 h-4" /> Record Payment</button>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-white/10">
              {([['contacts', 'Contacts'], ['payments', 'Payments'], ['orders', 'Purchase Orders']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === k ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-100'}`}>{label}</button>
              ))}
            </div>

            {detailLoading ? <Skeleton className="h-32" /> : (
              <>
                {tab === 'contacts' && (
                  <div className="space-y-2">
                    {contacts.length === 0 ? <p className="text-ink-400 text-sm">No contacts recorded</p> : contacts.map((c) => (
                      <div key={c.id} className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div><p className="text-ink-100">{c.name} {c.is_primary && <Badge color="gold">Primary</Badge>}</p><p className="text-xs text-ink-400">{c.position ?? '—'}</p></div>
                        <div className="text-right text-xs"><p className="text-ink-300">{c.email ?? '—'}</p><p className="text-ink-400">{c.phone ?? '—'}</p></div>
                      </div>
                    ))}
                  </div>
                )}
                {tab === 'payments' && (
                  <div className="space-y-2">
                    {payments.length === 0 ? <p className="text-ink-400 text-sm">No payments recorded</p> : payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between border-b border-white/5 pb-2 text-sm">
                        <div><p className="font-mono text-gold-300">{p.payment_number}</p><p className="text-xs text-ink-400">{formatDate(p.paid_at)} · {p.method}</p></div>
                        <span className="text-ink-100 font-semibold">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {tab === 'orders' && (
                  <div className="space-y-2">
                    {orders.length === 0 ? <p className="text-ink-400 text-sm">No purchase orders</p> : orders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between border-b border-white/5 pb-2 text-sm">
                        <div><p className="font-mono text-gold-300">{o.po_number}</p><p className="text-xs text-ink-400">{formatDate(o.created_at)}</p></div>
                        <div className="flex items-center gap-2"><Badge color={o.status === 'received' ? 'success' : 'gold'}>{o.status}</Badge><span className="text-ink-100">{formatCurrency(o.grand_total)}</span></div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Payment modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Supplier Payment" size="sm">
        <div className="space-y-4">
          <Input label="Amount ($)" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" />
          <Select label="Payment Method" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="check">Check</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="wire">Wire</option>
            <option value="other">Other</option>
          </Select>
          <Button onClick={recordPayment} className="w-full"><CreditCard className="w-4 h-4" /> Record Payment</Button>
        </div>
      </Modal>
    </div>
  );
}
