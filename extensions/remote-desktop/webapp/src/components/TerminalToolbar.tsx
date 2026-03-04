import { For } from 'solid-js';

interface TerminalToolbarProps {
  onKeyPress: (key: string) => void;
}

export function TerminalToolbar(props: TerminalToolbarProps) {
  const keys = [
    { label: 'ESC', value: '\x1b' },
    { label: 'TAB', value: '\t' },
    { label: 'CTRL', value: 'CTRL' }, // Special handling for CTRL
    { label: 'ALT', value: 'ALT' },   // Special handling for ALT
    { label: '↑', value: '\x1b[A' },
    { label: '↓', value: '\x1b[B' },
    { label: '←', value: '\x1b[D' },
    { label: '→', value: '\x1b[C' },
    { label: 'CTRL+C', value: '\x03' },
    { label: 'CTRL+D', value: '\x04' },
    { label: 'CTRL+Z', value: '\x1a' },
    { label: 'ENTER', value: '\r' },
  ];

  return (
    <div class="h-10 bg-zed-bg-surface border-t border-zed-border-subtle flex items-center px-2 gap-2 overflow-x-auto no-scrollbar shrink-0">
      <For each={keys}>
        {(key) => (
          <button
            onClick={() => props.onKeyPress(key.value)}
            class="px-3 py-1 bg-zed-bg-panel border border-zed-border-default rounded text-[10px] font-bold text-zed-text-secondary active:bg-zed-accent-blue active:text-white transition-colors"
          >
            {key.label}
          </button>
        )}
      </For>
    </div>
  );
}
