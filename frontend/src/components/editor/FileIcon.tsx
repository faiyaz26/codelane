// File icon component based on file extension/type

import { Show } from 'solid-js';

interface FileIconProps {
  filename: string;
  isDirectory?: boolean;
  isExpanded?: boolean;
  class?: string;
}

export function FileIcon(props: FileIconProps) {
  const ext = () => props.filename.split('.').pop()?.toLowerCase() || '';
  const iconClass = () => props.class || 'w-4 h-4';

  // Directory icons
  if (props.isDirectory) {
    return (
      <Show
        when={props.isExpanded}
        fallback={
          <svg class={`${iconClass()} text-zed-accent-yellow`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        }
      >
        <svg class={`${iconClass()} text-zed-accent-yellow`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2z" />
        </svg>
      </Show>
    );
  }

  // TypeScript/JavaScript
  if (['ts', 'tsx'].includes(ext())) {
    return (
      <span class={`${iconClass()} text-zed-accent-blue text-xs font-bold flex items-center justify-center`}>
        TS
      </span>
    );
  }

  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext())) {
    return (
      <span class={`${iconClass()} text-zed-accent-yellow text-xs font-bold flex items-center justify-center`}>
        JS
      </span>
    );
  }

  // JSON
  if (ext() === 'json') {
    return (
      <span class={`${iconClass()} text-zed-accent-yellow text-xs font-bold flex items-center justify-center`}>
        {'{}'}
      </span>
    );
  }

  // Markdown
  if (['md', 'mdx'].includes(ext())) {
    return (
      <span class={`${iconClass()} text-zed-text-secondary text-xs font-bold flex items-center justify-center`}>
        M↓
      </span>
    );
  }

  // CSS/SCSS
  if (['css', 'scss', 'sass', 'less'].includes(ext())) {
    return (
      <span class={`${iconClass()} text-zed-accent-purple text-xs font-bold flex items-center justify-center`}>
        #
      </span>
    );
  }

  // Rust
  if (ext() === 'rs') {
    return (
      <span class={`${iconClass()} text-zed-accent-orange text-xs font-bold flex items-center justify-center`}>
        Rs
      </span>
    );
  }

  // Python
  if (ext() === 'py') {
    return (
      <span class={`${iconClass()} text-zed-accent-blue text-xs font-bold flex items-center justify-center`}>
        Py
      </span>
    );
  }

  // Go
  if (ext() === 'go') {
    return (
      <span class={`${iconClass()} text-cyan-400 text-xs font-bold flex items-center justify-center`}>
        Go
      </span>
    );
  }

  // HTML
  if (['html', 'htm'].includes(ext())) {
    return (
      <span class={`${iconClass()} text-zed-accent-orange text-xs font-bold flex items-center justify-center`}>
        {'<>'}
      </span>
    );
  }

  // YAML/TOML
  if (['yaml', 'yml', 'toml'].includes(ext())) {
    return (
      <span class={`${iconClass()} text-zed-accent-red text-xs font-bold flex items-center justify-center`}>
        ≡
      </span>
    );
  }

  // Shell
  if (['sh', 'bash', 'zsh'].includes(ext())) {
    return (
      <span class={`${iconClass()} text-zed-text-secondary text-xs font-bold flex items-center justify-center`}>
        $
      </span>
    );
  }

  // Default file icon
  return (
    <svg class={`${iconClass()} text-zed-text-tertiary`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
