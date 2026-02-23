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

  async checkForUpdates(): Promise<boolean> {
    if (status() === 'checking' || status() === 'downloading') return false;

    setStatus('checking');
    setErrorMessage('');

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update) {
        pendingUpdate = update;
        setUpdateVersion(update.version);
        setReleaseNotes(update.body ?? null);
        setStatus('available');
        return true;
      } else {
        setStatus('up-to-date');
        resetToIdleAfter(4000);
        return false;
      }
    } catch (err) {
      console.error('[Updater] Check failed:', err);
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

      // Relaunch after install — import dynamically to avoid loading process plugin
      // unless we actually need it
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      console.error('[Updater] Download/install failed:', err);
      setErrorMessage(String(err));
      setStatus('error');
      resetToIdleAfter(6000);
    }
  },

  dismiss() {
    if (status() === 'available' || status() === 'up-to-date' || status() === 'error') {
      setStatus('idle');
      pendingUpdate = null;
    }
  },
};
