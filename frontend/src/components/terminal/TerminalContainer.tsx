/**
 * TerminalContainer - Terminal lifecycle management
 *
 * Acquires terminal from TerminalPool when active, releases when inactive/unmounted.
 * Handles loading states and errors.
 */

import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { useTerminalPool } from '../../hooks/useTerminalPool';
import { TerminalInstance } from './TerminalInstance';
import type { TerminalHandle } from '../../types/terminal';

interface TerminalContainerProps {
  laneId: string;
  tabId: string;
  workingDir: string;
  isActive: boolean;
}

export function TerminalContainer(props: TerminalContainerProps) {
  const terminalPool = useTerminalPool();
  const [handle, setHandle] = createSignal<TerminalHandle | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);

  const terminalId = () => `${props.laneId}-tab-${props.tabId}`;

  // Acquire terminal when active
  createEffect(async () => {
    if (props.isActive && !handle()) {
      setIsLoading(true);
      setError(null);

      try {
        const h = await terminalPool.acquire({
          id: terminalId(),
          cwd: props.workingDir,
          useAgent: false, // Plain terminals for tabs
        });
        setHandle(h);
      } catch (err) {
        console.error('[TerminalContainer] Failed to acquire terminal:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    }
  });

  // Release terminal on unmount
  onCleanup(async () => {
    const h = handle();
    if (h) {
      console.log('[TerminalContainer] Releasing terminal:', h.id);
      await terminalPool.release(h.id);
    }
  });

  return (
    <Show
      when={!isLoading() && !error() && handle()}
      fallback={
        <div class="w-full h-full flex items-center justify-center">
          <div class="text-zed-text-secondary">
            <Show when={isLoading()}>
              <div class="flex items-center gap-2">
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-zed-accent-blue border-t-transparent"></div>
                <span>Starting terminal...</span>
              </div>
            </Show>
            <Show when={error()}>
              <div class="text-zed-accent-red">
                <div class="font-semibold">Failed to start terminal</div>
                <div class="text-sm mt-1">{error()}</div>
              </div>
            </Show>
          </div>
        </div>
      }
    >
      {(h) => <TerminalInstance handle={h()} />}
    </Show>
  );
}
