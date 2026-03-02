import { onMount, onCleanup } from 'solid-js';
import type { Setter } from 'solid-js';
import { updaterService } from '../services/UpdaterService';

export function useGlobalMenuEvents(
  setAboutOpen: Setter<boolean>,
  setOnboardingOpen: Setter<boolean>
) {
  onMount(async () => {
    const { listen } = await import('@tauri-apps/api/event');

    const unlistenAbout = await listen('menu:about', () => {
      setAboutOpen(true);
    });

    const unlistenOnboarding = await listen('menu:first-time-setup', () => {
      setOnboardingOpen(true);
    });

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
      unlistenAbout();
      unlistenOnboarding();
      unlistenCheckUpdates();
      clearTimeout(updateCheckTimer);
      clearInterval(dailyCheckInterval);
    });
  });
}
