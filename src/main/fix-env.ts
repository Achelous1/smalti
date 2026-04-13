import { app } from 'electron';
import { execSync } from 'child_process';
import { userInfo } from 'os';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Packaged Electron apps on macOS launched from Finder don't inherit
 * the user's shell environment (PATH, SHELL, etc.).
 * This loads the login shell env so CLI tools (claude, zsh, etc.) are found.
 */
export function fixPackagedEnv(): void {
  if (!app.isPackaged || process.platform === 'win32') return;

  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const output = execSync(`${shell} -ilc 'env'`, {
      encoding: 'utf-8',
      timeout: 5000,
    });

    for (const line of output.split('\n')) {
      const idx = line.indexOf('=');
      if (idx <= 0) continue;
      const key = line.slice(0, idx);
      const value = line.slice(idx + 1);
      // PATH and HOME always override — Finder sets HOME=/ and PATH is minimal.
      // Other vars: set only if not already present.
      if (key === 'PATH' || key === 'HOME' || !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Fallback: ensure minimal PATH + try to detect nvm's default node
    const homedir = (() => { try { return userInfo().homedir; } catch { return process.env.HOME || '/'; } })();
    let extraPaths = '/usr/local/bin:/opt/homebrew/bin';

    // Try to find nvm's current default node binary
    try {
      const nvmDir = process.env.NVM_DIR || path.join(homedir, '.nvm');
      const defaultAlias = path.join(nvmDir, 'alias', 'default');
      if (fs.existsSync(defaultAlias)) {
        let version = fs.readFileSync(defaultAlias, 'utf-8').trim();
        if (version.includes('/')) version = path.basename(version);
        const nvmNodeBin = path.join(nvmDir, 'versions', 'node', version, 'bin');
        if (fs.existsSync(nvmNodeBin)) {
          extraPaths = `${nvmNodeBin}:${extraPaths}`;
        }
      }
    } catch { /* ignore nvm detection errors */ }

    if (!process.env.PATH?.includes('/usr/local/bin')) {
      process.env.PATH = `${extraPaths}:${process.env.PATH || '/usr/bin:/bin'}`;
    }
  }

  // Final safety net: Finder may set HOME=/ and the shell may not correct it.
  // os.userInfo().homedir uses getpwuid() which is always reliable.
  if (!process.env.HOME || process.env.HOME === '/') {
    try {
      process.env.HOME = userInfo().homedir;
    } catch { /* ignore */ }
  }
}
