interface PluginViewProps {
  pluginId: string;
  pluginName: string;
}

export function PluginView({ pluginId, pluginName }: PluginViewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-aide-surface-sidebar text-aide-text-secondary gap-4 p-8">
      <span className="text-[24px]" style={{ color: 'var(--accent)' }}>◈</span>
      <span className="text-[16px] font-semibold text-aide-text-primary">{pluginName}</span>
      <span className="text-[13px] text-center max-w-xs">
        This plugin runs in the background. Manage it from the Plugins panel.
      </span>
      <div className="flex items-center gap-2 text-[11px] font-mono text-aide-text-tertiary">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span>Active — {pluginId}</span>
      </div>
    </div>
  );
}
