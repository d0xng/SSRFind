import type { DefineAPI, DefineEvents, SDK } from "caido:plugin";

import {
  dispatchHeaders,
  dispatchIpBypass,
  dispatchPhase1,
  dispatchPortScan,
  setCandidateEmitter,
  setProbeEmitter,
} from "./probes";
import { buildCandidate, scanRequest } from "./scanner";
import { getSettings, resetSettings, updateSettings } from "./settings";
import { getSettingsInternal } from "./settings";
import type { Candidate, ConfirmStatus, Probe } from "./storage";
import {
  addCandidate,
  cacheRequest,
  clearCandidates,
  getCandidates,
  getProbes,
  getProbesByCandidateId,
  getStats,
  incrementRequestsAnalyzed,
  isDuplicate,
  setConfirmStatus,
} from "./storage";

function isInScope(sdk: SDK, request: Parameters<typeof sdk.requests.inScope>[0]): boolean {
  try {
    return sdk.requests.inScope(request);
  } catch {
    return false;
  }
}

export type API = DefineAPI<{
  getSettings: typeof getSettings;
  updateSettings: typeof updateSettings;
  resetSettings: typeof resetSettings;
  getCandidates: typeof getCandidates;
  getProbes: typeof getProbes;
  getProbesByCandidateId: typeof getProbesByCandidateId;
  getStats: typeof getStats;
  clearCandidates: typeof clearCandidates;
  setConfirmStatus: typeof setConfirmStatus;
  runPortScan: typeof runPortScan;
  runHeaders: typeof runHeaders;
  runIpBypass: typeof runIpBypass;
  scanHistory: typeof scanHistory;
  getScopeCount: typeof getScopeCount;
  getScopeList: typeof getScopeList;
}>;

export type BackendEvents = DefineEvents<{
  onNewCandidate: (candidate: Candidate) => void;
  onProbeUpdate: (probe: Probe) => void;
  onStatsUpdate: () => void;
}>;

let sdkInstance: SDK<API, BackendEvents> | undefined;

function emit<K extends keyof BackendEvents>(
  event: K,
  ...args: Parameters<BackendEvents[K]>
): void {
  if (!sdkInstance) return;
  // @ts-expect-error variadic send
  sdkInstance.api.send(event, ...args);
}

async function getScopeCount(sdk: SDK): Promise<number> {
  try {
    const scopes = await sdk.scope.getAll();
    return scopes.length;
  } catch {
    return 0;
  }
}

interface ScopeInfo {
  id: string;
  name: string;
  allowlist: string[];
  denylist: string[];
}

async function getScopeList(sdk: SDK): Promise<ScopeInfo[]> {
  try {
    const scopes = await sdk.scope.getAll();
    return scopes.map((s) => ({
      id: String(s.id),
      name: s.name,
      allowlist: s.allowlist,
      denylist: s.denylist,
    }));
  } catch {
    return [];
  }
}

/**
 * Phase 2 (hit path) — Port discovery on 127.0.0.1.
 * Called after user confirms Phase 1 OOB callback.
 */
async function runPortScan(sdk: SDK, candidateId: string): Promise<void> {
  const candidates = getCandidates(sdk);
  const candidate = candidates.find((c) => c.id === candidateId);
  if (!candidate) return;
  setConfirmStatus(sdk, candidateId, "confirmed");
  await dispatchPortScan(sdk, candidate);
  emit("onStatsUpdate");
}

/**
 * Phase 2 (miss path) — Header injection fallback.
 * Called when Phase 1 OOB had no callback.
 */
async function runHeaders(sdk: SDK, candidateId: string): Promise<void> {
  const candidates = getCandidates(sdk);
  const candidate = candidates.find((c) => c.id === candidateId);
  if (!candidate) return;
  await dispatchHeaders(sdk, candidate);
  emit("onStatsUpdate");
}

/**
 * Phase 3 — IP bypass encodings (decimal, octal, hex, IPv6, etc.).
 * Called when port scan found no responding service.
 */
async function runIpBypass(sdk: SDK, candidateId: string): Promise<void> {
  const candidates = getCandidates(sdk);
  const candidate = candidates.find((c) => c.id === candidateId);
  if (!candidate) return;
  await dispatchIpBypass(sdk, candidate);
  emit("onStatsUpdate");
}

async function scanHistory(sdk: SDK): Promise<number> {
  const settings = getSettingsInternal();
  if (!settings.oobUrl) return 0;

  const page = await sdk.requests.query().first(200).execute();
  let found = 0;

  for (const item of page.items) {
    const request = item.request;
    if (!isInScope(sdk, request)) continue;

    const vectors = scanRequest(request, settings.customSsrfParams);
    for (const vector of vectors) {
      if (isDuplicate(request.getHost(), request.getPath(), vector.paramName, vector.vector)) continue;
      const candidate = buildCandidate(request, vector);
      addCandidate(candidate);

      try {
        const hdrs: Record<string, string> = {};
        const rawHeaders = request.getHeaders();
        for (const [name, values] of Object.entries(rawHeaders)) {
          hdrs[name] = values.join(", ");
        }
        const ct = (request.getHeader("content-type") ?? [""])[0] ?? "";
        cacheRequest(candidate.id, {
          url: request.getUrl(),
          method: request.getMethod(),
          path: request.getPath(),
          query: request.getQuery(),
          host: request.getHost(),
          port: request.getPort(),
          isTls: request.getTls(),
          headers: hdrs,
          bodyText: request.getBody()?.toText() ?? null,
          contentType: ct,
        });
      } catch {
        // no-op
      }

      emit("onNewCandidate", candidate);
      found++;
      void dispatchPhase1(sdk, candidate).then(() => emit("onStatsUpdate"));
    }
  }

  return found;
}

export function init(sdk: SDK<API, BackendEvents>): void {
  sdkInstance = sdk;
  sdk.console.log("SSRFind: backend initialized");

  setProbeEmitter((probe: Probe) => {
    emit("onProbeUpdate", probe);
  });

  setCandidateEmitter((candidate: Candidate) => {
    emit("onNewCandidate", candidate);
  });

  sdk.api.register("getSettings", getSettings);
  sdk.api.register("updateSettings", updateSettings);
  sdk.api.register("resetSettings", resetSettings);
  sdk.api.register("getCandidates", getCandidates);
  sdk.api.register("getProbes", getProbes);
  sdk.api.register("getProbesByCandidateId", getProbesByCandidateId);
  sdk.api.register("getStats", getStats);
  sdk.api.register("clearCandidates", clearCandidates);
  sdk.api.register("setConfirmStatus", setConfirmStatus);
  sdk.api.register("runPortScan", runPortScan);
  sdk.api.register("runHeaders", runHeaders);
  sdk.api.register("runIpBypass", runIpBypass);
  sdk.api.register("scanHistory", scanHistory);
  sdk.api.register("getScopeCount", getScopeCount);
  sdk.api.register("getScopeList", getScopeList);

  sdk.events.onInterceptResponse((eventSdk, request) => {
    const settings = getSettingsInternal();
    if (!settings.oobUrl) return;

    if (!isInScope(eventSdk, request)) {
      sdk.console.log(`SSRFind: out-of-scope, skipping — ${request.getHost()}`);
      return;
    }

    incrementRequestsAnalyzed();
    emit("onStatsUpdate");

    sdk.console.log(`SSRFind: analyzing — ${request.getMethod()} ${request.getHost()}${request.getPath()}`);

    const vectors = scanRequest(request, settings.customSsrfParams);

    if (vectors.length === 0) {
      sdk.console.log(`SSRFind: no SSRF vectors found`);
    }

    for (const vector of vectors) {
      if (isDuplicate(request.getHost(), request.getPath(), vector.paramName, vector.vector)) {
        sdk.console.log(`SSRFind: duplicate, skipping — [${vector.paramName}]`);
        continue;
      }

      const candidate = buildCandidate(request, vector);
      addCandidate(candidate);

      try {
        const hdrs: Record<string, string> = {};
        const rawHeaders = request.getHeaders();
        for (const [name, values] of Object.entries(rawHeaders)) {
          hdrs[name] = values.join(", ");
        }
        const ct = (request.getHeader("content-type") ?? [""])[0] ?? "";
        cacheRequest(candidate.id, {
          url: request.getUrl(),
          method: request.getMethod(),
          path: request.getPath(),
          query: request.getQuery(),
          host: request.getHost(),
          port: request.getPort(),
          isTls: request.getTls(),
          headers: hdrs,
          bodyText: request.getBody()?.toText() ?? null,
          contentType: ct,
        });
      } catch (err) {
        sdk.console.log(`SSRFind: failed to cache request — ${String(err)}`);
      }

      emit("onNewCandidate", candidate);
      sdk.console.log(`SSRFind: ✓ candidate — ${request.getHost()}${request.getPath()} [${vector.paramName}] via ${vector.vector}`);

      if (settings.autoProbeMode) {
        void dispatchPhase1(eventSdk, candidate).then(() => emit("onStatsUpdate"));
      }
    }
  });

  sdk.console.log("SSRFind: passive listener active");
}
