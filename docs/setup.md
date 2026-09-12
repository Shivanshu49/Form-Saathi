# Development setup

## Runtime and installation

The official Node release index checked on 2026-09-12 identifies **24.21.0**
(2026-09-07) as the latest Node 24 LTS patch, with npm **11.19.0** bundled.
`.nvmrc`, `.node-version`, package engines, and `engine-strict=true` keep the
workspace on Node 24. Recheck patches before deployment; do not switch to a
different Node major just because it is the newest release.

With a checkout of this foundation and an existing nvm installation:

```bash
cd Form-Saathi
nvm install
nvm use
node --version
npm --version
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium --no-shell
npm run test:e2e
```

On Windows, use Node's installer or nvm-windows with explicit version arguments.
On supported Linux systems missing browser libraries, Playwright documents
`npx playwright install --with-deps chromium` (may require administrator access).
All repository scripts use npm workspaces and run on Windows without Unix
background-process syntax.

`npm ci` uses the root `package-lock.json`; do not install separately inside
each application or create nested lockfiles. Its root postinstall builds the
shared exports and runs `wxt prepare`. TypeScript build metadata lives inside
each package's generated `dist` directory so deleting `dist` triggers a rebuild.
After deliberately using `--ignore-scripts`, run `npm run postinstall` yourself.

## Resolved versions

| Component | Version selected for this foundation |
| --- | --- |
| Node / npm | 24.21.0 / 11.19.0 |
| WXT / React module | 0.21.4 / 1.2.2 |
| React / React DOM | 19.3.0 / 19.3.0 |
| Tailwind / Tailwind Vite plugin | 4.3.3 / 4.3.3 |
| Vite | 8.3.0 |
| Nest common/core/platform-express | 12.0.1 |
| Nest CLI | 12.0.0 |
| Express | 5.2.1 |
| TypeScript | 6.0.3 |
| Zod | 4.6.2 |
| Vitest | 5.0.0 |
| Playwright | 1.63.0 |
| axe-core Playwright adapter | 4.13.0 |
| Oxlint | 1.82.0 |
| concurrently | 10.0.5 |
| Chrome types / Node types | 0.1.43 / 24.13.4 |
| Next.js / Tailwind PostCSS plugin | 16.3.5 / 4.3.3 |

The lockfile contains every exact transitive version and integrity hash.
TypeScript 6.0.3 follows the Nest ESM starter's compiler line rather than
automatically selecting the newly released TypeScript 7. Node runtime tests,
`tsc --noEmit`, and browser builds determine compatibility here.

The initial template install included `web-ext`, whose image-parsing dependency
had advisories. Removing that unused launcher also removed its dependency tree;
use Chrome's native Load unpacked action. WXT supports manual browser startup.
Nest 12.0.1 pins Multer 2.2.0; a root override selects the same-major security
release [Multer 2.3.0](https://github.com/expressjs/multer/releases/tag/v2.3.0).
Remove the override when Nest's own dependency includes the fixes. No upload
route is implemented yet; future multipart integration still requires tests.

## Scaffold provenance

These commands were run before adapting the generated projects:

```bash
npx --yes wxt@0.21.4 init apps/extension --template react --pm npm
npx --yes @nestjs/cli@12.0.0 new form-saathi-api --directory apps/api --strict --skip-git --skip-install --package-manager npm --no-observe
```

Select **ESM (ES Modules)** in the Nest prompt. Root workspace manifests and
scripts replace the generated per-app installation/testing setup. Template
demo content was removed, including its Google content-script match. No
pre-existing prototype was available; see [the inspection record](architecture.md).
These scaffold commands document provenance and should not be rerun over this
checkout. Setup uses `npm ci`.

## Development and configuration

`npm run dev` runs three processes with coordinated shutdown: shared TypeScript
watch, Nest watch on port 3000, and WXT on port 5173. Load `apps/extension/.output/chrome-mv3-dev` in Chrome
manually. For separate terminals use `npm run dev:shared`, `npm run dev:api`,
and `npm run dev:extension` after `npm run build:shared`.

Chrome 116 or later is required. Open a form, then activate Form Saathi with its
toolbar button or `Alt+Shift+F`; change that shortcut at
`chrome://extensions/shortcuts`. Activation is what grants access to that one
tab, so the panel can read a page only while the user asks for it, and a panel
opened on one tab never reads another. After reloading the page, or if the
extension is rebuilt and reloaded, activate again or press **फ़ॉर्म फिर पढ़ें**.
The reader is injected on demand from `reader.js`; it is bundled but never
listed in the manifest, so no page runs extension code until activation.

`npm run dev:web` serves the companion website at `http://127.0.0.1:3100`;
`npm run build:web` builds it and `npm run start --workspace @form-saathi/web`
serves the build. The site links to the practice pages at
`NEXT_PUBLIC_PRACTICE_ORIGIN` (default `http://127.0.0.1:4173`), so run the
fixtures beside it. Next.js was added at this stage as the one new dependency;
it is a separate workspace and nothing in the extension or API imports it.

`npm run dev:fixtures` independently serves the local demonstrations at
`http://127.0.0.1:4173/`. `npm run build` also builds their static output;
`npm run preview:fixtures` serves `fixtures/dist`. No API, keys or extension is
needed to use the practice pages. The Playwright configuration starts both the
fixture preview and health API for automated checks. Stop servers on ports 3000
and 4173 before `npm run test:e2e` or `npm run test:fixtures`.

## Optional AI service configuration

The AI routes are off until a deployment configures them, and the extension
never needs them. To enable them, set `SARVAM_API_KEY` (server-side only) and
`PILOT_TOKEN_SECRET` in `.env`, then mint one expiring credential per
participant:

```bash
npm run build --workspace @form-saathi/api
PILOT_TOKEN_SECRET=<secret> node apps/api/dist/pilot-token.js participant-01 8
```

That prints a token valid for eight hours, for one person, on that deployment.
There is no shared permanent credential, and none of these values may ever be
given a `WXT_` or `VITE_` prefix: that would compile them into the extension.
Model names and limits are environment values too; see `.env.example`. A shared
deployment also needs HTTPS, its own origin in `apps/extension/config.ts`, and
the live provider checks listed in [testing.md](testing.md), which have **not**
been run. A reviewable deployment package — Caddy TLS termination, a systemd
unit and the distribution steps — is in [`deploy/`](../deploy/README.md).

In the panel, a person turns the cloud feature on under **क्लाउड सुविधा**, pastes
their credential, and the **बोलकर बताएँ** section offers recording for editable,
non-identifier fields. Consent and the credential are kept in Chrome's session
storage for that browser session only. Read-aloud needs a Hindi voice installed
on the machine; without one the panel says so and the text stays available to
the screen reader. If Chrome does not show the microphone prompt inside the
docked panel, open `chrome://settings/content/microphone` and allow the
extension there, or open the panel page once in a tab to answer the prompt.

The API defaults to `HOST=127.0.0.1`, `PORT=3000`. To override them, copy
`.env.example` to `.env`, replace the placeholders, and uncomment the desired
entries. The Node API launch commands load that root file; WXT does not need it.
If changing the API address, also update `apps/extension/config.ts` and rebuild
or restart WXT. Its manifest host permission and health request share that
constant. Sarvam configuration is reserved and unused in this stage.

## Installation blockers versus code failures

| Symptom | Classification and next step |
| --- | --- |
| `EBADENGINE` | Runtime mismatch. Activate Node 24.21.0 and npm 11.19.0 before installing. |
| `EAI_AGAIN`, `ENOTFOUND`, registry/proxy/TLS errors | Network installation blocker. Restore approved registry/CDN access and rerun `npm ci`. Do not disable TLS validation. |
| `EACCES` on npm cache | Environment permissions. Use an allowed cache, e.g. `npm ci --cache /tmp/form-saathi-npm-cache` on Linux. |
| Missing Playwright executable/libraries | Browser installation blocker. Install its matching Chromium and required platform libraries. |
| `listen EPERM` or browser process sandbox errors | Execution-environment restriction. Run the check in an environment that permits loopback listeners/browser processes. |
| `EADDRINUSE` on port 3000 | Another server is running. Stop that process or adjust the development address; E2E owns port 3000. |
| Compiler, lint, assertion, or Zod errors after installation | Code/check failure. Fix the failing code or configuration; do not report a passing check. |

In the initial workspace, the active Node was 22.23.1. A verified Node 24.21.0
archive and an npm cache under `/tmp` were used for checks without changing the
system Node. Sandbox DNS access initially failed; approved network access
allowed installation to complete. These environment restrictions are distinct
from compiler or test failures. Actual final results are in [testing.md](testing.md).
