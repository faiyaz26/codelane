import { onMount, onCleanup } from 'solid-js';
import { updaterService } from '../services/UpdaterService';

/**
 * Initializes auto-updater checks and listeners.
 */
export function useAutoUpdater() {
  onMount(async () => {
    const { listen } = await import('@tauri-apps/api/event');

    const unlistenCheckUpdates = await listen('menu:check-for-updates', () => {
      updaterService.checkForUpdates(true);
    });

    // Check for updates ~10 seconds after startup (non-blocking)
    const updateCheckTimer = setTimeout(() => {
      updaterService.checkForUpdates(false);
    }, 10_000);

    // Periodic check every 24 hours if the app is left running
    const dailyCheckInterval = setInterval(() => {
      updaterService.checkForUpdates(false);
    }, 24 * 60 * 60 * 1000);

    onCleanup(() => {
      unlistenCheckUpdates();
      clearTimeout(updateCheckTimer);
      clearInterval(dailyCheckInterval);
    });
  });
}
