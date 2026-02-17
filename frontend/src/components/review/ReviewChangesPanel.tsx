/**
 * ReviewChangesPanel - Right half of the code review layout
 *
 * Vertical split: ReviewFileScrollView (top, 66%) + FileContextPanel (bottom, 33%)
 * Resizable divider between the two panels.
 */

import { createSignal, onMount, onCleanup, createMemo } from 'solid-js';
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
  scrollToPath: string | null;
  onVisibleFileChange: (path: string) => void;
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

  // Memoize file lookups to avoid repeated find() and get() operations
  // Impact: Avoid O(n) find on every render when file changes, convert to O(1) lookup
  const visibleFileStatus = createMemo(() => {
    if (!props.visibleFilePath) return undefined;
    const file = props.sortedFiles.find(f => f.path === props.visibleFilePath);
    return file?.status;
  });

  // Memoize feedback lookup to avoid repeated Map.get() on every render
  // Impact: Stabilize reference and avoid multiple lookups per render cycle
  const visibleFileFeedback = createMemo(() => {
    if (!props.visibleFilePath) return null;
    return props.perFileFeedback.get(props.visibleFilePath) || null;
  });

  return (
    <section
      id="review-changes-split"
      class="flex flex-col h-full overflow-hidden"
      classList={{ 'select-none': isResizing() }}
      aria-labelledby="changed-files-heading"
    >
      <h2 id="changed-files-heading" class="sr-only">Changed Files</h2>
      {/* Top: File Diffs */}
      <div class="flex flex-col overflow-hidden" style={{ height: `${splitPosition()}%` }}>
        <ReviewFileScrollView
          laneId={props.laneId}
          workingDir={props.workingDir}
          sortedFiles={props.sortedFiles}
          fileDiffs={props.fileDiffs}
          onVisibleFileChange={props.onVisibleFileChange}
          scrollToPath={props.scrollToPath}
          contextPanelHeightPercent={100 - splitPosition()}
        />
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        role="separator"
        aria-label="Resize file diff and context panels"
        aria-orientation="horizontal"
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
    </section>
  );
}
