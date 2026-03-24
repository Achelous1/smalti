import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
  sessionId: string;
}

export function TerminalPanel({ sessionId }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize xterm once
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: '#1a1b26',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        selectionBackground: '#3b4261',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const resizeObserver = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Connect to sessionId — re-runs when sessionId changes
  useEffect(() => {
    if (!sessionId || !terminalRef.current) return;

    const terminal = terminalRef.current;
    terminal.clear();

    // Send user input to this session's pty
    const inputDisposable = terminal.onData((data) => {
      window.aide.terminal.write(sessionId, data);
    });

    // Receive output from this session's pty
    const unsubscribe = window.aide.terminal.onData((incomingSessionId, data) => {
      if (incomingSessionId === sessionId) {
        terminal.write(data);
      }
    });

    // Resize pty to match terminal dimensions
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
      window.aide.terminal.resize(sessionId, terminal.cols, terminal.rows);
    }

    return () => {
      inputDisposable.dispose();
      unsubscribe();
    };
  }, [sessionId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    />
  );
}
