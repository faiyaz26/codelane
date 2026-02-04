import { createSignal, createMemo, For, Show } from 'solid-js';
import { useGitWatcher } from '../../hooks';

interface ChangesViewProps {
  workingDir: string;
  onFileSelect?: (path: string) => void;
}

type FileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'typechange' | 'unknown' | 'untracked';

interface FileEntry {
  path: string;
  fullPath: string;
  status: FileStatus;
  category: 'staged' | 'unstaged' | 'untracked';
}

const STATUS_CONFIG: Record<FileStatus, { letter: string; color: string }> = {
  modified: { letter: 'M', color: 'text-amber-400' },
  added: { letter: 'A', color: 'text-emerald-400' },
  deleted: { letter: 'D', color: 'text-red-400' },
  renamed: { letter: 'R', color: 'text-blue-400' },
  copied: { letter: 'C', color: 'text-blue-400' },
  typechange: { letter: 'T', color: 'text-purple-400' },
  unknown: { letter: '?', color: 'text-zinc-400' },
  untracked: { letter: 'U', color: 'text-zinc-400' },
};

export function ChangesView(props: ChangesViewProps) {
  // Section collapsed state
  const [stagedCollapsed, setStagedCollapsed] = createSignal(false);
  const [unstagedCollapsed, setUnstagedCollapsed] = createSignal(false);
  const [untrackedCollapsed, setUntrackedCollapsed] = createSignal(false);

  // Use the shared git watcher hook
  const gitWatcher = useGitWatcher({
    workingDir: () => props.workingDir,
    debounceMs: 500,
  });

  const allFiles = createMemo(() => {
    const status = gitWatcher.gitStatus();
    if (!status) return [];

    const files: FileEntry[] = [];
    const dir = props.workingDir;

    for (const file of status.staged) {
      files.push({
        path: file.path,
        fullPath: `${dir}/${file.path}`,
        status: file.status as FileStatus,
        category: 'staged',
      });
    }

    for (const file of status.unstaged) {
      files.push({
        path: file.path,
        fullPath: `${dir}/${file.path}`,
        status: file.status as FileStatus,
        category: 'unstaged',
      });
    }

    for (const path of status.untracked) {
      files.push({
        path,
        fullPath: `${dir}/${path}`,
        status: 'untracked',
        category: 'untracked',
      });
    }

    return files;
  });

  const stagedFiles = createMemo(() => allFiles().filter((f) => f.category === 'staged'));
  const unstagedFiles = createMemo(() => allFiles().filter((f) => f.category === 'unstaged'));
  const untrackedFiles = createMemo(() => allFiles().filter((f) => f.category === 'untracked'));

  const totalChanges = createMemo(() => allFiles().length);

  const handleFileClick = (file: FileEntry) => {
    if (file.status !== 'deleted' && props.onFileSelect) {
      props.onFileSelect(file.fullPath);
    }
  };

  return (
    <>
      {/* Loading state */}
      <Show when={gitWatcher.isLoading()}>
        <div class="px-4 py-8 text-center">
          <div class="w-5 h-5 mx-auto mb-2 border-2 border-zed-accent-blue/30 border-t-zed-accent-blue rounded-full animate-spin" />
          <p class="text-xs text-zed-text-tertiary">Loading...</p>
        </div>
      </Show>

      {/* Not loading - show content */}
      <Show when={!gitWatcher.isLoading()}>
        {/* Not a git repo */}
        <Show when={gitWatcher.isRepo() === false}>
          <div class="px-4 py-8 text-center text-xs text-zed-text-tertiary">
            <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p>Not a git repository</p>
            <p class="text-zed-text-disabled mt-1">Initialize git to track changes</p>
          </div>
        </Show>

        {/* Error state */}
        <Show when={gitWatcher.error()}>
          <div class="px-4 py-8 text-center text-xs text-zed-accent-red">
            <p>Error loading changes</p>
            <p class="text-zed-text-disabled mt-1">{gitWatcher.error()}</p>
          </div>
        </Show>

        {/* Is a repo and no error */}
        <Show when={gitWatcher.isRepo() === true && !gitWatcher.error()}>
          {/* No changes */}
          <Show when={totalChanges() === 0}>
            <div class="px-4 py-8 text-center text-xs text-zed-text-tertiary">
              <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No changes to display</p>
              <p class="text-zed-text-disabled mt-1">Your working directory is clean</p>
            </div>
          </Show>

          {/* Has changes */}
          <Show when={totalChanges() > 0}>
            <div class="py-2">
              {/* Staged */}
              <Show when={stagedFiles().length > 0}>
                <Section
                  title="Staged Changes"
                  count={stagedFiles().length}
                  collapsed={stagedCollapsed()}
                  onToggle={() => setStagedCollapsed(!stagedCollapsed())}
                  color="emerald"
                >
                  <For each={stagedFiles()}>
                    {(file) => (
                      <FileItem file={file} onClick={() => handleFileClick(file)} />
                    )}
                  </For>
                </Section>
              </Show>

              {/* Modified */}
              <Show when={unstagedFiles().length > 0}>
                <Section
                  title="Changes"
                  count={unstagedFiles().length}
                  collapsed={unstagedCollapsed()}
                  onToggle={() => setUnstagedCollapsed(!unstagedCollapsed())}
                  color="amber"
                >
                  <For each={unstagedFiles()}>
                    {(file) => (
                      <FileItem file={file} onClick={() => handleFileClick(file)} />
                    )}
                  </For>
                </Section>
              </Show>

              {/* Untracked */}
              <Show when={untrackedFiles().length > 0}>
                <Section
                  title="Untracked"
                  count={untrackedFiles().length}
                  collapsed={untrackedCollapsed()}
                  onToggle={() => setUntrackedCollapsed(!untrackedCollapsed())}
                  color="zinc"
                >
                  <For each={untrackedFiles()}>
                    {(file) => (
                      <FileItem file={file} onClick={() => handleFileClick(file)} />
                    )}
                  </For>
                </Section>
              </Show>
            </div>
          </Show>
        </Show>
      </Show>
    </>
  );
}

// Section component
interface SectionProps {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  color: 'emerald' | 'amber' | 'zinc';
  children: any;
}

function Section(props: SectionProps) {
  const colorClasses = {
    emerald: 'bg-emerald-400/10 text-emerald-400',
    amber: 'bg-amber-400/10 text-amber-400',
    zinc: 'bg-zinc-400/10 text-zinc-400',
  };

  return (
    <div class="mb-1">
      <button
        class="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/[0.02] transition-colors text-left"
        onClick={props.onToggle}
      >
        <svg
          class={`w-3 h-3 text-zed-text-tertiary transition-transform duration-150 ${props.collapsed ? '' : 'rotate-90'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="text-xs font-medium text-zed-text-secondary flex-1">{props.title}</span>
        <span class={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${colorClasses[props.color]}`}>
          {props.count}
        </span>
      </button>
      <Show when={!props.collapsed}>
        <div class="ml-2">
          {props.children}
        </div>
      </Show>
    </div>
  );
}

// File item component
interface FileItemProps {
  file: FileEntry;
  onClick: () => void;
}

function FileItem(props: FileItemProps) {
  const config = () => STATUS_CONFIG[props.file.status];

  const fileName = () => {
    const parts = props.file.path.split('/');
    return parts[parts.length - 1];
  };

  const dirPath = () => {
    const parts = props.file.path.split('/');
    if (parts.length > 1) {
      return parts.slice(0, -1).join('/') + '/';
    }
    return '';
  };

  const isClickable = () => props.file.status !== 'deleted';

  return (
    <div
      class={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-colors ${
        isClickable()
          ? 'cursor-pointer hover:bg-white/[0.04]'
          : 'cursor-default opacity-60'
      }`}
      onClick={props.onClick}
    >
      {/* File icon */}
      <svg class="w-3.5 h-3.5 flex-shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>

      {/* File path */}
      <span class="flex-1 truncate">
        <Show when={dirPath()}>
          <span class="text-zinc-500">{dirPath()}</span>
        </Show>
        <span class="text-zinc-300">{fileName()}</span>
      </span>

      {/* Status indicator */}
      <span class={`flex-shrink-0 font-mono font-medium ${config().color}`}>
        {config().letter}
      </span>
    </div>
  );
}
