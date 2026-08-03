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
import { useWarehouses } from '@hooks/useERP';
import { useResponsive, getCardWidth } from '@hooks/useResponsive';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
import { navMinRank } from '@constants';
import type { Warehouse } from '@apptypes/erp';

const DEBOUNCE_MS = 300;

export default function WarehousesScreen() {
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

  const warehousesQuery = useWarehouses();

  const filteredWarehouses = useMemo(() => {
    const all = warehousesQuery.data ?? [];
    if (!debouncedSearch.trim()) return all;
    const q = debouncedSearch.toLowerCase();
    return all.filter(
      (w: Warehouse) => w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q) || w.city.toLowerCase().includes(q),
    );
  }, [warehousesQuery.data, debouncedSearch]);

  const cardWidth = getCardWidth(layout, layout.columns);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await warehousesQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [warehousesQuery]);

  const renderItem = ({ item }: { item: Warehouse }) => (
    <TouchableOpacity
      style={[styles.whCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/(app)/warehouses/[id]', params: { id: item.id } } as never)}
    >
      <View style={[styles.whIconBox, { backgroundColor: colors.surfaceElevated }]}>
        <MaterialCommunityIcons name={getIconName('warehouse')} size={32} color={colors.gold} />
      </View>
      <View style={styles.whInfo}>
        <Text style={[styles.whName, { color: colors.textPrimary }]} numberOfLines={2}>{item.name}</Text>
        <Text style={[styles.whCode, { color: colors.textMuted }]}>Code: {item.code}</Text>
        <Text style={[styles.whLocation, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.city}{item.state ? `, ${item.state}` : ''}
        </Text>
        {item.capacity != null && (
          <View style={[styles.capacityBadge, { backgroundColor: colors.gold + '20' }]}>
            <Text style={[styles.capacityText, { color: colors.gold }]}>Capacity: {item.capacity}</Text>
          </View>
        )}
      </View>
      <MaterialCommunityIcons name={getIconName('chevron-right')} size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const showLoading = warehousesQuery.isLoading && !refreshing;
  const showError = warehousesQuery.isError && !refreshing;

  return (
    <RoleGate minRank={navMinRank('warehouses')}>
      <ScreenWrapper>
        <AppHeader title="Warehouses" subtitle="Warehouse locations" showBack showMenu />
        <View style={[styles.content, { paddingHorizontal: layout.padding, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}>
          <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search warehouses…"
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
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading warehouses…</Text>
            </View>
          )}

          {showError && (
            <View style={styles.centerState}>
              <ErrorState
                title="Failed to load warehouses"
                message="We couldn't load the warehouse list."
                onRetry={() => warehousesQuery.refetch()}
              />
            </View>
          )}

          {!showLoading && !showError && (
            <FlatList
              data={filteredWarehouses}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              numColumns={layout.columns}
              key={layout.columns}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
              ListEmptyComponent={
                <View style={styles.centerState}>
                  <EmptyState
                    icon="warehouses"
                    title="No Warehouses Found"
                    message={debouncedSearch ? `No warehouses match "${debouncedSearch}".` : 'No warehouses have been set up yet.'}
                  />
                </View>
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
  whCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  whIconBox: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  whInfo: { flex: 1, gap: 3 },
  whName: { fontSize: 15, fontWeight: '600', lineHeight: 19 },
  whCode: { fontSize: 12 },
  whLocation: { fontSize: 12 },
  capacityBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  capacityText: { fontSize: 11, fontWeight: '600' },
  centerState: { flex: 1, minHeight: 300, justifyContent: 'center' },
  loadingText: { fontSize: 14, marginTop: 12, textAlign: 'center' },
});
