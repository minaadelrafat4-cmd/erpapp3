import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { ScreenWrapper } from '@components/ScreenWrapper';
import { AppHeader } from '@components/AppHeader';
import { ErrorState } from '@components/ErrorState';
import { EmptyState } from '@components/EmptyState';
import { RoleGate } from '@components/RoleGate';
import { useThemeStore } from '@store/themeStore';
import { useSalesOrders } from '@hooks/useERP';
import { useResponsive, getCardWidth } from '@hooks/useResponsive';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
import { navMinRank } from '@constants';
import type { SalesOrderListItem } from '@apptypes/erp';
import type { ThemeColors } from '@apptypes';

const DEBOUNCE_MS = 300;
const STATUS_OPTIONS = ['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

function StatusBadge({ status, colors }: { status: string; colors: ThemeColors }) {
  const colorMap: Record<string, string> = {
    pending: colors.textMuted,
    processing: colors.accent,
    shipped: colors.gold,
    delivered: colors.success,
    cancelled: colors.error,
    refunded: colors.warning,
  };
  const color = colorMap[status] ?? colors.textSecondary;
  return (
    <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.statusText, { color }]}>{status}</Text>
    </View>
  );
}

export default function SalesOrdersScreen() {
  const { colors } = useThemeStore();
  const router = useRouter();
  const layout = useResponsive();

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const ordersQuery = useSalesOrders(debouncedSearch, statusFilter);

  const allOrders = useMemo(() => {
    return ordersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  }, [ordersQuery.data]);

  const cardWidth = getCardWidth(layout, layout.columns);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await ordersQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [ordersQuery]);

  const onLoadMore = useCallback(() => {
    if (ordersQuery.hasNextPage && !ordersQuery.isFetchingNextPage) {
      ordersQuery.fetchNextPage();
    }
  }, [ordersQuery]);

  const renderItem = ({ item }: { item: SalesOrderListItem }) => (
    <TouchableOpacity
      style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/(app)/sales-orders/[id]', params: { id: item.id } } as never)}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.orderNumber, { color: colors.gold }]} numberOfLines={1}>{item.order_number}</Text>
        <StatusBadge status={item.status} colors={colors} />
      </View>
      <Text style={[styles.customerName, { color: colors.textPrimary }]} numberOfLines={1}>{item.customer_name}</Text>
      <View style={styles.cardBottom}>
        <Text style={[styles.totalText, { color: colors.textPrimary }]}>
          {item.currency === 'USD' ? '$' : ''}{item.grand_total.toFixed(2)}
        </Text>
        <Text style={[styles.dateText, { color: colors.textMuted }]}>
          {new Date(item.placed_at).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.badgeRow}>
        <View style={[styles.miniBadge, { backgroundColor: colors.accent + '20' }]}>
          <Text style={[styles.miniBadgeText, { color: colors.accent }]}>{item.payment_status}</Text>
        </View>
        <View style={[styles.miniBadge, { backgroundColor: colors.gold + '20' }]}>
          <Text style={[styles.miniBadgeText, { color: colors.gold }]}>{item.fulfillment_status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const showLoading = ordersQuery.isLoading && !refreshing;
  const showError = ordersQuery.isError && !refreshing;

  return (
    <RoleGate minRank={navMinRank('sales-orders')}>
      <ScreenWrapper>
        <AppHeader title="Sales Orders" subtitle="Customer orders" showBack showMenu />
        <View style={[styles.content, { paddingHorizontal: layout.padding, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}>
          <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search by order number…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: statusFilter === opt ? colors.gold : colors.surface,
                    borderColor: statusFilter === opt ? colors.gold : colors.border,
                  },
                ]}
                onPress={() => setStatusFilter(opt)}
              >
                <Text style={[styles.filterText, { color: statusFilter === opt ? '#0c0f13' : colors.textSecondary }]}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {showLoading && (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading sales orders…</Text>
            </View>
          )}

          {showError && (
            <View style={styles.centerState}>
              <ErrorState
                title="Failed to load sales orders"
                message="We couldn't load the sales order list."
                onRetry={() => ordersQuery.refetch()}
              />
            </View>
          )}

          {!showLoading && !showError && (
            <FlatList
              data={allOrders}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              numColumns={layout.columns}
              key={layout.columns}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
              onEndReached={onLoadMore}
              onEndReachedThreshold={0.5}
              ListEmptyComponent={
                <View style={styles.centerState}>
                  <EmptyState
                    icon="sales-orders"
                    title="No Sales Orders"
                    message={debouncedSearch || statusFilter !== 'all' ? 'No sales orders match your filters.' : 'No sales orders have been placed yet.'}
                  />
                </View>
              }
              ListFooterComponent={
                ordersQuery.isFetchingNextPage ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color={colors.gold} />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </ScreenWrapper>
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },
  filterScroll: { marginBottom: 12, maxHeight: 40 },
  filterContent: { gap: 8, paddingHorizontal: 2 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  list: { gap: 12, paddingBottom: 24 },
  orderCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 15, fontWeight: '700', fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  customerName: { fontSize: 14, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalText: { fontSize: 14, fontWeight: '700' },
  dateText: { fontSize: 12 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  miniBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  centerState: { flex: 1, minHeight: 300, justifyContent: 'center' },
  loadingText: { fontSize: 14, marginTop: 12, textAlign: 'center' },
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
});
