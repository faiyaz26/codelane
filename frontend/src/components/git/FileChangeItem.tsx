import { Show } from 'solid-js';

export type FileChangeStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'typechange' | 'unknown' | 'untracked';

interface FileChangeItemProps {
  path: string;
  status: FileChangeStatus;
  checked: boolean;
  onToggle: (path: string) => void;
}

const STATUS_CONFIG: Record<FileChangeStatus, { letter: string; label: string; color: string; bg: string }> = {
  modified: { letter: 'M', label: 'Modified', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  added: { letter: 'A', label: 'Added', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  deleted: { letter: 'D', label: 'Deleted', color: 'text-red-400', bg: 'bg-red-400/10' },
  renamed: { letter: 'R', label: 'Renamed', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  copied: { letter: 'C', label: 'Copied', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  typechange: { letter: 'T', label: 'Type Changed', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  unknown: { letter: '?', label: 'Unknown', color: 'text-zinc-400', bg: 'bg-zinc-400/10' },
  untracked: { letter: 'U', label: 'Untracked', color: 'text-zinc-400', bg: 'bg-zinc-400/10' },
};

export function FileChangeItem(props: FileChangeItemProps) {
  const config = () => STATUS_CONFIG[props.status];

  const fileName = () => {
    const parts = props.path.split('/');
    return parts[parts.length - 1];
  };

  const dirPath = () => {
    const parts = props.path.split('/');
    if (parts.length > 1) {
      return parts.slice(0, -1).join('/') + '/';
    }
    return '';
  };

  return (
    <div
      class={`group flex items-center gap-2.5 px-2 py-1.5 cursor-pointer rounded-md transition-all duration-150 ${
        props.checked
          ? 'bg-zed-accent-blue/10 hover:bg-zed-accent-blue/15'
          : 'hover:bg-white/[0.04]'
      }`}
      onClick={() => props.onToggle(props.path)}
    >
      {/* Checkbox */}
      <div class="flex-shrink-0 relative">
        <div
          class={`w-4 h-4 rounded border-[1.5px] transition-all duration-150 flex items-center justify-center ${
            props.checked
              ? 'bg-zed-accent-blue border-zed-accent-blue'
              : 'border-zinc-600 group-hover:border-zinc-500 bg-transparent'
          }`}
        >
          <Show when={props.checked}>
            <svg
              class="w-2.5 h-2.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="3"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </Show>
        </div>
      </div>

      {/* File icon */}
      <svg class="w-4 h-4 flex-shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>

      {/* File path */}
      <div class="flex-1 min-w-0 flex items-center gap-1.5">
        <span class="truncate text-[13px]">
          <Show when={dirPath()}>
            <span class="text-zinc-500">{dirPath()}</span>
          </Show>
          <span class="text-zinc-200">{fileName()}</span>
        </span>
      </div>

      {/* Status badge */}
      <div
        class={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide ${config().color} ${config().bg}`}
        title={config().label}
      >
        {config().letter}
      </div>
    </div>
  );
}
