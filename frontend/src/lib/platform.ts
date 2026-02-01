/**
 * Platform detection utility
 *
 * Detects the current OS platform once at app startup.
 * This is static and doesn't change during runtime.
 */

import { platform as tauriPlatform } from '@tauri-apps/plugin-os';

export type Platform = 'macos' | 'windows' | 'linux';

// Module-level state (initialized once)
let detectedPlatform: Platform | null = null;
let initPromise: Promise<Platform> | null = null;

/**
 * Initialize platform detection.
 * Call this once during app startup.
 * Safe to call multiple times - will only detect once.
 */
export async function initPlatform(): Promise<Platform> {
  // Return cached result if already detected
  if (detectedPlatform !== null) {
    return detectedPlatform;
  }

  // Return existing promise if detection is in progress
  if (initPromise !== null) {
    return initPromise;
  }

  // Start detection
  initPromise = detectPlatform();
  detectedPlatform = await initPromise;

  return detectedPlatform;
}

/**
 * Get the current platform synchronously.
 * Returns null if not yet initialized.
 * Use getPlatformSync() for non-null result after initialization.
 */
export function getPlatform(): Platform | null {
  return detectedPlatform;
}

/**
 * Get the current platform synchronously.
 * Throws if not yet initialized - call initPlatform() first.
 */
export function getPlatformSync(): Platform {
  if (detectedPlatform === null) {
    throw new Error('Platform not initialized. Call initPlatform() first.');
  }
  return detectedPlatform;
}

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return detectedPlatform === 'macos';
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
  return detectedPlatform === 'windows';
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
  return detectedPlatform === 'linux';
}

/**
 * Internal platform detection logic
 */
async function detectPlatform(): Promise<Platform> {
  try {
    const os = await tauriPlatform();
    if (os === 'macos' || os === 'windows' || os === 'linux') {
      console.log('[platform] Detected via Tauri:', os);
      return os;
    }
  } catch (err) {
    console.warn('[platform] Tauri detection failed, using fallback:', err);
  }

  // Fallback to navigator detection
  const nav = navigator.platform.toLowerCase();
  if (nav.includes('mac')) {
    console.log('[platform] Detected via navigator: macos');
    return 'macos';
  } else if (nav.includes('win')) {
    console.log('[platform] Detected via navigator: windows');
    return 'windows';
  }

  console.log('[platform] Defaulting to: linux');
  return 'linux';
}
