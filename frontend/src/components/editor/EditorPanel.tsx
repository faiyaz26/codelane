// Editor panel - orchestrates file tabs and viewer with lazy loading
// State is managed per-lane via EditorStateManager

import { createMemo, createEffect, createSignal, on, For, Show } from 'solid-js';
import { EditorTabs } from './EditorTabs';
import { FileViewer } from './FileViewer';
import { UnsavedChangesModal, type UnsavedChangesResult } from './UnsavedChangesModal';
import type { EditorTab } from './types';
import { editorStateManager } from '../../services/EditorStateManager';

interface EditorPanelProps {
  // Lane ID for scoping editor state
  laneId: string;
  // Path of file to open (from file explorer)
  selectedFilePath?: string;
  // Callback when all files are closed
  onAllFilesClosed?: () => void;
}

export function EditorPanel(props: EditorPanelProps) {
  // Subscribe to state updates
  const _ = editorStateManager.getUpdateSignal();

  // Modal state for unsaved changes confirmation
  const [pendingCloseFile, setPendingCloseFile] = createSignal<{ id: string; name: string } | null>(
    null
  );

  // Derive tabs from open files
  const tabs = createMemo((): EditorTab[] => {
    // Access update signal for reactivity
    editorStateManager.getUpdateSignal()();

    const files = editorStateManager.getOpenFiles(props.laneId);
    return Array.from(files.values()).map((file) => ({
      id: file.id,
      path: file.path,
      name: file.name,
      isModified: file.isModified,
    }));
  });

  // Get active file ID
  const activeFileId = createMemo(() => {
    editorStateManager.getUpdateSignal()();
    return editorStateManager.getActiveFileId(props.laneId);
  });

  // Get files to render (only files that have been activated)
  const filesToRender = createMemo(() => {
    editorStateManager.getUpdateSignal()();

    const files = editorStateManager.getOpenFiles(props.laneId);
    const rendered = editorStateManager.getRenderedFiles(props.laneId);
    return Array.from(files.values()).filter((f) => rendered.has(f.id));
  });

  // Open file when selectedFilePath changes
  createEffect(
    on(
      () => props.selectedFilePath,
      async (path) => {
        if (!path) return;
        await editorStateManager.openFile(props.laneId, path);
      }
    )
  );

  // Close a file (with unsaved changes confirmation)
  const closeFile = (fileId: string) => {
    // Check if file has unsaved changes
    const files = editorStateManager.getOpenFiles(props.laneId);
    const file = files.get(fileId);

    if (file?.isModified) {
      // Show confirmation modal
      setPendingCloseFile({ id: fileId, name: file.name });
      return;
    }

    // No unsaved changes, close directly
    doCloseFile(fileId);
  };

  // Actually close the file
  const doCloseFile = (fileId: string) => {
    const noFilesRemaining = editorStateManager.closeFile(props.laneId, fileId);
    if (noFilesRemaining) {
      props.onAllFilesClosed?.();
    }
  };

  // Handle unsaved changes modal result
  const handleUnsavedChangesResult = async (result: UnsavedChangesResult) => {
    const pending = pendingCloseFile();
    if (!pending) return;

    setPendingCloseFile(null);

    if (result === 'cancel') {
      return;
    }

    if (result === 'save') {
      // Save the file first, then close
      const saved = await editorStateManager.saveFile(props.laneId, pending.id);
      if (!saved) {
        // Save failed, don't close
        return;
      }
    }

    // Close the file (for both 'save' and 'discard')
    doCloseFile(pending.id);
  };

  // Select a tab
  const selectTab = (tabId: string) => {
    editorStateManager.setActiveFile(props.laneId, tabId);
  };

  return (
    <div class="h-full flex flex-col bg-zed-bg-surface">
      {/* Unsaved changes confirmation modal */}
      <UnsavedChangesModal
        isOpen={pendingCloseFile() !== null}
        fileName={pendingCloseFile()?.name || ''}
        onResult={handleUnsavedChangesResult}
      />

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
                <FileViewer file={file} laneId={props.laneId} />
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
