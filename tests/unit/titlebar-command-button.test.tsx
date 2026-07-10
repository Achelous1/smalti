import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { TitleBar } from '../../src/renderer/components/layout/TitleBar';
import { usePresetStore } from '../../src/renderer/stores/preset-store';

afterEach(() => cleanup());

beforeEach(() => {
  (window as unknown as { aide: unknown }).aide = {
    system: { isDarwin: () => true },
  };
  usePresetStore.setState({ paletteOpen: false, managerOpen: false });
});

describe('TitleBar command palette button', () => {
  it('renders a command button left of the theme toggle', () => {
    const { getByTestId } = render(<TitleBar />);
    const commandBtn = getByTestId('titlebar-command-button');
    const themeBtn = getByTestId('titlebar-theme-button');
    // Same right-side container, command button comes first (left of theme toggle)
    expect(commandBtn.parentElement).toBe(themeBtn.parentElement);
    const siblings = Array.from(commandBtn.parentElement!.children);
    expect(siblings.indexOf(commandBtn)).toBeLessThan(siblings.indexOf(themeBtn));
  });

  it('opens the command palette on click', () => {
    const { getByTestId } = render(<TitleBar />);
    fireEvent.click(getByTestId('titlebar-command-button'));
    expect(usePresetStore.getState().paletteOpen).toBe(true);
  });
});
