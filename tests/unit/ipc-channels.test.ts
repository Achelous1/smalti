import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '../../src/main/ipc/channels';

describe('IPC_CHANNELS', () => {
  it('should define terminal channels', () => {
    expect(IPC_CHANNELS.TERMINAL_SPAWN).toBe('terminal:spawn');
    expect(IPC_CHANNELS.TERMINAL_WRITE).toBe('terminal:write');
    expect(IPC_CHANNELS.TERMINAL_RESIZE).toBe('terminal:resize');
    expect(IPC_CHANNELS.TERMINAL_KILL).toBe('terminal:kill');
    expect(IPC_CHANNELS.TERMINAL_DATA).toBe('terminal:data');
  });

  it('should define workspace channels', () => {
    expect(IPC_CHANNELS.WORKSPACE_LIST).toBe('workspace:list');
    expect(IPC_CHANNELS.WORKSPACE_CREATE).toBe('workspace:create');
    expect(IPC_CHANNELS.WORKSPACE_OPEN).toBe('workspace:open');
    expect(IPC_CHANNELS.WORKSPACE_REMOVE).toBe('workspace:remove');
    expect(IPC_CHANNELS.WORKSPACE_RECENT).toBe('workspace:recent');
    expect(IPC_CHANNELS.WORKSPACE_OPEN_DIALOG).toBe('workspace:open-dialog');
  });

  it('should define agent channels', () => {
    expect(IPC_CHANNELS.AGENT_DETECT).toBe('agent:detect');
    expect(IPC_CHANNELS.AGENT_STATUS).toBe('agent:status');
  });

  it('should have at least 13 channel definitions', () => {
    const keys = Object.keys(IPC_CHANNELS);
    expect(keys.length).toBeGreaterThanOrEqual(13);
  });
});
