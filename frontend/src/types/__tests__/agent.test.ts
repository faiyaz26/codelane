import { describe, it, expect } from 'vitest';
import { AGENT_METADATA } from '../agent';

describe('Agent Metadata', () => {
  it('should have exactly 6 supported agent types', () => {
    // This test is intended to make adding a new agent a conscious decision.
    // If you are adding a new agent, update this number and ensure all
    // metadata fields (label, aiTool, supportsHooks, preset) are correctly defined.
    const agentTypes = Object.keys(AGENT_METADATA);
    expect(agentTypes.length).toBe(6);
  });

  it('should have all required metadata for each agent', () => {
    Object.entries(AGENT_METADATA).forEach(([type, metadata]) => {
      expect(metadata.label).toBeDefined();
      expect(metadata.aiTool).toBeDefined();
      expect(metadata.supportsHooks).toBeDefined();
      expect(metadata.preset).toBeDefined();
      expect(metadata.preset.agentType).toBe(type);
    });
  });
});
