import { useEffect, useMemo, useRef, useState } from 'react';
import { usePresetStore } from '../../stores/preset-store';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { fuzzyFilter, fuzzyMatch } from '../../utils/fuzzy-match';
import { resolvePresetCwd } from '../../utils/preset-cwd';
import { spawnTabInBackground } from '../../lib/spawn-tab';
import type { CommandPreset } from '../../../types/ipc';

interface AgentEntry {
  id: string;
  label: string;
  command?: string;
  dotColor: string;
  type: 'agent' | 'shell';
}

const AGENT_ENTRIES: AgentEntry[] = [
  { id: 'claude', label: 'claude', command: 'claude', dotColor: 'var(--agent-claude)', type: 'agent' },
  { id: 'gemini', label: 'gemini', command: 'gemini', dotColor: 'var(--agent-gemini)', type: 'agent' },
  { id: 'codex', label: 'codex', command: 'codex', dotColor: 'var(--agent-codex)', type: 'agent' },
  { id: 'shell', label: '$ shell', dotColor: 'var(--text-tertiary)', type: 'shell' },
];

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function EnterIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

interface Selectable {
  testId: string;
  run: () => void;
}

/**
 * ⌘P command preset palette (UI-SPEC ideation doc §5.1).
 * Lists user command presets, built-in new-tab entries, and preset
 * management actions. Enter opens the selection as a new tab in the
 * focused pane via the shared spawnTabInBackground path.
 */
export function CommandPalette() {
  const paletteOpen = usePresetStore((s) => s.paletteOpen);
  const presets = usePresetStore((s) => s.presets);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (paletteOpen) {
      setQuery('');
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [paletteOpen]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const visiblePresets = useMemo(
    () => fuzzyFilter(presets, query, (p) => [p.name, p.command]),
    [presets, query],
  );
  const visibleAgents = useMemo(
    () => (query ? AGENT_ENTRIES.filter((a) => fuzzyMatch(a.label, query) !== null) : AGENT_ENTRIES),
    [query],
  );

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const closePalette = usePresetStore((s) => s.closePalette);

  const runPreset = (preset: CommandPreset) => {
    if (!workspace) return;
    const cwd = resolvePresetCwd(preset.cwd, workspace.path);
    spawnTabInBackground(
      { id: crypto.randomUUID(), type: 'shell', presetId: preset.id, title: preset.name },
      undefined,
      { command: preset.command, cwd },
    );
    closePalette();
  };

  const runAgent = (entry: AgentEntry) => {
    if (!workspace) return;
    spawnTabInBackground(
      {
        id: crypto.randomUUID(),
        type: entry.type,
        agentId: entry.type === 'agent' ? entry.id : undefined,
        title: entry.label,
      },
      undefined,
      entry.command ? { shell: entry.command, cwd: workspace.path } : { cwd: workspace.path },
    );
    closePalette();
  };

  const openManager = usePresetStore((s) => s.openManager);

  const selectables: Selectable[] = useMemo(() => {
    const list: Selectable[] = [];
    for (const p of visiblePresets) {
      list.push({ testId: `palette-item-preset-${p.id}`, run: () => runPreset(p) });
    }
    for (const a of visibleAgents) {
      list.push({
        testId: a.id === 'shell' ? 'palette-item-shell' : `palette-item-agent-${a.id}`,
        run: () => runAgent(a),
      });
    }
    list.push({ testId: 'palette-action-add', run: () => openManager(true) });
    list.push({ testId: 'palette-action-manage', run: () => openManager() });
    return list;
  }, [visiblePresets, visibleAgents, workspace]);

  if (!paletteOpen) return null;

  const indexOf = (testId: string) => selectables.findIndex((s) => s.testId === testId);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePalette();
      return;
    }
    if (selectables.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => (i + 1) % selectables.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => (i - 1 + selectables.length) % selectables.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectables[Math.min(selected, selectables.length - 1)]?.run();
    }
  };

  const row = (
    testId: string,
    content: React.ReactNode,
    onRun: () => void,
  ) => {
    const idx = indexOf(testId);
    const isSelected = idx === selected;
    return (
      <button
        key={testId}
        data-testid={testId}
        onClick={onRun}
        onMouseEnter={() => setSelected(idx)}
        className={`relative w-full flex items-center gap-2.5 px-3.5 font-mono text-left transition-colors ${
          isSelected ? 'bg-smalti-cyan/10' : 'hover:bg-smalti-surface'
        }`}
        style={{ height: '36px' }}
      >
        {isSelected && <span className="absolute left-0 top-0 h-full w-[3px] bg-smalti-cyan" aria-hidden="true" />}
        {content}
        {isSelected && (
          <span className="text-smalti-ink-muted shrink-0">
            <EnterIcon />
          </span>
        )}
      </button>
    );
  };

  const sectionLabel = (text: string) => (
    <div className="px-3.5 pt-2 pb-1 text-[11px] font-mono uppercase tracking-[0.08em] text-smalti-ink-muted">
      {text}
    </div>
  );

  return (
    <div data-testid="command-palette" className="fixed inset-0 z-50" onClick={closePalette}>
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command preset palette"
        className="absolute left-1/2 -translate-x-1/2 w-[560px] max-h-[420px] flex flex-col overflow-hidden rounded-[10px] border border-smalti-divider bg-smalti-raised shadow-2xl"
        style={{ top: '12%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search row */}
        <div className="flex items-center gap-2.5 px-3.5 border-b border-smalti-divider shrink-0 text-smalti-ink-muted" style={{ height: '44px' }}>
          <SearchIcon />
          <input
            ref={inputRef}
            data-testid="palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="프리셋 검색…"
            className="flex-1 bg-transparent outline-none font-mono text-[14px] text-smalti-ink-body placeholder:text-smalti-ink-muted"
            spellCheck={false}
          />
          <span className="text-[10px] font-mono border border-smalti-divider rounded px-1.5 py-0.5">esc</span>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto py-1.5">
          {visiblePresets.length > 0 && sectionLabel('Presets')}
          {visiblePresets.map((p) =>
            row(
              `palette-item-preset-${p.id}`,
              <>
                <span className="text-smalti-cyan text-[12px] shrink-0" aria-hidden="true">&gt;_</span>
                <span className="text-[13px] text-smalti-ink-body">{p.name}</span>
                <span className="flex-1" />
                <span className="text-[12px] text-smalti-ink-muted truncate max-w-[180px]">{p.command}</span>
              </>,
              () => runPreset(p),
            ),
          )}
          {visiblePresets.length === 0 && query && (
            <div data-testid="palette-empty" className="px-3.5 py-2 text-[12px] font-mono text-smalti-ink-muted">
              일치하는 프리셋이 없습니다
            </div>
          )}

          {visibleAgents.length > 0 && sectionLabel('New Tab')}
          {visibleAgents.map((a) =>
            row(
              a.id === 'shell' ? 'palette-item-shell' : `palette-item-agent-${a.id}`,
              <>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: a.dotColor }} />
                <span className="text-[13px] text-smalti-ink-body">{a.label}</span>
              </>,
              () => runAgent(a),
            ),
          )}

          {sectionLabel('Actions')}
          {row(
            'palette-action-add',
            <span className="text-[13px] text-smalti-cyan">＋ 프리셋 추가…</span>,
            () => openManager(true),
          )}
          {row(
            'palette-action-manage',
            <span className="text-[13px] text-smalti-ink-body">⚙ 프리셋 관리…</span>,
            () => openManager(),
          )}
        </div>

        {/* Hint bar */}
        <div className="flex items-center gap-3.5 px-3.5 border-t border-smalti-divider text-[11px] font-mono text-smalti-ink-muted shrink-0" style={{ height: '28px' }}>
          <span>↑↓ 이동</span>
          <span className="flex items-center gap-1"><EnterIcon size={11} /> 열기</span>
          <span>esc 닫기</span>
        </div>
      </div>
    </div>
  );
}
