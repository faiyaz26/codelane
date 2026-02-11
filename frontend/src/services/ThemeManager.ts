// Theme Manager - handles theme switching and persistence

import { createSignal, createRoot, type Accessor } from 'solid-js';

export type ThemeId = 'dark' | 'codelane-dark' | 'light';

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  // Shiki theme for syntax highlighting
  shikiTheme: string;
  // Whether this is a light or dark theme (for Shiki dual theme support)
  isDark: boolean;
}

export const THEMES: Theme[] = [
  {
    id: 'codelane-dark',
    name: 'Codelane Dark',
    description: 'Codelane\'s signature dark theme with deep grays',
    shikiTheme: 'one-dark-pro',
    isDark: true,
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Default dark theme with deep blacks',
    shikiTheme: 'github-dark-default',
    isDark: true,
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Clean light theme for bright environments',
    shikiTheme: 'github-light-default',
    isDark: false,
  },
];

// Get all unique Shiki themes used by our themes (for preloading)
export function getAllShikiThemes(): string[] {
  return [...new Set(THEMES.map((t) => t.shikiTheme))];
}

// Get Shiki theme for a given app theme
export function getShikiTheme(themeId: ThemeId): string {
  const theme = THEMES.find((t) => t.id === themeId);
  return theme?.shikiTheme || 'github-dark-default';
}

// Check if a theme is dark
export function isThemeDark(themeId: ThemeId): boolean {
  const theme = THEMES.find((t) => t.id === themeId);
  return theme?.isDark ?? true;
}

const THEME_STORAGE_KEY = 'codelane-theme';

// Create reactive state within a root to ensure proper SolidJS reactivity
const { currentTheme, setCurrentTheme } = createRoot(() => {
  const [currentTheme, setCurrentTheme] = createSignal<ThemeId>('codelane-dark');
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
  root.classList.remove('dark', 'codelane-dark', 'light');

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
      // Default to codelane-dark theme
      applyTheme('codelane-dark');
    }
  } catch (e) {
    console.warn('Failed to load theme from storage:', e);
    applyTheme('codelane-dark');
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
