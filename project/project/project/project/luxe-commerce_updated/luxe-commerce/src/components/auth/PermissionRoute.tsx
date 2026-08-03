import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { isAdminRole } from '@/lib/auth';

interface PermissionRouteProps {
  children: React.ReactNode;
  /**
   * A permission key (e.g. "products.manage") the current user must have at
   * least view access to. Checked against AuthContext's canView(), which is
   * populated from get_employee_permissions(). Full-access roles
   * (admin/super_admin/company_owner) always bypass this check.
   */
  permission?: string;
  /** Optional extra restriction: only these roles may access this route at all,
   * regardless of granted permissions (e.g. a page that should never be opened
   * by anyone outside a specific role list, permission grants notwithstanding). */
  allowedRoles?: string[];
}

export const PermissionRouteComponent: React.FC<PermissionRouteProps> = ({
  children,
  permission,
  allowedRoles = [],
}) => {
  const { role, loading, permissionsLoaded, canView } = useAuth();

  if (loading || (permission && !permissionsLoaded)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAdminRole(role)) {
    return <>{children}</>;
  }

  const hasRole =
    allowedRoles.length === 0 ||
    allowedRoles.map((r) => r.toLowerCase()).includes((role ?? '').toLowerCase());

  const hasPermission = !permission || canView(permission);

  if (!hasRole || !hasPermission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <h1 className="text-2xl font-semibold text-ink-50 mb-2">Access Restricted</h1>
        <p className="text-ink-300 text-sm max-w-md">
          You don't have permission to view this page. Contact your administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default PermissionRouteComponent;
