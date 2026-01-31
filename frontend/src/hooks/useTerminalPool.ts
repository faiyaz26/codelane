/**
 * Hook to access the TerminalPool singleton
 */

import { terminalPool } from '../services/TerminalPool';

export function useTerminalPool() {
  return terminalPool;
}
