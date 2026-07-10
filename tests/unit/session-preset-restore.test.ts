import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLayoutStore } from '../../src/renderer/stores/layout-store';
import { useTerminalStore } from '../../src/renderer/stores/terminal-store';
import { useWorkspaceStore } from '../../src/renderer/stores/workspace-store';
import { usePresetStore } from '../../src/renderer/stores/preset-store';
import type { SavedSession, SavedTab, CommandPreset } from '../../src/types/ipc';

const spawnMock = vi.fn(async () => ({ ok: true as const, sessionId: 'term-restored' }));
let savedSession: SavedSession | null = null;
let storedPresets: CommandPreset[] = [];

function makeSession(tabs: SavedTab[]): SavedSession {
  return {
    version: 1,
    workspaceId: 'ws1',
    savedAt: 0,
    layout: { id: 'pane-1', tabs, activeTabId: tabs[0]?.id ?? null },
    focusedPaneId: 'pane-1',
    activePlugins: [],
    sidePanelTab: 'files',
  } as SavedSession;
}

beforeEach(() => {
  spawnMock.mockClear();
  savedSession = null;
  storedPresets = [];
  (window as unknown as { aide: unknown }).aide = {
    session: { load: async () => savedSession },
    terminal: { spawn: spawnMock },
    plugin: { activate: async () => ({}) },
    appSettings: {
      get: async () => ({ theme: 'dark', windowBounds: null, commandPresets: storedPresets }),
      set: async () => {},
    },
  };
  useWorkspaceStore.setState({
    activeWorkspaceId: 'ws1',
    workspaces: [{ id: 'ws1', name: 'aide', path: '/ws', color: '#fff', lastOpened: 0 }],
  });
  usePresetStore.setState({ presets: [], paletteOpen: false, managerOpen: false });
  useTerminalStore.setState({ tabs: [], activeTabId: null, workspaceTabs: {} });
});

describe('session restore for preset tabs', () => {
  it('re-runs the preset command when restoring a preset tab', async () => {
    storedPresets = [{ id: 'p1', name: 'LazyGit', command: 'lazygit' }];
    savedSession = makeSession([
      { id: 't1', type: 'shell', title: 'LazyGit', isActive: true, presetId: 'p1' },
    ]);

    await useLayoutStore.getState().restoreSession('ws1');

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0][0]).toEqual({ command: 'lazygit', cwd: '/ws' });
    const tab = useTerminalStore.getState().tabs.find((t) => t.id === 't1');
    expect(tab?.presetId).toBe('p1');
  });

  it('resolves the preset cwd relative to the workspace root', async () => {
    storedPresets = [{ id: 'p2', name: 'Dev Server', command: 'npm run dev', cwd: 'web' }];
    savedSession = makeSession([
      { id: 't2', type: 'shell', title: 'Dev Server', isActive: true, presetId: 'p2' },
    ]);

    await useLayoutStore.getState().restoreSession('ws1');

    expect(spawnMock.mock.calls[0][0]).toEqual({ command: 'npm run dev', cwd: '/ws/web' });
  });

  it('falls back to a plain shell when the preset was deleted', async () => {
    storedPresets = [];
    savedSession = makeSession([
      { id: 't3', type: 'shell', title: 'LazyGit', isActive: true, presetId: 'deleted-id' },
    ]);

    await useLayoutStore.getState().restoreSession('ws1');

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0][0]).toEqual({ cwd: '/ws' });
    const tab = useTerminalStore.getState().tabs.find((t) => t.id === 't3');
    expect(tab?.title).toBe('LazyGit');
  });
});

describe('buildSavedSession preset serialization', () => {
  it('includes presetId in the saved tab', () => {
    useLayoutStore.setState({
      layout: {
        id: 'pane-1',
        tabs: [{ id: 't1', type: 'shell', title: 'LazyGit', sessionId: 's1', presetId: 'p1' }],
        activeTabId: 't1',
      },
      focusedPaneId: 'pane-1',
    });

    const session = useLayoutStore.getState().buildSavedSession('ws1');
    const pane = session.layout as { tabs: SavedTab[] };
    expect(pane.tabs[0]).toMatchObject({ id: 't1', presetId: 'p1' });
  });
});
