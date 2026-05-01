/**
 * Shared plugin registry types — safe to import from both main and renderer.
 * Do NOT import from src/main/* here (Electron security model).
 */

export interface PluginSourceMeta {
  /** Registry plugin id (same as PluginSpec.id when this workspace published it). */
  registryId: string;
  installedVersion: string;
  installedContentHash: string;
  /** Set when this plugin was created by Fork-as-new-plugin (D6). Tracking metadata only. */
  forkedFrom?: { registryId: string; version: string };
}

export interface RegistrySummary {
  id: string;
  name: string;
  description: string;
  latest: string;
}

export type SyncStatus = 'synced' | 'update-available' | 'locally-modified' | 'unknown';

export interface RegistryDiff {
  registryId: string;
  status: SyncStatus;
  installedVersion: string | null;
  latestVersion: string | null;
  installedContentHash: string | null;
  workspaceContentHash: string;
}
