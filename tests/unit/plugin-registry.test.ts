import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../../src/main/plugin/registry';
import type { PluginSpec } from '../../src/main/plugin/spec-generator';

function makeSpec(id: string, name: string): PluginSpec {
  return {
    id,
    name,
    description: `${name} plugin`,
    version: '0.1.0',
    permissions: [],
    entryPoint: 'src/index.js',
    tools: [],
  };
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('register / list', () => {
    it('lists registered plugins', () => {
      registry.register(makeSpec('id-1', 'plugin-a'), '/tmp/plugin-a');
      registry.register(makeSpec('id-2', 'plugin-b'), '/tmp/plugin-b');
      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list.find((p) => p.id === 'id-1')).toBeDefined();
      expect(list.find((p) => p.id === 'id-2')).toBeDefined();
    });
  });

  describe('clearPlugins', () => {
    it('removes all plugins', () => {
      registry.register(makeSpec('id-1', 'plugin-a'), '/tmp/plugin-a');
      registry.register(makeSpec('id-2', 'plugin-b'), '/tmp/plugin-b');

      registry.clearPlugins();

      expect(registry.list()).toHaveLength(0);
    });

    it('is a no-op on an empty registry', () => {
      expect(() => registry.clearPlugins()).not.toThrow();
      expect(registry.list()).toHaveLength(0);
    });

    it('allows re-registering plugins after clearing', () => {
      registry.register(makeSpec('id-1', 'plugin-a'), '/tmp/plugin-a');
      registry.clearPlugins();
      registry.register(makeSpec('id-1', 'plugin-a'), '/tmp/plugin-a');
      expect(registry.list()).toHaveLength(1);
    });
  });

  describe('unregister', () => {
    it('removes a plugin by id', () => {
      registry.register(makeSpec('id-1', 'plugin-a'), '/tmp/plugin-a');
      registry.unregister('id-1');
      expect(registry.list()).toHaveLength(0);
    });

    it('returns false for unknown id', () => {
      expect(registry.unregister('nonexistent')).toBe(false);
    });
  });
});
