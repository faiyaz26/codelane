/**
 * TabContent - Lazy-loading container for tab content
 *
 * Only mounts terminals for tabs that have been activated at least once.
 * Shows/hides tabs based on active state.
 */

import { createSignal, createEffect, For, Show, ErrorBoundary } from 'solid-js';
import type { Tab } from '../../types/lane';
import { TerminalContainer } from '../terminal/TerminalContainer';

interface TabContentProps {
  laneId: string;
  workingDir: string;
  tabs: Tab[];
  activeTabId?: string;
}

export function TabContent(props: TabContentProps) {
  // Track which tabs have been mounted (lazy loading)
  const [mountedTabs, setMountedTabs] = createSignal<Set<string>>(new Set());

  // Mount tab when it becomes active
  createEffect(() => {
    const active = props.activeTabId;
    if (active && !mountedTabs().has(active)) {
      console.log('[TabContent] Mounting tab:', active);
      setMountedTabs((prev) => new Set(prev).add(active));
    }
  });

  return (
    <div class="w-full h-full overflow-hidden relative">
      <For each={props.tabs}>
        {(tab) => {
          const isActive = () => props.activeTabId === tab.id;
          const isMounted = () => mountedTabs().has(tab.id);

          return (
            <Show when={isMounted()}>
              <div
                class="absolute inset-0"
                style={{
                  'z-index': isActive() ? '10' : '0',
                  opacity: isActive() ? '1' : '0',
                  'pointer-events': isActive() ? 'auto' : 'none',
                }}
              >
                <ErrorBoundary
                  fallback={(err) => (
                    <div class="w-full h-full flex items-center justify-center text-zed-accent-red">
                      <div>
                        <div class="font-semibold">Terminal Error</div>
                        <div class="text-sm mt-1">{err.toString()}</div>
                      </div>
                    </div>
                  )}
                >
                  <TerminalContainer
                    laneId={props.laneId}
                    tabId={tab.id}
                    workingDir={props.workingDir}
                    isActive={isActive()}
                  />
                </ErrorBoundary>
              </div>
            </Show>
          );
        }}
      </For>
    </div>
  );
}
