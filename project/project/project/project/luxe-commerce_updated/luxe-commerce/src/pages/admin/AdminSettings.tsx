import { useState } from 'react';
import { Save, Building2, CreditCard, Bell, Shield } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';

export default function AdminSettings() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'general' | 'payment' | 'notifications' | 'security'>('general');
  const [form, setForm] = useState({ storeName: 'LUXE Vape & Smoking Co.', email: 'hello@luxe.co', phone: '+1 (800) 585-2937', currency: 'USD', address: '1 Liberty Plaza, New York, NY', minOrder: '25', freeShippingThreshold: '75' });

  const save = (e: React.FormEvent) => { e.preventDefault(); toast('Settings saved', 'success'); };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Building2 },
    { id: 'payment' as const, label: 'Payment', icon: CreditCard },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'security' as const, label: 'Security', icon: Shield },
  ];

  return (
    <div>
      <AdminPageHeader title="Settings" subtitle="Manage your store configuration." />
      <div className="grid lg:grid-cols-[200px_1fr] gap-6">
        <aside className="glass-card p-2 h-fit">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-gold-500/10 text-gold-300' : 'text-ink-300 hover:bg-white/5'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </aside>
        <form onSubmit={save} className="glass-card p-6 space-y-4 max-w-2xl">
          {tab === 'general' && (
            <>
              <Input label="Store name" value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Contact email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <Textarea label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <div className="grid sm:grid-cols-3 gap-4">
                <Select label="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option>USD</option><option>EUR</option><option>GBP</option>
                </Select>
                <Input label="Min order" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} />
                <Input label="Free shipping over" value={form.freeShippingThreshold} onChange={(e) => setForm({ ...form, freeShippingThreshold: e.target.value })} />
              </div>
            </>
          )}
          {tab === 'payment' && (
            <>
              <p className="text-ink-300 text-sm">Configure your payment gateway. Connect Stripe to accept cards, Apple Pay, and more.</p>
              <Input label="Stripe publishable key" placeholder="pk_live_…" />
              <Input label="Stripe secret key" placeholder="sk_live_…" type="password" />
              <Select label="Default payment method"><option>Credit Card</option><option>Apple Pay</option><option>PayPal</option></Select>
            </>
          )}
          {tab === 'notifications' && (
            <>
              {['New order received', 'Low stock alert', 'New customer signup', 'New review submitted', 'Daily sales report'].map((n) => (
                <label key={n} className="flex items-center justify-between glass rounded-xl px-4 py-3">
                  <span className="text-sm text-ink-200">{n}</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-gold-500" />
                </label>
              ))}
            </>
          )}
          {tab === 'security' && (
            <>
              <Input label="Current password" type="password" />
              <Input label="New password" type="password" />
              <Input label="Confirm password" type="password" />
              <label className="flex items-center justify-between glass rounded-xl px-4 py-3">
                <span className="text-sm text-ink-200">Two-factor authentication</span>
                <input type="checkbox" className="w-5 h-5 accent-gold-500" />
              </label>
            </>
          )}
          <Button type="submit"><Save className="w-4 h-4" /> Save Changes</Button>
        </form>
      </div>
    </div>
  );
}
