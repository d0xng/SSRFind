# SSRFind

**Passive SSRF detection plugin for [Caido](https://caido.io)**

SSRFind monitors all HTTP traffic passing through Caido's proxy and automatically identifies potential Server-Side Request Forgery vulnerabilities. It uses a phased probing approach to minimize noise: a single OOB confirmation probe fires first, and deeper testing (port scanning, header injection, IP bypass encodings) is only triggered based on the results of the previous phase.

---

## Features

- **Passive monitoring** — intercepts every response in scope without disrupting your workflow
- **Single OOB probe (Phase 1)** — sends one targeted request to your OOB collaborator URL per candidate
- **Port discovery (Phase 2 — hit path)** — scans 20+ common ports on `127.0.0.1` and captures response banners
- **Header injection (Phase 2 — miss path)** — injects 16 SSRF-prone HTTP headers as a fallback
- **IP bypass encodings (Phase 3)** — tries decimal, octal, hex, IPv6 and shortened forms of `127.0.0.1`
- **Response snippets** — displays the first ~600 characters of each probe's response
- **Scope-aware** — only scans requests within your configured Caido scope
- **HTTP History scan** — retroactively analyzes the last 200 requests

---

## Requirements

- [Caido](https://caido.io) v0.44.0 or later
- An OOB collaborator URL — [QuickSSRF](https://quickssrf.com), [webhook.site](https://webhook.site), or any [Interactsh](https://github.com/projectdiscovery/interactsh) instance

---

## Installation

### Manual installation (from release ZIP)

1. Download the latest `ssrfind.zip` from the [Releases](https://github.com/ssrfind/ssrfind/releases) page.
2. In Caido, go to **Plugins → Manage plugins → Install from file**.
3. Select the downloaded ZIP. Caido will install and activate the plugin immediately.

### Build from source

```bash
# Prerequisites: Node.js 18+, pnpm
npm install -g pnpm

git clone https://github.com/ssrfind/ssrfind
cd ssrfind
pnpm install
pnpm build
```

The compiled plugin ZIP will be located at `dist/ssrfind.zip`. Install it manually as described above.

---

## Setup

### 1. Configure your OOB URL

Open SSRFind and go to **Settings**. Paste your OOB collaborator URL in the **OOB URL** field.

```
https://your-id.oast.fun
https://webhook.site/your-uuid
```

This URL is injected as the value of SSRF-prone parameters and headers. When the target server fetches it, your collaborator will log the callback — confirming the vulnerability.

### 2. Set a scope in Caido

SSRFind only processes requests within your active Caido scope to avoid flooding unintended targets.

Go to **Caido → Scope** and add the hosts you want to test. Without a scope, the plugin will not analyze any traffic.

### 3. Start browsing

Once configured, SSRFind runs entirely in the background. Open the **Live Queue** tab to see detected candidates and manage probing phases.

---

## How it works

### Detection

SSRFind inspects every HTTP response that passes through Caido. For each request, it checks:

- **Query parameters** — values that look like URLs or paths (e.g., `url=`, `redirect=`, `src=`, `callback=`, `next=`)
- **POST body parameters** — same patterns in form-encoded and JSON bodies
- **Path segments** — URL-encoded values embedded in the path

When a candidate is found, it appears in **Live Queue** and Phase 1 fires automatically.

### Probing phases

```
Phase 1  — OOB Confirmation
           Sends one HTTP request with your OOB URL as the parameter value.
           Check your collaborator tool for a callback.

           Did a callback arrive?
           ├── Yes → Phase 2A: Port Discovery
           └── No  → Phase 2B: Header Injection

Phase 2A — Port Discovery
           Probes 20+ common ports on http://127.0.0.1 (SSH, HTTP, databases, etc.)
           Captures response body snippets to identify running services.

           No service found?
           └── Phase 3: IP Bypass Encodings

Phase 2B — Header Injection
           Injects your OOB hostname into 16 SSRF-prone headers:
           X-Forwarded-For, X-Real-IP, Host, Referer, Origin,
           X-Forwarded-Host, CF-Connecting-IP, True-Client-IP, and more.

Phase 3  — IP Bypass Encodings
           Tries alternative representations of 127.0.0.1 against ports 80 and 8080:
           decimal (2130706433), octal (0177.0.0.1), hex (0x7f000001),
           IPv6 (::1, ::ffff:127.0.0.1), and shortened forms.
```

### Confirming a finding

Once you've verified a callback or observed a meaningful response, click **Confirm** in the Live Queue to move the candidate to the **Findings** tab for reporting.

---

## Tabs

| Tab | Description |
|-----|-------------|
| **Dashboard** | Overview stats, HTTP history scanner, and setup guide |
| **Live Queue** | Real-time list of SSRF candidates with per-phase probe controls |
| **Findings** | Candidates you've manually confirmed as exploitable |
| **Settings** | OOB URL, scope display, and scanner options |

---

## Settings reference

| Setting | Default | Description |
|---------|---------|-------------|
| OOB URL | — | Your collaborator URL. Required to start scanning. |
| Header injection | Enabled | Inject OOB hostname into SSRF-prone request headers. |
| URL bypass probes | Enabled | Run IP encoding bypasses in Phase 3. |
| Internal IP probes | Enabled | Run port discovery on 127.0.0.1 in Phase 2A. |
| Max probes/second | 5 | Rate limit to avoid overwhelming the target. |
| Auto probe mode | Enabled | Fire Phase 1 automatically on new candidates. |

---

## License

MIT

---

*Built for security researchers. Use only on systems you are authorized to test.*
