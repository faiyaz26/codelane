import { createSignal, type Component } from 'solid-js';
import { listExtensions, type ExtensionManifest } from '../lib/extension-api';
import { listLanes } from '../lib/lane-api';
import { tabManager } from './TabManager';
import { extensionSettingsManager, type ExtensionSettingSchema } from './ExtensionSettingsManager';
import { statusBarManager, type StatusBarItem } from './StatusBarManager';
import { dialogManager, type DialogOptions } from './DialogManager';
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
  openDialog: (options: DialogOptions) => void;
  closeDialog: () => void;
  
  // Data Hooks API
  terminal: {
    write: (terminalId: string, data: string) => Promise<void>;
    resize: (terminalId: string, cols: number, rows: number) => Promise<void>;
    getSize: (terminalId: string) => { cols: number; rows: number } | undefined;
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
        if (ext.main_frontend && ext.running) {
          await this.loadExtension(ext);
        }
      }
    } catch (err) {
      console.error('[ExtensionLoader] Failed to initialize:', err);
    }
  }

  /**
   * Load an extension by its ID
   */
  async loadExtensionById(id: string): Promise<void> {
    const all = await listExtensions();
    const manifest = all.find(e => e.id === id);
    if (manifest && manifest.main_frontend) {
      await this.loadExtension(manifest);
    }
  }

  /**
   * Unload an extension
   */
  async unloadExtension(id: string): Promise<void> {
    if (!this.loadedExtensions.has(id)) return;

    console.info(`[ExtensionLoader] Unloading extension: ${id}`);

    // Remove registered tabs
    for (const type of Array.from(this.registeredTabs.keys())) {
      if (type.startsWith(`${id}:`)) {
        this.registeredTabs.delete(type);
      }
    }

    // Remove status bar items
    // First, find all items belonging to this extension
    const items = statusBarManager.getItems()();
    for (const item of items) {
      if (item.id === id || item.id.startsWith(`${id}:`)) {
        statusBarManager.removeItem(item.id);
      }
    }

    // Remove settings definition
    extensionSettingsManager.unregisterSettings(id);

    this.loadedExtensions.delete(id);
    
    // We can't really "un-import" a JS module easily in standard browsers,
    // but removing its UI footprints (tabs, buttons) is sufficient for the "Disable" effect.
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
        openDialog: (options: DialogOptions) => {
          dialogManager.open(options);
        },
        closeDialog: () => {
          dialogManager.close();
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
          resize: async (terminalId: string, cols: number, rows: number) => {
            if (!manifest.permissions.includes('terminal:write')) {
              throw new Error(`Extension ${manifest.id} lacks 'terminal:write' permission`);
            }
            const handle = terminalPool.getHandle(terminalId);
            if (handle) {
              await handle.pty.resize(cols, rows);
            }
          },
          getSize: (terminalId: string) => {
            const handle = terminalPool.getHandle(terminalId);
            if (handle && handle.terminal) {
              return { cols: handle.terminal.cols, rows: handle.terminal.rows };
            }
            return undefined;
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

      // We append a timestamp to bypass cache during development.
      const finalUrl = `${bundleUrl}?t=${Date.now()}`;
      console.info(`[ExtensionLoader] Injecting extension script: ${finalUrl}`);
      
      const loadScript = (url: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = url;
          script.onload = () => resolve();
          script.onerror = (e) => reject(e);
          document.head.appendChild(script);
        });
      };

      try {
        await loadScript(finalUrl);
      } catch (err) {
        throw new Error(`Failed to load script: ${finalUrl}`);
      }

      // Small delay to ensure script initialization is complete in some webview environments
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check global registry after script load
      const extensionModule = (window as any).CodeLaneExtensions?.[manifest.id];

      if (extensionModule && typeof extensionModule.activate === 'function') {
        extensionModule.activate(context);
        this.loadedExtensions.add(manifest.id);
        console.info(`[ExtensionLoader] Extension activated: ${manifest.id}`);
      } else {
        throw new Error(`Extension ${manifest.id} entry point not found in window.CodeLaneExtensions`);
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
