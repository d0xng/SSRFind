<script setup lang="ts">
import { computed, ref } from "vue";
import StatusBadge from "../components/StatusBadge.vue";
import ProbeDetail from "../components/ProbeDetail.vue";
import { useSSRFStore } from "../stores/ssrfStore";
import type { Candidate } from "../types";

const ssrfStore = useSSRFStore();
const selectedId = ref<string | null>(null);

const confirmed = computed(() => ssrfStore.confirmed);

const selectedCandidate = computed<Candidate | null>(
  () => confirmed.value.find((c) => c.id === selectedId.value) ?? null
);

const selectedProbes = computed(() =>
  selectedId.value ? (ssrfStore.probeMap[selectedId.value] ?? []) : []
);

function buildCurlPoC(candidate: Candidate): string {
  const probes = ssrfStore.probeMap[candidate.id] ?? [];
  const phase2Hit = probes.find(
    (p) => p.phase === 2 && p.status === "sent"
  );
  const payload = phase2Hit?.payload ?? probes[0]?.payload ?? "PAYLOAD";

  if (candidate.vector === "query_param") {
    return `curl -i "${candidate.method === "GET" ? "" : "-X " + candidate.method + " "}https://${candidate.host}${candidate.path}?${candidate.paramName}=${encodeURIComponent(payload)}"`;
  }
  if (candidate.vector === "body_json") {
    return `curl -i -X ${candidate.method} -H "Content-Type: application/json" -d '{"${candidate.paramName}": "${payload}"}' https://${candidate.host}${candidate.path}`;
  }
  if (candidate.vector === "header_inject" || candidate.vector === "header") {
    return `curl -i -X ${candidate.method} -H "${candidate.paramName}: ${payload}" https://${candidate.host}${candidate.path}`;
  }
  return `curl -i -X ${candidate.method} -d "${candidate.paramName}=${encodeURIComponent(payload)}" https://${candidate.host}${candidate.path}`;
}

async function copyPoC(candidate: Candidate): Promise<void> {
  const poc = buildCurlPoC(candidate);
  await navigator.clipboard.writeText(poc);
}

const METHOD_COLORS: Record<string, string> = {
  GET:    "text-green-400",
  POST:   "text-blue-400",
  PUT:    "text-yellow-400",
  DELETE: "text-red-400",
  PATCH:  "text-purple-400",
};
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-surface-700 flex-shrink-0 flex items-center gap-3">
      <h3 class="text-sm font-semibold text-surface-100 flex items-center gap-2">
        <i class="fas fa-bullseye text-green-400" />
        Confirmed Findings
      </h3>
      <span class="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-500/30">
        {{ confirmed.length }}
      </span>
    </div>

    <!-- Empty state -->
    <div
      v-if="confirmed.length === 0"
      class="flex flex-col items-center justify-center gap-3 py-20 text-surface-500"
    >
      <i class="fas fa-shield-halved text-4xl text-surface-600" />
      <p class="text-sm">No confirmed findings yet</p>
      <p class="text-xs text-surface-600">
        When you confirm a hit from QuickSSRF in the Live Queue, it will appear here
      </p>
    </div>

    <!-- Findings list + detail -->
    <div v-else class="flex flex-1 overflow-hidden">
      <!-- List -->
      <div
        :class="[
          'flex flex-col overflow-y-auto border-r border-surface-700',
          selectedId ? 'w-2/5' : 'w-full',
        ]"
      >
        <div
          v-for="candidate in confirmed"
          :key="candidate.id"
          :class="[
            'flex flex-col px-4 py-4 border-b border-surface-700/50 cursor-pointer hover:bg-surface-800/60 transition-colors',
            selectedId === candidate.id && 'bg-surface-800',
          ]"
          @click="selectedId = selectedId === candidate.id ? null : candidate.id"
        >
          <div class="flex items-center gap-2 min-w-0">
            <StatusBadge status="exploitable" />
            <span :class="['font-mono text-xs font-bold w-14 shrink-0', METHOD_COLORS[candidate.method] ?? 'text-surface-300']">
              {{ candidate.method }}
            </span>
            <span class="font-mono text-xs text-surface-200 truncate">
              {{ candidate.host }}{{ candidate.path }}
            </span>
          </div>
          <div class="flex items-center gap-2 mt-2 text-xs">
            <span class="text-surface-500">Parameter:</span>
            <span class="font-mono text-blue-300">{{ candidate.paramName }}</span>
            <span class="text-surface-600">·</span>
            <span class="text-surface-500">{{ candidate.probeCount }} probes</span>
            <span class="text-surface-600">·</span>
            <span class="text-surface-500">
              {{ candidate.portScanDone ? "Port scan ✓" : candidate.headersDone ? "Headers ✓" : "Phase 1 ✓" }}
              {{ candidate.ipBypassDone ? " · IP bypass ✓" : "" }}
            </span>
          </div>

          <!-- Action buttons -->
          <div class="flex items-center gap-2 mt-3">
            <button
              class="flex items-center gap-1.5 px-3 py-1 rounded bg-surface-700 hover:bg-surface-600 text-surface-200 text-xs transition-colors"
              @click.stop="copyPoC(candidate)"
            >
              <i class="fas fa-copy" />
              Copy PoC
            </button>
            <button
              class="flex items-center gap-1.5 px-3 py-1 rounded bg-surface-700 hover:bg-surface-600 text-surface-200 text-xs transition-colors"
              @click.stop="selectedId = candidate.id"
            >
              <i class="fas fa-list" />
              View Probes
            </button>
          </div>
        </div>
      </div>

      <!-- Detail panel -->
      <div
        v-if="selectedId && selectedCandidate"
        class="flex-1 overflow-y-auto"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-surface-700">
          <span class="text-xs font-semibold text-surface-300 flex items-center gap-2">
            <i class="fas fa-list text-surface-500" />
            Probe Details
          </span>
          <button
            class="text-surface-500 hover:text-surface-300"
            @click="selectedId = null"
          >
            <i class="fas fa-xmark" />
          </button>
        </div>
        <div class="p-4">
          <ProbeDetail :probes="selectedProbes" />
        </div>
      </div>
    </div>
  </div>
</template>
