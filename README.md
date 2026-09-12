# Form Saathi — फ़ॉर्म साथी

Accessible government-form navigation and review in Hindi, built for desktop
Chrome alongside screen readers, particularly NVDA.

**Foundation only:** the extension opens a Hindi side panel and can check the
local NestJS API. Form navigation, review, speech, and AI are later stages.
NSP and ECI Form 6 live support is **unverified**; the exact NSP workflow still
needs to be identified.

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

1. Open `chrome://extensions` in desktop Chrome and enable Developer mode.
2. Choose **Load unpacked** and select `apps/extension/.output/chrome-mv3-dev`.
3. Pin Form Saathi and activate its toolbar action to open the side panel.
4. Tab to **सेवा की स्थिति जाँचें** and press Enter. Expect **सेवा उपलब्ध है।**

The API listens at `http://127.0.0.1:3000`. This is a service check only; it
does not read the page or send form data. Stop development with Ctrl+C.

For a production-build smoke check, run `npm run build`, start the API with
`npm run start --workspace @form-saathi/api`, and load
`apps/extension/.output/chrome-mv3` instead. Avoid loading both copies together.

```bash
curl --fail http://127.0.0.1:3000/health
# {"status":"ok","service":"form-saathi-api"}
```

## Checks

```bash
npm run typecheck
npm run lint
npm test
npx playwright install chromium --no-shell
npm run test:e2e
```

Stop the development API before `test:e2e`, which owns port 3000. That command
builds both apps, starts the API, and uses Playwright's bundled Chromium with
the actual extension loaded. `npm test` runs Vitest unit and API integration
checks; each also has a separate `test:unit` or `test:integration` command.

`typecheck` runs TypeScript `--noEmit` for all workspaces and test/config files.
A successful WXT bundle alone does not establish type correctness. See
[test evidence and the manual Chrome/NVDA checklist](docs/testing.md).

## Workspace

- `apps/extension`: WXT, React, Tailwind/Vite, typed Chrome APIs.
- `apps/api`: strict TypeScript, NestJS, Express, ESM.
- `packages/contracts`: browser-safe Zod schemas and inferred types.
- `packages/rules`: browser-safe support metadata; validators and rule packs follow later.
- `fixtures`: fictional practice material only.
- `docs`: [product specification](docs/product-spec.md), [architecture and sources](docs/architecture.md).

V1 never autofills, submits, intercepts Submit, or bypasses CAPTCHA. Form
snapshots and document references must stay local and temporary. Future Sarvam
operations need explicit consent and a server-side key. There is no database
or companion website in this stage.
