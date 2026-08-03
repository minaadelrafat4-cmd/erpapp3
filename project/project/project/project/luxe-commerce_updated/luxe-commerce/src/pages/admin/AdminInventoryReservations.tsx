import { useEffect, useState } from 'react';
import { Lock, Unlock, Clock, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AdminPageHeader } from '@/components/admin/AdminLayout';
import { DataTable, StatCard } from '@/components/admin/AdminComponents';
import { Badge, Skeleton, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { InventoryReservation, Product, Warehouse, Branch } from '@/types';
import { formatDateTime } from '@/lib/utils';

export default function AdminInventoryReservations() {
  const { toast } = useToast();
  const { canEdit } = useAuth();
  const editable = canEdit('inventory.valuation');
  const [reservations, setReservations] = useState<
    (InventoryReservation & { product?: Product; warehouse?: Warehouse; branch?: Branch })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: res }, { data: prods }, { data: whs }, { data: brs }] = await Promise.all([
          supabase.from('inventory_reservations').select('*').order('created_at', { ascending: false }),
          supabase.from('products').select('*'),
          supabase.from('warehouses').select('*'),
          supabase.from('branches').select('*'),
        ]);

        const pMap = Object.fromEntries((prods ?? []).map((p) => [p.id, p]));
        const wMap = Object.fromEntries((whs ?? []).map((w) => [w.id, w]));
        const bMap = Object.fromEntries((brs ?? []).map((b) => [b.id, b]));

        setReservations(
          (res ?? []).map((r) => ({
            ...(r as InventoryReservation),
            product: pMap[(r as InventoryReservation).product_id],
            warehouse: wMap[(r as InventoryReservation).warehouse_id ?? ''],
            branch: bMap[(r as InventoryReservation).branch_id ?? ''],
          }))
        );
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to load reservations', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const release = async (id: string) => {
    try {
      const { error } = await supabase.rpc('release_inventory_reservation', { p_reservation_id: id });
      if (error) throw error;
      toast('Reservation released', 'success');
      setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'released' as const } : r)));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not release reservation', 'error');
    }
  };

  const active = reservations.filter((r) => r.status === 'active');
  const expired = reservations.filter(
    (r) => r.status === 'expired' || (r.status === 'active' && r.expires_at && new Date(r.expires_at) < new Date())
  );
  const totalReservedQty = active.reduce((s, r) => s + r.quantity, 0);

  return (
    <div>
      <AdminPageHeader title="Inventory Reservations" subtitle="Stock held for pending orders and allocations" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={`skeleton-stat-${i}`} className="h-28" />)
        ) : (
          <>
            <StatCard icon={Lock} label="Active Reservations" value={active.length} accent="gold" />
            <StatCard icon={Package} label="Total Reserved Qty" value={totalReservedQty.toLocaleString()} accent="warning" />
            <StatCard icon={Clock} label="Expiring Soon" value={expired.length} accent="error" />
            <StatCard icon={Unlock} label="Released" value={reservations.filter((r) => r.status === 'released').length} accent="accent" />
          </>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : reservations.length === 0 ? (
        <EmptyState
          icon={<Lock className="w-10 h-10" />}
          title="No inventory reservations"
          description="Reservations are created automatically when stock is held for orders."
        />
      ) : (
        <DataTable<InventoryReservation & { id: string; product?: Product; warehouse?: Warehouse; branch?: Branch }>
          rows={reservations}
          columns={[
            {
              key: 'reservation_number',
              label: 'Reservation #',
              render: (r) => <span className="font-mono text-gold-300">{r.reservation_number}</span>,
            },
            {
              key: 'product',
              label: 'Product',
              render: (r) => (
                <div>
                  <p className="font-medium text-ink-100">{r.product?.name ?? '—'}</p>
                  <p className="text-xs text-ink-500">{r.product?.sku ?? '—'}</p>
                </div>
              ),
            },
            {
              key: 'quantity',
              label: 'Qty',
              render: (r) => <span className="font-semibold text-ink-100">{r.quantity}</span>,
            },
            {
              key: 'location',
              label: 'Location',
              render: (r) => (
                <span className="text-ink-300 text-sm">{r.warehouse?.name ?? r.branch?.name ?? '—'}</span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => (
                <Badge
                  color={
                    r.status === 'active'
                      ? 'gold'
                      : r.status === 'released'
                      ? 'neutral'
                      : r.status === 'fulfilled'
                      ? 'accent'
                      : 'warning'
                  }
                >
                  {r.status}
                </Badge>
              ),
            },
            {
              key: 'expires_at',
              label: 'Expires',
              render: (r) => (
                <span className="text-ink-400 text-xs">{r.expires_at ? formatDateTime(r.expires_at) : '—'}</span>
              ),
            },
            {
              key: 'created_at',
              label: 'Created',
              render: (r) => <span className="text-ink-400 text-xs">{formatDateTime(r.created_at)}</span>,
            },
            {
              key: 'actions',
              label: '',
              render: (r) =>
                r.status === 'active' && editable ? (
                  <Button size="sm" variant="ghost" onClick={() => release(r.id)}>
                    <Unlock className="w-4 h-4" /> Release
                  </Button>
                ) : null,
            },
          ]}
        />
      )}
    </div>
  );
}