/**
 * Resolve a command preset's working directory against the workspace root.
 *
 * - no cwd            → workspace root
 * - absolute cwd      → used as-is (POSIX `/…` or Windows `C:\…`)
 * - relative cwd      → joined onto the workspace root
 */
export function resolvePresetCwd(
  presetCwd: string | undefined,
  workspacePath: string | undefined,
): string | undefined {
  if (!presetCwd) return workspacePath;
  if (/^([A-Za-z]:[\\/]|\/)/.test(presetCwd)) return presetCwd;
  return workspacePath ? `${workspacePath}/${presetCwd}` : presetCwd;
}
