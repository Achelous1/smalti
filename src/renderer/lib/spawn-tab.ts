import type { TerminalTab, TerminalSpawnOptions } from '../../types/ipc';
import { useTerminalStore } from '../stores/terminal-store';
import { useLayoutStore } from '../stores/layout-store';
import { useToastStore } from '../stores/toast-store';

/** Tab fields the caller supplies — sessionId/spawnState are managed here. */
type PendingTab = Omit<TerminalTab, 'sessionId' | 'spawnState'>;

/**
 * Render a terminal tab immediately, then spawn its PTY in the background.
 *
 * The tab appears instantly in a 'spawning' state so the UI stays responsive
 * instead of blocking on the (sometimes slow, especially on Windows ConPTY)
 * PTY spawn. When the real sessionId arrives the tab swaps to the live
 * terminal; if the spawn fails the optimistic tab is rolled back with a toast.
 *
 * @param paneId  Target pane; falls back to the focused pane when omitted.
 */
export function spawnTabInBackground(
  tab: PendingTab,
  paneId: string | undefined,
  spawnOptions: TerminalSpawnOptions,
): void {
  const pendingTab: TerminalTab = { ...tab, spawnState: 'spawning' };

  // 1. Render immediately in both stores (mirrors the legacy call-site order).
  useTerminalStore.getState().addTab(pendingTab);
  useTerminalStore.getState().setActiveTab(pendingTab.id);
  const targetPaneId = paneId ?? useLayoutStore.getState().getFocusedPane()?.id;
  if (targetPaneId) {
    useLayoutStore.getState().addTabToPane(targetPaneId, pendingTab);
    useLayoutStore.getState().setActiveTab(targetPaneId, pendingTab.id);
  }

  // 2. Spawn in the background; attach the sessionId or roll back on failure.
  void window.aide.terminal.spawn(spawnOptions).then((result) => {
    if (result.ok) {
      useTerminalStore.getState().updateTabSession(pendingTab.id, result.sessionId);
      useLayoutStore.getState().updateTabSessionId(pendingTab.id, result.sessionId);
    } else {
      useToastStore.getState().push({
        kind: 'error',
        title: `Failed to open terminal (${result.code ?? 'unknown'})`,
        detail: result.error,
      });
      // Mark the tab as failed (PaneView renders "Failed to start session")
      // rather than removing it. removeTabFromPane closes the whole pane when
      // this is its only tab — that would destroy a split the user created
      // over a transient spawn error. The user closes the failed tab manually.
      useLayoutStore.getState().markTabSpawnFailed(pendingTab.id);
    }
  });
}
