<script setup lang="ts">
import { ref, computed, onMounted, inject } from "vue";
import Dashboard from "./Dashboard.vue";
import LiveQueue from "./LiveQueue.vue";
import Findings from "./Findings.vue";
import Settings from "./Settings.vue";
import ScopeWarning from "../components/ScopeWarning.vue";
import { useSSRFStore } from "../stores/ssrfStore";
import { useSettingsStore } from "../stores/settingsStore";
import { SDK_KEY } from "../plugins/sdk";
import type { FrontendSDK } from "../types";

const sdk = inject<FrontendSDK>(SDK_KEY)!;

const ssrfStore = useSSRFStore();
const settingsStore = useSettingsStore();

const activeTab = ref<"dashboard" | "queue" | "findings" | "settings">("dashboard");
const isReady = ref(false);
const hasScope = ref(true);

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: "fas fa-gauge" },
  { id: "queue",     label: "Live Queue", icon: "fas fa-satellite-dish" },
  { id: "findings",  label: "Findings",   icon: "fas fa-bullseye" },
  { id: "settings",  label: "Settings",   icon: "fas fa-gear" },
] as const;

const confirmedCount = computed(() => ssrfStore.stats.confirmed);
const queueCount = computed(() => ssrfStore.stats.candidatesFound);

onMounted(async () => {
  try {
    await Promise.allSettled([
      settingsStore.loadSettings(),
      ssrfStore.loadInitialData(),
    ]);
    ssrfStore.setupEventListeners();

    try {
      const count = await sdk.backend.getScopeCount();
      hasScope.value = count > 0;
    } catch {
      hasScope.value = false;
    }
  } catch {
    // Ensure UI always renders even if backend is slow to start
  } finally {
    isReady.value = true;
  }
});

async function checkScope(): Promise<void> {
  try {
    const count = await sdk.backend.getScopeCount();
    hasScope.value = count > 0;
  } catch {
    hasScope.value = false;
  }
}

async function switchTab(tab: typeof activeTab.value): Promise<void> {
  activeTab.value = tab;
  if (tab !== "settings") await checkScope();
}

function goToSettings(): void {
  activeTab.value = "settings";
}
</script>

<template>
  <div
    id="plugin--ssrfind"
    class="flex flex-col h-full bg-surface-900 text-surface-100 overflow-hidden"
  >
    <!-- Top bar -->
    <div class="flex items-center border-b border-surface-700 bg-surface-900 flex-shrink-0 px-2">
      <div class="flex items-center gap-1 py-1">
        <i class="fas fa-crosshairs text-red-400 text-sm px-2" />
        <span class="text-xs font-bold text-surface-300 tracking-wider uppercase pr-3">SSRFind</span>
      </div>

      <div class="flex items-center gap-0.5 flex-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="[
            'flex items-center gap-1.5 px-3 py-2 text-xs transition-colors relative',
            activeTab === tab.id
              ? 'text-surface-100'
              : 'text-surface-500 hover:text-surface-300',
          ]"
          @click="switchTab(tab.id)"
        >
          <i :class="tab.icon" />
          {{ tab.label }}

          <!-- Badges -->
          <span
            v-if="tab.id === 'queue' && queueCount > 0"
            class="ml-0.5 bg-blue-500/30 text-blue-300 text-xs px-1.5 rounded-full border border-blue-500/30"
          >
            {{ queueCount }}
          </span>
          <span
            v-if="tab.id === 'findings' && confirmedCount > 0"
            class="ml-0.5 bg-green-500/30 text-green-300 text-xs px-1.5 rounded-full border border-green-500/30"
          >
            {{ confirmedCount }}
          </span>

          <!-- Active underline -->
          <span
            v-if="activeTab === tab.id"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"
          />
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="!isReady" class="flex items-center justify-center flex-1 text-surface-500">
      <i class="fas fa-spinner animate-spin mr-2" /> Loading...
    </div>

    <!-- Content (non-settings tabs) -->
    <template v-else-if="activeTab !== 'settings'">
      <!-- Dashboard: always accessible so the Quick Start guide is visible -->
      <div v-if="activeTab === 'dashboard'" class="flex-1 overflow-hidden flex flex-col">
        <Dashboard />
      </div>

      <!-- Other tabs: require OOB + scope -->
      <template v-else>
        <div
          v-if="!settingsStore.isConfigured"
          class="flex-1 flex items-center justify-center p-8"
        >
          <ScopeWarning type="no_oob" @go-settings="goToSettings" />
        </div>
        <div
          v-else-if="!hasScope"
          class="flex-1 flex items-center justify-center p-8"
        >
          <ScopeWarning type="no_scope" @go-scope="goToSettings" />
        </div>
        <div v-else class="flex-1 overflow-hidden flex flex-col">
          <LiveQueue v-if="activeTab === 'queue'" />
          <Findings v-else-if="activeTab === 'findings'" />
        </div>
      </template>
    </template>

    <!-- Settings always accessible -->
    <div v-else-if="activeTab === 'settings'" class="flex-1 overflow-y-auto">
      <Settings />
    </div>
  </div>
</template>
