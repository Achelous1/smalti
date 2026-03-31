import { useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { StatusBar } from './components/layout/StatusBar';
import { SplitContainer } from './components/layout/SplitContainer';
import { DndProvider } from './components/layout/DndProvider';
import { WorkspaceNav } from './components/workspace/WorkspaceNav';
import { WelcomePage } from './components/welcome/WelcomePage';
import { FileExplorer } from './components/file-explorer/FileExplorer';
import { PluginPanel } from './components/plugin/PluginPanel';
import { useWorkspaceStore } from './stores/workspace-store';
import { useTerminalStore } from './stores/terminal-store';
import { useLayoutStore } from './stores/layout-store';

export function App() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const recentProjects = useWorkspaceStore((s) => s.recentProjects);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const tabs = useTerminalStore((s) => s.tabs);
  const createDefaultTab = useTerminalStore((s) => s.createDefaultTab);
  const updateTabSession = useTerminalStore((s) => s.updateTabSession);
  const layout = useLayoutStore((s) => s.layout);
  const sidePanelTab = useWorkspaceStore((s) => s.sidePanelTab);
  const setSidePanelTab = useWorkspaceStore((s) => s.setSidePanelTab);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // Auto-create a default shell tab when workspace is first loaded
  useEffect(() => {
    if (!activeWorkspaceId || tabs.length > 0) return;
    const tabId = createDefaultTab();
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    window.aide.terminal.spawn({ cwd: ws?.path }).then((sessionId) => {
      updateTabSession(tabId, sessionId);
      // Sync to layout store: add tab to the focused pane
      const tab = useTerminalStore.getState().tabs.find((t) => t.id === tabId);
      if (tab) {
        const pane = useLayoutStore.getState().getFocusedPane();
        if (pane && pane.tabs.length === 0) {
          useLayoutStore.getState().addTabToPane(pane.id, { ...tab, sessionId });
        } else {
          useLayoutStore.getState().resetLayout([{ ...tab, sessionId }]);
        }
      }
    }).catch(() => {
      // ignore spawn errors
    });
  }, [activeWorkspaceId, tabs.length, createDefaultTab, updateTabSession]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // ⌘B / Ctrl+B: toggle workspace nav
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        e.stopPropagation();
        useWorkspaceStore.getState().toggleNav();
        return;
      }

      // ⌘T / Ctrl+T: new shell tab in focused pane
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        e.stopPropagation();
        const wsId = useWorkspaceStore.getState().activeWorkspaceId;
        if (!wsId) return;
        const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === wsId);
        const tabId = useTerminalStore.getState().createDefaultTab();
        window.aide.terminal.spawn({ cwd: ws?.path }).then((sessionId) => {
          useTerminalStore.getState().updateTabSession(tabId, sessionId);
          const tab = useTerminalStore.getState().tabs.find((t) => t.id === tabId);
          if (tab) {
            const pane = useLayoutStore.getState().getFocusedPane();
            if (pane) {
              useLayoutStore.getState().addTabToPane(pane.id, { ...tab, sessionId });
            }
          }
        }).catch(() => {
          // ignore spawn errors
        });
        return;
      }

      // ⌘W / Ctrl+W: close current tab from focused pane
      if (e.key === 'w' || e.key === 'W') {
        const pane = useLayoutStore.getState().getFocusedPane();
        if (!pane || !pane.activeTabId) return;
        const allPanes = useLayoutStore.getState().getAllPanes();
        const totalTabs = allPanes.reduce((sum, p) => sum + p.tabs.length, 0);
        if (totalTabs <= 1) return;
        e.preventDefault();
        e.stopPropagation();
        const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId);
        if (activeTab?.sessionId && activeTab.type !== 'plugin') {
          window.aide.terminal.kill(activeTab.sessionId).catch(() => {
            // ignore kill errors
          });
        }
        useLayoutStore.getState().removeTabFromPane(pane.id, pane.activeTabId);
        useTerminalStore.getState().removeTab(pane.activeTabId);
        return;
      }

      // ⌘\ / Ctrl+\: split pane right
      if (e.key === '\\') {
        const pane = useLayoutStore.getState().getFocusedPane();
        if (pane) {
          e.preventDefault();
          e.stopPropagation();
          useLayoutStore.getState().splitPane(pane.id, e.shiftKey ? 'vertical' : 'horizontal');
        }
        return;
      }

      // ⌘1-9 / Ctrl+1-9: switch to tab by number in focused pane
      const digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= 9) {
        const pane = useLayoutStore.getState().getFocusedPane();
        if (pane) {
          const target = pane.tabs[digit - 1];
          if (target) {
            e.preventDefault();
            e.stopPropagation();
            useLayoutStore.getState().setActiveTab(pane.id, target.id);
          }
        }
      }
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);

  if (!activeWorkspaceId) {
    return <WelcomePage recentProjects={recentProjects} />;
  }

  return (
    <div className="flex flex-col h-screen bg-aide-background text-aide-text-primary overflow-hidden">
      <TitleBar />

      {/* Body: WorkspaceNav + SidePanel + MainArea */}
      <div className="flex flex-1 overflow-hidden">
        <WorkspaceNav />

        {/* Side Panel (220px) */}
        <div
          className="flex flex-col shrink-0 bg-aide-surface-sidebar border-r border-aide-border overflow-hidden"
          style={{ width: '220px' }}
        >
          {/* Panel tab switcher */}
          <div className="flex shrink-0 border-b border-aide-border" style={{ height: '32px' }}>
            {(['files', 'plugins'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidePanelTab(tab)}
                className={`flex-1 flex items-center justify-center text-[10px] uppercase tracking-widest font-semibold transition-colors ${
                  sidePanelTab === tab
                    ? 'text-aide-text-primary border-b-2 border-aide-accent'
                    : 'text-aide-text-tertiary hover:text-aide-text-secondary'
                }`}
              >
                {tab === 'files' ? 'FILES' : 'PLUGINS'}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex flex-col flex-1 overflow-hidden relative">
            {sidePanelTab === 'files' && activeWorkspaceId && (() => {
              const ws = workspaces.find((w) => w.id === activeWorkspaceId);
              return ws ? <FileExplorer cwd={ws.path} /> : null;
            })()}
            {sidePanelTab === 'plugins' && <PluginPanel />}
          </div>
        </div>

        {/* Main area: SplitContainer with DnD */}
        <div className="flex flex-1 overflow-hidden">
          <DndProvider>
            <SplitContainer node={layout} />
          </DndProvider>
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
