import { supabase } from '@lib/supabase';
import type { Profile } from '@apptypes';

export const authService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    return data as Profile | null;
  },

  async checkServerLockout(email: string): Promise<boolean> {
    try {
      const { data } = await supabase.rpc('is_account_locked_server', { p_email: email });
      return data === true;
    } catch {
      return false;
    }
  },

  async recordLoginAttempt(email: string, success: boolean, userId?: string, failureReason?: string): Promise<void> {
    try {
      await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: success,
        p_user_id: userId ?? null,
        p_failure_reason: failureReason ?? null,
      });
    } catch {
      // best-effort
    }
  },
};
