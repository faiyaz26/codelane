/**
 * Tauri Store wrapper for persistent JSON storage.
 *
 * Replaces SQLite with a simple JSON file stored at:
 * - Dev:  ~/.codelane/dev/codelane-data.json
 * - Prod: ~/.codelane/prod/codelane-data.json
 */

import { load } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import type { Store } from '@tauri-apps/plugin-store';

let storeInstance: Store | null = null;

/**
 * Get the singleton store instance.
 * Loads the store from the backend-provided path on first call.
 */
export async function getStore(): Promise<Store> {
  if (!storeInstance) {
    const storePath = await invoke<string>('get_store_path');
    storeInstance = await load(storePath, { autoSave: false });
  }
  return storeInstance;
}
