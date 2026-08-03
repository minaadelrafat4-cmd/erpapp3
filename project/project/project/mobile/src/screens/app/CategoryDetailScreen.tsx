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
import { useCategoryDetail } from '@hooks/useERP';
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

export default function CategoryDetailScreen() {
  const { colors } = useThemeStore();
  const params = useLocalSearchParams<{ id: string }>();
  const layout = useResponsive();

  const categoryId = params.id;
  const categoryQuery = useCategoryDetail(categoryId);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await categoryQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [categoryQuery]);

  if (categoryQuery.isLoading) {
    return (
      <RoleGate minRank={navMinRank('categories')}>
        <ScreenWrapper>
          <AppHeader title="Category Details" showBack showMenu />
          <LoadingState message="Loading category…" />
        </ScreenWrapper>
      </RoleGate>
    );
  }

  if (categoryQuery.isError || !categoryQuery.data) {
    return (
      <RoleGate minRank={navMinRank('categories')}>
        <ScreenWrapper>
          <AppHeader title="Category Details" showBack showMenu />
          <ErrorState
            title="Category not found"
            message="This category may have been removed or is unavailable."
            onRetry={() => categoryQuery.refetch()}
          />
        </ScreenWrapper>
      </RoleGate>
    );
  }

  const category = categoryQuery.data;

  return (
    <RoleGate minRank={navMinRank('categories')}>
      <ScreenWrapper>
        <AppHeader title="Category Details" showBack showMenu />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
        >
          <Card>
            <View style={styles.headerRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
                <MaterialCommunityIcons name={getIconName('categories')} size={40} color={colors.gold} />
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.categoryName, { color: colors.textPrimary }]}>{category.name}</Text>
                <Text style={[styles.categorySlug, { color: colors.textMuted }]}>/{category.slug}</Text>
              </View>
            </View>
            {category.description && (
              <Text style={[styles.description, { color: colors.textSecondary }]}>{category.description}</Text>
            )}
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Category Information</Text>
            <View style={styles.infoContainer}>
              <InfoRow label="Name" value={category.name} icon="tag" colors={colors} />
              <InfoRow label="Slug" value={category.slug} icon="categories" colors={colors} />
              <InfoRow label="Featured" value={category.is_featured ? 'Yes' : 'No'} icon="star" colors={colors} />
              <InfoRow label="Sort Order" value={String(category.sort_order)} icon="sort" colors={colors} />
              {category.parent_id && (
                <InfoRow label="Parent Category" value={category.parent_id} icon="folder" colors={colors} />
              )}
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Product Count</Text>
            <View style={styles.countGrid}>
              <View style={[styles.countItem, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.countItemLabel, { color: colors.textMuted }]}>Total Products</Text>
                <Text style={[styles.countItemValue, { color: colors.gold }]}>{category.product_count}</Text>
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
  categoryName: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  categorySlug: { fontSize: 13 },
  description: { fontSize: 14, lineHeight: 22, marginTop: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoContainer: { gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '500', maxWidth: 180, textAlign: 'right' },
  countGrid: { gap: 10 },
  countItem: { borderRadius: 10, padding: 16, alignItems: 'center', gap: 4 },
  countItemLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  countItemValue: { fontSize: 28, fontWeight: '700' },
});
