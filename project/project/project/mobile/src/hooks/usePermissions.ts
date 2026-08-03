import { useEffect } from 'react';
import { supabase } from '@lib/supabase';
import { useAuthStore } from '@store/authStore';
import { useAppStore } from '@store/appStore';
import type { PermissionGrant } from '@apptypes';
import { isAdminRole } from '@apptypes';

export function usePermissions() {
  const profile = useAuthStore((s) => s.profile);
  const { permissions, permissionsLoaded, setPermissions } = useAppStore();
  const role = profile?.role;

  useEffect(() => {
    if (!profile) {
      setPermissions([]);
      return;
    }
    if (isAdminRole(role)) {
      setPermissions([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc('get_employee_permissions');
      if (!error && Array.isArray(data)) {
        const grants: PermissionGrant[] = (data as { permission_name: string; can_edit: boolean }[]).map((row) => ({
          permissionName: row.permission_name,
          canEdit: !!row.can_edit,
        }));
        setPermissions(grants);
      } else {
        setPermissions([]);
      }
    })();
  }, [profile?.id, role, setPermissions]);

  const canView = (permission: string): boolean =>
    isAdminRole(role) || permissions.some((p) => p.permissionName === permission);

  const canEdit = (permission: string): boolean =>
    isAdminRole(role) || permissions.some((p) => p.permissionName === permission && p.canEdit);

  return { permissions, permissionsLoaded, canView, canEdit };
}
