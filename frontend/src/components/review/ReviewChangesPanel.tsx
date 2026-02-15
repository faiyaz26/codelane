/**
 * ReviewChangesPanel - Right half of the code review layout
 *
 * Vertical split: ReviewFileScrollView (top, 66%) + FileContextPanel (bottom, 33%)
 * Resizable divider between the two panels.
 */

import { createSignal, onMount, onCleanup } from 'solid-js';
import { ReviewFileScrollView } from './ReviewFileScrollView';
import { FileContextPanel } from './FileContextPanel';
import type { FileChangeStats } from '../../types/git';

interface ReviewChangesPanelProps {
  laneId: string;
  workingDir: string;
  sortedFiles: FileChangeStats[];
  fileDiffs: Map<string, string>;
  perFileFeedback: Map<string, string>;
  visibleFilePath: string | null;
  onVisibleFileChange: (path: string) => void;
  onScrollToFile?: (scrollFn: (path: string) => void) => void;
}

export function ReviewChangesPanel(props: ReviewChangesPanelProps) {
  const [splitPosition, setSplitPosition] = createSignal(66); // % for top panel
  const [isResizing, setIsResizing] = createSignal(false);

  const handleMouseDown = (e: MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing()) return;

    const container = document.getElementById('review-changes-split');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const newPosition = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp: top panel min 40%, bottom panel min 15% (max 85% top)
    if (newPosition >= 40 && newPosition <= 85) {
      setSplitPosition(newPosition);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    onCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  });

  const visibleFileStatus = () => {
    if (!props.visibleFilePath) return undefined;
    const file = props.sortedFiles.find(f => f.path === props.visibleFilePath);
    return file?.status;
  };

  const visibleFileFeedback = () => {
    if (!props.visibleFilePath) return null;
    return props.perFileFeedback.get(props.visibleFilePath) || null;
  };

  return (
    <div
      id="review-changes-split"
      class="flex flex-col h-full overflow-hidden"
      classList={{ 'select-none': isResizing() }}
    >
      {/* Top: File Diffs */}
      <div class="flex flex-col overflow-hidden" style={{ height: `${splitPosition()}%` }}>
        <ReviewFileScrollView
          laneId={props.laneId}
          workingDir={props.workingDir}
          sortedFiles={props.sortedFiles}
          fileDiffs={props.fileDiffs}
          onVisibleFileChange={props.onVisibleFileChange}
          onScrollToFile={props.onScrollToFile}
          contextPanelHeightPercent={100 - splitPosition()}
        />
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        class="h-1 bg-zed-border-default hover:bg-zed-accent-blue cursor-ns-resize flex-shrink-0 transition-colors"
        classList={{ 'bg-zed-accent-blue': isResizing() }}
      />

      {/* Bottom: Context Panel */}
      <div class="overflow-hidden" style={{ height: `${100 - splitPosition()}%` }}>
        <FileContextPanel
          filePath={props.visibleFilePath}
          feedback={visibleFileFeedback()}
          fileStatus={visibleFileStatus()}
        />
      </div>
    </div>
  );
}
