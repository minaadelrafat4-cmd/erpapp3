import type { UserRole, NavItemConfig, NavGroupConfig } from '@apptypes';
import { roleRank } from '@apptypes';
import { NAV_ITEMS, NAV_GROUPS } from '@constants';
import type { NavGroup } from '@apptypes';

export interface FilteredNavGroup {
  config: NavGroupConfig;
  items: NavItemConfig[];
}

export function getAccessibleNavItems(role: UserRole | null | undefined): NavItemConfig[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => roleRank(role) >= item.minRank);
}

export function getAccessibleNavGroups(role: UserRole | null | undefined): FilteredNavGroup[] {
  const items = getAccessibleNavItems(role);
  return NAV_GROUPS.map((config) => ({
    config,
    items: items.filter((item) => item.group === config.key),
  })).filter((group) => group.items.length > 0);
}

export function getNavItemsByGroup(role: UserRole | null | undefined, group: NavGroup): NavItemConfig[] {
  return getAccessibleNavItems(role).filter((item) => item.group === group);
}

export function isNavAccessible(role: UserRole | null | undefined, key: string): boolean {
  const item = NAV_ITEMS.find((i) => i.key === key);
  if (!item) return false;
  if (!role) return false;
  return roleRank(role) >= item.minRank;
}
