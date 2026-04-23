#!/usr/bin/env node
/**
 * Cross-platform build script for the aide-napi native module.
 *
 * Prepends $HOME/.cargo/bin to PATH so rustup's toolchain takes priority
 * over any system-installed rustc (e.g. Homebrew rustc 1.74 on macOS).
 *
 * Exits with a clear error message when cargo / rustc is not found.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cargoBin = join(homedir(), '.cargo', 'bin');
const pathSep = process.platform === 'win32' ? ';' : ':';
const env = {
  ...process.env,
  PATH: `${cargoBin}${pathSep}${process.env.PATH ?? ''}`,
};

// Verify cargo is available before attempting build
function which(cmd) {
  try {
    execSync(
      process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`,
      { env, stdio: 'ignore' }
    );
    return true;
  } catch {
    return false;
  }
}

if (!which('cargo')) {
  console.error(
    '\nError: cargo not found. Rust toolchain is required to build the native module.\n' +
      'Install rustup (https://rustup.rs/):\n' +
      '  curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh\n' +
      'Then restart your terminal and run `pnpm install` again.\n'
  );
  process.exit(1);
}

const napiCmd = [
  'napi build',
  '--platform',
  '--release',
  '--js false',
  '--output-dir src/main/native',
  '--manifest-path crates/aide-napi/Cargo.toml',
].join(' ');

console.log(`[build:native] ${napiCmd}`);

execSync(napiCmd, { env, stdio: 'inherit' });
