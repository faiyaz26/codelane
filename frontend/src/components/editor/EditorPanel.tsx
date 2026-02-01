// Editor panel - orchestrates file tabs and viewer with lazy loading

import { createSignal, createEffect, createMemo, on, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { EditorTabs } from './EditorTabs';
import { FileViewer } from './FileViewer';
import type { OpenFile, EditorTab } from './types';
import { detectLanguage } from './types';

interface EditorPanelProps {
  // Path of file to open (from file explorer)
  selectedFilePath?: string;
  // Callback when all files are closed
  onAllFilesClosed?: () => void;
}

export function EditorPanel(props: EditorPanelProps) {
  // Open files state - tracks metadata for all open files
  const [openFiles, setOpenFiles] = createSignal<Map<string, OpenFile>>(new Map());
  const [activeFileId, setActiveFileId] = createSignal<string | null>(null);
  // Track which files have been rendered (for lazy loading)
  const [renderedFiles, setRenderedFiles] = createSignal<Set<string>>(new Set());

  // Derive tabs from open files
  const tabs = createMemo((): EditorTab[] => {
    const files = openFiles();
    return Array.from(files.values()).map((file) => ({
      id: file.id,
      path: file.path,
      name: file.name,
      isModified: file.isModified,
    }));
  });

  // Get list of files to render (only files that have been activated at least once)
  const filesToRender = createMemo(() => {
    const files = openFiles();
    const rendered = renderedFiles();
    return Array.from(files.values()).filter((f) => rendered.has(f.id));
  });

  // Mark file as rendered when it becomes active
  createEffect(() => {
    const activeId = activeFileId();
    if (activeId && !renderedFiles().has(activeId)) {
      setRenderedFiles((prev) => new Set(prev).add(activeId));
    }
  });

  // Open file when selectedFilePath changes
  createEffect(
    on(
      () => props.selectedFilePath,
      async (path) => {
        if (!path) return;
        await openFile(path);
      }
    )
  );

  // Load file content when file becomes active and hasn't been loaded yet
  createEffect(() => {
    const activeId = activeFileId();
    if (!activeId) return;

    const file = openFiles().get(activeId);
    if (file && file.content === null && !file.isLoading && !file.error) {
      loadFileContent(activeId, file.path);
    }
  });

  // Open a file (creates tab, doesn't load content until active)
  const openFile = async (path: string) => {
    // Check if already open
    const existingFile = Array.from(openFiles().values()).find((f) => f.path === path);
    if (existingFile) {
      setActiveFileId(existingFile.id);
      return;
    }

    // Create new file entry (content will be loaded lazily)
    const id = crypto.randomUUID();
    const name = path.split('/').pop() || 'Untitled';
    const language = detectLanguage(name);

    const newFile: OpenFile = {
      id,
      path,
      name,
      content: null,
      isLoading: false,
      isModified: false,
      error: null,
      language,
    };

    // Add to open files and set as active
    setOpenFiles((prev) => {
      const next = new Map(prev);
      next.set(id, newFile);
      return next;
    });
    setActiveFileId(id);
  };

  // Load file content
  const loadFileContent = async (fileId: string, path: string) => {
    // Set loading state
    setOpenFiles((prev) => {
      const next = new Map(prev);
      const file = next.get(fileId);
      if (file) {
        next.set(fileId, { ...file, isLoading: true });
      }
      return next;
    });

    try {
      const content = await invoke<string>('read_file', { path });

      setOpenFiles((prev) => {
        const next = new Map(prev);
        const file = next.get(fileId);
        if (file) {
          next.set(fileId, {
            ...file,
            content,
            isLoading: false,
          });
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to read file:', err);

      setOpenFiles((prev) => {
        const next = new Map(prev);
        const file = next.get(fileId);
        if (file) {
          next.set(fileId, {
            ...file,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to read file',
          });
        }
        return next;
      });
    }
  };

  // Close a file
  const closeFile = (fileId: string) => {
    setOpenFiles((prev) => {
      const next = new Map(prev);
      next.delete(fileId);

      // If closing active file, switch to another
      if (activeFileId() === fileId) {
        const remaining = Array.from(next.keys());
        if (remaining.length > 0) {
          setActiveFileId(remaining[remaining.length - 1]);
        } else {
          setActiveFileId(null);
          props.onAllFilesClosed?.();
        }
      }

      return next;
    });

    // Remove from rendered files
    setRenderedFiles((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
  };

  // Select a tab
  const selectTab = (tabId: string) => {
    setActiveFileId(tabId);
  };

  return (
    <div class="h-full flex flex-col bg-zed-bg-surface">
      {/* File tabs */}
      <EditorTabs
        tabs={tabs()}
        activeTabId={activeFileId()}
        onTabSelect={selectTab}
        onTabClose={closeFile}
      />

      {/* File viewers - render all activated files, show/hide with CSS */}
      <div class="flex-1 overflow-hidden relative">
        <Show
          when={filesToRender().length > 0}
          fallback={
            <div class="h-full flex items-center justify-center">
              <div class="text-center">
                <svg
                  class="w-16 h-16 mx-auto mb-4 text-zed-text-disabled"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 class="text-lg font-medium text-zed-text-secondary mb-2">No file selected</h3>
                <p class="text-sm text-zed-text-tertiary max-w-xs">
                  Select a file from the explorer to view its contents.
                </p>
              </div>
            </div>
          }
        >
          <For each={filesToRender()}>
            {(file) => (
              <div
                class="absolute inset-0"
                style={{ display: file.id === activeFileId() ? 'block' : 'none' }}
              >
                <FileViewer file={file} />
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
