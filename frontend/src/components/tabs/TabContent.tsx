/**
 * TabContent - Lazy-loading container for tab content
 *
 * Only mounts terminals for tabs that have been activated at least once.
 * Shows/hides tabs based on active state.
 */

import { createSignal, createEffect, For, Show, ErrorBoundary, Dynamic } from 'solid-js';
import type { Tab } from '../../types/lane';
import { TerminalContainer } from '../terminal/TerminalContainer';
import { extensionLoader } from '../../services/ExtensionLoader';

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
      setMountedTabs((prev) => new Set(prev).add(active));
    }
  });

  // Trigger terminal refit when active tab changes (opacity-hidden terminals need refresh)
  createEffect((prev: string | undefined) => {
    const current = props.activeTabId;
    if (current && prev !== current) {
      setTimeout(() => window.dispatchEvent(new Event('terminal-resize')), 50);
    }
    return current;
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
                        <div class="font-semibold">{tab.type === 'extension' ? 'Extension Error' : 'Terminal Error'}</div>
                        <div class="text-sm mt-1">{err.toString()}</div>
                      </div>
                    </div>
                  )}
                >
                  <Show 
                    when={tab.type === 'terminal'} 
                    fallback={
                      <Show when={tab.type === 'extension'}>
                        {(() => {
                          const extensionType = tab.metadata?.extensionType || 'default';
                          const component = extensionLoader.getTabComponent(`${tab.extensionId}:${extensionType}`);
                          if (!component) {
                            return (
                              <div class="w-full h-full flex items-center justify-center text-zed-text-tertiary">
                                Extension tab component not found: {tab.extensionId}:{extensionType}
                              </div>
                            );
                          }
                          return (
                            <Dynamic
                              component={component}
                              laneId={props.laneId}
                              tabId={tab.id}
                              metadata={tab.metadata}
                              isActive={isActive()}
                            />
                          );
                        })()}
                      </Show>
                    }
                  >
                    <TerminalContainer
                      laneId={props.laneId}
                      tabId={tab.id}
                      workingDir={props.workingDir}
                      isActive={isActive()}
                    />
                  </Show>
                </ErrorBoundary>
              </div>
            </Show>
          );
        }}
      </For>
    </div>
  );
}
