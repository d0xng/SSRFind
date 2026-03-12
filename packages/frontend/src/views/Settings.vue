<script setup lang="ts">
import { ref, reactive, watch, onMounted, inject } from "vue";
import { useSettingsStore } from "../stores/settingsStore";
import { SDK_KEY } from "../plugins/sdk";
import type { FrontendSDK } from "../types";

const sdk = inject<FrontendSDK>(SDK_KEY)!;
const settingsStore = useSettingsStore();

interface ScopeInfo {
  id: string;
  name: string;
  allowlist: string[];
  denylist: string[];
}

const form = reactive({
  oobUrl: "",
  enableHeaderInjection: true,
  enableUrlBypassProbes: true,
  enableInternalIpProbes: true,
  maxProbesPerSecond: 5,
  autoProbeMode: true,
  customSsrfParams: [] as string[],
});

const newParam = ref("");
const scopes = ref<ScopeInfo[]>([]);
const scopesLoading = ref(false);
const expandedScope = ref<string | null>(null);

watch(
  () => settingsStore.settings,
  (s) => {
    form.oobUrl = s.oobUrl;
    form.enableHeaderInjection = s.enableHeaderInjection;
    form.enableUrlBypassProbes = s.enableUrlBypassProbes;
    form.enableInternalIpProbes = s.enableInternalIpProbes;
    form.maxProbesPerSecond = s.maxProbesPerSecond;
    form.autoProbeMode = s.autoProbeMode;
    form.customSsrfParams = [...s.customSsrfParams];
  },
  { immediate: true }
);

async function loadScopes(): Promise<void> {
  scopesLoading.value = true;
  try {
    scopes.value = await sdk.backend.getScopeList();
  } finally {
    scopesLoading.value = false;
  }
}

onMounted(async () => {
  await settingsStore.loadSettings();
  await loadScopes();
});

async function save(): Promise<void> {
  await settingsStore.saveSettings({ ...form });
}

function addParam(): void {
  const p = newParam.value.trim().toLowerCase();
  if (p && !form.customSsrfParams.includes(p)) {
    form.customSsrfParams.push(p);
    newParam.value = "";
  }
}

function removeParam(param: string): void {
  form.customSsrfParams = form.customSsrfParams.filter((p) => p !== param);
}

function toggleScope(id: string): void {
  expandedScope.value = expandedScope.value === id ? null : id;
}

function openCaidoScopes(): void {
  sdk.navigation.goTo("/scopes");
}
</script>

<template>
  <div class="flex flex-col gap-6 p-6 max-w-2xl">
    <div>
      <h2 class="text-lg font-bold text-surface-100">Settings</h2>
      <p class="text-surface-400 text-sm mt-0.5">Configure SSRFind behavior</p>
    </div>

    <!-- OOB URL -->
    <div class="flex flex-col gap-2">
      <label class="text-sm font-semibold text-surface-200">OOB / Collaborator URL</label>
      <p class="text-xs text-surface-500">
        Copy this from QuickSSRF (or any interactsh client). Example:
        <code class="font-mono text-blue-300">abc123.oast.fun</code>
      </p>
      <div class="flex gap-2">
        <input
          v-model="form.oobUrl"
          type="text"
          placeholder="abc123.oast.fun"
          class="flex-1 bg-surface-800 border border-surface-700 rounded px-3 py-2 text-sm font-mono text-surface-100 placeholder-surface-600 outline-none focus:border-blue-500/60"
        />
      </div>
      <p
        v-if="!form.oobUrl"
        class="text-xs text-orange-400 flex items-center gap-1"
      >
        <i class="fas fa-triangle-exclamation" />
        SSRFind will not scan without an OOB URL
      </p>
    </div>

    <hr class="border-surface-700" />

    <!-- Probe mode -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-semibold text-surface-200">Probing Mode</h3>

      <label class="flex items-start gap-3 cursor-pointer">
        <input
          v-model="form.autoProbeMode"
          type="checkbox"
          class="mt-0.5 accent-blue-500"
        />
        <div>
          <p class="text-sm text-surface-200">Auto-probe mode</p>
          <p class="text-xs text-surface-500">
            Send Phase 1 probes automatically for every detected candidate.
            Disable to review candidates manually before probing.
          </p>
        </div>
      </label>
    </div>

    <hr class="border-surface-700" />

    <!-- Phase 1 options -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-semibold text-surface-200">Phase 1 — OOB Probes</h3>

      <label class="flex items-start gap-3 cursor-pointer">
        <input
          v-model="form.enableHeaderInjection"
          type="checkbox"
          class="mt-0.5 accent-blue-500"
        />
        <div>
          <p class="text-sm text-surface-200">Header injection</p>
          <p class="text-xs text-surface-500">
            Inject OOB URL into 16 SSRF-prone headers (X-Forwarded-Host, X-Real-IP, etc.)
          </p>
        </div>
      </label>
    </div>

    <hr class="border-surface-700" />

    <!-- Phase 2 options -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-semibold text-surface-200">Phase 2 — Escalation (triggered on confirmation)</h3>

      <label class="flex items-start gap-3 cursor-pointer">
        <input
          v-model="form.enableUrlBypassProbes"
          type="checkbox"
          class="mt-0.5 accent-orange-500"
        />
        <div>
          <p class="text-sm text-surface-200">URL parser bypass</p>
          <p class="text-xs text-surface-500">
            Try @, encoded fragments, and other URL parser confusion techniques
          </p>
        </div>
      </label>

      <label class="flex items-start gap-3 cursor-pointer">
        <input
          v-model="form.enableInternalIpProbes"
          type="checkbox"
          class="mt-0.5 accent-orange-500"
        />
        <div>
          <p class="text-sm text-surface-200">Internal IP probes</p>
          <p class="text-xs text-surface-500">
            Try 127.0.0.1 in decimal, octal, hex, IPv6 forms + AWS/GCP/Azure metadata endpoints
          </p>
        </div>
      </label>
    </div>

    <hr class="border-surface-700" />

    <!-- Rate limit -->
    <div class="flex flex-col gap-2">
      <label class="text-sm font-semibold text-surface-200">
        Max probes per second: <span class="text-blue-400 font-mono">{{ form.maxProbesPerSecond }}</span>
      </label>
      <input
        v-model.number="form.maxProbesPerSecond"
        type="range"
        min="1"
        max="20"
        step="1"
        class="accent-blue-500"
      />
      <p class="text-xs text-surface-500">
        Higher = faster scanning, more traffic. Lower = stealthier.
      </p>
    </div>

    <hr class="border-surface-700" />

    <!-- Custom params -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-semibold text-surface-200">Additional SSRF Parameters</h3>
      <p class="text-xs text-surface-500">
        Add extra parameter names to watch for (on top of the ~35 built-in ones)
      </p>
      <div class="flex gap-2">
        <input
          v-model="newParam"
          type="text"
          placeholder="e.g. webhook_url"
          class="flex-1 bg-surface-800 border border-surface-700 rounded px-3 py-2 text-sm font-mono text-surface-100 placeholder-surface-600 outline-none focus:border-blue-500/60"
          @keydown.enter.prevent="addParam"
        />
        <button
          class="px-3 py-2 rounded bg-surface-700 hover:bg-surface-600 text-surface-200 text-sm transition-colors"
          @click="addParam"
        >
          Add
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="param in form.customSsrfParams"
          :key="param"
          class="flex items-center gap-1.5 bg-surface-800 border border-surface-700 rounded px-2 py-1 text-xs font-mono text-blue-300"
        >
          {{ param }}
          <button
            class="text-surface-500 hover:text-red-400 transition-colors"
            @click="removeParam(param)"
          >
            <i class="fas fa-xmark text-xs" />
          </button>
        </span>
      </div>
    </div>

    <hr class="border-surface-700" />

    <!-- Scope Configuration -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-surface-200">Active Caido Scope</h3>
          <p class="text-xs text-surface-500 mt-0.5">
            SSRFind only scans requests that match these scope rules
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
            :disabled="scopesLoading"
            @click="loadScopes"
          >
            <i :class="['fas fa-rotate', scopesLoading && 'animate-spin']" />
            Refresh
          </button>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs transition-colors"
            @click="openCaidoScopes"
          >
            <i class="fas fa-arrow-up-right-from-square" />
            Open Scope Settings
          </button>
        </div>
      </div>

      <!-- No scopes warning -->
      <div
        v-if="!scopesLoading && scopes.length === 0"
        class="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4"
      >
        <i class="fas fa-triangle-exclamation text-yellow-400 mt-0.5 shrink-0" />
        <div>
          <p class="text-sm text-yellow-300 font-medium">No scope configured in Caido</p>
          <p class="text-xs text-surface-400 mt-1">
            SSRFind won't scan any traffic without a scope. Click "Open Scope Settings" to add one.
          </p>
          <button
            class="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded bg-yellow-600 hover:bg-yellow-500 text-white text-xs transition-colors"
            @click="openCaidoScopes"
          >
            <i class="fas fa-crosshairs" />
            Configure Scope Now
          </button>
        </div>
      </div>

      <!-- Scope list -->
      <div v-else-if="!scopesLoading" class="flex flex-col gap-2">
        <div
          v-for="scope in scopes"
          :key="scope.id"
          class="rounded-lg border border-surface-700 bg-surface-800 overflow-hidden"
        >
          <!-- Scope header (clickable to expand) -->
          <button
            class="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-700/50 transition-colors text-left"
            @click="toggleScope(scope.id)"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              <span class="text-sm text-surface-100 font-medium truncate">{{ scope.name }}</span>
              <span class="text-xs text-surface-500 shrink-0">
                {{ scope.allowlist.length }} rule{{ scope.allowlist.length !== 1 ? "s" : "" }}
              </span>
            </div>
            <i
              :class="[
                'fas fa-chevron-down text-surface-500 text-xs transition-transform shrink-0 ml-2',
                expandedScope === scope.id && 'rotate-180',
              ]"
            />
          </button>

          <!-- Expanded scope details -->
          <div v-if="expandedScope === scope.id" class="border-t border-surface-700 px-4 py-3 flex flex-col gap-3">
            <!-- Allowlist -->
            <div>
              <p class="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1.5">
                <i class="fas fa-circle-check mr-1" />Allowlist
              </p>
              <div v-if="scope.allowlist.length === 0" class="text-xs text-surface-500 italic">Empty</div>
              <div class="flex flex-col gap-1">
                <div
                  v-for="(pattern, i) in scope.allowlist"
                  :key="i"
                  class="font-mono text-xs text-green-300 bg-green-500/5 border border-green-500/20 rounded px-2 py-1"
                >
                  {{ pattern }}
                </div>
              </div>
            </div>

            <!-- Denylist -->
            <div v-if="scope.denylist.length > 0">
              <p class="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">
                <i class="fas fa-ban mr-1" />Denylist
              </p>
              <div class="flex flex-col gap-1">
                <div
                  v-for="(pattern, i) in scope.denylist"
                  :key="i"
                  class="font-mono text-xs text-red-300 bg-red-500/5 border border-red-500/20 rounded px-2 py-1"
                >
                  {{ pattern }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-else class="flex items-center gap-2 text-surface-500 text-sm py-2">
        <i class="fas fa-spinner animate-spin" />
        Loading scopes...
      </div>
    </div>

    <!-- Save button -->
    <div class="flex items-center gap-3 pt-2">
      <button
        :disabled="settingsStore.isSaving"
        class="px-5 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        @click="save"
      >
        <i :class="['fas mr-1.5', settingsStore.isSaving ? 'fa-spinner animate-spin' : 'fa-floppy-disk']" />
        {{ settingsStore.isSaving ? "Saving..." : "Save Settings" }}
      </button>
      <span
        v-if="settingsStore.saveSuccess"
        class="text-green-400 text-sm flex items-center gap-1"
      >
        <i class="fas fa-check" /> Saved
      </span>
      <button
        class="ml-auto text-xs text-surface-500 hover:text-red-400 transition-colors"
        @click="settingsStore.resetToDefaults()"
      >
        Reset to defaults
      </button>
    </div>
  </div>
</template>
