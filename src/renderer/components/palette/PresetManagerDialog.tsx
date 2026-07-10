import { useEffect, useState } from 'react';
import { BaseDialog } from '../plugin/registry/dialogs/BaseDialog';
import { usePresetStore } from '../../stores/preset-store';
import { useWorkspaceStore } from '../../stores/workspace-store';

interface EditState {
  id?: string;
  name: string;
  command: string;
  cwd: string;
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

/**
 * Preset manager dialog (ideation doc §5.2): list mode with edit/delete per
 * row, and an inline create/edit form. Opened from the palette's Actions
 * section; `managerCreateRequest` jumps straight into the new-preset form.
 */
export function PresetManagerDialog() {
  const managerOpen = usePresetStore((s) => s.managerOpen);
  const managerCreateRequest = usePresetStore((s) => s.managerCreateRequest);
  const presets = usePresetStore((s) => s.presets);
  const closeManager = usePresetStore((s) => s.closeManager);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const workspacePath = workspaces.find((w) => w.id === activeWorkspaceId)?.path ?? '';
  const [editing, setEditing] = useState<EditState | null>(null);

  // New presets prefill cwd with the current workspace's absolute path
  const newEdit = (): EditState => ({ name: '', command: '', cwd: workspacePath });

  useEffect(() => {
    if (managerOpen) {
      setEditing(managerCreateRequest ? newEdit() : null);
    }
  }, [managerOpen, managerCreateRequest]);

  if (!managerOpen) return null;

  const valid = editing !== null && editing.name.trim() !== '' && editing.command.trim() !== '';

  const save = async () => {
    if (!editing || !valid) return;
    const trimmedCwd = editing.cwd.trim();
    const patch = {
      name: editing.name.trim(),
      command: editing.command.trim(),
      // The untouched prefill (= workspace root) is normalized away so the
      // preset keeps meaning "workspace root" in any workspace.
      cwd: trimmedCwd && trimmedCwd !== workspacePath ? trimmedCwd : undefined,
    };
    if (editing.id) {
      await usePresetStore.getState().updatePreset(editing.id, patch);
    } else {
      await usePresetStore.getState().addPreset(patch);
    }
    setEditing(null);
  };

  const field = (
    label: string,
    testId: string,
    value: string,
    onChange: (value: string) => void,
    placeholder?: string,
  ) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-aide-text-tertiary">{label}</span>
      <input
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="h-9 px-3 rounded-md border border-aide-border bg-aide-background font-mono text-[13px] text-aide-text-primary outline-none focus:border-smalti-cyan"
      />
    </label>
  );

  const listFooter = (
    <button
      data-testid="preset-new"
      onClick={() => setEditing(newEdit())}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-smalti-cyan text-smalti-ink-950 font-mono text-[12px] font-semibold hover:opacity-90 transition-opacity"
    >
      ＋ 새 프리셋
    </button>
  );

  const editFooter = (
    <>
      <button
        data-testid="preset-cancel"
        onClick={() => setEditing(null)}
        className="px-3 py-1.5 rounded-md border border-aide-border font-mono text-[12px] text-aide-text-primary hover:bg-aide-surface transition-colors"
      >
        취소
      </button>
      <button
        data-testid="preset-save"
        onClick={save}
        disabled={!valid}
        className="px-3 py-1.5 rounded-md bg-smalti-cyan text-smalti-ink-950 font-mono text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
      >
        저장
      </button>
    </>
  );

  return (
    <BaseDialog
      open={managerOpen}
      onClose={closeManager}
      title={editing ? (editing.id ? '프리셋 편집' : '새 프리셋') : '프리셋 관리'}
      width={480}
      footer={editing ? editFooter : listFooter}
    >
      {editing ? (
        <div className="flex flex-col gap-3.5">
          {field('Name', 'preset-name-input', editing.name, (name) => setEditing({ ...editing, name }), 'Command name')}
          {field('Command', 'preset-command-input', editing.command, (command) => setEditing({ ...editing, command }), 'shell command (npm run dev...)')}
          {field('Working Directory', 'preset-cwd-input', editing.cwd, (cwd) => setEditing({ ...editing, cwd }), '(워크스페이스 루트)')}
        </div>
      ) : (
        <div className="flex flex-col">
          {presets.length === 0 && (
            <p className="text-[12px] font-mono text-aide-text-tertiary m-0 py-2">
              등록된 프리셋이 없습니다. ＋ 새 프리셋으로 추가하세요.
            </p>
          )}
          {presets.map((p) => (
            <div
              key={p.id}
              data-testid={`preset-row-${p.id}`}
              className="flex items-center gap-3 py-2.5 border-b border-aide-border last:border-b-0"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[13px] font-mono text-aide-text-primary truncate">{p.name}</span>
                <span className="text-[11px] font-mono text-aide-text-tertiary truncate">
                  {p.command}
                  {p.cwd ? ` · ${p.cwd}` : ''}
                </span>
              </div>
              <span className="flex-1" />
              <button
                data-testid={`preset-edit-${p.id}`}
                onClick={() => setEditing({ id: p.id, name: p.name, command: p.command, cwd: p.cwd ?? '' })}
                aria-label={`Edit ${p.name}`}
                className="p-1.5 rounded text-aide-text-tertiary hover:text-aide-text-primary transition-colors"
              >
                <PencilIcon />
              </button>
              <button
                data-testid={`preset-delete-${p.id}`}
                onClick={() => usePresetStore.getState().removePreset(p.id)}
                aria-label={`Delete ${p.name}`}
                className="p-1.5 rounded text-smalti-crimson hover:opacity-80 transition-opacity"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </BaseDialog>
  );
}
