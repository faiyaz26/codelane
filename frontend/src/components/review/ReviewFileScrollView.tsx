/**
 * ReviewFileScrollView - Top 2/3 of the right half
 *
 * Scrollable container rendering all changed files sequentially.
 * Each file has a sticky header and inline DiffViewer.
 * Uses IntersectionObserver to track which file is currently visible.
 */

import { For, Show, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { DiffViewer } from '../editor/DiffViewer';
import type { FileChangeStats } from '../../types/git';

interface ReviewFileScrollViewProps {
  laneId: string;
  workingDir: string;
  sortedFiles: FileChangeStats[];
  fileDiffs: Map<string, string>;
  onVisibleFileChange: (path: string) => void;
  onScrollToFile?: (scrollFn: (path: string) => void) => void;
}

export function ReviewFileScrollView(props: ReviewFileScrollViewProps) {
  let scrollContainerRef: HTMLDivElement | undefined;
  const fileRefs = new Map<string, HTMLElement>();
  const [visibleFiles, setVisibleFiles] = createSignal<Set<string>>(new Set());
  const [shouldRenderDiff, setShouldRenderDiff] = createSignal<Set<string>>(new Set());

  // Set up IntersectionObserver for scroll tracking AND lazy diff rendering
  onMount(() => {
    if (!scrollContainerRef) return;

    // Observer 1: Track which file is visible for context panel (narrow threshold)
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        const newVisible = new Set(visibleFiles());
        for (const entry of entries) {
          const filePath = entry.target.getAttribute('data-file-path');
          if (!filePath) continue;

          if (entry.isIntersecting) {
            newVisible.add(filePath);
          } else {
            newVisible.delete(filePath);
          }
        }
        setVisibleFiles(newVisible);

        // Notify parent of the topmost visible file
        const visible = Array.from(newVisible);
        if (visible.length > 0) {
          // Find the topmost visible file by checking order in sortedFiles
          const sortedPaths = props.sortedFiles.map(f => f.path);
          const topmost = visible.sort(
            (a, b) => sortedPaths.indexOf(a) - sortedPaths.indexOf(b)
          )[0];
          if (topmost) {
            props.onVisibleFileChange(topmost);
          }
        }
      },
      {
        root: scrollContainerRef,
        threshold: 0.1,
        rootMargin: '0px 0px -60% 0px', // Trigger when file is in top 40%
      }
    );

    // Observer 2: Lazy render diffs (wider threshold - render before visible)
    const renderObserver = new IntersectionObserver(
      (entries) => {
        setShouldRenderDiff(prev => {
          const newSet = new Set(prev);
          for (const entry of entries) {
            const filePath = entry.target.getAttribute('data-file-path');
            if (!filePath) continue;

            if (entry.isIntersecting) {
              newSet.add(filePath); // Once added, never remove (diff stays mounted)
            }
          }
          return newSet;
        });
      },
      {
        root: scrollContainerRef,
        threshold: 0,
        rootMargin: '300px 0px 300px 0px', // Render diffs 300px before they enter viewport
      }
    );

    // Re-observe when file list changes
    createEffect(() => {
      // Access sortedFiles to track it
      const files = props.sortedFiles;

      // Disconnect old observations
      visibilityObserver.disconnect();
      renderObserver.disconnect();

      // Re-observe all file headers
      for (const file of files) {
        const ref = fileRefs.get(file.path);
        if (ref) {
          visibilityObserver.observe(ref);
          renderObserver.observe(ref);
        }
      }
    });

    onCleanup(() => {
      visibilityObserver.disconnect();
      renderObserver.disconnect();
    });
  });

  // Expose scroll-to-file function
  createEffect(() => {
    if (props.onScrollToFile) {
      props.onScrollToFile((path: string) => {
        const ref = fileRefs.get(path);
        if (ref) {
          ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
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
                    <div class="max-h-[600px] overflow-auto">
                      <DiffViewer
                        diff={diff()}
                        fileName={getFileName(file.path)}
                        filePath={file.path}
                        workingDir={props.workingDir}
                      />
                    </div>
                  </Show>
                </Show>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}
