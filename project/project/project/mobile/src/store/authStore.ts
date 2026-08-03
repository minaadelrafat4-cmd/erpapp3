import { create } from 'zustand';
import { supabase } from '@lib/supabase';
import type { Profile, UserRole } from '@apptypes';
import { isAdminRole, isStaffRole } from '@apptypes';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  setProfile: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        set({ profile: profile as Profile | null, loading: false, initialized: true });
      } else {
        set({ profile: null, loading: false, initialized: true });
      }
    } catch {
      set({ profile: null, loading: false, initialized: true });
    }
  },

  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null });
  },
}));

// Selectors
export const useCurrentRole = (): UserRole | null => useAuthStore((s) => s.profile?.role ?? null);
export const useIsStaff = (): boolean => useAuthStore((s) => isStaffRole(s.profile?.role));
export const useIsAdmin = (): boolean => useAuthStore((s) => isAdminRole(s.profile?.role));
