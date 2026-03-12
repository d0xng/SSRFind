<script setup lang="ts">
import { computed, ref } from "vue";
import StatusBadge from "./StatusBadge.vue";
import type { Probe } from "../types";

const props = defineProps<{
  probes: Probe[];
}>();

const expandedSnippet = ref<string | null>(null);

function toggleSnippet(probeId: string): void {
  expandedSnippet.value = expandedSnippet.value === probeId ? null : probeId;
}

const oobProbes    = computed(() => props.probes.filter((p) => p.payloadGroup === "oob_direct"));
const portProbes   = computed(() => props.probes.filter((p) => p.payloadGroup === "port_scan"));
const headerProbes = computed(() => props.probes.filter((p) => p.payloadGroup === "header_inject"));
const bypassProbes = computed(() => props.probes.filter((p) => p.payloadGroup === "ip_bypass"));

function statusColor(code: number | undefined): string {
  if (!code) return "text-surface-500";
  if (code >= 200 && code < 300) return "text-green-400";
  if (code >= 300 && code < 400) return "text-yellow-400";
  if (code >= 400 && code < 500) return "text-orange-400";
  if (code >= 500) return "text-red-400";
  return "text-surface-500";
}
</script>

<template>
  <div class="flex flex-col gap-5">

    <!-- Phase 1 — OOB Confirmation -->
    <div v-if="oobProbes.length > 0">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-semibold uppercase tracking-wider text-blue-400">
          Phase 1 — OOB Confirmation
        </span>
        <span class="text-xs text-surface-500">({{ oobProbes.length }} probe)</span>
      </div>
      <div class="flex flex-col gap-1">
        <div
          v-for="probe in oobProbes"
          :key="probe.id"
          class="flex flex-col rounded bg-surface-800 overflow-hidden"
        >
          <div class="flex items-center gap-2 px-3 py-2 text-xs font-mono">
            <StatusBadge :status="probe.status" small />
            <span class="text-surface-300 truncate flex-1">{{ probe.payload }}</span>
            <span :class="['shrink-0', statusColor(probe.responseCode)]">
              {{ probe.responseCode ?? "" }}
            </span>
            <button
              v-if="probe.responseSnippet"
              class="shrink-0 text-surface-500 hover:text-surface-300 transition-colors"
              :title="expandedSnippet === probe.id ? 'Hide response' : 'Show response'"
              @click="toggleSnippet(probe.id)"
            >
              <i :class="['fas', expandedSnippet === probe.id ? 'fa-chevron-up' : 'fa-chevron-down']" />
            </button>
          </div>
          <div
            v-if="probe.responseSnippet && expandedSnippet === probe.id"
            class="border-t border-surface-700 px-3 py-2 text-xs font-mono text-surface-400 whitespace-pre-wrap break-all bg-surface-900 max-h-40 overflow-y-auto"
          >{{ probe.responseSnippet }}</div>
          <div v-if="probe.errorMessage" class="border-t border-surface-700 px-3 py-1.5 text-xs text-red-400 italic">
            {{ probe.errorMessage }}
          </div>
        </div>
      </div>
    </div>

    <!-- Phase 2 (hit path) — Port Discovery -->
    <div v-if="portProbes.length > 0">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-semibold uppercase tracking-wider text-purple-400">
          Phase 2 — Port Discovery
        </span>
        <span class="text-xs text-surface-500">({{ portProbes.length }} probes)</span>
        <span
          v-if="portProbes.some(p => p.responseCode && p.responseCode < 400)"
          class="text-xs text-green-400 flex items-center gap-1 ml-auto"
        >
          <i class="fas fa-circle-check" /> Service found!
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <div
          v-for="probe in portProbes"
          :key="probe.id"
          :class="[
            'flex flex-col rounded overflow-hidden',
            probe.responseCode && probe.responseCode < 400
              ? 'bg-green-900/20 border border-green-500/20'
              : 'bg-surface-800',
          ]"
        >
          <div class="flex items-center gap-2 px-3 py-2 text-xs font-mono">
            <StatusBadge :status="probe.status" small />
            <span class="text-surface-400 w-28 shrink-0">{{ probe.payloadType }}</span>
            <span class="text-surface-300 truncate flex-1">{{ probe.payload }}</span>
            <span :class="['shrink-0 font-bold', statusColor(probe.responseCode)]">
              {{ probe.responseCode ?? "" }}
            </span>
            <button
              v-if="probe.responseSnippet"
              class="shrink-0 text-surface-500 hover:text-surface-300 transition-colors"
              :title="expandedSnippet === probe.id ? 'Hide response' : 'Show response'"
              @click="toggleSnippet(probe.id)"
            >
              <i :class="['fas', expandedSnippet === probe.id ? 'fa-chevron-up' : 'fa-chevron-down']" />
            </button>
          </div>
          <div
            v-if="probe.responseSnippet && expandedSnippet === probe.id"
            class="border-t border-surface-700 px-3 py-2 text-xs font-mono text-green-300 whitespace-pre-wrap break-all bg-surface-900 max-h-48 overflow-y-auto"
          >{{ probe.responseSnippet }}</div>
          <div v-if="probe.errorMessage" class="border-t border-surface-700 px-3 py-1.5 text-xs text-red-400 italic">
            {{ probe.errorMessage }}
          </div>
        </div>
      </div>
    </div>

    <!-- Phase 2 (miss path) — Header Injection -->
    <div v-if="headerProbes.length > 0">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-semibold uppercase tracking-wider text-yellow-400">
          Phase 2 — Header Injection
        </span>
        <span class="text-xs text-surface-500">({{ headerProbes.length }} probes)</span>
      </div>
      <div class="flex flex-col gap-1">
        <div
          v-for="probe in headerProbes"
          :key="probe.id"
          class="flex flex-col rounded bg-surface-800 overflow-hidden"
        >
          <div class="flex items-center gap-2 px-3 py-2 text-xs font-mono">
            <StatusBadge :status="probe.status" small />
            <span class="text-yellow-300/80 w-40 shrink-0 truncate">{{ probe.payload }}</span>
            <span class="text-surface-500 truncate flex-1 text-right">{{ probe.payloadType }}</span>
            <span :class="['shrink-0', statusColor(probe.responseCode)]">
              {{ probe.responseCode ?? "" }}
            </span>
            <button
              v-if="probe.responseSnippet"
              class="shrink-0 text-surface-500 hover:text-surface-300 transition-colors"
              @click="toggleSnippet(probe.id)"
            >
              <i :class="['fas', expandedSnippet === probe.id ? 'fa-chevron-up' : 'fa-chevron-down']" />
            </button>
          </div>
          <div
            v-if="probe.responseSnippet && expandedSnippet === probe.id"
            class="border-t border-surface-700 px-3 py-2 text-xs font-mono text-surface-400 whitespace-pre-wrap break-all bg-surface-900 max-h-40 overflow-y-auto"
          >{{ probe.responseSnippet }}</div>
        </div>
      </div>
    </div>

    <!-- Phase 3 — IP Bypass Encodings -->
    <div v-if="bypassProbes.length > 0">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-semibold uppercase tracking-wider text-orange-400">
          Phase 3 — IP Bypass Encodings
        </span>
        <span class="text-xs text-surface-500">({{ bypassProbes.length }} probes)</span>
      </div>
      <div class="flex flex-col gap-1">
        <div
          v-for="probe in bypassProbes"
          :key="probe.id"
          :class="[
            'flex flex-col rounded overflow-hidden',
            probe.responseCode && probe.responseCode < 400
              ? 'bg-orange-900/20 border border-orange-500/20'
              : 'bg-surface-800',
          ]"
        >
          <div class="flex items-center gap-2 px-3 py-2 text-xs font-mono">
            <StatusBadge :status="probe.status" small />
            <span class="text-surface-400 w-28 shrink-0">{{ probe.payloadType }}</span>
            <span class="text-surface-300 truncate flex-1">{{ probe.payload }}</span>
            <span :class="['shrink-0 font-bold', statusColor(probe.responseCode)]">
              {{ probe.responseCode ?? "" }}
            </span>
            <button
              v-if="probe.responseSnippet"
              class="shrink-0 text-surface-500 hover:text-surface-300 transition-colors"
              @click="toggleSnippet(probe.id)"
            >
              <i :class="['fas', expandedSnippet === probe.id ? 'fa-chevron-up' : 'fa-chevron-down']" />
            </button>
          </div>
          <div
            v-if="probe.responseSnippet && expandedSnippet === probe.id"
            class="border-t border-surface-700 px-3 py-2 text-xs font-mono text-orange-300 whitespace-pre-wrap break-all bg-surface-900 max-h-48 overflow-y-auto"
          >{{ probe.responseSnippet }}</div>
          <div v-if="probe.errorMessage" class="border-t border-surface-700 px-3 py-1.5 text-xs text-red-400 italic">
            {{ probe.errorMessage }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="probes.length === 0" class="text-surface-500 text-xs text-center py-4">
      No probes sent yet
    </div>
  </div>
</template>
