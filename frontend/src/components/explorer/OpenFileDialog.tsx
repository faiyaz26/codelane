// OpenFileDialog - lets users open a file by pasting a path or using the OS file picker

import { createSignal, Show } from 'solid-js';
import { open as openFilePicker } from '@tauri-apps/plugin-dialog';
import { Dialog } from '../ui';

interface OpenFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileOpen: (path: string) => void;
}

export function OpenFileDialog(props: OpenFileDialogProps) {
  const [filePath, setFilePath] = createSignal('');
  const [error, setError] = createSignal('');

  const handleBrowse = async () => {
    try {
      const selected = await openFilePicker({
        multiple: false,
        title: 'Open File',
      });
      if (selected && typeof selected === 'string') {
        setFilePath(selected);
        setError('');
      }
    } catch (err) {
      console.error('[OpenFileDialog] File picker error:', err);
    }
  };

  const handleOpen = () => {
    const path = filePath().trim();
    if (!path) {
      setError('Please enter a file path.');
      return;
    }
    props.onFileOpen(path);
    setFilePath('');
    setError('');
    props.onOpenChange(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleOpen();
    if (e.key === 'Escape') {
      setFilePath('');
      setError('');
      props.onOpenChange(false);
    }
  };

  const handleClose = () => {
    setFilePath('');
    setError('');
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={handleClose} title="Open File">
      <div class="flex flex-col gap-3">
        <p class="text-xs text-zed-text-secondary">
          Paste a file path or browse to select a file to open in the editor.
        </p>

        {/* Path input + browse button */}
        <div class="flex gap-2">
          <input
            type="text"
            class="flex-1 px-3 py-2 text-sm bg-zed-bg-surface border border-zed-border-default rounded text-zed-text-primary placeholder-zed-text-tertiary focus:outline-none focus:border-zed-accent-blue transition-colors"
            placeholder="/path/to/file.ts"
            value={filePath()}
            onInput={(e) => {
              setFilePath(e.currentTarget.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            autofocus
          />
          <button
            class="px-3 py-2 text-xs font-medium text-zed-text-primary bg-zed-bg-hover hover:bg-zed-bg-surface border border-zed-border-default rounded transition-colors cursor-pointer select-none shrink-0"
            onClick={handleBrowse}
            title="Browse for a file"
          >
            Browse…
          </button>
        </div>

        {/* Error message */}
        <Show when={error()}>
          <p class="text-xs text-zed-accent-red">{error()}</p>
        </Show>

        {/* Actions */}
        <div class="flex justify-end gap-2 mt-1">
          <button
            class="px-3 py-1.5 text-xs font-medium text-zed-text-secondary hover:text-zed-text-primary bg-zed-bg-hover hover:bg-zed-bg-surface border border-zed-border-default rounded transition-colors cursor-pointer select-none"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            class="px-3 py-1.5 text-xs font-medium text-white bg-zed-accent-blue hover:bg-zed-accent-blue-hover rounded transition-colors cursor-pointer select-none"
            onClick={handleOpen}
          >
            Open
          </button>
        </div>
      </div>
    </Dialog>
  );
}
