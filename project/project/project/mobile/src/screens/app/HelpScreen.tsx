import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { ScreenWrapper } from '@components/ScreenWrapper';
import { AppHeader } from '@components/AppHeader';
import { Card } from '@components/Card';
import { useThemeStore } from '@store/themeStore';
import { APP_CONFIG } from '@constants';
import { useResponsive } from '@hooks/useResponsive';

export default function HelpScreen() {
  const { colors } = useThemeStore();
  const layout = useResponsive();

  const contactEmail = 'support@luxe-erp.com';
  const contactPhone = '+1-800-LUXE-ERP';

  return (
    <ScreenWrapper edges={['top', 'bottom']}>
      <AppHeader title="Help & Support" subtitle="Get assistance" showBack showMenu />
      <View style={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}>
        <Card>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{APP_CONFIG.name} Mobile</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            This app is the mobile companion to the LUXE ERP enterprise suite. For help with a specific module, navigate to that module and look for the help icon.
          </Text>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Contact Support</Text>
          <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${contactEmail}`)}>
            <Text style={[styles.contactLabel, { color: colors.textMuted }]}>Email</Text>
            <Text style={[styles.contactValue, { color: colors.gold }]}>{contactEmail}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`tel:${contactPhone}`)}>
            <Text style={[styles.contactLabel, { color: colors.textMuted }]}>Phone</Text>
            <Text style={[styles.contactValue, { color: colors.gold }]}>{contactPhone}</Text>
          </TouchableOpacity>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>About</Text>
          <Text style={[styles.aboutText, { color: colors.textSecondary }]}>
            Version 1.0.0{'\n'}
            Built with React Native + Expo{'\n'}
            Connected to LUXE ERP Supabase backend
          </Text>
        </Card>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  contactLabel: { fontSize: 14 },
  contactValue: { fontSize: 14, fontWeight: '500' },
  aboutText: { fontSize: 13, lineHeight: 22 },
});
