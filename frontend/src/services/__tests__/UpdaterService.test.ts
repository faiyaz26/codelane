import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updaterService } from '../UpdaterService';

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

// Mock localStorage for node environment
const localStorageMap = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
});

describe('UpdaterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset service state manually since it uses module-level signals
    updaterService.dismiss(); 
  });

  it('initializes with idle status', () => {
    expect(updaterService.status()).toBe('idle');
  });

  it('updates status to available when update is found and sends notification', async () => {
    const { check } = await import('@tauri-apps/plugin-updater');
    const { isPermissionGranted, sendNotification } = await import('@tauri-apps/plugin-notification');
    
    (isPermissionGranted as any).mockResolvedValue(true);
    const mockUpdate = {
      version: '1.2.3',
      date: '2023-01-01',
      body: 'Release notes',
      downloadAndInstall: vi.fn(),
    };
    (check as any).mockResolvedValue(mockUpdate);

    await updaterService.checkForUpdates(true);

    expect(updaterService.status()).toBe('available');
    expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Update Available',
      body: expect.stringContaining('1.2.3'),
    }));
  });

  it('updates status to up-to-date when no update is found', async () => {
    const { check } = await import('@tauri-apps/plugin-updater');
    (check as any).mockResolvedValue(null);

    await updaterService.checkForUpdates(true);

    expect(updaterService.status()).toBe('up-to-date');
  });

  it('handles errors during update check', async () => {
    const { check } = await import('@tauri-apps/plugin-updater');
    (check as any).mockRejectedValue(new Error('Network error'));

    await updaterService.checkForUpdates(true);

    expect(updaterService.status()).toBe('error');
    expect(updaterService.errorMessage()).toContain('Network error');
  });

  it('mutes updates when dismissed with mute flag', async () => {
    const { check } = await import('@tauri-apps/plugin-updater');
    const mockUpdate = {
      version: '1.2.3',
      date: '2023-01-01',
      body: 'Release notes',
      downloadAndInstall: vi.fn(),
    };
    (check as any).mockResolvedValue(mockUpdate);

    // First check, find update
    await updaterService.checkForUpdates(true);
    expect(updaterService.status()).toBe('available');

    // Dismiss with mute
    updaterService.dismiss(true);
    expect(updaterService.status()).toBe('idle');
    expect(localStorage.getItem('codelane:muted-update-version')).toBe('1.2.3');

    // Check again (auto check, not manual)
    await updaterService.checkForUpdates(false);
    expect(updaterService.status()).toBe('idle'); // Should stay idle because it's muted
  });

  it('overrides mute when manual check is performed', async () => {
    const { check } = await import('@tauri-apps/plugin-updater');
    const mockUpdate = {
      version: '1.2.3',
      date: '2023-01-01',
      body: 'Release notes',
      downloadAndInstall: vi.fn(),
    };
    (check as any).mockResolvedValue(mockUpdate);

    localStorage.setItem('codelane:muted-update-version', '1.2.3');

    // Manual check should still show the update
    await updaterService.checkForUpdates(true);
    expect(updaterService.status()).toBe('available');
  });

  it('handles download and install process', async () => {
    const { check } = await import('@tauri-apps/plugin-updater');
    const { relaunch } = await import('@tauri-apps/plugin-process');
    
    let progressCallback: any;
    const mockUpdate = {
      version: '1.2.3',
      downloadAndInstall: vi.fn((cb) => {
        progressCallback = cb;
        return Promise.resolve();
      }),
    };
    (check as any).mockResolvedValue(mockUpdate);

    await updaterService.checkForUpdates(true);
    const downloadPromise = updaterService.downloadAndInstall();

    expect(updaterService.status()).toBe('downloading');

    // Simulate progress
    progressCallback({ event: 'Started', data: { contentLength: 100 } });
    progressCallback({ event: 'Progress', data: { chunkLength: 50 } });
    expect(updaterService.downloadProgress()).toBe(50);

    progressCallback({ event: 'Finished' });
    expect(updaterService.downloadProgress()).toBe(100);

    await downloadPromise;
    expect(relaunch).toHaveBeenCalled();
  });
});
