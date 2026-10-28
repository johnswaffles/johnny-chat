# eMudhra / runtime security assessment — October 27, 2026

Assessment recorded October 27; security-only publication approved October 28.
The task release report records the resulting commit/deployment verification. No
cloud settings are changed by this patch. No credentials, trust stores, manuscript data, models,
provider jobs, or persistent access were changed. No paid provider calls were made.

## Applicability and evidence

- Render's advisory lists patched Node floors 22.23.4, 24.22.1 and 26.12.1.
  Earlier Node 22/24/26 versions can trust the compromised CA intermediates; Node
  before 22 is EOL. Native Render system CA updates arrive through a fresh build.
- The current verified live service is `johnny-chat`, native Node, main branch,
  service `srv-d1hcf32li9vc73bk7mog`, deploy `dep-dbgb0m7f3r2c73bfdfdg`, commit
  `02bf8e4407a99f969602f82aa7b97aa8c6b4a60d`, finished 2026-10-27 14:10:19 UTC.
  Its build log at 14:08:52 says `Using Node.js version 26.12.1 via
  /opt/render/project/src/package.json`. Thus the deployed build selected a
  patched runtime and was rebuilt after the advisory. This is build evidence,
  not direct introspection of the running process or proof of its CA overrides.
- GitHub CI job 122237658766 (October 27, run 40518265576) used cached
  `node: v22.23.3`, below the patched minimum. The earlier story release job
  121178585121 used the same version. Both used `node-version: 22` without an
  exact patch. The runner says checkout/setup-node v4 are forced onto its managed
  Node 24 action runtime; that is distinct from the vulnerable selected build
  Node 22.23.3. No claim is made about the runner's exact bootstrap patch level.
- The repo's existing `engines.node: >=22.5` allows vulnerable versions and
  untested future majors. Render selected 26.12.1, while CI selected 22.23.3.
- Application outbound HTTPS uses native fetch, OpenAI 4.104.0's node-fetch 2.7.0
  plus its default HTTPS agent, and ws 8.19.0. SMTP uses Nodemailer with default
  Node TLS verification. No custom CA or `rejectUnauthorized: false` configuration
  was found in application source. The production environment's CA/TLS override
  values remain unverified; secrets were not requested.
- No Python HTTPS client, requirements/Certifi lockfile, PHP source/Composer
  dependency, or Dockerfile is present in the story app's runtime/build path.
  Unrelated game tools are local file/image processing and a localhost HTTP QA
  server; they do not use Requests/HTTPX/Certifi. Native Render Python/PHP tools
  merely existing does not mean this Node service invokes them.
- The separate PHP RCE advisory fixes 8.5.12, 8.4.27, 8.3.36 and 8.2.35. Those
  PHP server flaws do not apply to the inspected Node app; other company sites
  were not audited. Certifi 2026.10.19 is the advisory floor if Python HTTPS
  clients are added later. No unnecessary PHP/Python dependency was added.
- On this Mac, default Node is 22.14.0 / OpenSSL 3.0.15+quic. Local Python is
  3.13.5 / OpenSSL 3.5.0 using the Homebrew system CA path, with no Certifi,
  Requests or HTTPX installed in that interpreter. These are local observations,
  not Render runtime evidence. The Mac's global toolchain was not updated.

## Actual TLS client probes (local, not production)

The fixed advisory endpoints are:

- https://dv-g3b-emudhra.we-have-a-problem.com/
- https://dv-g3b-aaa-emudhra.we-have-a-problem.com/

The control is https://nodejs.org/ (redirect followed only far enough to establish
TLS; redirects are not followed). Requests send no credentials, API keys, cookies,
manuscript or generation payload. Each client uses its real default TLS path.

- Local Node 22.14.0 accepted BOTH bad hosts with HTTP 200 in native fetch,
  OpenAI's actual node-fetch/HTTPS-agent stack and ws (6 unsafe handshakes).
- An isolated official Node 26.12.1 Darwin arm64 binary rejected BOTH hosts
  with `CERT_REVOKED` through ALL THREE clients. All three reached the control.
- The official archive SHA256 was verified against Node's published checksum:
  `1901d539912c02afa10d1cc126943a8855a7eedebe830119463470db5e6c59e8`.
  The binary lives only under /tmp; no host runtime or CA files were modified.
- A DNS failure, timeout, protocol error, or missing result is inconclusive, never
  a security pass. Any HTTP response from either bad host, even non-200, means
  TLS was accepted. The diagnostic checks all nine required results.

This proves the behavior on this Mac's application stacks under the tested Node
versions. It does NOT prove that the currently running Render process rejects the
certificates. A curl result would not substitute for that proof either.

## Prepared changes

- `.node-version`: exactly 26.12.1, matching the already selected production line.
- package.json + root package-lock metadata: `>=26.12.1 <27`; dependencies unchanged.
- CI reads `.node-version` rather than accepting any cached Node 22 patch.
- npm start/build/build:pages run an offline guard refusing known-unpatched Node
  or explicitly disabled TLS verification. No network probe runs automatically
  during app startup or build. Direct `node server.js` is not the production
  start command and does not invoke npm lifecycle guards.
- `npm run security:tls` is an explicit, credential-free diagnostic using native
  fetch, the installed OpenAI transport/agent and ws. It reports only safe runtime
  metadata/override presence and fixed-host result codes, never secret values.

Render's `NODE_VERSION` env takes precedence over .node-version. Cloudflare Pages
also supports .node-version and NODE_VERSION. Neither provider's settings were
changed. Release verification must confirm the chosen version in fresh build logs
and run the diagnostic in the actual service environment.

## Validation

- 196 tests passed under isolated patched Node 26.12.1 (192 existing + 4 security).
- Existing synthetic full integration passed: temporary SQLite, fake local
  providers, revised/original DOCX, durable jobs, auth, book drafts and editing.
- Clean temporary Pages build passed under 26.12.1, including the new build guard,
  with existing committed site assets; no unrelated untracked assets included.
- Offline guard rejects local Node 22.14.0 and accepts isolated Node 26.12.1.
- Live nonbillable TLS probe outcomes are recorded above. No browser was used.

## Approved release procedure and remaining access limitation

1. Publication was approved October 28. Apply this security-only patch onto CURRENT main, not the old local
   base. During the audit, remote main advanced to 8fd88c7; unrelated contact-block
   changes must be preserved. Recheck remote head and reapply only these files.
2. Rebuild/deploy the existing Render backend and Cloudflare Pages
   project; verify Node 26.12.1 in build logs, exact release commits and health.
   Disk-backed Render replacement can briefly interrupt availability. No model,
   credentials, trust-store workaround or infrastructure setting change is proposed.
3. In the running service's existing Render Shell, run `npm run security:tls` after
   the script is available. All clients must reach the control and reject both
   compromised chains. Existing browser access is denied and the prior SSH
   host-key failure must not be bypassed; no allowed remote-exec tool is exposed
   here. Production execution is therefore pending, not passed. The user can run
   the command in their existing Render Shell and share its safe output; no new
   agent credential or persistent access is needed.
4. Separately approve updating the Mac's default Node toolchain if desired. It is
   demonstrably unpatched for these client requests. The isolated test install is
   not a system update, and the project pin alone does not update global npm/git
   or every unrelated tool's CA stack.

## Primary sources

- https://render.com/docs/advisory-emudhra
- https://render.com/docs/node-version
- https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
- https://nodejs.org/en/blog/release/v26.12.1
- https://www.php.net/archive/2026.php
- https://developers.cloudflare.com/pages/configuration/build-image/

The Render advisory links the community-operated test endpoints and explicitly
requires verification with the running application's client, rather than a
possibly different curl trust store.

## CVE scope and realistic exposure

The eMudhra event is a compromised-intermediate PKI trust issue; the Render advisory
does not assign it a CVE. A vulnerable TLS client could accept an attacker-signed
certificate for a legitimate service if the attacker can redirect or intercept its
connection. Depending on the request, credentials, API payloads or returned content
could then be exposed or altered. This is a possible impact, not evidence it happened.
It is not a claim that Render or the manuscript database was breached.

Node's October 21 security release also fixes CVE-2026-111497 (malformed Brotli
decompression memory corruption), CVE-2026-105482 (DNS NUL truncation),
CVE-2026-105481 (HTTP keep-alive response confusion), and certificate/hostname
issues CVE-2026-105483, CVE-2026-106069 and CVE-2026-106072. Applicability of each
exploit depends on its affected API, attacker-controlled input, platform and network
conditions; old version presence alone does not prove exploitation. No exploit was
run. The observed production build already selected the release containing fixes.
The concrete outstanding version exposure was the CI 22.23.3 build and this Mac's
22.14.0 client, whose CA acceptance was demonstrated without sending credentials.
The repo pin and guard prevent those known-unpatched versions in the app's normal
build/start commands; they do not update the Mac's global toolchain.

PHP CVE-2026-109618 / CVE-2026-109619 and the PHP Windows Brotli package rebuild
concern PHP deployments. No PHP app/server was found in this service, so no PHP
settings or packages are changed. Python/Certifi updates are similarly not applicable
to the inspected Node runtime path. Other services and unrelated host tools are
outside this app release.

The offline guard now logs only safe runtime metadata at startup/build, allowing
Render logs to confirm the selected executable version and verification flags. It
does not perform network probes automatically. Actual Render TLS rejection remains
a separate required check with the credential-free diagnostic in its service shell.

## October 28 approved release validation

The security-only files were applied to a separate checkout of current main
8fd88c7, preserving newer Story Editor, TextSmith/contact and game changes.
255 unit/mocked tests passed under Node 26.12.1, plus both Story Editor and
TextSmith synthetic integration fixtures and the clean Pages build. The live
release outcome and exact resulting SHA are reported in the task. There are no
manuscript/model/narration code changes, dependency version upgrades, credentials,
cloud setting changes, or paid provider calls in this patch.

### Runtime CVE applicability details

| Issue | Preconditions and app assessment |
| --- | --- |
| eMudhra intermediate compromise (no CVE assigned in Render advisory) | Vulnerable client trust plus attacker interception/redirection. Accepted test chains were confirmed in the older local stack; actual intercepted traffic was not observed. Production already selected patched Node. |
| CVE-2026-105482 | Affected DNS resolve/reverse APIs plus NUL-containing names and a mismatched allowlist decision. Runtime-version exposure existed in older tools; no exploitable story-app input path was established. |
| CVE-2026-105483 | Node 24/26 TLS verification with non-ASCII/fullwidth IP hosts. Default provider URLs use DNS names; no exploit was demonstrated. Observed production 26.12.1 contains the fix. |
| CVE-2026-106069 / CVE-2026-106072 | Non-canonical IP spellings and platform resolver / certificate-SAN behavior. Not a claim that normal provider DNS URLs triggered either issue. Patched runtime closes these cases. |
| CVE-2026-111497 | Malformed Brotli input reaching the vulnerable decoder can corrupt memory, potentially execute code. HTTP client response decompression is a plausible class of entry point, but no malicious payload, vulnerable production invocation or exploitation was established. No exploit was attempted. |
| CVE-2026-105481 | Keep-alive agent socket reuse plus unsolicited attacker-controlled upstream response and event-loop timing. The SDK uses a keep-alive agent, so the runtime fix is relevant defense; no malicious upstream activity was observed. |
| CVE-2026-106074 | User-land startup snapshots / single executable snapshot construction containing populated entropy caches. This service starts normal node server.js, not that deployment mechanism. |
| CVE-2026-106070 | Node 26 zlib.ZipFile API with inconsistent hostile ZIP headers. Story import/export uses external unzip/zip, not the affected Node API. No affected use was found. |
| CVE-2026-106071 / CVE-2026-106073 | Node Permission Model grants/realpath enforcement. The service's normal start command does not enable that model. The Mac executor's sandbox is a different mechanism. |
| PHP CVE-2026-109618 / CVE-2026-109619 | PHP web request initialization/cleanup paths. No PHP server/runtime path in this application; no PHP settings changed. |

The diagnosis is version exposure plus demonstrated CA trust on the old local
clients, not a forensic finding of compromise. Other CVEs require their own input
paths and conditions; a patched Node pin is not a claim that all were exploitable
in this app or that every unrelated Mac tool is fixed.
