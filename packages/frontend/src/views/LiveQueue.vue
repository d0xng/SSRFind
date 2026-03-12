<script setup lang="ts">
import { computed, ref } from "vue";
import StatusBadge from "../components/StatusBadge.vue";
import ProbeDetail from "../components/ProbeDetail.vue";
import { useSSRFStore } from "../stores/ssrfStore";
import type { Candidate } from "../types";

const ssrfStore = useSSRFStore();

const filterStatus = ref<"all" | "unconfirmed" | "confirmed" | "false_positive">("all");
const filterHost = ref("");
const runningIds = ref<Set<string>>(new Set());

const filteredCandidates = computed(() => {
  let list = ssrfStore.candidates;
  if (filterStatus.value !== "all") {
    list = list.filter((c) => c.confirmStatus === filterStatus.value);
  }
  if (filterHost.value.trim()) {
    const q = filterHost.value.trim().toLowerCase();
    list = list.filter(
      (c) => c.host.toLowerCase().includes(q) || c.path.toLowerCase().includes(q)
    );
  }
  return list;
});

function selectCandidate(candidate: Candidate): void {
  ssrfStore.selectedCandidateId =
    ssrfStore.selectedCandidateId === candidate.id ? null : candidate.id;
}

function isRunning(id: string): boolean {
  return runningIds.value.has(id);
}

async function withRunning(id: string, fn: () => Promise<void>): Promise<void> {
  runningIds.value = new Set([...runningIds.value, id]);
  try {
    await fn();
  } finally {
    const next = new Set(runningIds.value);
    next.delete(id);
    runningIds.value = next;
  }
}

async function onPortScan(id: string): Promise<void> {
  await withRunning(id, () => ssrfStore.runPortScan(id));
}

async function onHeaders(id: string): Promise<void> {
  await withRunning(id, () => ssrfStore.runHeaders(id));
}

async function onIpBypass(id: string): Promise<void> {
  await withRunning(id, () => ssrfStore.runIpBypass(id));
}

function getCandidateBadgeStatus(c: Candidate): string {
  if (c.confirmStatus === "confirmed") return "exploitable";
  if (c.ipBypassDone) return "ip_bypass";
  if (c.portScanDone) return "port_scan";
  if (c.headersDone) return "headers";
  if (c.phase1Done) return "phase1";
  return "pending";
}

/** Returns true if any port scan probe got a 2xx/3xx response (service found). */
function portScanHadHit(id: string): boolean {
  const probes = ssrfStore.probeMap[id] ?? [];
  return probes.some(
    (p) => p.payloadGroup === "port_scan" && p.responseCode !== undefined && p.responseCode < 400
  );
}

const METHOD_COLORS: Record<string, string> = {
  GET:    "text-green-400",
  POST:   "text-blue-400",
  PUT:    "text-yellow-400",
  DELETE: "text-red-400",
  PATCH:  "text-purple-400",
};

const VECTOR_LABELS: Record<string, string> = {
  query_param: "Query Param",
  body_json:   "JSON Body",
  body_form:   "Form Body",
  header:      "Header",
};
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Filters toolbar -->
    <div class="flex items-center gap-3 px-4 py-3 border-b border-surface-700 flex-shrink-0">
      <input
        v-model="filterHost"
        type="text"
        placeholder="Filter by host or path..."
        class="flex-1 bg-surface-800 border border-surface-700 rounded px-3 py-1.5 text-sm text-surface-100 placeholder-surface-500 outline-none focus:border-blue-500/50"
      />
      <select
        v-model="filterStatus"
        class="bg-surface-800 border border-surface-700 rounded px-3 py-1.5 text-sm text-surface-100 outline-none focus:border-blue-500/50"
      >
        <option value="all">All</option>
        <option value="unconfirmed">Unconfirmed</option>
        <option value="confirmed">Confirmed</option>
        <option value="false_positive">False Positive</option>
      </select>
      <span class="text-surface-500 text-xs shrink-0">
        {{ filteredCandidates.length }} candidate{{ filteredCandidates.length !== 1 ? "s" : "" }}
      </span>
    </div>

    <!-- Main content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Candidate list -->
      <div
        :class="[
          'flex flex-col overflow-y-auto transition-all duration-200',
          ssrfStore.selectedCandidateId ? 'w-1/2' : 'w-full',
        ]"
      >
        <div
          v-if="filteredCandidates.length === 0"
          class="flex flex-col items-center justify-center gap-2 py-16 text-surface-500"
        >
          <i class="fas fa-radar text-3xl" />
          <p class="text-sm">No candidates detected yet</p>
          <p class="text-xs">SSRFind is monitoring your traffic passively</p>
        </div>

        <div
          v-for="candidate in filteredCandidates"
          :key="candidate.id"
          :class="[
            'flex flex-col px-4 py-3 border-b border-surface-700/50 cursor-pointer hover:bg-surface-800/60 transition-colors',
            ssrfStore.selectedCandidateId === candidate.id && 'bg-surface-800',
          ]"
          @click="selectCandidate(candidate)"
        >
          <!-- Row top: method + host + badge -->
          <div class="flex items-center gap-2 min-w-0">
            <span :class="['font-mono text-xs font-bold w-14 shrink-0', METHOD_COLORS[candidate.method] ?? 'text-surface-300']">
              {{ candidate.method }}
            </span>
            <span class="font-mono text-xs text-surface-200 truncate flex-1">
              {{ candidate.host }}{{ candidate.path }}
            </span>
            <StatusBadge :status="getCandidateBadgeStatus(candidate)" small />
          </div>

          <!-- Row bottom: vector + param + probes count -->
          <div class="flex items-center gap-2 mt-1.5 ml-16">
            <span class="text-xs text-surface-500">{{ VECTOR_LABELS[candidate.vector] ?? candidate.vector }}</span>
            <span class="text-surface-600">·</span>
            <span class="font-mono text-xs text-blue-300">{{ candidate.paramName }}</span>
            <span class="text-surface-600">·</span>
            <span class="text-xs text-surface-500">{{ candidate.probeCount }} probes</span>

            <!-- Phase 1 running spinner -->
            <span
              v-if="!candidate.phase1Done || isRunning(candidate.id)"
              class="ml-auto text-xs text-orange-400 flex items-center gap-1"
            >
              <i class="fas fa-spinner animate-spin text-xs" />
              {{ !candidate.phase1Done ? "Phase 1..." : "Running..." }}
            </span>
          </div>

          <!-- ─── Action area (shown after Phase 1 completes) ─── -->
          <div
            v-if="candidate.phase1Done && candidate.confirmStatus !== 'false_positive'"
            class="ml-16 mt-2.5 flex flex-col gap-2"
          >

            <!-- Phase 1 done, awaiting user decision -->
            <template v-if="!candidate.portScanDone && !candidate.headersDone && !isRunning(candidate.id)">
              <p class="text-xs text-yellow-400 flex items-center gap-1.5">
                <i class="fas fa-eye" />
                Check your OOB tool — did a callback arrive?
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <button
                  class="flex items-center gap-1.5 px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-xs transition-colors"
                  @click.stop="onPortScan(candidate.id)"
                >
                  <i class="fas fa-check" /> Callback received → Port Scan
                </button>
                <button
                  class="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-900 hover:bg-rose-800 text-rose-100 text-xs transition-colors"
                  @click.stop="onHeaders(candidate.id)"
                >
                  <i class="fas fa-xmark" /> No callback → Try Headers
                </button>
                <button
                  class="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-700 hover:bg-surface-600 text-surface-400 text-xs transition-colors"
                  @click.stop="ssrfStore.markFalsePositive(candidate.id)"
                >
                  False positive
                </button>
              </div>
            </template>

            <!-- Port scan running -->
            <template v-if="candidate.portScanDone === false && candidate.confirmStatus === 'confirmed' && isRunning(candidate.id)">
              <p class="text-xs text-purple-400 flex items-center gap-1.5">
                <i class="fas fa-spinner animate-spin" /> Scanning ports on 127.0.0.1...
              </p>
            </template>

            <!-- Port scan done — show results and next options -->
            <template v-if="candidate.portScanDone && !candidate.ipBypassDone && !isRunning(candidate.id)">
              <p
                v-if="portScanHadHit(candidate.id)"
                class="text-xs text-green-400 flex items-center gap-1.5"
              >
                <i class="fas fa-circle-check" />
                Service responding! Check probe responses below.
              </p>
              <p
                v-else
                class="text-xs text-surface-400 flex items-center gap-1.5"
              >
                <i class="fas fa-circle-xmark text-surface-500" />
                No service responded on common ports.
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-if="portScanHadHit(candidate.id)"
                  class="flex items-center gap-1.5 px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-xs transition-colors"
                  @click.stop="() => {}"
                >
                  <i class="fas fa-flag" /> Confirm Port Discovery
                </button>
                <button
                  class="flex items-center gap-1.5 px-3 py-1 rounded bg-orange-700/60 hover:bg-orange-700 text-orange-100 text-xs transition-colors"
                  @click.stop="onIpBypass(candidate.id)"
                >
                  <i class="fas fa-code-branch" /> Try IP Bypasses
                </button>
              </div>
            </template>

            <!-- IP bypass running -->
            <template v-if="candidate.ipBypassDone === false && isRunning(candidate.id)">
              <p class="text-xs text-orange-400 flex items-center gap-1.5">
                <i class="fas fa-spinner animate-spin" /> Testing IP bypass encodings...
              </p>
            </template>

            <!-- IP bypass done -->
            <template v-if="candidate.ipBypassDone && !isRunning(candidate.id)">
              <p class="text-xs text-surface-400 flex items-center gap-1.5">
                <i class="fas fa-check-double text-surface-500" />
                IP bypass scan complete. Check responses for service banners.
              </p>
            </template>

            <!-- Headers running -->
            <template v-if="candidate.headersDone === false && isRunning(candidate.id) && !candidate.portScanDone">
              <p class="text-xs text-yellow-400 flex items-center gap-1.5">
                <i class="fas fa-spinner animate-spin" /> Injecting SSRF headers...
              </p>
            </template>

            <!-- Headers done -->
            <template v-if="candidate.headersDone && !isRunning(candidate.id)">
              <p class="text-xs text-surface-400 flex items-center gap-1.5">
                <i class="fas fa-check-double text-surface-500" />
                Header injection complete. Check your OOB tool again.
              </p>
            </template>

          </div>
        </div>
      </div>

      <!-- Detail panel -->
      <div
        v-if="ssrfStore.selectedCandidateId && ssrfStore.selectedCandidate"
        class="w-1/2 border-l border-surface-700 overflow-y-auto flex flex-col"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-surface-700 flex-shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <span :class="['font-mono text-xs font-bold', METHOD_COLORS[ssrfStore.selectedCandidate.method] ?? 'text-surface-300']">
              {{ ssrfStore.selectedCandidate.method }}
            </span>
            <span class="font-mono text-xs text-surface-200 truncate">
              {{ ssrfStore.selectedCandidate.host }}{{ ssrfStore.selectedCandidate.path }}
            </span>
          </div>
          <button
            class="text-surface-500 hover:text-surface-300 shrink-0 ml-2"
            @click="ssrfStore.selectedCandidateId = null"
          >
            <i class="fas fa-xmark" />
          </button>
        </div>

        <div class="px-4 py-3 border-b border-surface-700 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div>
            <span class="text-surface-500">Vector: </span>
            <span class="text-surface-300">{{ VECTOR_LABELS[ssrfStore.selectedCandidate.vector] }}</span>
          </div>
          <div>
            <span class="text-surface-500">Param: </span>
            <span class="font-mono text-blue-300">{{ ssrfStore.selectedCandidate.paramName }}</span>
          </div>
          <div>
            <span class="text-surface-500">Original: </span>
            <span class="font-mono text-surface-300">{{ ssrfStore.selectedCandidate.originalValue || "(empty)" }}</span>
          </div>
        </div>

        <div class="p-4 flex-1">
          <ProbeDetail :probes="ssrfStore.probesForSelected" />
        </div>
      </div>
    </div>
  </div>
</template>
