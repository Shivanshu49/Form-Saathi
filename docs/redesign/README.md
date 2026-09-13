# Redesign and English-first localization

Implemented on `redesign-english-first`, based on `release-candidate-0.1.0`
(`e02ac34`). The initial working tree was clean. The release branch and its audit
history were retained. This report describes the redesign; older audit reports
remain historical evidence.

## Interaction flow

1. Open Form Saathi on the form's tab. The header offers a native language
   selector and Settings. First use is English, even in a Hindi-language browser.
2. Read the form status, then the current field's original label, instructions,
   masked value, issue and next action. Reading coverage and validation-pack
   coverage are separate. Expand support details for the origin and limitations.
3. Previous and Next move through the panel. Go to field focuses the original
   control for manual editing. All fields opens the full sectioned navigation.
4. Review form opens the issue list and moves focus to its heading. The three
   counts separate errors, confirmations and unchecked areas. Acknowledgment
   remains tied to the exact document, data, reference and rules reviewed.
5. Settings contains session-only credentials, explicit cloud consent, help audio
   and the service check. Back to form restores focus to Settings. Eligible
   English/Hindi fields offer recording and a typed alternative. Stop sends the
   recording; Cancel discards it before upload or aborts an already sent request.

The extension and website share system typography, a warm neutral background,
charcoal text, blue controls, modest borders, visible focus and logical spacing.
There are no remote fonts, decorative images or global styles injected into the
original page. Native disclosures keep support detail, review, references and the
field list available without filling the main workflow.

## Interface and speech matrix

| Interface | Direction | Sarvam transcription | Interpretation output | Generic cloud voice | Personal-value readback |
| --- | --- | --- | --- | --- | --- |
| English (`en`, default) | LTR | `en-IN` | English | `en-IN`, configured speaker, default `shubh` | Installed local `en-*` voice only |
| हिन्दी (`hi`) | LTR | `hi-IN` | Hindi | `hi-IN`, configured speaker, default `shubh` | Installed local `hi-*` voice only |
| Español (`es`) | LTR | Unavailable | Cloud explanation unavailable | Unavailable | Installed local `es-*` voice only |
| Français (`fr`) | LTR | Unavailable | Cloud explanation unavailable | Unavailable | Installed local `fr-*` voice only |
| العربية (`ar`) | RTL | Unavailable | Cloud explanation unavailable | Unavailable | Installed local `ar-*` voice only |

The capability floor is for the configured Sarvam adapter: `saaras:v3`,
`sarvam-105b`, and `bulbul:v3`. English is explicitly sent as `en-IN`, never
hardcoded Hindi. Unsupported locales fail before network access in the client
and are rejected by the API schema. Keyboard navigation, original-page editing,
reference entry and local validation remain usable. There is no provider or
language fallback. The existing provider adapter remains replaceable.

Sarvam's [transcription reference](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe)
and [speech-output reference](https://docs.sarvam.ai/api-reference/text-to-speech/convert)
were inspected on September 12, 2026 (UTC). They document English and Hindi;
Spanish, French and Arabic are not enabled by this integration. Request payloads
are verified against a controlled HTTP provider. This is not evidence of live
provider availability or speech quality.

Personal values never go to cloud speech output. Chrome voices are enumerated at
readback time and must match the selected language with `remote === false`.
No suitable local voice produces a localized explanation, not remote fallback.
Masked values still require explicit reveal before full readback. Voice quality
and availability depend on installed OS voices; this Linux Chromium environment
provides no evidence for a user's installed voices.

## Localization boundaries

`packages/contracts/src/i18n` supplies 388 typed stable keys, five-language catalogues,
interpolation and the capability map. `packages/ui/Locale.tsx` supplies the shared
React selector and preference behavior. English is the explicit initial state.
Only user selection writes a preference: extension `chrome.storage.local`,
website `localStorage`, independently for each origin. Credentials and cloud
consent remain in `chrome.storage.session`; snapshots and references remain
in-memory and document-owned. Changing locale cancels speech lifetimes without
resetting form values, reference spelling, selection or review acknowledgment.

Validation predicates, severity and machine rule IDs are unchanged. Presentation
uses localized messages and next actions; API error codes are unchanged and mapped
at the UI boundary. The previous native-required source sentence is represented
by the stable `page-required` marker and localized when shown. Existing source
register references, including Hindi item/section references, remain canonical.

Reader snapshots now preserve page, label, section and instruction language
metadata. Original portal text is explicitly labelled and is never translated or
punctuation-normalized. The existing Hindi practice fixtures are source data and
remain in Hindi, including their punctuation, irrespective of interface locale.
Generated explanations are labelled separately. Decorative dash formatting is
applied only to generated prose at display time, never to suggested values,
entered data, URLs, identifiers or references. A catalogue test rejects em/en
dashes and checks complete translations with matching interpolation parameters.

## Rendered evidence

These are screenshots of the installed production extension document connected
to the real injected fixture reader, and the built Next.js site served with
`next start`. They are not component mockups. Values are fictional fixtures.

- [Extension in English](screenshots/extension-english.png)
- [Current field with a validation issue](screenshots/extension-field-issue.png)
- [Extension in Arabic](screenshots/extension-arabic.png)
- Current field: [English](screenshots/field-en.png), [Hindi](screenshots/field-hi.png),
  [Spanish](screenshots/field-es.png), [French](screenshots/field-fr.png),
  [Arabic](screenshots/field-ar.png)
- [Website on desktop](screenshots/website-english.png)
- Mobile website: [English](screenshots/website-en-mobile.png), [Hindi](screenshots/website-hi-mobile.png),
  [Spanish](screenshots/website-es-mobile.png), [French](screenshots/website-fr-mobile.png),
  [Arabic](screenshots/website-ar-mobile.png)

Playwright cannot automate Chrome's toolbar gesture or its docked side-panel
frame. Tests open the actual `chrome-extension://…/sidepanel.html` document and
serve fixtures under the extension's existing loopback permission. No extra host
permission is shipped. Native docking, the microphone prompt and F6 behavior with
NVDA still require the manual checks below.

## Verification

Verified September 13, 2026 (Asia/Kolkata), with Node 24.21.0, npm 11.19.0,
Playwright 1.63.0 and its bundled Chromium.

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | Passed: all five workspaces and tools/tests |
| `npm run lint` | Passed, warnings denied |
| `npm test` | 108 passed: 61 package tests and 47 API/integration tests |
| Final `npm run test:unit` | 61 passed after the last catalogue changes |
| `npm run test:e2e` | Full production build plus 56 passed in 12.2 minutes: 40 extension, 9 practice, 7 website; no retries or skips |
| Automated accessibility | Zero axe violations on checked WCAG 2 A/AA and 2.1 A/AA surfaces, including the panel in five languages and all eight website pages in five languages |
| Fresh launch / persistence | English with a Hindi browser locale; explicit selection survives reload; Arabic `dir=rtl`; original values, source text and acknowledgment unchanged by UI locale |
| Layout | All five panel languages at 320px; Arabic panel at 200% text size; all eight website pages in five languages at 320px and 200% text size |
| Safety and lifecycle | Recording, delayed permission, cancellation, consent withdrawal, invalid credentials, timeout recovery, document isolation, review invalidation, secret exclusion and manual editing assertions pass |
| Original page styles | Style/link counts and computed body styles unchanged after extension use and language changes; reader contains no injected stylesheet or page-writing behavior |
| Source languages | Inline language spans and original dash punctuation preserved; changing source-language metadata invalidates acknowledgment |
| `npm run package:pilot` | Passed: production builds and Chrome ZIP |
| ZIP inspection | All 11 files match the browser-tested build byte for byte; original permissions retained; no provider secret, environment file or source map included |
| `git diff --check` | Passed |

Package: `apps/extension/.output/form-saathiextension-0.1.0-chrome.zip`,
241,151 bytes. SHA-256:

```text
330e594f598049489e9a6455d15cf3e7bd743eb7afe1f38594e468b3b0c4fe43
```

[Machine-readable package inspection](package-inspection.json). The package keeps
Chrome 116+, the original five permissions and the single loopback API host.
It is a local development/pilot package, not a published Web Store release.
All languages ship offline. Vite reports a 511.93 kB panel JavaScript chunk,
slightly above its 500 kB advisory threshold; packaging and verification pass.

The deliberately opaque practice iframe remains outside automated accessibility
inspection and remains explicitly reported as unread/unchecked. The 40 extension
checks include 29 reader scenarios, seven isolated lifecycle cases, the installed
extension smoke check and three localization scenarios. Existing assertion counts
were retained or increased; no behavioral assertion was removed to obtain a pass.

The regression suite retains behavioral assertions for recording consent,
cancellation, secret exclusion, document isolation, review invalidation, rate
limiting and manual correction/submission. Locators use the new disclosures and
scope repeated labels to the relevant region. Reader scenarios close their pages
after each test and run independently; long multi-step scenarios allow 60 seconds.
Normal browser runs start an unconfigured API without reading `.env` or inherited
provider credentials. Live runs remain explicitly opt-in.

## Remaining review

All five catalogues are complete in code. Hindi, Spanish, French and Arabic
translations, especially consent, validation terminology and grammatical number,
need native-speaker review. English copy also needs usability review with blind
and low-vision users. No machine translation service receives portal data.

Manual Windows Chrome/NVDA testing is **PENDING, NOT RUN**. Use
[the existing checklist](../manual-nvda-checklist.md), explicitly selecting Hindi
for its Hindi cases, plus these redesign checks:

| Check | Status |
| --- | --- |
| English first launch, explicit selection, pronunciation in all five languages | Pending |
| Settings and review heading focus, keyboard focus restoration after asynchronous speech | Pending |
| Native docked panel at 200% and 400% browser zoom, Windows high contrast | Pending |
| Screen-reader table navigation, Arabic reading order and mixed-language source instructions | Pending |
| Actual microphone prompt, recording, Stop/Cancel and consent withdrawal | Pending |
| Local voice matching, masked readback and interruption alongside NVDA | Pending |

Automated axe checks and 200% text resizing do not replace these checks. No live
Sarvam call, authenticated portal workflow, participant study or measured product
improvement is claimed by this redesign. NSP and ECI Form 6 remain limited practice
adapters with unverified live support. Unfamiliar forms retain reading/navigation
where possible and explicitly report missing reviewed validation and coverage gaps.
