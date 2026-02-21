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
    it('returns saved settings', async () => {
      const settings: AgentSettings = {
        defaultAgent: { agentType: 'claude', command: 'claude' },
      };
      mockStoreGet.mockResolvedValue(settings);

      const result = await getAgentSettings();

      expect(result).toEqual(settings);
      expect(mockStoreGet).toHaveBeenCalledWith('agent_settings');
    });

    it('returns defaults when no settings saved', async () => {
      mockStoreGet.mockResolvedValue(null);

      const result = await getAgentSettings();

      expect(result).toBeDefined();
      expect(result.defaultAgent).toBeDefined();
    });
  });

  describe('updateAgentSettings', () => {
    it('saves settings to store', async () => {
      const settings: AgentSettings = {
        defaultAgent: { agentType: 'codex', command: 'codex' },
      };

      await updateAgentSettings(settings);

      expect(mockStoreSet).toHaveBeenCalledWith('agent_settings', settings);
      expect(mockStoreSave).toHaveBeenCalled();
    });
  });

  describe('getLaneAgentConfig', () => {
    it('returns lane override when present', async () => {
      const override: AgentConfig = { agentType: 'gemini', command: 'gemini' };
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
        defaultAgent: { agentType: 'claude', command: 'claude' },
      };
      mockStoreGet.mockResolvedValue(globalSettings);

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
