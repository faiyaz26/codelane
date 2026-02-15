/**
 * ReviewFileScrollView - Top 2/3 of the right half
 *
 * Scrollable container rendering all changed files sequentially.
 * Each file has a sticky header and inline DiffViewer.
 * Uses IntersectionObserver to track which file is currently visible.
 */

import { For, Show, createSignal, onMount, onCleanup, createEffect, createMemo } from 'solid-js';
import { DiffViewer } from '../editor/DiffViewer';
import type { FileChangeStats } from '../../types/git';

interface ReviewFileScrollViewProps {
  laneId: string;
  workingDir: string;
  sortedFiles: FileChangeStats[];
  fileDiffs: Map<string, string>;
  onVisibleFileChange: (path: string) => void;
  scrollToPath: string | null; // Reactive prop from store - triggers scroll when set
  contextPanelHeightPercent?: number; // Height of context panel as percentage (for bottom padding)
}

export function ReviewFileScrollView(props: ReviewFileScrollViewProps) {
  let scrollContainerRef: HTMLDivElement | undefined;
  const fileRefs = new Map<string, HTMLElement>();
  const [shouldRenderDiff, setShouldRenderDiff] = createSignal<Set<string>>(new Set());
  let isManualScrolling = false; // Flag to prevent observer override during manual scroll

  // Memoize file path index for O(1) lookup instead of O(n)
  const pathIndexMap = createMemo(() => {
    const map = new Map<string, number>();
    props.sortedFiles.forEach((f, i) => map.set(f.path, i));
    return map;
  });

  // Single merged IntersectionObserver for both visibility and lazy rendering
  onMount(() => {
    if (!scrollContainerRef) return;

    const visibleFiles = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false;
        const toRender = new Set(shouldRenderDiff());

        for (const entry of entries) {
          const filePath = entry.target.getAttribute('data-file-path');
          if (!filePath) continue;

          if (entry.isIntersecting) {
            // Track visible files
            if (!visibleFiles.has(filePath)) {
              visibleFiles.add(filePath);
              changed = true;
            }
            // Mark for rendering (once added, never removed)
            if (!toRender.has(filePath)) {
              toRender.add(filePath);
            }
          } else {
            if (visibleFiles.has(filePath)) {
              visibleFiles.delete(filePath);
              changed = true;
            }
          }
        }

        // Update render set if changed
        if (toRender.size !== shouldRenderDiff().size) {
          setShouldRenderDiff(toRender);
        }

        // Notify parent of topmost visible file (O(n) instead of O(n²))
        // Skip if manual scrolling is in progress
        if (!isManualScrolling && changed && visibleFiles.size > 0) {
          let topmost: string | null = null;
          let minIdx = Infinity;
          for (const path of visibleFiles) {
            const idx = pathIndexMap().get(path) ?? Infinity;
            if (idx < minIdx) {
              minIdx = idx;
              topmost = path;
            }
          }
          if (topmost) {
            props.onVisibleFileChange(topmost);
          }
        }
      },
      {
        root: scrollContainerRef,
        threshold: [0, 1], // Just top/bottom - simpler
        rootMargin: '200px 0px 200px 0px', // Render margin for lazy loading
      }
    );

    // Observe files only on mount and when file list changes
    let observedFiles = new Set<string>();
    createEffect(() => {
      const files = props.sortedFiles;
      const currentPaths = new Set(files.map(f => f.path));

      // Remove observations for deleted files
      for (const path of observedFiles) {
        if (!currentPaths.has(path)) {
          const ref = fileRefs.get(path);
          if (ref) observer.unobserve(ref);
          fileRefs.delete(path);
        }
      }

      // Add observations for new files
      for (const file of files) {
        if (!observedFiles.has(file.path)) {
          const ref = fileRefs.get(file.path);
          if (ref) observer.observe(ref);
        }
      }

      observedFiles = currentPaths;
    });

    onCleanup(() => {
      observer.disconnect();
      fileRefs.clear();
    });
  });

  // Watch for scroll requests from the store
  let lastScrollPath: string | null = null;
  createEffect(() => {
    const path = props.scrollToPath;
    if (path && path !== lastScrollPath) {
      lastScrollPath = path;
      const ref = fileRefs.get(path);
      if (ref) {
        // Set manual scroll flag to prevent observer override
        isManualScrolling = true;

        ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Immediately update visible file to the scrolled-to file
        props.onVisibleFileChange(path);

        // Clear flag after scroll animation completes (~500ms for smooth scroll)
        setTimeout(() => {
          isManualScrolling = false;
        }, 600);
      }
    }
  });

  const getStatusColor = (status: FileChangeStats['status']) => {
    switch (status) {
      case 'added': return 'text-green-400 bg-green-400/10';
      case 'modified': return 'text-blue-400 bg-blue-400/10';
      case 'deleted': return 'text-red-400 bg-red-400/10';
      case 'renamed': return 'text-yellow-400 bg-yellow-400/10';
      case 'copied': return 'text-purple-400 bg-purple-400/10';
      default: return 'text-zed-text-secondary bg-zed-bg-hover';
    }
  };

  const getStatusLetter = (status: FileChangeStats['status']) => {
    switch (status) {
      case 'added': return 'A';
      case 'modified': return 'M';
      case 'deleted': return 'D';
      case 'renamed': return 'R';
      case 'copied': return 'C';
      default: return '?';
    }
  };

  const getFileName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  const getFileDir = (path: string) => {
    const parts = path.split('/');
    if (parts.length <= 1) return '';
    return parts.slice(0, -1).join('/');
  };

  // Calculate bottom padding: context panel height % of the scroll view height
  const bottomPadding = () => {
    const panelPercent = props.contextPanelHeightPercent ?? 33;
    return `${panelPercent}%`;
  };

  return (
    <div ref={scrollContainerRef} class="flex-1 overflow-y-auto">
      <Show
        when={props.sortedFiles.length > 0}
        fallback={
          <div class="flex items-center justify-center h-full text-zed-text-tertiary">
            <p class="text-sm">No files to display</p>
          </div>
        }
      >
        <div style={{ 'padding-bottom': bottomPadding() }}>
        <For each={props.sortedFiles}>
          {(file) => {
            const diff = () => props.fileDiffs.get(file.path) || '';

            return (
              <div
                ref={(el) => fileRefs.set(file.path, el)}
                data-file-path={file.path}
                class="border-b border-zed-border-subtle"
              >
                {/* Sticky File Header */}
                <div class="sticky top-0 z-10 px-3 py-2 bg-zed-bg-panel border-b border-zed-border-subtle flex items-center gap-2">
                  <span class={`inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded ${getStatusColor(file.status)}`}>
                    {getStatusLetter(file.status)}
                  </span>
                  <span class="text-sm font-medium text-zed-text-primary truncate">
                    {getFileName(file.path)}
                  </span>
                  <Show when={getFileDir(file.path)}>
                    <span class="text-xs text-zed-text-tertiary truncate">
                      {getFileDir(file.path)}
                    </span>
                  </Show>
                  <div class="ml-auto flex items-center gap-2 text-xs font-mono flex-shrink-0">
                    <span class="text-green-400">+{file.additions}</span>
                    <span class="text-red-400">-{file.deletions}</span>
                  </div>
                </div>

                {/* Diff Content - Lazy rendered */}
                <Show
                  when={diff()}
                  fallback={
                    <div class="p-4 text-center text-zed-text-tertiary text-xs">
                      No diff available
                    </div>
                  }
                >
                  <Show
                    when={shouldRenderDiff().has(file.path)}
                    fallback={
                      <div class="h-64 flex items-center justify-center text-zed-text-tertiary">
                        <div class="flex items-center gap-2 text-xs">
                          <div class="w-2 h-2 bg-zed-accent-blue rounded-full animate-pulse" />
                          <span>Loading diff...</span>
                        </div>
                      </div>
                    }
                  >
                    <div class="w-full min-h-[200px]">
                      <DiffViewer
                        diff={diff()}
                        fileName={getFileName(file.path)}
                        filePath={file.path}
                        workingDir={props.workingDir}
                        embedded={true}
                      />
                    </div>
                  </Show>
                </Show>
              </div>
            );
          }}
        </For>
        </div>
      </Show>
    </div>
  );
}
