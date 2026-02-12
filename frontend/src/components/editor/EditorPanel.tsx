// Editor panel - orchestrates file tabs and viewer with lazy loading
// State is managed per-lane via EditorStateManager

import { createMemo, createEffect, createSignal, on, For, Show } from 'solid-js';
import { EditorTabs } from './EditorTabs';
import { FileViewer } from './FileViewer';
import { DiffViewer } from './DiffViewer';
import { UnsavedChangesModal, type UnsavedChangesResult } from './UnsavedChangesModal';
import { ExternalChangeModal, type ExternalChangeResult } from './ExternalChangeModal';
import type { EditorTab } from './types';
import { editorStateManager } from '../../services/EditorStateManager';

interface EditorPanelProps {
  // Lane ID for scoping editor state
  laneId: string;
  // Lane's working directory for relative path calculation
  basePath?: string;
  // Path of file to open (from file explorer)
  selectedFilePath?: string;
  // Callback when all files are closed
  onAllFilesClosed?: () => void;
}

export function EditorPanel(props: EditorPanelProps) {
  // Modal state for unsaved changes confirmation
  const [pendingCloseFile, setPendingCloseFile] = createSignal<{ id: string; name: string } | null>(
    null
  );

  // Modal state for external change notification
  const [externalChangeFile, setExternalChangeFile] = createSignal<{
    id: string;
    name: string;
    hasLocalChanges: boolean;
  } | null>(null);

  // Derive tabs from open files in order
  const tabs = createMemo((): EditorTab[] => {
    const files = editorStateManager.getOpenFiles(props.laneId);
    const order = editorStateManager.getTabOrder(props.laneId);
    return order.map((id) => {
      const file = files[id];
      return {
        id: file.id,
        path: file.path,
        name: file.name,
        isModified: file.isModified,
      };
    }).filter(Boolean); // Filter out any undefined entries
  });

  // Get active file ID
  const activeFileId = createMemo(() => {
    return editorStateManager.getActiveFileId(props.laneId);
  });

  // Get file IDs to render (only files that have been activated)
  // Using IDs instead of objects for stable identity tracking in For loop
  const fileIdsToRender = createMemo(() => {
    const files = editorStateManager.getOpenFiles(props.laneId);
    const rendered = editorStateManager.getRenderedFiles(props.laneId);
    return Object.keys(files).filter((id) => rendered.has(id));
  });

  // Get file by ID (reactive lookup)
  const getFile = (fileId: string) => {
    return editorStateManager.getOpenFiles(props.laneId)[fileId];
  };

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
    const file = files[fileId];

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

  // Reorder tabs
  const reorderTabs = (fromIndex: number, toIndex: number) => {
    editorStateManager.reorderTabs(props.laneId, fromIndex, toIndex);
  };

  // Check for external changes when active file changes
  createEffect(
    on(activeFileId, (fileId) => {
      if (!fileId) return;

      const files = editorStateManager.getOpenFiles(props.laneId);
      const file = files[fileId];

      if (file?.hasExternalChanges) {
        // Show external change modal
        setExternalChangeFile({
          id: fileId,
          name: file.name,
          hasLocalChanges: file.isModified,
        });
      }
    })
  );

  // Handle external change modal result
  const handleExternalChangeResult = async (result: ExternalChangeResult) => {
    const pending = externalChangeFile();
    if (!pending) return;

    setExternalChangeFile(null);

    if (result === 'cancel') {
      return;
    }

    if (result === 'reload') {
      // Reload file from disk
      await editorStateManager.reloadFile(props.laneId, pending.id);
    } else if (result === 'keep') {
      // Keep local changes, clear the external change flag (don't save yet)
      editorStateManager.clearExternalChangeFlag(props.laneId, pending.id);
    } else if (result === 'overwrite') {
      // Save local changes to disk, overwriting external changes
      await editorStateManager.saveFile(props.laneId, pending.id);
      editorStateManager.clearExternalChangeFlag(props.laneId, pending.id);
    }
  };

  return (
    <div class="h-full flex flex-col bg-zed-bg-surface">
      {/* Unsaved changes confirmation modal */}
      <UnsavedChangesModal
        isOpen={pendingCloseFile() !== null}
        fileName={pendingCloseFile()?.name || ''}
        onResult={handleUnsavedChangesResult}
      />

      {/* External change notification modal */}
      <ExternalChangeModal
        isOpen={externalChangeFile() !== null}
        fileName={externalChangeFile()?.name || ''}
        hasLocalChanges={externalChangeFile()?.hasLocalChanges || false}
        onResult={handleExternalChangeResult}
      />

      {/* File tabs */}
      <EditorTabs
        tabs={tabs()}
        activeTabId={activeFileId()}
        onTabSelect={selectTab}
        onTabClose={closeFile}
        onTabReorder={reorderTabs}
        basePath={props.basePath}
      />

      {/* File viewers - render all activated files, show/hide with CSS */}
      <div class="flex-1 overflow-hidden relative">
        <Show
          when={fileIdsToRender().length > 0}
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
          <For each={fileIdsToRender()} fallback={null}>
            {(fileId) => {
              // Look up file reactively - getFile returns undefined if file was closed
              const file = () => getFile(fileId);
              return (
                <Show when={file()}>
                  <div
                    class="absolute inset-0"
                    style={{ display: fileId === activeFileId() ? 'block' : 'none' }}
                    data-file-id={fileId}
                  >
                    {/* Show DiffViewer for diff mode, otherwise show regular FileViewer */}
                    <Show
                      when={file()!.isDiffView && file()!.diffContent !== undefined}
                      fallback={<FileViewer file={file()!} laneId={props.laneId} />}
                    >
                      <DiffViewer
                        diff={file()!.diffContent!}
                        fileName={file()!.name}
                        filePath={file()!.path.replace(props.basePath + '/', '')}
                        workingDir={props.basePath}
                      />
                    </Show>
                  </div>
                </Show>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
}
