import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { UpdateToast } from '../UpdateToast';
import { updaterService } from '../../services/UpdaterService';

// Mock UpdaterService to control its values
vi.mock('../../services/UpdaterService', () => {
  return {
    updaterService: {
      status: vi.fn(),
      updateVersion: vi.fn(),
      downloadProgress: vi.fn(),
      downloadAndInstall: vi.fn(),
      dismiss: vi.fn(),
    },
  };
});

describe('UpdateToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (updaterService.status as any).mockReturnValue('idle');
    (updaterService.updateVersion as any).mockReturnValue(null);
    (updaterService.downloadProgress as any).mockReturnValue(0);
  });

  it('is not visible when status is idle', () => {
    render(() => <UpdateToast />);
    const toast = screen.queryByText('Update Available');
    expect(toast).toBeNull();
  });

  it('shows version and action buttons when update is available', () => {
    (updaterService.status as any).mockReturnValue('available');
    (updaterService.updateVersion as any).mockReturnValue('1.2.3');

    render(() => <UpdateToast />);

    expect(screen.getByText('Update Available')).toBeDefined();
    expect(screen.getByText(/1\.2\.3/)).toBeDefined();
    expect(screen.getByText('Download & Install')).toBeDefined();
    expect(screen.getByText('Later')).toBeDefined();
  });

  it('calls downloadAndInstall when button is clicked', () => {
    (updaterService.status as any).mockReturnValue('available');
    (updaterService.updateVersion as any).mockReturnValue('1.2.3');

    render(() => <UpdateToast />);
    
    const downloadBtn = screen.getByText('Download & Install');
    fireEvent.click(downloadBtn);

    expect(updaterService.downloadAndInstall).toHaveBeenCalled();
  });

  it('shows progress bar during download', () => {
    (updaterService.status as any).mockReturnValue('downloading');
    (updaterService.downloadProgress as any).mockReturnValue(45);

    render(() => <UpdateToast />);

    expect(screen.getByText('Downloading…')).toBeDefined();
    expect(screen.getByText('45%')).toBeDefined();
  });

  it('calls dismiss when Later is clicked', () => {
    (updaterService.status as any).mockReturnValue('available');
    
    render(() => <UpdateToast />);
    
    const laterBtn = screen.getByText('Later');
    fireEvent.click(laterBtn);

    expect(updaterService.dismiss).toHaveBeenCalledWith(true);
  });
});
