import { Show, createMemo, createSignal, onMount, onCleanup, For, createEffect } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { invoke } from '@tauri-apps/api/core';
import { codeReviewStore } from '../../services/CodeReviewStore';
import { ActivityView } from './ActivityBar';
import { statusBarManager, type StatusBarItem } from '../../services/StatusBarManager';

interface AppResourceUsage {
  cpuPercent: number;
  memoryMb: number;
  memoryPercent: number;
}

interface StatusBarProps {
  activeView?: ActivityView;
  activeLaneId?: string | null;
}

function SafeStatusBarItem(props: { item: StatusBarItem }) {
  let containerRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (!containerRef) return;
    
    // Clear previous
    containerRef.innerHTML = '';
    
    const component = props.item.component;
    
    if (typeof component === 'function') {
      try {
        // Try calling it as a function that might return an element
        // (common for simple JS extensions)
        const result = component({});
        
        if (result instanceof HTMLElement) {
          containerRef.appendChild(result);
        } else {
          // If it's not an element, it might be a Solid component
          // Solid components should be rendered via <Dynamic />
          // but we are already inside a function. 
          // ExtensionLoader uses Dynamic, so we should too if it's not a DOM element.
        }
      } catch (e) {
        console.error(`[StatusBar] Error rendering item ${props.item.id}:`, e);
      }
    }
  });

  return (
    <div class="flex items-center">
      <Show 
        when={typeof props.item.component === 'function' && !(props.item.component({}) instanceof HTMLElement)}
        fallback={<div ref={containerRef} class="flex items-center" />}
      >
        <Dynamic component={props.item.component} />
      </Show>
    </div>
  );
}

export function StatusBar(props: StatusBarProps) {
  const [resourceUsage, setResourceUsage] = createSignal<AppResourceUsage | null>(null);

  const fetchResources = async () => {
    try {
      const usage = await invoke<AppResourceUsage>('get_app_resource_usage');
      setResourceUsage(usage);
    } catch {
      // Ignore resource fetch errors
    }
  };

  onMount(() => {
    fetchResources();
    const interval = setInterval(fetchResources, 5000);
    onCleanup(() => clearInterval(interval));
  });

  // Check if we should show code review keyboard shortcuts
  const showCodeReviewShortcuts = createMemo(() => {
    if (props.activeView !== ActivityView.CodeReview || !props.activeLaneId) {
      return false;
    }
    const reviewState = codeReviewStore.getState(props.activeLaneId);
    return reviewState()?.status === 'ready';
  });

  const leftItems = createMemo(() => statusBarManager.getItems()().filter(i => i.alignment === 'left'));
  const rightItems = createMemo(() => statusBarManager.getItems()().filter(i => i.alignment === 'right'));

  return (
    <div class="h-6 bg-zed-bg-panel border-t border-zed-border-subtle flex items-center px-3 text-xs select-none">
      {/* Left Section - Keyboard shortcuts for Code Review & Extensions */}
      <div class="flex items-center gap-3 flex-1">
        <Show when={showCodeReviewShortcuts()}>
          <div class="flex items-center gap-3 text-zed-text-tertiary">
            <span class="flex items-center gap-1">
              <kbd class="px-1.5 py-0.5 bg-zed-bg-app border border-zed-border-default rounded text-[10px]">j</kbd>
              <span>/</span>
              <kbd class="px-1.5 py-0.5 bg-zed-bg-app border border-zed-border-default rounded text-[10px]">k</kbd>
              <span class="ml-1">Navigate</span>
            </span>
            <span class="flex items-center gap-1">
              <kbd class="px-1.5 py-0.5 bg-zed-bg-app border border-zed-border-default rounded text-[10px]">⌘R</kbd>
              <span class="ml-1">Regenerate</span>
            </span>
            <span class="flex items-center gap-1">
              <kbd class="px-1.5 py-0.5 bg-zed-bg-app border border-zed-border-default rounded text-[10px]">Esc</kbd>
              <span class="ml-1">Cancel</span>
            </span>
          </div>
        </Show>
        <For each={leftItems()}>
          {(item) => <SafeStatusBarItem item={item} />}
        </For>
      </div>

      {/* Right Section - Resource Usage & Extensions */}
      <div class="flex items-center gap-3 flex-1 justify-end">
        <For each={rightItems()}>
          {(item) => <SafeStatusBarItem item={item} />}
        </For>
        
        {/* Resource Usage */}
        <Show when={resourceUsage()}>
          <div class="flex items-center gap-2 text-zed-text-tertiary">
            {/* CPU */}
            <span class="flex items-center gap-1" title="App CPU Usage (excludes terminal)">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              <span>{resourceUsage()!.cpuPercent.toFixed(1)}%</span>
            </span>
            {/* Memory */}
            <span class="flex items-center gap-1" title="App Memory Usage (excludes terminal)">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>{resourceUsage()!.memoryMb.toFixed(0)} MB</span>
            </span>
          </div>
        </Show>
      </div>
    </div>
  );
}
