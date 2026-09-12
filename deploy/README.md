# Deployment package — reviewable, not yet authorized

Prepared 2026-09-12. **Nothing here has been deployed.** Every step can be
performed by the project owner once four decisions are recorded:

| Decision | Needed for | Status |
| --- | --- | --- |
| Public hostnames the owner controls: API, website, practice pages | TLS certificates, the extension's origin, the website's practice links | not taken |
| Custody of the server-side `SARVAM_API_KEY` and `PILOT_TOKEN_SECRET` | the `/v1` routes; without them the extension still reads, navigates, checks and reviews | not taken |
| Approval to distribute the ZIP to named participants | installation | not taken |
| A host with Node 24.21.0, ports 80/443 and the DNS records above | everything below | not available |

Chrome Web Store publication is a separate action that needs the developer
account and its own review; nothing in this package prepares it.

## What is in this directory

| File | Purpose |
| --- | --- |
| `Caddyfile` | TLS termination for three hostnames; JSON access logs with `Authorization` and `Cookie` removed and no bodies; static practice pages |
| `form-saathi-api.service` | systemd unit for the Nest process on loopback, with an environment file and filesystem hardening |
| `form-saathi-web.service` | systemd unit for `next start` on loopback |
| `smoke.sh` | health, credential refusal, per-credential rate limit and one help-audio call against a deployed origin |

## Layout on the host

```
/opt/form-saathi/releases/<commit>/   # one checkout per release, built there
/opt/form-saathi/current -> releases/<commit>
/etc/form-saathi/api.env              # server-only secrets, mode 0600
/var/log/caddy/{api,www,practice}.log # filtered access logs
```

## Procedure

1. **Host.** Create the `form-saathi` system user. Open only ports 80 and
   443 on the host firewall; the API and website bind to loopback and are
   reachable only through Caddy.
2. **Release directory.** `git clone` the repository at the release commit
   recorded in `docs/release.md` into `/opt/form-saathi/releases/<commit>`,
   then `npm ci` there with Node 24.21.0. Verify
   `sha256sum` of the extension ZIP after step 6 against the recorded value.
3. **Secrets.** Create `/etc/form-saathi/api.env` from `.env.example` with at
   least `HOST=127.0.0.1`, `PORT=3000`, `PILOT_TOKEN_SECRET=<≥16 chars>` and
   `SARVAM_API_KEY=<server-only>`; `chmod 600`, owner `form-saathi`. Never
   give either value a `WXT_`, `VITE_` or `NEXT_PUBLIC_` prefix, and never
   put it in a shell history, a chat or a log.
4. **Builds, in the release directory.**
   `npm run build --workspace @form-saathi/api`;
   `NEXT_PUBLIC_PRACTICE_ORIGIN=https://practice.<domain> npm run build:web`;
   `npm run build:fixtures`. Then `ln -sfn releases/<commit> /opt/form-saathi/current`.
5. **Services.** Install both unit files into `/etc/systemd/system/`,
   `systemctl daemon-reload`, `systemctl enable --now form-saathi-api form-saathi-web`.
   Check `curl --fail http://127.0.0.1:3000/health` and
   `curl --fail -o /dev/null http://127.0.0.1:3100/`.
6. **Extension origin.** Set `API_ORIGIN` in `apps/extension/config.ts` to
   `https://api.<domain>`; the manifest's host permission and the extension
   test derive from that one constant, so nothing else is edited. Run
   `npm run test:e2e`, then `npm run package:pilot`; record the ZIP's SHA-256
   and the commit in `docs/release.md`.
7. **TLS.** Install Caddy, replace the three `example.org` hostnames in
   `Caddyfile`, install it as `/etc/caddy/Caddyfile`, `systemctl reload caddy`.
   Check `curl --fail https://api.<domain>/health`,
   `https://www.<domain>/` and `https://practice.<domain>/nsp.html`.
8. **Rate limiting behind the proxy.** The API ignores forwarded-address
   headers on purpose, so behind Caddy every client shares one
   pre-authentication bucket (the socket peer is the proxy). Set
   `PRE_AUTH_RATE_LIMIT_PER_MINUTE` to the expected pilot load, or add a
   rate-limit module at the proxy; the per-credential, per-route limit is
   unaffected. Verify with `PILOT_TOKEN=<token> deploy/smoke.sh https://api.<domain>`.
9. **Credentials.** Mint one token per participant for the session length:
   `PILOT_TOKEN_SECRET=<secret> node apps/api/dist/pilot-token.js P01 8`.
   Rotating the secret revokes every token at once.
10. **Distribution.** Send the ZIP through a channel the participant already
    trusts, with its SHA-256. They unpack it, open `chrome://extensions`,
    enable Developer mode, choose **Load unpacked** and select the unpacked
    folder. Chrome shows one site permission: the API origin.
11. **Smoke test with the installed extension**, in a fresh Chrome profile on
    a practice page: activate the toolbar button; press **सेवा की स्थिति जाँचें**
    (expect “सेवा उपलब्ध है।”); enable the cloud feature and paste the token;
    fetch one help audio and play it; type a fictional value into the
    transcript box and interpret it; press **रद्द करें** after sending once;
    complete one `case=issues` practice profile end to end. Record latencies
    and any failure in `docs/testing.md`. The live provider cases in
    `docs/live-verification.md` run against the same deployment.

## Rollback

- **API or website:** repoint `current` to the previous release directory and
  `systemctl restart form-saathi-api form-saathi-web`. Release directories are
  kept; secrets live outside them, so no secret moves during a rollback.
- **Extension:** redistribute the previous ZIP by its recorded SHA-256; the
  participant loads the unpacked folder again. If the API origin changed
  between releases, the extension and the API must be rolled back together.
- **Caddy:** keep the previous `Caddyfile` as `/etc/caddy/Caddyfile.previous`
  and `systemctl reload caddy` after restoring it.

## Logging policy

Caddy writes JSON access logs per hostname with the `Authorization` and
`Cookie` headers deleted; bodies are never logged. The API logs route mapping
and the class of an unhandled error only — no body, transcript, audio,
credential or reference. journald keeps the process output; set
`SystemMaxUse=` in `journald.conf` for retention. Nothing in this stack writes
a recording or a form value to disk.

## What remains after deployment

Deployment does not verify the provider, the portals, NVDA or users. The
[live checks](../docs/live-verification.md), the
[manual checklist](../docs/manual-nvda-checklist.md) and the
[usability protocol](../docs/usability-protocol.md) stay pending until they
are actually run and recorded.
