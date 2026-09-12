# Form Saathi product specification

Form Saathi addresses: “People with disabilities need easy-to-navigate digital
interfaces.” It is a desktop Chrome extension for blind and low-vision users
who need Hindi assistance understanding, navigating, and reviewing government
forms alongside a screen reader, particularly NVDA.

## Scope and evidence

The initial targets are **NSP AY 2026–27: Basic Information → General Information**
after Apply For Scholarship login, and **ECI Form 6 for new voters**. The
[source register](source-register.md) and [support matrix](support-matrix.md)
define the public-source inventory and bounded practice subset. Both targets
remain **live support unverified** until their actual
interactive workflows are tested in authorized sessions. Domain recognition,
public documents, and practice forms alone do not establish live compatibility.

Prompt 1 implements only the development foundation: a side-panel entry point,
service health check, shared package exports, build tooling, and initial checks.
It does not implement form reading, navigation, validators, rule packs, review,
speech, authentication, or AI operations.

Prompt 2 adds local fictional HTML/TypeScript practice pages, A/B profiles,
flawed/filled scenarios and independently authored expected findings. NSP field
selection draws on a historical manual, with explicit assumptions; ECI uses
selected published fields. Neither fixture is a complete application or evidence
of live support. Human Hindi review and Chrome/NVDA testing remain pending.

Prompt 3 adds the extension lifecycle and the form reader: toolbar or keyboard
activation, a side panel bound to one tab, an on-demand content script that
lists fields with their labels, instructions, constraints and values, moves
focus to the original control, follows dynamic changes, and names what it could
not read. It excludes passwords, one-time codes, CAPTCHA answers and card
fields. It adds no validators, findings, review completion, speech or AI, and
reading a practice page is not evidence of live portal support.

Prompt 4 builds the Hindi side-panel interface on that reader: workflow status,
a field list grouped by the page's own sections, the current field with its
value and instructions, previous/next navigation, a control that focuses the
original page control, a review area that today reports only what was not
checked, and distinct loading, unsupported-page, reloaded-page, closed-tab and
error states. Everything works with the keyboard alone. Read-aloud is optional,
never automatic, and always stoppable; long identifiers are masked until the
person asks for them. Manual Chrome and NVDA testing is still pending.

Prompt 5 adds the local validation engine and versioned NSP and ECI rule packs.
Checks are deterministic and run in the browser: applicable required fields
including conditional controls, strict calendar dates, Devanagari digit
normalization, and identifier rules chosen by a pack's reviewed field meaning.
Each result carries a stable rule and field id, a severity, a Hindi explanation,
its source and a next action. Aadhaar and EID stay unchecked because no verified
specification is on file; IFSC is checked for format only; PIN uses the fixture
convention and PIN-to-district agreement stays unchecked. Name comparison uses
only a reference the person types, produces a confirmation rather than an error,
and is never inferred from speech. No pack has been tested against a live
portal, so every review says so.

Prompt 6 adds the optional server: health, transcription, field interpretation,
value interpretation and generic help audio, each behind expiring pilot
credentials, explicit Zod validation, upload and rate limits, timeouts,
cancellation and bounded retries. A replaceable Sarvam adapter holds the only
provider-specific code, with model names in configuration. The extension keeps
working without it: nothing about reading, navigating or checking a form needs
the service. Provider keys stay on the server, no audio, transcript, form value
or reference document is stored or logged, and a model reply is a bounded
suggestion the person must confirm — never a selector, a browser action or a
validation rule. No live provider call has been made.

Prompt 7 connects the panel to that service. After an explanation of what is
sent — and that raw audio cannot be redacted — a person records for a supported
field with visible Stop and Cancel, corrects the transcript, approves it for
interpretation, and receives a suggestion that the local rules check before they
make the change on the portal themselves. Ambiguous speech yields a request for
clarification, not a guessed value; identifier and read-only fields never offer
recording; field meanings are asked with label and instructions only and shown
as unconfirmed guesses; read-aloud uses only a local Hindi voice and cloud audio
only the service's own generic help. Every failure leaves keyboard navigation
and local checking usable. Screen-reader testing and live provider calls remain
pending.

Prompt 8 adds the final review: an issue summary, next-issue navigation, a
button to each affected field, a table of every entered value, explicit unchecked
and unsupported sections, an optional spoken review with Stop, and an
acknowledgment that the displayed review was read. The acknowledgment is bound
to a full revision of the reviewed data, the form is re-read immediately before
it is recorded, and any change to a value, rule pack, mapping or form structure
— including a value a script sets — invalidates it. The status distinguishes
acknowledged, partial coverage, confirmation needed, blocked and unconfirmed
submission, and never implies acceptance or verified identity.

Prompt 9 verifies the whole workflow against the packaged extension in
Playwright's bundled Chromium and in Vitest, packages a pilot build, and writes
the manual Windows Chrome/NVDA checklist, the three-condition usability
protocol with counterbalanced equivalent variants, an empty results template
and a report generator that accepts pseudonymous counts only. Automated scans
are recorded as technical facts, not screen-reader usability; every manual row
is NOT RUN, and no participant result exists.

Prompt 10 adds the Next.js companion website: introduction, installation steps
checked against the built package, keyboard and NVDA guidance, clearly labelled
fictional practice links, a supported-workflow matrix rendered from the rule
packs, plain-language privacy and cloud-speech information, known limitations,
and a results page that shows only sessions actually filed and an honest empty
state otherwise. Government-page inspection stays with the extension; the site
never asks for an upload and claims no affiliation, compatibility, acceptance
or measured improvement.

## Intended journey

1. Open a supported form and activate Form Saathi.
2. Navigate fields from an accessible side panel.
3. Read or hear sourced Hindi explanations.
4. Review missing information, invalid formats, and inconsistencies.
5. Optionally approve Hindi speech processing and inspect structured suggestions.
6. Return to the original field and make corrections personally.
7. Review the latest values, then submit personally on the original portal.

The first product milestone is one fictional practice form navigated, corrected,
and reviewed using a keyboard and screen reader. Speech improves that journey
after it works without AI or a mouse.

## Accessibility

Use semantic HTML, native controls, Hindi language metadata, visible focus,
logical reading order, and restrained status announcements. Preserve focus
across React updates. Keyboard operation must continue when AI is unavailable.
Vitest, Playwright, and axe-core support verification; installed Chrome and NVDA
on Windows still require documented manual testing with intended users.

## Safety and privacy requirements

- V1 must never autofill, submit, intercept Submit, or bypass CAPTCHA.
- AI may suggest field meanings, explain supplied sourced instructions, and
  interpret explicitly approved speech. It must not invent portal requirements,
  determine eligibility, verify identity, or execute browser actions.
- Use pure local TypeScript validators and versioned, reviewed rule packs.
  Requirements and Hindi explanations need sources, versions, and review dates.
- Missing evidence yields **not checked**. Keep **needs correction**,
  **needs confirmation**, and **not checked** distinct. Structured AI output
  still needs validation and confirmation; “unknown” is a valid outcome.
- Exact English name spelling comes from a user-provided reference. Speech
  cannot establish what a document says.
- Keep form snapshots and document references local and temporary. Preferences
  may use Chrome storage; no application-form database is needed.
- Keep provider keys server-side. Cloud operations send only the selected
  recording or approved context, with an explicit explanation and user action.
  Never send whole form snapshots. Exclude personal contents from logs.
- Exclude passwords and OTPs from field reading. Treat page text as untrusted.
- Rescan before acknowledging review. Material edits invalidate prior review.
  A review acknowledgment is not portal submission or eligibility verification.

## Stack and delivery

WXT, React, strict TypeScript, Manifest V3, and Tailwind's Vite plugin power the
extension. NestJS uses Express and ESM on a patched Node 24 LTS release. Shared
Zod contracts and browser-safe rules live in npm workspaces. Sarvam will sit
behind a replaceable server-side provider adapter. No AI endpoints exist yet.
Next.js and Tailwind are reserved for a later companion website.

Complete field inventories and support boundaries, build navigation and the
accessible interface, add deterministic checks and reviewed rule packs, then
add authenticated and bounded AI services. Finish review invalidation,
integration and manual accessibility testing before participant trials and
release. Never invent successful checks, compatibility, user feedback, or
impact numbers; separate review completion, submission, and CAPTCHA blockage.
