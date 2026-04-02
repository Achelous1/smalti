import { create } from 'zustand';
import type { PluginInfo } from '../../types/ipc';

interface PluginState {
  plugins: PluginInfo[];
  loading: boolean;
  generating: boolean;
  error: string | null;
  generateError: string | null;
  loadPlugins: () => Promise<void>;
  activate: (id: string) => Promise<void>;
  deactivate: (id: string) => Promise<void>;
  deletePlugin: (name: string) => Promise<void>;
  generate: (name: string, description: string) => Promise<{ id: string } | null>;
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  loading: false,
  generating: false,
  error: null,
  generateError: null,

  loadPlugins: async () => {
    set({ loading: true, error: null });
    try {
      const plugins = await window.aide.plugin.list();
      set({ plugins, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Failed to load plugins' });
    }
  },

  activate: async (id: string) => {
    try {
      await window.aide.plugin.activate(id);
      const plugins = await window.aide.plugin.list();
      set({ plugins });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to activate plugin' });
    }
  },

  deactivate: async (id: string) => {
    try {
      await window.aide.plugin.deactivate(id);
      const plugins = await window.aide.plugin.list();
      set({ plugins });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to deactivate plugin' });
    }
  },

  deletePlugin: async (name: string) => {
    await window.aide.plugin.delete(name);
    set({ plugins: get().plugins.filter((p) => p.name !== name) });
  },

  generate: async (name: string, description: string) => {
    set({ generating: true, generateError: null });
    try {
      const spec = await window.aide.plugin.generate(name, description);
      // Reload the plugin list after generation
      const plugins = await window.aide.plugin.list();
      set({ plugins, generating: false });
      return { id: spec.id };
    } catch (e) {
      set({
        generating: false,
        generateError: e instanceof Error ? e.message : 'Failed to generate plugin',
      });
      return null;
    }
  },
}));
