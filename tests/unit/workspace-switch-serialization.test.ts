/**
 * Regression test for the "tabs follow into the new workspace" bug.
 *
 * Bug (intermittent, Windows-prone because slow ConPTY spawns widen the race):
 * switching from a workspace WITH tabs to one WITHOUT tabs sometimes left the
 * departing workspace's LIVE tabs rendered under the new workspace (both in the
 * main terminal area and the WorkspaceNav sidebar).
 *
 * Root cause: setActive() is async and unguarded. It reads
 *   const prevId = get().activeWorkspaceId
 * at the start but only commits `set({ activeWorkspaceId: id })` at the very end,
 * after several awaits. When two setActive() calls overlap, the second reads a
 * STALE prevId — so it saves/caches the wrong workspace's layout under the wrong
 * key, desyncing `layout` from `activeWorkspaceId`.
 *
 * Fix: serialize setActive() so a second call cannot begin until the first has
 * committed activeWorkspaceId. Then every call observes the correct prevId.
 *
 * This test overlaps two switches (ws-1 -> ws-2, then ws-1 -> ws-3 fired before
 * the first resolves) and asserts the departing workspace each call persists is
 * correct. Without serialization the second call still sees prevId === 'ws-1',
 * so the snapshot for 'ws-2' is never written.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useWorkspaceStore } from '../../src/renderer/stores/workspace-store';
import { useLayoutStore, createPane } from '../../src/renderer/stores/layout-store';
import { useTerminalStore } from '../../src/renderer/stores/terminal-store';
import { usePluginStore } from '../../src/renderer/stores/plugin-store';
import type { SavedSession } from '../../src/types/ipc';

describe('workspace-store.setActive — concurrent switch serialization', () => {
  const savedWorkspaceIds: string[] = [];

  beforeEach(() => {
    savedWorkspaceIds.length = 0;

    vi.stubGlobal('window', {
      aide: {
        workspace: {
          open: vi.fn().mockResolvedValue(undefined),
          list: vi.fn().mockResolvedValue([]),
          recent: vi.fn().mockResolvedValue([]),
        },
        plugin: {
          list: vi.fn().mockResolvedValue([]),
          activate: vi.fn().mockResolvedValue(undefined),
          deactivate: vi.fn().mockResolvedValue(undefined),
          onChanged: vi.fn(() => () => { /* unsub */ }),
        },
        session: {
          // No saved session for any workspace — the destination workspaces are
          // "empty", matching the user's repro (switch into a tab-less workspace).
          load: vi.fn().mockResolvedValue(null),
          save: vi.fn(async (session: SavedSession) => {
            savedWorkspaceIds.push(session.workspaceId);
          }),
        },
        terminal: { spawn: vi.fn().mockResolvedValue({ ok: true, sessionId: 'sess-1' }) },
      },
    });

    // Start already inside ws-1, which has a live shell tab.
    const liveTab = { id: 'tab-A', type: 'shell' as const, sessionId: 'sess-A', title: '$ shell' };
    const pane = createPane([liveTab], liveTab.id);
    useLayoutStore.setState({ layout: pane, focusedPaneId: pane.id });
    useTerminalStore.setState({ tabs: [liveTab], activeTabId: liveTab.id, dropdownOpen: false, workspaceTabs: {} });
    usePluginStore.setState({ plugins: [], loading: false, error: null, generating: false, generateError: null });
    useWorkspaceStore.setState({
      workspaces: [
        { id: 'ws-1', name: 'A', path: '/tmp/a' },
        { id: 'ws-2', name: 'B', path: '/tmp/b' },
        { id: 'ws-3', name: 'C', path: '/tmp/c' },
      ],
      activeWorkspaceId: 'ws-1',
      recentProjects: [],
      navExpanded: true,
      sidePanelTab: 'files',
    } as Parameters<typeof useWorkspaceStore.setState>[0]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('second overlapping switch observes the first committed activeWorkspaceId as its prevId', async () => {
    const setActive = useWorkspaceStore.getState().setActive;

    // Fire two switches back-to-back without awaiting the first — this is the
    // overlap a double-click / re-render double-fire produces.
    const p1 = setActive('ws-2');
    const p2 = setActive('ws-3');
    await Promise.all([p1, p2]);

    // The first switch leaves ws-1 -> must persist ws-1.
    expect(savedWorkspaceIds).toContain('ws-1');
    // The second switch leaves ws-2 (the workspace the first switch entered).
    // Without serialization it reads the stale prevId 'ws-1' and never saves ws-2.
    expect(savedWorkspaceIds).toContain('ws-2');

    // End state must be self-consistent: active workspace is the last target and
    // its (empty) layout carries none of ws-1's live tabs.
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('ws-3');
    const tabs = useLayoutStore.getState().getAllPanes().flatMap((p) => p.tabs);
    expect(tabs.find((t) => t.sessionId === 'sess-A')).toBeUndefined();
  });
});
