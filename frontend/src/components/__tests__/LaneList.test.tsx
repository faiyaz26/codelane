import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { LaneList } from '../LaneList';
import type { Lane } from '../../types/lane';

const makeLane = (overrides: Partial<Lane> = {}): Lane => ({
  id: 'lane-1',
  name: 'Feature A',
  workingDir: '/home/user/project',
  createdAt: 1700000000,
  updatedAt: 1700000000,
  ...overrides,
});

describe('LaneList', () => {
  it('renders empty state when no lanes', () => {
    render(() => (
      <LaneList lanes={[]} onLaneSelect={vi.fn()} />
    ));

    expect(screen.getByText('No lanes yet. Create one to get started.')).toBeInTheDocument();
  });

  it('renders lane names', () => {
    const lanes = [
      makeLane({ id: 'lane-1', name: 'Feature A' }),
      makeLane({ id: 'lane-2', name: 'Bug Fix B' }),
    ];

    render(() => (
      <LaneList lanes={lanes} onLaneSelect={vi.fn()} />
    ));

    expect(screen.getByText('Feature A')).toBeInTheDocument();
    expect(screen.getByText('Bug Fix B')).toBeInTheDocument();
  });

  it('renders working directory for each lane', () => {
    const lanes = [makeLane({ workingDir: '/home/user/my-project' })];

    render(() => (
      <LaneList lanes={lanes} onLaneSelect={vi.fn()} />
    ));

    expect(screen.getByText('/home/user/my-project')).toBeInTheDocument();
  });

  it('calls onLaneSelect when a lane is clicked', async () => {
    const onLaneSelect = vi.fn();
    const lanes = [makeLane({ id: 'lane-1', name: 'Feature A' })];

    render(() => (
      <LaneList lanes={lanes} onLaneSelect={onLaneSelect} />
    ));

    await fireEvent.click(screen.getByText('Feature A'));
    expect(onLaneSelect).toHaveBeenCalledWith('lane-1');
  });

  it('highlights the active lane', () => {
    const lanes = [
      makeLane({ id: 'lane-1', name: 'Feature A' }),
      makeLane({ id: 'lane-2', name: 'Bug Fix B' }),
    ];

    render(() => (
      <LaneList lanes={lanes} activeLaneId="lane-1" onLaneSelect={vi.fn()} />
    ));

    // The active lane's container should have the active class
    const laneElement = screen.getByText('Feature A').closest('[class*="bg-zed-bg-active"]');
    expect(laneElement).toBeTruthy();
  });

  it('renders delete button when onLaneDelete is provided', () => {
    const lanes = [makeLane({ id: 'lane-1', name: 'Feature A' })];

    render(() => (
      <LaneList
        lanes={lanes}
        onLaneSelect={vi.fn()}
        onLaneDelete={vi.fn()}
      />
    ));

    const deleteButton = screen.getByTitle('Close lane');
    expect(deleteButton).toBeInTheDocument();
  });

  it('does not render delete button when onLaneDelete is not provided', () => {
    const lanes = [makeLane({ id: 'lane-1', name: 'Feature A' })];

    render(() => (
      <LaneList lanes={lanes} onLaneSelect={vi.fn()} />
    ));

    expect(screen.queryByTitle('Close lane')).not.toBeInTheDocument();
  });

  it('calls onLaneDelete with lane id and stops propagation', async () => {
    const onLaneSelect = vi.fn();
    const onLaneDelete = vi.fn();
    const lanes = [makeLane({ id: 'lane-1', name: 'Feature A' })];

    render(() => (
      <LaneList
        lanes={lanes}
        onLaneSelect={onLaneSelect}
        onLaneDelete={onLaneDelete}
      />
    ));

    await fireEvent.click(screen.getByTitle('Close lane'));
    expect(onLaneDelete).toHaveBeenCalledWith('lane-1');
    // onLaneSelect should NOT be called (stopPropagation)
    expect(onLaneSelect).not.toHaveBeenCalled();
  });

  it('renders formatted date', () => {
    const lanes = [makeLane({ updatedAt: 1700000000 })];

    render(() => (
      <LaneList lanes={lanes} onLaneSelect={vi.fn()} />
    ));

    // Should render "Updated" with some date string
    const dateElement = screen.getByText(/Updated/);
    expect(dateElement).toBeInTheDocument();
  });
});
