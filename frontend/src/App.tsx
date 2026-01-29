import { createSignal, onMount, Show, For } from 'solid-js';
import { ask } from '@tauri-apps/plugin-dialog';
import { ThemeProvider } from './contexts/ThemeContext';
import { Button } from './components/ui';
import { LaneList } from './components/LaneList';
import { CreateLaneDialog } from './components/CreateLaneDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { TerminalView } from './components/TerminalView';
import { GitStatus } from './components/GitStatus';
import { ProcessMonitor } from './components/ProcessMonitor';
import { listLanes, deleteLane } from './lib/lane-api';
import { getActiveLaneId, setActiveLaneId } from './lib/storage';
import { getAgentSettings } from './lib/settings-api';
import { initDatabase } from './lib/db';
import type { Lane } from './types/lane';
import type { AgentSettings } from './types/agent';

function App() {
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [lanes, setLanes] = createSignal<Lane[]>([]);
  const [activeLaneId, setActiveLaneIdSignal] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [agentSettings, setAgentSettings] = createSignal<AgentSettings | null>(null);
  // Track which lanes have had terminals created (to avoid creating all at once)
  const [initializedLanes, setInitializedLanes] = createSignal<Set<string>>(new Set());
  // Notification state
  const [notification, setNotification] = createSignal<{ message: string; type: 'error' | 'warning' | 'info' } | null>(null);
  // Track terminal PIDs for process monitoring
  const [terminalPids, setTerminalPids] = createSignal<Map<string, number>>(new Map());

  // Load lanes and settings on mount
  onMount(async () => {
    // Initialize database
    try {
      await initDatabase();
      console.log('Database ready');
    } catch (err) {
      console.error('Failed to initialize database:', err);
      setError('Failed to initialize database. Please restart the app.');
      return;
    }

    // Load agent settings
    try {
      const settings = await getAgentSettings();
      setAgentSettings(settings);
    } catch (err) {
      console.error('Failed to load agent settings:', err);
      // Settings will use defaults if this fails
    }

    await loadLanes();
    // Restore active lane from localStorage
    const savedActiveLaneId = getActiveLaneId();
    if (savedActiveLaneId) {
      setActiveLaneIdSignal(savedActiveLaneId);
    }
  });

  const loadLanes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const laneList = await listLanes();
      setLanes(laneList);

      // If no active lane is set but lanes exist, set the first one as active
      if (!activeLaneId() && laneList.length > 0) {
        handleLaneSelect(laneList[0].id);
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

  const handleLaneSelect = (laneId: string) => {
    setActiveLaneIdSignal(laneId);
    setActiveLaneId(laneId);
    // Mark this lane as initialized so its terminal gets created
    setInitializedLanes((prev) => new Set(prev).add(laneId));
  };

  const handleLaneDelete = async (laneId: string) => {
    const lane = lanes().find(l => l.id === laneId);
    const laneName = lane?.name || 'this lane';

    const confirmed = await ask(`Are you sure you want to delete "${laneName}"?`, {
      title: 'Delete Lane',
      kind: 'warning',
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteLane(laneId);
      setLanes((prev) => prev.filter((l) => l.id !== laneId));

      // If the deleted lane was active, clear active lane
      if (activeLaneId() === laneId) {
        const remaining = lanes().filter((l) => l.id !== laneId);
        if (remaining.length > 0) {
          handleLaneSelect(remaining[0].id);
        } else {
          setActiveLaneIdSignal(null);
          setActiveLaneId(null);
        }
      }
    } catch (err) {
      await ask(err instanceof Error ? err.message : 'Failed to delete lane', {
        title: 'Error',
        kind: 'error',
      });
      console.error('Failed to delete lane:', err);
    }
  };

  const activeLane = () => lanes().find((l) => l.id === activeLaneId());

  const handleSettingsSaved = (settings: AgentSettings) => {
    setAgentSettings(settings);
  };

  const handleAgentFailed = (agentType: string, command: string) => {
    console.log('handleAgentFailed called with:', agentType, command);
    const notif = {
      message: `Agent "${agentType}" (${command}) is not installed. Using shell instead. Click settings to configure.`,
      type: 'warning' as const,
    };
    console.log('Setting notification:', notif);
    setNotification(notif);
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      console.log('Auto-dismissing notification');
      setNotification(null);
    }, 8000);
  };

  const handleReloadTerminal = async () => {
    const laneId = activeLaneId();
    if (!laneId) return;

    const confirmed = await ask('Reload terminal? This will restart the terminal session.', {
      title: 'Reload Terminal',
      kind: 'warning',
    });

    if (confirmed) {
      // Clear the PID for this lane
      setTerminalPids((prev) => {
        const newMap = new Map(prev);
        newMap.delete(laneId);
        return newMap;
      });

      // Remove from initialized lanes to unmount terminal
      setInitializedLanes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(laneId);
        return newSet;
      });

      // Re-add after a short delay to remount with fresh terminal
      setTimeout(() => {
        setInitializedLanes((prev) => new Set(prev).add(laneId));
      }, 100);
    }
  };

  return (
    <ThemeProvider>
      <div class="h-screen w-screen flex flex-col bg-zed-bg-app text-zed-text-primary">
        {/* Title Bar */}
        <div class="h-12 bg-zed-bg-panel border-b border-zed-border-subtle flex items-center px-4">
          <h1 class="text-lg font-semibold">Codelane</h1>
          <div class="ml-auto flex items-center gap-3">
            <span class="text-xs text-zed-text-tertiary">AI Orchestrator for Local Development</span>
            <button
              onClick={() => setSettingsOpen(true)}
              class="p-2 rounded-md hover:bg-zed-bg-hover transition-colors text-zed-text-secondary hover:text-zed-text-primary"
              title="Settings"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div class="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div class="w-64 bg-zed-bg-panel border-r border-zed-border-default flex flex-col">
            <div class="p-4 border-b border-zed-border-subtle">
              <h2 class="text-sm font-semibold text-zed-text-secondary uppercase tracking-wide">
                Lanes
              </h2>
            </div>

            <Show when={error()}>
              <div class="p-3 m-2 rounded-md bg-zed-accent-red/10 border border-zed-accent-red/30 text-xs text-zed-accent-red">
                {error()}
              </div>
            </Show>

            <Show
              when={!isLoading()}
              fallback={
                <div class="flex-1 flex items-center justify-center text-sm text-zed-text-tertiary">
                  Loading lanes...
                </div>
              }
            >
              <LaneList
                lanes={lanes()}
                activeLaneId={activeLaneId() ?? undefined}
                onLaneSelect={handleLaneSelect}
                onLaneDelete={handleLaneDelete}
              />
            </Show>

            <div class="p-4 border-t border-zed-border-subtle">
              <Button variant="primary" class="w-full" onClick={() => setDialogOpen(true)}>
                + New Lane
              </Button>
            </div>
          </div>

          {/* Main Panel */}
          <div class="flex-1 flex flex-col">
            {/* Content Area */}
            <div class="flex-1 flex flex-col overflow-hidden">
              <Show
                when={activeLane()}
                fallback={
                  <div class="flex-1 flex items-center justify-center p-6">
                    <div class="panel p-6 max-w-xl">
                      <h2 class="text-2xl font-bold mb-4">Welcome to Codelane</h2>
                      <p class="text-zed-text-secondary mb-4">
                        AI Orchestrator for Local Development - Manage multiple AI coding agents across projects
                      </p>
                      <p class="text-zed-text-secondary mb-4">
                        Get started by creating your first lane. A lane is a project workspace with its own terminal and AI agents.
                      </p>
                      <Button variant="primary" onClick={() => setDialogOpen(true)}>
                        Create Your First Lane
                      </Button>
                    </div>
                  </div>
                }
              >
                {/* Lane Info Header */}
                <div class="border-b border-zed-border-subtle bg-zed-bg-panel px-6 py-4">
                  <h2 class="text-lg font-bold">{activeLane()?.name}</h2>
                  <p class="text-zed-text-tertiary text-xs mt-1">{activeLane()?.workingDir}</p>
                </div>

                {/* Main Content Area: Terminal + Git Status */}
                <div class="flex-1 flex overflow-hidden">
                  {/* Terminal Section */}
                  <div class="flex-1 flex flex-col overflow-hidden border-r border-zed-border-subtle">
                    <div class="border-b border-zed-border-subtle bg-zed-bg-panel px-4 py-2 flex items-center justify-between">
                      <h3 class="text-sm font-semibold text-zed-text-secondary uppercase tracking-wide">Terminal</h3>
                      <div class="flex items-center gap-2">
                        {/* Process Monitor */}
                        <ProcessMonitor laneId={activeLaneId()} />

                        <div class="h-4 w-px bg-zed-border-default" />

                        {/* Reload Button */}
                        <button
                          onClick={handleReloadTerminal}
                          class="text-xs text-zed-text-tertiary hover:text-zed-text-primary transition-colors px-2 py-1 rounded hover:bg-zed-bg-hover flex items-center gap-1"
                          title="Reload terminal with agent"
                        >
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Reload
                        </button>
                      </div>
                    </div>
                    <div class="flex-1 overflow-hidden">
                      {/* Render terminals only for lanes that have been activated */}
                      <For each={lanes().filter(lane => initializedLanes().has(lane.id))}>
                        {(lane) => (
                          <div
                            class="h-full"
                            style={{ display: lane.id === activeLaneId() ? 'block' : 'none' }}
                          >
                            <TerminalView
                              laneId={lane.id}
                              cwd={lane.workingDir}
                              onTerminalReady={(pid) => {
                                console.log(`Terminal ready for ${lane.name}, PID:`, pid);
                                setTerminalPids((prev) => new Map(prev).set(lane.id, pid));
                              }}
                              onTerminalExit={() => {
                                console.log(`Terminal exited for ${lane.name}`);
                                setTerminalPids((prev) => {
                                  const newMap = new Map(prev);
                                  newMap.delete(lane.id);
                                  return newMap;
                                });
                              }}
                              onAgentFailed={handleAgentFailed}
                            />
                          </div>
                        )}
                      </For>
                    </div>
                  </div>

                  {/* Git Status Panel */}
                  <div class="w-80 flex flex-col overflow-hidden">
                    <For each={lanes().filter(lane => initializedLanes().has(lane.id))}>
                      {(lane) => (
                        <div
                          class="h-full"
                          style={{ display: lane.id === activeLaneId() ? 'block' : 'none' }}
                        >
                          <GitStatus workingDir={lane.workingDir} />
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>

            {/* Status Bar */}
            <div class="h-8 bg-zed-bg-panel border-t border-zed-border-subtle flex items-center px-4">
              <div class="flex items-center gap-4 text-xs text-zed-text-tertiary">
                <span>Ready</span>
                <span>•</span>
                <Show
                  when={activeLane()}
                  fallback={<span>No active lane</span>}
                >
                  <span>{activeLane()?.name}</span>
                </Show>
                <span>•</span>
                <span>{lanes().length} {lanes().length === 1 ? 'lane' : 'lanes'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Create Lane Dialog */}
        <CreateLaneDialog
          open={dialogOpen()}
          onOpenChange={setDialogOpen}
          onLaneCreated={handleLaneCreated}
          existingLanes={lanes()}
        />

        {/* Settings Dialog */}
        <SettingsDialog
          open={settingsOpen()}
          onOpenChange={setSettingsOpen}
          onSettingsSaved={handleSettingsSaved}
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
      </div>
    </ThemeProvider>
  );
}

export default App;
