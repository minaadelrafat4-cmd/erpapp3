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
} from 'react-native';
import { ScreenWrapper } from '@components/ScreenWrapper';
import { AppHeader } from '@components/AppHeader';
import { ErrorState } from '@components/ErrorState';
import { EmptyState } from '@components/EmptyState';
import { RoleGate } from '@components/RoleGate';
import { useThemeStore } from '@store/themeStore';
import { useCustomers } from '@hooks/useERP';
import { useResponsive, getCardWidth } from '@hooks/useResponsive';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
import { navMinRank } from '@constants';
import type { CustomerListItem } from '@apptypes/erp';

const DEBOUNCE_MS = 300;

export default function CustomersScreen() {
  const { colors } = useThemeStore();
  const router = useRouter();
  const layout = useResponsive();

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const customersQuery = useCustomers(debouncedSearch);

  const allCustomers = useMemo(() => {
    return customersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  }, [customersQuery.data]);

  const cardWidth = getCardWidth(layout, layout.columns);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await customersQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [customersQuery]);

  const onLoadMore = useCallback(() => {
    if (customersQuery.hasNextPage && !customersQuery.isFetchingNextPage) {
      customersQuery.fetchNextPage();
    }
  }, [customersQuery]);

  const renderItem = ({ item }: { item: CustomerListItem }) => {
    const fullName = [item.first_name, item.last_name].filter(Boolean).join(' ').trim() || 'Unknown';
    const initials = (item.first_name ?? item.email ?? 'U').charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        style={[styles.customerCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/(app)/customers/[id]', params: { id: item.id } } as never)}
      >
        <View style={[styles.customerAvatar, { backgroundColor: colors.gold }]}>
          <Text style={styles.customerAvatarText}>{initials}</Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={[styles.customerName, { color: colors.textPrimary }]} numberOfLines={1}>{fullName}</Text>
          {item.email ? (
            <Text style={[styles.customerEmail, { color: colors.textMuted }]} numberOfLines={1}>{item.email}</Text>
          ) : null}
          <View style={styles.customerStats}>
            <View style={[styles.statBadge, { backgroundColor: colors.gold + '20' }]}>
              <Text style={[styles.statText, { color: colors.gold }]}>{item.loyalty_points} pts</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: colors.accent + '20' }]}>
              <Text style={[styles.statText, { color: colors.accent }]}>{item.order_count} orders</Text>
            </View>
          </View>
        </View>
        <MaterialCommunityIcons name={getIconName('chevron-right')} size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const showLoading = customersQuery.isLoading && !refreshing;
  const showError = customersQuery.isError && !refreshing;

  return (
    <RoleGate minRank={navMinRank('customers')}>
      <ScreenWrapper>
        <AppHeader title="Customers" subtitle="Customer accounts" showBack showMenu />
        <View style={[styles.content, { paddingHorizontal: layout.padding, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}>
          <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search by name or email…"
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

          {showLoading && (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading customers…</Text>
            </View>
          )}

          {showError && (
            <View style={styles.centerState}>
              <ErrorState
                title="Failed to load customers"
                message="We couldn't load the customer list."
                onRetry={() => customersQuery.refetch()}
              />
            </View>
          )}

          {!showLoading && !showError && (
            <FlatList
              data={allCustomers}
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
                    icon="customers"
                    title="No Customers Found"
                    message={debouncedSearch ? `No customers match "${debouncedSearch}".` : 'No customers have registered yet.'}
                  />
                </View>
              }
              ListFooterComponent={
                customersQuery.isFetchingNextPage ? (
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
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },
  list: { gap: 12, paddingBottom: 24 },
  customerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  customerAvatarText: { fontSize: 20, fontWeight: '800', color: '#0c0f13' },
  customerInfo: { flex: 1, gap: 3 },
  customerName: { fontSize: 15, fontWeight: '600', lineHeight: 19 },
  customerEmail: { fontSize: 12 },
  customerStats: { flexDirection: 'row', gap: 6, marginTop: 2 },
  statBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statText: { fontSize: 11, fontWeight: '600' },
  centerState: { flex: 1, minHeight: 300, justifyContent: 'center' },
  loadingText: { fontSize: 14, marginTop: 12, textAlign: 'center' },
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
});
