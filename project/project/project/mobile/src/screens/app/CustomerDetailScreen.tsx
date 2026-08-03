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
import { useCustomerDetail } from '@hooks/useERP';
import { useResponsive } from '@hooks/useResponsive';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
import { navMinRank } from '@constants';
import type { IconName, ThemeColors } from '@apptypes';
import type { CustomerAddress, CustomerOrderSummary } from '@apptypes/erp';

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

export default function CustomerDetailScreen() {
  const { colors } = useThemeStore();
  const params = useLocalSearchParams<{ id: string }>();
  const layout = useResponsive();

  const customerId = params.id;
  const customerQuery = useCustomerDetail(customerId);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await customerQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [customerQuery]);

  if (customerQuery.isLoading) {
    return (
      <RoleGate minRank={navMinRank('customers')}>
        <ScreenWrapper>
          <AppHeader title="Customer Details" showBack showMenu />
          <LoadingState message="Loading customer…" />
        </ScreenWrapper>
      </RoleGate>
    );
  }

  if (customerQuery.isError || !customerQuery.data) {
    return (
      <RoleGate minRank={navMinRank('customers')}>
        <ScreenWrapper>
          <AppHeader title="Customer Details" showBack showMenu />
          <ErrorState
            title="Customer not found"
            message="This customer may have been removed or is unavailable."
            onRetry={() => customerQuery.refetch()}
          />
        </ScreenWrapper>
      </RoleGate>
    );
  }

  const customer = customerQuery.data;
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || 'Unknown';
  const initials = (customer.first_name ?? customer.email ?? 'U').charAt(0).toUpperCase();

  return (
    <RoleGate minRank={navMinRank('customers')}>
      <ScreenWrapper>
        <AppHeader title="Customer Details" showBack showMenu />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
        >
          <Card>
            <View style={styles.headerRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={styles.iconText}>{initials}</Text>
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.customerName, { color: colors.textPrimary }]}>{fullName}</Text>
                {customer.email ? (
                  <Text style={[styles.customerEmail, { color: colors.textMuted }]} numberOfLines={1}>{customer.email}</Text>
                ) : null}
              </View>
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Contact Information</Text>
            <View style={styles.infoContainer}>
              <InfoRow label="Email" value={customer.email ?? '—'} icon="mail" colors={colors} />
              <InfoRow label="Phone" value={customer.phone ?? '—'} icon="phone" colors={colors} />
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Account Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryItem, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>Orders</Text>
                <Text style={[styles.summaryItemValue, { color: colors.textPrimary }]}>{customer.order_count}</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>Total Spent</Text>
                <Text style={[styles.summaryItemValue, { color: colors.gold }]}>{customer.total_spent ? `$${customer.total_spent.toFixed(2)}` : '—'}</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>Loyalty Points</Text>
                <Text style={[styles.summaryItemValue, { color: colors.accent }]}>{customer.loyalty_points}</Text>
              </View>
            </View>
          </Card>

          {customer.addresses.length > 0 && (
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Saved Addresses</Text>
              <View style={styles.infoContainer}>
                {customer.addresses.map((addr: CustomerAddress) => (
                  <View key={addr.id} style={styles.addressBlock}>
                    {addr.is_default && (
                      <View style={[styles.defaultBadge, { backgroundColor: colors.gold + '20' }]}>
                        <Text style={[styles.defaultBadgeText, { color: colors.gold }]}>Default</Text>
                      </View>
                    )}
                    <Text style={[styles.addressLine, { color: colors.textPrimary }]}>{addr.line1}</Text>
                    {addr.line2 ? <Text style={[styles.addressLine, { color: colors.textSecondary }]}>{addr.line2}</Text> : null}
                    <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
                      {addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.postal_code ?? ''}
                    </Text>
                    <Text style={[styles.addressLine, { color: colors.textSecondary }]}>{addr.country}</Text>
                    {addr.phone ? <Text style={[styles.addressLine, { color: colors.textMuted }]}>Phone: {addr.phone}</Text> : null}
                  </View>
                ))}
              </View>
            </Card>
          )}

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Recent Orders</Text>
            {customer.recent_orders.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No orders yet.</Text>
            ) : (
              <View style={styles.ordersList}>
                {customer.recent_orders.map((order: CustomerOrderSummary) => (
                  <View key={order.id} style={styles.orderItem}>
                    <View style={styles.orderLeft}>
                      <Text style={[styles.orderNumber, { color: colors.gold }]}>{order.order_number}</Text>
                      <Text style={[styles.orderDate, { color: colors.textMuted }]}>
                        {new Date(order.placed_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.orderRight}>
                      <Text style={[styles.orderTotal, { color: colors.textPrimary }]}>
                        {order.currency === 'USD' ? '$' : ''}{order.grand_total.toFixed(2)}
                      </Text>
                      <Text style={[styles.orderStatus, { color: colors.textSecondary }]}>{order.status}</Text>
                    </View>
                  </View>
                ))}
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
  iconBox: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 24, fontWeight: '800', color: '#d4a649' },
  headerInfo: { flex: 1, gap: 2 },
  customerName: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  customerEmail: { fontSize: 13 },
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
  addressBlock: { gap: 2, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.05)' },
  defaultBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 4 },
  defaultBadgeText: { fontSize: 11, fontWeight: '600' },
  addressLine: { fontSize: 13, lineHeight: 18 },
  emptyText: { fontSize: 14, fontStyle: 'italic' },
  ordersList: { gap: 10 },
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.05)' },
  orderLeft: { flex: 1, gap: 2 },
  orderNumber: { fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },
  orderDate: { fontSize: 12 },
  orderRight: { alignItems: 'flex-end', gap: 2 },
  orderTotal: { fontSize: 14, fontWeight: '700' },
  orderStatus: { fontSize: 11, textTransform: 'capitalize' },
});
