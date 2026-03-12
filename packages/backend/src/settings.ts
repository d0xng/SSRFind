import type { SDK } from "caido:plugin";

export interface Settings {
  oobUrl: string;
  enableHeaderInjection: boolean;
  enableUrlBypassProbes: boolean;
  enableInternalIpProbes: boolean;
  maxProbesPerSecond: number;
  autoProbeMode: boolean;
  customSsrfParams: string[];
  scanHttpHistory: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  oobUrl: "",
  enableHeaderInjection: true,
  enableUrlBypassProbes: true,
  enableInternalIpProbes: true,
  maxProbesPerSecond: 5,
  autoProbeMode: true,
  customSsrfParams: [],
  scanHttpHistory: false,
};

let currentSettings: Settings = { ...DEFAULT_SETTINGS };

export function getSettings(_sdk: SDK): Settings {
  return { ...currentSettings };
}

export function updateSettings(_sdk: SDK, partial: Partial<Settings>): Settings {
  currentSettings = { ...currentSettings, ...partial };
  return { ...currentSettings };
}

export function resetSettings(_sdk: SDK): Settings {
  currentSettings = { ...DEFAULT_SETTINGS };
  return { ...currentSettings };
}

export function getSettingsInternal(): Settings {
  return currentSettings;
}
