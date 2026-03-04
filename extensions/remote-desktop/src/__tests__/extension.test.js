import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePin, generatePeerId, handleRemoteData } from '../index';

describe('Remote Desktop Extension', () => {
  describe('Utilities', () => {
    it('generates a 6-digit PIN', () => {
      const pin = generatePin();
      expect(pin).toMatch(/^\d{6}$/);
    });

    it('generates a valid host PeerID', () => {
      const id = generatePeerId();
      expect(id).toContain('codelane-host-');
    });
  });

  describe('Handshake & Authentication', () => {
    let mockContext;
    let mockState;
    let mockConn;

    beforeEach(() => {
      mockContext = {
        terminal: { getActiveIds: vi.fn(), onData: vi.fn(), write: vi.fn() },
        lanes: { list: vi.fn() },
        review: { getState: vi.fn() }
      };
      mockState = {
        authenticated: false,
        pin: '123456',
        setConnected: vi.fn(),
        activeTerminalListeners: {}
      };
      mockConn = {
        send: vi.fn(),
        close: vi.fn()
      };
    });

    it('successfully authenticates with correct PIN', async () => {
      const result = await handleRemoteData({ type: 'auth', pin: '123456' }, mockContext, mockState, mockConn);
      
      expect(result).toBe(true);
      expect(mockState.authenticated).toBe(true);
      expect(mockState.setConnected).toHaveBeenCalledWith(true);
      expect(mockConn.send).toHaveBeenCalledWith({ type: 'auth_success' });
    });

    it('rejects incorrect PIN', async () => {
      vi.useFakeTimers();
      const result = await handleRemoteData({ type: 'auth', pin: 'wrong' }, mockContext, mockState, mockConn);
      
      expect(result).toBe(false);
      expect(mockState.authenticated).toBe(false);
      expect(mockConn.send).toHaveBeenCalledWith({ type: 'error', message: 'Invalid PIN' });
      
      vi.advanceTimersByTime(500);
      expect(mockConn.close).toHaveBeenCalled();
    });
  });

  describe('Data Broadcasting', () => {
    let mockContext;
    let mockState;
    let mockConn;

    beforeEach(() => {
      mockContext = {
        terminal: { getActiveIds: vi.fn(() => ['t1']), onData: vi.fn(), write: vi.fn() },
        lanes: { list: vi.fn(() => [{id: 'lane1'}]) },
        review: { getState: vi.fn(() => ({ status: 'ready' })) }
      };
      mockState = {
        authenticated: true,
        activeTerminalListeners: {}
      };
      mockConn = { send: vi.fn() };
    });

    it('responds to terminal:list', async () => {
      await handleRemoteData({ type: 'terminal:list' }, mockContext, mockState, mockConn);
      expect(mockConn.send).toHaveBeenCalledWith({ type: 'terminal:list_result', ids: ['t1'] });
    });

    it('handles terminal:write', async () => {
      await handleRemoteData({ type: 'terminal:write', terminalId: 't1', data: 'ls' }, mockContext, mockState, mockConn);
      expect(mockContext.terminal.write).toHaveBeenCalledWith('t1', 'ls');
    });

    it('responds to lanes:list', async () => {
      await handleRemoteData({ type: 'lanes:list' }, mockContext, mockState, mockConn);
      expect(mockConn.send).toHaveBeenCalledWith({ type: 'lanes:list_result', lanes: [{id: 'lane1'}] });
    });

    it('responds to review:get', async () => {
      await handleRemoteData({ type: 'review:get', laneId: 'lane1' }, mockContext, mockState, mockConn);
      expect(mockConn.send).toHaveBeenCalledWith({ type: 'review:state', laneId: 'lane1', state: { status: 'ready' } });
    });
  });
});
