import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Stub heavy electron / xterm dependencies so happy-dom can load the modules
// ---------------------------------------------------------------------------
vi.mock('../../src/renderer/stores/terminal-store', () => ({
  useTerminalStore: vi.fn(() => ({
    tabs: [],
    activeTabId: null,
    setActiveTab: vi.fn(),
    removeTab: vi.fn(),
    dropdownOpen: false,
    toggleDropdown: vi.fn(),
  })),
}));

vi.mock('../../src/renderer/components/terminal/AgentDropdown', () => ({
  AgentDropdown: () => null,
}));

vi.mock('../../src/renderer/components/terminal/TerminalPanel', () => ({
  TerminalPanel: () => null,
}));

vi.mock('../../src/renderer/components/plugin/PluginView', () => ({
  PluginView: () => null,
}));

vi.mock('../../src/renderer/components/layout/EmptyState', () => ({
  EmptyState: () => null,
}));

vi.mock('../../src/renderer/stores/layout-store', () => ({
  useLayoutStore: vi.fn(() => ({
    focusedPaneId: null,
    setFocusedPane: vi.fn(),
    setActiveTab: vi.fn(),
    removeTabFromPane: vi.fn(),
    renameTabInPane: vi.fn(),
    splitPane: vi.fn(),
    closePane: vi.fn(),
    moveTabToPane: vi.fn(),
  })),
}));

vi.mock('../../src/renderer/lib/xterm-cache', () => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  PointerSensor: vi.fn(),
  closestCenter: vi.fn(),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
  useDndMonitor: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
  horizontalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}));

vi.mock('../../src/renderer/stores/workspace-store', () => ({
  useWorkspaceStore: vi.fn(() => ({
    workspaces: [],
    activeWorkspaceId: null,
    navExpanded: false,
    setActive: vi.fn(),
    toggleNav: vi.fn(),
    addWorkspace: vi.fn(),
    removeWorkspace: vi.fn(),
    renameWorkspace: vi.fn(),
  })),
}));

vi.mock('../../src/renderer/stores/agent-store', () => ({
  useAgentStore: vi.fn(() => ({
    sessionStatuses: {},
    setStatus: vi.fn(),
  })),
}));

vi.mock('../../src/renderer/components/workspace/StatusIndicator', () => ({
  StatusDot: () => null,
  StatusBadge: () => null,
}));

vi.mock('../../src/renderer/components/updater/UpdateNotice', () => ({
  UpdateNotice: () => null,
}));

// Minimal window.aide stub
beforeEach(() => {
  if (!(globalThis as unknown as { aide?: unknown }).aide) {
    (globalThis as unknown as Record<string, unknown>).aide = {
      terminal: { kill: vi.fn() },
      agent: { onStatus: vi.fn(() => vi.fn()) },
      workspace: { openDialog: vi.fn(), create: vi.fn(), rename: vi.fn(), showInFinder: vi.fn(), remove: vi.fn() },
    };
  }
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Smoke test 1: TabBar — title span truncates, close button stays visible
// ---------------------------------------------------------------------------
describe('TabBar – tab title overflow smoke test', () => {
  it('title span has truncate class and close button has shrink-0', async () => {
    const { useTerminalStore } = await import('../../src/renderer/stores/terminal-store');
    const tab1 = { id: 't1', title: 'A very long tab title that should be truncated with an ellipsis', agentId: 'claude', sessionId: null };
    const tab2 = { id: 't2', title: 'Tab 2', agentId: 'shell', sessionId: null };
    (useTerminalStore as ReturnType<typeof vi.fn>).mockReturnValue({
      tabs: [tab1, tab2],
      activeTabId: 't1',
      setActiveTab: vi.fn(),
      removeTab: vi.fn(),
      dropdownOpen: false,
      toggleDropdown: vi.fn(),
    });

    const { TabBar } = await import('../../src/renderer/components/terminal/TabBar');
    const { container } = render(<TabBar />);

    const titleSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === tab1.title
    );
    expect(titleSpan, 'title span not found').toBeTruthy();
    expect(titleSpan!.className).toContain('truncate');

    const closeButtons = Array.from(container.querySelectorAll('span[role="button"]'));
    expect(closeButtons.length, 'no close buttons found').toBeGreaterThan(0);
    closeButtons.forEach((btn) => {
      expect(btn.className).toContain('shrink-0');
    });
  });
});

// ---------------------------------------------------------------------------
// Smoke test 2: PaneView — title span truncates, close button stays visible
// (DraggableTab tested indirectly via PaneView)
// ---------------------------------------------------------------------------
describe('PaneView – tab title overflow smoke test', () => {
  it('title span has truncate class and close button has shrink-0', async () => {
    const { useLayoutStore } = await import('../../src/renderer/stores/layout-store');
    const mockTab = {
      id: 'p1',
      title: 'A very long pane tab title that must be truncated with ellipsis',
      type: 'terminal' as const,
      sessionId: 'sess1',
      agentId: 'claude',
    };
    const mockPane = { id: 'pane1', tabs: [mockTab], activeTabId: 'p1' };
    (useLayoutStore as ReturnType<typeof vi.fn>).mockReturnValue({
      focusedPaneId: 'pane1',
      setFocusedPane: vi.fn(),
      setActiveTab: vi.fn(),
      removeTabFromPane: vi.fn(),
      renameTabInPane: vi.fn(),
      splitPane: vi.fn(),
      closePane: vi.fn(),
      moveTabToPane: vi.fn(),
    });

    const { PaneView } = await import('../../src/renderer/components/layout/PaneView');
    const { container } = render(<PaneView pane={mockPane as Parameters<typeof PaneView>[0]['pane']} />);

    const titleSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === mockTab.title
    );
    expect(titleSpan, 'title span not found').toBeTruthy();
    expect(titleSpan!.className).toContain('truncate');

    const closeBtn = container.querySelector('span[role="button"]');
    expect(closeBtn, 'close button not found').toBeTruthy();
    expect(closeBtn!.className).toContain('shrink-0');
  });
});

// ---------------------------------------------------------------------------
// Smoke test 3: WorkspaceNav — sidebar workspace name span truncates
// (sidebar list uses truncate+flex-1 without a min/max-w cap — different
//  context from the editor tab bar which enforces 80px/200px bounds)
// ---------------------------------------------------------------------------
describe('WorkspaceNav – tab title overflow smoke test', () => {
  it('sidebar workspace name span has truncate class', async () => {
    const { useWorkspaceStore } = await import('../../src/renderer/stores/workspace-store');
    const { useTerminalStore } = await import('../../src/renderer/stores/terminal-store');
    const { useLayoutStore } = await import('../../src/renderer/stores/layout-store');

    const mockWs = { id: 'ws1', name: 'A very long workspace name that should truncate in the sidebar', path: '/home/user/project', color: '#3B82F6' };

    (useWorkspaceStore as ReturnType<typeof vi.fn>).mockReturnValue({
      workspaces: [mockWs],
      activeWorkspaceId: 'ws1',
      navExpanded: true,
      setActive: vi.fn(),
      toggleNav: vi.fn(),
      addWorkspace: vi.fn(),
      removeWorkspace: vi.fn(),
      renameWorkspace: vi.fn(),
    });

    (useTerminalStore as ReturnType<typeof vi.fn>).mockReturnValue({
      tabs: [],
      activeTabId: null,
      setActiveTab: vi.fn(),
      removeTab: vi.fn(),
      dropdownOpen: false,
      toggleDropdown: vi.fn(),
      workspaceTabs: {},
    });

    const layoutState = {
      layout: { id: 'pane1', tabs: [], activeTabId: null },
      focusedPaneId: null,
      setFocusedPane: vi.fn(),
      setActiveTab: vi.fn(),
      removeTabFromPane: vi.fn(),
      renameTabInPane: vi.fn(),
      splitPane: vi.fn(),
    };
    (useLayoutStore as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: typeof layoutState) => unknown) =>
        typeof selector === 'function' ? selector(layoutState) : layoutState
    );

    const { WorkspaceNav } = await import('../../src/renderer/components/workspace/WorkspaceNav');
    const { container } = render(<WorkspaceNav />);

    // Workspace name is always visible in expanded mode and must truncate
    const nameSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === mockWs.name
    );
    expect(nameSpan, 'workspace name span not found in sidebar').toBeTruthy();
    expect(nameSpan!.className).toContain('truncate');
  });
});
