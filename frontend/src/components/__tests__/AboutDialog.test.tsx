import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

// Mock Tauri app API
vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(async () => '1.2.3'),
}));

// Mock ThemeManager (module-level side effects)
vi.mock('../../services/ThemeManager', () => ({
  themeManager: {
    getTheme: () => () => 'codelane-dark',
  },
}));

// Mock image imports
vi.mock('../../assets/codelane-logo-white.png', () => ({
  default: 'logo-white.png',
}));
vi.mock('../../assets/codelane-logo-dark.png', () => ({
  default: 'logo-dark.png',
}));

// Mock Kobalte Dialog to render children directly
vi.mock('@kobalte/core/dialog', () => {
  const Dialog = (props: any) => {
    if (!props.open) return null;
    return props.children;
  };
  Dialog.Portal = (props: any) => props.children;
  Dialog.Overlay = (props: any) => <div {...props} />;
  Dialog.Content = (props: any) => <div {...props} />;
  Dialog.CloseButton = (props: any) => <button {...props} data-testid="close-button" />;
  Dialog.Title = (props: any) => <h2 {...props} />;
  Dialog.Description = (props: any) => <p {...props} />;
  return { Dialog };
});

import { AboutDialog } from '../AboutDialog';

describe('AboutDialog', () => {
  it('renders app name', () => {
    render(() => (
      <AboutDialog open={true} onOpenChange={vi.fn()} />
    ));

    expect(screen.getByText('Codelane')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(() => (
      <AboutDialog open={true} onOpenChange={vi.fn()} />
    ));

    expect(screen.getByText(/Agentic Development Environment/)).toBeInTheDocument();
  });

  it('renders tech stack', () => {
    render(() => (
      <AboutDialog open={true} onOpenChange={vi.fn()} />
    ));

    expect(screen.getByText('Tauri')).toBeInTheDocument();
    expect(screen.getByText('SolidJS')).toBeInTheDocument();
    expect(screen.getByText('Rust')).toBeInTheDocument();
  });

  it('renders license info', () => {
    render(() => (
      <AboutDialog open={true} onOpenChange={vi.fn()} />
    ));

    expect(screen.getByText(/AGPL-3.0 License/)).toBeInTheDocument();
  });

  it('renders GitHub link', () => {
    render(() => (
      <AboutDialog open={true} onOpenChange={vi.fn()} />
    ));

    expect(screen.getByText('GitHub Repository')).toBeInTheDocument();
  });

  it('renders version (default before async load)', () => {
    render(() => (
      <AboutDialog open={true} onOpenChange={vi.fn()} />
    ));

    expect(screen.getByText(/Version/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(() => (
      <AboutDialog open={false} onOpenChange={vi.fn()} />
    ));

    expect(screen.queryByText('Codelane')).not.toBeInTheDocument();
  });
});
