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
        // App will quit and relaunch — no need to reset state
      } else {
        await window.aide.updater.download();
        setDownloading(false);
      }
    } catch {
      setDownloading(false);
    }
  };

  const label = downloading
    ? canAutoInstall ? 'Installing...' : 'Downloading...'
    : canAutoInstall ? 'Install & Restart' : 'Download';

  if (collapsed) {
    return (
      <div className="update-notice-enter flex items-center justify-center w-12 h-12 border-t border-aide-border">
        <button
          onClick={handleAction}
          disabled={downloading}
          title={`${canAutoInstall ? 'Install update' : 'Download update'} — ${info.latestTag}`}
          className="w-7 h-7 rounded flex items-center justify-center bg-aide-accent text-aide-terminal-bg hover:opacity-85 transition-opacity disabled:opacity-50"
        >
          ⬇
        </button>
      </div>
    );
  }

  return (
    <div className="update-notice-enter flex items-center gap-2.5 px-3 py-3 border-t border-aide-border bg-aide-surface-sidebar">
      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
        <span className="text-[9px] font-mono font-semibold uppercase tracking-wider text-aide-accent">
          ⬆ Update available
        </span>
        <span className="text-[13px] font-mono font-bold text-aide-text-primary truncate">
          {info.latestTag}
        </span>
      </div>
      <button
        onClick={handleAction}
        disabled={downloading}
        title={`${label} — ${info.latestTag}`}
        className="shrink-0 px-2 h-7 rounded flex items-center justify-center bg-aide-accent text-aide-terminal-bg text-[10px] font-bold font-mono hover:opacity-85 transition-opacity disabled:opacity-50 whitespace-nowrap"
      >
        {downloading ? '...' : '⬇'}
      </button>
    </div>
  );
}
