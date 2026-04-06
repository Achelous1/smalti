import type { AgentStatus } from '../../types/ipc';

type StatusCallback = (sessionId: string, status: AgentStatus) => void;

/**
 * Agents don't emit clean shell prompts — they use box-drawing UI.
 * Instead of regex-matching prompt characters, we use a quiet-period heuristic:
 *   - Any output chunk → processing
 *   - No output for IDLE_QUIET_MS → idle
 *   - Question patterns in output → awaiting-input (overrides processing)
 */
const IDLE_QUIET_MS = 1500;

export class AgentStatusDetector {
  private statuses = new Map<string, AgentStatus>();
  private idleTimers = new Map<string, NodeJS.Timeout>();
  private callback: StatusCallback;

  constructor(callback: StatusCallback) {
    this.callback = callback;
  }

  feed(sessionId: string, data: string): void {
    // Strip ANSI escape codes before pattern matching
    // eslint-disable-next-line no-control-regex
    const clean = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
    if (!clean) return;

    // Question patterns → awaiting-input (takes precedence over processing)
    if (/\?\s*$/.test(clean) || /\[Y\/n\]/i.test(clean) || /\(y\/n\)/i.test(clean)) {
      this.clearIdleTimer(sessionId);
      this.setStatus(sessionId, 'awaiting-input');
      return;
    }

    // Any output → processing, then schedule transition to idle after quiet period
    this.setStatus(sessionId, 'processing');
    this.scheduleIdle(sessionId);
  }

  private scheduleIdle(sessionId: string): void {
    this.clearIdleTimer(sessionId);
    const timer = setTimeout(() => {
      this.idleTimers.delete(sessionId);
      this.setStatus(sessionId, 'idle');
    }, IDLE_QUIET_MS);
    this.idleTimers.set(sessionId, timer);
  }

  private clearIdleTimer(sessionId: string): void {
    const timer = this.idleTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(sessionId);
    }
  }

  private setStatus(sessionId: string, status: AgentStatus): void {
    const current = this.statuses.get(sessionId);
    if (current !== status) {
      this.statuses.set(sessionId, status);
      this.callback(sessionId, status);
    }
  }

  remove(sessionId: string): void {
    this.clearIdleTimer(sessionId);
    this.statuses.delete(sessionId);
  }
}
