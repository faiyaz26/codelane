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
  running: boolean;
}

export interface RegistryExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  repository: string;
  download_url: string;
  sha256: string;
  permissions: string[];
}

export interface ExtensionRegistry {
  extensions: RegistryExtension[];
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

/**
 * Uninstalls an extension by ID
 */
export async function uninstallExtension(id: string): Promise<void> {
  await invoke('extension_uninstall', { id });
}

/**
 * Fetches the extension registry from GitHub
 */
export async function getExtensionRegistry(): Promise<ExtensionRegistry> {
  return await invoke<ExtensionRegistry>('extension_get_registry');
}

/**
 * Installs an extension from a URL
 */
export async function installExtension(downloadUrl: string, sha256: string): Promise<void> {
  await invoke('extension_install', { downloadUrl, sha256 });
}
