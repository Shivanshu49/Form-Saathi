# Pilot release

A pilot build is the production extension bundle plus a configured service. It
is for supervised sessions on the practice forms; it must not be given to
anyone to use on a live portal with real data until the live verification in
[testing.md](testing.md) has actually been performed.

## Build the extension package

```bash
nvm use
npm ci
npm run typecheck && npm run lint && npm test
npm run package:pilot
```

`package:pilot` builds everything and writes the Chrome package to
`apps/extension/.output/` as a `.zip` next to the unpacked `chrome-mv3` folder.
Chrome does not install a zip outside the Web Store: unzip it and use **Load
unpacked** in `chrome://extensions`, or distribute the unpacked folder. The
manifest requests `sidePanel`, `activeTab`, `scripting`, `tts` and `storage`
and access to the API origin in `apps/extension/config.ts`; change that origin
and rebuild before pointing the panel at a deployed service.

The bundle contains no provider key and no shared credential; the extension
check reads every built file to confirm it.

## Deploy the service

Run the API on Node 24 over HTTPS with, at minimum, `SARVAM_API_KEY` and
`PILOT_TOKEN_SECRET` set (see `.env.example`). Without the secret every `/v1`
route stays closed. Mint one expiring credential per participant:

```bash
PILOT_TOKEN_SECRET=<secret> node apps/api/dist/pilot-token.js P01 8
```

The service stores and logs no audio, transcript, form value or reference. Its
rate limit is per process; run one process per deployment or put a shared
limiter in front of it.

## Before a session

- [ ] `docs/manual-nvda-checklist.md` rows for the machine in use are actually
  performed and recorded, not assumed.
- [ ] The live provider checks in [testing.md](testing.md) have been run once
  with the deployed service, and the recorded results are acceptable.
- [ ] `fixtures/README.md` practice pages are served locally and reachable.
- [ ] Participants are told what condition B sends to the service and that
  raw audio is not redacted.
- [ ] Results files start from `studies/results-template.json`.

## What this release is not

No rule pack has been tested against a live portal; every review says so. No
provider request has been made from this repository. No participant session
has been run and no impact number exists. The panel never fills a field,
presses Submit or solves a CAPTCHA, and a review never means a form is
accepted or an identity verified.
