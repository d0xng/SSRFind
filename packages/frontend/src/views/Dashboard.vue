<script setup lang="ts">
import { ref } from "vue";
import StatsCard from "../components/StatsCard.vue";
import { useSSRFStore } from "../stores/ssrfStore";
import { useSettingsStore } from "../stores/settingsStore";

const ssrfStore = useSSRFStore();
const settingsStore = useSettingsStore();

const guideOpen = ref(!settingsStore.isConfigured);
</script>

<template>
  <div class="flex flex-col gap-6 p-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-surface-100">Dashboard</h2>
        <p class="text-surface-400 text-sm mt-0.5">
          Passive SSRF scanner — monitoring traffic in real time
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span
          :class="[
            'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full',
            settingsStore.isConfigured
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30',
          ]"
        >
          <span
            :class="[
              'w-1.5 h-1.5 rounded-full',
              settingsStore.isConfigured ? 'bg-green-400 animate-pulse' : 'bg-red-400',
            ]"
          />
          {{ settingsStore.isConfigured ? "Active" : "Inactive — configure OOB URL" }}
        </span>
      </div>
    </div>

    <!-- OOB URL info -->
    <div
      v-if="settingsStore.isConfigured"
      class="flex items-center gap-2 bg-surface-800 border border-surface-700 rounded-lg px-4 py-2.5 text-xs"
    >
      <i class="fas fa-satellite-dish text-blue-400" />
      <span class="text-surface-400">OOB URL:</span>
      <span class="font-mono text-surface-200">{{ settingsStore.settings.oobUrl }}</span>
    </div>

    <!-- Quick Start Guide -->
    <div class="bg-surface-800 border border-surface-700 rounded-lg overflow-hidden">
      <button
        class="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-700/50 transition-colors"
        @click="guideOpen = !guideOpen"
      >
        <div class="flex items-center gap-2.5">
          <i class="fas fa-circle-info text-blue-400 text-sm" />
          <span class="text-sm font-semibold text-surface-100">Quick Start</span>
          <span
            v-if="!settingsStore.isConfigured"
            class="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
          >Setup required</span>
        </div>
        <i
          :class="['fas text-surface-400 text-xs transition-transform duration-200', guideOpen ? 'fa-chevron-up' : 'fa-chevron-down']"
        />
      </button>

      <div v-if="guideOpen" class="px-5 pb-5 pt-1 border-t border-surface-700/60">
        <div class="flex flex-col gap-4 mt-3">

          <!-- Step 1 -->
          <div class="flex gap-4 items-start">
            <div class="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <span class="text-blue-400 text-xs font-bold">1</span>
            </div>
            <div>
              <div class="flex items-center gap-2 mb-0.5">
                <i class="fas fa-gear text-blue-400 text-xs" />
                <span class="text-surface-100 text-sm font-medium">Set your OOB URL</span>
              </div>
              <p class="text-surface-400 text-xs leading-relaxed">
                Go to <span class="text-surface-200 font-medium">Settings</span> and paste your QuickSSRF, webhook.site or Interactsh URL.
                This URL is injected into parameters to detect callbacks.
              </p>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="flex gap-4 items-start">
            <div class="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
              <span class="text-purple-400 text-xs font-bold">2</span>
            </div>
            <div>
              <div class="flex items-center gap-2 mb-0.5">
                <i class="fas fa-crosshairs text-purple-400 text-xs" />
                <span class="text-surface-100 text-sm font-medium">Define a Scope in Caido</span>
              </div>
              <p class="text-surface-400 text-xs leading-relaxed">
                Without a scope the plugin <span class="text-red-400 font-medium">won't analyze any traffic</span>.
                Add your target hosts from <span class="text-surface-200 font-medium">Settings → Scope</span> in Caido.
              </p>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="flex gap-4 items-start">
            <div class="flex-shrink-0 w-7 h-7 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
              <span class="text-green-400 text-xs font-bold">3</span>
            </div>
            <div>
              <div class="flex items-center gap-2 mb-0.5">
                <i class="fas fa-globe text-green-400 text-xs" />
                <span class="text-surface-100 text-sm font-medium">Browse normally</span>
              </div>
              <p class="text-surface-400 text-xs leading-relaxed">
                SSRFind monitors traffic in the background. When it detects an SSRF candidate you'll see it in
                <span class="text-surface-200 font-medium">Live Queue</span> and Phase 1 will fire automatically.
              </p>
            </div>
          </div>

          <!-- Divider + Happy hacking -->
          <div class="flex items-center gap-3 pt-2 mt-1 border-t border-surface-700/60">
            <div class="flex-1 h-px bg-surface-700/60" />
            <span class="text-surface-400 text-sm tracking-widest font-mono">Happy hacking 🔥</span>
            <div class="flex-1 h-px bg-surface-700/60" />
          </div>

        </div>
      </div>
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <StatsCard
        label="Requests Analyzed"
        :value="ssrfStore.stats.requestsAnalyzed"
        icon="fas fa-wave-square"
        accent="blue"
      />
      <StatsCard
        label="Candidates Found"
        :value="ssrfStore.stats.candidatesFound"
        icon="fas fa-crosshairs"
        accent="purple"
      />
      <StatsCard
        label="Probes Sent"
        :value="ssrfStore.stats.probesSent"
        icon="fas fa-paper-plane"
        accent="orange"
      />
      <StatsCard
        label="Errors"
        :value="ssrfStore.stats.probesError"
        icon="fas fa-triangle-exclamation"
        accent="red"
      />
      <StatsCard
        label="Confirmed Hits"
        :value="ssrfStore.stats.confirmed"
        icon="fas fa-bullseye"
        accent="green"
      />
    </div>

    <!-- Clear all data -->
    <div class="bg-surface-800 border border-red-900/40 rounded-lg p-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-red-400">Clear all data</h3>
          <p class="text-surface-400 text-xs mt-0.5">
            Removes all candidates, probes, findings and resets stats. This action cannot be undone.
          </p>
        </div>
        <button
          class="flex items-center gap-2 px-4 py-2 rounded bg-rose-900 hover:bg-rose-800 text-rose-100 text-sm transition-colors"
          @click="ssrfStore.clearAll()"
        >
          <i class="fas fa-trash" />
          Clear all data
        </button>
      </div>
    </div>
  </div>
</template>
