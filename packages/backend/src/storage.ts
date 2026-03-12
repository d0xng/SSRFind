import type { SDK } from "caido:plugin";

export type ProbeStatus = "pending" | "sent" | "error" | "timeout" | "done";
export type ConfirmStatus = "unconfirmed" | "confirmed" | "false_positive";
export type VectorType = "query_param" | "body_json" | "body_form" | "header";
export type PayloadGroup =
  | "oob_direct"
  | "port_scan"
  | "ip_bypass"
  | "header_inject";

/**
 * Phase numbers:
 *  1 = OOB confirmation (1 probe)
 *  2 = Port discovery (after Phase 1 hit)  OR  Header injection (after Phase 1 miss)
 *  3 = IP bypass encodings (after Phase 2 port scan no-hit)
 */
export type Phase = 1 | 2 | 3;

export interface Candidate {
  id: string;
  host: string;
  path: string;
  method: string;
  vector: VectorType;
  paramName: string;
  originalValue: string;
  detectionReason?: string;
  phase1Done: boolean;
  portScanDone: boolean;   // Phase 2 — port discovery (hit path)
  headersDone: boolean;    // Phase 2 — header injection (miss path)
  ipBypassDone: boolean;   // Phase 3 — IP bypass encodings
  confirmStatus: ConfirmStatus;
  probeCount: number;
  timestamp: number;
}

export interface Probe {
  id: string;
  candidateId: string;
  phase: Phase;
  payloadGroup: PayloadGroup;
  payloadType: string;
  payload: string;
  status: ProbeStatus;
  responseCode?: number;
  responseSnippet?: string;
  responseTimeMs?: number;
  errorMessage?: string;
  timestamp: number;
}

export interface Stats {
  requestsAnalyzed: number;
  candidatesFound: number;
  probesSent: number;
  probesError: number;
  confirmed: number;
}

const candidates = new Map<string, Candidate>();
const probes = new Map<string, Probe>();
const dedupSet = new Set<string>();

export interface CachedRequest {
  url: string;
  method: string;
  path: string;
  query: string;
  host: string;
  port: number;
  isTls: boolean;
  headers: Record<string, string>;
  bodyText: string | null;
  contentType: string;
}
const requestCache = new Map<string, CachedRequest>();

export function cacheRequest(candidateId: string, req: CachedRequest): void {
  requestCache.set(candidateId, req);
}

export function getCachedRequest(candidateId: string): CachedRequest | undefined {
  return requestCache.get(candidateId);
}

const stats: Stats = {
  requestsAnalyzed: 0,
  candidatesFound: 0,
  probesSent: 0,
  probesError: 0,
  confirmed: 0,
};

export function makeCandidateId(host: string, path: string, paramName: string, vector: VectorType): string {
  return `${host}|${path}|${paramName}|${vector}`;
}

export function isDuplicate(host: string, path: string, paramName: string, vector: VectorType): boolean {
  return dedupSet.has(makeCandidateId(host, path, paramName, vector));
}

export function addCandidate(candidate: Candidate): void {
  candidates.set(candidate.id, candidate);
  dedupSet.add(candidate.id);
  stats.candidatesFound++;
}

export function getCandidate(id: string): Candidate | undefined {
  return candidates.get(id);
}

export function updateCandidate(id: string, partial: Partial<Candidate>): Candidate | undefined {
  const c = candidates.get(id);
  if (!c) return undefined;
  const updated = { ...c, ...partial };
  candidates.set(id, updated);
  return updated;
}

export function addProbe(probe: Probe): void {
  probes.set(probe.id, probe);
}

export function updateProbe(id: string, partial: Partial<Probe>): Probe | undefined {
  const p = probes.get(id);
  if (!p) return undefined;
  const updated = { ...p, ...partial };
  probes.set(id, updated);
  return updated;
}

export function getProbesByCandidateId(candidateId: string): Probe[] {
  return Array.from(probes.values()).filter((p) => p.candidateId === candidateId);
}

export function getCandidates(_sdk: SDK): Candidate[] {
  return Array.from(candidates.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export function getProbes(_sdk: SDK): Probe[] {
  return Array.from(probes.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export function clearCandidates(_sdk: SDK): void {
  candidates.clear();
  probes.clear();
  dedupSet.clear();
  requestCache.clear();
  stats.requestsAnalyzed = 0;
  stats.candidatesFound = 0;
  stats.probesSent = 0;
  stats.probesError = 0;
  stats.confirmed = 0;
}

export function getStats(_sdk: SDK): Stats {
  return { ...stats };
}

export function incrementRequestsAnalyzed(): void {
  stats.requestsAnalyzed++;
}

export function incrementProbesSent(): void {
  stats.probesSent++;
}

export function incrementProbesError(): void {
  stats.probesError++;
}

export function setConfirmStatus(_sdk: SDK, candidateId: string, status: ConfirmStatus): boolean {
  const c = candidates.get(candidateId);
  if (!c) return false;
  const prev = c.confirmStatus;
  candidates.set(candidateId, { ...c, confirmStatus: status });
  if (status === "confirmed" && prev !== "confirmed") stats.confirmed++;
  if (prev === "confirmed" && status !== "confirmed") stats.confirmed = Math.max(0, stats.confirmed - 1);
  return true;
}
