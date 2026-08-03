import { create } from 'zustand';
import type { PermissionGrant } from '@apptypes';

interface AppState {
  permissions: PermissionGrant[];
  permissionsLoaded: boolean;
  isOnline: boolean;
  pendingSyncCount: number;

  setPermissions: (permissions: PermissionGrant[]) => void;
  setOnline: (online: boolean) => void;
  setPendingSyncCount: (count: number) => void;

  canView: (permission: string) => boolean;
  canEdit: (permission: string) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  permissions: [],
  permissionsLoaded: false,
  isOnline: true,
  pendingSyncCount: 0,

  setPermissions: (permissions) => set({ permissions, permissionsLoaded: true }),
  setOnline: (online) => set({ isOnline: online }),
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),

  canView: (permission: string): boolean => {
    const state = get();
    if (state.permissions.length === 0 && !state.permissionsLoaded) return true;
    return state.permissions.some((p) => p.permissionName === permission);
  },

  canEdit: (permission: string): boolean => {
    const state = get();
    return state.permissions.some((p) => p.permissionName === permission && p.canEdit);
  },
}));
