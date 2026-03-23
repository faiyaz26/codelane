import { createSignal, onMount, onCleanup, Show, batch } from 'solid-js';
import { ThemeProvider } from './contexts/ThemeContext';
import { MainLayout } from './components/layout';
import { CreateLaneDialog } from './components/lanes';
import { SettingsDialog } from './components/SettingsDialog';
import { AboutDialog } from './components/AboutDialog';
import { OnboardingWizard, type WizardData } from './components/onboarding';
import { UpdateToast } from './components/UpdateToast';
import { GlobalNotifications } from './components/GlobalNotifications';
import { listLanes } from './lib/lane-api';
import { getActiveLaneId, setActiveLaneId } from './lib/storage';
import { getAgentSettings, updateAgentSettings } from './lib/settings-api';
import { initPlatform } from './lib/platform';

import { tabManager } from './services/TabManager';
import { terminalPool } from './services/TerminalPool';
import { agentNotificationService } from './services/AgentNotificationService';
import { agentStatusManager } from './services/AgentStatusManager';
import { hookService } from './services/HookService';

import { useClipboardFix } from './hooks/useClipboardFix';
import { useGlobalContextMenuFix } from './hooks/useGlobalContextMenuFix';
import { useInputFeaturesFix } from './hooks/useInputFeaturesFix';
import { useGlobalMenuEvents } from './hooks/useGlobalMenuEvents';

import type { Lane } from './types/lane';
import type { AgentSettings } from './types/agent';

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
  // Track terminal IDs for process monitoring
  const [terminalIds, setTerminalIds] = createSignal<Map<string, string>>(new Map());
  // Track reload versions per lane to force component remount
  const [terminalReloadVersions, setTerminalReloadVersions] = createSignal<Map<string, number>>(new Map());

  // Apply global DOM fixes and behaviors
  useGlobalContextMenuFix();
  useClipboardFix();
  useInputFeaturesFix();
  useGlobalMenuEvents(setAboutOpen, setOnboardingOpen);

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

  // Load lanes and settings on mount
  onMount(async () => {
    // Initialize platform detection (static, only done once)
    await initPlatform();

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

    // Dispose TabManager for this lane (handles tab terminals)
    tabManager.disposeLane(laneId);

    // Dispose agent terminal
    void terminalPool.release(`${laneId}-agent`);

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
    // Increment reload version to force remount (TerminalView will release PTY in onCleanup)
    setTerminalReloadVersions((prev) => {
      const newMap = new Map(prev);
      newMap.set(laneId, (newMap.get(laneId) ?? 0) + 1);
      return newMap;
    });
    
    // Clear terminal ID
    setTerminalIds((prev) => {
      const newMap = new Map(prev);
      newMap.delete(laneId);
      return newMap;
    });
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
          agentSettings={agentSettings()}
          activeLaneId={activeLaneId()}
          initializedLanes={initializedLanes()}
          terminalReloadVersions={terminalReloadVersions()}
          onLaneSelect={handleLaneSelect}
          onLaneDeleted={handleLaneDeleted}
          onLaneRenamed={handleLaneRenamed}
          onNewLane={() => setDialogOpen(true)}
          onSettingsOpen={() => setSettingsOpen(true)}
          onAboutOpen={() => setAboutOpen(true)}
          onLanesUpdated={loadLanes}
          onTerminalReady={handleTerminalReady}
          onTerminalExit={handleTerminalExit}
          onAgentFailed={(agentType, command) => {
             // Dispatch a global event so GlobalNotifications can show a warning
             window.dispatchEvent(new CustomEvent('codelane:agent-failed', { detail: { agentType, command } }));
          }}
          onReloadAgentTerminal={handleReloadAgentTerminal}
        />
      </Show>

      {/* Dialogs */}
      <CreateLaneDialog open={dialogOpen()} onOpenChange={setDialogOpen} onLaneCreated={handleLaneCreated} />
      <SettingsDialog open={settingsOpen()} onOpenChange={setSettingsOpen} onSettingsSaved={handleSettingsSaved} />
      <AboutDialog open={aboutOpen()} onOpenChange={setAboutOpen} />
      <OnboardingWizard open={onboardingOpen()} onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />

      {/* Toasts */}
      <UpdateToast />
      <GlobalNotifications 
        lanes={lanes()} 
        activeLaneId={activeLaneId()} 
        onLaneSelect={handleLaneSelect} 
        onSettingsOpen={() => setSettingsOpen(true)}
      />
    </ThemeProvider>
  );
}

export default App;
