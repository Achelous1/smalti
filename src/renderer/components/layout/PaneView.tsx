import { useRef } from 'react';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { AgentDropdown } from '../terminal/AgentDropdown';
import { useLayoutStore } from '../../stores/layout-store';
import { useTerminalStore } from '../../stores/terminal-store';
import type { Pane, TerminalTab } from '../../../types/ipc';

const AGENT_COLORS: Record<string, string> = {
  claude: 'var(--agent-claude)',
  gemini: 'var(--agent-gemini)',
  codex: 'var(--agent-codex)',
  shell: 'var(--text-tertiary)',
};

interface PaneViewProps {
  pane: Pane;
  showHeader?: boolean;
}

export function PaneView({ pane, showHeader = false }: PaneViewProps) {
  const focusedPaneId = useLayoutStore((s) => s.focusedPaneId);
  const setFocusedPane = useLayoutStore((s) => s.setFocusedPane);
  const setActiveTab = useLayoutStore((s) => s.setActiveTab);
  const removeTabFromPane = useLayoutStore((s) => s.removeTabFromPane);
  const dropdownRef = useRef<boolean>(false);

  const isFocused = focusedPaneId === pane.id;
  const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId) ?? pane.tabs[0];

  const handleCloseTab = async (tab: TerminalTab, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.sessionId && tab.type !== 'plugin') {
      try {
        await window.aide.terminal.kill(tab.sessionId);
      } catch {
        // ignore
      }
    }
    removeTabFromPane(pane.id, tab.id);
  };

  const toggleDropdown = () => {
    dropdownRef.current = !dropdownRef.current;
    // Force re-render by using terminal store's dropdown
    useTerminalStore.getState().toggleDropdown();
  };

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      onClick={() => setFocusedPane(pane.id)}
    >
      {/* TabBar */}
      <div
        className="relative flex items-end w-full bg-aide-surface shrink-0"
        style={{
          height: '36px',
          borderBottom: isFocused
            ? '2px solid var(--accent)'
            : '1px solid var(--border)',
        }}
      >
        {pane.tabs.map((tab) => {
          const isActive = tab.id === pane.activeTabId;
          const isPlugin = tab.type === 'plugin';
          const agentId = tab.agentId ?? 'shell';
          const dotColor = AGENT_COLORS[agentId] ?? AGENT_COLORS.shell;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(pane.id, tab.id)}
              className={`group relative flex items-center gap-1.5 px-3 h-full text-[12px] font-mono transition-colors ${
                isActive
                  ? 'bg-aide-tab-active-bg text-aide-text-primary'
                  : 'bg-aide-tab-inactive-bg text-aide-text-secondary hover:text-aide-text-primary'
              }`}
            >
              {isActive && (
                <span
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              )}
              {isPlugin ? (
                <span className="text-[12px] shrink-0" style={{ color: 'var(--accent)' }}>
                  ◈
                </span>
              ) : (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: dotColor }}
                />
              )}
              <span>{tab.title}</span>
              {pane.tabs.length > 1 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleCloseTab(tab, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleCloseTab(tab, e as unknown as React.MouseEvent);
                  }}
                  className="ml-1 opacity-0 group-hover:opacity-100 text-[10px] text-aide-text-tertiary hover:text-aide-text-primary transition-opacity leading-none"
                >
                  ×
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={toggleDropdown}
          className="flex items-center justify-center px-3 h-full text-[14px] text-aide-text-tertiary bg-aide-surface hover:text-aide-text-primary transition-colors"
        >
          +
        </button>

        {useTerminalStore.getState().dropdownOpen && <AgentDropdown />}
      </div>

      {/* Pane Header (only shown in multi-pane mode) */}
      {showHeader && activeTab && (
        <div className="flex items-center gap-2 shrink-0 bg-aide-surface px-3 border-b border-aide-border" style={{ height: '28px' }}>
          {activeTab.type === 'plugin' ? (
            <span className="text-[12px]" style={{ color: 'var(--accent)' }}>◈</span>
          ) : (
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: AGENT_COLORS[activeTab.agentId ?? 'shell'] ?? AGENT_COLORS.shell }}
            />
          )}
          <span className="text-[11px] font-mono text-aide-text-secondary truncate">
            {activeTab.title}
          </span>
        </div>
      )}

      {/* Terminal/Plugin content area */}
      <div className="flex-1 overflow-hidden relative">
        {pane.tabs.map((tab) => {
          const isVisible = tab.id === pane.activeTabId;
          if (tab.type === 'plugin') {
            return (
              <div
                key={tab.id}
                className="absolute inset-0 flex items-center justify-center text-aide-text-tertiary"
                style={{ display: isVisible ? 'flex' : 'none' }}
              >
                <span className="text-sm">Plugin: {tab.title}</span>
              </div>
            );
          }
          return (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{ display: isVisible ? 'block' : 'none' }}
            >
              {tab.sessionId && (
                <TerminalPanel sessionId={tab.sessionId} visible={isVisible && isFocused} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
