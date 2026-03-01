import { createSignal, onMount, onCleanup, Show, createMemo, batch } from 'solid-js';
import { ask } from '@tauri-apps/plugin-dialog';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
import { ThemeProvider } from './contexts/ThemeContext';
import { MainLayout } from './components/layout';
import { CreateLaneDialog } from './components/lanes';
import { SettingsDialog } from './components/SettingsDialog';
import { AboutDialog } from './components/AboutDialog';
import { OnboardingWizard, type WizardData } from './components/onboarding';
import { UpdateToast } from './components/UpdateToast';
import { updaterService } from './services/UpdaterService';
import { listLanes, deleteLane } from './lib/lane-api';
import { getActiveLaneId, setActiveLaneId } from './lib/storage';
import { getAgentSettings, updateAgentSettings } from './lib/settings-api';
import { initPlatform } from './lib/platform';
import type { Lane } from './types/lane';
import type { AgentSettings } from './types/agent';
import { tabManager } from './services/TabManager';
import { resourceManager } from './services/ResourceManager';
import { agentNotificationService } from './services/AgentNotificationService';
import { agentStatusManager } from './services/AgentStatusManager';
import { hookService } from './services/HookService';
import codelaneLogoWhite from './assets/codelane-logo-white.png';

function App() {
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [aboutOpen, setAboutOpen] = createSignal(false);
  const [onboardingOpen, setOnboardingOpen] = createSignal(false);
  const [lanes, setLanes] = createSignal<Lane[]>([]);
  const [activeLaneId, setActiveLaneIdSignal] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [agentSettings, setAgentSettings] = createSignal<AgentSettings | null>(null);
  // Track which lanes have had terminals created (to avoid creating all at once)
  const [initializedLanes, setInitializedLanes] = createSignal<Set<string>>(new Set());
  // Track which lanes are currently reloading their terminal
  const [agentReloadingLanes, setAgentReloadingLanes] = createSignal<Set<string>>(new Set());
  // Notification state
  const [notification, setNotification] = createSignal<{ 
    message: string; 
    type: 'error' | 'warning' | 'info';
    onClick?: () => void;
  } | null>(null);
  // Track terminal IDs for process monitoring
  const [terminalIds, setTerminalIds] = createSignal<Map<string, string>>(new Map());

  // Disable right-click context menu in production
  onMount(() => {
    if (!import.meta.env.DEV) {
      document.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  });

  // Global clipboard handler (copy/paste/cut) using Tauri clipboard API.
  // Tauri webviews don't support native clipboard shortcuts, so we handle
  // them globally here. Terminal has its own clipboard handling via xterm.
  onMount(() => {
    const handleClipboard = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      // Skip if target is inside a terminal (xterm handles its own clipboard)
      const target = e.target as HTMLElement;
      if (target.closest('.xterm')) return;

      if (e.key === 'c' || e.key === 'x') {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const selectedText = selection.toString();
          if (selectedText) {
            e.preventDefault();
            await writeText(selectedText);
            // For cut, delete the selected content if in an editable field
            if (e.key === 'x' && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
              document.execCommand('delete');
            }
          }
        }
      } else if (e.key === 'v') {
        // Always intercept paste to use Tauri clipboard API.
        // This prevents WebKit's native NSPasteboard access which can crash
        // due to a macOS bug with stale clipboard type cache pointers.
        e.preventDefault();
        const text = await readText();
        if (text) {
          if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            const start = target.selectionStart ?? 0;
            const end = target.selectionEnd ?? 0;
            const currentValue = target.value;
            // Use native input setter to trigger reactive frameworks
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
              'value'
            )?.set;
            nativeInputValueSetter?.call(target, currentValue.slice(0, start) + text + currentValue.slice(end));
            target.dispatchEvent(new Event('input', { bubbles: true }));
            // Restore cursor position after paste
            const newPos = start + text.length;
            target.setSelectionRange(newPos, newPos);
          } else if (target.isContentEditable) {
            // Handle contenteditable elements (e.g., code editors)
            document.execCommand('insertText', false, text);
          } else {
            // For any other focusable element, dispatch a paste-like event
            // so downstream handlers can pick it up if needed
            target.dispatchEvent(new CustomEvent('tauri-paste', { detail: text, bubbles: true }));
          }
        }
      } else if (e.key === 'a') {
        // Cmd+A: select all in input fields (ensure it works)
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          // Let native behavior handle it
          return;
        }
      }
    };

    // Intercept native paste events (from Edit menu, context menu, execCommand)
    // to prevent WebKit's NSPasteboard access which can crash on macOS.
    const handleNativePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      // Skip terminals (xterm handles its own clipboard)
      if (target.closest('.xterm')) return;

      e.preventDefault();
      e.stopPropagation();

      // Get text from the clipboard event data if available, otherwise use Tauri API
      let text = e.clipboardData?.getData('text/plain');
      if (!text) {
        text = await readText();
      }
      if (!text) return;

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const start = target.selectionStart ?? 0;
        const end = target.selectionEnd ?? 0;
        const currentValue = target.value;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(target, currentValue.slice(0, start) + text + currentValue.slice(end));
        target.dispatchEvent(new Event('input', { bubbles: true }));
        const newPos = start + text.length;
        target.setSelectionRange(newPos, newPos);
      } else if (target.isContentEditable) {
        document.execCommand('insertText', false, text);
      }
    };

    document.addEventListener('keydown', handleClipboard);
    document.addEventListener('paste', handleNativePaste, true); // capture phase
    onCleanup(() => {
      document.removeEventListener('keydown', handleClipboard);
      document.removeEventListener('paste', handleNativePaste, true);
    });
  });

  // Listen for agent status changes to show in-app notifications
  onMount(() => {
    const unsubscribe = agentStatusManager.onStatusChange((change) => {
      // Don't show in-app notification if we are already in this lane
      if (change.laneId === activeLaneId()) return;

      const settings = agentStatusManager.getNotificationSettings();
      
      let message: string | null = null;
      let type: 'info' | 'warning' | 'error' = 'info';

      if (change.newStatus === 'done' && settings.notifyOnDone) {
        const laneName = lanes().find(l => l.id === change.laneId)?.name || 'lane';
        message = `Agent finished task in "${laneName}". Click to switch.`;
        type = 'info';
      } else if (change.newStatus === 'waiting_for_input' && settings.notifyOnWaitingForInput) {
        const laneName = lanes().find(l => l.id === change.laneId)?.name || 'lane';
        message = `Agent needs input in "${laneName}". Click to switch.`;
        type = 'warning';
      } else if (change.newStatus === 'error' && settings.notifyOnError) {
        const laneName = lanes().find(l => l.id === change.laneId)?.name || 'lane';
        message = `Agent error in "${laneName}". Click to switch.`;
        type = 'error';
      }

      if (message) {
        setNotification({
          message,
          type,
          onClick: () => {
            handleLaneSelect(change.laneId);
            setNotification(null);
          }
        });

        // Auto-dismiss after 10 seconds
        const currentMessage = message;
        setTimeout(() => {
          setNotification((prev) => prev?.message === currentMessage ? null : prev);
        }, 10000);
      }
    });

    onCleanup(unsubscribe);
  });






  // Check for first launch and show onboarding
  onMount(() => {
    const onboarded = localStorage.getItem('codelane:onboarding-completed');
    if (!onboarded) {
      // Show onboarding after a short delay to let the app initialize
      setTimeout(() => {
        setOnboardingOpen(true);
      }, 500);
    }
  });

  // Listen for menu events from Tauri
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

    // Restore active lane from store
    const savedActiveLaneId = await getActiveLaneId();
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

  // Start agent notification service
  onMount(async () => {
    await agentNotificationService.start();
    onCleanup(() => {
      agentNotificationService.stop();
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
    await setActiveLaneId(laneId);

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
    const wasActive = activeLaneId() === laneId;

    // Batch all signal updates to avoid stale <Show> accessor access during teardown
    batch(() => {
      // Switch active lane FIRST so <Show when={activeLane()}> transitions cleanly
      if (wasActive) {
        const remaining = lanes().filter((l) => l.id !== laneId);
        if (remaining.length > 0) {
          setActiveLaneIdSignal(remaining[0].id);
        } else {
          setActiveLaneIdSignal(null);
        }
      }

      // Now safe to remove from the list
      setLanes((prev) => prev.filter((l) => l.id !== laneId));
    });

    // Dispose TabManager for this lane
    tabManager.disposeLane(laneId);

    // Persist the active lane change
    if (wasActive) {
      await setActiveLaneId(activeLaneId());
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
      message: `Agent "${agentType}" (${command}) is not installed. Using shell instead. Click to configure settings.`,
      type: 'warning' as const,
      onClick: () => {
        setSettingsOpen(true);
        setNotification(null);
      }
    };
    setNotification(notif);
    // Auto-dismiss after 8 seconds
    const currentMessage = notif.message;
    setTimeout(() => {
      setNotification((prev) => prev?.message === currentMessage ? null : prev);
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

  const handleReloadAgentTerminal = (laneId: string) => {
    // Add to reloading set first to trigger unmount in UI
    setAgentReloadingLanes((prev) => new Set(prev).add(laneId));
    
    // Clear terminal ID
    setTerminalIds((prev) => {
      const newMap = new Map(prev);
      newMap.delete(laneId);
      return newMap;
    });

    // Re-add after a short delay to allow unmount
    setTimeout(() => {
      setAgentReloadingLanes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(laneId);
        return newSet;
      });
    }, 100);
  };

  const handleOnboardingComplete = async (data: WizardData) => {
    // Save agent configuration
    try {
      const settings = await getAgentSettings();
      const updatedSettings: AgentSettings = {
        ...settings,
        defaultAgentName: data.defaultAgentName,
        installedAgents: data.installedAgents,
      };

      await updateAgentSettings(updatedSettings);
      setAgentSettings(updatedSettings);

      // Install hooks if enabled for the default agent
      if (data.hooksEnabled) {
        const defaultAgent = data.installedAgents.find(a => a.name === data.defaultAgentName) || data.installedAgents[0];
        if (defaultAgent) {
          try {
            await hookService.installHooks(defaultAgent.agentType);
          } catch (err) {
            console.error('Failed to install hooks:', err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to save agent settings:', err);
    }

    // Save notification settings
    agentStatusManager.updateNotificationSettings({
      notifyOnDone: data.notifications.onTaskComplete,
      notifyOnWaitingForInput: data.notifications.onNeedsInput,
      notifyOnError: data.notifications.onError,
      onlyWhenUnfocused: data.notifications.onlyWhenUnfocused,
    });

    // Mark onboarding as complete
    localStorage.setItem('codelane:onboarding-completed', 'completed');

    // Close wizard
    setOnboardingOpen(false);
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem('codelane:onboarding-completed', 'skipped');
    setOnboardingOpen(false);
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
          agentReloadingLanes={agentReloadingLanes()}
          onLaneSelect={handleLaneSelect}
          onLaneDeleted={handleLaneDeleted}
          onLaneRenamed={handleLaneRenamed}
          onNewLane={() => setDialogOpen(true)}
          onSettingsOpen={() => setSettingsOpen(true)}
          onAboutOpen={() => setAboutOpen(true)}
          onLanesUpdated={loadLanes}
          onTerminalReady={handleTerminalReady}
          onTerminalExit={handleTerminalExit}
          onAgentFailed={handleAgentFailed}
          onReloadAgentTerminal={handleReloadAgentTerminal}
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

      {/* Onboarding Wizard */}
      <OnboardingWizard
        open={onboardingOpen()}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />

      {/* Update Toast — bottom-right, shown when a new version is available */}
      <UpdateToast />

      {/* Notification Toast */}
      <Show when={notification()}>
        {(notif) => (
          <div class="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
            <div
              class={`rounded-lg shadow-lg border p-4 flex items-start gap-3 transition-all select-none ${
                notif().onClick ? 'cursor-pointer hover:bg-opacity-80 active:scale-[0.98]' : ''
              } ${
                notif().type === 'error'
                  ? 'bg-red-900/90 border-red-700 text-red-100'
                  : notif().type === 'warning'
                  ? 'bg-yellow-900/90 border-yellow-700 text-yellow-100'
                  : 'bg-blue-900/90 border-blue-700 text-blue-100'
              }`}
              onClick={() => notif().onClick?.()}
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
                onClick={(e) => { e.stopPropagation(); setNotification(null); }}
                class="flex-shrink-0 ml-2 hover:opacity-70 transition-opacity p-1 rounded-full hover:bg-black/20 cursor-pointer select-none"
                aria-label="Close notification"
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
