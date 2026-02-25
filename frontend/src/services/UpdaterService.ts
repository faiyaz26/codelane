// UpdaterService - wraps tauri-plugin-updater with reactive state
//
// Usage:
//   import { updaterService } from './UpdaterService';
//   updaterService.checkForUpdates();  // trigger a check
//   updaterService.status()            // reactive signal: idle | checking | available | up-to-date | downloading | error

import { createSignal } from 'solid-js';
import type { Update } from '@tauri-apps/plugin-updater';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'error';

const [status, setStatus] = createSignal<UpdateStatus>('idle');
const [updateVersion, setUpdateVersion] = createSignal<string | null>(null);
const [releaseNotes, setReleaseNotes] = createSignal<string | null>(null);
const [downloadProgress, setDownloadProgress] = createSignal(0);
const [errorMessage, setErrorMessage] = createSignal('');

const MUTED_VERSION_KEY = 'codelane:muted-update-version';
let pendingUpdate: Update | null = null;

function resetToIdleAfter(ms: number) {
  setTimeout(() => {
    if (status() !== 'available' && status() !== 'downloading') {
      setStatus('idle');
    }
  }, ms);
}

export const updaterService = {
  // Reactive state
  status,
  updateVersion,
  releaseNotes,
  downloadProgress,
  errorMessage,

  async checkForUpdates(isManual = false): Promise<boolean> {
    if (status() === 'checking' || status() === 'downloading') return false;

    console.log(`[Updater] Starting update check (manual: ${isManual})...`);
    setStatus('checking');
    setErrorMessage('');

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      console.log('[Updater] Fetching manifest from GitHub...');
      const update = await check();

      if (update) {
        console.log(`[Updater] Found update: ${update.version} (published at ${update.date})`);
        pendingUpdate = update;
        setUpdateVersion(update.version);
        setReleaseNotes(update.body ?? null);

        // Check if user muted this specific version
        const mutedVersion = localStorage.getItem(MUTED_VERSION_KEY);
        if (!isManual && mutedVersion === update.version) {
          console.info(`[Updater] Auto-notification for ${update.version} is suppressed because it was muted by user.`);
          setStatus('idle');
          return false;
        }

        console.log(`[Updater] Showing notification for version ${update.version}`);
        setStatus('available');

        // Show native notification if possible
        try {
          const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
          let permission = await isPermissionGranted();
          if (!permission) {
            console.log('[Updater] Requesting notification permission...');
            permission = await requestPermission() === 'granted';
          }
          if (permission) {
            sendNotification({
              title: 'Update Available',
              body: `Codelane ${update.version} is ready to install.`,
              icon: 'icons/128x128.png'
            });
          }
        } catch (e) {
          console.warn('[Updater] Failed to send native notification:', e);
        }

        return true;
      } else {
        console.log('[Updater] No update found. App is up to date.');
        setStatus('up-to-date');
        resetToIdleAfter(4000);
        return false;
      }
    } catch (err) {
      console.error('[Updater] Update check failed with error:', err);
      setErrorMessage(String(err));
      setStatus('error');
      resetToIdleAfter(6000);
      return false;
    }
  },

  async downloadAndInstall(): Promise<void> {
    if (!pendingUpdate || status() !== 'available') return;

    setStatus('downloading');
    setDownloadProgress(0);

    let totalBytes = 0;
    let downloadedBytes = 0;

    try {
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalBytes = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) {
            setDownloadProgress(Math.round((downloadedBytes / totalBytes) * 100));
          }
        } else if (event.event === 'Finished') {
          setDownloadProgress(100);
        }
      });

      // Clear muted version on successful update
      localStorage.removeItem(MUTED_VERSION_KEY);

      // Relaunch after install
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      console.error('[Updater] Download/install failed:', err);
      setErrorMessage(String(err));
      setStatus('error');
      resetToIdleAfter(6000);
    }
  },

  dismiss(mute = false) {
    if (status() === 'available' || status() === 'up-to-date' || status() === 'error') {
      const currentVersion = updateVersion();
      if (mute && currentVersion) {
        localStorage.setItem(MUTED_VERSION_KEY, currentVersion);
      }
      setStatus('idle');
      pendingUpdate = null;
    }
  },
};
