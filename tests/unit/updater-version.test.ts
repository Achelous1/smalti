import { describe, it, expect } from 'vitest';
import { parseVersion, isNewer, findInstallerAsset } from '../../src/main/updater/check';

describe('parseVersion', () => {
  it('strips leading v and splits into numbers', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
  });

  it('works without leading v', () => {
    expect(parseVersion('0.0.1')).toEqual([0, 0, 1]);
  });
});

describe('isNewer', () => {
  it('returns true when patch is higher', () => {
    expect(isNewer('v0.0.2', '0.0.1')).toBe(true);
  });

  it('returns false when equal (no leading v on current)', () => {
    expect(isNewer('v0.0.1', '0.0.1')).toBe(false);
  });

  it('returns false when older', () => {
    expect(isNewer('v0.0.0', '0.0.1')).toBe(false);
  });

  it('returns true when major is higher', () => {
    expect(isNewer('v1.0.0', '0.9.9')).toBe(true);
  });

  it('returns true when minor is higher', () => {
    expect(isNewer('v0.10.0', '0.9.9')).toBe(true);
  });

  it('returns false when equal with leading v on both', () => {
    expect(isNewer('v0.0.1', 'v0.0.1')).toBe(false);
  });
});

describe('findInstallerAsset', () => {
  // Mirrors what .github/workflows/release.yml attaches to a release.
  const asset = (name: string) => ({ name, browser_download_url: `https://x/${name}` });
  const release = [
    asset('Smalti.dmg'),
    asset('Smalti.app.zip'),
    asset('Smalti-Setup-v0.4.1.exe'),
    asset('Smalti-0.4.1-full.nupkg'),
    asset('RELEASES'),
  ];

  it('picks the .dmg on macOS', () => {
    expect(findInstallerAsset(release, 'darwin')?.name).toBe('Smalti.dmg');
  });

  it('picks the Setup .exe on Windows', () => {
    expect(findInstallerAsset(release, 'win32')?.name).toBe('Smalti-Setup-v0.4.1.exe');
  });

  it('does not mistake the .nupkg for the Windows installer', () => {
    const noExe = [asset('Smalti-0.4.1-full.nupkg'), asset('RELEASES')];
    expect(findInstallerAsset(noExe, 'win32')).toBeUndefined();
  });

  it('matches the raw Squirrel name, which contains a literal space', () => {
    const raw = [asset('Smalti-0.4.1 Setup.exe')];
    expect(findInstallerAsset(raw, 'win32')?.name).toBe('Smalti-0.4.1 Setup.exe');
  });

  it('returns undefined when the release has no artifact for the platform', () => {
    // The v0.4.0 case: macOS-only assets, so Windows clients had nothing to install.
    const macOnly = [asset('Smalti.dmg'), asset('Smalti.app.zip')];
    expect(findInstallerAsset(macOnly, 'win32')).toBeUndefined();
    expect(findInstallerAsset(macOnly, 'darwin')?.name).toBe('Smalti.dmg');
  });
});
