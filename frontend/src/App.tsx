import { createSignal, onMount, onCleanup, Show, createMemo } from 'solid-js';
import { ask } from '@tauri-apps/plugin-dialog';
import { ThemeProvider } from './contexts/ThemeContext';
import { MainLayout } from './components/layout';
import { CreateLaneDialog } from './components/lanes';
import { SettingsDialog } from './components/SettingsDialog';
import { AboutDialog } from './components/AboutDialog';
import { listLanes, deleteLane } from './lib/lane-api';
import { getActiveLaneId, setActiveLaneId } from './lib/storage';
import { getAgentSettings } from './lib/settings-api';
import { initDatabase } from './lib/db';
import { initPlatform } from './lib/platform';
import type { Lane } from './types/lane';
import type { AgentSettings } from './types/agent';
import { tabManager } from './services/TabManager';
import { resourceManager } from './services/ResourceManager';
import codelaneLogoWhite from './assets/codelane-logo-white.png';

function App() {
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [aboutOpen, setAboutOpen] = createSignal(false);
  const [lanes, setLanes] = createSignal<Lane[]>([]);
  const [activeLaneId, setActiveLaneIdSignal] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [agentSettings, setAgentSettings] = createSignal<AgentSettings | null>(null);
  // Track which lanes have had terminals created (to avoid creating all at once)
  const [initializedLanes, setInitializedLanes] = createSignal<Set<string>>(new Set());
  // Notification state
  const [notification, setNotification] = createSignal<{ message: string; type: 'error' | 'warning' | 'info' } | null>(null);
  // Track terminal IDs for process monitoring
  const [terminalIds, setTerminalIds] = createSignal<Map<string, string>>(new Map());

  // Disable right-click context menu in production
  onMount(() => {
    if (!import.meta.env.DEV) {
      document.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  });

  // Listen for menu events from Tauri
  onMount(async () => {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen('menu:about', () => {
      setAboutOpen(true);
    });
    onCleanup(() => {
      unlisten();
    });
  });

  // Disable autocomplete, autocorrect, and spellcheck on all inputs globally
  onMount(() => {
    const disableInputFeatures = (element: Element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.setAttribute('autocomplete', 'off');
        element.setAttribute('autocorrect', 'off');
        element.setAttribute('autocapitalize', 'off');
        element.setAttribute('spellcheck', 'false');
      }
    };

    // Apply to all existing inputs
    document.querySelectorAll('input, textarea').forEach(disableInputFeatures);

    // Watch for new inputs added to the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.matches('input, textarea')) {
              disableInputFeatures(node);
            }
            node.querySelectorAll('input, textarea').forEach(disableInputFeatures);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    onCleanup(() => observer.disconnect());
  });

  // Load lanes and settings on mount
  onMount(async () => {
    // Initialize platform detection (static, only done once)
    await initPlatform();

    // Initialize database
    try {
      await initDatabase();
      console.log('Database ready');
    } catch (err) {
      console.error('Failed to initialize database:', err);
      setError('Failed to initialize database. Please restart the app.');
      return;
    }

    // Start centralized resource monitoring
    resourceManager.start();

    // Load agent settings
    try {
      const settings = await getAgentSettings();
      setAgentSettings(settings);
    } catch (err) {
      console.error('Failed to load agent settings:', err);
      // Settings will use defaults if this fails
    }

    // Restore active lane from localStorage first
    const savedActiveLaneId = getActiveLaneId();
    if (savedActiveLaneId) {
      setActiveLaneIdSignal(savedActiveLaneId);
    }

    // Load lanes (this will initialize the active lane if needed)
    await loadLanes();

    // If we had a saved active lane, ensure it's initialized
    if (savedActiveLaneId) {
      await handleLaneSelect(savedActiveLaneId);
    }

    // Cleanup resource monitoring on unmount
    onCleanup(() => {
      resourceManager.stop();
    });
  });

  const loadLanes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const laneList = await listLanes();
      setLanes(laneList);

      // If no active lane is set but lanes exist, set the first one as active
      if (!activeLaneId() && laneList.length > 0) {
        await handleLaneSelect(laneList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lanes');
      console.error('Failed to load lanes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaneCreated = (lane: Lane) => {
    setLanes((prev) => [lane, ...prev]);
    handleLaneSelect(lane.id);
  };

  const handleLaneSelect = async (laneId: string) => {
    setActiveLaneIdSignal(laneId);
    setActiveLaneId(laneId);

    // Initialize TabManager FIRST (before marking as initialized)
    try {
      await tabManager.initializeLane(laneId);
    } catch (err) {
      console.error('[App] Failed to initialize TabManager for lane:', laneId, err);
    }

    // THEN mark this lane as initialized so its components render
    setInitializedLanes((prev) => new Set(prev).add(laneId));
  };

  const handleLaneDeleted = async (laneId: string) => {
    // Update local state (deletion already happened in ProjectPanel)
    setLanes((prev) => prev.filter((l) => l.id !== laneId));

    // Dispose TabManager for this lane
    tabManager.disposeLane(laneId);

    // If the deleted lane was active, switch to another lane
    if (activeLaneId() === laneId) {
      const remaining = lanes().filter((l) => l.id !== laneId);
      if (remaining.length > 0) {
        await handleLaneSelect(remaining[0].id);
      } else {
        setActiveLaneIdSignal(null);
        setActiveLaneId(null);
      }
    }
  };

  const handleLaneRenamed = (updatedLane: Lane) => {
    // Update the lane in local state
    setLanes((prev) => prev.map((l) => l.id === updatedLane.id ? updatedLane : l));
  };

  const handleSettingsSaved = (settings: AgentSettings) => {
    setAgentSettings(settings);
  };

  const handleAgentFailed = (agentType: string, command: string) => {
    const notif = {
      message: `Agent "${agentType}" (${command}) is not installed. Using shell instead. Click settings to configure.`,
      type: 'warning' as const,
    };
    setNotification(notif);
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      setNotification(null);
    }, 8000);
  };

  const handleTerminalReady = (laneId: string, terminalId: string) => {
    setTerminalIds((prev) => new Map(prev).set(laneId, terminalId));
  };

  const handleTerminalExit = (laneId: string) => {
    setTerminalIds((prev) => {
      const newMap = new Map(prev);
      newMap.delete(laneId);
      return newMap;
    });
  };

  const handleReloadTerminal = (laneId: string) => {
    // Remove lane from initialized set to unmount the terminal
    setInitializedLanes((prev) => {
      const newSet = new Set(prev);
      newSet.delete(laneId);
      return newSet;
    });
    // Clear terminal ID
    setTerminalIds((prev) => {
      const newMap = new Map(prev);
      newMap.delete(laneId);
      return newMap;
    });
    // Re-add after a short delay to allow unmount
    setTimeout(() => {
      setInitializedLanes((prev) => new Set(prev).add(laneId));
    }, 100);
  };

  return (
    <ThemeProvider>
      <Show
        when={!isLoading()}
        fallback={
          <div class="h-screen w-screen flex items-center justify-center bg-zed-bg-app text-zed-text-primary">
            <div class="text-center">
              <img src={codelaneLogoWhite} alt="Codelane" class="w-12 mx-auto mb-4 opacity-60 animate-pulse" />
              <p class="text-zed-text-secondary">Loading...</p>
            </div>
          </div>
        }
      >
        <MainLayout
          lanes={lanes()}
          activeLaneId={activeLaneId()}
          initializedLanes={initializedLanes()}
          onLaneSelect={handleLaneSelect}
          onLaneDeleted={handleLaneDeleted}
          onLaneRenamed={handleLaneRenamed}
          onNewLane={() => setDialogOpen(true)}
          onSettingsOpen={() => setSettingsOpen(true)}
          onAboutOpen={() => setAboutOpen(true)}
          onTerminalReady={handleTerminalReady}
          onTerminalExit={handleTerminalExit}
          onAgentFailed={handleAgentFailed}
          onReloadTerminal={handleReloadTerminal}
        />
      </Show>

      {/* Create Lane Dialog */}
      <CreateLaneDialog
        open={dialogOpen()}
        onOpenChange={setDialogOpen}
        onLaneCreated={handleLaneCreated}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen()}
        onOpenChange={setSettingsOpen}
        onSettingsSaved={handleSettingsSaved}
      />

      {/* About Dialog */}
      <AboutDialog
        open={aboutOpen()}
        onOpenChange={setAboutOpen}
      />

      {/* Notification Toast */}
      <Show when={notification()}>
        {(notif) => (
          <div class="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
            <div
              class={`rounded-lg shadow-lg border p-4 flex items-start gap-3 ${
                notif().type === 'error'
                  ? 'bg-red-900/90 border-red-700 text-red-100'
                  : notif().type === 'warning'
                  ? 'bg-yellow-900/90 border-yellow-700 text-yellow-100'
                  : 'bg-blue-900/90 border-blue-700 text-blue-100'
              }`}
            >
              <div class="flex-shrink-0 mt-0.5">
                {notif().type === 'warning' ? (
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                ) : (
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                )}
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium">{notif().message}</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                class="flex-shrink-0 ml-2 hover:opacity-70 transition-opacity"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </Show>
    </ThemeProvider>
  );
}

export default App;
