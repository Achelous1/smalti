import { type IpcMain } from 'electron';
import Store from 'electron-store';
import { IPC_CHANNELS } from './channels';
import type { CommandPreset } from '../../types/ipc';

export interface AppSettings {
  theme: 'dark' | 'light';
  windowBounds: { x: number; y: number; width: number; height: number } | null;
  commandPresets: CommandPreset[];
}

const defaults: AppSettings = {
  theme: 'dark',
  windowBounds: null,
  commandPresets: [],
};

const store = new Store<AppSettings>({ name: 'aide-app-settings', defaults });

export function getAppSettings(): AppSettings {
  return {
    theme: store.get('theme', defaults.theme),
    windowBounds: store.get('windowBounds', defaults.windowBounds),
    commandPresets: store.get('commandPresets', defaults.commandPresets),
  };
}

export function setAppSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  store.set(key, value);
}

export function registerAppSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.APP_SETTINGS_GET, () => {
    return getAppSettings();
  });

  ipcMain.handle(IPC_CHANNELS.APP_SETTINGS_SET, (_event, key: string, value: unknown) => {
    if (key === 'theme' || key === 'windowBounds' || key === 'commandPresets') {
      store.set(key, value);
    }
  });
}
