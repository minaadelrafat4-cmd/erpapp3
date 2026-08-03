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
import { useBranchDetail } from '@hooks/useERP';
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

export default function BranchDetailScreen() {
  const { colors } = useThemeStore();
  const params = useLocalSearchParams<{ id: string }>();
  const layout = useResponsive();

  const branchId = params.id;
  const branchQuery = useBranchDetail(branchId);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await branchQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [branchQuery]);

  if (branchQuery.isLoading) {
    return (
      <RoleGate minRank={navMinRank('branches')}>
        <ScreenWrapper>
          <AppHeader title="Branch Details" showBack showMenu />
          <LoadingState message="Loading branch…" />
        </ScreenWrapper>
      </RoleGate>
    );
  }

  if (branchQuery.isError || !branchQuery.data) {
    return (
      <RoleGate minRank={navMinRank('branches')}>
        <ScreenWrapper>
          <AppHeader title="Branch Details" showBack showMenu />
          <ErrorState
            title="Branch not found"
            message="This branch may have been removed or is unavailable."
            onRetry={() => branchQuery.refetch()}
          />
        </ScreenWrapper>
      </RoleGate>
    );
  }

  const branch = branchQuery.data;

  return (
    <RoleGate minRank={navMinRank('branches')}>
      <ScreenWrapper>
        <AppHeader title="Branch Details" showBack showMenu />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
        >
          <Card>
            <View style={styles.headerRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
                <MaterialCommunityIcons name={getIconName('store')} size={40} color={colors.gold} />
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.branchName, { color: colors.textPrimary }]}>{branch.name}</Text>
                <Text style={[styles.branchCode, { color: colors.textMuted }]}>Code: {branch.code}</Text>
              </View>
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Contact Information</Text>
            <View style={styles.infoContainer}>
              <InfoRow label="Address" value={branch.address} icon="map-pin" colors={colors} />
              <InfoRow label="City" value={branch.city} icon="map-pin" colors={colors} />
              {branch.state && <InfoRow label="State" value={branch.state} icon="map-pin" colors={colors} />}
              {branch.postal_code && <InfoRow label="Postal Code" value={branch.postal_code} icon="map-pin" colors={colors} />}
              <InfoRow label="Country" value={branch.country} icon="globe" colors={colors} />
              {branch.phone && <InfoRow label="Phone" value={branch.phone} icon="phone" colors={colors} />}
              {branch.email && <InfoRow label="Email" value={branch.email} icon="mail" colors={colors} />}
              {branch.manager && <InfoRow label="Manager" value={branch.manager} icon="user" colors={colors} />}
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Assigned Warehouse</Text>
            <View style={styles.infoContainer}>
              <InfoRow
                label="Warehouse"
                value={branch.warehouse_name ?? 'Not assigned'}
                icon="warehouse"
                colors={colors}
              />
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Inventory Overview</Text>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryItem, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>Products</Text>
                <Text style={[styles.summaryItemValue, { color: colors.textPrimary }]}>{branch.product_count}</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>Total Stock</Text>
                <Text style={[styles.summaryItemValue, { color: colors.gold }]}>{branch.total_stock}</Text>
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
  iconBox: { width: 60, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, gap: 2 },
  branchName: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  branchCode: { fontSize: 13 },
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
});
