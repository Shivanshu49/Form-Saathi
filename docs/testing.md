# Verification record

Recorded 2026-09-12 on Linux x86-64 with Node 24.21.0, npm 11.19.0, and
Playwright 1.63.0's Chromium 153.0.8010.12. This is technical foundation
evidence, not a live-portal or NVDA usability result.

## Foundation results — Prompt 1

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

The foundation did not include public-source inventories or practice forms;
Prompt 2 adds those below. Live portal testing, production rule packs, extension
navigation/review tasks, microphone/AI behavior and participant trials remain
**not performed**. There are no impact numbers or participant feedback.

## Practice environment results — Prompt 2

Recorded **2026-09-12**, same Node/npm/Chromium versions as above. Existing
dependencies were reused; the lockfile needed no changes. No installation
blocker occurred during this stage, and no fresh dependency installation was
needed. These are local demonstration tests, not live-workflow tests.

| Actual check | Result |
| --- | --- |
| `npm run typecheck` | Passed: real TypeScript checks across workspaces, fixtures, tests and configuration |
| `npm run lint` | Passed, warnings treated as failures |
| `npm test` | 5 Vitest tests passed: 2 contracts + 3 compiled API integration tests |
| `npm run build` (through `test:e2e`) | Passed for Nest, WXT Chrome MV3 and all three static practice entry points |
| `npm run test:e2e` | 10 passed: existing extension test plus 9 practice tests; all eight A/B × issues/complete form states covered |
| Practice axe-core scans | 0 violations for WCAG 2 A/AA and 2.1 A/AA tags on index, eight initial form states and two states after note insertion; excluded sandbox iframe remains untested by axe |
| `npm run dev:fixtures` | Vite started on loopback port 4173; index and both forms returned HTTP 200 and rendered the selected fictional references |
| Visual inspection | Chromium screenshots inspected for index, forms and a 320px narrow view; no manual NVDA claim |
| `git diff --check` | Passed |

`tests/browser/practice.spec.ts` keeps its fixture expectations independent of
the loader and future validators. It checks seeded values and native metadata,
read-only NSP demographics, optional empty ECI email/English name, radio arrow
keys, hidden/disabled conditional fields, retained hidden values, focus after
one-time note insertion, reset/profile switching, skip-link focus, narrow-screen
overflow and form-submit prevention. A 12-digit unclear value is preserved as
unclassified data. The frame is labelled, present and opaque to the parent page.

During those interactions, assertions found no external requests, non-GET form
requests, local/session storage entries, cookies or uncaught page errors. The
local submit guard was explicitly exercised. This is scoped test evidence, not
a guarantee about browser extensions or software outside this repository.

Failures found and resolved: a test needed proper DOM type narrowing; one NSP
option had a malformed closing tag, which the filled-case check detected; axe's
attempt to scan the deliberately sandboxed frame timed out. The test now
explicitly excludes `#unsupported-frame` from axe, retaining separate presence,
label and opaque-origin assertions. The frame's internal accessibility is
**not claimed as passing**. The interrupted/failed run was followed by the full
passing run reported above.

Reproduce with the root commands above, or run `npm run test:fixtures` for the
nine practice tests only. It builds the fixtures and uses the shared Playwright
servers on 4173 and 3000. The health API receives no fixture contents. See
[fixture setup and routes](../fixtures/README.md).

## Practice Chrome/NVDA protocol — NOT RUN

Use ordinary Windows Chrome and NVDA; record exact versions, Hindi voice,
tester/date and each observed failure. Repeat A/B within the same workflow.
The [independent oracle](../fixtures/expected-results.md) is for evaluators,
not the participant view. A/B are structurally matched; difficulty equivalence
has not been measured.

- [ ] Confirm demonstration, fictional-data and unverified-support messages
  are understood before entering a form.
- [ ] Use keyboard-only profile selection, skip links and NVDA heading/form
  navigation. Confirm labels, required/optional hints and English references.
- [ ] Read NSP inherited fields and explain that their correction is upstream;
  do not require editing a read-only control to finish that exercise task.
- [ ] On Form 6, compare English spelling with the fictional reference and
  correct editable name/date/address/PIN values. Optional email stays empty.
- [ ] Change radio choices with arrow keys, check announcements and confirm
  inactive required details are skipped; return and inspect retained values.
- [ ] Insert the optional note with Enter/Space. Confirm focus stays on the
  button and next Tab reaches the note once, with a useful status announcement.
- [ ] Encounter the unclear label and unsupported frame. Confirm these are
  understood as not checked rather than silently approved.
- [ ] Reset and switch profiles. Confirm old edits/notes disappear and no
  wording implies submission, identity verification or eligibility.
- [ ] Check 200%/400% zoom, narrow width, visible focus and Windows high contrast.

Extension-driven field navigation, sourced rule execution and final review are
later-stage features. An authenticated NSP/ECI session is still required for
current live inventories, conditional rules, focus behavior and compatibility.
No participant trial or measured impact result is available.

## Extension lifecycle and form reader results — Prompt 3

Recorded **2026-09-12** with the same Node 24.21.0, npm 11.19.0 and Playwright
Chromium 153.0.8010.12 as above. No dependency was added and the lockfile did
not change. These are automated browser results, not live-portal or NVDA results.

| Actual check | Result |
| --- | --- |
| `npm run typecheck` | Passed across all four workspaces, fixtures, tests and configuration |
| `npm run lint` | Passed with warnings treated as failures |
| `npm test` | 9 Vitest tests passed: 6 contract tests (2 health, 4 message contracts) and 3 compiled API integration tests |
| `npm run build` | Passed for Nest, WXT Chrome MV3 (`reader.js` emitted as an unlisted script) and the practice pages |
| `npm run dev:extension` | Development build produced the same entrypoints, including `reader.js` |
| `npm run test:e2e` | 13 passed: 1 panel smoke, 3 new reader tests and the 9 existing practice tests |
| Practice axe-core scan | 0 violations for WCAG 2 A/AA and 2.1 A/AA on the panel showing a read NSP form |
| Manifest check | `sidePanel`, `activeTab`, `scripting`; no content-script matches, no `tabs`, no optional host permissions; `_execute_action` bound to Alt+Shift+F |
| Side-panel API check | `setOptions` accepted the per-tab path `sidepanel.html?tab=<id>` and kept `sidepanel.html` as the default; `open()` refused without a user gesture, as documented |

`tests/browser/reader.spec.ts` installs the production extension and drives the
real injection, messaging and focus paths:

- Both practice forms are read. NSP profile A shows the inherited read-only
  values, the empty required district, the six-digit PIN pattern, the locality
  radio group as one choice and the 13 fields the page actually exposes; ECI
  profile B shows the Hindi and English names and its empty optional email.
- Selecting a panel item moves focus to that control: `document.activeElement`
  in the page became `nsp-district` and then `nsp-otr`.
- Dynamic changes update the snapshot without user action: choosing शहरी turned
  the conditional field inactive and dropped its value; the inserted practice
  note appeared as a 14th field; a district selection was reflected back.
- A second tab's review never mixed: the NSP panel never showed ECI fields, and
  the ECI panel never showed NSP fields, before or after each page changed.
- A reload cleared the NSP review and offered a re-read, which recovered it;
  closing the ECI tab cleared that review.
- A page of secrets was left unread: a password, one-time code, CAPTCHA answer
  and card number were reported as excluded coverage, a file input as an
  unsupported control, and only the postal PIN was read. The panel's rendered
  text contained none of the secret values.
- During those interactions the panel made no request outside `chrome-extension://`
  and the pages reported no uncaught errors.

Two real defects were found by these checks and fixed: an unbound panel parsed a
missing `?tab` as tab 0 and tried to read it, and the panel exposed two status
regions where the tests assumed one. Both were corrected before the run above.

### What these results do not establish

Playwright cannot click a browser toolbar or drive a docked side panel. The
checks therefore open the panel document at its own URL and serve the practice
pages from `http://127.0.0.1:3000`, the loopback origin the extension already
has host access to. The toolbar action, the `_execute_action` shortcut, the
`activeTab` grant they produce, and Chrome's own per-tab panel switching are
**not covered** and stay in the manual protocol below. No live portal was read.

## Reader Chrome/NVDA protocol — NOT RUN

Use ordinary Windows Chrome 116 or later with NVDA; record exact versions,
tester, date and every observed failure.

- [ ] Load `apps/extension/.output/chrome-mv3`, pin Form Saathi, open a practice
  form, and activate the toolbar button. Confirm the panel opens for that tab
  and lists its fields. Repeat with the keyboard shortcut, including after
  changing it at `chrome://extensions/shortcuts`.
- [ ] Confirm Chrome asks for no extra permission warning beyond the installed
  ones, and that an unactivated tab shows the unbound panel, not another tab's
  review.
- [ ] Tab through the field list with NVDA. Confirm each field's name, required
  or optional state, read-only state, value and page instructions are announced
  usefully, and that the status region is not chatty.
- [ ] Activate a field item with Enter and Space. Confirm focus lands on the
  original control in the page, that NVDA follows it, and that returning to the
  panel is possible with the keyboard alone.
- [ ] Insert the practice note and change the locality or age-document radio.
  Confirm the panel updates without stealing focus and that the conditional
  field is announced as inactive rather than empty.
- [ ] Reload the page, navigate away and close the tab. Confirm each case clears
  the review in understandable Hindi and that re-reading works after activating
  again.
- [ ] Open two practice tabs and switch between them. Confirm each tab shows its
  own review and never the other's.
- [ ] Confirm the coverage section is understood as “not checked”, especially
  the unsupported frame, and cannot be mistaken for a completed review.
- [ ] Check 200%/400% zoom, narrow panel widths, visible focus and Windows high
  contrast while the field list is long.

Validators, rule packs, findings, speech and AI remain unimplemented, so the
panel lists fields and moves focus but makes no judgement about them. Live
portal reading is still unverified and no participant trial has happened.

## Hindi interface results — Prompt 4

Recorded **2026-09-12** with the same Node 24.21.0, npm 11.19.0 and Playwright
Chromium 153.0.8010.12. No dependency was added and the lockfile did not change.

| Actual check | Result |
| --- | --- |
| `npm run typecheck` | Passed across all four workspaces, fixtures, tests and configuration |
| `npm run lint` | Passed with warnings treated as failures |
| `npm test` | 15 Vitest tests passed: 12 in `packages` (health, message contracts, recognition, masking, review outcomes) and 3 compiled API integration tests |
| `npm run build` | Passed for Nest, WXT Chrome MV3 and the practice pages |
| `npm run test:e2e` | 16 passed: 7 extension tests and the 9 practice tests |
| axe-core | 0 violations for WCAG 2 A/AA and 2.1 A/AA on the panel with a form read, and on the unsupported-page state |
| Screenshot inspection | Panel rendered at 420px and 320px; sections, grouped list, masked values and buttons inspected |

What the browser checks actually exercise in the interface:

- **Workflow status.** A loopback practice page is reported as a local page that
  is not a portal, with no supported workflow confirmed.
- **Grouped list.** The page's own fieldset legends become list sections, and
  controls without a legend fall into a final “अन्य फ़ील्ड” group.
- **Current field.** Label, entered value, instructions and the page's native
  format rule are shown; an English value carries `lang="en"`.
- **Keyboard only.** Tab order is re-read → previous → next → focus the page
  control → read aloud → stop → the field list. Enter drives every one of them.
  Previous stops at the first field, says so once, and keeps focus.
- **Focus and position.** Typing in one page field while a list button holds
  focus leaves that focus and the current field unchanged; only the changed
  value updates. The status line does not repeat itself for a value change, and
  returns to describing the page when the field count changes.
- **Masking and speech.** A 13-digit identifier shows as `•••••••••0001`, and
  nothing was spoken until the read-aloud button was pressed. The masked
  utterance asks the person to reveal the value first and does not contain it;
  after revealing, the spoken text does. A reload masks it again.
- **States.** Unbound, reading, unsupported page, reloaded page and closed tab
  each show their own Hindi text; the unsupported state offers a re-read and
  shows no field list or review area.
- **Narrow width.** At 320px the panel needs no horizontal scrolling and keeps
  its focus.
- **Style isolation.** The practice page's stylesheet count is unchanged after
  the panel reads it; the extension injects no CSS into pages.

The `error` state (the reader injected but not answering) is defensive and is
**not covered** by an automated check; the reachable failure paths — unsupported
page, reload, closed tab — are.

### What these results do not establish

These are Chromium checks of the panel document. They do not establish that the
docked side panel behaves the same, that Chrome's F6 pane cycling actually
returns focus to it, that any screen reader announces this interface usefully,
or that the Hindi wording is right for the people it is for. A Hindi voice for
read-aloud was not available in the test browser, so only the request was
verified, not the speech.

## Interface Chrome/NVDA protocol — NOT RUN

Use ordinary Windows Chrome 116 or later with NVDA. Record exact versions,
the Hindi voice used, tester, date and every observed failure. Nothing below may
be marked passed until it is actually observed.

- [ ] Open a practice form, activate Form Saathi, and confirm the panel's page
  and workflow status, its field count and its review area are understood.
- [ ] Move through the panel in NVDA browse mode. Confirm heading order, the
  grouped field list, and that English names and values switch voice.
- [ ] Use previous/next in focus mode. Confirm each move announces the new field
  once, that focus stays on the button, and that nothing else is repeated.
- [ ] Activate “मूल फ़ील्ड पर जाएँ” and a list item. Confirm focus lands on the
  page control, NVDA follows it, and **F6 returns focus to the panel**. If F6
  does not, record what does, and correct the panel's instructions.
- [ ] Correct a field in the page and return. Confirm the panel shows the new
  value, keeps the current field, and does not re-announce.
- [ ] Confirm masked identifiers are announced as hidden, that revealing needs a
  deliberate action, and that read-aloud never starts on its own or talks over
  NVDA. Confirm Stop works while speech is running.
- [ ] Confirm the review area reads as “not checked” and cannot be mistaken for
  approval, a completed review, or permission to submit.
- [ ] Check 200%/400% zoom, narrow and wide panel widths, visible focus, Windows
  high contrast, and that no control traps the keyboard.

Validators, rule packs, findings, microphone input and AI remain unimplemented.
Live portal reading is still unverified and no participant trial has happened.

## Validation engine and rule packs — Prompt 5

Recorded **2026-09-12** with the same Node 24.21.0, npm 11.19.0 and Playwright
Chromium 153.0.8010.12. No dependency was added and the lockfile did not change.

| Actual check | Result |
| --- | --- |
| `npm run typecheck` | Passed across all four workspaces, fixtures, tests and configuration |
| `npm run lint` | Passed with warnings treated as failures |
| `npm test` | 38 Vitest tests passed: 35 in `packages` (6 contracts, 29 rules) and 3 compiled API integration tests |
| `npm run build` | Passed for Nest, WXT Chrome MV3 and the practice pages |
| `npm run test:e2e` | 18 passed: 9 extension tests and 9 practice tests |
| axe-core | 0 violations for WCAG 2 A/AA and 2.1 A/AA on the panel showing a full review |
| Source retrieval | RBI NEFT FAQ and the UIDAI circular retrieved and quoted in [the register](source-register.md); India Post PIN-format pages returned HTTP 404 |

`packages/rules/src/validate.test.ts` builds its fixtures by hand from
[the independently authored oracle](../fixtures/expected-results.md) and the
published inventory, never from the engine's output:

- **Seeded problems are found.** NSP profile A yields exactly four errors — the
  impossible February date, the empty district, the empty conditional locality
  detail and the 13-digit OTR — plus one name confirmation once a reference is
  supplied. ECI profile A yields exactly four errors, including the five-digit
  PIN, plus one name confirmation. Both match the oracle's counts.
- **Filled profiles stay quiet.** Both `case=complete` profiles produce zero
  errors and zero confirmations while still producing unchecked results.
- **Conditional controls.** Choosing another locality, or hiding the control,
  removes the requirement; an unreadable controlling field produces
  `conditional-unknown`, not a guess.
- **Calendar.** 29/02/2024 and 29/02/2000 are accepted, 29/02/2023, 29/02/1900,
  31/02/2004 and 31/04/2020 are rejected with the month's real length, and
  month 13 is rejected as a month.
- **Devanagari digits.** `१५/०८/२०००` validates as a date and `२२६००१` as a PIN,
  each with an unchecked note that portal acceptance of those digits is unknown.
- **Identifiers follow meaning, not shape.** `SBIN0001234` passes and five
  malformed variants fail; the OTR rule fires only on an OTR-mapped field and
  says it is not Aadhaar; a 12-digit value in the deliberately unclear field is
  reported as unknown meaning, never classified; Aadhaar and EID mapped fields
  produce unchecked results and never an error.
- **Names.** A difference is needs-confirmation with both spellings shown and a
  reminder that speech does not decide spelling; no reference means unchecked;
  a cleared English name on Form 6 is unchecked, not missing information.
- **Nothing is claimed without a pack.** A page no pack describes produces one
  `no-rule-pack` result and no field results at all.

The browser checks drive the same engine through the panel: the four NSP errors
and their sources appear in the review, typing the reference spelling turns the
name result into a confirmation, a result's own button moves focus to its field,
correcting that field in the page clears the result without touching the panel,
and a filled profile shows `सुधार चाहिए (0)` and `पुष्टि चाहिए (0)`.

### Hindi number parser audit

No Hindi number-word parser is reused or written. `normalizeDigits` maps the ten
Devanagari digits one to one onto 0–9 and leaves everything else untouched,
which a test asserts on `दो सौ`. Word sequences are ambiguous — adding number
words together would read “सौ दो” and “दो सौ” the same way — so numeric words are
never converted, and a value containing them simply fails its format rule
instead of being silently reinterpreted.

### What these results do not establish

No rule pack has been tested against a live portal, so every review begins with
`live-testing-unverified`. Field mappings use the practice inventory's control
names; the portals' real control names, requirements and conditional behaviour
remain unknown. Aadhaar, EID and PIN-format checks are deliberately absent or
labelled as fixture conventions because the sources above were not retrieved —
this is a recorded gap, not a passing check. The Hindi wording of every message
still needs human review, and no screen-reader test of the review area has been
performed.

## Validation Chrome/NVDA protocol — NOT RUN

- [ ] Read the review with NVDA on both practice forms. Confirm the three
  severity groups, their counts, each message, its next action and its source
  are understood, and that “जाँचा नहीं गया” is never taken as approval.
- [ ] Use a result's “फ़ील्ड पर जाएँ” button, correct the value in the page, and
  return. Confirm the result disappears and nothing else moves unexpectedly.
- [ ] Type a reference spelling with a screen reader. Confirm the name result
  appears as a confirmation, shows both spellings, and that the panel says the
  reference is neither saved nor sent.
- [ ] Confirm the Hindi of every message and action is understandable to the
  people this is for, and have a Hindi reviewer sign off on the wording.
- [ ] Confirm a filled profile reads as “nothing found yet”, never as “ready to
  submit”, and that the pack's unverified status is noticed.

## AI and speech service — Prompt 6

Recorded **2026-09-12** with the same Node 24.21.0, npm 11.19.0 and Playwright
Chromium 153.0.8010.12. No dependency was added and the lockfile did not change:
multipart uploads use the Express integration and multer that Nest already
depends on, and the rate limiter is a few lines rather than a new package.

| Actual check | Result |
| --- | --- |
| `npm run typecheck` | Passed across all four workspaces, fixtures, tests and configuration |
| `npm run lint` | Passed with warnings treated as failures |
| `npm test` | 55 Vitest tests passed: 35 in `packages` and 20 API integration tests |
| `npm run build` | Passed for Nest, WXT Chrome MV3 and the practice pages |
| `npm run test:e2e` | 18 passed: 9 extension tests and 9 practice tests |
| Provider documentation | S1–S3 retrieved and quoted in [the register](source-register.md); `saaras:v3`, `sarvam-105b` and `bulbul:v3` all appear in the current reference |

`tests/api.ai.integration.test.ts` runs the compiled service against a
controlled HTTP mock standing in for the provider, so the real adapter code —
request shape, retries, timeouts, malformed replies — is what executes:

- **Authentication.** No credential, a made-up one, a tampered one, one signed
  with another secret and an expired one are each refused with `unauthorized`.
  A deployment with no signing secret answers `service_not_configured` on `/v1`
  while `/health` keeps working; so does one with no provider key.
- **Request validation.** A body that does not match the contract is rejected
  with the failing paths and **without the submitted values**, which the test
  asserts by looking for a fixture address in the error body. An unknown help
  topic and an over-long transcript are rejected too.
- **Uploads.** A WAV recording is transcribed and the temp directory is
  unchanged, confirming nothing reaches disk. A missing file, an unsupported
  type, a file whose bytes contradict its declared type, and an upload over the
  configured limit are refused with `invalid_request`, `unsupported_media`,
  `unsupported_media` and `payload_too_large` — and none of them reaches the
  provider. The provider request carries `saaras:v3`, `hi-IN` and the key
  header.
- **Provider failures.** A 500 is retried exactly once and then reported as
  `provider_unavailable` — two attempts, never an unbounded loop. A 429
  followed by success recovers. A provider that never answers times out and the
  caller still gets a bounded reply.
- **Malformed model output.** Seven bad replies are each rejected with
  `provider_response_invalid`: prose instead of JSON, missing fields, a value
  containing `<script>`, a value containing a CSS selector, an unknown outcome,
  and an attempt to set `requiresConfirmation` itself. A well-formed suggestion
  is returned with `requiresConfirmation: true` added by the service.
- **Bounded suggestions.** A value the field does not offer is downgraded to
  `unknown` rather than passed on.
- **Untrusted page text.** A field description containing “Ignore previous
  instructions…” is sent as user data under a system prompt that says not to
  follow instructions inside it.
- **Generic help.** The help route speaks only the service's own Hindi text with
  `bulbul:v3`; no page content or form value can reach it, because the request
  carries a topic name rather than text.
- **Rate limits and safe errors.** A credential limited to three requests a
  minute gets `rate_limited` on the fourth. Provider text, the provider key and
  the pilot secret appear in no response body, and every failure parses as the
  error contract.

The extension check also reads every built file in `.output/chrome-mv3` and
asserts none contains a provider key, a key header name or a secret variable
name. The panel makes no request outside `chrome-extension://` while reading and
checking a form, so navigation and validation keep working with the service
stopped or absent.

### Live provider verification — NOT RUN

No request has been sent to Sarvam from this repository. There is no account,
no key and no live result. The mocks prove this service's own behaviour, not
the provider's: the request shapes follow the retrieved documentation but have
never been accepted by the real API, no model has produced a real transcript,
interpretation or audio clip, and latency, Hindi quality, JSON-schema
adherence, pricing and provider rate limits are all unverified. Before a pilot:

- [ ] Send one real request to each route with a funded key, and record the
  status, latency and a redacted reply shape.
- [ ] Confirm `saaras:v3` transcribes Hindi speech usefully, and compare it with
  `saaras:v4` before choosing a default.
- [ ] Confirm `sarvam-105b` honours `response_format: json_schema`; if it does
  not, confirm the plain-JSON fallback still produces contract-valid replies.
- [ ] Confirm `bulbul:v3` with the configured speaker is understandable at the
  speed a screen-reader user expects, and that the WAV plays in Chrome.
- [ ] Re-check the published limits against the configured timeout, retry count
  and upload ceiling, then record the provider's own rate limits here.
- [ ] Deploy over HTTPS with a real origin, mint per-participant credentials,
  and confirm the expiry actually ends access.

## Speech and constrained suggestions — Prompt 7

Recorded **2026-09-12** with the same Node 24.21.0, npm 11.19.0 and Playwright
Chromium 153.0.8010.12. No dependency was added and the lockfile did not change.

| Actual check | Result |
| --- | --- |
| `npm run typecheck` | Passed across all four workspaces, fixtures, tests and configuration |
| `npm run lint` | Passed with warnings treated as failures |
| `npm test` | 59 Vitest tests passed: 39 in `packages` (6 contracts, 33 rules) and 20 API integration tests |
| `npm run build` | Passed for Nest, WXT Chrome MV3 and the practice pages |
| `npm run test:e2e` | 21 passed: 12 extension tests and 9 practice tests |
| axe-core | 0 violations on the panel with the speech section, a suggestion, a field meaning and help audio showing |

The browser checks run Chromium with a silent fake microphone
(`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`) and
answer the service's routes from the test, so the panel's own recording,
upload, transcript, interpretation and checking code is what runs. Where a
test does not route a request, the real service — started unconfigured — answers
it, and the panel's handling of that real `503` is asserted too.

- **The six steps, in order.** The person selects an editable date field, sees
  that the cloud feature is off, enables it after reading an explanation that
  says raw audio cannot be redacted, records on the fake microphone, stops, sees
  the transcript in an editable box, corrects it, approves it, and receives a
  suggestion that the local rules check as if it were in the field. The page
  field still holds its old value afterwards: nothing was written.
- **What leaves the browser.** No `/v1` request is made before consent. The
  upload carries the recording as the `audio` part with the person's credential;
  the interpretation request carries the field's label and instructions and
  **not** its current value; asking a field's meaning sends no `value` key at all.
- **Bad and ambiguous suggestions.** A suggested `31/02/2000` is shown under
  सुधार चाहिए by the local calendar rule; an `unknown` reply is shown as a
  request for clarification with no value at all.
- **Meaning and help.** An AI guess about a field is labelled as a guess beside
  the pack's own requirement and source, and must be accepted explicitly. Help
  audio arrives as the service's own text in a native `<audio controls>` player.
- **Failures leave the keyboard path usable.** Identifier and read-only fields
  offer no recording. A denied microphone, the real unconfigured service, a
  provider failure, a cancelled request and a stalled service that hits the
  panel's own timeout each show their Hindi explanation, after which previous
  and next field still move, the review still counts, and a correction in the
  page still clears its result.
- **Voices.** With only a remote Hindi voice on offer nothing is spoken, the
  panel says so, and navigation continues; with a local one the read-aloud
  speaks the masked or revealed text as before.

### What these results do not establish

The fake microphone records silence, and every transcript and suggestion in
these checks was supplied by the test. No real speech was transcribed and no
real model produced a suggestion, so the quality of Hindi recognition, the
model's handling of ambiguous dates, and the usefulness of its explanations are
all unverified — the prompts ask for `unknown` on ambiguity, but only a live
run can show whether the model complies. Chrome's microphone prompt inside a
docked side panel was not exercised; the `--use-fake-ui` flag stood in for it.
`chrome.tts` was stubbed: whether a real local Hindi voice exists on a
participant's machine, and how it sounds, is a manual check.

## Speech Chrome/NVDA protocol — NOT RUN

- [ ] With a configured service and a real credential, record a short Hindi
  date on a real microphone. Confirm the prompt appears in the docked panel,
  the recording status and its seconds are perceivable, Stop and Cancel work
  from the keyboard, and the transcript is editable with NVDA.
- [ ] Speak an unambiguous date and confirm a DD/MM/YYYY suggestion; speak one
  without a year and confirm a clarification with no value. Record what the
  model actually did.
- [ ] Confirm a suggestion is never placed in the page, that “सुझाव कॉपी करें”
  and manual paste work with NVDA, and that the local checks on the suggestion
  are announced usefully.
- [ ] Confirm identifier fields refuse recording with an understandable reason,
  and that the consent text is understood, including that audio is not redacted.
- [ ] Check `chrome.tts` voices on the participant's Windows machine: confirm a
  local Hindi voice is used for values and that a remote-only setup is refused.
- [ ] Play cloud help audio and confirm the native player is operable and the
  content is generic.
- [ ] Deny the microphone, stop the service, and pull the network. Confirm each
  message is understood and that field navigation and the review keep working.

## Final review and change invalidation — Prompt 8

Recorded **2026-09-12** with the same Node 24.21.0, npm 11.19.0 and Playwright
Chromium 153.0.8010.12. No dependency was added and the lockfile did not change.

| Actual check | Result |
| --- | --- |
| `npm run typecheck` | Passed across all four workspaces, fixtures, tests and configuration |
| `npm run lint` | Passed with warnings treated as failures |
| `npm test` | 63 Vitest tests passed: 43 in `packages` (6 contracts, 37 rules) and 20 API integration tests |
| `npm run build` | Passed for Nest, WXT Chrome MV3 and the practice pages |
| `npm run test:e2e` | 23 passed: 14 extension tests and 9 practice tests |
| axe-core | 0 violations on the panel with the full review, table and status showing |

`packages/rules/src/review.test.ts` shows the revision is identical for
identical data and different for every relevant change it tries — document,
reference, pack version, pack presence, a coverage gap, a value, a field's
state, its requirement, its label, a field removed, a field added — and that the
summary never reports clear while anything checkable is unchecked, ranks
blockers before corrections before confirmations, and names each blocker.

In the browser, on NSP profile A with the reference supplied:

- **Summary and navigation.** “13 फ़ील्ड पढ़े गए · 4 सुधार · 1 पुष्टि”; “अगली
  समस्या” moves the current field through the five open issues in page order
  and announces “समस्या 1 / 5”; the table shows each entered value (masked where
  long), its result, and “नियम पैक में नहीं” for unmapped controls.
- **Acknowledgment.** With issues open, acknowledging records the reading and
  the status says “समीक्षा पढ़ी गई, पर 4 सुधार बाकी हैं” with a revision label.
- **Correcting a seeded issue updates the result.** Choosing a district drops
  the errors to three, and the acknowledgment turns stale, said once in the
  status region; acknowledging again records the new revision.
- **A programmatic change invalidates.** Setting an input's `value` from a
  script, with no event, reaches the panel within the reader's three-second
  re-read and invalidates the acknowledgment.
- **Rescan before acknowledging.** A value changed just before pressing the
  button is never signed off as the old data: either the panel says the form
  changed, or the acknowledgment is recorded against data that already shows
  the new value.
- **Never all-clear on an unsupported field.** A filled profile with the
  unsupported frame acknowledges as “आंशिक समीक्षा: कवरेज अधूरी है”, never as
  “समीक्षा स्वीकृत”; a page with a CAPTCHA field acknowledges as “रुकी हुई” with
  the blocker named.
- **Never changes or submits.** After the whole flow the practice page's own
  status still reads “कोई आवेदन नहीं भेजा जाता” and the seeded values are
  untouched.
- **Spoken review.** The spoken text carries the counts and the sentence that
  the review is not acceptance, identity verification or submission.

### What these results do not establish

No submission evidence exists in this project and none is claimed: the practice
forms have no Submit and the panel never looks for one. Whether a live portal
exposes reliable submission evidence is unknown. The three-second re-read is a
cost paid on every bound page; it was not measured on a large live form. No
screen-reader test of the review table, the next-issue announcements or the
stale-acknowledgment notice has been performed.

## Final review Chrome/NVDA protocol — NOT RUN

- [ ] Read the review with NVDA: the summary, the status, the table with table
  navigation commands, and each severity group. Confirm “जाँचा नहीं गया” and
  “आंशिक समीक्षा” are understood as limits, not approval.
- [ ] Use “अगली समस्या” through every issue, fix each in the page, return with
  F6, and confirm each result disappears and the acknowledgment turns stale
  with one announcement.
- [ ] Acknowledge, then change a value in the page and confirm the stale notice
  is heard once and the status shows the acknowledgment is no longer valid.
- [ ] Play the spoken review with a local Hindi voice and stop it midway.
- [ ] Confirm that nothing in the panel reads as permission to submit, and that
  the person understands submission happens on the portal, by them.

## Complete workflow verification and pilot preparation — Prompt 9

Recorded **2026-09-12** with the same Node 24.21.0, npm 11.19.0 and Playwright
Chromium 153.0.8010.12. No dependency was added and the lockfile did not change.

| Actual check | Result |
| --- | --- |
| `npm run typecheck` | Passed across all four workspaces, fixtures, tests, studies and configuration |
| `npm run lint` | Passed with warnings treated as failures |
| `npm test` | 75 Vitest tests passed: 45 in `packages` (6 contracts, 39 rules) and 30 in `tests/` (3 API, 17 AI service, 5 panel inbox, 5 pilot report) |
| `npm run build` | Passed for Nest, WXT Chrome MV3 and the practice pages |
| `npm run test:e2e` | 23 passed: 14 extension tests and 9 practice tests, all in Playwright's bundled Chromium with a persistent context loading the packaged `.output/chrome-mv3` build |
| `npm run package:pilot` | Produced `apps/extension/.output/form-saathiextension-0.1.0-chrome.zip` (150.7 kB) |
| `npm run report -- studies/results-template.json` | Printed an empty report; an invalid file was refused with field paths and exit code 1 |
| axe-core | 0 violations across the unbound panel, a read form, the unsupported-page state, a full review with speech section, suggestion, field meaning and help audio |

### Coverage matrix

Every automated check runs against the packaged extension loaded into a
persistent Chromium context — the side panel document at its own URL, the real
reader injected into real practice pages — never a stand-in for the panel.

| Required area | Vitest | Playwright |
| --- | --- | --- |
| Activation and keyboard navigation | — | `extension.spec.ts`: action listener, manifest, unbound panel by keyboard; `reader.spec.ts` “works from the keyboard alone” |
| Field focus and return | — | list item and “मूल फ़ील्ड पर जाएँ” move page focus; the return route is displayed. F6 itself is manual (checklist F4) |
| Dynamic fields and conditional requirements | `validate.test.ts` conditional controls | note insertion, locality radio, inactive value dropped |
| Tab isolation and stale-response rejection | `inbox.test.ts`: other tab, other document, older sequence, other extension, page-sent activation | two panels never mix; reload and closed tab clear the review |
| Seeded mistakes and valid inputs | `validate.test.ts` against the oracle; `review.test.ts` | rule-pack review with four errors and one confirmation; filled profile with zero |
| Review invalidation | `review.test.ts`: revision changes, acknowledgment state transitions | acknowledgment, corrected issue, scripted value, rescan-before-acknowledge |
| API failure and malformed AI responses | `api.ai.integration.test.ts` against a controlled provider mock; `messages.test.ts`, contract tests | routed 502, real 503, cancellation, timeout, denied microphone |
| Manual-only correction and submission behaviour | — | page values and its own status untouched after every flow; `reader.js` contains no submit, click, dispatch or checkbox write |
| Explicit unsupported coverage | `validate.test.ts` coverage gaps and no-pack; `review.test.ts` never-clear | frame, secrets and unsupported controls reported; filled profile stays partial |

axe-core results are technical facts about the panel document. They are **not**
evidence that a screen-reader user can use it: that evidence can only come from
[the manual checklist](manual-nvda-checklist.md), every row of which is still
NOT RUN.

### Pilot preparation

- [Release steps](release.md) for the package and the service.
- [Manual Windows Chrome/NVDA checklist](manual-nvda-checklist.md): focus,
  Hindi pronunciation, error announcements, zoom, keyboard-only operation and
  speech interruption — all NOT RUN.
- [Usability protocol](usability-protocol.md): conditions A, B and C, equivalent
  A/B profiles, counterbalanced order, tasks from the oracle, and the measures —
  remaining errors, false warnings, missed errors, completion, time, human
  assistance, with CAPTCHA blockers recorded separately.
- `studies/`: the empty results template, the session-log template, and the
  report generator with its schema, which accepts pseudonymous counts only.

No participant session has been run. `studies/results/` is empty, the report
prints that nothing is recorded, and no number in this repository is a result.

## Companion website — Prompt 10

Recorded **2026-09-12** with Node 24.21.0, npm 11.19.0 and Playwright
Chromium 153.0.8010.12. **One dependency was added**: Next.js 16.3.5 with
Tailwind's PostCSS plugin 4.3.3, in the new `apps/web` workspace only; nothing
in the extension or API imports it. `npm audit` after installation reported 0
vulnerabilities and the lockfile changed accordingly.

| Actual check | Result |
| --- | --- |
| `npm run typecheck` | Passed across all five workspaces, fixtures, tests, studies and configuration |
| `npm run lint` | Passed with warnings treated as failures |
| `npm test` | 75 Vitest tests passed (unchanged) |
| `npm run build` | Passed for Nest, WXT Chrome MV3, the practice pages and the Next.js site: eight static routes and one dynamic results route |
| `npm run test:e2e` | 29 passed: 14 extension, 9 practice and 6 website tests, the site served by `next start` from its built output |
| axe-core | 0 violations on all eight site pages for WCAG 2 A/AA and 2.1 A/AA |
| Results loader | A missing folder and the empty `studies/results/` both yield the empty state; an invalid file yields a schema error naming the file; one valid session yields the summary |

What the website checks establish:

- **Every page** has `lang="hi"`, exactly one `h1`, a skip link that is the
  first Tab stop and moves focus to `main`, and no axe violations.
- **Installation matches the package.** The page is checked against the built
  manifest: the zip name carries the manifest version, the minimum Chrome
  version, the `_execute_action` shortcut and every permission are the ones the
  build declares, and the steps say “Load unpacked”, which is how Chrome
  installs a package outside the Web Store.
- **The workflow matrix is the rule packs.** Each pack's id, review date,
  “असत्यापित” status and every field key are rendered from `packages/rules`;
  the page holds no copy of a rule.
- **Practice links are the fixture pages.** All eight links point at the
  fixture origin with the variant and scenario query the extension tests use,
  and each returns 200 from the running fixture server. The extension reads
  those pages in `reader.spec.ts`; the site itself has no file input and tells
  visitors not to enter Aadhaar or real documents.
- **The results page is honest when empty.** With `studies/results/` empty it
  shows “अभी कोई सत्र दर्ज नहीं”, no table, and no percentage anywhere.
- **No forbidden claim.** No page contains government-affiliation wording,
  universal-compatibility wording, acceptance guarantees or measured-improvement
  figures, and every page's footer states the project's independence.

A defect was found and fixed by these checks: Tailwind's preflight removed
link underlines, so in-text links were distinguished by colour alone
(`link-in-text-block`, serious). The stylesheet now underlines links inside
`main`.

### What these results do not establish

The website has not been read with NVDA or any screen reader; axe results are
technical facts about the pages. The Hindi wording has not been reviewed by
users. The practice links resolve to the local fixture origin; a deployed site
needs `NEXT_PUBLIC_PRACTICE_ORIGIN` set and the fixtures served there. No
participant result exists, so the results page has only been seen empty and
with a synthetic one-session file used to exercise the loader, which is not a
result and was not kept.

## Release 0.1.0 preparation — Prompt 11

Recorded **2026-09-12** with Node 24.21.0, npm 11.19.0 and Playwright
Chromium 153.0.8010.12. No dependency was added.

| Actual check | Result |
| --- | --- |
| `npm audit` | 0 vulnerabilities |
| `npm run typecheck` | Passed across all five workspaces, fixtures, tests, studies and configuration |
| `npm run lint` | Passed with warnings treated as failures |
| `npm test` | 75 Vitest tests passed |
| `npm run build` | Passed: API `dist/`, extension `.output/chrome-mv3`, website `.next/`, practice `dist/` |
| `npm run test:e2e` | 29 passed: 14 extension, 9 practice, 6 website |
| `npm run package:pilot` | `form-saathiextension-0.1.0-chrome.zip`, 11 files, rebuilt from a deleted `.output/` |
| Package inspection | Performed by hand on the unpacked zip; findings in [release.md](release.md): no secrets, one host permission (the API origin), no remote or dynamic code, no dev-only configuration, no network calls in `reader.js` |
| CORS / host permission | An extension page fetched a permitted host that sent no CORS headers and received `ok: true`; the API needs no CORS configuration |
| `git` | Seven stage commits pushed to `origin/main` at `cca0231`; the release-preparation commit follows |

No release-blocking failure remained. Two defects found during earlier stages
and fixed before this release are recorded above (the `Number(null)` tab id,
the missing `input` listener, the colour-only links on the website).

### Not done, stated plainly

Not publicly deployed. Not published to the Chrome Web Store. Not tested with
any user. No live portal workflow manually verified. No live provider request
made. Every row of the manual NVDA checklist NOT RUN. `studies/results/` empty.

## Audit follow-up verification — 2026-09-12, second pass

Recorded **2026-09-12** with Node 24.21.0, npm 11.19.0 and Playwright 1.63.0's
bundled Chromium, on the final working tree after the last edit. No dependency
was added and the lockfile did not change. These are local automated results;
none is live-provider, live-portal, NVDA or participant evidence.

| Actual check | Result |
| --- | --- |
| `npm run typecheck` | Passed across all five workspaces, fixtures, tests, studies and configuration |
| `npm run lint` | Passed with warnings treated as failures |
| `npm test` | 101 Vitest tests passed: 56 in `packages` (5 new date-of-birth cases) and 45 in `tests/` (4 relocation, 2 error-filter and 4 caller-cancellation cases added; the timeout case now also asserts the abandoned upstream connection) |
| `npm run test:e2e` | 52 passed in 4.6 minutes, no retries or skips: 37 extension (1 smoke, 7 isolated hook, 29 reader — 4 new), 9 practice, 6 website |
| `npm run package:pilot` | `form-saathiextension-0.1.0-chrome.zip`, 153,630 bytes, 11 files, identical to the rebuilt `chrome-mv3` directory; SHA-256 `8e5674c9de82f5ad3072aa439544974dacdf87bd4aa1da0c8d0e573cc4824b7c` |
| Package inspection | Five declared permissions, one host permission (`http://127.0.0.1:3000/*`), no secret, key-header, dev-server, websocket, hot-reload or source-map marker; `reader.js` has no network call |
| axe-core | Included in the runs above: panel states, practice pages and all website pages, 0 violations |
| Negative controls | Recorded in [the audit](audit-2026-09-12.md#negative-controls): 9 Vitest failures and 4 Playwright failures on the pre-edit tree, each on the defect its test covers |

What the new automated checks establish:

- **Replacement focus.** With the PIN field current, replacing it by an
  identical clone keeps "फ़ील्ड 7 / 13" and “मूल फ़ील्ड पर जाएँ” focuses the
  clone — after the reader's push, and with a focus request held until after
  the replacement. Two id-less forms with the same control name resolve by
  ownership. Identical twins with one removed and the other replaced are
  announced as uncertain, nothing is focused, and the list still offers the
  survivor; a removed control is announced and next/previous keep working.
- **Document lifetime.** A reference and acknowledgment entered on ECI do not
  reappear after navigating the same tab to NSP, including when the held
  acknowledgment rescan is released afterwards, after a reload, and after the
  tab closes; a re-read and an edit of the same document keep the reference.
- **Inactive choices.** Hidden select, checkbox, radio and text controls carry
  no value, no `selected: true` and no marker in the serialized snapshot or in
  a meaning-request payload, and are read fresh once shown.
- **Cancellation.** Against a controlled provider that holds its reply: a
  client abort after a JSON body, and after a fully received recording, closes
  the upstream request, no retry follows, the next request completes; an abort
  during retry backoff ends the wait and prevents the retry; an uncancelled
  held request completes; a provider timeout abandons the upstream attempt.
  The error filter writes nothing to a destroyed connection.
- **Dates.** Today accepted and tomorrow rejected against an injected clock,
  year 0000 and impossible dates rejected, leap days accepted, native ISO
  values read, native `min`/`max` enforced only on a date control, and the
  eligibility note present as a permanent limit.

### What these results do not establish

The docked panel, the toolbar gesture, real speech, real model behaviour, the
live portals' control types and form structure, and how NVDA announces the
new relocation and date messages are all unverified. `docs/manual-nvda-checklist.md`
gained rows F7, E5, E6, P5 and S7 for them; every row remains NOT RUN.

### Live provider verification — still NOT RUN

No Sarvam key was available in this session, so no live request was made. The
adapter was compared again with the current published reference (S1–S3 in the
register) and matches on every field name; the checklist above stands. The
commands, cases and recording template are in
[live-verification.md](live-verification.md): `tests/live/sarvam-live-check.ts`
for the service → provider path and the gated Playwright `live` project for
the extension → service → provider path. Paste their printed tables here when
they are run.

## Release preservation and external-verification preparation — 2026-09-12, third pass

Recorded **2026-09-12** with Node 24.21.0, npm 11.19.0 and Playwright 1.63.0
(Chromium build 1243). No dependency was added and the lockfile did not
change. This pass prepared every external stage that this environment cannot
perform and preserved the release candidate; it performed **no** live
provider call, portal session, NVDA session, participant session or
deployment.

| Actual check | Result |
| --- | --- |
| `npm run typecheck` | Passed across all five workspaces, fixtures, tests, studies and configuration |
| `npm run lint` | Passed with warnings treated as failures |
| `npm test` | 101 Vitest tests passed: 56 in `packages`, 45 in `tests/` (the `unclearWording` measure added to the study schema and its report assertions) |
| `npm run test:e2e` | 52 passed in 4.7 minutes, no retries, no flaky, no skipped: 37 extension (1 smoke, 7 isolated hook, 29 reader), 9 practice, 6 website |
| `npm run package:pilot` | 153,630 bytes, 11 files, `diff -r` identical to the rebuilt `chrome-mv3` directory |
| Package identity | SHA-256 `8e5674c9de82f5ad3072aa439544974dacdf87bd4aa1da0c8d0e573cc4824b7c` — **unchanged** from the previous pass, because this pass touched no file that enters the extension bundle |
| Packaged manifest | `host_permissions` `["http://127.0.0.1:3000/*"]` (still the loopback origin: no HTTPS origin has been authorized), five permissions, version 0.1.0 |
| Live provider script without a key | Exited 2 and sent nothing, as designed |
| Playwright project listing | 0 `live` tests without `FORM_SAATHI_LIVE=1`, 3 with it |
| `git diff --check` | Passed |
| Dependency/toolchain files | `package.json`, `package-lock.json`, `.nvmrc`, `.node-version` unchanged |

Runtime: Node 24.21.0, npm 11.19.0, Playwright 1.63.0 with its bundled
Chrome for Testing 153.0.8010.12, on Linux x86-64.

What was prepared, and where:

- **Live Sarvam checks.** `tests/live/sarvam-live-check.ts` boots the compiled
  service in-process and runs seven fictional cases (help audio, Hindi
  transcription of an approved or synthesized recording, unambiguous date,
  ambiguous speech, field explanation, client cancellation, failure
  recovery), printing a table with latencies; it exits with code 2 and sends
  nothing when `SARVAM_API_KEY` is absent, which was verified here. The
  Playwright `live` project (`tests/browser/live-sarvam.spec.ts`) exists only
  under `FORM_SAATHI_LIVE=1` and drives the installed extension against the
  real service; listing showed 0 live tests without the flag and 3 with it.
  Commands and secure key configuration: [live-verification.md](live-verification.md).
- **Portal inventory.** The NSP FAQ v2.2 and OTR FAQ v1.4 were re-read from
  the saved PDFs (fingerprints in the register): the route and the read-only
  demographic, contact and parent fields are confirmed from the FAQ; no
  control name is. The read-only console inventory, the per-control checklist
  and the rule for turning an inventory into a separate live pack are in
  [live-verification.md](live-verification.md). Both packs stay unverified.
- **NVDA.** Rows S8 (consent withdrawal mid-request) and M1 (first microphone
  prompt in the docked panel) joined the checklist; every row is NOT RUN.
- **Pilot.** `studies/session-preparation.md` holds the accessible Hindi
  briefing, the consent items (no audio/video without separate written
  authorization), the pre-session tool checks and the assignment procedure;
  the results schema gained `unclearWording`, the count of panel sentences a
  participant reported unclear, by identifier only. `studies/results/` is
  still empty and the report and website show that.
- **Deployment.** `deploy/` gained the website unit, a Caddyfile for three
  hostnames with `Authorization` and `Cookie` removed from JSON access logs, a
  release/rollback layout, a logging policy, `smoke.sh` for health, credential
  refusal and per-credential rate limiting, and the practice-page hosting
  note (own hostname, because the built pages use root-relative asset paths).
  The extension test now derives the expected host permission from
  `apps/extension/config.ts`, so changing the origin is one edit.
