import { createStore } from 'solid-js/store';
import { createContext, useContext } from 'solid-js';

// Types
export interface Lane {
  id: string;
  name: string;
  workingDir: string;
  createdAt: string;
  updatedAt: string;
}

export interface Terminal {
  id: string;
  laneId: string;
  active: boolean;
}

export interface GitStatus {
  laneId: string;
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

// Store structure
interface AppStore {
  // Lanes
  lanes: Lane[];
  activeLaneId: string | null;

  // Terminals
  terminals: Terminal[];
  activeTerminalId: string | null;

  // Git
  gitStatus: Map<string, GitStatus>;

  // UI State
  ui: {
    sidebarOpen: boolean;
    activeView: 'terminal' | 'editor' | 'git' | 'review';
    dialogOpen: string | null; // dialog name or null
  };
}

// Initial state
const initialState: AppStore = {
  lanes: [],
  activeLaneId: null,

  terminals: [],
  activeTerminalId: null,

  gitStatus: new Map(),

  ui: {
    sidebarOpen: true,
    activeView: 'terminal',
    dialogOpen: null,
  },
};

// Create store
const [store, setStore] = createStore(initialState);

// Store actions
export const storeActions = {
  // Lane actions
  addLane: (lane: Lane) => {
    setStore('lanes', (lanes) => [...lanes, lane]);
  },

  removeLane: (laneId: string) => {
    setStore('lanes', (lanes) => lanes.filter((l) => l.id !== laneId));
    // Cleanup related data
    setStore('terminals', (terminals) => terminals.filter((t) => t.laneId !== laneId));
    setStore('gitStatus', (status) => {
      const newStatus = new Map(status);
      newStatus.delete(laneId);
      return newStatus;
    });
  },

  updateLane: (laneId: string, updates: Partial<Lane>) => {
    setStore('lanes', (lane) => lane.id === laneId, updates);
  },

  setActiveLane: (laneId: string | null) => {
    setStore('activeLaneId', laneId);
    // Save to localStorage
    if (laneId) {
      localStorage.setItem('codelane-active-lane', laneId);
    } else {
      localStorage.removeItem('codelane-active-lane');
    }
  },

  // Terminal actions
  addTerminal: (terminal: Terminal) => {
    setStore('terminals', (terminals) => [...terminals, terminal]);
  },

  removeTerminal: (terminalId: string) => {
    setStore('terminals', (terminals) => terminals.filter((t) => t.id !== terminalId));
  },

  setActiveTerminal: (terminalId: string | null) => {
    setStore('activeTerminalId', terminalId);
  },

  // Git actions
  updateGitStatus: (laneId: string, status: GitStatus) => {
    setStore('gitStatus', (statusMap) => {
      const newMap = new Map(statusMap);
      newMap.set(laneId, status);
      return newMap;
    });
  },

  // UI actions
  toggleSidebar: () => {
    setStore('ui', 'sidebarOpen', (open) => !open);
  },

  setActiveView: (view: AppStore['ui']['activeView']) => {
    setStore('ui', 'activeView', view);
  },

  openDialog: (dialogName: string) => {
    setStore('ui', 'dialogOpen', dialogName);
  },

  closeDialog: () => {
    setStore('ui', 'dialogOpen', null);
  },
};

// Selectors (computed values)
export const storeSelectors = {
  getActiveLane: () => {
    if (!store.activeLaneId) return null;
    return store.lanes.find((lane) => lane.id === store.activeLaneId) || null;
  },

  getLaneById: (laneId: string) => {
    return store.lanes.find((lane) => lane.id === laneId) || null;
  },

  getTerminalsForLane: (laneId: string) => {
    return store.terminals.filter((terminal) => terminal.laneId === laneId);
  },

  getGitStatusForLane: (laneId: string) => {
    return store.gitStatus.get(laneId) || null;
  },

  isDialogOpen: (dialogName: string) => {
    return store.ui.dialogOpen === dialogName;
  },
};

// Context
const StoreContext = createContext<{
  store: typeof store;
  actions: typeof storeActions;
  selectors: typeof storeSelectors;
}>();

// Provider component
export function StoreProvider(props: { children: any }) {
  return (
    <StoreContext.Provider
      value={{
        store,
        actions: storeActions,
        selectors: storeSelectors,
      }}
    >
      {props.children}
    </StoreContext.Provider>
  );
}

// Hook to use store
export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}

// Export store for direct access if needed
export { store };
