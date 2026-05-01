import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PluginPanel } from '../../src/renderer/components/plugin/PluginPanel';
import { usePluginStore } from '../../src/renderer/stores/plugin-store';

// Regression guard for the inline Generate Plugin form removal
// (chore/remove-plugin-generate-form, PR #139). The form had two text
// inputs ("plugin name", "describe what it does") and a "+ Generate plugin"
// button; if any of these slip back into PluginPanel, this test fails so
// the change is intentional.

beforeEach(() => {
  // Stub window.aide enough for mount + the onChanged listener.
  const onChangedUnsub = vi.fn();
  (globalThis as unknown as { window: { aide: unknown } }).window = {
    ...((globalThis as unknown as { window?: object }).window ?? {}),
    aide: {
      plugin: {
        onChanged: vi.fn().mockReturnValue(onChangedUnsub),
        registry: {
          list: vi.fn().mockResolvedValue([]),
          diff: vi.fn().mockResolvedValue(null),
          modifiedFiles: vi.fn().mockResolvedValue([]),
        },
      },
    },
  } as unknown as typeof window;

  // Reset store to a clean empty state — we don't care about plugin rows here.
  usePluginStore.setState({
    plugins: [],
    loading: false,
    error: null,
    generating: false,
    generateError: null,
    registryDiffs: {},
    registrySummaries: [],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PluginPanel — Generate form is removed (regression guard)', () => {
  it('does not render the "plugin name" input', () => {
    const { queryByPlaceholderText, queryByLabelText } = render(<PluginPanel />);
    expect(queryByPlaceholderText('plugin name')).toBeNull();
    expect(queryByLabelText('Plugin name')).toBeNull();
  });

  it('does not render the "describe what it does" input', () => {
    const { queryByPlaceholderText, queryByLabelText } = render(<PluginPanel />);
    expect(queryByPlaceholderText('describe what it does')).toBeNull();
    expect(queryByLabelText('Plugin description')).toBeNull();
  });

  it('does not render the "+ Generate plugin" button', () => {
    const { queryByText } = render(<PluginPanel />);
    expect(queryByText('+ Generate plugin')).toBeNull();
    expect(queryByText('Generating…')).toBeNull();
  });

  it('still renders the "+ Add from registry" entry button', () => {
    const { getByTestId } = render(<PluginPanel />);
    // Sanity: the panel is alive and the surviving entry control is intact.
    expect(getByTestId('add-from-registry')).not.toBeNull();
  });

  it('empty-state copy no longer references generation', () => {
    const { container, queryByText } = render(<PluginPanel />);
    // With no plugins the empty-state hint should not mention "generate".
    const text = container.textContent ?? '';
    expect(text.toLowerCase()).not.toContain('generate one');
    expect(queryByText(/generate/i)).toBeNull();
  });
});
