import type { Request } from "caido:plugin";

import type { Candidate, VectorType } from "./storage";

/**
 * Parameter names that commonly indicate SSRF-prone functionality.
 * Matched by exact lowercased name.
 */
const SSRF_PARAM_NAMES = new Set([
  "url", "uri", "endpoint", "target", "callback", "domain", "feed",
  "source", "proxy", "image", "file", "redir", "redirect", "continue",
  "return", "out", "view", "window", "next", "link", "load", "open",
  "reference", "path", "site", "html", "data", "to", "host", "fetch",
  "api", "request", "download", "content", "resource", "navigate",
  "goto", "location", "dest", "destination", "remote", "origin",
  "forward", "service", "connect", "webhook",
]);

/**
 * Substrings that if found anywhere in a param name suggest SSRF potential.
 * Matched case-insensitively against the full param name.
 */
const SSRF_PARAM_SUBSTRINGS = [
  "url", "uri", "link", "href", "src", "path", "host",
  "endpoint", "redirect", "proxy", "callback", "webhook",
  "target", "dest", "remote", "resource", "fetch", "load",
  "api", "feed", "import", "export", "forward",
];

export interface DetectedVector {
  vector: VectorType;
  paramName: string;
  originalValue: string;
  reason: "name_exact" | "name_substring" | "value_url";
}

/**
 * Returns true if a string looks like a URL or domain reference.
 * Used to flag params whose VALUE is a URL, regardless of the param name.
 */
function isUrlLike(value: string): boolean {
  if (!value || value.length < 7) return false;
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith("//") ||
    /^ftp:\/\//i.test(value) ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value) // any scheme://
  );
}

/**
 * Returns true if a param name exactly matches a known SSRF indicator.
 */
function isSsrfParamNameExact(name: string, customParams: string[]): boolean {
  const lower = name.toLowerCase();
  if (SSRF_PARAM_NAMES.has(lower)) return true;
  return customParams.some((p) => p.toLowerCase() === lower);
}

/**
 * Returns true if a param name contains an SSRF-related substring.
 */
function isSsrfParamNameSubstring(name: string): boolean {
  const lower = name.toLowerCase();
  return SSRF_PARAM_SUBSTRINGS.some((sub) => lower.includes(sub));
}

/**
 * Combined check: flag a param if:
 *   1. Name exactly matches a known SSRF param, OR
 *   2. Name contains an SSRF-related substring, OR
 *   3. Value looks like a URL (catches unknown param names like stockApi, webhookUrl, etc.)
 */
function shouldFlag(
  name: string,
  value: string,
  customParams: string[]
): DetectedVector["reason"] | null {
  if (isSsrfParamNameExact(name, customParams)) return "name_exact";
  if (isSsrfParamNameSubstring(name)) return "name_substring";
  if (isUrlLike(value)) return "value_url";
  return null;
}

/**
 * Parses query string parameters from a raw query string or path.
 */
function parseQueryParams(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const idx = raw.indexOf("?");
  const qs = idx !== -1 ? raw.slice(idx + 1) : raw;
  for (const part of qs.split("&")) {
    if (!part) continue;
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    try {
      const key = decodeURIComponent(part.slice(0, eqIdx));
      const val = decodeURIComponent(part.slice(eqIdx + 1));
      result[key] = val;
    } catch {
      // skip malformed
    }
  }
  return result;
}

/**
 * Recursively searches a parsed JSON object for SSRF-prone keys/values.
 */
function scanJsonObject(
  obj: unknown,
  customParams: string[],
  results: DetectedVector[],
  depth = 0
): void {
  if (depth > 6 || !obj || typeof obj !== "object") return;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof val === "string") {
      const reason = shouldFlag(key, val, customParams);
      if (reason) {
        results.push({ vector: "body_json", paramName: key, originalValue: val, reason });
      }
    } else if (Array.isArray(val)) {
      for (const item of val) {
        scanJsonObject(item, customParams, results, depth + 1);
      }
    } else if (typeof val === "object" && val !== null) {
      scanJsonObject(val, customParams, results, depth + 1);
    }
  }
}

/**
 * Scans a request for all SSRF-prone vectors.
 * Returns detected candidates (before dedup check).
 */
export function scanRequest(
  request: Request,
  customParams: string[]
): DetectedVector[] {
  const vectors: DetectedVector[] = [];
  const seen = new Set<string>();

  function addVector(v: DetectedVector): void {
    const key = `${v.vector}:${v.paramName}`;
    if (!seen.has(key)) {
      seen.add(key);
      vectors.push(v);
    }
  }

  // 1. Query string params
  const rawQuery = request.getQuery?.() ?? "";
  const rawPath = request.getPath();
  // getPath() may or may not include query — parse both to be safe
  const combined = rawPath.includes("?") ? rawPath : (rawQuery ? `?${rawQuery}` : "");
  const queryParams = parseQueryParams(combined);
  for (const [key, val] of Object.entries(queryParams)) {
    const reason = shouldFlag(key, val, customParams);
    if (reason) {
      addVector({ vector: "query_param", paramName: key, originalValue: val, reason });
    }
  }

  // 2. Request body
  let rawBody = "";
  try {
    rawBody = request.getBody()?.toText() ?? "";
  } catch {
    rawBody = "";
  }

  if (rawBody.trim()) {
    let contentType = "";
    try {
      contentType = request.getHeader("Content-Type")?.[0] ?? "";
    } catch {
      contentType = "";
    }

    // Try JSON body
    const looksLikeJson = rawBody.trimStart().startsWith("{") || rawBody.trimStart().startsWith("[");
    if (contentType.includes("application/json") || looksLikeJson) {
      try {
        const parsed = JSON.parse(rawBody) as unknown;
        scanJsonObject(parsed, customParams, vectors);
      } catch {
        // not valid JSON
      }
    }

    // URL-encoded form body (try even if content-type is missing/wrong)
    const looksLikeForm = /^[^=&\s]+=/.test(rawBody.trim()) && !looksLikeJson;
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      (looksLikeForm && !contentType.includes("multipart"))
    ) {
      const formParams = parseQueryParams(`?${rawBody}`);
      for (const [key, val] of Object.entries(formParams)) {
        const reason = shouldFlag(key, val, customParams);
        if (reason) {
          addVector({ vector: "body_form", paramName: key, originalValue: val, reason });
        }
      }
    }

    // Multipart form
    if (contentType.includes("multipart/form-data")) {
      const nameMatches = rawBody.matchAll(/name="([^"]+)"[\r\n]+([^\r\n-][^\r\n]*)/g);
      for (const match of nameMatches) {
        const key = match[1] ?? "";
        const val = (match[2] ?? "").trim();
        const reason = shouldFlag(key, val, customParams);
        if (reason) {
          addVector({ vector: "body_form", paramName: key, originalValue: val, reason });
        }
      }
    }
  }

  return vectors;
}

/**
 * Builds a Candidate object from request data and a detected vector.
 */
export function buildCandidate(request: Request, vector: DetectedVector): Candidate {
  const id = `${request.getHost()}|${request.getPath()}|${vector.paramName}|${vector.vector}`;
  return {
    id,
    host: request.getHost(),
    path: request.getPath(),
    method: request.getMethod(),
    vector: vector.vector,
    paramName: vector.paramName,
    originalValue: vector.originalValue,
    detectionReason: vector.reason,
    phase1Done: false,
    portScanDone: false,
    headersDone: false,
    ipBypassDone: false,
    confirmStatus: "unconfirmed",
    probeCount: 0,
    timestamp: Date.now(),
  };
}
