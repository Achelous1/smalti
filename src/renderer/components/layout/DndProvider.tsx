import { type ReactNode, useState, useCallback } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { useLayoutStore } from '../../stores/layout-store';
import type { TerminalTab } from '../../../types/ipc';

const AGENT_COLORS: Record<string, string> = {
  claude: 'var(--agent-claude)',
  gemini: 'var(--agent-gemini)',
  codex: 'var(--agent-codex)',
  shell: 'var(--text-tertiary)',
};

interface DndProviderProps {
  children: ReactNode;
}

export function DndProvider({ children }: DndProviderProps) {
  const [draggingTab, setDraggingTab] = useState<{ tab: TerminalTab; sourcePaneId: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.tab && data?.paneId) {
      setDraggingTab({ tab: data.tab as TerminalTab, sourcePaneId: data.paneId as string });
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingTab(null);

    if (!over || !draggingTab) return;

    const sourceData = active.data.current;
    const overData = over.data.current;
    if (!sourceData) return;

    const sourcePaneId = sourceData.paneId as string;

    // Dropped on a pane drop zone (cross-pane move)
    if (overData?.paneId && overData.paneId !== sourcePaneId) {
      useLayoutStore.getState().moveTab(sourcePaneId, overData.paneId as string, active.id as string);
      return;
    }

    // Dropped on a tab in the same pane (reorder)
    if (overData?.paneId === sourcePaneId && active.id !== over.id) {
      const pane = useLayoutStore.getState().getAllPanes().find((p) => p.id === sourcePaneId);
      if (pane) {
        const oldIndex = pane.tabs.findIndex((t) => t.id === active.id);
        const newIndex = pane.tabs.findIndex((t) => t.id === over.id);
        if (oldIndex >= 0 && newIndex >= 0) {
          useLayoutStore.getState().reorderTab(sourcePaneId, oldIndex, newIndex);
        }
      }
    }
  }, [draggingTab]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {children}
      <DragOverlay>
        {draggingTab && (
          <div
            className="flex items-center gap-1.5 px-3 h-8 text-[12px] font-mono text-aide-text-primary"
            style={{
              opacity: 0.92,
              border: '1px solid #3B82F6',
              borderRadius: 6,
              background: 'var(--surface-elevated)',
            }}
          >
            {draggingTab.tab.type === 'plugin' ? (
              <span style={{ color: 'var(--accent)' }}>◈</span>
            ) : (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: AGENT_COLORS[draggingTab.tab.agentId ?? 'shell'] ?? AGENT_COLORS.shell }}
              />
            )}
            <span>{draggingTab.tab.title}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
