import { create } from 'zustand';
import type { TerminalTab } from '../../types/ipc';

interface TerminalState {
  tabs: TerminalTab[];
  activeTabId: string | null;
  dropdownOpen: boolean;
  addTab: (tab: TerminalTab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  toggleDropdown: () => void;
  updateTabSession: (tabId: string, sessionId: string) => void;
  createDefaultTab: () => string;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  dropdownOpen: false,
  addTab: (tab) => set((state) => ({ tabs: [...state.tabs, tab] })),
  removeTab: (id) =>
    set((state) => {
      const remaining = state.tabs.filter((t) => t.id !== id);
      let nextActiveId = state.activeTabId;
      if (state.activeTabId === id) {
        nextActiveId = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }
      return { tabs: remaining, activeTabId: nextActiveId };
    }),
  setActiveTab: (id) => set({ activeTabId: id }),
  toggleDropdown: () => set((state) => ({ dropdownOpen: !state.dropdownOpen })),
  updateTabSession: (tabId, sessionId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, sessionId } : t)),
    })),
  createDefaultTab: () => {
    const tabId = crypto.randomUUID();
    const tab: TerminalTab = {
      id: tabId,
      type: 'shell',
      sessionId: '',
      title: '$ shell',
    };
    get().addTab(tab);
    get().setActiveTab(tabId);
    return tabId;
  },
}));
