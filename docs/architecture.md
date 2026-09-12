# Architecture

## Repository inspection

On 2026-09-12, the supplied local directory contained no source files, project
configuration, repository instructions, or usable Git history. The supplied
[GitHub repository](https://github.com/Shivanshu49/Form-Saathi) was empty too.
The earlier native TypeScript prototype described in the brief was not present.
No reusable domain logic could be inspected or migrated, and no original work
was overwritten. If the prototype is later provided, inventory its rules,
sources, DOM assumptions, secret handling, and tests before reusing anything.

## Foundation

| Location | Current responsibility |
| --- | --- |
| `apps/extension` | WXT React Hindi side panel, toolbar behavior, explicit health check |
| `apps/api` | NestJS ESM application with the Express adapter and `GET /health` |
| `packages/contracts` | Zod health response schema and inferred TypeScript type |
| `packages/rules` | Explicit unverified support flags; no portal rule packs yet |
| `fixtures` | Instructions for future fictional practice forms |
| `docs` | Product requirements, architecture, setup and verification evidence |
| `tests` | Compiled API integration and Chromium extension/accessibility smoke checks |

Both shared packages expose compiled ESM JavaScript and `.d.ts` files through
package `exports`. npm links them by their package names. The shared build runs
before application builds, tests, and development; a TypeScript watch process
updates their outputs during `npm run dev`. Neither package contains Node or
Chrome dependencies, and their TypeScript configurations exclude ambient Node
types. Avoid server imports, process environment access, I/O, and secrets in
these packages. The extension's production build exercises browser imports;
the API integration test exercises both public package exports in Node.

The Nest ESM starter retains NodeNext resolution, `.js` relative imports,
decorator compilation, and Express. `nest build --builder tsc` compiles the API;
each workspace also has a separate `tsc --noEmit` typecheck. WXT uses its
generated bundler configuration and `@types/chrome`, never a hand-written
`chrome: any`. WXT/Vite bundling is not treated as typechecking.

Vitest API tests load compiled output to exercise the actual ESM exports and
TypeScript decorator emit. The root typecheck also builds API declarations
before checking those test imports. Oxlint runs from the root with TypeScript,
React, and accessibility plugins. Playwright uses bundled Chromium in a
persistent context, with axe-core on the extension page.

## Current data flow and permissions

The toolbar action opens `sidepanel.html`. The panel imports both shared
packages, shows unverified portal status, and sends an empty `GET /health` only
when the user activates the service check. The response is parsed with the
same Zod schema the API uses. Failures leave a retryable Hindi status message;
there is no recording, storage, telemetry, or form access.

The production manifest currently requests only `sidePanel` and access to
`http://127.0.0.1:3000/*`. The [host match pattern](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)
and fetches use the exact loopback origin in `apps/extension/config.ts`.
There are no content scripts, page host
permissions, `activeTab`, `scripting`, storage, or TTS permissions yet. Add each
permission when its feature is implemented. WXT adds development-only
permissions and localhost connections for its reload tooling.

The API binds to loopback by default. `.env` is loaded only by API launch
commands and is ignored by Git. The example contains commented placeholders.
No Sarvam key is needed for health. There is no authentication or AI endpoint;
deploying an AI service is a later stage. Production needs a configured HTTPS
API origin, access control, usage limits, request validation, bounded uploads,
timeouts, and logs without recordings or personal contents.

## Intended later architecture

Content scripts will read supported visible controls and move focus. Local
validators and reviewed workflow-specific rule packs will produce findings.
The side panel will own navigation, microphone interaction, temporary values,
confirmation, and review invalidation. The background worker handles short
browser events. A replaceable Sarvam adapter inside Nest receives only approved
recordings or selected context; it never controls the browser. Next.js is
deferred until the core extension works.

## Official integration sources

Reviewed 2026-09-12; exact installed versions and commands are in
[setup.md](setup.md).

- [WXT installation and React TypeScript template](https://wxt.dev/guide/installation.html),
  [React module](https://wxt.dev/guide/essentials/frontend-frameworks.html),
  [TypeScript configuration](https://wxt.dev/guide/essentials/config/typescript.html).
- [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite):
  `@tailwindcss/vite` is supplied through WXT's `vite` callback.
- [Nest first steps](https://docs.nestjs.com/first-steps) and
  [CLI usage](https://docs.nestjs.com/cli/usages): the CLI offers an ESM starter,
  strict TypeScript, and the default Express adapter.
- [Node releases](https://nodejs.org/en/about/previous-releases): Node 24 is LTS;
  the current patch found during setup was 24.21.0, released 2026-09-07.
- [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/) and
  [TypeScript module configuration](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html).
- [Zod](https://zod.dev/) for shared runtime schemas.
- [Chrome sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
  for toolbar behavior and side-panel permissions.
- [Playwright Chrome extensions](https://playwright.dev/docs/chrome-extensions),
  [Vitest](https://vitest.dev/guide/), and
  [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing).

## Evidence boundaries

Passing a Chromium panel-page smoke check does not establish actual docked-panel
focus behavior, Windows/Chrome/NVDA usability, or live portal compatibility.
See [testing.md](testing.md) for the manual checklist and actual check results.
