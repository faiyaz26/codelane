// Settings module types and constants

export type SettingsTab = 'general' | 'agents' | 'models' | 'appearance' | 'api-keys';

export interface NavItem {
  id: SettingsTab;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: 'general' },
  { id: 'agents', label: 'Agents', icon: 'agents' },
  { id: 'models', label: 'Models', icon: 'models' },
  { id: 'appearance', label: 'Appearance', icon: 'appearance' },
  { id: 'api-keys', label: 'API Keys', icon: 'api-keys' },
];
