// File and folder icons based on type/extension

import type { FileEntry } from './types';

interface FileIconProps {
  entry: FileEntry;
  isExpanded?: boolean;
}

export function FileIcon(props: FileIconProps) {
  if (props.entry.is_dir) {
    return props.isExpanded ? <FolderOpenIcon /> : <FolderClosedIcon />;
  }

  const ext = props.entry.name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'ts':
    case 'tsx':
      return <TextIcon text="TS" class="text-zed-accent-blue" />;
    case 'js':
    case 'jsx':
      return <TextIcon text="JS" class="text-zed-accent-yellow" />;
    case 'json':
      return <TextIcon text="{}" class="text-zed-accent-yellow" />;
    case 'md':
      return <TextIcon text="M" class="text-zed-text-secondary" />;
    case 'css':
    case 'scss':
      return <TextIcon text="#" class="text-zed-accent-purple" />;
    case 'rs':
      return <TextIcon text="Rs" class="text-zed-accent-orange" />;
    case 'html':
      return <TextIcon text="<>" class="text-zed-accent-orange" />;
    case 'toml':
      return <TextIcon text="T" class="text-zed-text-secondary" />;
    default:
      return <GenericFileIcon />;
  }
}

function TextIcon(props: { text: string; class?: string }) {
  return (
    <span class={`w-4 h-4 text-xs font-bold flex items-center justify-center ${props.class || ''}`}>
      {props.text}
    </span>
  );
}

function FolderOpenIcon() {
  return (
    <svg class="w-4 h-4 text-zed-accent-yellow" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2z" />
    </svg>
  );
}

function FolderClosedIcon() {
  return (
    <svg class="w-4 h-4 text-zed-accent-yellow" fill="currentColor" viewBox="0 0 24 24">
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function GenericFileIcon() {
  return (
    <svg class="w-4 h-4 text-zed-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
