// Custom Language Manager
// Bridges user-defined language configs (stored in EditorSettings) with the Shiki highlighter.

import { createRoot, createEffect } from 'solid-js';
import { editorSettingsManager } from './EditorSettingsManager';
import { _setCustomLanguages, customLangSlug, type CustomLanguageConfig } from '../components/editor/types';
import type { LanguageRegistration } from 'shiki';

class CustomLanguageManagerImpl {
  // extension (lowercase) → Shiki language ID
  private extensionMap = new Map<string, string>();

  // Shiki language ID → LanguageRegistration (grammar mode only)
  private grammarRegistrations = new Map<string, LanguageRegistration>();

  // Tracks which grammar-mode languages have been loaded into a Shiki instance
  private loadedGrammarIds = new Set<string>();

  constructor() {
    // Rebuild whenever the custom language list changes (reactive via SolidJS)
    createRoot(() => {
      createEffect(() => {
        const langs = editorSettingsManager.getSettings()().customLanguages ?? [];
        this.rebuild(langs);
      });
    });
  }

  private rebuild(langs: CustomLanguageConfig[]): void {
    this.extensionMap.clear();
    this.grammarRegistrations.clear();
    // Note: we intentionally keep loadedGrammarIds — Shiki doesn't support unloading.

    for (const lang of langs) {
      const shikiId = lang.aliasFor ?? customLangSlug(lang.name);

      for (const ext of lang.extensions) {
        this.extensionMap.set(ext.toLowerCase(), shikiId);
      }

      // Grammar mode: parse the TextMate JSON and register for later loading into Shiki
      if (!lang.aliasFor && lang.grammar && lang.scopeName) {
        try {
          const grammarObj = JSON.parse(lang.grammar) as Record<string, unknown>;
          this.grammarRegistrations.set(shikiId, {
            name: shikiId,
            scopeName: lang.scopeName,
            ...grammarObj,
          } as LanguageRegistration);
        } catch {
          console.warn(`[CustomLanguageManager] Invalid grammar JSON for: ${lang.name}`);
        }
      }
    }

    // Sync into the detectLanguage() module-level registry
    _setCustomLanguages(langs);
  }

  /**
   * Returns the Shiki language ID for a file extension, or null if not a custom language.
   * Used by detectLanguage() — but detectLanguage already reads _customLangs directly,
   * so this is mainly for external consumers.
   */
  resolveExtension(ext: string): string | null {
    return this.extensionMap.get(ext.toLowerCase()) ?? null;
  }

  /**
   * Loads any pending grammar-mode custom languages into the provided Shiki highlighter.
   * Safe to call multiple times — already-loaded grammars are skipped.
   */
  async loadGrammarsIntoHighlighter(highlighter: { loadLanguage: (lang: LanguageRegistration) => Promise<void> }): Promise<void> {
    for (const [langId, registration] of this.grammarRegistrations) {
      if (!this.loadedGrammarIds.has(langId)) {
        try {
          await highlighter.loadLanguage(registration);
          this.loadedGrammarIds.add(langId);
        } catch (e) {
          console.warn(`[CustomLanguageManager] Failed to load grammar for: ${langId}`, e);
        }
      }
    }
  }

  /** Returns true if the given Shiki language ID corresponds to a custom TextMate grammar. */
  isCustomGrammar(langId: string): boolean {
    return this.grammarRegistrations.has(langId);
  }
}

export const customLanguageManager = new CustomLanguageManagerImpl();
