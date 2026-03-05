import { describe, it, expect, vi } from 'vitest';

/**
 * Pure function tests for ThemeManager
 * 
 * We skip testing the 'themeManager' singleton instance here because it 
 * has module-level side effects that import Kobalte/DOM utils, which 
 * are difficult to stub reliably in this environment.
 */

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
      expect(new Set(themes).size).toBe(themes.length);
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
  });

  describe('isThemeDark', () => {
    it('returns true for dark themes', () => {
      expect(isThemeDark('dark')).toBe(true);
      expect(isThemeDark('codelane-dark')).toBe(true);
    });

    it('returns false for light theme', () => {
      expect(isThemeDark('light')).toBe(false);
    });
  });
});
