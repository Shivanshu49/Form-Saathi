# Form Saathi product specification

Form Saathi addresses: “People with disabilities need easy-to-navigate digital
interfaces.” It is a desktop Chrome extension for blind and low-vision users
who need Hindi assistance understanding, navigating, and reviewing government
forms alongside a screen reader, particularly NVDA.

## Scope and evidence

The initial targets are **one precisely identified National Scholarship Portal
workflow** and **ECI Form 6**. The NSP workflow has not yet been selected and
inventoried. Both targets remain **live support unverified** until their actual
interactive workflows are tested in authorized sessions. Domain recognition,
public documents, and practice forms alone do not establish live compatibility.

Prompt 1 implements only the development foundation: a side-panel entry point,
service health check, shared package exports, build tooling, and initial checks.
It does not implement form reading, navigation, validators, rule packs, review,
speech, authentication, or AI operations.

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
