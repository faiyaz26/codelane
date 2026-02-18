/**
 * AgentStatusManager - Singleton that manages agent status per lane.
 *
 * Maintains a reactive SolidJS store of AgentStatus per lane ID,
 * backed by per-lane AgentDetector instances that parse terminal output.
 */

import { createStore } from 'solid-js/store';
import type {
  AgentStatus,
  AgentStatusChange,
  DetectableAgentType,
  AgentNotificationSettings,
} from '../types/agentStatus';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../types/agentStatus';
import { createDetector } from './agentDetectors';
import type { AgentDetector } from './agentDetectors/types';
import { hookService } from './HookService';
import type { HookEvent } from '../types/hooks';

const NOTIFICATION_SETTINGS_KEY = 'codelane:agent-notification-settings';
const NOTIFICATION_PROMPT_DISMISSED_KEY = 'codelane:notification-prompt-dismissed';

type StatusChangeListener = (change: AgentStatusChange) => void;

interface LaneEntry {
  status: AgentStatus;
  agentType: DetectableAgentType;
  detector: AgentDetector;
  lastChange: number;
}

class AgentStatusManager {
  private readonly decoder = new TextDecoder();
  private readonly lanes = new Map<string, LaneEntry>();
  private listeners: StatusChangeListener[] = [];

  /** Reactive store: laneId -> AgentStatus */
  private readonly store;
  private readonly setStore;

  constructor() {
    const [store, setStore] = createStore<Record<string, AgentStatus>>({});
    this.store = store;
    this.setStore = setStore;

    // Listen for hook events from agents (Claude, Codex, Gemini)
    // These override heuristic detection for more reliable status updates
    hookService.onHookEvent((event) => {
      this.handleHookEvent(event);
    });
  }

  /**
   * Register a lane for agent status tracking.
   * If the lane already exists it is unregistered first.
   */
  registerLane(laneId: string, agentType: DetectableAgentType): void {
    // Clean up existing detector if present
    if (this.lanes.has(laneId)) {
      this.unregisterLane(laneId);
    }

    const detector = createDetector(agentType);

    const entry: LaneEntry = {
      status: 'idle',
      agentType,
      detector,
      lastChange: Date.now(),
    };

    detector.setOnStatusChange((newStatus: AgentStatus) => {
      const previousStatus = entry.status;
      if (previousStatus === newStatus) return;

      entry.status = newStatus;
      entry.lastChange = Date.now();

      // Update reactive store
      this.setStore(laneId, newStatus);

      // Notify listeners
      const change: AgentStatusChange = {
        laneId,
        previousStatus,
        newStatus,
        agentType,
        timestamp: entry.lastChange,
      };
      for (const listener of this.listeners) {
        listener(change);
      }
    });

    this.lanes.set(laneId, entry);
    this.setStore(laneId, 'idle');
  }

  /**
   * Feed raw PTY output bytes to the detector for a lane.
   */
  feedOutput(laneId: string, data: Uint8Array): void {
    const entry = this.lanes.get(laneId);
    if (!entry) return;

    const text = this.decoder.decode(data, { stream: true });
    entry.detector.feedChunk(text);
  }

  /**
   * Signal that the user typed input into the terminal for a lane.
   * This transitions the detector out of 'waiting_for_input' state.
   */
  feedUserInput(laneId: string, data: string): void {
    const entry = this.lanes.get(laneId);
    if (!entry) return;

    entry.detector.feedUserInput(data);
  }

  /**
   * Feed a snapshot of the terminal buffer for periodic checking.
   * This samples the actual terminal screen content to catch prompts.
   */
  feedBufferSnapshot(laneId: string, text: string): void {
    const entry = this.lanes.get(laneId);
    if (!entry) return;

    entry.detector.feedBufferSnapshot(text);
  }

  /**
   * Mark a lane's process as exited. Resets detector and sets status to idle.
   */
  markExited(laneId: string): void {
    const entry = this.lanes.get(laneId);
    if (!entry) return;

    entry.detector.reset();
    entry.status = 'idle';
    entry.lastChange = Date.now();
    this.setStore(laneId, 'idle');
  }

  /**
   * Unregister a lane, disposing its detector and removing all state.
   */
  unregisterLane(laneId: string): void {
    const entry = this.lanes.get(laneId);
    if (!entry) return;

    entry.detector.dispose();
    this.lanes.delete(laneId);
    this.setStore(laneId, undefined!);
  }

  /**
   * Get the current status for a lane (reactive read from store).
   */
  getStatus(laneId: string): AgentStatus | undefined {
    return this.store[laneId];
  }

  /**
   * Return the entire reactive store for use in SolidJS components.
   */
  getStatusStore(): Record<string, AgentStatus> {
    return this.store;
  }

  /**
   * Subscribe to status change events. Returns an unsubscribe function.
   */
  onStatusChange(listener: StatusChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Handle hook events from agents (Claude, Codex, Gemini).
   * Hook events override heuristic detection for reliable status updates.
   */
  private handleHookEvent(event: HookEvent): void {
    const entry = this.lanes.get(event.laneId);
    if (!entry) return;

    // Hook events for permission/input always transition to waiting_for_input
    if (
      event.eventType === 'permission_prompt' ||
      event.eventType === 'idle_prompt' ||
      event.eventType === 'waiting_for_input'
    ) {
      const previousStatus = entry.status;
      entry.status = 'waiting_for_input';
      entry.lastChange = Date.now();

      // Update reactive store
      this.setStore(event.laneId, 'waiting_for_input');

      // Notify listeners
      const change: AgentStatusChange = {
        laneId: event.laneId,
        previousStatus,
        newStatus: 'waiting_for_input',
        agentType: event.agentType as DetectableAgentType,
        timestamp: entry.lastChange,
      };

      for (const listener of this.listeners) {
        listener(change);
      }
    }
  }

  /**
   * Load notification settings from localStorage.
   */
  getNotificationSettings(): AgentNotificationSettings {
    try {
      const raw = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (raw) {
        return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // Ignore parse errors
    }
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }

  /**
   * Persist notification settings to localStorage.
   */
  updateNotificationSettings(settings: Partial<AgentNotificationSettings>): void {
    const current = this.getNotificationSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(merged));
  }

  /**
   * Whether the in-terminal notification prompt should be shown.
   * Returns true if notifications are not yet enabled and the prompt hasn't been dismissed.
   */
  shouldShowNotificationPrompt(): boolean {
    const settings = this.getNotificationSettings();
    // Already enabled — no need to prompt
    if (settings.notifyOnDone && settings.notifyOnWaitingForInput) return false;
    // User explicitly dismissed
    if (localStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_KEY) === 'true') return false;
    return true;
  }

  /**
   * Permanently dismiss the in-terminal notification prompt.
   */
  dismissNotificationPrompt(): void {
    localStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, 'true');
  }
}

export const agentStatusManager = new AgentStatusManager();
