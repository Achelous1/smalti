import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import { PresetManagerDialog } from '../../src/renderer/components/palette/PresetManagerDialog';
import { usePresetStore } from '../../src/renderer/stores/preset-store';
import { useWorkspaceStore } from '../../src/renderer/stores/workspace-store';
import type { CommandPreset } from '../../src/types/ipc';

const savedPresets: { value: CommandPreset[] } = { value: [] };

afterEach(() => cleanup());

beforeEach(() => {
  savedPresets.value = [];
  (window as unknown as { aide: unknown }).aide = {
    appSettings: {
      get: async () => ({ theme: 'dark', windowBounds: null, commandPresets: savedPresets.value }),
      set: async (_key: string, value: unknown) => {
        savedPresets.value = value as CommandPreset[];
      },
    },
  };
  useWorkspaceStore.setState({
    activeWorkspaceId: 'ws1',
    workspaces: [{ id: 'ws1', name: 'aide', path: '/repo/aide', color: '#fff', lastOpened: 0 }],
  });
  usePresetStore.setState({
    presets: [
      { id: 'p1', name: 'LazyGit', command: 'lazygit' },
      { id: 'p2', name: 'Dev Server', command: 'npm run dev', cwd: 'web' },
    ],
    paletteOpen: false,
    managerOpen: true,
    managerCreateRequest: false,
  });
});

describe('PresetManagerDialog', () => {
  it('renders nothing when closed', () => {
    usePresetStore.setState({ managerOpen: false });
    const { queryByTestId } = render(<PresetManagerDialog />);
    expect(queryByTestId('preset-row-p1')).toBeNull();
  });

  it('lists presets with name and command', () => {
    const { getByTestId } = render(<PresetManagerDialog />);
    expect(getByTestId('preset-row-p1').textContent).toContain('LazyGit');
    expect(getByTestId('preset-row-p1').textContent).toContain('lazygit');
    expect(getByTestId('preset-row-p2').textContent).toContain('npm run dev');
  });

  it('creates a preset through the new-preset form', async () => {
    const { getByTestId } = render(<PresetManagerDialog />);
    fireEvent.click(getByTestId('preset-new'));

    const save = getByTestId('preset-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(getByTestId('preset-name-input'), { target: { value: 'Htop' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(getByTestId('preset-command-input'), { target: { value: 'htop' } });
    expect(save.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(save);
    });
    await waitFor(() => {
      expect(usePresetStore.getState().presets.map((p) => p.name)).toContain('Htop');
      expect(savedPresets.value.map((p) => p.name)).toContain('Htop');
    });
    // Untouched prefilled cwd (= workspace root) is normalized away so the
    // preset stays portable across workspaces.
    const htop = usePresetStore.getState().presets.find((p) => p.name === 'Htop');
    expect(htop?.cwd).toBeUndefined();
  });

  it('prefills working directory with the workspace absolute path in the new-preset form', () => {
    const { getByTestId } = render(<PresetManagerDialog />);
    fireEvent.click(getByTestId('preset-new'));
    const cwd = getByTestId('preset-cwd-input') as HTMLInputElement;
    expect(cwd.value).toBe('/repo/aide');
  });

  it('keeps an edited absolute working directory on save', async () => {
    const { getByTestId } = render(<PresetManagerDialog />);
    fireEvent.click(getByTestId('preset-new'));
    fireEvent.change(getByTestId('preset-name-input'), { target: { value: 'Logs' } });
    fireEvent.change(getByTestId('preset-command-input'), { target: { value: 'tail -f app.log' } });
    fireEvent.change(getByTestId('preset-cwd-input'), { target: { value: '/var/log' } });
    await act(async () => {
      fireEvent.click(getByTestId('preset-save'));
    });
    await waitFor(() => {
      const logs = usePresetStore.getState().presets.find((p) => p.name === 'Logs');
      expect(logs?.cwd).toBe('/var/log');
    });
  });

  it('uses descriptive english placeholders for name and command', () => {
    const { getByTestId } = render(<PresetManagerDialog />);
    fireEvent.click(getByTestId('preset-new'));
    expect((getByTestId('preset-name-input') as HTMLInputElement).placeholder).toBe('Command name');
    expect((getByTestId('preset-command-input') as HTMLInputElement).placeholder).toBe('shell command (npm run dev...)');
  });

  it('edits an existing preset with prefilled values', async () => {
    const { getByTestId } = render(<PresetManagerDialog />);
    fireEvent.click(getByTestId('preset-edit-p2'));

    const name = getByTestId('preset-name-input') as HTMLInputElement;
    const command = getByTestId('preset-command-input') as HTMLInputElement;
    const cwd = getByTestId('preset-cwd-input') as HTMLInputElement;
    expect(name.value).toBe('Dev Server');
    expect(command.value).toBe('npm run dev');
    expect(cwd.value).toBe('web');

    fireEvent.change(name, { target: { value: 'Web Dev Server' } });
    await act(async () => {
      fireEvent.click(getByTestId('preset-save'));
    });
    await waitFor(() => {
      const p2 = usePresetStore.getState().presets.find((p) => p.id === 'p2');
      expect(p2).toMatchObject({ name: 'Web Dev Server', command: 'npm run dev', cwd: 'web' });
    });
  });

  it('deletes a preset from its row', async () => {
    const { getByTestId } = render(<PresetManagerDialog />);
    await act(async () => {
      fireEvent.click(getByTestId('preset-delete-p1'));
    });
    await waitFor(() => {
      expect(usePresetStore.getState().presets.map((p) => p.id)).toEqual(['p2']);
    });
  });

  it('cancel returns from the form to the list without saving', () => {
    const { getByTestId, queryByTestId } = render(<PresetManagerDialog />);
    fireEvent.click(getByTestId('preset-new'));
    fireEvent.change(getByTestId('preset-name-input'), { target: { value: 'X' } });
    fireEvent.click(getByTestId('preset-cancel'));
    expect(queryByTestId('preset-name-input')).toBeNull();
    expect(getByTestId('preset-row-p1')).toBeTruthy();
    expect(usePresetStore.getState().presets).toHaveLength(2);
  });

  it('opens directly in create mode when requested from the palette', () => {
    usePresetStore.setState({ managerOpen: true, managerCreateRequest: true });
    const { getByTestId } = render(<PresetManagerDialog />);
    expect(getByTestId('preset-name-input')).toBeTruthy();
  });
});
