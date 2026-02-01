// Theme Manager - handles theme switching and persistence

import { createSignal, createRoot, type Accessor } from 'solid-js';

export type ThemeId = 'dark' | 'zed-dark' | 'light';

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
}

export const THEMES: Theme[] = [
  {
    id: 'dark',
    name: 'Dark',
    description: 'Default dark theme with deep blacks',
  },
  {
    id: 'zed-dark',
    name: 'Zed One Dark',
    description: 'Inspired by Zed Editor\'s One Dark theme',
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Clean light theme for bright environments',
  },
];

const THEME_STORAGE_KEY = 'codelane-theme';

// Create reactive state within a root to ensure proper SolidJS reactivity
const { currentTheme, setCurrentTheme } = createRoot(() => {
  const [currentTheme, setCurrentTheme] = createSignal<ThemeId>('dark');
  return { currentTheme, setCurrentTheme };
});

function isValidTheme(theme: string): boolean {
  return THEMES.some((t) => t.id === theme);
}

function applyTheme(themeId: ThemeId) {
  // Update signal
  setCurrentTheme(themeId);

  // Apply theme class to document
  const root = document.documentElement;

  // Remove all theme classes
  root.classList.remove('dark', 'zed-dark', 'light');

  // Add new theme class
  root.classList.add(themeId);

  // Save to localStorage
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch (e) {
    console.warn('Failed to save theme to storage:', e);
  }
}

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && isValidTheme(saved)) {
      applyTheme(saved as ThemeId);
    } else {
      // Default to dark theme
      applyTheme('dark');
    }
  } catch (e) {
    console.warn('Failed to load theme from storage:', e);
    applyTheme('dark');
  }
}

// Initialize theme on module load
loadTheme();

// Export theme manager API
export const themeManager = {
  getTheme(): Accessor<ThemeId> {
    return currentTheme;
  },

  setTheme(themeId: ThemeId) {
    applyTheme(themeId);
  },

  getThemeInfo(themeId: ThemeId): Theme | undefined {
    return THEMES.find((t) => t.id === themeId);
  },
};
