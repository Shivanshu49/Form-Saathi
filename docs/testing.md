# Foundation verification

Recorded 2026-09-12 on Linux x86-64 with Node 24.21.0, npm 11.19.0, and
Playwright 1.63.0's Chromium 153.0.8010.12. This is technical foundation
evidence, not a live-portal or NVDA usability result.

## Actual results

| Check | Result |
| --- | --- |
| Clean `npm ci` | Passed in a separate copy without node_modules, dist, .wxt, or .output; postinstall produced shared exports and WXT types |
| `npm run build` | Passed for both Nest ESM and Chrome MV3/WXT |
| `npm run typecheck` | Passed: real `tsc --noEmit` checks for all four workspaces and test/config files |
| `npm run lint` | Passed with warnings treated as failures |
| `npm run test:unit` | 2 Vitest tests passed; valid health data accepted, invalid/missing/extra data rejected |
| `npm run test:integration` | 3 Vitest tests passed; actual HTTP health response, Express adapter, Node imports of shared packages, unfinished AI route returns 404 |
| Playwright extension smoke | 1 test passed with the production extension installed in persistent Chromium |
| axe-core | 0 violations for the tested panel state and WCAG 2 A/AA and 2.1 A/AA tags |
| `npm run dev` | Shared, API, and extension watchers started; API on 3000 and WXT on 5173; Ctrl+C stopped all three |
| Development extension | Development panel loaded in Chromium and completed a real service check; rendered Hindi screenshot inspected |
| Direct health request | HTTP success with `{"status":"ok","service":"form-saathi-api"}` |
| npm dependency audit | 0 reported vulnerabilities after the documented dependency adjustments |

The browser check verifies toolbar-to-panel behavior configuration, MV3,
minimal production permissions, the real `sidepanel.html` entry point, Hindi
language metadata, unverified portal labels, and no automatic health request.
It uses Tab and Enter, checks focus after updates, validates the real service
response through the shared schema, and checks malformed-response and network
failure recovery. It also checks for uncaught page errors.

The browser page is opened at its extension URL. That does **not** simulate
Chrome's docked-panel focus switching or establish manual screen-reader
compatibility. The API integration tests bind an ephemeral loopback port;
Playwright starts the compiled API on port 3000 and shuts it down afterward.

## Reproduce

Follow [setup.md](setup.md) using the committed lockfile. Then:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium --no-shell
npm run test:e2e
```

For the initial restricted host, the verified Node archive lived at
`/tmp/node-v24.21.0-linux-x64`, the npm cache at
`/tmp/form-saathi-npm-cache`, and the browser download at
`/tmp/form-saathi-playwright`. The corresponding environment was:

```bash
export PATH=/tmp/node-v24.21.0-linux-x64/bin:$PATH
export PLAYWRIGHT_BROWSERS_PATH=/tmp/form-saathi-playwright
```

These temporary paths are local verification details, not repository
requirements. A regular installation uses its version manager and the default
Playwright browser cache.

## Resolved failures and environment limits

Initial sandbox DNS restrictions blocked downloads. Approved network access
allowed installation. An initial API integration attempt failed with
`listen EPERM` and skipped its three tests; all three passed after the execution
environment permitted loopback listeners. Neither failure is reported as a
passing test. There is no remaining dependency-installation blocker.

Actual code/configuration issues found and fixed were the NodeNext axe-core
import, a semantic HTML lint finding, and overlapping WXT/API default ports.
The initial dependency audit was addressed by removing the unused `web-ext`
launcher and overriding Nest's pinned Multer with its 2.3.0 security release.

Playwright warned that the host OS is not officially supported and used its
Ubuntu 24.04 fallback build. Chromium nevertheless launched and the recorded
tests passed. This does not establish support for every Linux distribution.

## Manual Chrome and NVDA testing — NOT RUN

Use a Windows machine with ordinary desktop Chrome and NVDA. Record the exact
OS/browser/NVDA versions, tester, date, steps, and findings. Do not mark these
items passed until actually observed:

- [ ] Load the production extension, pin it, and open the docked panel using
  Chrome's keyboard-accessible toolbar. Confirm its accessible name.
- [ ] Read headings and Hindi text with NVDA browse mode; confirm a suitable
  Hindi voice and language switching for English portal names.
- [ ] Tab to the service button, activate it with Enter and Space, and confirm
  focus remains on it while a single useful status change is announced.
- [ ] Stop and restart the API. Confirm failure and recovery are understandable
  and do not require a mouse.
- [ ] Check panel opening, closing, returning to the page, zoom at 200% and
  400%, narrow panel widths, visible focus, and Windows high-contrast mode.
- [ ] Confirm the unverified portal status cannot be confused with support
  confirmation or a completed form review.

Live NSP and ECI Form 6 testing, field inventories, sourced rules, full keyboard
navigation/review tasks, microphone/AI behavior, and participant trials are
**not performed** in this stage. There are no impact numbers or participant
feedback to report.
