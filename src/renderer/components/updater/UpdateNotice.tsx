import { useEffect, useState } from 'react';
import type { UpdateInfo } from '../../../types/ipc';

interface Props {
  collapsed?: boolean;
}

export function UpdateNotice({ collapsed = false }: Props) {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    window.aide.updater.getInfo().then(setInfo);
    return window.aide.updater.onChanged(setInfo);
  }, []);

  if (!info?.hasUpdate) return null;

  const canAutoInstall = !!info.zipDownloadUrl;

  const handleAction = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      if (canAutoInstall) {
        await window.aide.updater.install();
      } else {
        await window.aide.updater.download();
        setDownloading(false);
      }
    } catch {
      setDownloading(false);
    }
  };

  if (collapsed) {
    return (
      <div className="shrink-0 flex items-center justify-center w-full border-t border-aide-border pt-2">
        <button
          onClick={handleAction}
          disabled={downloading}
          title={`${canAutoInstall ? 'Install update' : 'Download update'} — ${info.latestTag}`}
          className="w-7 h-7 rounded-[6px] flex items-center justify-center bg-aide-accent text-aide-terminal-bg hover:opacity-85 transition-opacity disabled:opacity-50 text-[11px]"
        >
          ↑
        </button>
      </div>
    );
  }

  const currentLabel = `v${info.currentVersion}`;
  const nextLabel = info.latestTag.startsWith('v') ? info.latestTag : `v${info.latestTag}`;
  const actionLabel = downloading
    ? canAutoInstall ? 'Installing…' : 'Downloading…'
    : canAutoInstall ? 'Install & Restart' : 'Download';

  return (
    <div className="shrink-0 border-t border-aide-border bg-aide-surface-sidebar">
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2">
        {/* Header row */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono font-semibold uppercase tracking-wider text-aide-accent leading-none">
            ↑ Update available
          </span>
        </div>

        {/* Version transition */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-aide-text-tertiary">{currentLabel}</span>
          <span className="text-[10px] text-aide-text-tertiary">→</span>
          <span className="text-[11px] font-mono font-bold text-aide-text-primary">{nextLabel}</span>
        </div>

        {/* Action button */}
        <button
          onClick={handleAction}
          disabled={downloading}
          className="w-full h-7 rounded flex items-center justify-center bg-aide-accent text-aide-terminal-bg text-[11px] font-bold font-mono hover:opacity-85 transition-opacity disabled:opacity-60 whitespace-nowrap"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
