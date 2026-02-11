/**
 * Codelane Dark theme constants and utilities
 */

import type { ITheme } from '@xterm/xterm';
import { themeManager, type ThemeId } from './services/ThemeManager';

// Terminal themes for each app theme
const TERMINAL_THEMES: Record<ThemeId, ITheme> = {
  dark: {
    background: '#111111',
    foreground: '#e6e6e6',
    cursor: '#0b93f6',
    cursorAccent: '#111111',
    selectionBackground: '#252525',
    selectionForeground: '#e6e6e6',
    // ANSI colors
    black: '#1a1a1a',
    red: '#f23c3c',
    green: '#26d97f',
    yellow: '#f5c249',
    blue: '#0b93f6',
    magenta: '#b88ef2',
    cyan: '#26d9d9',
    white: '#e6e6e6',
    brightBlack: '#4e4e4e',
    brightRed: '#ff5252',
    brightGreen: '#3dff95',
    brightYellow: '#ffd65e',
    brightBlue: '#3da8ff',
    brightMagenta: '#d1a3ff',
    brightCyan: '#3dffff',
    brightWhite: '#ffffff',
  },
  'codelane-dark': {
    background: '#262a32',
    foreground: '#bbbfc3',
    cursor: '#5d8bba',
    cursorAccent: '#262a32',
    selectionBackground: '#3e4352',
    selectionForeground: '#bbbfc3',
    // ANSI colors - warmer tones matching Codelane Dark
    black: '#202329',
    red: '#a65b5f',
    green: '#819a67',
    yellow: '#b39a6a',
    blue: '#5d8bba',
    magenta: '#905fa6',
    cyan: '#4492a0',
    white: '#bbbfc3',
    brightBlack: '#4a4f58',
    brightRed: '#b4565e',
    brightGreen: '#7a9c61',
    brightYellow: '#b89a63',
    brightBlue: '#4e8cbf',
    brightMagenta: '#9f60b1',
    brightCyan: '#4492a0',
    brightWhite: '#e6e6e6',
  },
  light: {
    background: '#f8f9fa',
    foreground: '#202124',
    cursor: '#1a73e8',
    cursorAccent: '#f8f9fa',
    selectionBackground: '#c2dbff',
    selectionForeground: '#202124',
    // ANSI colors - adjusted for light background
    black: '#202124',
    red: '#d93025',
    green: '#188038',
    yellow: '#f9ab00',
    blue: '#1a73e8',
    magenta: '#9334e6',
    cyan: '#007b83',
    white: '#f8f9fa',
    brightBlack: '#5f6368',
    brightRed: '#ea4335',
    brightGreen: '#34a853',
    brightYellow: '#fbbc04',
    brightBlue: '#4285f4',
    brightMagenta: '#a142f4',
    brightCyan: '#24c1e0',
    brightWhite: '#ffffff',
  },
};

/**
 * Get the terminal theme for the current app theme
 */
export function getTerminalTheme(): ITheme {
  const currentTheme = themeManager.getTheme()();
  return TERMINAL_THEMES[currentTheme];
}

/**
 * Get the terminal theme for a specific theme ID
 */
export function getTerminalThemeById(themeId: ThemeId): ITheme {
  return TERMINAL_THEMES[themeId];
}

// Legacy ZED_THEME for backwards compatibility (dark theme values)
export const ZED_THEME = {
  // Backgrounds
  bg: {
    app: '#0a0a0a',
    panel: '#111111',
    surface: '#1a1a1a',
    hover: '#1f1f1f',
    active: '#252525',
    overlay: '#2a2a2a',
  },

  // Borders
  border: {
    subtle: '#1a1a1a',
    default: '#252525',
    focus: '#3a3a3a',
    active: '#0b93f6',
  },

  // Text
  text: {
    primary: '#e6e6e6',
    secondary: '#9e9e9e',
    tertiary: '#6e6e6e',
    disabled: '#4e4e4e',
    inverse: '#0a0a0a',
  },

  // Accents
  accent: {
    blue: '#0b93f6',
    blueHover: '#0d7bd9',
    green: '#26d97f',
    greenHover: '#20b869',
    yellow: '#f5c249',
    red: '#f23c3c',
    redHover: '#d93232',
    purple: '#b88ef2',
    orange: '#ff8c42',
  },

  // Semantic
  semantic: {
    success: '#26d97f',
    warning: '#f5c249',
    error: '#f23c3c',
    info: '#0b93f6',
  },

  // Terminal (ANSI colors)
  terminal: {
    black: '#1a1a1a',
    red: '#f23c3c',
    green: '#26d97f',
    yellow: '#f5c249',
    blue: '#0b93f6',
    magenta: '#b88ef2',
    cyan: '#26d9d9',
    white: '#e6e6e6',
    brightBlack: '#4e4e4e',
    brightRed: '#ff5252',
    brightGreen: '#3dff95',
    brightYellow: '#ffd65e',
    brightBlue: '#3da8ff',
    brightMagenta: '#d1a3ff',
    brightCyan: '#3dffff',
    brightWhite: '#ffffff',
  },

  // Syntax highlighting
  syntax: {
    comment: '#6e6e6e',
    keyword: '#b88ef2',
    string: '#26d97f',
    number: '#f5c249',
    function: '#0b93f6',
    variable: '#e6e6e6',
    type: '#26d9d9',
    constant: '#ff8c42',
  },
} as const;

export type ZedTheme = typeof ZED_THEME;

// Spacing scale (inspired by Zed's consistent spacing)
export const SPACING = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '0.75rem',   // 12px
  lg: '1rem',      // 16px
  xl: '1.5rem',    // 24px
  '2xl': '2rem',   // 32px
  '3xl': '3rem',   // 48px
} as const;

// Border radius scale
export const RADIUS = {
  sm: '0.25rem',   // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  full: '9999px',
} as const;

// Typography scale
export const FONT_SIZE = {
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  base: '1rem',     // 16px
  lg: '1.125rem',   // 18px
  xl: '1.25rem',    // 20px
  '2xl': '1.5rem',  // 24px
  '3xl': '1.875rem',// 30px
} as const;

export const FONT_WEIGHT = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

// Animation durations
export const DURATION = {
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
} as const;

// Z-index layers
export const Z_INDEX = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
} as const;
