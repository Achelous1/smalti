/**
 * Regression test for slow workspace entry (restoreSession).
 *
 * Before: restoreSession respawned each saved tab's PTY one-by-one with
 * `await terminal.spawn()` inside a for-loop, and only committed the layout
 * AFTER every spawn resolved. On Windows each ConPTY spawn is slow, so a
 * workspace with K tabs blocked for the SUM of K serial spawns before anything
 * rendered.
 *
 * After: the layout is committed immediately with tabs in a 'spawning' state
 * (optimistic render), and all PTYs are spawned in parallel; each tab's
 * sessionId is attached as its spawn resolves.
 *
 * The two deferred-spawn assertions below fail on the old code:
 *  - parallel dispatch: old code calls spawn once and awaits it, so only 1
 *    call is observed while spawns are pending (new code dispatches all).
 *  - optimistic render: old code leaves the layout untouched until every spawn
 *    resolves, so the restored tabs are absent while spawns are pending.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useWorkspaceStore } from '../../src/renderer/stores/workspace-store';
import { useLayoutStore, createPane } from '../../src/renderer/stores/layout-store';
import { useTerminalStore } from '../../src/renderer/stores/terminal-store';
import { usePluginStore } from '../../src/renderer/stores/plugin-store';
import type { TerminalSpawnResult } from '../../src/types/ipc';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 10));

describe('layout-store.restoreSession — parallel + optimistic spawn', () => {
  let pending: Array<{ resolve: (v: TerminalSpawnResult) => void }>;

  beforeEach(() => {
    pending = [];

    vi.stubGlobal('window', {
      aide: {
        session: {
          load: vi.fn().mockResolvedValue({
            version: 1,
            workspaceId: 'ws-1',
            savedAt: 1,
            layout: {
              id: 'pane-1',
              tabs: [
                { id: 't1', type: 'shell', title: '$ a', isActive: true },
                { id: 't2', type: 'shell', title: '$ b', isActive: false },
              ],
              activeTabId: 't1',
            },
            focusedPaneId: 'pane-1',
            activePlugins: [],
            sidePanelTab: 'files',
          }),
          save: vi.fn().mockResolvedValue(undefined),
        },
        terminal: {
          spawn: vi.fn(() => {
            const d = deferred<TerminalSpawnResult>();
            pending.push(d);
            return d.promise;
          }),
        },
        plugin: { activate: vi.fn().mockResolvedValue(undefined) },
      },
    });

    const pane = createPane();
    useLayoutStore.setState({ layout: pane, focusedPaneId: pane.id });
    useTerminalStore.setState({ tabs: [], activeTabId: null, dropdownOpen: false, workspaceTabs: {} });
    usePluginStore.setState({ plugins: [], loading: false, error: null, generating: false, generateError: null });
    useWorkspaceStore.setState({
      workspaces: [{ id: 'ws-1', name: 'A', path: '/tmp/a' }],
      activeWorkspaceId: 'ws-1',
      recentProjects: [],
      navExpanded: true,
      sidePanelTab: 'files',
    } as Parameters<typeof useWorkspaceStore.setState>[0]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('commits the layout immediately and spawns all tabs in parallel', async () => {
    const done = useLayoutStore.getState().restoreSession('ws-1');
    await flush(); // let session.load resolve + synchronous layout build + spawn dispatch

    // Optimistic render: both tabs are already present, in 'spawning' state,
    // before any spawn has resolved.
    const tabs = useLayoutStore.getState().getAllPanes().flatMap((p) => p.tabs);
    expect(tabs.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(tabs.every((t) => t.spawnState === 'spawning' && !t.sessionId)).toBe(true);

    // Parallel dispatch: both spawns were fired without waiting for the first.
    expect((window.aide.terminal.spawn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
    expect(pending.length).toBe(2);

    // Resolve spawns out of order; sessionIds attach and 'spawning' clears.
    pending[1].resolve({ ok: true, sessionId: 'sess-2' });
    pending[0].resolve({ ok: true, sessionId: 'sess-1' });
    await done;

    const after = useLayoutStore.getState().getAllPanes().flatMap((p) => p.tabs);
    const t1 = after.find((t) => t.id === 't1');
    const t2 = after.find((t) => t.id === 't2');
    expect(t1?.sessionId).toBe('sess-1');
    expect(t2?.sessionId).toBe('sess-2');
    expect(after.every((t) => !t.spawnState)).toBe(true);
  });
});
