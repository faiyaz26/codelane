// Settings module types and constants

export type SettingsTab = 'general' | 'agents' | 'appearance';

export interface NavItem {
  id: SettingsTab;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: 'general' },
  { id: 'agents', label: 'Agents', icon: 'agents' },
  { id: 'appearance', label: 'Appearance', icon: 'appearance' },
];
