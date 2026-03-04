import { createSignal, type Component } from 'solid-js';
import { listExtensions, type ExtensionManifest } from '../lib/extension-api';
import { listLanes } from '../lib/lane-api';
import { tabManager } from './TabManager';
import { extensionSettingsManager, type ExtensionSettingSchema } from './ExtensionSettingsManager';
import { statusBarManager, type StatusBarItem } from './StatusBarManager';
import { terminalPool } from './TerminalPool';
import { codeReviewStore } from './CodeReviewStore';
import type { UnlistenFn } from '@tauri-apps/api/event';

export interface ExtensionContext {
  id: string;
  manifest: ExtensionManifest;
  registerTab: (type: string, component: Component<any>) => void;
  createTab: (laneId: string, title: string, metadata?: any) => Promise<void>;
  registerSettings: (schemas: ExtensionSettingSchema[]) => void;
  getSettings: () => Promise<Record<string, any>>;
  registerStatusBarItem: (item: Omit<StatusBarItem, 'id'> & { id?: string }) => void;
  
  // Data Hooks API
  terminal: {
    write: (terminalId: string, data: string) => Promise<void>;
    onData: (terminalId: string, callback: (data: Uint8Array) => void) => Promise<UnlistenFn | undefined>;
    getActiveIds: () => string[];
  };
  lanes: {
    list: () => Promise<any[]>;
  };
  review: {
    getState: (laneId: string) => any;
  };
}

class ExtensionLoader {
  private registeredTabs = new Map<string, Component<any>>();
  private loadedExtensions = new Set<string>();
  private extensions: () => ExtensionManifest[];
  private setExtensions: (exts: ExtensionManifest[]) => void;

  constructor() {
    const [extensions, setExtensions] = createSignal<ExtensionManifest[]>([]);
    this.extensions = extensions;
    this.setExtensions = setExtensions;
  }

  /**
   * Initialize and load enabled extensions
   */
  async initialize(): Promise<void> {
    try {
      const allExtensions = await listExtensions();
      this.setExtensions(allExtensions);
      
      // For now, we "auto-load" all discovered extensions that have a frontend
      for (const ext of allExtensions) {
        if (ext.main_frontend && ext.running !== false) {
          await this.loadExtension(ext);
        }
      }
    } catch (err) {
      console.error('[ExtensionLoader] Failed to initialize:', err);
    }
  }

  /**
   * Load a single extension frontend bundle
   */
  private async loadExtension(manifest: ExtensionManifest): Promise<void> {
    if (this.loadedExtensions.has(manifest.id)) return;

    const bundleUrl = `codelane-assets://extensions/${manifest.id}/${manifest.main_frontend}`;
    console.info(`[ExtensionLoader] Loading extension: ${manifest.name} from ${bundleUrl}`);

    try {
      // Create the API context for this extension
      const context: ExtensionContext = {
        id: manifest.id,
        manifest,
        registerTab: (type: string, component: Component<any>) => {
          const namespacedType = `${manifest.id}:${type}`;
          this.registeredTabs.set(namespacedType, component);
          console.info(`[ExtensionLoader] Registered tab type: ${namespacedType}`);
        },
        createTab: async (laneId: string, title: string, metadata?: any) => {
          await tabManager.createTab(laneId, {
            type: 'extension',
            title,
            extensionId: manifest.id,
            metadata: {
              ...metadata,
              extensionType: metadata?.type || 'default'
            }
          });
        },
        registerSettings: (schemas: ExtensionSettingSchema[]) => {
          extensionSettingsManager.registerSettings({
            extensionId: manifest.id,
            schemas
          });
          console.info(`[ExtensionLoader] Registered settings for: ${manifest.id}`);
        },
        getSettings: async () => {
          return await extensionSettingsManager.loadSettings(manifest.id);
        },
        registerStatusBarItem: (item) => {
          const itemId = item.id ? `${manifest.id}:${item.id}` : manifest.id;
          statusBarManager.registerItem({
            ...item,
            id: itemId
          });
          console.info(`[ExtensionLoader] Registered status bar item for: ${manifest.id}`);
        },
        terminal: {
          write: async (terminalId: string, data: string) => {
            if (!manifest.permissions.includes('terminal:write')) {
              throw new Error(`Extension ${manifest.id} lacks 'terminal:write' permission`);
            }
            const handle = terminalPool.getHandle(terminalId);
            if (handle) {
              await handle.pty.write(data);
            }
          },
          onData: async (terminalId: string, callback: (data: Uint8Array) => void) => {
            if (!manifest.permissions.includes('terminal:read')) {
              throw new Error(`Extension ${manifest.id} lacks 'terminal:read' permission`);
            }
            const handle = terminalPool.getHandle(terminalId);
            if (handle) {
              // We want to tap into the output without stealing it from the terminal view
              return await handle.pty.onData(callback);
            }
            return undefined;
          },
          getActiveIds: () => {
             if (!manifest.permissions.includes('terminal:read')) return [];
             return terminalPool.getAllHandles().map(h => h.id);
          }
        },
        lanes: {
          list: async () => {
             return await listLanes();
          }
        },
        review: {
          getState: (laneId: string) => {
            // Need a snapshot to send over wire
            return codeReviewStore.getState(laneId)(); 
          }
        }
      };

      // In a real environment, we'd use a more robust loader or an iframe.
      // For the prototype, we use dynamic import if it's a JS module, 
      // or a script tag injection that calls a global init function.
      
      // For now, we assume extensions export an `activate(context)` function.
      // We append a timestamp to bypass cache during development.
      const module = await import(/* @vite-ignore */ `${bundleUrl}?t=${Date.now()}`);
      
      if (typeof module.activate === 'function') {
        await module.activate(context);
        this.loadedExtensions.add(manifest.id);
        console.info(`[ExtensionLoader] Extension activated: ${manifest.id}`);
      } else {
        console.error(`[ExtensionLoader] Extension ${manifest.id} does not export an activate function`);
      }
    } catch (err) {
      console.error(`[ExtensionLoader] Failed to load extension ${manifest.id}:`, err);
    }
  }

  /**
   * Get a registered tab component by type
   */
  getTabComponent(type: string): Component<any> | undefined {
    return this.registeredTabs.get(type);
  }

  /**
   * Get all loaded extensions
   */
  getLoadedExtensions(): string[] {
    return Array.from(this.loadedExtensions);
  }
}

export const extensionLoader = new ExtensionLoader();
