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
import { useBranches } from '@hooks/useERP';
import { useResponsive, getCardWidth } from '@hooks/useResponsive';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
import { navMinRank } from '@constants';
import type { Branch } from '@apptypes/erp';

const DEBOUNCE_MS = 300;

export default function BranchesScreen() {
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

  const branchesQuery = useBranches();

  const filteredBranches = useMemo(() => {
    const all = branchesQuery.data ?? [];
    if (!debouncedSearch.trim()) return all;
    const q = debouncedSearch.toLowerCase();
    return all.filter(
      (b: Branch) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q) || b.city.toLowerCase().includes(q),
    );
  }, [branchesQuery.data, debouncedSearch]);

  const cardWidth = getCardWidth(layout, layout.columns);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await branchesQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [branchesQuery]);

  const renderItem = ({ item }: { item: Branch }) => (
    <TouchableOpacity
      style={[styles.branchCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/(app)/branches/[id]', params: { id: item.id } } as never)}
    >
      <View style={[styles.branchIconBox, { backgroundColor: colors.surfaceElevated }]}>
        <MaterialCommunityIcons name={getIconName('store')} size={32} color={colors.gold} />
      </View>
      <View style={styles.branchInfo}>
        <Text style={[styles.branchName, { color: colors.textPrimary }]} numberOfLines={2}>{item.name}</Text>
        <Text style={[styles.branchCode, { color: colors.textMuted }]}>Code: {item.code}</Text>
        <Text style={[styles.branchLocation, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.city}{item.state ? `, ${item.state}` : ''}
        </Text>
        {item.manager && (
          <Text style={[styles.branchManager, { color: colors.textMuted }]} numberOfLines={1}>Manager: {item.manager}</Text>
        )}
      </View>
      <MaterialCommunityIcons name={getIconName('chevron-right')} size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const showLoading = branchesQuery.isLoading && !refreshing;
  const showError = branchesQuery.isError && !refreshing;

  return (
    <RoleGate minRank={navMinRank('branches')}>
      <ScreenWrapper>
        <AppHeader title="Branches" subtitle="Branch locations" showBack showMenu />
        <View style={[styles.content, { paddingHorizontal: layout.padding, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}>
          <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search branches…"
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
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading branches…</Text>
            </View>
          )}

          {showError && (
            <View style={styles.centerState}>
              <ErrorState
                title="Failed to load branches"
                message="We couldn't load the branch list."
                onRetry={() => branchesQuery.refetch()}
              />
            </View>
          )}

          {!showLoading && !showError && (
            <FlatList
              data={filteredBranches}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              numColumns={layout.columns}
              key={layout.columns}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
              ListEmptyComponent={
                <View style={styles.centerState}>
                  <EmptyState
                    icon="branches"
                    title="No Branches Found"
                    message={debouncedSearch ? `No branches match "${debouncedSearch}".` : 'No branches have been set up yet.'}
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
  branchCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  branchIconBox: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  branchInfo: { flex: 1, gap: 3 },
  branchName: { fontSize: 15, fontWeight: '600', lineHeight: 19 },
  branchCode: { fontSize: 12 },
  branchLocation: { fontSize: 12 },
  branchManager: { fontSize: 11 },
  centerState: { flex: 1, minHeight: 300, justifyContent: 'center' },
  loadingText: { fontSize: 14, marginTop: 12, textAlign: 'center' },
});
