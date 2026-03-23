import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { batch, createSignal } from 'solid-js';
import { BottomPanel } from '../BottomPanel';
import type { Lane } from '../../../types/lane';

const TabPanelSpy = vi.fn((props: { laneId: string; workingDir: string }) => (
  <div data-testid={`tab-panel-${props.laneId}`} data-working-dir={props.workingDir}>
    Tab panel for {props.laneId}
  </div>
));

vi.mock('../../tabs/TabPanel', () => ({
  TabPanel: (props: { laneId: string; workingDir: string }) => TabPanelSpy(props),
}));

const mockLanes: Lane[] = [
  {
    id: 'lane-1',
    name: 'Lane 1',
    workingDir: '/work/lane-1',
    createdAt: '0',
    updatedAt: '0',
    config: { env: [], lspServers: [] },
  },
  {
    id: 'lane-2',
    name: 'Lane 2',
    workingDir: '/work/lane-2',
    createdAt: '0',
    updatedAt: '0',
    config: { env: [], lspServers: [] },
  },
];

describe('BottomPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('preserves tab panels when switching lanes with a recreated initialized set', () => {
    const [activeLaneId, setActiveLaneId] = createSignal<string | null>('lane-1');
    const [initializedLanes, setInitializedLanes] = createSignal(new Set(['lane-1', 'lane-2']));

    render(() => (
      <BottomPanel
        lanes={mockLanes}
        activeLaneId={activeLaneId()}
        initializedLanes={initializedLanes()}
      />
    ));

    expect(TabPanelSpy).toHaveBeenCalledTimes(2);

    const lane1Panel = screen.getByTestId('tab-panel-lane-1');
    const lane2Panel = screen.getByTestId('tab-panel-lane-2');

    batch(() => {
      setActiveLaneId('lane-2');
      setInitializedLanes(prev => new Set(prev));
    });

    expect(screen.getByTestId('tab-panel-lane-1')).toBe(lane1Panel);
    expect(screen.getByTestId('tab-panel-lane-2')).toBe(lane2Panel);
    expect(TabPanelSpy).toHaveBeenCalledTimes(2);
  });
});
