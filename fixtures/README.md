# Fictional practice environment, version 1.0

From the repository root, using the documented Node/npm versions:

```bash
npm ci
npm run dev:fixtures
```

Open **http://127.0.0.1:4173/**. Choose a form, profile A/B, and either deliberately
flawed values (`case=issues`) or filled examples (`case=complete`). Activate the
load button to change scenario; it discards edits. Stop with Ctrl+C.

| Workflow | A | B |
| --- | --- | --- |
| NSP Basic Information → General Information, AY 2026–27 | `/nsp.html?variant=a&case=issues` | `/nsp.html?variant=b&case=issues` |
| ECI Form 6, selected personal/age/address fields | `/eci-form6.html?variant=a&case=issues` | `/eci-form6.html?variant=b&case=issues` |

Change `case=issues` to `case=complete` for each filled example: eight initial
states. Missing/unknown query options default to A/issues. These are bounded
demonstrations, **not live portal replicas or full applications**. Read the
[source register](../docs/source-register.md), [inventory](../docs/support-matrix.md)
and [independently authored expectations](expected-results.md).

Use Tab/Shift+Tab and native radio arrow keys. Other reveals a required detail;
the alternative hides and disables it. The extra-field button inserts an optional
note without moving focus. Reset restores the profile. NSP demographics remain
read-only; OTR authentication/editing is outside the exercise. Use Form 6 for a
correction task with editable name/date fields.

Only fictional data belongs here. English references are invented text, not
uploaded documents. Numeric samples are **not reserved official test IDs**;
issuance/identity is unknown. Never use them on a portal. Never add real forms,
recordings, document references or personal screenshots to the repository.

No form values enter requests, URLs, logs, storage or a backend. Edits live in
the page until reload. Source links navigate only when activated and suppress
referrers. The opaque-origin sandbox iframe uses local `srcdoc`, no external
service, and is explicitly excluded from supported coverage.

Native HTML/TypeScript pages reuse the installed Vite; no new dependencies or
Next.js companion site. The extension can read these pages once you activate it
on their tab, and only then; it lists fields and moves focus but never types,
corrects or submits. No validator, automatic correction or review completion is
implemented. Native constraints are fixture metadata.
There is no submit button; accidental submission is prevented only on these
demonstrations. No portal Submit behavior is touched.

```bash
npm run build:fixtures      # fixtures/dist
npm run preview:fixtures    # built output on 127.0.0.1:4173
npm run test:fixtures       # built-page Chromium checks; owns 4173 and 3000
```

Install Chromium with `npx playwright install chromium --no-shell` first if needed.
The shared Playwright configuration starts the health-only API too; it receives
no fixture data. Manual Windows/Chrome/NVDA testing remains pending; see
[testing.md](../docs/testing.md).
