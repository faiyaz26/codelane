/**
 * Hook to access the TabManager singleton
 */

import { tabManager } from '../services/TabManager';

export function useTabManager() {
  return tabManager;
}
