import { createSignal, createRoot } from 'solid-js';

export interface Lane {
  id: string;
  name: string;
  workingDir: string;
  branch?: string;
  laneType: 'local' | 'pr_review';
}

function createRemoteStore() {
  const [lanes, setLanes] = createSignal<Lane[]>([]);
  const [activeLaneId, setActiveLaneId] = createSignal<string | null>(null);
  const [terminalData, setTerminalData] = createSignal<Record<string, string>>({});

  return {
    lanes,
    setLanes,
    activeLaneId,
    setActiveLaneId,
    terminalData,
    setTerminalData,
  };
}

export const remoteStore = createRoot(createRemoteStore);
