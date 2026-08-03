import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { useAuthStore } from '@store/authStore';

export function useAuth() {
  const initialize = useAuthStore((s) => s.initialize);
  const setProfile = useAuthStore((s) => s.setProfile);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        setUser(data.session.user);
        initialize();
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        initialize();
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [initialize, setProfile]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  return { session, user, signIn, signOut, resetPassword };
}
