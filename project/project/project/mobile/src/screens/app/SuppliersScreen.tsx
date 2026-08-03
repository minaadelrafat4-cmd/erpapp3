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
import { useSuppliers } from '@hooks/useERP';
import { useResponsive, getCardWidth } from '@hooks/useResponsive';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
import { navMinRank } from '@constants';
import type { SupplierListItem } from '@apptypes/erp';

const DEBOUNCE_MS = 300;

export default function SuppliersScreen() {
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

  const suppliersQuery = useSuppliers(debouncedSearch);

  const allSuppliers = useMemo(() => {
    return suppliersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  }, [suppliersQuery.data]);

  const cardWidth = getCardWidth(layout, layout.columns);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await suppliersQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [suppliersQuery]);

  const onLoadMore = useCallback(() => {
    if (suppliersQuery.hasNextPage && !suppliersQuery.isFetchingNextPage) {
      suppliersQuery.fetchNextPage();
    }
  }, [suppliersQuery]);

  const renderItem = ({ item }: { item: SupplierListItem }) => {
    return (
      <TouchableOpacity
        style={[styles.supplierCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/(app)/suppliers/[id]', params: { id: item.id } } as never)}
      >
        <View style={[styles.supplierIconBox, { backgroundColor: colors.surfaceElevated }]}>
          <MaterialCommunityIcons name={getIconName('truck')} size={28} color={colors.gold} />
        </View>
        <View style={styles.supplierInfo}>
          <Text style={[styles.supplierName, { color: colors.textPrimary }]} numberOfLines={2}>{item.name}</Text>
          {item.contact_name ? (
            <Text style={[styles.supplierContact, { color: colors.textMuted }]} numberOfLines={1}>{item.contact_name}</Text>
          ) : null}
          {item.country ? (
            <Text style={[styles.supplierLocation, { color: colors.textSecondary }]} numberOfLines={1}>{item.country}</Text>
          ) : null}
          {item.payment_terms ? (
            <View style={[styles.termsBadge, { backgroundColor: colors.gold + '20' }]}>
              <Text style={[styles.termsText, { color: colors.gold }]}>{item.payment_terms}</Text>
            </View>
          ) : null}
        </View>
        <MaterialCommunityIcons name={getIconName('chevron-right')} size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const showLoading = suppliersQuery.isLoading && !refreshing;
  const showError = suppliersQuery.isError && !refreshing;

  return (
    <RoleGate minRank={navMinRank('suppliers')}>
      <ScreenWrapper>
        <AppHeader title="Suppliers" subtitle="Vendor management" showBack showMenu />
        <View style={[styles.content, { paddingHorizontal: layout.padding, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}>
          <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search by name or contact…"
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
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading suppliers…</Text>
            </View>
          )}

          {showError && (
            <View style={styles.centerState}>
              <ErrorState
                title="Failed to load suppliers"
                message="We couldn't load the supplier list."
                onRetry={() => suppliersQuery.refetch()}
              />
            </View>
          )}

          {!showLoading && !showError && (
            <FlatList
              data={allSuppliers}
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
                    icon="suppliers"
                    title="No Suppliers Found"
                    message={debouncedSearch ? `No suppliers match "${debouncedSearch}".` : 'No suppliers have been set up yet.'}
                  />
                </View>
              }
              ListFooterComponent={
                suppliersQuery.isFetchingNextPage ? (
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
  supplierCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  supplierIconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  supplierInfo: { flex: 1, gap: 3 },
  supplierName: { fontSize: 15, fontWeight: '600', lineHeight: 19 },
  supplierContact: { fontSize: 12 },
  supplierLocation: { fontSize: 12 },
  termsBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  termsText: { fontSize: 11, fontWeight: '600' },
  centerState: { flex: 1, minHeight: 300, justifyContent: 'center' },
  loadingText: { fontSize: 14, marginTop: 12, textAlign: 'center' },
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
});
