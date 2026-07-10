import { describe, it, expect } from 'vitest';
import { resolveSpawnCommand } from '../../src/main/agent/agent-config';

const DEFAULT_SHELL = '/bin/zsh';

describe('resolveSpawnCommand', () => {
  describe('command option (preset execution)', () => {
    it('wraps the command in the login shell on macOS/Linux', () => {
      const result = resolveSpawnCommand({ command: 'lazygit' }, DEFAULT_SHELL, undefined, 'darwin');
      expect(result.shell).toBe(DEFAULT_SHELL);
      expect(result.args).toEqual(['-ilc', 'lazygit']);
    });

    it('keeps a compound command as a single argument', () => {
      const result = resolveSpawnCommand({ command: 'npm run dev' }, DEFAULT_SHELL, undefined, 'linux');
      expect(result.args).toEqual(['-ilc', 'npm run dev']);
    });

    it('wraps in powershell on Windows', () => {
      const result = resolveSpawnCommand({ command: 'lazygit' }, 'powershell.exe', undefined, 'win32');
      expect(result.shell).toBe('powershell.exe');
      expect(result.args).toEqual(['-NoLogo', '-Command', 'lazygit']);
    });

    it('ignores the shell option when command is present', () => {
      const result = resolveSpawnCommand({ command: 'htop', shell: '/bin/bash' }, DEFAULT_SHELL, undefined, 'darwin');
      expect(result.shell).toBe(DEFAULT_SHELL);
      expect(result.args).toEqual(['-ilc', 'htop']);
    });
  });

  describe('priority: agentType > command > shell', () => {
    it('agentType wins over command', () => {
      const result = resolveSpawnCommand(
        { agentType: 'claude', command: 'lazygit' },
        DEFAULT_SHELL,
        '/tmp/mcp.json',
        'darwin',
      );
      expect(result.shell).toBe('claude');
      expect(result.args).toEqual(['--mcp-config', '/tmp/mcp.json']);
    });

    it('agentType shell wins over command', () => {
      const result = resolveSpawnCommand(
        { agentType: 'shell', command: 'lazygit' },
        DEFAULT_SHELL,
        undefined,
        'darwin',
      );
      expect(result.shell).toBe(DEFAULT_SHELL);
      expect(result.args).toEqual([]);
    });
  });

  describe('existing behavior preserved (no command)', () => {
    it('spawns the plain default shell with no options', () => {
      const result = resolveSpawnCommand(undefined, DEFAULT_SHELL, undefined, 'darwin');
      expect(result.shell).toBe(DEFAULT_SHELL);
      expect(result.args).toEqual([]);
    });

    it('spawns options.shell directly when only shell is given', () => {
      const result = resolveSpawnCommand({ shell: 'claude' }, DEFAULT_SHELL, undefined, 'darwin');
      expect(result.shell).toBe('claude');
      expect(result.args).toEqual([]);
    });

    it('resolves agent command and args for agentType', () => {
      const result = resolveSpawnCommand({ agentType: 'codex' }, DEFAULT_SHELL, undefined, 'darwin');
      expect(result.shell).toBe('codex');
      expect(result.args).toEqual([]);
      expect(result.agentConfig.command).toBe('codex');
    });
  });
});
