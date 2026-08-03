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
import { useSupplierDetail } from '@hooks/useERP';
import { useResponsive } from '@hooks/useResponsive';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
import { navMinRank } from '@constants';
import type { IconName, ThemeColors } from '@apptypes';
import type { PurchaseOrderSummary } from '@apptypes/erp';

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

export default function SupplierDetailScreen() {
  const { colors } = useThemeStore();
  const params = useLocalSearchParams<{ id: string }>();
  const layout = useResponsive();

  const supplierId = params.id;
  const supplierQuery = useSupplierDetail(supplierId);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await supplierQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [supplierQuery]);

  if (supplierQuery.isLoading) {
    return (
      <RoleGate minRank={navMinRank('suppliers')}>
        <ScreenWrapper>
          <AppHeader title="Supplier Details" showBack showMenu />
          <LoadingState message="Loading supplier…" />
        </ScreenWrapper>
      </RoleGate>
    );
  }

  if (supplierQuery.isError || !supplierQuery.data) {
    return (
      <RoleGate minRank={navMinRank('suppliers')}>
        <ScreenWrapper>
          <AppHeader title="Supplier Details" showBack showMenu />
          <ErrorState
            title="Supplier not found"
            message="This supplier may have been removed or is unavailable."
            onRetry={() => supplierQuery.refetch()}
          />
        </ScreenWrapper>
      </RoleGate>
    );
  }

  const supplier = supplierQuery.data;

  return (
    <RoleGate minRank={navMinRank('suppliers')}>
      <ScreenWrapper>
        <AppHeader title="Supplier Details" showBack showMenu />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
        >
          <Card>
            <View style={styles.headerRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
                <MaterialCommunityIcons name={getIconName('truck')} size={36} color={colors.gold} />
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.supplierName, { color: colors.textPrimary }]}>{supplier.name}</Text>
                {supplier.contact_name ? (
                  <Text style={[styles.supplierContact, { color: colors.textMuted }]}>Contact: {supplier.contact_name}</Text>
                ) : null}
                <View style={[styles.statusBadge, { backgroundColor: supplier.is_active ? colors.success + '20' : colors.error + '20' }]}>
                  <Text style={[styles.statusText, { color: supplier.is_active ? colors.success : colors.error }]}>
                    {supplier.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Contact Information</Text>
            <View style={styles.infoContainer}>
              <InfoRow label="Email" value={supplier.email ?? '—'} icon="mail" colors={colors} />
              <InfoRow label="Phone" value={supplier.phone ?? '—'} icon="phone" colors={colors} />
              <InfoRow label="Address" value={supplier.address ?? '—'} icon="map-pin" colors={colors} />
              <InfoRow label="City" value={supplier.city ?? '—'} icon="map-pin" colors={colors} />
              <InfoRow label="Country" value={supplier.country ?? '—'} icon="globe" colors={colors} />
              <InfoRow label="Payment Terms" value={supplier.payment_terms ?? '—'} icon="dollar" colors={colors} />
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Purchase Orders</Text>
            {supplier.purchase_orders.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No purchase orders linked to this supplier.</Text>
            ) : (
              <View style={styles.poList}>
                {supplier.purchase_orders.map((po: PurchaseOrderSummary) => (
                  <View key={po.id} style={styles.poItem}>
                    <View style={styles.poLeft}>
                      <Text style={[styles.poNumber, { color: colors.gold }]}>{po.po_number}</Text>
                      <Text style={[styles.poDate, { color: colors.textMuted }]}>
                        {new Date(po.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.poRight}>
                      <Text style={[styles.poTotal, { color: colors.textPrimary }]}>
                        {po.currency === 'USD' ? '$' : ''}{po.grand_total.toFixed(2)}
                      </Text>
                      <Text style={[styles.poStatus, { color: colors.textSecondary }]}>{po.status}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
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
  supplierName: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  supplierContact: { fontSize: 13 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoContainer: { gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '500', maxWidth: 180, textAlign: 'right' },
  emptyText: { fontSize: 14, fontStyle: 'italic' },
  poList: { gap: 10 },
  poItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.05)' },
  poLeft: { flex: 1, gap: 2 },
  poNumber: { fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },
  poDate: { fontSize: 12 },
  poRight: { alignItems: 'flex-end', gap: 2 },
  poTotal: { fontSize: 14, fontWeight: '700' },
  poStatus: { fontSize: 11, textTransform: 'capitalize' },
});
