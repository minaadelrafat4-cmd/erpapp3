import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';

export const PASSWORD_POLICY_HINT = 'Min 10 characters with uppercase, lowercase, number, and special character';

export function validatePasswordLocal(password: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters long';
  if (password.length > 128) return 'Password must be at most 128 characters long';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  if (!/[^a-zA-Z0-9]/.test(password)) return 'Password must contain a special character';
  return null;
}

export async function validatePasswordServer(password: string, email?: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('validate_password_policy', {
      p_password: password,
      p_email: email ?? null,
    });
    if (error) return null;
    return data as string | null;
  } catch {
    return null;
  }
}

export const STAFF_ROLES: UserRole[] = [
  'admin', 'manager', 'staff',
  'super_admin', 'company_owner', 'general_manager',
  'warehouse_manager', 'branch_manager', 'inventory_employee',
  'sales_employee', 'marketing', 'accountant', 'customer_support',
];

export function isStaffRole(role: UserRole | undefined | null): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

export function isAdminRole(role: UserRole | undefined | null): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'company_owner';
}

// Role hierarchy — keep this table in sync with get_role_rank() in
// supabase/migrations/*_0015_role_security_hardening.sql and the
// ROLE_RANK map in supabase/functions/admin-create-employee/index.ts.
// This is UI-only; the database enforces the real security boundary.
export const ROLE_RANK: Record<string, number> = {
  super_admin: 100, company_owner: 100, admin: 100,
  general_manager: 80,
  warehouse_manager: 60, branch_manager: 60, manager: 60,
  inventory_employee: 40, sales_employee: 40, marketing: 40,
  accountant: 40, customer_support: 40,
  staff: 20, customer: 0,
};

export function roleRank(role: UserRole | undefined | null): number {
  return ROLE_RANK[role ?? ''] ?? 0;
}

/** Can `callerRole` create/assign an employee account with `targetRole`? */
export function canAssignRole(callerRole: UserRole | undefined | null, targetRole: string): boolean {
  const callerRank = roleRank(callerRole);
  if (callerRank < 60) return false; // below manager tier: cannot manage employees at all
  if (callerRank >= 100) return true; // owner/admin tier: can assign anyone
  return callerRank > roleRank(targetRole as UserRole);
}

/** Can `callerRole` create or edit employee accounts at all? */
export function canManageEmployees(callerRole: UserRole | undefined | null): boolean {
  return roleRank(callerRole) >= 60;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return null;
  return data as Profile | null;
}

export async function checkPermission(permission: string): Promise<boolean> {
  try {
    const { data } = await supabase.rpc('has_permission', { p_permission: permission });
    return data === true;
  } catch {
    return false;
  }
}

export async function checkIsStaff(): Promise<boolean> {
  try {
    const { data } = await supabase.rpc('is_staff');
    return data === true;
  } catch {
    return false;
  }
}

export async function logActivity(
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.rpc('log_activity', {
      p_action: action,
      p_entity_type: entityType ?? null,
      p_entity_id: entityId ?? null,
      p_metadata: metadata ?? null,
    });
  } catch { /* best-effort logging */ }
}

export async function checkServerLockout(email: string): Promise<boolean> {
  try {
    const { data } = await supabase.rpc('is_account_locked_server', { p_email: email });
    return data === true;
  } catch {
    return false;
  }
}

export async function getDeviceInfo(): Promise<{ deviceId: string; deviceName: string; userAgent: string }> {
  const ua = navigator.userAgent;
  let deviceId = localStorage.getItem('luxe_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('luxe_device_id', deviceId);
  }
  const deviceName = /Mobile|Android|iPhone/.test(ua) ? 'Mobile Device' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : 'Device';
  return { deviceId, deviceName, userAgent: ua };
}

const SESSION_TIMEOUT_KEY = 'luxe_session_expires';
const REMEMBER_KEY = 'luxe_remember_me';

export function setSessionExpiry(remember: boolean): void {
  const ttl = remember ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
  localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
  localStorage.setItem(SESSION_TIMEOUT_KEY, String(Date.now() + ttl));
}

export async function recordServerLoginAttempt(email: string, success: boolean, userId?: string, failureReason?: string): Promise<void> {
  try {
    await supabase.rpc('record_login_attempt', {
      p_email: email,
      p_success: success,
      p_user_id: userId ?? null,
      p_failure_reason: failureReason ?? null,
    });
  } catch { /* best-effort */ }
}

export async function recordServerLoginHistory(userId: string, email: string, success: boolean, failureReason?: string): Promise<void> {
  try {
    const info = await getDeviceInfo();
    await supabase.rpc('record_login_history', {
      p_user_id: userId,
      p_email: email,
      p_user_agent: info.userAgent,
      p_device_id: info.deviceId,
      p_successful: success,
      p_failure_reason: failureReason ?? null,
    });
  } catch { /* best-effort */ }
}

export function isSessionExpired(): boolean {
  const exp = localStorage.getItem(SESSION_TIMEOUT_KEY);
  if (!exp) return false;
  return Date.now() > parseInt(exp, 10);
}

export function clearSessionExpiry(): void {
  localStorage.removeItem(SESSION_TIMEOUT_KEY);
  localStorage.removeItem(REMEMBER_KEY);
}

export function getRememberPreference(): boolean {
  return localStorage.getItem(REMEMBER_KEY) === 'true';
}

const FAILED_LOGIN_KEY = 'luxe_failed_logins';
const LOCK_THRESHOLD = 5;

export function recordFailedLogin(email: string): number {
  let store: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(FAILED_LOGIN_KEY);
    store = raw ? JSON.parse(raw) : {};
  } catch { store = {}; }
  store[email] = (store[email] ?? 0) + 1;
  localStorage.setItem(FAILED_LOGIN_KEY, JSON.stringify(store));
  return store[email];
}

export function clearFailedLogins(email: string): void {
  try {
    const raw = localStorage.getItem(FAILED_LOGIN_KEY);
    if (!raw) return;
    const store: Record<string, number> = JSON.parse(raw);
    delete store[email];
    localStorage.setItem(FAILED_LOGIN_KEY, JSON.stringify(store));
  } catch { /* ignore */ }
}

export function isAccountLocked(email: string): boolean {
  try {
    const raw = localStorage.getItem(FAILED_LOGIN_KEY);
    if (!raw) return false;
    const store: Record<string, number> = JSON.parse(raw);
    return (store[email] ?? 0) >= LOCK_THRESHOLD;
  } catch { return false; }
}

export { LOCK_THRESHOLD };
