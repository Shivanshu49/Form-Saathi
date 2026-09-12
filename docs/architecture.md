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
| `apps/extension` | WXT React Hindi side panel interface, toolbar/shortcut activation, injected form reader, explicit health check |
| `apps/api` | NestJS ESM service: health, transcription, interpretation and generic help audio behind a replaceable provider adapter |
| `packages/contracts` | Zod health and panel/reader message schemas with inferred types |
| `packages/rules` | Versioned NSP and ECI rule packs, the local validation engine, host recognition, identifier masking |
| `fixtures` | Native HTML/TypeScript NSP and ECI demonstrations, A/B profiles, independent expected findings |
| `docs` | Product requirements, architecture, setup and verification evidence |
| `tests` | Compiled API and AI-service integration, panel inbox and pilot-report unit tests, Chromium extension and practice checks |
| `studies` | Empty pilot results template, session-log template, report generator |
| `apps/web` | Next.js companion site: introduction, installation, guidance, practice links, workflow matrix from the rule packs, privacy, limitations, results from filed sessions only |

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

The practice environment reuses root Vite without a new workspace or dependency.
Its three HTML entry points build to `fixtures/dist`. A small TypeScript loader
selects fixed fictional profiles, toggles conditional native controls and inserts
an optional note. It never imports validators, calls the API or persists values.
The separately authored oracle is `fixtures/expected-results.md`; source evidence
and fixture-only assumptions are in [the register](source-register.md) and
[support matrix](support-matrix.md). The extension reads these pages only when
the user activates it on their tab, and never writes into them.

## Current data flow and permissions

Clicking the toolbar action, or its configurable `Alt+Shift+F` shortcut, is the
only way in. That gesture is what grants `activeTab` for the current tab. The
worker then gives that tab its own panel document, `sidepanel.html?tab=<id>`,
and opens it, so a panel is bound to one tab for its whole life. A tab nobody
activated shows the unbound default panel instead of another tab's review. The
panel still shows unverified portal status and sends an empty `GET /health` only
when the user activates the service check, parsed with the same Zod schema the
API uses; failures leave a retryable Hindi status message.

The panel injects `reader.js` into its own tab with `chrome.scripting.executeScript`
and pulls a snapshot. The reader lists supported visible controls with their
labels, associated instructions, native constraints, options and current values.
It reads a radio group as one choice, marks hidden or disabled conditional
fields inactive — listed with their labels and the choices they offer, but with
no value and no selected option, so a leftover choice appears nowhere in a
snapshot or a cloud payload — and records coverage gaps for frames, custom
widgets and secret-bearing fields. Each field also names the form element that
owns it, by a stable identifier like its own, because two id-less forms may
carry the same control names. Passwords, one-time
codes, CAPTCHA answers and card fields are counted, never collected. A debounced
MutationObserver and `input`/`change` listeners push a new snapshot when the page
changes, so an inserted or newly revealed field appears without user action.
Selecting a field in the panel asks the reader to focus the original control.
The review is recomputed from each snapshot, so correcting a value in the page
clears its result without the person returning to the panel first.

Both sides validate every message against the same Zod contracts, and each
snapshot carries its tab, a per-document identifier and a sequence number. The
panel drops anything whose `sender.tab.id`, tab, document or sequence does not
match the review it holds; the reader refuses focus requests naming an earlier
document. Reloads and navigation (`tabs.onUpdated`) and a closed tab
(`tabs.onRemoved`) discard the review. Nothing read from a page is stored or
sent anywhere: a snapshot lives in the panel document's memory and disappears
with it. The worker holds no review state, because MV3 stops it at any time; it
only opens the panel and tells an already open panel to read again.

The production manifest requests `sidePanel`, `activeTab`, `scripting`, `tts`
(local voices, checked before use) and `storage` (the session area only), plus
access to `http://127.0.0.1:3000/*` for the health check and the AI routes. The
[host match pattern](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)
and fetches use the exact loopback origin in `apps/extension/config.ts`. There
are still no content-script matches, page host permissions, `tabs`, storage or
TTS permissions: the reader reaches a page only through the activation gesture.
`minimum_chrome_version` is 116 for `sidePanel.open()`. WXT adds development-only
permissions and localhost connections for its reload tooling.

`packages/rules` holds the checks and the two versioned packs. A pack records
what a reviewed source says about a workflow: hosts, the practice field keys
that identify it, each field's meaning and requirement, its conditional rule,
and the source id behind every mapping. The engine selects a pack by host, or by
practice signature on a loopback page, and validates nothing at all when no pack
matches. Each result carries a stable rule id, the field id, a severity of
error, needs-confirmation or unchecked, a Hindi explanation, the suggested next
action, and its source where it has one. The engine is pure: it never fetches,
never guesses a field's meaning from its value, and never decides eligibility,
identity or acceptance. It declares only the narrow field shape it consumes, so
it needs no dependency on the message contracts.

What it checks and what it refuses to check is inventoried in
[the support matrix](support-matrix.md); the evidence behind each identifier
rule, including the ones deliberately left unchecked, is in
[the source register](source-register.md). Devanagari digits are normalized one
to one for numeric checks and the portal's acceptance of them is reported as
unknown. No Hindi number-*word* parser is used or reused anywhere: word
sequences are ambiguous to add up, so they are left untouched, and a local
parser for spoken dates is explicitly deferred rather than implied. A date of
birth is checked for validity only — a real calendar date without a year zero,
not after today, and within a native date control's own `min`/`max` — where
"today" is the local calendar date of the machine running the check, read at
that moment with no time-zone conversion, and injectable for tests. A native
date control's ISO value is read as such; text controls take day/month/year.
Every page with a mapped date of birth also states that age and eligibility
were not decided.

The interface is one React document. It shows the recognized workflow and its
unverified support, the current field with its label, value, instructions and
native format rule, previous/next navigation, a control that focuses the
original page control, a review area, and the field list grouped by the page's
own fieldset legends. Recognition is by host only, in `packages/rules`: a
matching host names a possible workflow and never claims support, and a loopback
page is reported as a local practice page rather than a portal.

Navigation is keyed by field identifier, not position, so a value changing on
the page keeps the current field, the revealed values and the keyboard focus
where they were. The reader's push digest includes every control's identity as
well as its content, so a control replaced by an identical clone — a framework
re-render — reaches the panel even though nothing reviewable changed. The panel
then keeps the person's place only when the stand-in is unambiguous: same
reviewed metadata within the same surviving form, or within a brand-new form
when the whole form was re-rendered, and among identical controls the same
place in document order while their number is unchanged. Otherwise it says the
control was replaced or removed, asks the person to choose from the list, and
focuses nothing in the page on a guess; a focus request that finds its control
gone re-reads the page and retries once, against the unambiguous stand-in only.
Everything the panel holds about a document — the reference spelling, the
acknowledgment, the selection, revealed values, the last announcement and the
snapshot itself — is reset the moment that document ends (navigation, reload,
closed tab) or another document arrives; the reset happens during render, so
no delayed callback can revive it, while a rescan of the same document keeps it. One polite status region carries both the connection state and
what the last action did; an announcement is kept only while the page, document
and field count are unchanged, so editing a field does not repeat it. Long digit
identifiers are masked to their last four characters until the reader asks for
them, and read-aloud, which never starts on its own and always has a Stop
control, speaks the masked form until then. Tailwind lives only in the panel's
own stylesheet; nothing styles or restyles the page.

Spoken values go through the optional service one deliberate step at a time.
The person turns the cloud feature on after a plain explanation of what leaves
the browser — the chosen recording, and on request a field's label and
instructions, never its value — which also says that nothing can be removed
from raw audio before it is sent. They then record for at most fifteen seconds
with visible Stop and Cancel controls, see the transcript in an editable box,
approve it for interpretation, and receive a bounded suggestion that the local
rules check as if it were already in the field. The person makes the actual
change on the portal themselves; the panel offers to copy the value to the
clipboard and to focus the field, and never writes into the page. An ambiguous
reply is shown as a request for clarification with no value at all. Identifier
fields, by reviewed meaning or by looking like one, and read-only fields never
offer recording. The pilot credential and the consent live in
`chrome.storage.session`, which is cleared when the browser closes.

The final review is built from the current snapshot and the current results,
never from anything stored. `reviewRevision()` in `packages/rules` serialises
exactly what was reviewed — the document, every field's key, label,
instructions, section, kind, state, requirement, read-only flag, value, every
option's value, label and selection, its native constraints, the coverage
gaps, the pack id, version and review date, and the reference spelling — and
the acknowledgment records that full text. Sequence numbers and timing are
left out, so an unchanged poll changes nothing. The reader uses the same
serialisation (`snapshotRevision()`) to decide whether a mutation or poll is
worth pushing, so every change that would invalidate an acknowledgment reaches
the panel and nothing else is re-announced. Pressing “मैंने
दिखाई गई समीक्षा पढ़ ली है” first reads the form again through the reader and
only records the acknowledgment when the fresh revision equals the displayed
one; otherwise it says the form changed. Any later change to that material —
a value edited, a value set by a script, a field appearing, an instruction,
option label or format rule changing, a rule pack or the reference changing —
makes the acknowledgment stale, which is said once in the
status region and shown in the review until the person acknowledges again. The
reader also re-reads the page every three seconds and pushes a snapshot only
when the values differ, so a script setting `value` with no event is still
seen. `summarizeReview()` ranks what is open: blocked (a secret or CAPTCHA the
panel never reads, or an error on a read-only field), corrections pending,
confirmation needed, partial coverage, and — only when nothing checkable is
open — clear, which still names the limits that are never checked. Submission
is always reported as unconfirmed: the panel has no evidence of it and never
presses Submit, alters submit behaviour or solves a CAPTCHA.

Read-aloud uses `chrome.tts` and only a voice that runs on this machine with a
Hindi language tag; if none is available it says so and leaves the text to the
screen reader, because a remote voice would send personal values to a network
service. Cloud audio is reserved for the service's own generic help texts. Every
cloud failure — denied microphone, unreachable or unconfigured service, timeout,
cancellation, malformed reply — leaves navigation and local checking exactly as
they were, which the browser checks exercise one by one.

The reader is a WXT unlisted script, so it is bundled to `reader.js` but never
listed in the manifest. A content-script entrypoint with `registration: 'runtime'`
was rejected because WXT copies such an entrypoint's `matches` into
`host_permissions`, which is exactly the broad page access this design avoids.

## The AI service

`apps/api` exposes `GET /health` plus four `POST /v1` routes: `speech/transcribe`,
`fields/interpret`, `values/interpret` and `speech/help`. The extension needs
none of them: reading, navigation and validation run entirely in the browser,
and the panel calls the service only for the health check and for a cloud step
the person has explicitly enabled and started.

Every `/v1` route first bounds authentication attempts by the socket peer's
address, verifies the parsed pilot credential, then limits the verified subject
per route before an explicit Zod pipe checks its body. Header spacing, scheme
case and renewed tokens for the same subject share an allowance. Forwarded
address headers are not trusted. Both fixed-window maps hold at most 10,000
entries, remove expired entries on the next request, and reject new keys at
capacity instead of evicting live allowances. Credentials are HMAC-signed tokens that
carry a subject and an expiry and are minted per participant with
`apps/api/dist/pilot-token.js`; the extension ships no key and no shared
permanent credential, which an automated check asserts against the built
bundle. With no signing secret configured the `/v1` routes stay closed rather
than open, and with no provider key they answer `service_not_configured` —
while `/health` keeps working so the panel can still report the service state.

`provider.ts` is the only file that knows about Sarvam. It holds the request
shapes from S1–S3, one send path with a per-attempt timeout, bounded retries for
retryable statuses, and cancellation tied to the caller's connection. The
controller watches the response's `close` event before the reply is finished —
the request stream's own `close` fires as soon as its body has been read and
says nothing about the connection — and a caller already gone when the handler
starts aborts before any provider request. The abort ends the attempt in
flight including its body read, cuts a retry backoff short, and stops any
further attempt; the listener is removed when the work ends, and the error
filter writes nothing to a connection that is already closed. What a provider
had already received is not recalled, and the panel says so.
Model identifiers live in configuration. Provider replies are parsed with Zod
before anything else looks at them, and an interpretation is additionally parsed
against the response contract: malformed output is rejected outright rather than
partially used. A suggested value for a choice field must be one of that field's
own options, or it is downgraded to `unknown`.

Uploads use the Express multipart integration with multer's in-memory default,
a hard interceptor ceiling, a configured byte limit, a declared-type allowlist
and a magic-byte check. Nothing is written to disk, and an integration test
watches the temp directory to confirm it. Audio, transcripts, field text and
reference spellings are never stored or logged: errors leave through one filter
that emits a bounded contract shape with a code, a short message and field
paths, never a provider body, a stack trace or a credential.

Page text reaching the service is bounded and treated as data: the prompts say
so explicitly, and a test asserts an instruction embedded in a field
description is sent as data rather than as a system rule. Responses are bounded
too — a display vocabulary deliberately separate from the rule packs' field
meanings, single-line values with no markup, braces or control characters, and
an `unknown` outcome that is always available. `requiresConfirmation` is set by
the service, never by the model, so structured JSON never reads as a decision.
A model reply can therefore never become a selector, a browser action or a
validation rule.

The API binds to loopback by default. `.env` is loaded only by API launch
commands and is ignored by Git. The example contains commented placeholders.
No Sarvam key is needed for health. There is no authentication or AI endpoint;
deploying an AI service is a later stage. Production needs a configured HTTPS
API origin, access control, usage limits, request validation, bounded uploads,
timeouts, and logs without recordings or personal contents.

## Intended later architecture

The reader lists supported visible controls, the panel navigates them, and the
local engine fills the review area from reviewed rule packs. The side panel will
add microphone interaction, temporary values, confirmation, and review
invalidation. Live portal testing must come before any pack's `liveTesting`
status changes. The background worker handles
short browser events. A replaceable Sarvam adapter inside Nest receives only
approved recordings or selected context; it never controls the browser. Next.js is
deferred until the core extension works.

## The companion website

`apps/web` is a Next.js App Router site with Tailwind's PostCSS plugin, built
statically except for the results page. It holds no portal facts of its own:
the workflow matrix renders `rulePacks` from `packages/rules`, the practice
page renders the fixture profiles' references and links to the fixture pages
at their own origin, and the results page loads `studies/results/*.json`
through the report generator's schema and shows an empty state, a schema
error, or the same per-condition summary the generator prints. The site never
reads a government page and never asks for an upload; there is no file input
anywhere in it. Its pages carry `lang="hi"` with `lang="en"` on English names
and identifiers, one `h1` each, a skip link that focuses `main`, and a
footer stating the project's independence on every page.

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
- [Next.js App Router](https://nextjs.org/docs/app) for the companion site, with
  [Tailwind's PostCSS plugin](https://tailwindcss.com/docs/installation/using-postcss).
- [Chrome sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
  for toolbar behavior, per-tab panel options and the user-gesture rule for
  `open()`;
  [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
  for gesture-granted single-tab access;
  [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)
  for injecting the reader; and
  [commands](https://developer.chrome.com/docs/extensions/reference/api/commands)
  for the reserved `_execute_action` shortcut.
- [WXT entrypoints](https://wxt.dev/guide/essentials/entrypoints.html) for the
  unlisted script the reader is built from.
- [Playwright Chrome extensions](https://playwright.dev/docs/chrome-extensions),
  [Vitest](https://vitest.dev/guide/), and
  [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing).

## Evidence boundaries

Passing a Chromium panel-page smoke check does not establish actual docked-panel
focus behavior, Windows/Chrome/NVDA usability, or live portal compatibility.
Playwright cannot click a browser toolbar, so the reader checks open the panel
document at its own URL and serve the practice pages from the already permitted
loopback origin. The toolbar gesture, the `activeTab` grant it produces and the
docked panel itself remain manually unverified. See [testing.md](testing.md) for
the manual checklist and actual check results.
