// Settings module types and constants

export type SettingsTab = 'general' | 'agents' | 'code-review' | 'notifications' | 'appearance';

export interface NavItem {
  id: SettingsTab;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: 'general' },
  { id: 'agents', label: 'Agents', icon: 'agents' },
  { id: 'code-review', label: 'Code Review', icon: 'code-review' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  { id: 'appearance', label: 'Appearance', icon: 'appearance' },
];
