/**
 * ReviewFileScrollView - Top 2/3 of the right half
 *
 * Scrollable container rendering all changed files sequentially.
 * Each file has a sticky header and inline DiffViewer.
 * Uses IntersectionObserver to track which file is currently visible.
 *
 * Performance optimizations:
 * - Debounced visibility updates to reduce callback frequency
 * - Sorted array of visible file indices for O(1) topmost lookup
 * - Binary search insertion for O(log n) updates
 * - Simplified intersection thresholds
 */

import { For, Show, createSignal, onMount, onCleanup, createEffect, createMemo } from 'solid-js';
import { DiffViewer } from '../editor/DiffViewer';
import { debounce } from '../../utils/debounce';
import { useLazyDiff } from '../../hooks/useLazyDiff';
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

  // Debounced visibility update - reduces callback frequency from every scroll to max once per 100ms
  const debouncedVisibleFileUpdate = debounce((filePath: string) => {
    props.onVisibleFileChange(filePath);
  }, 100);

  // Helper function to insert value in sorted array (binary search insertion, O(log n))
  const insertSorted = (arr: number[], value: number): void => {
    let low = 0;
    let high = arr.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (arr[mid] < value) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    arr.splice(low, 0, value);
  };

  // Single merged IntersectionObserver for both visibility and lazy rendering
  onMount(() => {
    if (!scrollContainerRef) return;

    const visibleFiles = new Set<string>();
    // Keep sorted array of visible file indices for O(1) topmost lookup
    const visibleIndices: number[] = [];

    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false;
        const toRender = new Set(shouldRenderDiff());

        for (const entry of entries) {
          const filePath = entry.target.getAttribute('data-file-path');
          if (!filePath) continue;

          const idx = pathIndexMap().get(filePath);
          if (idx === undefined) continue;

          if (entry.isIntersecting) {
            // Track visible files
            if (!visibleFiles.has(filePath)) {
              visibleFiles.add(filePath);
              // Insert index in sorted position (O(log n) insertion)
              insertSorted(visibleIndices, idx);
              changed = true;
            }
            // Mark for rendering (once added, never removed)
            if (!toRender.has(filePath)) {
              toRender.add(filePath);
            }
          } else {
            if (visibleFiles.has(filePath)) {
              visibleFiles.delete(filePath);
              // Remove index from sorted array (O(n) but rare)
              const idxPos = visibleIndices.indexOf(idx);
              if (idxPos !== -1) {
                visibleIndices.splice(idxPos, 1);
              }
              changed = true;
            }
          }
        }

        // Update render set if changed
        if (toRender.size !== shouldRenderDiff().size) {
          setShouldRenderDiff(toRender);
        }

        // Notify parent of topmost visible file (O(1) - just take first index from sorted array)
        // Skip if manual scrolling is in progress
        if (!isManualScrolling && changed && visibleIndices.length > 0) {
          const topmostIdx = visibleIndices[0]; // Smallest index
          const topmostPath = props.sortedFiles[topmostIdx]?.path;
          if (topmostPath) {
            debouncedVisibleFileUpdate(topmostPath);
          }
        }
      },
      {
        root: scrollContainerRef,
        threshold: [0, 0.1], // Simpler threshold for better performance
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

  // Memoize status lookup maps for O(1) header rendering
  // Impact: File headers are sticky and render frequently as user scrolls; efficient lookups improve scroll performance
  const statusColorMap = createMemo(() => {
    const map = new Map<string, string>();
    map.set('added', 'text-green-400 bg-green-400/10');
    map.set('modified', 'text-blue-400 bg-blue-400/10');
    map.set('deleted', 'text-red-400 bg-red-400/10');
    map.set('renamed', 'text-yellow-400 bg-yellow-400/10');
    map.set('copied', 'text-purple-400 bg-purple-400/10');
    return map;
  });

  const statusLetterMap = createMemo(() => {
    const map = new Map<string, string>();
    map.set('added', 'A');
    map.set('modified', 'M');
    map.set('deleted', 'D');
    map.set('renamed', 'R');
    map.set('copied', 'C');
    return map;
  });

  const getStatusColor = (status: FileChangeStats['status']) => {
    return statusColorMap().get(status) ?? 'text-zed-text-secondary bg-zed-bg-hover';
  };

  const getStatusLetter = (status: FileChangeStats['status']) => {
    return statusLetterMap().get(status) ?? '?';
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

  // Memoize bottom padding calculation to stabilize style binding
  // Impact: Avoid recalculating padding string on every render cycle
  const bottomPadding = createMemo(() => {
    const panelPercent = props.contextPanelHeightPercent ?? 33;
    return `${panelPercent}%`;
  });

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
            // Check if file should render (near viewport)
            const shouldRender = () => shouldRenderDiff().has(file.path);

            // For files with cached diffs (from summary), use them
            const cachedDiff = () => props.fileDiffs.get(file.path);

            // For files without cached diffs, lazy load on demand
            const lazyDiff = useLazyDiff({
              filePath: file.path,
              workingDir: props.workingDir,
              shouldLoad: shouldRender,
            });

            // Use cached diff if available, otherwise lazy-loaded diff
            const diff = () => cachedDiff() ?? lazyDiff.diff();

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

                {/* Diff Content - Lazy rendered and lazy loaded */}
                <Show
                  when={shouldRender()}
                  fallback={
                    <div class="h-64 flex items-center justify-center text-zed-text-tertiary">
                      <div class="flex items-center gap-2 text-xs">
                        <div class="w-2 h-2 bg-zed-accent-blue rounded-full animate-pulse" />
                        <span>Scroll to load...</span>
                      </div>
                    </div>
                  }
                >
                  <Show
                    when={diff()}
                    fallback={
                      <Show
                        when={lazyDiff.loading()}
                        fallback={
                          <div class="p-4 text-center text-zed-text-tertiary text-xs">
                            {lazyDiff.error() || 'No diff available'}
                          </div>
                        }
                      >
                        <div class="h-64 flex items-center justify-center">
                          <div class="flex flex-col items-center gap-2">
                            <div class="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            <span class="text-xs text-zed-text-tertiary">Loading diff...</span>
                          </div>
                        </div>
                      </Show>
                    }
                  >
                    <div class="w-full min-h-[200px]">
                      <DiffViewer
                        diff={diff()!}
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
