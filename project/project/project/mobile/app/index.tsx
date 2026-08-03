import { Redirect } from 'expo-router';
import { useAuthStore } from '@store/authStore';
import { isStaffRole } from '@apptypes';

export default function Index() {
  const profile = useAuthStore((s) => s.profile);
  if (profile && isStaffRole(profile.role)) return <Redirect href="/(app)/(tabs)/dashboard" />;
  return <Redirect href="/(auth)/login" />;
}
