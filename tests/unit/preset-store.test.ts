import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandPreset } from '../../src/types/ipc';
import { usePresetStore } from '../../src/renderer/stores/preset-store';

const savedPresets: { value: CommandPreset[] } = { value: [] };
const setSpy = vi.fn(async (_key: string, value: unknown) => {
  savedPresets.value = value as CommandPreset[];
});

beforeEach(() => {
  savedPresets.value = [];
  setSpy.mockClear();
  (window as unknown as { aide: unknown }).aide = {
    appSettings: {
      get: async () => ({ theme: 'dark', windowBounds: null, commandPresets: savedPresets.value }),
      set: setSpy,
    },
  };
  usePresetStore.setState({ presets: [], paletteOpen: false, managerOpen: false });
});

describe('preset-store', () => {
  it('loadPresets pulls presets from app settings', async () => {
    savedPresets.value = [{ id: 'p1', name: 'LazyGit', command: 'lazygit' }];
    await usePresetStore.getState().loadPresets();
    expect(usePresetStore.getState().presets).toEqual(savedPresets.value);
  });

  it('addPreset appends with a generated id and persists the full array', async () => {
    await usePresetStore.getState().addPreset({ name: 'LazyGit', command: 'lazygit' });
    const presets = usePresetStore.getState().presets;
    expect(presets).toHaveLength(1);
    expect(presets[0].id).toBeTruthy();
    expect(presets[0]).toMatchObject({ name: 'LazyGit', command: 'lazygit' });
    expect(setSpy).toHaveBeenCalledWith('commandPresets', presets);
  });

  it('updatePreset patches fields via set() and persists', async () => {
    await usePresetStore.getState().addPreset({ name: 'Dev', command: 'npm run dev' });
    const id = usePresetStore.getState().presets[0].id;
    await usePresetStore.getState().updatePreset(id, { name: 'Dev Server', cwd: 'web' });
    expect(usePresetStore.getState().presets[0]).toMatchObject({
      id,
      name: 'Dev Server',
      command: 'npm run dev',
      cwd: 'web',
    });
    expect(savedPresets.value[0].name).toBe('Dev Server');
  });

  it('removePreset deletes and persists', async () => {
    await usePresetStore.getState().addPreset({ name: 'A', command: 'a' });
    await usePresetStore.getState().addPreset({ name: 'B', command: 'b' });
    const idA = usePresetStore.getState().presets[0].id;
    await usePresetStore.getState().removePreset(idA);
    expect(usePresetStore.getState().presets.map((p) => p.name)).toEqual(['B']);
    expect(savedPresets.value.map((p) => p.name)).toEqual(['B']);
  });

  it('palette open/close/toggle', () => {
    usePresetStore.getState().togglePalette();
    expect(usePresetStore.getState().paletteOpen).toBe(true);
    usePresetStore.getState().closePalette();
    expect(usePresetStore.getState().paletteOpen).toBe(false);
  });

  it('openManager closes the palette', () => {
    usePresetStore.getState().openPalette();
    usePresetStore.getState().openManager();
    expect(usePresetStore.getState().managerOpen).toBe(true);
    expect(usePresetStore.getState().paletteOpen).toBe(false);
  });
});
