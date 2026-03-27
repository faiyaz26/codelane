// Languages Settings Tab
// Allows users to enable preset languages (Terraform, Proto, etc.) and add custom
// language support via TextMate grammar JSON for syntaxes Shiki doesn't bundle.

import { createSignal, createMemo, For, Show } from 'solid-js';
import { editorSettingsManager } from '../../services/EditorSettingsManager';
import { customLangSlug, type CustomLanguageConfig } from '../editor/types';

// ─── Preset definitions ────────────────────────────────────────────────────
// Languages that Shiki already bundles but aren't mapped in detectLanguage().
// aliasFor = Shiki language ID. null = requires user-provided TextMate grammar.

interface PresetDef {
  presetKey: string;
  name: string;
  description: string;
  extensions: string[];
  aliasFor: string | null;
}

const PRESET_LANGUAGE_DEFINITIONS: PresetDef[] = [
  {
    presetKey: 'preset-terraform',
    name: 'Terraform / HCL',
    description: 'HashiCorp Configuration Language',
    extensions: ['tf', 'tfvars', 'hcl'],
    aliasFor: 'terraform',
  },
  {
    presetKey: 'preset-proto',
    name: 'Protocol Buffers',
    description: 'Google Protocol Buffers (.proto files)',
    extensions: ['proto'],
    aliasFor: 'proto',
  },
  {
    presetKey: 'preset-graphql',
    name: 'GraphQL',
    description: 'GraphQL schema and query files',
    extensions: ['graphql', 'gql'],
    aliasFor: 'graphql',
  },
  {
    presetKey: 'preset-nix',
    name: 'Nix',
    description: 'Nix expression language',
    extensions: ['nix'],
    aliasFor: 'nix',
  },
  {
    presetKey: 'preset-solidity',
    name: 'Solidity',
    description: 'Ethereum smart contracts',
    extensions: ['sol'],
    aliasFor: 'solidity',
  },
  {
    presetKey: 'preset-elixir',
    name: 'Elixir',
    description: 'Elixir programming language',
    extensions: ['ex', 'exs', 'heex'],
    aliasFor: 'elixir',
  },
  {
    presetKey: 'preset-dart',
    name: 'Dart',
    description: 'Dart language (Flutter)',
    extensions: ['dart'],
    aliasFor: 'dart',
  },
  {
    presetKey: 'preset-lookml',
    name: 'LookML',
    description: 'Looker data modeling language — requires grammar paste',
    extensions: ['lkml', 'lookml'],
    aliasFor: null,
  },
];

// ─── Form state ─────────────────────────────────────────────────────────────

interface FormState {
  id: string;
  name: string;
  extensions: string; // comma-separated
  mode: 'alias' | 'grammar';
  aliasFor: string;
  scopeName: string;
  grammar: string;
}

const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  extensions: '',
  mode: 'alias',
  aliasFor: '',
  scopeName: '',
  grammar: '',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function LanguagesSettings() {
  const settings = editorSettingsManager.getSettings();
  const customLangs = createMemo(() => settings().customLanguages ?? []);

  const [showForm, setShowForm] = createSignal(false);
  const [form, setForm] = createSignal<FormState>({ ...EMPTY_FORM });
  const [formError, setFormError] = createSignal<string | null>(null);

  // Check if a preset is currently enabled
  const isPresetEnabled = (presetKey: string) =>
    customLangs().some((l) => l.id === presetKey);

  const togglePreset = (preset: PresetDef) => {
    if (isPresetEnabled(preset.presetKey)) {
      // Disable: remove from list
      editorSettingsManager.setCustomLanguages(
        customLangs().filter((l) => l.id !== preset.presetKey)
      );
    } else if (preset.aliasFor) {
      // Enable alias preset immediately
      editorSettingsManager.setCustomLanguages([
        ...customLangs(),
        {
          id: preset.presetKey,
          name: preset.name,
          extensions: preset.extensions,
          aliasFor: preset.aliasFor,
        },
      ]);
    } else {
      // Grammar required — open form pre-filled
      openForm({
        ...EMPTY_FORM,
        id: preset.presetKey,
        name: preset.name,
        extensions: preset.extensions.join(', '),
        mode: 'grammar',
      });
    }
  };

  const openForm = (initial: FormState = { ...EMPTY_FORM, id: crypto.randomUUID() }) => {
    setForm(initial);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (lang: CustomLanguageConfig) => {
    setForm({
      id: lang.id,
      name: lang.name,
      extensions: lang.extensions.join(', '),
      mode: lang.aliasFor ? 'alias' : 'grammar',
      aliasFor: lang.aliasFor ?? '',
      scopeName: lang.scopeName ?? '',
      grammar: lang.grammar ?? '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError(null);
  };

  const saveForm = () => {
    const f = form();
    const name = f.name.trim();
    const exts = f.extensions.split(',').map((e) => e.trim().replace(/^\./, '')).filter(Boolean);

    if (!name) return setFormError('Language name is required.');
    if (exts.length === 0) return setFormError('At least one file extension is required.');
    if (f.mode === 'alias' && !f.aliasFor.trim())
      return setFormError('Existing language ID is required for alias mode.');
    if (f.mode === 'grammar') {
      if (!f.scopeName.trim()) return setFormError('Scope name is required for custom grammar.');
      if (!f.grammar.trim()) return setFormError('Grammar JSON is required for custom grammar.');
      try {
        JSON.parse(f.grammar);
      } catch {
        return setFormError('Grammar JSON is not valid JSON.');
      }
    }

    const entry: CustomLanguageConfig = {
      id: f.id || crypto.randomUUID(),
      name,
      extensions: exts,
      ...(f.mode === 'alias'
        ? { aliasFor: f.aliasFor.trim() }
        : { scopeName: f.scopeName.trim(), grammar: f.grammar.trim() }),
    };

    const without = customLangs().filter((l) => l.id !== entry.id);
    editorSettingsManager.setCustomLanguages([...without, entry]);
    closeForm();
  };

  const deleteLang = (id: string) => {
    editorSettingsManager.setCustomLanguages(customLangs().filter((l) => l.id !== id));
  };

  // User-defined custom languages (non-preset, or preset grammar entries the user configured)
  const userDefinedLangs = createMemo(() =>
    customLangs().filter((l) => !l.id.startsWith('preset-') || !l.aliasFor)
  );

  return (
    <div>
      <h2 class="text-xl font-semibold text-zed-text-primary mb-2">Languages</h2>
      <p class="text-sm text-zed-text-secondary mb-6">
        Enable syntax highlighting for uncommon languages. Preset languages use Shiki's built-in
        grammars. Custom languages let you paste a{' '}
        <span class="font-medium text-zed-text-primary">TextMate grammar JSON</span> for any syntax
        not bundled in Shiki.
      </p>

      {/* ── Preset languages ─────────────────────────────────────────────── */}
      <div class="mb-8">
        <h3 class="text-sm font-medium text-zed-text-primary mb-3">Preset Languages</h3>
        <div class="grid grid-cols-2 gap-2">
          <For each={PRESET_LANGUAGE_DEFINITIONS}>
            {(preset) => {
              const enabled = () => isPresetEnabled(preset.presetKey);
              const needsGrammar = !preset.aliasFor;
              return (
                <div
                  class={`p-3 rounded-lg border transition-colors ${
                    enabled()
                      ? 'bg-zed-accent-blue/10 border-zed-accent-blue/40'
                      : 'bg-zed-bg-surface border-zed-border-default'
                  }`}
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-zed-text-primary truncate">{preset.name}</p>
                      <p class="text-xs text-zed-text-tertiary mt-0.5 leading-snug">
                        {preset.description}
                      </p>
                      <div class="flex flex-wrap gap-1 mt-1.5">
                        <For each={preset.extensions}>
                          {(ext) => (
                            <span class="px-1 py-0.5 rounded text-[10px] font-mono bg-zed-bg-panel text-zed-text-secondary border border-zed-border-subtle">
                              .{ext}
                            </span>
                          )}
                        </For>
                      </div>
                    </div>
                    <button
                      class={`shrink-0 mt-0.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        enabled()
                          ? 'bg-zed-accent-blue text-white hover:bg-zed-accent-blue/80'
                          : needsGrammar
                          ? 'bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary border border-zed-border-default'
                          : 'bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary border border-zed-border-default'
                      }`}
                      onClick={() => togglePreset(preset)}
                    >
                      {enabled() ? 'Enabled' : needsGrammar ? 'Add grammar…' : 'Enable'}
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* ── Custom languages ─────────────────────────────────────────────── */}
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-zed-text-primary">Custom Languages</h3>
          <Show when={!showForm()}>
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-zed-accent-blue text-white hover:bg-zed-accent-blue/80 transition-colors"
              onClick={() => openForm({ ...EMPTY_FORM, id: crypto.randomUUID() })}
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Language
            </button>
          </Show>
        </div>

        {/* List */}
        <Show when={userDefinedLangs().length === 0 && !showForm()}>
          <div class="py-8 text-center rounded-lg border border-dashed border-zed-border-default bg-zed-bg-surface">
            <svg class="w-8 h-8 mx-auto mb-2 text-zed-text-disabled" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <p class="text-sm text-zed-text-tertiary">No custom languages yet</p>
            <p class="text-xs text-zed-text-disabled mt-1">
              Add a language with a TextMate grammar JSON — find grammars in VSCode extensions or on GitHub.
            </p>
          </div>
        </Show>

        <Show when={userDefinedLangs().length > 0}>
          <div class="space-y-2 mb-3">
            <For each={userDefinedLangs()}>
              {(lang) => (
                <div class="flex items-center gap-3 p-3 rounded-lg bg-zed-bg-surface border border-zed-border-default">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-medium text-zed-text-primary">{lang.name}</span>
                      <span
                        class={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          lang.aliasFor
                            ? 'bg-blue-400/10 text-blue-400'
                            : 'bg-purple-400/10 text-purple-400'
                        }`}
                      >
                        {lang.aliasFor ? `alias: ${lang.aliasFor}` : 'custom grammar'}
                      </span>
                    </div>
                    <div class="flex flex-wrap gap-1 mt-1">
                      <For each={lang.extensions}>
                        {(ext) => (
                          <span class="px-1 py-0.5 rounded text-[10px] font-mono bg-zed-bg-panel text-zed-text-secondary border border-zed-border-subtle">
                            .{ext}
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      class="p-1.5 rounded text-zed-text-tertiary hover:text-zed-text-primary hover:bg-zed-bg-hover transition-colors"
                      title="Edit"
                      onClick={() => openEditForm(lang)}
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      class="p-1.5 rounded text-zed-text-tertiary hover:text-zed-accent-red hover:bg-zed-accent-red/10 transition-colors"
                      title="Delete"
                      onClick={() => deleteLang(lang.id)}
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Add / Edit form */}
        <Show when={showForm()}>
          <div class="p-4 rounded-lg border border-zed-accent-blue/30 bg-zed-bg-surface space-y-4">
            <p class="text-sm font-medium text-zed-text-primary">
              {form().id && customLangs().some((l) => l.id === form().id) ? 'Edit Language' : 'Add Language'}
            </p>

            {/* Name */}
            <div>
              <label class="block text-xs font-medium text-zed-text-secondary mb-1">Language Name</label>
              <input
                type="text"
                placeholder="e.g. LookML"
                class="w-full px-3 py-2 text-sm rounded-md bg-zed-bg-panel border border-zed-border-default text-zed-text-primary placeholder-zed-text-disabled focus:outline-none focus:ring-1 focus:ring-zed-accent-blue"
                value={form().name}
                onInput={(e) => setForm({ ...form(), name: e.currentTarget.value })}
              />
            </div>

            {/* Extensions */}
            <div>
              <label class="block text-xs font-medium text-zed-text-secondary mb-1">
                File Extensions <span class="text-zed-text-disabled font-normal">(comma-separated, without dot)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. lkml, lookml"
                class="w-full px-3 py-2 text-sm rounded-md bg-zed-bg-panel border border-zed-border-default text-zed-text-primary placeholder-zed-text-disabled focus:outline-none focus:ring-1 focus:ring-zed-accent-blue"
                value={form().extensions}
                onInput={(e) => setForm({ ...form(), extensions: e.currentTarget.value })}
              />
            </div>

            {/* Mode toggle */}
            <div>
              <label class="block text-xs font-medium text-zed-text-secondary mb-1">Highlighting Mode</label>
              <div class="flex gap-1 p-1 bg-zed-bg-panel rounded-md border border-zed-border-default w-fit">
                <button
                  class={`px-3 py-1.5 text-xs rounded transition-colors ${
                    form().mode === 'alias'
                      ? 'bg-zed-accent-blue text-white'
                      : 'text-zed-text-secondary hover:text-zed-text-primary'
                  }`}
                  onClick={() => setForm({ ...form(), mode: 'alias' })}
                >
                  Use existing language
                </button>
                <button
                  class={`px-3 py-1.5 text-xs rounded transition-colors ${
                    form().mode === 'grammar'
                      ? 'bg-zed-accent-blue text-white'
                      : 'text-zed-text-secondary hover:text-zed-text-primary'
                  }`}
                  onClick={() => setForm({ ...form(), mode: 'grammar' })}
                >
                  Custom grammar (TextMate JSON)
                </button>
              </div>
            </div>

            {/* Alias mode */}
            <Show when={form().mode === 'alias'}>
              <div>
                <label class="block text-xs font-medium text-zed-text-secondary mb-1">
                  Shiki Language ID{' '}
                  <a
                    href="https://shiki.style/languages"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-zed-accent-blue hover:underline"
                  >
                    (see full list ↗)
                  </a>
                </label>
                <input
                  type="text"
                  placeholder="e.g. terraform, nix, proto, graphql"
                  class="w-full px-3 py-2 text-sm rounded-md bg-zed-bg-panel border border-zed-border-default text-zed-text-primary placeholder-zed-text-disabled focus:outline-none focus:ring-1 focus:ring-zed-accent-blue"
                  value={form().aliasFor}
                  onInput={(e) => setForm({ ...form(), aliasFor: e.currentTarget.value })}
                />
              </div>
            </Show>

            {/* Grammar mode */}
            <Show when={form().mode === 'grammar'}>
              <div>
                <label class="block text-xs font-medium text-zed-text-secondary mb-1">
                  Scope Name <span class="text-zed-text-disabled font-normal">(from grammar file, e.g. source.lookml)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. source.lookml"
                  class="w-full px-3 py-2 text-sm rounded-md bg-zed-bg-panel border border-zed-border-default text-zed-text-primary placeholder-zed-text-disabled focus:outline-none focus:ring-1 focus:ring-zed-accent-blue"
                  value={form().scopeName}
                  onInput={(e) => setForm({ ...form(), scopeName: e.currentTarget.value })}
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-zed-text-secondary mb-1">
                  TextMate Grammar JSON{' '}
                  <span class="text-zed-text-disabled font-normal">
                    — find in VSCode extensions (
                    <a
                      href="https://marketplace.visualstudio.com/search?target=VSCode&category=Programming%20Languages"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-zed-accent-blue hover:underline"
                    >
                      Marketplace ↗
                    </a>
                    , look for <code class="text-zed-text-secondary">.tmLanguage.json</code> in the extension source)
                  </span>
                </label>
                <textarea
                  rows="8"
                  placeholder={'{\n  "name": "LookML",\n  "scopeName": "source.lookml",\n  "patterns": [...]\n}'}
                  class="w-full px-3 py-2 text-xs font-mono rounded-md bg-zed-bg-panel border border-zed-border-default text-zed-text-primary placeholder-zed-text-disabled focus:outline-none focus:ring-1 focus:ring-zed-accent-blue resize-y"
                  value={form().grammar}
                  onInput={(e) => setForm({ ...form(), grammar: e.currentTarget.value })}
                />
              </div>
            </Show>

            {/* Error */}
            <Show when={formError()}>
              <p class="text-xs text-zed-accent-red">{formError()}</p>
            </Show>

            {/* Actions */}
            <div class="flex gap-2 pt-1">
              <button
                class="px-4 py-1.5 text-sm font-medium rounded-md bg-zed-accent-blue text-white hover:bg-zed-accent-blue/80 transition-colors"
                onClick={saveForm}
              >
                Save
              </button>
              <button
                class="px-4 py-1.5 text-sm font-medium rounded-md text-zed-text-secondary hover:text-zed-text-primary bg-zed-bg-hover border border-zed-border-default transition-colors"
                onClick={closeForm}
              >
                Cancel
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
