/**
 * Custom `aide-plugin://` protocol — serves plugin HTML from the filesystem.
 *
 * Why: Electron iframes inherit the parent page's CSP.  Both `srcDoc` and
 * blob-URL iframes are blocked by `script-src 'self'`.  A custom protocol
 * gives each plugin its own origin, so inline scripts execute freely.
 *
 * Usage:
 *   1. Call `registerPluginScheme()` at module scope (before app.ready)
 *   2. Call `registerPluginProtocol(cwd)` inside app.on('ready')
 *
 * URL shape: aide-plugin://<pluginId>/index.html
 */
import { protocol } from 'electron';
import * as fs from 'fs';
import { userInfo } from 'os';
import * as path from 'path';
import { getActiveWorkspacePath } from '../ipc/workspace-handlers';

function getHome(): string {
  const env = process.env.HOME;
  if (env && env !== '/') return env;
  try { return userInfo().homedir; } catch { /* ignore */ }
  return '/tmp';
}

/**
 * Scan local + global plugin directories for a plugin matching `pluginId`
 * (by spec.id or spec.name) and return its index.html content.
 */
function findPluginHtml(pluginId: string, fallbackCwd: string): string | null {
  const effectiveCwd = getActiveWorkspacePath() ?? fallbackCwd;
  const dirs = [
    path.join(effectiveCwd, '.aide', 'plugins'),
    path.join(getHome(), '.aide', 'plugins'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pluginDir = path.join(dir, entry.name);
      const specPath = path.join(pluginDir, 'plugin.spec.json');
      if (!fs.existsSync(specPath)) continue;
      try {
        const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
        if (spec.id === pluginId || spec.name === pluginId) {
          const htmlPath = path.join(pluginDir, 'index.html');
          if (fs.existsSync(htmlPath)) return fs.readFileSync(htmlPath, 'utf-8');
          return null;
        }
      } catch { /* skip corrupted spec */ }
    }
  }
  return null;
}

/**
 * Must be called BEFORE app.whenReady() — registers the scheme as privileged
 * so Chromium treats it like https:// (standard URL parsing, secure context).
 */
export function registerPluginScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'aide-plugin',
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ]);
}

/**
 * Must be called AFTER app.whenReady() — installs the request handler.
 */
export function registerPluginProtocol(cwd: string): void {
  protocol.handle('aide-plugin', (request) => {
    const url = new URL(request.url);
    const pluginId = url.hostname;

    const html = findPluginHtml(pluginId, cwd);
    if (!html) {
      return new Response('Plugin not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });
}
