import type { Caido } from "@caido/sdk-frontend";
import type { API, BackendEvents } from "../../backend/src/index";
export type { API, BackendEvents };

export type FrontendSDK = Caido<API, BackendEvents>;

export type ProbeStatus = "pending" | "sent" | "error" | "timeout" | "done";
export type ConfirmStatus = "unconfirmed" | "confirmed" | "false_positive";
export type VectorType = "query_param" | "body_json" | "body_form" | "header";
export type PayloadGroup = "oob_direct" | "port_scan" | "ip_bypass" | "header_inject";

/**
 * Phase numbers:
 *  1 = OOB confirmation (1 probe)
 *  2 = Port discovery (hit path) OR Header injection (miss path)
 *  3 = IP bypass encodings
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
  phase1Done: boolean;
  portScanDone: boolean;
  headersDone: boolean;
  ipBypassDone: boolean;
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

export interface Settings {
  oobUrl: string;
  enableHeaderInjection: boolean;
  enableUrlBypassProbes: boolean;
  enableInternalIpProbes: boolean;
  maxProbesPerSecond: number;
  autoProbeMode: boolean;
  customSsrfParams: string[];
  scanHttpHistory: boolean;
}
