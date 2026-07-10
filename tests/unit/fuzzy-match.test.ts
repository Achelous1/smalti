import { describe, it, expect } from 'vitest';
import { fuzzyMatch, fuzzyFilter } from '../../src/renderer/utils/fuzzy-match';

describe('fuzzyMatch', () => {
  it('matches case-insensitive subsequences', () => {
    expect(fuzzyMatch('LazyGit', 'lzg')).not.toBeNull();
    expect(fuzzyMatch('lazygit', 'LAZY')).not.toBeNull();
  });

  it('returns null when characters are missing or out of order', () => {
    expect(fuzzyMatch('lazygit', 'lzx')).toBeNull();
    expect(fuzzyMatch('lazygit', 'gz')).toBeNull();
  });

  it('empty query matches everything with best score', () => {
    expect(fuzzyMatch('anything', '')).toBe(0);
  });

  it('scores tighter and earlier matches better (lower)', () => {
    const prefix = fuzzyMatch('lazygit', 'lazy')!;
    const scattered = fuzzyMatch('lay-zebra-y', 'lazy')!;
    expect(prefix).toBeLessThan(scattered);
  });
});

describe('fuzzyFilter', () => {
  const items = [
    { name: 'LazyGit', command: 'lazygit' },
    { name: 'Dev Server', command: 'npm run dev' },
    { name: 'System Monitor', command: 'htop' },
  ];
  const keys = (i: (typeof items)[number]) => [i.name, i.command];

  it('returns all items for an empty query', () => {
    expect(fuzzyFilter(items, '', keys)).toEqual(items);
  });

  it('filters by name or command', () => {
    expect(fuzzyFilter(items, 'laz', keys).map((i) => i.name)).toEqual(['LazyGit']);
    expect(fuzzyFilter(items, 'htop', keys).map((i) => i.name)).toEqual(['System Monitor']);
  });

  it('ranks better matches first', () => {
    const result = fuzzyFilter(items, 'dev', keys);
    expect(result[0].name).toBe('Dev Server');
  });

  it('drops items with no match', () => {
    expect(fuzzyFilter(items, 'zzz', keys)).toEqual([]);
  });
});
