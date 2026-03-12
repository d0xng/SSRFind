import type { SDK } from "caido:plugin";
import { RequestSpec, Body } from "caido:utils";

import { generateHeaderPayloads } from "./headerInjector";
import {
  extractOobHost,
  generateIpBypassPayloads,
  generatePhase1Payload,
  generatePortScanPayloads,
} from "./payloads";
import { getSettingsInternal } from "./settings";
import type { Candidate, CachedRequest, Phase, Probe } from "./storage";
import {
  addProbe,
  getCachedRequest,
  incrementProbesError,
  incrementProbesSent,
  updateCandidate,
  updateProbe,
} from "./storage";

let emitProbeUpdate: ((probe: Probe) => void) | null = null;
let emitCandidateUpdate: ((candidate: Candidate) => void) | null = null;

export function setProbeEmitter(fn: (probe: Probe) => void): void {
  emitProbeUpdate = fn;
}

export function setCandidateEmitter(fn: (candidate: Candidate) => void): void {
  emitCandidateUpdate = fn;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeProbeId(candidateId: string, group: string, type: string): string {
  return `${candidateId}|${group}|${type}|${Date.now()}`;
}

function replaceInQS(qs: string, name: string, newValue: string): string {
  const enc = encodeURIComponent(name);
  const encVal = encodeURIComponent(newValue);
  const re = new RegExp(`(^|&)(${enc}|${name})=[^&]*`, "g");
  let found = false;
  const replaced = qs.replace(re, (_match, prefix: string) => {
    found = true;
    return `${prefix}${enc}=${encVal}`;
  });
  if (!found) {
    return qs ? `${qs}&${enc}=${encVal}` : `${enc}=${encVal}`;
  }
  return replaced;
}

function replaceInJson(bodyText: string, name: string, newValue: string): string {
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    parsed[name] = newValue;
    return JSON.stringify(parsed);
  } catch {
    return bodyText.replace(
      new RegExp(`("${name}"\\s*:\\s*)"[^"]*"`),
      `$1"${newValue.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    );
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

function buildSpec(
  cached: CachedRequest,
  candidate: Candidate,
  payloadValue: string,
  isHeaderInjection: boolean,
  headerName?: string
): RequestSpec {
  const scheme = cached.isTls ? "https" : "http";
  const defaultPort = cached.isTls ? 443 : 80;
  const portSuffix = cached.port !== defaultPort ? `:${cached.port}` : "";

  let query = cached.query;
  let bodyText = cached.bodyText;

  if (!isHeaderInjection) {
    if (candidate.vector === "query_param") {
      query = replaceInQS(cached.query, candidate.paramName, payloadValue);
    } else if (candidate.vector === "body_form") {
      bodyText = replaceInQS(cached.bodyText ?? "", candidate.paramName, payloadValue);
    } else if (candidate.vector === "body_json") {
      bodyText = replaceInJson(cached.bodyText ?? "{}", candidate.paramName, payloadValue);
    }
  }

  const baseUrl = `${scheme}://${cached.host}${portSuffix}${cached.path}`;
  const spec = new RequestSpec(baseUrl);

  spec.setMethod(cached.method);
  spec.setHost(cached.host);
  spec.setPort(cached.port);
  spec.setTls(cached.isTls);

  if (query) {
    spec.setQuery(query);
  }

  const skipHeaders = new Set(["host", "content-length", "transfer-encoding", "connection"]);
  for (const [name, value] of Object.entries(cached.headers)) {
    if (skipHeaders.has(name.toLowerCase())) continue;
    spec.setHeader(name, value);
  }

  if (isHeaderInjection && headerName) {
    spec.setHeader(headerName, payloadValue);
  }

  if (bodyText && cached.method !== "GET" && cached.method !== "HEAD") {
    spec.setBody(new Body(bodyText), { updateContentLength: true });
  }

  return spec;
}

interface SendResult {
  statusCode: number;
  responseSnippet: string | undefined;
}

/**
 * Sends a single probe through Caido's engine (respects proxy, QuickSSRF sees it).
 * Captures response code + first 600 chars of response body for port/service detection.
 * Returns undefined on error (caller handles error state).
 */
async function sendProbe(
  sdk: SDK,
  candidate: Candidate,
  payloadValue: string,
  isHeaderInjection: boolean,
  headerName?: string
): Promise<SendResult | undefined> {
  const cached = getCachedRequest(candidate.id);
  if (!cached) {
    sdk.console.log(`SSRFind: no cached request for ${candidate.id}`);
    return undefined;
  }

  const spec = buildSpec(cached, candidate, payloadValue, isHeaderInjection, headerName);

  const result = await withTimeout(
    sdk.requests.send(spec, { save: false, plugins: false }),
    15000
  );

  const statusCode = result.response.getCode();
  const bodyText = result.response.getBody()?.toText() ?? "";
  const responseSnippet = bodyText.slice(0, 600) || undefined;

  sdk.console.log(
    `SSRFind: probe [${candidate.paramName}] ${isHeaderInjection ? `hdr:${String(headerName)}` : payloadValue.slice(0, 60)} → HTTP ${statusCode}`
  );

  return { statusCode, responseSnippet };
}

/**
 * Creates a probe record, sends it, and updates its state.
 * Returns the finalized probe.
 */
async function runProbe(
  sdk: SDK,
  candidate: Candidate,
  phase: Phase,
  payloadGroup: Probe["payloadGroup"],
  payloadType: string,
  payloadValue: string,
  isHeaderInjection: boolean,
  headerName?: string
): Promise<Probe> {
  const probe: Probe = {
    id: makeProbeId(candidate.id, payloadGroup, payloadType),
    candidateId: candidate.id,
    phase,
    payloadGroup,
    payloadType,
    payload: isHeaderInjection ? (headerName ?? payloadValue) : payloadValue,
    status: "pending",
    timestamp: Date.now(),
  };
  addProbe(probe);
  emitProbeUpdate?.(probe);

  try {
    const res = await sendProbe(sdk, candidate, payloadValue, isHeaderInjection, headerName);
    const updated = updateProbe(probe.id, {
      status: "sent",
      responseCode: res?.statusCode,
      responseSnippet: res?.responseSnippet,
    });
    incrementProbesSent();
    if (updated) emitProbeUpdate?.(updated);
    return updated ?? probe;
  } catch (err) {
    const isTimeout = String(err).includes("Timeout");
    const updated = updateProbe(probe.id, {
      status: isTimeout ? "timeout" : "error",
      errorMessage: String(err),
    });
    incrementProbesError();
    if (updated) emitProbeUpdate?.(updated);
    return updated ?? probe;
  }
}

/**
 * Phase 1 — 1 OOB probe to confirm SSRF exists.
 * User checks QuickSSRF/webhook.site and clicks "Callback received" or "No callback".
 */
export async function dispatchPhase1(sdk: SDK, candidate: Candidate): Promise<void> {
  const settings = getSettingsInternal();
  if (!settings.oobUrl) return;

  const payload = generatePhase1Payload(settings.oobUrl);
  await runProbe(sdk, candidate, 1, "oob_direct", payload.type, payload.value, false);

  const updated = updateCandidate(candidate.id, { phase1Done: true });
  if (updated) emitCandidateUpdate?.(updated);
}

/**
 * Phase 2 (hit path) — Port discovery on localhost.
 * Sends http://127.0.0.1:PORT for ~22 common ports.
 * Response bodies may contain service banners → visible in UI.
 */
export async function dispatchPortScan(sdk: SDK, candidate: Candidate): Promise<void> {
  const settings = getSettingsInternal();
  const delayMs = Math.max(200, Math.floor(1000 / settings.maxProbesPerSecond));
  const payloads = generatePortScanPayloads();

  for (const p of payloads) {
    await runProbe(sdk, candidate, 2, "port_scan", p.type, p.value, false);
    await sleep(delayMs);
  }

  const updated = updateCandidate(candidate.id, { portScanDone: true });
  if (updated) emitCandidateUpdate?.(updated);
}

/**
 * Phase 2 (miss path) — Header injection fallback.
 * Injects OOB host into 16 SSRF-prone headers.
 * Used when the vulnerable parameter didn't trigger OOB.
 */
export async function dispatchHeaders(sdk: SDK, candidate: Candidate): Promise<void> {
  const settings = getSettingsInternal();
  if (!settings.oobUrl) return;

  const delayMs = Math.max(200, Math.floor(1000 / settings.maxProbesPerSecond));
  const headerPayloads = generateHeaderPayloads(settings.oobUrl);

  for (const hp of headerPayloads) {
    await runProbe(sdk, candidate, 2, "header_inject", hp.headerName, hp.value, true, hp.headerName);
    await sleep(delayMs);
  }

  const updated = updateCandidate(candidate.id, { headersDone: true });
  if (updated) emitCandidateUpdate?.(updated);
}

/**
 * Phase 3 — IP bypass encodings.
 * Tries decimal, octal, hex, IPv6, and short forms of 127.0.0.1.
 * Used when port scan fails (127.0.0.1 itself may be blocked by a filter).
 */
export async function dispatchIpBypass(sdk: SDK, candidate: Candidate): Promise<void> {
  const settings = getSettingsInternal();
  const delayMs = Math.max(200, Math.floor(1000 / settings.maxProbesPerSecond));
  const payloads = generateIpBypassPayloads();

  for (const p of payloads) {
    await runProbe(sdk, candidate, 3, "ip_bypass", p.type, p.value, false);
    await sleep(delayMs);
  }

  const updated = updateCandidate(candidate.id, { ipBypassDone: true });
  if (updated) emitCandidateUpdate?.(updated);
}

/** @deprecated Use dispatchPortScan. Kept for backward compatibility. */
export async function dispatchPhase2(sdk: SDK, candidate: Candidate): Promise<void> {
  return dispatchPortScan(sdk, candidate);
}

/** OOB host extractor re-exported for index.ts use. */
export { extractOobHost };
