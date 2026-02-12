// Settings module types and constants

export type SettingsTab = 'general' | 'agents' | 'notifications' | 'appearance';

export interface NavItem {
  id: SettingsTab;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: 'general' },
  { id: 'agents', label: 'Agents', icon: 'agents' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  { id: 'appearance', label: 'Appearance', icon: 'appearance' },
];
