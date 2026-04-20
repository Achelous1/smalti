import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { Tooltip } from '../../src/renderer/components/ui/Tooltip';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Tooltip', () => {
  it('renders children always', () => {
    const { getByText } = render(
      <Tooltip content="tip text">
        <button>child</button>
      </Tooltip>
    );
    expect(getByText('child')).toBeTruthy();
  });

  it('tooltip is not in DOM initially', () => {
    const { queryByRole } = render(
      <Tooltip content="tip text">
        <button>child</button>
      </Tooltip>
    );
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('shows tooltip with content after mouseenter + delay', async () => {
    const { getByText, queryByRole } = render(
      <Tooltip content="tip text">
        <button>child</button>
      </Tooltip>
    );
    const wrapper = getByText('child').closest('[data-tooltip-wrapper]') as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    // before delay: still hidden
    expect(queryByRole('tooltip')).toBeNull();
    // advance past 200ms delay
    act(() => { vi.advanceTimersByTime(250); });
    expect(queryByRole('tooltip')).toBeTruthy();
    expect(queryByRole('tooltip')?.textContent).toBe('tip text');
  });

  it('hides tooltip after mouseleave', async () => {
    const { getByText, queryByRole } = render(
      <Tooltip content="tip text">
        <button>child</button>
      </Tooltip>
    );
    const wrapper = getByText('child').closest('[data-tooltip-wrapper]') as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    act(() => { vi.advanceTimersByTime(250); });
    expect(queryByRole('tooltip')).toBeTruthy();

    fireEvent.mouseLeave(wrapper);
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('shows tooltip on focus (keyboard a11y)', () => {
    const { getByText, queryByRole } = render(
      <Tooltip content="focus tip">
        <button>child</button>
      </Tooltip>
    );
    const wrapper = getByText('child').closest('[data-tooltip-wrapper]') as HTMLElement;
    fireEvent.focus(wrapper);
    act(() => { vi.advanceTimersByTime(250); });
    expect(queryByRole('tooltip')).toBeTruthy();
  });

  it('hides tooltip on blur', () => {
    const { getByText, queryByRole } = render(
      <Tooltip content="focus tip">
        <button>child</button>
      </Tooltip>
    );
    const wrapper = getByText('child').closest('[data-tooltip-wrapper]') as HTMLElement;
    fireEvent.focus(wrapper);
    act(() => { vi.advanceTimersByTime(250); });
    expect(queryByRole('tooltip')).toBeTruthy();

    fireEvent.blur(wrapper);
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('sets aria-describedby on wrapper pointing to tooltip when open', () => {
    const { getByText } = render(
      <Tooltip content="aria tip">
        <button>child</button>
      </Tooltip>
    );
    const wrapper = getByText('child').closest('[data-tooltip-wrapper]') as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    act(() => { vi.advanceTimersByTime(250); });
    const tooltipEl = wrapper.querySelector('[role="tooltip"]') as HTMLElement;
    expect(tooltipEl).toBeTruthy();
    expect(wrapper.getAttribute('aria-describedby')).toBe(tooltipEl.id);
  });
});
