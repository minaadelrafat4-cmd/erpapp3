import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { ScreenWrapper } from '@components/ScreenWrapper';
import { AppHeader } from '@components/AppHeader';
import { Card } from '@components/Card';
import { ErrorState } from '@components/ErrorState';
import { LoadingState } from '@components/LoadingState';
import { EmptyState } from '@components/EmptyState';
import { useThemeStore } from '@store/themeStore';
import { useAuthStore } from '@store/authStore';
import { usePermissions } from '@hooks/usePermissions';
import { useResponsive, getCardWidth } from '@hooks/useResponsive';
import { useDashboardSummary, useRecentNotifications } from '@hooks/useERP';
import { roleLabel } from '@constants';
import { getAccessibleNavItems } from '@config/navigation';
import { ROLE_QUICK_ACTIONS } from '@constants';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
import type { IconName } from '@apptypes';
import type { DashboardSummary, ERPNotification } from '@apptypes/erp';
import { useQueryClient } from '@tanstack/react-query';
import { roleRank } from '@apptypes';

interface KpiCardConfig {
  label: string;
  value: number;
  icon: IconName;
  colorKey: 'gold' | 'warning' | 'error' | 'accent' | 'success';
  permission: string;
  minRank: number;
}

const KPI_CARDS: KpiCardConfig[] = [
  { label: 'Total Products', value: 0, icon: 'package', colorKey: 'gold', permission: 'products.view', minRank: 40 },
  { label: 'Low Stock', value: 0, icon: 'alert', colorKey: 'warning', permission: 'inventory.view', minRank: 40 },
  { label: 'Out of Stock', value: 0, icon: 'box', colorKey: 'error', permission: 'inventory.view', minRank: 40 },
  { label: 'Branches', value: 0, icon: 'building', colorKey: 'accent', permission: 'branches.view', minRank: 60 },
  { label: 'Warehouses', value: 0, icon: 'warehouse', colorKey: 'success', permission: 'warehouses.view', minRank: 60 },
];

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function DashboardScreen() {
  const { colors } = useThemeStore();
  const profile = useAuthStore((s) => s.profile);
  const { canEdit, canView } = usePermissions();
  const router = useRouter();
  const layout = useResponsive();
  const queryClient = useQueryClient();

  const summaryQuery = useDashboardSummary();
  const notificationsQuery = useRecentNotifications(profile?.id, 5);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['erp', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['erp', 'notifications'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  if (!profile) return null;

  const accessLevel = canEdit('dashboard.view') ? 'Full Access' : 'View Only';
  const quickActionKeys = ROLE_QUICK_ACTIONS[profile.role] ?? ['dashboard', 'notifications', 'help'];
  const accessibleItems = getAccessibleNavItems(profile.role);
  const quickActions = quickActionKeys
    .map((key) => accessibleItems.find((item) => item.key === key))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);
  const cardWidth = getCardWidth(layout, layout.columns);

  const summary: DashboardSummary | undefined = summaryQuery.data;
  const notifications = notificationsQuery.data ?? [];

  const kpiValues: Record<string, number> = summary
    ? {
        'Total Products': summary.total_products,
        'Low Stock': summary.low_stock_count,
        'Out of Stock': summary.out_of_stock_count,
        'Branches': summary.total_branches,
        'Warehouses': summary.total_warehouses,
      }
    : {};

  const visibleKpis = KPI_CARDS.filter((kpi) => canView(kpi.permission) || roleRank(profile.role) >= kpi.minRank);

  return (
    <ScreenWrapper>
      <AppHeader title="Dashboard" subtitle="Business overview" showMenu />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
      >
        {/* Welcome Card */}
        <Card>
          <Text style={[styles.welcome, { color: colors.textSecondary }]}>Welcome back,</Text>
          <Text style={[styles.email, { color: colors.textPrimary }]}>{profile.full_name || profile.email}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.roleBadge, { backgroundColor: colors.gold + '20' }]}>
              <Text style={[styles.roleText, { color: colors.gold }]}>{roleLabel(profile.role)}</Text>
            </View>
            <Text style={[styles.accessLevel, { color: colors.textMuted }]}>{accessLevel}</Text>
          </View>
        </Card>

        {/* KPI Cards */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Overview</Text>
          {summaryQuery.isLoading && <LoadingState message="Loading dashboard…" inline />}
          {summaryQuery.isError && (
            <ErrorState
              title="Failed to load dashboard"
              message="We couldn't load your business data."
              onRetry={() => summaryQuery.refetch()}
            />
          )}
          {summaryQuery.isSuccess && (
            <View style={styles.kpiGrid}>
              {visibleKpis.map((kpi) => (
                <TouchableOpacity
                  key={kpi.label}
                  style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (kpi.label === 'Total Products') router.push('/(app)/products' as never);
                    else if (kpi.label === 'Low Stock' || kpi.label === 'Out of Stock') router.push('/(app)/(tabs)/inventory' as never);
                    else if (kpi.label === 'Branches') router.push('/(app)/branches' as never);
                    else if (kpi.label === 'Warehouses') router.push('/(app)/warehouses' as never);
                  }}
                >
                  <View style={[styles.kpiIconBox, { backgroundColor: colors[kpi.colorKey] + '20' }]}>
                    <MaterialCommunityIcons name={getIconName(kpi.icon)} size={22} color={colors[kpi.colorKey]} />
                  </View>
                  <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{kpiValues[kpi.label] ?? 0}</Text>
                  <Text style={[styles.kpiLabel, { color: colors.textSecondary }]} numberOfLines={1}>{kpi.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {quickActions.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
                onPress={() => router.push(`/(app)/${item.key}` as never)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name={getIconName(item.icon)} size={28} color={colors.gold} />
                <Text style={[styles.quickLabel, { color: colors.textPrimary }]} numberOfLines={1}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Recent Notifications</Text>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/(app)/notifications' as never)}>
                <Text style={[styles.seeAll, { color: colors.gold }]}>See All</Text>
              </TouchableOpacity>
            )}
          </View>
          {notificationsQuery.isLoading && <LoadingState message="Loading notifications…" inline />}
          {notificationsQuery.isError && (
            <ErrorState
              title="Failed to load notifications"
              message="We couldn't load your recent alerts."
              onRetry={() => notificationsQuery.refetch()}
            />
          )}
          {notificationsQuery.isSuccess && notifications.length === 0 && (
            <Card>
              <EmptyState icon="bell" title="No Notifications" message="You're all caught up." />
            </Card>
          )}
          {notificationsQuery.isSuccess && notifications.length > 0 && (
            <View style={styles.notificationList}>
              {notifications.map((notif: ERPNotification) => (
                <TouchableOpacity
                  key={notif.id}
                  style={[styles.notificationItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.notifDot, { backgroundColor: notif.is_read ? colors.border : colors.gold }]} />
                  <View style={styles.notifContent}>
                    <Text style={[styles.notifTitle, { color: colors.textPrimary }]} numberOfLines={1}>{notif.title}</Text>
                    <Text style={[styles.notifMessage, { color: colors.textSecondary }]} numberOfLines={2}>{notif.message}</Text>
                    <Text style={[styles.notifTime, { color: colors.textMuted }]}>{formatRelativeTime(notif.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },
  welcome: { fontSize: 14 },
  email: { fontSize: 18, fontWeight: '600', marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 12, fontWeight: '600' },
  accessLevel: { fontSize: 12 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  seeAll: { fontSize: 13, fontWeight: '600' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8, alignItems: 'flex-start' },
  kpiIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 28, fontWeight: '700' },
  kpiLabel: { fontSize: 13, fontWeight: '500' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8, alignItems: 'flex-start' },
  quickLabel: { fontSize: 13, fontWeight: '500' },
  notificationList: { gap: 8 },
  notificationItem: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 14, gap: 12 },
  notifDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  notifContent: { flex: 1, gap: 2 },
  notifTitle: { fontSize: 14, fontWeight: '600' },
  notifMessage: { fontSize: 13, lineHeight: 18 },
  notifTime: { fontSize: 11, marginTop: 2 },
});
