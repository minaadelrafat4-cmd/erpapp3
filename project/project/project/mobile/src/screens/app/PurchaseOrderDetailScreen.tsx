import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { ScreenWrapper } from '@components/ScreenWrapper';
import { AppHeader } from '@components/AppHeader';
import { Card } from '@components/Card';
import { ErrorState } from '@components/ErrorState';
import { LoadingState } from '@components/LoadingState';
import { RoleGate } from '@components/RoleGate';
import { useThemeStore } from '@store/themeStore';
import { usePurchaseOrderDetail } from '@hooks/useERP';
import { useResponsive } from '@hooks/useResponsive';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
import { navMinRank } from '@constants';
import type { IconName, ThemeColors } from '@apptypes';
import type { PurchaseOrderItem } from '@apptypes/erp';

function InfoRow({ label, value, icon, colors }: { label: string; value: string; icon: IconName; colors: ThemeColors }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <MaterialCommunityIcons name={getIconName(icon)} size={18} color={colors.textMuted} />
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function StatusBadge({ status, colors }: { status: string; colors: ThemeColors }) {
  const colorMap: Record<string, string> = {
    draft: colors.textMuted,
    submitted: colors.accent,
    approved: colors.gold,
    ordered: colors.gold,
    partial: colors.warning,
    received: colors.success,
    cancelled: colors.error,
  };
  const color = colorMap[status] ?? colors.textSecondary;
  return (
    <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.statusText, { color }]}>{status}</Text>
    </View>
  );
}

function formatCurrency(amount: number, currency: string): string {
  const prefix = currency === 'USD' ? '$' : '';
  return `${prefix}${amount.toFixed(2)}`;
}

export default function PurchaseOrderDetailScreen() {
  const { colors } = useThemeStore();
  const params = useLocalSearchParams<{ id: string }>();
  const layout = useResponsive();

  const poId = params.id;
  const poQuery = usePurchaseOrderDetail(poId);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await poQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [poQuery]);

  if (poQuery.isLoading) {
    return (
      <RoleGate minRank={navMinRank('purchase-orders')}>
        <ScreenWrapper>
          <AppHeader title="Purchase Order Details" showBack showMenu />
          <LoadingState message="Loading purchase order…" />
        </ScreenWrapper>
      </RoleGate>
    );
  }

  if (poQuery.isError || !poQuery.data) {
    return (
      <RoleGate minRank={navMinRank('purchase-orders')}>
        <ScreenWrapper>
          <AppHeader title="Purchase Order Details" showBack showMenu />
          <ErrorState
            title="Purchase order not found"
            message="This purchase order may have been removed or is unavailable."
            onRetry={() => poQuery.refetch()}
          />
        </ScreenWrapper>
      </RoleGate>
    );
  }

  const po = poQuery.data;

  return (
    <RoleGate minRank={navMinRank('purchase-orders')}>
      <ScreenWrapper>
        <AppHeader title="Purchase Order Details" showBack showMenu />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
        >
          <Card>
            <View style={styles.headerRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
                <MaterialCommunityIcons name={getIconName('purchase-orders')} size={28} color={colors.gold} />
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.poNumber, { color: colors.textPrimary }]}>{po.po_number}</Text>
                <Text style={[styles.supplierName, { color: colors.textMuted }]}>{po.supplier_name}</Text>
              </View>
              <StatusBadge status={po.status} colors={colors} />
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Order Information</Text>
            <View style={styles.infoContainer}>
              <InfoRow label="Supplier" value={po.supplier_name} icon="truck" colors={colors} />
              {po.warehouse_name ? <InfoRow label="Warehouse" value={po.warehouse_name} icon="warehouse" colors={colors} /> : null}
              <InfoRow label="Status" value={po.status} icon="clipboard" colors={colors} />
              <InfoRow label="Created" value={new Date(po.created_at).toLocaleDateString()} icon="calendar" colors={colors} />
              {po.expected_at ? <InfoRow label="Expected" value={new Date(po.expected_at).toLocaleDateString()} icon="calendar" colors={colors} /> : null}
              {po.received_at ? <InfoRow label="Received" value={new Date(po.received_at).toLocaleDateString()} icon="package" colors={colors} /> : null}
            </View>
          </Card>

          {po.notes ? (
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Notes</Text>
              <Text style={[styles.notesText, { color: colors.textSecondary }]}>{po.notes}</Text>
            </Card>
          ) : null}

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Order Items</Text>
            {po.items.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No items in this purchase order.</Text>
            ) : (
              <View style={styles.itemsList}>
                {po.items.map((item: PurchaseOrderItem) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemLeft}>
                      <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={2}>{item.product_name}</Text>
                      <Text style={[styles.itemDetail, { color: colors.textMuted }]}>
                        {item.quantity} × {formatCurrency(item.unit_cost, po.currency)}
                      </Text>
                      {item.received_quantity > 0 && item.received_quantity < item.quantity ? (
                        <Text style={[styles.itemDetail, { color: colors.warning }]}>
                          Received: {item.received_quantity}/{item.quantity}
                        </Text>
                      ) : item.received_quantity >= item.quantity && item.quantity > 0 ? (
                        <Text style={[styles.itemDetail, { color: colors.success }]}>Fully received</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.itemTotal, { color: colors.textPrimary }]}>
                      {formatCurrency(item.line_total, po.currency)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Summary</Text>
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Subtotal</Text>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatCurrency(po.subtotal, po.currency)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Tax</Text>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatCurrency(po.tax_total, po.currency)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Shipping</Text>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatCurrency(po.shipping_total, po.currency)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                <Text style={[styles.summaryTotalLabel, { color: colors.textPrimary }]}>Grand Total</Text>
                <Text style={[styles.summaryTotalValue, { color: colors.gold }]}>{formatCurrency(po.grand_total, po.currency)}</Text>
              </View>
            </View>
          </Card>
        </ScrollView>
      </ScreenWrapper>
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, gap: 2 },
  poNumber: { fontSize: 20, fontWeight: '700', fontFamily: 'monospace', lineHeight: 26 },
  supplierName: { fontSize: 14 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoContainer: { gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '500', maxWidth: 180, textAlign: 'right' },
  notesText: { fontSize: 14, lineHeight: 20 },
  emptyText: { fontSize: 14, fontStyle: 'italic' },
  itemsList: { gap: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.05)' },
  itemLeft: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: '600' },
  itemDetail: { fontSize: 12 },
  itemTotal: { fontSize: 14, fontWeight: '700' },
  summaryContainer: { gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '500' },
  summaryTotalRow: { paddingTop: 8, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  summaryTotalLabel: { fontSize: 16, fontWeight: '700' },
  summaryTotalValue: { fontSize: 18, fontWeight: '700' },
});
