import { inject } from "vue";
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { SDK_KEY } from "../plugins/sdk";
import type { FrontendSDK, Settings } from "../types";

export const useSettingsStore = defineStore("settings", () => {
  const sdk = inject<FrontendSDK>(SDK_KEY)!;

  const settings = ref<Settings>({
    oobUrl: "",
    enableHeaderInjection: true,
    enableUrlBypassProbes: true,
    enableInternalIpProbes: true,
    maxProbesPerSecond: 5,
    autoProbeMode: true,
    customSsrfParams: [],
    scanHttpHistory: false,
  });

  const isSaving = ref(false);
  const saveSuccess = ref(false);

  const isConfigured = computed(() => settings.value.oobUrl.trim().length > 0);

  async function loadSettings(): Promise<void> {
    settings.value = await sdk.backend.getSettings();
  }

  async function saveSettings(partial: Partial<Settings>): Promise<void> {
    isSaving.value = true;
    saveSuccess.value = false;
    try {
      settings.value = await sdk.backend.updateSettings(partial);
      saveSuccess.value = true;
      setTimeout(() => {
        saveSuccess.value = false;
      }, 2000);
    } finally {
      isSaving.value = false;
    }
  }

  async function resetToDefaults(): Promise<void> {
    settings.value = await sdk.backend.resetSettings();
  }

  return {
    settings,
    isSaving,
    saveSuccess,
    isConfigured,
    loadSettings,
    saveSettings,
    resetToDefaults,
  };
});
