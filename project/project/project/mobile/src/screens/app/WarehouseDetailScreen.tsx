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
import { useWarehouseDetail } from '@hooks/useERP';
import { useResponsive } from '@hooks/useResponsive';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
import { navMinRank } from '@constants';
import type { IconName, ThemeColors } from '@apptypes';

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

export default function WarehouseDetailScreen() {
  const { colors } = useThemeStore();
  const params = useLocalSearchParams<{ id: string }>();
  const layout = useResponsive();

  const warehouseId = params.id;
  const warehouseQuery = useWarehouseDetail(warehouseId);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await warehouseQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [warehouseQuery]);

  if (warehouseQuery.isLoading) {
    return (
      <RoleGate minRank={navMinRank('warehouses')}>
        <ScreenWrapper>
          <AppHeader title="Warehouse Details" showBack showMenu />
          <LoadingState message="Loading warehouse…" />
        </ScreenWrapper>
      </RoleGate>
    );
  }

  if (warehouseQuery.isError || !warehouseQuery.data) {
    return (
      <RoleGate minRank={navMinRank('warehouses')}>
        <ScreenWrapper>
          <AppHeader title="Warehouse Details" showBack showMenu />
          <ErrorState
            title="Warehouse not found"
            message="This warehouse may have been removed or is unavailable."
            onRetry={() => warehouseQuery.refetch()}
          />
        </ScreenWrapper>
      </RoleGate>
    );
  }

  const wh = warehouseQuery.data;
  const utilColor = wh.utilization_pct >= 90 ? colors.error : wh.utilization_pct >= 70 ? colors.warning : colors.success;

  return (
    <RoleGate minRank={navMinRank('warehouses')}>
      <ScreenWrapper>
        <AppHeader title="Warehouse Details" showBack showMenu />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
        >
          <Card>
            <View style={styles.headerRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
                <MaterialCommunityIcons name={getIconName('warehouse')} size={40} color={colors.gold} />
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.whName, { color: colors.textPrimary }]}>{wh.name}</Text>
                <Text style={[styles.whCode, { color: colors.textMuted }]}>Code: {wh.code}</Text>
              </View>
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Warehouse Information</Text>
            <View style={styles.infoContainer}>
              <InfoRow label="Name" value={wh.name} icon="warehouse" colors={colors} />
              <InfoRow label="Code" value={wh.code} icon="tag" colors={colors} />
              <InfoRow label="City" value={wh.city} icon="map-pin" colors={colors} />
              {wh.state && <InfoRow label="State" value={wh.state} icon="map-pin" colors={colors} />}
              <InfoRow label="Country" value={wh.country} icon="globe" colors={colors} />
              {wh.manager && <InfoRow label="Manager" value={wh.manager} icon="user" colors={colors} />}
              {wh.phone && <InfoRow label="Phone" value={wh.phone} icon="phone" colors={colors} />}
              {wh.email && <InfoRow label="Email" value={wh.email} icon="mail" colors={colors} />}
              {wh.capacity != null && <InfoRow label="Capacity" value={String(wh.capacity)} icon="box" colors={colors} />}
              <InfoRow label="Active" value={wh.is_active ? 'Yes' : 'No'} icon="check" colors={colors} />
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Inventory Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryItem, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>Products</Text>
                <Text style={[styles.summaryItemValue, { color: colors.textPrimary }]}>{wh.product_count}</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>Total Units</Text>
                <Text style={[styles.summaryItemValue, { color: colors.textPrimary }]}>{wh.total_units}</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>Available</Text>
                <Text style={[styles.summaryItemValue, { color: colors.success }]}>{wh.total_available}</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>Low Stock</Text>
                <Text style={[styles.summaryItemValue, { color: wh.low_stock_count > 0 ? colors.warning : colors.textPrimary }]}>{wh.low_stock_count}</Text>
              </View>
            </View>

            {wh.capacity != null && wh.capacity > 0 && (
              <View style={styles.utilizationSection}>
                <View style={styles.utilHeader}>
                  <Text style={[styles.utilLabel, { color: colors.textSecondary }]}>Utilization</Text>
                  <Text style={[styles.utilPct, { color: utilColor }]}>{wh.utilization_pct}%</Text>
                </View>
                <View style={[styles.utilBarBg, { backgroundColor: colors.surfaceElevated }]}>
                  <View style={[styles.utilBarFill, { backgroundColor: utilColor, width: `${wh.utilization_pct}%` }]} />
                </View>
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
  iconBox: { width: 60, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, gap: 2 },
  whName: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  whCode: { fontSize: 13 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoContainer: { gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '500', maxWidth: 180, textAlign: 'right' },
  summaryGrid: { flexDirection: 'row', gap: 10 },
  summaryItem: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center', gap: 4 },
  summaryItemLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryItemValue: { fontSize: 22, fontWeight: '700' },
  utilizationSection: { marginTop: 16, gap: 8 },
  utilHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  utilLabel: { fontSize: 14 },
  utilPct: { fontSize: 16, fontWeight: '700' },
  utilBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  utilBarFill: { height: '100%', borderRadius: 4 },
});
