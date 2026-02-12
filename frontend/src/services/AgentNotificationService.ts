/**
 * AgentNotificationService - Fires OS notifications when agent status changes.
 *
 * Listens to AgentStatusManager and sends notifications via Tauri's
 * notification plugin. Gracefully degrades if the plugin is unavailable.
 */

import { agentStatusManager } from './AgentStatusManager';
import type { AgentStatusChange, AgentNotificationSettings } from '../types/agentStatus';

/** Minimal typing for the notification API we need */
interface NotificationApi {
  isPermissionGranted(): Promise<boolean>;
  requestPermission(): Promise<string>;
  sendNotification(options: { title: string; body?: string }): void;
}

class AgentNotificationService {
  private unsubscribe: (() => void) | null = null;
  private notificationApi: NotificationApi | null = null;
  private permissionGranted = false;

  /**
   * Start listening for status changes and load the notification API.
   */
  async start(): Promise<void> {
    // Load notification API (may not be available)
    await this.loadNotificationApi();

    // Subscribe to status changes
    this.unsubscribe = agentStatusManager.onStatusChange((change) => {
      this.handleStatusChange(change);
    });
  }

  /**
   * Stop listening for status changes.
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private async loadNotificationApi(): Promise<void> {
    try {
      const mod = await import('@tauri-apps/plugin-notification');
      this.notificationApi = mod as unknown as NotificationApi;
      this.permissionGranted = await mod.isPermissionGranted();

      if (!this.permissionGranted) {
        const result = await mod.requestPermission();
        this.permissionGranted = result === 'granted';
      }
    } catch {
      // Plugin not available -- notifications will be silently skipped
      this.notificationApi = null;
    }
  }

  private handleStatusChange(change: AgentStatusChange): void {
    const settings = agentStatusManager.getNotificationSettings();

    // Determine if we should notify for this status
    let title: string | null = null;
    let body: string | undefined;

    if (change.newStatus === 'done' && settings.notifyOnDone) {
      title = 'Agent Finished';
      body = `${change.agentType} in lane completed its task.`;
    } else if (change.newStatus === 'waiting_for_input' && settings.notifyOnWaitingForInput) {
      title = 'Agent Needs Input';
      body = `${change.agentType} is waiting for your input.`;
    } else if (change.newStatus === 'error' && settings.notifyOnError) {
      title = 'Agent Error';
      body = `${change.agentType} encountered an error.`;
    }

    if (!title) return;

    // Skip if the window is focused and settings say only notify when unfocused
    if (settings.onlyWhenUnfocused && document.hasFocus()) return;

    this.sendNotification(title, body);
  }

  private sendNotification(title: string, body?: string): void {
    if (!this.notificationApi || !this.permissionGranted) return;

    try {
      this.notificationApi.sendNotification({ title, body });
    } catch {
      // Graceful fallback -- swallow notification errors
    }
  }
}

export const agentNotificationService = new AgentNotificationService();
