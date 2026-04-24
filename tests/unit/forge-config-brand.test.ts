import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('forge.config.ts brand identifiers', () => {
  const content = fs.readFileSync(path.resolve(__dirname, '../../forge.config.ts'), 'utf-8');

  describe('preserved fields (awaiting D8 userData migration)', () => {
    it("packagerConfig.name stays 'AIDE'", () => {
      expect(content).toMatch(/name:\s*['"]AIDE['"]/);
    });
  });

  describe('user-facing Usage Description strings migrated to smalti', () => {
    it.each([
      'Documents folder',
      'Desktop folder',
      'Downloads folder',
      'external volumes',
      'network volumes',
    ])('Usage Description for %s references smalti, not AIDE', (scope) => {
      const lines = content.split('\n');
      const matching = lines.filter((l) => l.includes(scope));
      expect(matching.length).toBeGreaterThan(0);
      for (const line of matching) {
        if (line.includes('reads workspace files')) {
          expect(line).toContain('smalti reads workspace files');
          expect(line).not.toMatch(/\bAIDE reads\b/);
        }
      }
    });
  });
});
