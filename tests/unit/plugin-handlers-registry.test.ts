/**
 * Integration tests for plugin registry IPC handlers.
 *
 * Strategy: extract the handler logic into helpers that mirror what
 * registerPluginHandlers wires up, then test them directly against a real
 * sandbox filesystem + _setRegistryRootForTesting.
 *
 * We do NOT invoke Electron's ipcMain — instead we call the backing functions
 * that would be invoked by each ipcMain.handle callback.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  pushPlugin,
  pullPlugin,
  listPlugins,
  diffPlugin,
  removePlugin,
  getPluginMeta,
  _setRegistryRootForTesting,
} from '../../src/main/plugin/registry-global';
import { generatePluginSpec } from '../../src/main/plugin/spec-generator';
import type { PluginSpec } from '../../src/main/plugin/spec-generator';

// ---------------------------------------------------------------------------
// Sandbox helpers
// ---------------------------------------------------------------------------

let sandbox: string;
let workspacePluginsDir: string;

function mkSandbox(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aide-handlers-registry-'));
}

function makeWorkspacePlugin(name: string, spec?: Partial<PluginSpec>): { pluginDir: string; spec: PluginSpec } {
  const pluginDir = path.join(workspacePluginsDir, name);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'index.js'), `// ${name}\nexports.run = () => {};`);

  const fullSpec: PluginSpec = {
    id: spec?.id ?? `plugin-${name.replace(/[^a-z0-9]/g, '')}`,
    name,
    description: spec?.description ?? `${name} plugin`,
    version: spec?.version ?? '0.1.0',
    permissions: [],
    entryPoint: 'src/index.js',
    dependencies: {},
    tools: [],
    ...spec,
  };
  fs.writeFileSync(path.join(pluginDir, 'plugin.spec.json'), JSON.stringify(fullSpec, null, 2));
  return { pluginDir, spec: fullSpec };
}

function readSpec(pluginDir: string): PluginSpec {
  return JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.spec.json'), 'utf-8')) as PluginSpec;
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  sandbox = mkSandbox();
  workspacePluginsDir = path.join(sandbox, 'workspace', '.smalti', 'plugins');
  fs.mkdirSync(workspacePluginsDir, { recursive: true });
  _setRegistryRootForTesting(path.join(sandbox, 'registry'));
});

afterEach(() => {
  _setRegistryRootForTesting(null);
  fs.rmSync(sandbox, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: simulate what PLUGIN_GENERATE does (auto-push path)
// ---------------------------------------------------------------------------

function simulatePluginGenerate(
  name: string,
  description: string,
): { spec: PluginSpec; pluginDir: string } {
  const spec = generatePluginSpec(name, description);
  const pluginDir = path.join(workspacePluginsDir, spec.name);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'index.js'), `// ${name}\nexports.run = () => {};`);
  fs.writeFileSync(path.join(pluginDir, 'plugin.spec.json'), JSON.stringify(spec, null, 2));

  // Auto-push (mirrors plugin-handlers.ts logic)
  try {
    const pushed = pushPlugin(pluginDir, {
      id: spec.id,
      name: spec.name,
      description: spec.description,
      version: spec.version,
    });
    spec.source = {
      registryId: spec.id,
      installedVersion: pushed.version,
      installedContentHash: pushed.contentHash,
    };
    fs.writeFileSync(path.join(pluginDir, 'plugin.spec.json'), JSON.stringify(spec, null, 2));
  } catch (err) {
    console.error('[test] auto-push failed:', err);
  }

  return { spec, pluginDir };
}

// ---------------------------------------------------------------------------
// Helper: simulate PLUGIN_REGISTRY_DIFF handler logic
// ---------------------------------------------------------------------------

function handleRegistryDiff(pluginName: string): ReturnType<typeof diffPlugin> | null {
  const pluginDir = path.join(workspacePluginsDir, pluginName);
  if (!fs.existsSync(pluginDir)) return null;
  const specPath = path.join(pluginDir, 'plugin.spec.json');
  if (!fs.existsSync(specPath)) return null;
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8')) as PluginSpec;
  if (!spec.source) return null;
  return diffPlugin(spec.source.registryId, pluginDir, {
    installedVersion: spec.source.installedVersion,
    installedContentHash: spec.source.installedContentHash,
  });
}

// ---------------------------------------------------------------------------
// Helper: simulate PLUGIN_REGISTRY_PULL handler logic
// ---------------------------------------------------------------------------

function handleRegistryPull(
  registryId: string,
  version?: string,
  targetName?: string,
): { ok: true; pluginPath: string; contentHash: string } | { ok: false; reason?: string; error?: string } {
  try {
    const meta = getPluginMeta(registryId);
    if (!meta) return { ok: false, reason: 'not-found' };
    const resolvedVersion = version ?? meta.latest;
    const dirName = targetName ?? meta.name;
    const destDir = path.join(workspacePluginsDir, dirName);

    if (fs.existsSync(destDir)) {
      return { ok: false, reason: 'name-conflict' };
    }

    fs.mkdirSync(destDir, { recursive: true });
    const { contentHash } = pullPlugin(registryId, resolvedVersion, destDir);

    const specPath = path.join(destDir, 'plugin.spec.json');
    if (fs.existsSync(specPath)) {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8')) as PluginSpec;
      spec.source = {
        registryId,
        installedVersion: resolvedVersion,
        installedContentHash: contentHash,
      };
      fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
    }

    return { ok: true, pluginPath: destDir, contentHash };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Helper: simulate PLUGIN_REGISTRY_PUSH handler logic
// ---------------------------------------------------------------------------

function handleRegistryPush(
  pluginName: string,
  opts?: { bumpPatch?: boolean },
): { ok: true; version: string; contentHash: string } | { ok: false; error?: string } {
  try {
    const pluginDir = path.join(workspacePluginsDir, pluginName);
    const specPath = path.join(pluginDir, 'plugin.spec.json');
    if (!fs.existsSync(specPath)) return { ok: false, error: 'plugin not found' };
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8')) as PluginSpec;

    let version = spec.version;
    if (opts?.bumpPatch) {
      const parts = version.split('.').map(Number);
      parts[2] = (parts[2] ?? 0) + 1;
      version = parts.join('.');
      spec.version = version;
    }

    const pushed = pushPlugin(pluginDir, {
      id: spec.id,
      name: spec.name,
      description: spec.description,
      version,
    });

    spec.source = {
      registryId: spec.id,
      installedVersion: pushed.version,
      installedContentHash: pushed.contentHash,
    };
    fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));

    return { ok: true, version: pushed.version, contentHash: pushed.contentHash };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('plugin-handlers registry integration', () => {
  // -------------------------------------------------------------------------
  // 1. PLUGIN_GENERATE auto-push (success)
  // -------------------------------------------------------------------------
  it('PLUGIN_GENERATE auto-push succeeds: spec.source populated + registry entry created', () => {
    const { spec, pluginDir } = simulatePluginGenerate('my-tool', 'A useful tool');

    // spec returned has source populated
    expect(spec.source).toBeDefined();
    expect(spec.source!.registryId).toBe(spec.id);
    expect(spec.source!.installedVersion).toBe('0.1.0');
    expect(typeof spec.source!.installedContentHash).toBe('string');
    expect(spec.source!.installedContentHash.length).toBeGreaterThan(0);

    // spec.json on disk also has source block
    const diskSpec = readSpec(pluginDir);
    expect(diskSpec.source).toBeDefined();
    expect(diskSpec.source!.registryId).toBe(spec.id);

    // global registry has the entry
    const list = listPlugins();
    expect(list.some((p) => p.id === spec.id)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 2. PLUGIN_GENERATE auto-push (failure → local plugin still created)
  // -------------------------------------------------------------------------
  it('PLUGIN_GENERATE auto-push failure: local plugin created, source block NOT set', () => {
    const spec = generatePluginSpec('broken-push', 'Push will fail');
    const pluginDir = path.join(workspacePluginsDir, spec.name);
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'index.js'), '// broken-push');
    fs.writeFileSync(path.join(pluginDir, 'plugin.spec.json'), JSON.stringify(spec, null, 2));

    // Simulate the auto-push try/catch from the handler, but use a bad registry
    // root so pushPlugin throws (e.g., EROFS-like — we just call into a path
    // that does not have the right structure and catch the thrown Error).
    // Use an unwritable path to provoke a real FS error.
    const brokenRoot = path.join(sandbox, 'nonexistent-readonly', 'registry');
    // Make it a *file* so mkdirSync inside pushPlugin fails
    fs.mkdirSync(path.dirname(brokenRoot), { recursive: true });
    fs.writeFileSync(brokenRoot, 'not-a-dir');

    _setRegistryRootForTesting(brokenRoot);

    let pushError: Error | null = null;
    try {
      const pushed = pushPlugin(pluginDir, {
        id: spec.id,
        name: spec.name,
        description: spec.description,
        version: spec.version,
      });
      spec.source = {
        registryId: spec.id,
        installedVersion: pushed.version,
        installedContentHash: pushed.contentHash,
      };
      fs.writeFileSync(path.join(pluginDir, 'plugin.spec.json'), JSON.stringify(spec, null, 2));
    } catch (err) {
      pushError = err as Error;
    }

    // Restore valid registry root for afterEach cleanup
    _setRegistryRootForTesting(path.join(sandbox, 'registry'));

    // Push should have failed
    expect(pushError).not.toBeNull();

    // spec.source remains unset because push failed before writing
    expect(spec.source).toBeUndefined();

    // Local plugin dir still exists
    expect(fs.existsSync(pluginDir)).toBe(true);
    const diskSpec = readSpec(pluginDir);
    expect(diskSpec.source).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 3. PLUGIN_REGISTRY_LIST
  // -------------------------------------------------------------------------
  it('PLUGIN_REGISTRY_LIST returns all pushed plugins', () => {
    const { spec: specA } = simulatePluginGenerate('plugin-alpha', 'Alpha tool');
    const { spec: specB } = simulatePluginGenerate('plugin-beta', 'Beta tool');

    const list = listPlugins();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.some((p) => p.id === specA.id)).toBe(true);
    expect(list.some((p) => p.id === specB.id)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. PLUGIN_REGISTRY_DIFF — all 4 status cases
  // -------------------------------------------------------------------------
  it('PLUGIN_REGISTRY_DIFF returns synced when content unchanged', () => {
    const { spec } = simulatePluginGenerate('diff-synced', 'Sync test');
    const result = handleRegistryDiff(spec.name);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('synced');
  });

  it('PLUGIN_REGISTRY_DIFF returns locally-modified when content changed', () => {
    const { spec, pluginDir } = simulatePluginGenerate('diff-modified', 'Modify test');
    // Modify a file after push so content hash differs
    fs.writeFileSync(path.join(pluginDir, 'index.js'), '// modified content');
    const result = handleRegistryDiff(spec.name);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('locally-modified');
  });

  it('PLUGIN_REGISTRY_DIFF returns update-available when registry has newer version', () => {
    const { spec, pluginDir } = simulatePluginGenerate('diff-update', 'Update test');
    // Push a newer version to registry (different content to avoid immutable error)
    fs.writeFileSync(path.join(pluginDir, 'index.js'), '// v0.2.0 content');
    pushPlugin(pluginDir, {
      id: spec.id,
      name: spec.name,
      description: spec.description,
      version: '0.2.0',
    });
    // Restore original content (workspace stays at 0.1.0 hash)
    fs.writeFileSync(path.join(pluginDir, 'index.js'), `// ${spec.name}\nexports.run = () => {};`);
    const result = handleRegistryDiff(spec.name);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('update-available');
    expect(result!.latestVersion).toBe('0.2.0');
  });

  it('PLUGIN_REGISTRY_DIFF returns unknown when registry entry is missing', () => {
    // Create workspace plugin with fake source but no registry entry
    const { pluginDir } = makeWorkspacePlugin('diff-unknown', {
      id: 'plugin-nonexistent',
      source: {
        registryId: 'plugin-nonexistent',
        installedVersion: '0.1.0',
        installedContentHash: 'sha256:fakehash',
      },
    });
    const result = handleRegistryDiff('diff-unknown');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('unknown');
    void pluginDir;
  });

  // -------------------------------------------------------------------------
  // 5. PLUGIN_REGISTRY_DIFF (no source) → null
  // -------------------------------------------------------------------------
  it('PLUGIN_REGISTRY_DIFF returns null for plugin with no source block', () => {
    makeWorkspacePlugin('no-source-plugin');
    const result = handleRegistryDiff('no-source-plugin');
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 6. PLUGIN_REGISTRY_PULL
  // -------------------------------------------------------------------------
  it('PLUGIN_REGISTRY_PULL unpacks plugin into workspace and sets spec.source', () => {
    // First push a plugin to the registry
    const srcDir = path.join(sandbox, 'src-plugin');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'index.js'), '// pulled plugin');
    const spec: PluginSpec = {
      id: 'plugin-pull01',
      name: 'pull-test',
      description: 'Pull test plugin',
      version: '0.1.0',
      permissions: [],
      entryPoint: 'src/index.js',
      dependencies: {},
      tools: [],
    };
    fs.writeFileSync(path.join(srcDir, 'plugin.spec.json'), JSON.stringify(spec, null, 2));
    pushPlugin(srcDir, { id: spec.id, name: spec.name, description: spec.description, version: spec.version });

    const result = handleRegistryPull('plugin-pull01');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(fs.existsSync(result.pluginPath)).toBe(true);
    const pulledSpec = readSpec(result.pluginPath);
    expect(pulledSpec.source).toBeDefined();
    expect(pulledSpec.source!.registryId).toBe('plugin-pull01');
    expect(pulledSpec.source!.installedVersion).toBe('0.1.0');
    expect(pulledSpec.source!.installedContentHash).toBe(result.contentHash);
  });

  // -------------------------------------------------------------------------
  // 7. PLUGIN_REGISTRY_PULL (name conflict)
  // -------------------------------------------------------------------------
  it('PLUGIN_REGISTRY_PULL returns name-conflict when target dir exists', () => {
    // Push a plugin to the registry
    const srcDir = path.join(sandbox, 'src-conflict');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'index.js'), '// conflict plugin');
    const spec: PluginSpec = {
      id: 'plugin-conflict01',
      name: 'conflict-test',
      description: 'Conflict test',
      version: '0.1.0',
      permissions: [],
      entryPoint: 'src/index.js',
      dependencies: {},
      tools: [],
    };
    fs.writeFileSync(path.join(srcDir, 'plugin.spec.json'), JSON.stringify(spec, null, 2));
    pushPlugin(srcDir, { id: spec.id, name: spec.name, description: spec.description, version: spec.version });

    // Pre-create the destination dir to trigger conflict
    const destDir = path.join(workspacePluginsDir, 'conflict-test');
    fs.mkdirSync(destDir, { recursive: true });

    const result = handleRegistryPull('plugin-conflict01');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('name-conflict');
  });

  // -------------------------------------------------------------------------
  // 8. PLUGIN_REGISTRY_PUSH (manual, bumpPatch)
  // -------------------------------------------------------------------------
  it('PLUGIN_REGISTRY_PUSH with bumpPatch: version bumped to 0.1.1, spec.source updated', () => {
    const { spec } = simulatePluginGenerate('push-manual', 'Manual push test');
    // Modify content so new version isn't identical
    const pluginDir = path.join(workspacePluginsDir, spec.name);
    fs.writeFileSync(path.join(pluginDir, 'index.js'), '// updated for 0.1.1');

    const result = handleRegistryPush(spec.name, { bumpPatch: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.version).toBe('0.1.1');

    const diskSpec = readSpec(pluginDir);
    expect(diskSpec.version).toBe('0.1.1');
    expect(diskSpec.source!.installedVersion).toBe('0.1.1');

    // Registry also has 0.1.1 as latest
    const meta = getPluginMeta(spec.id);
    expect(meta!.latest).toBe('0.1.1');
  });

  // -------------------------------------------------------------------------
  // 9. PLUGIN_REGISTRY_REMOVE
  // -------------------------------------------------------------------------
  it('PLUGIN_REGISTRY_REMOVE removes plugin from registry', () => {
    const { spec } = simulatePluginGenerate('remove-me', 'Will be removed');

    // Confirm it's in the registry
    expect(listPlugins().some((p) => p.id === spec.id)).toBe(true);

    removePlugin(spec.id);

    // No longer in the list
    expect(listPlugins().some((p) => p.id === spec.id)).toBe(false);
  });
});
