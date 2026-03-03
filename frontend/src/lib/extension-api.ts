/**
 * Extension API - Backend-based extension management
 */

import { invoke } from '@tauri-apps/api/core';

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string | null;
  main_backend: string | null;
  main_frontend: string | null;
  permissions: string[];
}

/**
 * Lists all discovered extensions
 */
export async function listExtensions(force = false): Promise<ExtensionManifest[]> {
  return await invoke<ExtensionManifest[]>('extension_list', { force });
}

/**
 * Starts an extension by ID
 */
export async function startExtension(id: string): Promise<void> {
  await invoke('extension_start', { id });
}

/**
 * Stops an extension by ID
 */
export async function stopExtension(id: string): Promise<void> {
  await invoke('extension_stop', { id });
}
