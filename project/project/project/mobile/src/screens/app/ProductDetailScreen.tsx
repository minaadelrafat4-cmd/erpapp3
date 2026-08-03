import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  TouchableOpacity,
  Share,
} from 'react-native';
import { ScreenWrapper } from '@components/ScreenWrapper';
import { AppHeader } from '@components/AppHeader';
import { Card } from '@components/Card';
import { ErrorState } from '@components/ErrorState';
import { LoadingState } from '@components/LoadingState';
import { useThemeStore } from '@store/themeStore';
import { useProduct } from '@hooks/useERP';
import { useResponsive } from '@hooks/useResponsive';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
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

export default function ProductDetailScreen() {
  const { colors } = useThemeStore();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const layout = useResponsive();

  const productId = params.id;
  const productQuery = useProduct(productId);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await productQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [productQuery]);

  if (productQuery.isLoading) {
    return (
      <ScreenWrapper>
        <AppHeader title="Product Details" showBack showMenu />
        <LoadingState message="Loading product…" />
      </ScreenWrapper>
    );
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <ScreenWrapper>
        <AppHeader title="Product Details" showBack showMenu />
        <ErrorState
          title="Product not found"
          message="This product may have been removed or is unavailable."
          onRetry={() => productQuery.refetch()}
        />
      </ScreenWrapper>
    );
  }

  const product = productQuery.data;
  const stockColor = product.stock <= 0 ? colors.error : product.stock <= product.low_stock_threshold ? colors.warning : colors.success;
  const stockLabel = product.stock <= 0 ? 'Out of Stock' : product.stock <= product.low_stock_threshold ? 'Low Stock' : 'In Stock';

  const handleShare = async () => {
    try {
      await Share.share({ message: `${product.name} — $${product.price.toFixed(2)} (SKU: ${product.sku ?? 'N/A'})` });
    } catch {
      // user cancelled share
    }
  };

  return (
    <ScreenWrapper>
      <AppHeader
        title="Product Details"
        showBack
        showMenu
        rightIcon="external-link"
        onRightPress={handleShare}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
      >
        {/* Product Image / Barcode */}
        <Card padding={0} elevated>
          <View style={[styles.imageContainer, { backgroundColor: colors.surfaceElevated }]}>
            {product.images.length > 0 ? (
              <Image source={{ uri: product.images[0]!.url }} style={styles.productImage} resizeMode="contain" />
            ) : (
              <View style={styles.placeholderImage}>
                <MaterialCommunityIcons name="package-variant-closed" size={64} color={colors.textMuted} />
              </View>
            )}
          </View>
        </Card>

        {/* Product Name & Price */}
        <Card>
          <Text style={[styles.productName, { color: colors.textPrimary }]}>{product.name}</Text>
          {product.short_description && (
            <Text style={[styles.shortDesc, { color: colors.textSecondary }]}>{product.short_description}</Text>
          )}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.gold }]}>${product.price.toFixed(2)}</Text>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <Text style={[styles.comparePrice, { color: colors.textMuted }]}>
                ${product.compare_at_price.toFixed(2)}
              </Text>
            )}
          </View>
          <View style={[styles.stockBadge, { backgroundColor: stockColor + '20' }]}>
            <Text style={[styles.stockText, { color: stockColor }]}>{stockLabel} · {product.stock} units</Text>
          </View>
        </Card>

        {/* Product Details */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Product Information</Text>
          <View style={styles.infoContainer}>
            <InfoRow label="SKU" value={product.sku ?? '—'} icon="tag" colors={colors} />
            <InfoRow label="Barcode" value={product.barcode ?? '—'} icon="barcode" colors={colors} />
            <InfoRow label="Category" value={product.category_name ?? '—'} icon="categories" colors={colors} />
            <InfoRow label="Brand" value={product.brand_name ?? '—'} icon="box" colors={colors} />
            <InfoRow label="Reorder Level" value={String(product.reorder_level)} icon="refresh" colors={colors} />
            <InfoRow label="Min Stock" value={String(product.min_stock)} icon="alert" colors={colors} />
            <InfoRow label="Max Stock" value={String(product.max_stock)} icon="box" colors={colors} />
            {product.product_type && (
              <InfoRow label="Product Type" value={product.product_type} icon="package" colors={colors} />
            )}
            {product.flavor && (
              <InfoRow label="Flavor" value={product.flavor} icon="star" colors={colors} />
            )}
            {product.nicotine_strength && (
              <InfoRow label="Nicotine Strength" value={product.nicotine_strength} icon="alert" colors={colors} />
            )}
            {product.puff_count != null && (
              <InfoRow label="Puff Count" value={String(product.puff_count)} icon="clock" colors={colors} />
            )}
            {product.weight != null && (
              <InfoRow label="Weight" value={`${product.weight}g`} icon="box" colors={colors} />
            )}
            <InfoRow label="Age Restricted" value={product.is_age_restricted ? 'Yes' : 'No'} icon="shield" colors={colors} />
            <InfoRow label="Rating" value={`${product.rating.toFixed(1)} (${product.review_count} reviews)`} icon="star" colors={colors} />
          </View>
        </Card>

        {/* Stock Summary */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Stock Summary</Text>
          <View style={styles.stockGrid}>
            <View style={[styles.stockItem, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.stockItemLabel, { color: colors.textMuted }]}>On Hand</Text>
              <Text style={[styles.stockItemValue, { color: colors.textPrimary }]}>{product.stock}</Text>
            </View>
            <View style={[styles.stockItem, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.stockItemLabel, { color: colors.textMuted }]}>Threshold</Text>
              <Text style={[styles.stockItemValue, { color: colors.textPrimary }]}>{product.low_stock_threshold}</Text>
            </View>
            <View style={[styles.stockItem, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.stockItemLabel, { color: colors.textMuted }]}>Reorder At</Text>
              <Text style={[styles.stockItemValue, { color: colors.textPrimary }]}>{product.reorder_level}</Text>
            </View>
          </View>
        </Card>

        {/* Description */}
        {product.description && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Description</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{product.description}</Text>
          </Card>
        )}

        {/* Tags */}
        {product.tags.length > 0 && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Tags</Text>
            <View style={styles.tagContainer}>
              {product.tags.map((tag: string) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.tagText, { color: colors.textSecondary }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },
  imageContainer: { height: 220, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  productImage: { width: '100%', height: '100%' },
  placeholderImage: { alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  shortDesc: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 },
  price: { fontSize: 28, fontWeight: '700' },
  comparePrice: { fontSize: 16, textDecorationLine: 'line-through' },
  stockBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginTop: 10 },
  stockText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoContainer: { gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '500', maxWidth: 180, textAlign: 'right' },
  stockGrid: { flexDirection: 'row', gap: 10 },
  stockItem: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center', gap: 4 },
  stockItemLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  stockItemValue: { fontSize: 22, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 22 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tagText: { fontSize: 12, fontWeight: '500' },
});
