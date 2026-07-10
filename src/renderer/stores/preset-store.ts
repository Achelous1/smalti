import { create } from 'zustand';
import type { CommandPreset } from '../../types/ipc';

interface PresetState {
  presets: CommandPreset[];
  paletteOpen: boolean;
  managerOpen: boolean;
  /** When true the manager dialog opens directly in "new preset" edit mode */
  managerCreateRequest: boolean;
  loadPresets: () => Promise<void>;
  addPreset: (preset: Omit<CommandPreset, 'id'>) => Promise<void>;
  updatePreset: (id: string, patch: Partial<Omit<CommandPreset, 'id'>>) => Promise<void>;
  removePreset: (id: string) => Promise<void>;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  openManager: (createNew?: boolean) => void;
  closeManager: () => void;
}

function persist(presets: CommandPreset[]): Promise<void> {
  return window.aide.appSettings.set('commandPresets', presets);
}

export const usePresetStore = create<PresetState>((set, get) => ({
  presets: [],
  paletteOpen: false,
  managerOpen: false,
  managerCreateRequest: false,

  loadPresets: async () => {
    const settings = await window.aide.appSettings.get();
    set({ presets: settings.commandPresets ?? [] });
  },

  addPreset: async (preset) => {
    const next = [...get().presets, { ...preset, id: crypto.randomUUID() }];
    set({ presets: next });
    await persist(next);
  },

  updatePreset: async (id, patch) => {
    const next = get().presets.map((p) => (p.id === id ? { ...p, ...patch } : p));
    set({ presets: next });
    await persist(next);
  },

  removePreset: async (id) => {
    const next = get().presets.filter((p) => p.id !== id);
    set({ presets: next });
    await persist(next);
  },

  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),

  openManager: (createNew = false) =>
    set({ managerOpen: true, paletteOpen: false, managerCreateRequest: createNew }),
  closeManager: () => set({ managerOpen: false, managerCreateRequest: false }),
}));
