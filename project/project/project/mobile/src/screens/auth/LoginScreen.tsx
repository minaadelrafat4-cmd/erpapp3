import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Input } from '@components/Input';
import { Button } from '@components/Button';
import { useThemeStore } from '@store/themeStore';
import { useAuthStore } from '@store/authStore';
import { authService } from '@services/authService';
import { isStaffRole, type UserRole } from '@apptypes';
import { useResponsive } from '@hooks/useResponsive';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const initialize = useAuthStore((s) => s.initialize);
  const layout = useResponsive();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    const locked = await authService.checkServerLockout(email.trim());
    if (locked) {
      setError('Account temporarily locked after too many failed attempts. Try again in 15 minutes or reset your password.');
      return;
    }

    setBusy(true);
    try {
      const { supabase } = await import('@lib/supabase');
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        await authService.recordLoginAttempt(email.trim(), false, undefined, signInError.message);
        setError(signInError.message);
        return;
      }

      await authService.recordLoginAttempt(email.trim(), true, data.user?.id);
      await initialize();

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user!.id)
        .maybeSingle();

      if (!profile || !isStaffRole((profile as { role: UserRole }).role)) {
        setError('This account does not have staff access. Use the customer app instead.');
        await supabase.auth.signOut();
        await initialize();
        return;
      }

      router.replace('/(app)/dashboard' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { paddingHorizontal: layout.padding, maxWidth: layout.isTablet ? 480 : undefined, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}>
        <Text style={[styles.brand, { color: colors.gold }]}>LUXE</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>ERP Staff Portal</Text>

        <View style={styles.form}>
          <Input
            label="Staff Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@luxe.co"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholder="Enter password"
          />
          <TouchableOpacity onPress={() => setShowPassword((s) => !s)} style={styles.toggleRow}>
            <Text style={{ fontSize: 13, color: colors.gold }}>{showPassword ? 'Hide' : 'Show'} password</Text>
          </TouchableOpacity>

          {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

          <Button title={busy ? 'Signing in…' : 'Sign In'} onPress={submit} disabled={busy} />
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>Employee accounts are created by authorized administrators.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center' },
  brand: { fontSize: 36, fontWeight: '800', textAlign: 'center', letterSpacing: 3 },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 40 },
  form: { gap: 16 },
  toggleRow: { alignSelf: 'flex-end', marginTop: 4 },
  errorText: { fontSize: 13, marginTop: 8 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 32 },
});
