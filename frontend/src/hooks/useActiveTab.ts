/**
 * Hook to get the active tab for a lane
 */

import { createMemo } from 'solid-js';
import { useTabManager } from './useTabManager';

export function useActiveTab(laneId: string) {
  const tabManager = useTabManager();

  const activeTabId = tabManager.getActiveTab(laneId);
  const tabs = tabManager.getTabs(laneId);

  const activeTab = createMemo(() => {
    const id = activeTabId();
    return tabs().find((t) => t.id === id);
  });

  return activeTab;
}
