# Form Saathi — फ़ॉर्म साथी

Accessible government-form navigation and review in Hindi, built for desktop
Chrome alongside screen readers, particularly NVDA.

The extension opens a Hindi side panel for the tab you activate it on, reads
that page's form fields, checks them against local reviewed rule packs, and lets
you move through them and jump to any field in the page — with the keyboard
alone. Long identifiers stay masked until you ask, and an optional read-aloud
control never starts on its own. Fictional NSP and ECI Form 6 practice pages are
included. With the optional service configured, a person can speak a value for
a field, correct the transcript, and get a suggestion the local rules check
before they apply it themselves. A final review summarises what was found,
walks through open issues, and records that the person read it — tied to the
exact data reviewed, and invalidated by any later change. No rule pack has
been tested against a live portal and no live provider call has been made.
The selected NSP scope is AY 2026–27, Basic Information → General Information.
Both portals' live support remains **unverified**.

## Setup

Use Node **24.21.0** and its bundled npm **11.19.0**. From this checkout, with
nvm already installed:

```bash
nvm install
nvm use
npm ci
npm run build
```

On Windows, install the same Node release (or use `nvm install 24.21.0` and
`nvm use 24.21.0` with nvm-windows), then run the npm commands above.
No credentials or `.env` file are needed. See [exact setup details](docs/setup.md).

## Try the foundation

```bash
npm run dev
```

This starts the shared-package watcher, Nest API on port 3000, and WXT
development server on port 5173.
It leaves browser startup to you:

1. Open `chrome://extensions` in desktop Chrome 116 or later and enable Developer mode.
2. Choose **Load unpacked** and select `apps/extension/.output/chrome-mv3-dev`.
3. Pin Form Saathi. In another terminal run `npm run dev:fixtures` and open a
   practice form, for example `http://127.0.0.1:4173/nsp.html`.
4. Activate the toolbar action, or press `Alt+Shift+F`, on that tab. The panel
   opens for that tab and lists its fields, values and coverage limits.
5. Tab through the panel: **फ़ॉर्म फिर पढ़ें**, then **पिछला फ़ील्ड** and
   **अगला फ़ील्ड** to move between fields, **मूल फ़ील्ड पर जाएँ** to put focus on
   the page control, and **पढ़कर सुनाएँ** / **पढ़ना रोकें** for optional speech.
   Press F6 to come back to the panel from the page.
6. Change or insert a field in the page; the panel follows without losing your
   place. Long identifiers show as **मान छिपा है** until you press
   **पूरा मान दिखाएँ**.
7. Read **समीक्षा** for what the local rules found, grouped into
   **सुधार चाहिए**, **पुष्टि चाहिए** and **जाँचा नहीं गया**, each with its
   source and next action. Type your document's exact English spelling under
   **आपका संदर्भ** to have the name compared; it is never saved or sent.
8. Tab to **सेवा की स्थिति जाँचें** and press Enter. Expect **सेवा उपलब्ध है।**

The API listens at `http://127.0.0.1:3000`; that button is a service check only.
What the panel reads stays in the browser: no page contents, snapshots or form
values are sent to the API or stored. Activation grants access to that one tab,
so nothing is read until you ask, and each tab keeps its own review. Stop
development with Ctrl+C.

For a production-build smoke check, run `npm run build`, start the API with
`npm run start --workspace @form-saathi/api`, and load
`apps/extension/.output/chrome-mv3` instead. Avoid loading both copies together.

```bash
curl --fail http://127.0.0.1:3000/health
# {"status":"ok","service":"form-saathi-api"}
```

## Companion website

```bash
npm run dev:web
```

Open **http://127.0.0.1:3100/** for the introduction, installation steps,
keyboard and NVDA guidance, practice-form links, the supported-workflow matrix
(rendered from the rule packs), privacy and limitations, and a results page that
shows only sessions actually filed under `studies/results/` — empty until then.
Run `npm run dev:fixtures` beside it so the practice links resolve.

## Try the practice forms

```bash
npm run dev:fixtures
```

Open **http://127.0.0.1:4173/**. Both demonstrations have A/B profiles, flawed
and filled scenarios, conditional fields and a dynamically inserted note.
Use fictional values only. Nothing is submitted, and edits disappear on reload.
These are limited practice representations, not live portal copies.

See the [source register](docs/source-register.md),
[support matrix and field inventory](docs/support-matrix.md),
[expected results](fixtures/expected-results.md) and [fixture instructions](fixtures/README.md).

## Checks

```bash
npm run typecheck            # tsc --noEmit for all five workspaces, fixtures, tests, studies
npm run lint                 # oxlint, warnings are failures
npm test                     # Vitest: packages, API, AI service, inbox, report
npx playwright install chromium --no-shell
npm run test:e2e             # builds everything, then extension + practice + website in Chromium
```

Stop servers on ports 3000 and 4173 before `test:e2e`. It builds both apps and
the practice pages, starts the API and fixture preview, and uses Playwright's
bundled Chromium for extension and practice tests. `npm run test:fixtures`
runs only the practice project. `npm test` runs Vitest unit and API integration
checks; each also has a separate `test:unit` or `test:integration` command.

`typecheck` runs TypeScript `--noEmit` for all workspaces, fixtures and test/config files.
A successful WXT bundle alone does not establish type correctness. See
[test evidence and the manual Chrome/NVDA checklist](docs/testing.md).

## Release 0.1.0

```bash
npm run build                # API dist/, extension .output/chrome-mv3, website .next/, practice dist/
npm run package:pilot        # apps/extension/.output/form-saathiextension-0.1.0-chrome.zip
```

[Release notes](docs/release.md) cover the package inspection, HTTPS API access
and the extension's host permission, API deployment configuration, backend
authentication setup and the support-status statement. [The demo script](docs/demo.md)
is a reproducible five-minute walkthrough. Environment variables are documented
with placeholders in `.env.example`.

Status, stated exactly: prepared for deployment and review. **Not** publicly
deployed, **not** on the Chrome Web Store, **not** tested with users. Practice
forms are supported by automated checks; no live portal workflow has been
manually verified; the [manual Windows Chrome/NVDA checklist](docs/manual-nvda-checklist.md)
and the [usability protocol](docs/usability-protocol.md) are written and **not
run**; `studies/results/` is empty and `npm run report` prints so.

## Workspace

- `apps/extension`: WXT, React, Tailwind/Vite, typed Chrome APIs.
- `apps/api`: strict TypeScript, NestJS, Express, ESM. Health plus optional
  transcription, interpretation and help-audio routes behind expiring pilot
  credentials and a replaceable provider adapter; off unless configured.
- `packages/contracts`: browser-safe Zod schemas for the API and for panel/reader messages.
- `packages/rules`: versioned NSP and ECI rule packs and the local validation engine, with every source and unchecked boundary recorded.
- `apps/web`: Next.js companion site for installation, guidance, practice links, the workflow matrix and filed results only.
- `fixtures`: two fictional practice forms, matched A/B data and independent expectations.
- `docs`: [product specification](docs/product-spec.md), [architecture and sources](docs/architecture.md), [release](docs/release.md), [manual checklist](docs/manual-nvda-checklist.md), [usability protocol](docs/usability-protocol.md).
- `studies`: empty results template, session-log template and the pilot report generator.

V1 never autofills, submits, intercepts Submit, or bypasses CAPTCHA. Form
snapshots and document references stay local and temporary: reading, navigation
and validation all run in the browser and need no server, and the snapshot and
the reference spelling are never part of any request.

Separately, with the cloud feature switched on, three kinds of request leave
the browser, each only on the person's own action: a recording they stop and
send, for transcription; the transcript they approve, together with the
selected field's label, instructions, section and option labels (never its
value), for interpretation; and a help topic name, for generic help audio.
Raw audio cannot be redacted, and page labels or instructions are sent as the
page wrote them, so none of this is guaranteed to be free of personal
information — which is why identifier and secret fields never offer recording.
Cancelling before the upload discards the recording; cancelling afterwards only
refuses the reply, and switching the feature off stops any recording and
request in progress. Sarvam operations need explicit consent and a server-side
key; the extension holds no provider key and no shared permanent credential,
and no live provider call has been made yet. There is no database. The
companion website is static guidance and filed results; it receives no form
data.
