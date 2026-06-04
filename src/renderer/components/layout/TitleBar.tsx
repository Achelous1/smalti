import { useThemeStore } from '../../stores/theme-store';

export function TitleBar() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDarwin = window.aide.system.isDarwin();

  return (
    <div
      className="relative flex items-center w-full shrink-0 bg-aide-surface border-b border-aide-border"
      style={{ height: '40px', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left padding: macOS reserves space for native traffic lights (hiddenInset).
          Windows/Linux render system buttons on the right via titleBarOverlay. */}
      <div className={isDarwin ? 'w-20 shrink-0' : 'w-3 shrink-0'} />

      {/* Centered title */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[13px] font-bold font-mono text-aide-accent">&gt; smalti</span>
      </div>

      {/* Right side: theme toggle. On Windows/Linux, leave room for the native
          min/max/close buttons overlaid by titleBarOverlay (~138px wide). */}
      <div className={`ml-auto flex items-center ${isDarwin ? 'pr-3' : 'pr-[150px]'}`}>
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="flex items-center justify-center w-7 h-7 rounded-md text-aide-text-secondary hover:text-aide-text-primary hover:bg-aide-border transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
