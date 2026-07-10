import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { CommandPalette } from '../../src/renderer/components/palette/CommandPalette';
import { usePresetStore } from '../../src/renderer/stores/preset-store';
import { useWorkspaceStore } from '../../src/renderer/stores/workspace-store';
import { spawnTabInBackground } from '../../src/renderer/lib/spawn-tab';

vi.mock('../../src/renderer/lib/spawn-tab', () => ({
  spawnTabInBackground: vi.fn(),
}));

afterEach(() => cleanup());

beforeEach(() => {
  vi.mocked(spawnTabInBackground).mockClear();
  useWorkspaceStore.setState({
    activeWorkspaceId: 'ws1',
    workspaces: [{ id: 'ws1', name: 'aide', path: '/repo/aide', color: '#fff', lastOpened: 0 }],
  });
  usePresetStore.setState({
    presets: [
      { id: 'p1', name: 'LazyGit', command: 'lazygit' },
      { id: 'p2', name: 'Dev Server', command: 'npm run dev', cwd: 'web' },
    ],
    paletteOpen: true,
    managerOpen: false,
  });
});

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    usePresetStore.setState({ paletteOpen: false });
    const { queryByTestId } = render(<CommandPalette />);
    expect(queryByTestId('command-palette')).toBeNull();
  });

  it('lists presets and built-in agent entries', () => {
    const { getByTestId } = render(<CommandPalette />);
    expect(getByTestId('palette-item-preset-p1').textContent).toContain('LazyGit');
    expect(getByTestId('palette-item-preset-p2').textContent).toContain('npm run dev');
    expect(getByTestId('palette-item-agent-claude')).toBeTruthy();
    expect(getByTestId('palette-item-shell')).toBeTruthy();
  });

  it('filters items by fuzzy query', () => {
    const { getByTestId, queryByTestId } = render(<CommandPalette />);
    fireEvent.change(getByTestId('palette-input'), { target: { value: 'laz' } });
    expect(getByTestId('palette-item-preset-p1')).toBeTruthy();
    expect(queryByTestId('palette-item-preset-p2')).toBeNull();
    expect(queryByTestId('palette-item-agent-claude')).toBeNull();
  });

  it('Enter runs the selected preset via the command spawn path', () => {
    const { getByTestId } = render(<CommandPalette />);
    const input = getByTestId('palette-input');
    fireEvent.change(input, { target: { value: 'laz' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(spawnTabInBackground).toHaveBeenCalledTimes(1);
    const [tab, paneId, spawnOptions] = vi.mocked(spawnTabInBackground).mock.calls[0];
    expect(tab).toMatchObject({ type: 'shell', presetId: 'p1', title: 'LazyGit' });
    expect(paneId).toBeUndefined();
    expect(spawnOptions).toEqual({ command: 'lazygit', cwd: '/repo/aide' });
    expect(usePresetStore.getState().paletteOpen).toBe(false);
  });

  it('resolves preset cwd relative to the workspace root', () => {
    const { getByTestId } = render(<CommandPalette />);
    const input = getByTestId('palette-input');
    fireEvent.change(input, { target: { value: 'dev' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const [, , spawnOptions] = vi.mocked(spawnTabInBackground).mock.calls[0];
    expect(spawnOptions).toEqual({ command: 'npm run dev', cwd: '/repo/aide/web' });
  });

  it('uses an absolute preset cwd as-is', () => {
    usePresetStore.setState({
      presets: [{ id: 'p3', name: 'Logs', command: 'tail -f app.log', cwd: '/var/log' }],
      paletteOpen: true,
      managerOpen: false,
    });
    const { getByTestId } = render(<CommandPalette />);
    const input = getByTestId('palette-input');
    fireEvent.change(input, { target: { value: 'logs' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const [, , spawnOptions] = vi.mocked(spawnTabInBackground).mock.calls[0];
    expect(spawnOptions).toEqual({ command: 'tail -f app.log', cwd: '/var/log' });
  });

  it('arrow keys move the selection before Enter', () => {
    const { getByTestId } = render(<CommandPalette />);
    const input = getByTestId('palette-input');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    const [tab] = vi.mocked(spawnTabInBackground).mock.calls[0];
    expect(tab).toMatchObject({ presetId: 'p2' });
  });

  it('runs a built-in agent entry with the legacy shell spawn path', () => {
    const { getByTestId } = render(<CommandPalette />);
    fireEvent.click(getByTestId('palette-item-agent-claude'));

    const [tab, , spawnOptions] = vi.mocked(spawnTabInBackground).mock.calls[0];
    expect(tab).toMatchObject({ type: 'agent', agentId: 'claude' });
    expect(spawnOptions).toEqual({ shell: 'claude', cwd: '/repo/aide' });
  });

  it('Escape closes the palette without spawning', () => {
    const { getByTestId } = render(<CommandPalette />);
    fireEvent.keyDown(getByTestId('palette-input'), { key: 'Escape' });
    expect(usePresetStore.getState().paletteOpen).toBe(false);
    expect(spawnTabInBackground).not.toHaveBeenCalled();
  });

  it('opens the preset manager from the actions section', () => {
    const { getByTestId } = render(<CommandPalette />);
    fireEvent.click(getByTestId('palette-action-manage'));
    expect(usePresetStore.getState().managerOpen).toBe(true);
    expect(usePresetStore.getState().paletteOpen).toBe(false);
  });
});
