import { inject } from "vue";
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { SDK_KEY } from "../plugins/sdk";
import type { FrontendSDK, Candidate, Probe, Stats } from "../types";

export const useSSRFStore = defineStore("ssrf", () => {
  const sdk = inject<FrontendSDK>(SDK_KEY)!;

  const candidates = ref<Candidate[]>([]);
  const probeMap = ref<Record<string, Probe[]>>({});
  const stats = ref<Stats>({
    requestsAnalyzed: 0,
    candidatesFound: 0,
    probesSent: 0,
    probesError: 0,
    confirmed: 0,
  });
  const selectedCandidateId = ref<string | null>(null);
  const isLoading = ref(false);

  const confirmed = computed(() =>
    candidates.value.filter((c) => c.confirmStatus === "confirmed")
  );

  const pendingCandidates = computed(() =>
    candidates.value.filter((c) => c.confirmStatus === "unconfirmed")
  );

  const selectedCandidate = computed(() =>
    candidates.value.find((c) => c.id === selectedCandidateId.value) ?? null
  );

  const probesForSelected = computed(() =>
    selectedCandidateId.value
      ? (probeMap.value[selectedCandidateId.value] ?? [])
      : []
  );

  function upsertCandidate(candidate: Candidate): void {
    const idx = candidates.value.findIndex((c) => c.id === candidate.id);
    if (idx === -1) {
      candidates.value.unshift(candidate);
    } else {
      candidates.value[idx] = candidate;
    }
  }

  function upsertProbe(probe: Probe): void {
    const list = probeMap.value[probe.candidateId] ?? [];
    const idx = list.findIndex((p) => p.id === probe.id);
    if (idx === -1) {
      list.push(probe);
    } else {
      list[idx] = probe;
    }
    probeMap.value[probe.candidateId] = list;

    const candidate = candidates.value.find((c) => c.id === probe.candidateId);
    if (candidate) {
      candidate.probeCount = list.length;
    }
  }

  async function loadInitialData(): Promise<void> {
    isLoading.value = true;
    try {
      const [remoteCandidates, remoteProbes, remoteStats] = await Promise.all([
        sdk.backend.getCandidates(),
        sdk.backend.getProbes(),
        sdk.backend.getStats(),
      ]);
      candidates.value = remoteCandidates;
      for (const probe of remoteProbes) {
        upsertProbe(probe);
      }
      stats.value = remoteStats;
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshStats(): Promise<void> {
    stats.value = await sdk.backend.getStats();
  }

  /** Phase 2 (hit path): Port discovery after user confirms OOB callback. */
  async function runPortScan(candidateId: string): Promise<void> {
    await sdk.backend.runPortScan(candidateId);
    const c = candidates.value.find((c) => c.id === candidateId);
    if (c) c.confirmStatus = "confirmed";
    await refreshStats();
  }

  /** Phase 2 (miss path): Header injection when no OOB callback was received. */
  async function runHeaders(candidateId: string): Promise<void> {
    await sdk.backend.runHeaders(candidateId);
    await refreshStats();
  }

  /** Phase 3: IP bypass encodings after port scan finds nothing. */
  async function runIpBypass(candidateId: string): Promise<void> {
    await sdk.backend.runIpBypass(candidateId);
    await refreshStats();
  }

  async function markFalsePositive(candidateId: string): Promise<void> {
    await sdk.backend.setConfirmStatus(candidateId, "false_positive");
    const c = candidates.value.find((c) => c.id === candidateId);
    if (c) c.confirmStatus = "false_positive";
  }

  async function clearAll(): Promise<void> {
    await sdk.backend.clearCandidates();
    candidates.value = [];
    probeMap.value = {};
    stats.value = await sdk.backend.getStats();
  }

  async function runHistoryScan(): Promise<number> {
    const found = await sdk.backend.scanHistory();
    await refreshStats();
    return found;
  }

  function setupEventListeners(): void {
    sdk.backend.onEvent("onNewCandidate", (candidate) => {
      upsertCandidate(candidate);
    });

    sdk.backend.onEvent("onProbeUpdate", (probe) => {
      upsertProbe(probe);
    });

    sdk.backend.onEvent("onStatsUpdate", async () => {
      await refreshStats();
    });
  }

  return {
    candidates,
    probeMap,
    stats,
    selectedCandidateId,
    isLoading,
    confirmed,
    pendingCandidates,
    selectedCandidate,
    probesForSelected,
    loadInitialData,
    runPortScan,
    runHeaders,
    runIpBypass,
    markFalsePositive,
    clearAll,
    runHistoryScan,
    setupEventListeners,
    upsertCandidate,
    upsertProbe,
  };
});
