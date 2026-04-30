import { describe, it, expect } from 'vitest';
import type { PluginSpec } from '../../src/main/plugin/spec-generator';
import type { PluginSourceMeta } from '../../src/types/plugin-registry';

describe('PluginSpec.source round-trip', () => {
  it('serializes and deserializes PluginSpec with source block', () => {
    const source: PluginSourceMeta = {
      registryId: 'plugin-abc12345',
      installedVersion: '0.1.0',
      installedContentHash: 'sha256:deadbeef',
    };

    const spec: PluginSpec = {
      id: 'plugin-abc12345',
      name: 'my-plugin',
      description: 'A test plugin',
      version: '0.1.0',
      permissions: ['fs:read'],
      entryPoint: 'src/index.js',
      dependencies: {},
      tools: [],
      source,
    };

    const serialized = JSON.stringify(spec, null, 2);
    const deserialized = JSON.parse(serialized) as PluginSpec;

    expect(deserialized.source).toBeDefined();
    expect(deserialized.source!.registryId).toBe('plugin-abc12345');
    expect(deserialized.source!.installedVersion).toBe('0.1.0');
    expect(deserialized.source!.installedContentHash).toBe('sha256:deadbeef');
    expect(deserialized.source!.forkedFrom).toBeUndefined();
  });

  it('serializes PluginSpec without source block (undefined is omitted)', () => {
    const spec: PluginSpec = {
      id: 'plugin-abc12345',
      name: 'my-plugin',
      description: 'A test plugin',
      version: '0.1.0',
      permissions: [],
      entryPoint: 'src/index.js',
      dependencies: {},
      tools: [],
    };

    const serialized = JSON.stringify(spec, null, 2);
    const deserialized = JSON.parse(serialized) as PluginSpec;

    expect(deserialized.source).toBeUndefined();
  });

  it('serializes forkedFrom metadata when present', () => {
    const source: PluginSourceMeta = {
      registryId: 'plugin-fork01',
      installedVersion: '0.2.0',
      installedContentHash: 'sha256:cafebabe',
      forkedFrom: { registryId: 'plugin-original', version: '0.1.5' },
    };

    const spec: PluginSpec = {
      id: 'plugin-fork01',
      name: 'forked-plugin',
      description: 'A forked plugin',
      version: '0.2.0',
      permissions: [],
      entryPoint: 'src/index.js',
      dependencies: {},
      tools: [],
      source,
    };

    const serialized = JSON.stringify(spec, null, 2);
    const deserialized = JSON.parse(serialized) as PluginSpec;

    expect(deserialized.source!.forkedFrom).toEqual({
      registryId: 'plugin-original',
      version: '0.1.5',
    });
  });
});
