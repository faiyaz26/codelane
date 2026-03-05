import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentSettings, AgentConfig } from '../../types/agent';

// Mock store
const mockStoreGet = vi.fn();
const mockStoreSet = vi.fn();
const mockStoreSave = vi.fn();
vi.mock('../store', () => ({
  getStore: vi.fn(async () => ({
    get: (...args: unknown[]) => mockStoreGet(...args),
    set: (...args: unknown[]) => mockStoreSet(...args),
    save: (...args: unknown[]) => mockStoreSave(...args),
  })),
}));

// Mock lane-api
const mockGetLane = vi.fn();
vi.mock('../lane-api', () => ({
  getLane: (...args: unknown[]) => mockGetLane(...args),
}));

// Mock invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

let getAgentSettings: typeof import('../settings-api')['getAgentSettings'];
let updateAgentSettings: typeof import('../settings-api')['updateAgentSettings'];
let getLaneAgentConfig: typeof import('../settings-api')['getLaneAgentConfig'];
let checkCommandExists: typeof import('../settings-api')['checkCommandExists'];

beforeEach(async () => {
  mockStoreGet.mockReset();
  mockStoreSet.mockReset();
  mockStoreSave.mockReset();
  mockGetLane.mockReset();
  mockInvoke.mockReset();

  mockStoreSet.mockResolvedValue(undefined);
  mockStoreSave.mockResolvedValue(undefined);

  vi.resetModules();
  const mod = await import('../settings-api');
  getAgentSettings = mod.getAgentSettings;
  updateAgentSettings = mod.updateAgentSettings;
  getLaneAgentConfig = mod.getLaneAgentConfig;
  checkCommandExists = mod.checkCommandExists;
});

describe('settings-api', () => {
  describe('getAgentSettings', () => {
    it('returns settings from backend', async () => {
      const settings: AgentSettings = {
        defaultAgentName: 'Claude Code',
        installedAgents: [{ agentType: 'claude', command: 'claude', name: 'Claude Code', args: [], env: {}, useLaneCwd: true }],
      };
      mockInvoke.mockResolvedValue(settings);

      const result = await getAgentSettings();

      expect(result).toEqual(settings);
      expect(mockInvoke).toHaveBeenCalledWith('settings_get_agents');
    });

    it('returns defaults when backend fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Backend error'));
      mockStoreGet.mockResolvedValue(null);

      const result = await getAgentSettings();

      expect(result).toBeDefined();
      expect(result.defaultAgentName).toBeDefined();
      expect(result.installedAgents).toBeDefined();
    });

    it('migrates from legacy store if backend returns default', async () => {
      // Backend returns default (only Shell)
      const defaultSettings: AgentSettings = {
        defaultAgentName: 'Shell',
        installedAgents: [{ agentType: 'shell', command: 'zsh', name: 'Shell', args: [], env: {}, useLaneCwd: true }],
      };
      mockInvoke.mockResolvedValue(defaultSettings);

      // Store has old settings
      const oldSettings = {
        defaultAgentName: 'Claude Code',
        installedAgents: [
          { agentType: 'shell', command: 'zsh', name: 'Shell', args: [], env: {}, useLaneCwd: true },
          { agentType: 'claude', command: 'claude', name: 'Claude Code', args: [], env: {}, useLaneCwd: true }
        ],
      };
      mockStoreGet.mockResolvedValue(oldSettings);

      const result = await getAgentSettings();

      expect(result.defaultAgentName).toBe('Claude Code');
      expect(result.installedAgents).toHaveLength(2);
      expect(mockInvoke).toHaveBeenCalledWith('settings_update_agents', expect.any(Object));
    });
  });

  describe('updateAgentSettings', () => {
    it('saves settings to backend and legacy store', async () => {
      const settings: AgentSettings = {
        defaultAgentName: 'Codex',
        installedAgents: [{ agentType: 'codex', command: 'codex', name: 'Codex', args: [], env: {}, useLaneCwd: true }],
      };

      await updateAgentSettings(settings);

      expect(mockInvoke).toHaveBeenCalledWith('settings_update_agents', { settings });
      expect(mockStoreSet).toHaveBeenCalledWith('agent_settings', settings);
      expect(mockStoreSave).toHaveBeenCalled();
    });
  });

  describe('getLaneAgentConfig', () => {
    it('returns lane override when present', async () => {
      const override: AgentConfig = { agentType: 'gemini', command: 'gemini', args: [], env: {}, useLaneCwd: true, name: 'Gemini' };
      mockGetLane.mockResolvedValue({
        id: 'lane-1',
        config: { agentOverride: override },
      });

      const result = await getLaneAgentConfig('lane-1');

      expect(result).toEqual(override);
    });

    it('returns global default when no override', async () => {
      mockGetLane.mockResolvedValue({
        id: 'lane-1',
        config: {},
      });

      const globalSettings: AgentSettings = {
        defaultAgentName: 'Claude Code',
        installedAgents: [{ agentType: 'claude', command: 'claude', args: [], env: {}, useLaneCwd: true, name: 'Claude Code' }]
      };
      mockInvoke.mockResolvedValue(globalSettings);

      const result = await getLaneAgentConfig('lane-1');

      expect(result.agentType).toBe('claude');
    });
  });

  describe('checkCommandExists', () => {
    it('returns path when command exists', async () => {
      mockInvoke.mockResolvedValue('/usr/bin/claude');

      const result = await checkCommandExists('claude');

      expect(result).toBe('/usr/bin/claude');
      expect(mockInvoke).toHaveBeenCalledWith('check_command_exists', { command: 'claude' });
    });

    it('returns null when command not found', async () => {
      mockInvoke.mockResolvedValue(null);

      const result = await checkCommandExists('nonexistent');

      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockInvoke.mockRejectedValue(new Error('Failed'));

      const result = await checkCommandExists('broken');

      expect(result).toBeNull();
    });
  });
});
