import { useState, useEffect } from 'react';
import { Search, Eye, RotateCcw, DollarSign, CheckCircle2, XCircle, Package, Clock } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable, StatCard } from '@/components/admin/AdminComponents';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import type { OrderReturn, OrderRefund, OrderItem, OrderReturnItem, Order } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function AdminReturnsRefunds() {
  const { toast } = useToast();
  const [returns, setReturns] = useState<OrderReturn[]>([]);
  const [refunds, setRefunds] = useState<OrderRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'returns' | 'refunds'>('returns');
  const [selectedReturn, setSelectedReturn] = useState<OrderReturn | null>(null);
  const [returnItems, setReturnItems] = useState<OrderReturnItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    (async () => {
      const [rRes, fRes] = await Promise.all([
        supabase.from('order_returns').select('*').order('created_at', { ascending: false }),
        supabase.from('order_refunds').select('*').order('created_at', { ascending: false }),
      ]);
      setReturns((rRes.data ?? []) as OrderReturn[]);
      setRefunds((fRes.data ?? []) as OrderRefund[]);
      setLoading(false);
    })();
  }, []);

  const filteredReturns = returns.filter((r) => [r.return_number, r.reason, r.status].join(' ').toLowerCase().includes(query.toLowerCase()));
  const filteredRefunds = refunds.filter((r) => [r.refund_number, r.reason, r.status].join(' ').toLowerCase().includes(query.toLowerCase()));

  const viewReturn = async (r: OrderReturn) => {
    setSelectedReturn(r);
    const [riRes, oRes] = await Promise.all([
      supabase.from('order_return_items').select('*').eq('return_id', r.id),
      supabase.from('orders').select('*').eq('id', r.order_id).maybeSingle(),
    ]);
    setReturnItems((riRes.data ?? []) as OrderReturnItem[]);
    setOrder((oRes.data ?? null) as Order | null);
    if (oRes.data) {
      const { data: oiData } = await supabase.from('order_items').select('*').eq('order_id', (oRes.data as Order).id);
      setOrderItems((oiData ?? []) as OrderItem[]);
    }
  };

  const approveReturn = async (r: OrderReturn) => {
    const { error } = await supabase.from('order_returns').update({ status: 'approved' }).eq('id', r.id);
    if (error) toast('Could not approve return', 'error');
    else { toast('Return approved', 'success'); setReturns((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'approved' } : x))); }
  };

  const rejectReturn = async (r: OrderReturn) => {
    const { error } = await supabase.from('order_returns').update({ status: 'rejected' }).eq('id', r.id);
    if (error) toast('Could not reject return', 'error');
    else { toast('Return rejected', 'info'); setReturns((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'rejected' } : x))); }
  };

  const totalRefundAmount = refunds.filter((r) => r.status === 'completed').reduce((s, r) => s + Number(r.amount), 0);
  const pendingReturns = returns.filter((r) => r.status === 'pending').length;
  const completedRefunds = refunds.filter((r) => r.status === 'completed').length;

  return (
    <div>
      <AdminPageHeader title="Returns & Refunds" subtitle="Manage customer returns and process refunds." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard icon={RotateCcw} label="Total Returns" value={returns.length} accent="gold" />
            <StatCard icon={Clock} label="Pending Returns" value={pendingReturns} accent="warning" />
            <StatCard icon={DollarSign} label="Refund Total" value={formatCurrency(totalRefundAmount)} accent="error" />
            <StatCard icon={CheckCircle2} label="Completed Refunds" value={completedRefunds} accent="accent" />
          </>
        )}
      </div>

      <div className="flex gap-1 border-b border-white/10 mb-4">
        {([['returns', `Returns (${returns.length})`], ['refunds', `Refunds (${refunds.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${tab === k ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-100'}`}>{label}</button>
        ))}
      </div>

      <div className="max-w-md mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${tab}…`} className="input pl-11" />
        </div>
      </div>

      {tab === 'returns' && (
        <DataTable<OrderReturn>
          loading={loading}
          rows={filteredReturns}
          columns={[
            { key: 'return_number', label: 'Return #', render: (r) => <span className="font-mono text-gold-300">{r.return_number}</span> },
            { key: 'reason', label: 'Reason', render: (r) => <span className="text-ink-300 capitalize">{r.reason.replace(/_/g, ' ')}</span> },
            { key: 'status', label: 'Status', render: (r) => <Badge color={r.status === 'restocked' ? 'accent' : r.status === 'rejected' ? 'error' : r.status === 'approved' ? 'success' : 'warning'}>{r.status}</Badge> },
            { key: 'restocked', label: 'Restocked', render: (r) => r.restocked ? <CheckCircle2 className="w-4 h-4 text-accent-400" /> : <XCircle className="w-4 h-4 text-ink-500" /> },
            { key: 'created_at', label: 'Date', render: (r) => <span className="text-ink-300 text-xs">{formatDateTime(r.created_at)}</span> },
            { key: 'actions', label: '', render: (r) => (
              <div className="flex gap-2">
                <button onClick={() => viewReturn(r)} className="text-ink-400 hover:text-gold-300"><Eye className="w-4 h-4" /></button>
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => approveReturn(r)} className="text-accent-400 hover:text-accent-300" title="Approve"><CheckCircle2 className="w-4 h-4" /></button>
                    <button onClick={() => rejectReturn(r)} className="text-error-400 hover:text-error-300" title="Reject"><XCircle className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            ) },
          ]}
        />
      )}

      {tab === 'refunds' && (
        <DataTable<OrderRefund>
          loading={loading}
          rows={filteredRefunds}
          columns={[
            { key: 'refund_number', label: 'Refund #', render: (r) => <span className="font-mono text-gold-300">{r.refund_number}</span> },
            { key: 'reason', label: 'Reason', render: (r) => <span className="text-ink-300 capitalize">{r.reason.replace(/_/g, ' ')}</span> },
            { key: 'amount', label: 'Amount', render: (r) => <span className="font-semibold text-ink-100">{formatCurrency(r.amount)}</span> },
            { key: 'status', label: 'Status', render: (r) => <Badge color={r.status === 'completed' ? 'accent' : r.status === 'failed' ? 'error' : 'warning'}>{r.status}</Badge> },
            { key: 'processed_at', label: 'Processed', render: (r) => <span className="text-ink-300 text-xs">{r.processed_at ? formatDateTime(r.processed_at) : '—'}</span> },
          ]}
        />
      )}

      <Modal open={!!selectedReturn} onClose={() => setSelectedReturn(null)} title={`Return ${selectedReturn?.return_number ?? ''}`} size="lg">
        {selectedReturn && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="glass rounded-xl p-3"><p className="text-xs text-ink-500 uppercase">Status</p><Badge color="gold">{selectedReturn.status}</Badge></div>
              <div className="glass rounded-xl p-3"><p className="text-xs text-ink-500 uppercase">Reason</p><p className="text-ink-100 capitalize">{selectedReturn.reason.replace(/_/g, ' ')}</p></div>
            </div>
            {order && <div className="glass rounded-xl p-3"><p className="text-xs text-ink-500 uppercase">Order</p><p className="font-mono text-gold-300">{order.order_number}</p><p className="text-ink-400 text-xs">{formatCurrency(order.grand_total)}</p></div>}
            <div>
              <h4 className="font-semibold text-ink-50 mb-2">Returned Items</h4>
              <div className="space-y-2">
                {returnItems.length === 0 ? <p className="text-ink-400 text-sm">No items</p> : returnItems.map((ri) => {
                  const oi = orderItems.find((o) => o.id === ri.order_item_id);
                  return (
                    <div key={ri.id} className="flex justify-between text-sm border-b border-white/5 pb-2">
                      <div><p className="text-ink-100">{oi?.product_name ?? 'Unknown'}</p><p className="text-ink-400 text-xs">Qty {ri.quantity}</p></div>
                      <span className="text-ink-100">{formatCurrency(ri.refund_amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {selectedReturn.notes && <div className="glass rounded-xl p-3"><p className="text-xs text-ink-500 uppercase">Notes</p><p className="text-ink-200 text-sm">{selectedReturn.notes}</p></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

