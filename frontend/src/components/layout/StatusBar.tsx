import { Show } from 'solid-js';
import type { Lane } from '../../types/lane';

// Only the data StatusBar needs - keeps component decoupled from editor internals
interface FileInfo {
  language: string; // Already formatted display name
}

interface StatusBarProps {
  activeLane?: Lane;
  totalLanes: number;
  fileInfo?: FileInfo | null;
}

export function StatusBar(props: StatusBarProps) {
  return (
    <div class="h-6 bg-zed-bg-panel border-t border-zed-border-subtle flex items-center px-3 text-xs select-none">
      {/* Left Section */}
      <div class="flex items-center gap-3 flex-1">
        {/* Git Branch (placeholder) */}
        <div class="flex items-center gap-1 text-zed-text-secondary hover:text-zed-text-primary cursor-pointer transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
            />
          </svg>
          <span>main</span>
        </div>

        {/* Git Status Indicators (placeholder) */}
        <div class="flex items-center gap-2 text-zed-text-tertiary">
          <span class="flex items-center gap-0.5">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>0</span>
          </span>
          <span class="flex items-center gap-0.5">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span>0</span>
          </span>
        </div>

        {/* Errors/Warnings (placeholder) */}
        <div class="flex items-center gap-2">
          <span class="flex items-center gap-0.5 text-zed-text-tertiary">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>0</span>
          </span>
          <span class="flex items-center gap-0.5 text-zed-text-tertiary">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>0</span>
          </span>
        </div>
      </div>

      {/* Center Section - Current Lane */}
      <div class="flex items-center gap-2">
        <Show
          when={props.activeLane}
          fallback={<span class="text-zed-text-tertiary">No active lane</span>}
        >
          <span class="text-zed-text-secondary">{props.activeLane?.name}</span>
        </Show>
      </div>

      {/* Right Section */}
      <div class="flex items-center gap-3 flex-1 justify-end">
        {/* Language */}
        <Show when={props.fileInfo?.language}>
          <span class="text-zed-text-tertiary hover:text-zed-text-primary cursor-pointer transition-colors">
            {props.fileInfo!.language}
          </span>
        </Show>

        {/* Encoding */}
        <span class="text-zed-text-tertiary hover:text-zed-text-primary cursor-pointer transition-colors">
          UTF-8
        </span>

        {/* Line/Column (placeholder) */}
        <Show when={props.fileInfo}>
          <span class="text-zed-text-tertiary">
            Ln 1, Col 1
          </span>
        </Show>

        {/* Lanes Count */}
        <span class="text-zed-text-tertiary">
          {props.totalLanes} {props.totalLanes === 1 ? 'lane' : 'lanes'}
        </span>
      </div>
    </div>
  );
}
