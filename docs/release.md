# Release 0.1.0 — pilot candidate

Prepared 2026-09-12. This release is **prepared for deployment and review**. It
has not been publicly deployed, not been published to the Chrome Web Store,
and not been tested with any user. Every claim below is about the built
artifacts and the automated checks that ran on them.

## Artifacts

| Artifact | Command | Output |
| --- | --- | --- |
| Chrome extension package | `npm run package:pilot` | `apps/extension/.output/form-saathiextension-0.1.0-chrome.zip` (11 files, ~151 kB) |
| API production build | `npm run build --workspace @form-saathi/api` | `apps/api/dist/` (ESM; entry `dist/main.js`, credential tool `dist/pilot-token.js`) |
| Website production build | `npm run build:web` | `apps/web/.next/` (eight static routes, one dynamic `/results`) |
| Practice pages | `npm run build:fixtures` | `fixtures/dist/` (three static pages) |

`npm run build` produces all four. Build artifacts are git-ignored; a release is
reproduced from a checkout with `npm ci` on Node 24.21.0.

## Package inspection (performed)

The zip was unpacked and inspected on 2026-09-12:

| Check | Finding |
| --- | --- |
| Secrets | No key, key-header name, secret variable name or private-key block in any file. The extension test asserts this on every build. |
| Host permissions | Exactly one: `http://127.0.0.1:3000/*`, the API origin. No page host, no `<all_urls>`, no `optional_host_permissions`, no `content_scripts` matches. |
| Permissions | `sidePanel`, `activeTab`, `scripting`, `tts`, `storage` — each used, none broader than its use. |
| Remote executable code | None. No `eval`, `new Function` or dynamic `import()`; the only `<script src>` is the bundle's own chunk; every URL in the bundle is the API origin or a W3C/React/JSON-Schema namespace constant. `reader.js` — the only code that runs inside a page — performs **no network call at all**. |
| Development-only configuration | None. No WXT reload command, websocket, `localhost` dev server or source map. The single `localhost` string is the rules package's list of loopback hosts used to label a page as a local practice page. |
| Network reach of the panel | Two fetch sites, both to `API_ORIGIN` from `apps/extension/config.ts`: the health check and the `/v1` routes. |

## Deployment package

[`deploy/`](../deploy/README.md) holds a reviewable, not yet authorized
package: a Caddyfile for the API, website and practice-page hostnames with
filtered access logs, systemd units for the API and website with an
environment file, `smoke.sh` for health, credential refusal and rate-limit
verification, a release/rollback layout, a logging policy, and the ordered
steps from host to distributed ZIP including the smoke test with the
installed extension. Three decisions are still the owner's to record before any of it
runs: the public origin, the funded provider key, and approval to distribute
to participants. The API ignores forwarded-address headers, so behind the
proxy the pre-authentication limit is shared by all clients; the package says
how to size it or move it to the proxy.

## Configuring HTTPS API access

The extension reaches the API only at the origin compiled into it, and Chrome
allows that cross-origin call because the same origin is listed in the
manifest's `host_permissions`. Both come from one constant. A verified check
on 2026-09-12 confirmed an extension page reaches a permitted host **without
any CORS headers from the server**, so the API needs no CORS configuration.

1. Deploy the API behind TLS at a fixed origin, e.g. `https://api.example.org`.
   The Nest process itself listens on plain HTTP on `HOST`/`PORT`; terminate
   TLS in front of it (a reverse proxy or the platform's load balancer) and do
   not expose the plain port publicly.
2. Set that origin in `apps/extension/config.ts`:
   ```ts
   export const API_ORIGIN = 'https://api.example.org';
   ```
   The manifest's `host_permissions` is derived from it (`${API_ORIGIN}/*`), so
   one edit changes both the fetch target and the permission Chrome shows.
3. Rebuild and repackage: `npm run package:pilot`. The extension test reads
   the same constant and asserts the manifest's host permission equals
   `${API_ORIGIN}/*`, so no test edit is needed.
4. Chrome will list the new origin as the extension's site access. That is the
   only site access it requests.

## API deployment configuration

Run `node --env-file-if-exists=../../.env dist/main.js` from `apps/api` (this
is `npm run start --workspace @form-saathi/api`), on Node 24, one process per
deployment. The rate limiter is per process; with several instances put a
shared limiter in front. Configuration is environment only; `.env.example`
lists every variable with a placeholder.

| Variable | Required for | Notes |
| --- | --- | --- |
| `HOST`, `PORT` | listening | default `127.0.0.1:3000`; bind to the proxy's network, never `0.0.0.0` on a public host |
| `PILOT_TOKEN_SECRET` | any `/v1` route | ≥16 chars. Absent ⇒ every `/v1` route answers `service_not_configured`; `/health` still works |
| `SARVAM_API_KEY` | any `/v1` route | server-side only; never a `WXT_`/`VITE_`/`NEXT_PUBLIC_` prefix |
| `SARVAM_*_MODEL`, `SARVAM_SPEECH_SPEAKER` | optional | defaults `saaras:v3`, `sarvam-105b`, `bulbul:v3`, `shubh` |
| `MAX_AUDIO_BYTES`, `PROVIDER_TIMEOUT_MS`, `PROVIDER_RETRIES`, `RATE_LIMIT_PER_MINUTE` | optional | defaults 4 MiB, 20 s, 1, 20/min |
| `PRE_AUTH_RATE_LIMIT_PER_MINUTE` | optional | default 600/min per socket peer across AI routes, before credential verification; forwarded addresses are ignored. Authenticated limits apply per verified subject and route. |
| `SARVAM_BASE_URL` | optional | provider origin; point at a mock for rehearsal |

The service stores and logs no audio, transcript, form value or reference; its
only log lines are route mapping and the class of an unhandled error. A
caller that disconnects after uploading — a JSON body or a whole recording —
makes the service abort its provider request, its body read and any retry
wait, and nothing is written back to the closed connection; what the provider
had already received is not recalled.

## Backend authentication setup

Every `/v1` route requires `Authorization: Bearer <pilot token>`. Tokens are
HMAC-signed with `PILOT_TOKEN_SECRET`, carry a subject and an expiry, and hold
no personal data. Mint one per participant, for the session's length:

```bash
cd apps/api && npm run build
PILOT_TOKEN_SECRET=<the deployed secret> node dist/pilot-token.js P01 8
```

Give the printed token to the participant to paste into the panel's
**क्लाउड सुविधा** section; it lives in Chrome's session storage and is gone
when the browser closes. An expired, tampered or foreign token is refused with
`unauthorized`. Rotating `PILOT_TOKEN_SECRET` invalidates every token at once.
The extension ships no token and no key.

## Support status

Three different things, kept apart everywhere in this project:

| Status | What it means | Where it stands |
| --- | --- | --- |
| **Practice-form support** | The extension reads, navigates, checks and reviews the two fictional practice forms; automated checks pass | Established by the checks in [testing.md](testing.md) |
| **Manually verified live support** | A named person used the extension on the real portal workflow with Windows Chrome and NVDA and recorded the result | **None.** No workflow has been verified this way |
| **Unverified behaviour** | Both rule packs on their live portals, every manual NVDA row, every live provider call, all Hindi wording with users, all participant measures | Listed in [limitations](../apps/web/app/limitations/page.tsx), the [checklist](manual-nvda-checklist.md) and [testing.md](testing.md) |

The [source register](source-register.md) and the
[support matrix](support-matrix.md) are the record of what each rule rests on.

## Before a session

- [ ] Rows of `docs/manual-nvda-checklist.md` performed on the machine in use.
- [ ] Live provider checks in [testing.md](testing.md) run once against the
  deployed service and the results recorded.
- [ ] Practice pages served and `NEXT_PUBLIC_PRACTICE_ORIGIN` pointed at them.
- [ ] Participants told what condition B sends and that raw audio is not
  redacted; results files started from `studies/results-template.json`.

## Source revision

The release candidate is **committed**, on branch `release-candidate-0.1.0`,
base commit `c8c23ca`. The working tree that produced and passed every check
below is that branch's tip; nothing is left uncommitted. `git log --oneline
c8c23ca..release-candidate-0.1.0` lists the snapshot commits, and
`git show --stat` on them lists every file.

| Item | Value |
| --- | --- |
| Base commit | `c8c23ca30e9e2eddf4d82fbd86035a8a31f4e9ac` |
| Snapshot commit | `9fe8477816944c60e37777c5ba54c95bd85a5d36` — the source the package reproduces from |
| Tag | `v0.1.0-rc1`, on the documentation commit that records these results; it changes no file that enters the bundle, so the package reproduces from the tag as well |
| Branch | `release-candidate-0.1.0` (local; not pushed) |
| Package | `apps/extension/.output/form-saathiextension-0.1.0-chrome.zip` |
| Size / files | 153,630 bytes, 11 files |
| SHA-256 | `8e5674c9de82f5ad3072aa439544974dacdf87bd4aa1da0c8d0e573cc4824b7c` |
| Build commands | `npm ci` → `npm run build` → `npm run package:pilot` |
| Runtime | Node 24.21.0, npm 11.19.0 (both pinned by `engines`, `.nvmrc`, `.node-version`) |
| Checks it passed | `npm run typecheck`, `npm run lint`, `npm test` (101), `npm run test:e2e` (52), `npm run package:pilot` — all on this exact tree |

The earlier hash `e524123f…` in [the audit](audit-2026-09-12.md) belongs to
the first follow-up's package and is superseded. The package hash did not
change between the second and third passes, because neither pass altered a
file that enters the extension bundle.

**Reproducing the package from the source snapshot.** The ZIP is built from
committed source only, so it can be rebuilt from a clean extraction:

```bash
git archive --format=tar <commit> | tar -x -C <workdir>
cd <workdir> && npm ci
npm run build --workspace @form-saathi/extension
npm run zip --workspace @form-saathi/extension
sha256sum apps/extension/.output/form-saathiextension-0.1.0-chrome.zip
```

An archive for review excludes what is already git-ignored — `node_modules/`,
`dist/`, `.output/`, `.next/`, `.wxt/`, `test-results/` and `.env` — so
`git archive` is the archive to share; it can carry no secret, no dependency
tree and no build cache. Its 126 files were checked for that.

**This was performed.** A clean `git archive` of
`9fe8477816944c60e37777c5ba54c95bd85a5d36`, extracted to an empty directory
with the same installed dependencies and built there, produced a ZIP with the
same SHA-256 and the same 153,630 bytes as the packaged one. The package
therefore corresponds to that commit and to no uncommitted state.

## Demonstration

See [demo.md](demo.md) for the reproducible five-minute script.
