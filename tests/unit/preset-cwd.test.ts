import { describe, it, expect } from 'vitest';
import { resolvePresetCwd } from '../../src/renderer/utils/preset-cwd';

describe('resolvePresetCwd', () => {
  it('returns the workspace path when the preset has no cwd', () => {
    expect(resolvePresetCwd(undefined, '/ws')).toBe('/ws');
  });

  it('joins a workspace-relative cwd onto the workspace path', () => {
    expect(resolvePresetCwd('web', '/ws')).toBe('/ws/web');
  });

  it('passes a POSIX absolute cwd through untouched', () => {
    expect(resolvePresetCwd('/var/log', '/ws')).toBe('/var/log');
  });

  it('passes a Windows absolute cwd through untouched', () => {
    expect(resolvePresetCwd('C:\\repos\\app', 'D:\\ws')).toBe('C:\\repos\\app');
  });

  it('returns the relative cwd as-is when no workspace path exists', () => {
    expect(resolvePresetCwd('web', undefined)).toBe('web');
  });
});
