import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extensionSettingsManager } from '../ExtensionSettingsManager';

describe('ExtensionSettingsManager', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset internal state by registering an empty array or using a test instance
  });

  it('registers and retrieves extension settings definitions', () => {
    extensionSettingsManager.registerSettings({
      extensionId: 'test-ext',
      schemas: [
        { id: 'apiKey', type: 'string', title: 'API Key' },
        { id: 'enabled', type: 'boolean', title: 'Enabled', defaultValue: true }
      ]
    });

    const def = extensionSettingsManager.getDefinition('test-ext');
    expect(def).toBeDefined();
    expect(def?.schemas.length).toBe(2);
    expect(def?.schemas[0].id).toBe('apiKey');
  });

  it('loads default values if no stored settings exist', async () => {
    extensionSettingsManager.registerSettings({
      extensionId: 'test-ext-2',
      schemas: [
        { id: 'theme', type: 'select', title: 'Theme', defaultValue: 'dark', options: [{label: 'Dark', value: 'dark'}] }
      ]
    });

    const settings = await extensionSettingsManager.loadSettings('test-ext-2');
    expect(settings.theme).toBe('dark');
  });

  it('saves and loads settings correctly', async () => {
    extensionSettingsManager.registerSettings({
      extensionId: 'test-ext-3',
      schemas: [
        { id: 'count', type: 'number', title: 'Count' }
      ]
    });

    await extensionSettingsManager.saveSettings('test-ext-3', { count: 42 });
    
    const settings = await extensionSettingsManager.loadSettings('test-ext-3');
    expect(settings.count).toBe(42);
  });
});
