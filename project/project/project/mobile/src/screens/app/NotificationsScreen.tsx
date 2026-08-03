import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { ScreenWrapper } from '@components/ScreenWrapper';
import { AppHeader } from '@components/AppHeader';
import { Card } from '@components/Card';
import { ErrorState } from '@components/ErrorState';
import { EmptyState } from '@components/EmptyState';
import { Button } from '@components/Button';
import { useThemeStore } from '@store/themeStore';
import { useAuthStore } from '@store/authStore';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from '@hooks/useERP';
import { useResponsive } from '@hooks/useResponsive';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
import type { ERPNotification } from '@apptypes/erp';
import type { ThemeColors } from '@apptypes';

export default function NotificationsScreen() {
  const { colors } = useThemeStore();
  const profile = useAuthStore((s) => s.profile);
  const layout = useResponsive();

  const notificationsQuery = useNotifications(profile?.id ?? null);
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await notificationsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [notificationsQuery]);

  const handleMarkAsRead = useCallback(
    (id: string) => {
      if (profile?.id) markAsRead(id, profile.id);
    },
    [markAsRead, profile?.id],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (!profile?.id) return;
    setMarkingAll(true);
    try {
      await markAllAsRead(profile.id);
    } finally {
      setMarkingAll(false);
    }
  }, [markAllAsRead, profile?.id]);

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = useMemo(() => notifications.filter((n: ERPNotification) => !n.is_read).length, [notifications]);

  const showLoading = notificationsQuery.isLoading && !refreshing;
  const showError = notificationsQuery.isError && !refreshing;

  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'warning': return 'alert';
      case 'error': case 'critical': return 'alert';
      case 'success': return 'check';
      case 'order': return 'shopping-cart';
      case 'inventory': return 'box';
      case 'system': return 'gear';
      default: return 'bell';
    }
  };

  const getNotificationColor = (type: string, colors: ThemeColors): string => {
    switch (type) {
      case 'warning': return colors.warning;
      case 'error': case 'critical': return colors.error;
      case 'success': return colors.success;
      default: return colors.gold;
    }
  };

  const renderItem = ({ item }: { item: ERPNotification }) => {
    const icon = getNotificationIcon(item.type) as Parameters<typeof getIconName>[0];
    const color = getNotificationColor(item.type, colors);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={!item.is_read ? () => handleMarkAsRead(item.id) : undefined}
      >
        <Card
          style={{ ...styles.notifCard, borderColor: item.is_read ? colors.border : color + '60' }}
        >
          <View style={styles.notifRow}>
            <View style={[styles.notifIcon, { backgroundColor: color + '20' }]}>
              <MaterialCommunityIcons name={getIconName(icon)} size={20} color={color} />
            </View>
            <View style={styles.notifContent}>
              <View style={styles.notifHeader}>
                <Text
                  style={[styles.notifTitle, { color: colors.textPrimary }, !item.is_read && styles.unreadTitle]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: color }]} />}
              </View>
              <Text style={[styles.notifMessage, { color: colors.textSecondary }]} numberOfLines={3}>
                {item.message}
              </Text>
              <View style={styles.notifFooter}>
                <Text style={[styles.notifTime, { color: colors.textMuted }]}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
                {!item.is_read && (
                  <Text style={[styles.tapHint, { color: color }]}>Tap to mark as read</Text>
                )}
              </View>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenWrapper edges={['top', 'bottom']}>
      <AppHeader title="Notifications" subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} showBack showMenu />
      <View style={[styles.content, { paddingHorizontal: layout.padding, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}>
        {unreadCount > 0 && !showLoading && !showError && (
          <Button
            title={markingAll ? 'Marking all…' : 'Mark All as Read'}
            onPress={handleMarkAllAsRead}
            variant="outline"
            size="sm"
            loading={markingAll}
            disabled={markingAll}
            style={styles.markAllBtn}
          />
        )}

        {showLoading && (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading notifications…</Text>
          </View>
        )}

        {showError && (
          <View style={styles.centerState}>
            <ErrorState
              title="Failed to load notifications"
              message="We couldn't load your notifications."
              onRetry={() => notificationsQuery.refetch()}
            />
          </View>
        )}

        {!showLoading && !showError && (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <EmptyState
                  icon="notifications"
                  title="No Notifications"
                  message="You're all caught up. New alerts will appear here."
                />
              </View>
            }
          />
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  markAllBtn: { alignSelf: 'flex-end', marginBottom: 12 },
  list: { gap: 10, paddingBottom: 24 },
  notifCard: { padding: 14 },
  notifRow: { flexDirection: 'row', gap: 12 },
  notifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1, gap: 4 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  notifTitle: { flex: 1, fontSize: 15, fontWeight: '500', lineHeight: 19 },
  unreadTitle: { fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  notifMessage: { fontSize: 13, lineHeight: 18 },
  notifFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  notifTime: { fontSize: 11 },
  tapHint: { fontSize: 11, fontWeight: '600' },
  centerState: { flex: 1, minHeight: 300, justifyContent: 'center' },
  loadingText: { fontSize: 14, marginTop: 12, textAlign: 'center' },
});
