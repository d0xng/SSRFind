export interface HeaderPayload {
  headerName: string;
  value: string;
}

/**
 * SSRF-prone headers to inject.
 * These are always sent in Phase 1 alongside the OOB direct probes.
 */
const SSRF_HEADERS = [
  "X-Forwarded-For",
  "X-Forwarded-Host",
  "X-Real-IP",
  "X-Remote-IP",
  "X-Remote-Addr",
  "X-Originating-IP",
  "True-Client-IP",
  "Client-IP",
  "Forwarded",
  "X-Custom-IP-Authorization",
  "CF-Connecting_IP",
  "X-ProxyUser-Ip",
  "X-Original-URL",
  "X-Rewrite-URL",
  "X-Host",
  "X-Forwarded-Server",
];

/**
 * Generates one probe payload per SSRF-prone header, using the OOB hostname as the value.
 * Headers use hostname-only (no scheme/path) since they represent a Host value.
 * e.g. "https://abc.oast.site" → "abc.oast.site"
 * e.g. "https://webhook.site/uuid" → "webhook.site"
 */
export function generateHeaderPayloads(oobUrl: string): HeaderPayload[] {
  const host = oobUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\?.*$/, "");
  return SSRF_HEADERS.map((headerName) => ({
    headerName,
    value: host,
  }));
}

export { SSRF_HEADERS };
