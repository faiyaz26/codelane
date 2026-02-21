import { describe, it, expect, vi, beforeEach } from 'vitest';

// ThemeManager uses document.documentElement at module level, so mock it
const classListMock = {
  add: vi.fn(),
  remove: vi.fn(),
};
vi.stubGlobal('document', {
  documentElement: {
    classList: classListMock,
  },
});

// Import pure functions (these don't trigger module-level side effects that need DOM)
import {
  THEMES,
  getAllShikiThemes,
  getShikiTheme,
  isThemeDark,
} from '../ThemeManager';

describe('ThemeManager pure functions', () => {
  describe('THEMES', () => {
    it('contains codelane-dark, dark, and light themes', () => {
      const ids = THEMES.map((t) => t.id);
      expect(ids).toContain('codelane-dark');
      expect(ids).toContain('dark');
      expect(ids).toContain('light');
    });

    it('each theme has required fields', () => {
      for (const theme of THEMES) {
        expect(theme.id).toBeTruthy();
        expect(theme.name).toBeTruthy();
        expect(theme.description).toBeTruthy();
        expect(theme.shikiTheme).toBeTruthy();
        expect(typeof theme.isDark).toBe('boolean');
      }
    });
  });

  describe('getAllShikiThemes', () => {
    it('returns unique shiki themes', () => {
      const themes = getAllShikiThemes();
      expect(themes.length).toBeGreaterThan(0);
      // Should be unique
      expect(new Set(themes).size).toBe(themes.length);
    });

    it('includes expected shiki themes', () => {
      const themes = getAllShikiThemes();
      expect(themes).toContain('one-dark-pro');
      expect(themes).toContain('github-dark-default');
      expect(themes).toContain('github-light-default');
    });
  });

  describe('getShikiTheme', () => {
    it('returns correct shiki theme for codelane-dark', () => {
      expect(getShikiTheme('codelane-dark')).toBe('one-dark-pro');
    });

    it('returns correct shiki theme for dark', () => {
      expect(getShikiTheme('dark')).toBe('github-dark-default');
    });

    it('returns correct shiki theme for light', () => {
      expect(getShikiTheme('light')).toBe('github-light-default');
    });

    it('returns fallback for unknown theme', () => {
      expect(getShikiTheme('nonexistent' as any)).toBe('github-dark-default');
    });
  });

  describe('isThemeDark', () => {
    it('returns true for dark themes', () => {
      expect(isThemeDark('dark')).toBe(true);
      expect(isThemeDark('codelane-dark')).toBe(true);
    });

    it('returns false for light theme', () => {
      expect(isThemeDark('light')).toBe(false);
    });

    it('defaults to true for unknown theme', () => {
      expect(isThemeDark('nonexistent' as any)).toBe(true);
    });
  });
});

describe('themeManager', () => {
  let themeManager: typeof import('../ThemeManager')['themeManager'];

  beforeEach(async () => {
    classListMock.add.mockClear();
    classListMock.remove.mockClear();
    vi.resetModules();
    const mod = await import('../ThemeManager');
    themeManager = mod.themeManager;
  });

  it('getTheme returns an accessor', () => {
    const theme = themeManager.getTheme();
    expect(typeof theme).toBe('function');
    // Should default to codelane-dark (or whatever was loaded from localStorage)
    const value = theme();
    expect(['codelane-dark', 'dark', 'light']).toContain(value);
  });

  it('setTheme updates the theme', () => {
    themeManager.setTheme('light');
    expect(themeManager.getTheme()()).toBe('light');
  });

  it('setTheme persists to localStorage', () => {
    themeManager.setTheme('dark');
    expect(localStorage.getItem('codelane-theme')).toBe('dark');
  });

  it('setTheme applies CSS class to document', () => {
    themeManager.setTheme('light');
    expect(classListMock.remove).toHaveBeenCalledWith('dark', 'codelane-dark', 'light');
    expect(classListMock.add).toHaveBeenCalledWith('light');
  });

  it('loads saved theme from localStorage', async () => {
    localStorage.setItem('codelane-theme', 'light');
    vi.resetModules();
    const mod = await import('../ThemeManager');
    expect(mod.themeManager.getTheme()()).toBe('light');
  });

  it('defaults to codelane-dark when no saved theme', async () => {
    localStorage.clear();
    vi.resetModules();
    const mod = await import('../ThemeManager');
    expect(mod.themeManager.getTheme()()).toBe('codelane-dark');
  });

  it('defaults to codelane-dark for invalid saved theme', async () => {
    localStorage.setItem('codelane-theme', 'invalid-theme');
    vi.resetModules();
    const mod = await import('../ThemeManager');
    expect(mod.themeManager.getTheme()()).toBe('codelane-dark');
  });

  it('getThemeInfo returns theme info for valid theme', () => {
    const info = themeManager.getThemeInfo('dark');
    expect(info).toBeDefined();
    expect(info!.id).toBe('dark');
    expect(info!.name).toBe('Dark');
  });

  it('getThemeInfo returns undefined for invalid theme', () => {
    const info = themeManager.getThemeInfo('nonexistent' as any);
    expect(info).toBeUndefined();
  });
});
