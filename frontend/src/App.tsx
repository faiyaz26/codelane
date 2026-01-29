import { createSignal, onMount, Show } from 'solid-js';
import { ThemeProvider } from './contexts/ThemeContext';
import { Button } from './components/ui';
import { LaneList } from './components/LaneList';
import { CreateLaneDialog } from './components/CreateLaneDialog';
import { TerminalView } from './components/TerminalView';
import { listLanes, deleteLane } from './lib/lane-api';
import { getActiveLaneId, setActiveLaneId } from './lib/storage';
import type { Lane } from './types/lane';

function App() {
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [lanes, setLanes] = createSignal<Lane[]>([]);
  const [activeLaneId, setActiveLaneIdSignal] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Load lanes on mount
  onMount(async () => {
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
  };

  const handleLaneDelete = async (laneId: string) => {
    if (!confirm('Are you sure you want to delete this lane?')) {
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
      alert(err instanceof Error ? err.message : 'Failed to delete lane');
      console.error('Failed to delete lane:', err);
    }
  };

  const activeLane = () => lanes().find((l) => l.id === activeLaneId());

  return (
    <ThemeProvider>
      <div class="h-screen w-screen flex flex-col bg-zed-bg-app text-zed-text-primary">
        {/* Title Bar */}
        <div class="h-12 bg-zed-bg-panel border-b border-zed-border-subtle flex items-center px-4">
          <h1 class="text-lg font-semibold">Codelane</h1>
          <div class="ml-auto flex items-center gap-2">
            <span class="text-xs text-zed-text-tertiary">AI Orchestrator for Local Development</span>
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
                  <p class="text-zed-text-tertiary text-xs mt-1">{activeLane()?.working_dir}</p>
                </div>

                {/* Terminal Section */}
                <div class="flex-1 flex flex-col overflow-hidden">
                  <div class="border-b border-zed-border-subtle bg-zed-bg-panel px-4 py-2 flex items-center justify-between">
                    <h3 class="text-sm font-semibold text-zed-text-secondary uppercase tracking-wide">Terminal</h3>
                    <div class="flex gap-2">
                      <button
                        class="text-xs text-zed-text-tertiary hover:text-zed-text-primary transition-colors px-2 py-1 rounded hover:bg-zed-bg-hover"
                        title="Clear terminal"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div class="flex-1 overflow-hidden">
                    <TerminalView
                      cwd={activeLane()?.working_dir}
                      onTerminalReady={(id) => console.log('Terminal ready:', id)}
                      onTerminalExit={(id) => console.log('Terminal exited:', id)}
                    />
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
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
