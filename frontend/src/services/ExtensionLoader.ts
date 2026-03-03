import { createSignal, type Component } from 'solid-js';
import { listExtensions, type ExtensionManifest } from '../lib/extension-api';
import { tabManager } from './TabManager';

export interface ExtensionContext {
  id: string;
  manifest: ExtensionManifest;
  registerTab: (type: string, component: Component<any>) => void;
  createTab: (laneId: string, title: string, metadata?: any) => Promise<void>;
}

class ExtensionLoader {
  private registeredTabs = new Map<string, Component<any>>();
  private loadedExtensions = new Set<string>();
  private [extensions, setExtensions] = createSignal<ExtensionManifest[]>([]);

  /**
   * Initialize and load enabled extensions
   */
  async initialize(): Promise<void> {
    try {
      const allExtensions = await listExtensions();
      setExtensions(allExtensions);
      
      // For now, we "auto-load" all discovered extensions that have a frontend
      for (const ext of allExtensions) {
        if (ext.main_frontend) {
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
