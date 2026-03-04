import { createSignal } from 'solid-js';

export interface ExtensionSettingSchema {
  id: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  title: string;
  description?: string;
  defaultValue?: any;
  options?: { label: string; value: any }[]; // For select type
}

export interface ExtensionSettingsDefinition {
  extensionId: string;
  schemas: ExtensionSettingSchema[];
}

class ExtensionSettingsManager {
  private definitions;
  private setDefinitions;
  
  constructor() {
    const [definitions, setDefinitions] = createSignal<ExtensionSettingsDefinition[]>([]);
    this.definitions = definitions;
    this.setDefinitions = setDefinitions;
  }

  registerSettings(definition: ExtensionSettingsDefinition) {
    this.setDefinitions(prev => {
      const existing = prev.findIndex(d => d.extensionId === definition.extensionId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = definition;
        return next;
      }
      return [...prev, definition];
    });
  }

  getDefinitions() {
    return this.definitions;
  }

  getDefinition(extensionId: string) {
    return this.definitions().find(d => d.extensionId === extensionId);
  }

  async loadSettings(extensionId: string): Promise<Record<string, any>> {
    const stored = localStorage.getItem(`codelane-ext-settings-${extensionId}`);
    const settings = stored ? JSON.parse(stored) : {};
    
    // Merge with defaults
    const def = this.getDefinition(extensionId);
    if (def) {
      def.schemas.forEach(schema => {
        if (settings[schema.id] === undefined && schema.defaultValue !== undefined) {
          settings[schema.id] = schema.defaultValue;
        }
      });
    }
    return settings;
  }

  async saveSettings(extensionId: string, settings: Record<string, any>) {
    localStorage.setItem(`codelane-ext-settings-${extensionId}`, JSON.stringify(settings));
  }
}

export const extensionSettingsManager = new ExtensionSettingsManager();
