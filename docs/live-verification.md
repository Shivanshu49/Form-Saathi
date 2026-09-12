# Live verification — prepared, not run

Two external checks that this repository cannot perform on its own: a real
provider call and a real portal session. Both are prepared here so that the
person with the access runs exactly these steps and records exactly these
results. Nothing below has been executed; see [testing.md](testing.md) for
what is recorded.

## 1. Sarvam provider

### Configuring the key securely

- Put `SARVAM_API_KEY=<key>` and `PILOT_TOKEN_SECRET=<≥16 chars>` in `.env` at
  the repository root (git-ignored) or export them in the shell that runs the
  checks. Never paste a key into a chat, an issue, a commit or a log; never use
  a `WXT_`, `VITE_` or `NEXT_PUBLIC_` prefix, which would compile it into the
  extension or website.
- `.env` is loaded only by `node --env-file-if-exists` commands and by the
  API's start script; the extension never sees it.

### Commands

```bash
npm run build --workspace @form-saathi/api
node --env-file-if-exists=.env tests/live/sarvam-live-check.ts
```

The script boots the compiled service in-process on a loopback port, mints an
ephemeral pilot credential, and sends fictional data only. Without
`SARVAM_API_KEY` it exits with code 2 and does nothing. It prints a Markdown
table to paste into [testing.md](testing.md): case, pass/fail, latency and a
redacted observation. Optional: `FORM_SAATHI_LIVE_AUDIO=<approved .wav/.webm>`
transcribes a real, separately approved fictional recording instead of speech
the script synthesizes from fictional text through the same adapter.

| Case | What is sent | Pass condition |
| --- | --- | --- |
| Generic help audio | topic `navigation` | 200, WAV bytes |
| Hindi transcription | the approved or synthesized recording of “पंद्रह अगस्त दो हज़ार” | non-empty transcript, `requiresConfirmation: true` |
| Unambiguous date | transcript “पंद्रह अगस्त दो हज़ार” with the practice DOB context | a `suggestion`; the value is then checked by the local date rules |
| Ambiguous speech | transcript “पंद्रह अगस्त” | `unknown` with an explanation; a guessed year is a defect |
| Field explanation | label, instructions, section, control, required, pattern, option labels — no value | a contract-valid `suggestion` or `unknown` |
| Client cancellation | a request aborted 30 ms after sending | `AbortError`, `/health` 200 afterwards |
| Failure recovery | invalid credential; 1001-character transcript | 401 `unauthorized`; 400 `invalid_request`; next request 200 |

Then the same path through the installed extension, in Chromium against the
service Playwright starts from `.env`:

```bash
npm run build
FORM_SAATHI_LIVE=1 npx playwright test --project live
# with an approved recording on the fake microphone:
FORM_SAATHI_LIVE=1 FORM_SAATHI_LIVE_AUDIO=/path/to/fictional-date.wav npx playwright test --project live
```

The `live` project exists only when `FORM_SAATHI_LIVE=1`, so an ordinary
`npm run test:e2e` never reaches the provider. Its three cases print
`observed:` lines with latencies: ambiguous then unambiguous interpretation
with the local check shown and the page value untouched; a field meaning and
a playable help clip; an invalid credential explained and recovered from.

### What to record

The printed tables, the observed latencies, the models named in the output,
the date, and any case that failed, verbatim, in
[testing.md](testing.md#live-provider-verification--still-not-run). A
provider reply that does not match the contract is a defect to fix in
`apps/api/src/provider.ts` with a regression test in
`tests/api.ai.integration.test.ts`, never a reason to loosen the contract.
Mocked failure tests in that suite remain what they are: evidence about this
service, not about the provider.

## 2. Portal field inventory (NSP and ECI Form 6)

### Authorization and conduct

- Only a person with their own authorized account uses it, in an ordinary
  Chrome profile, read-only. No password, OTP or CAPTCHA answer is ever typed
  into this project's tools, shared, or recorded.
- Nothing is submitted, uploaded or changed on the portal. No fictional
  application is created. The practice pages remain the only place fictional
  data is entered.
- The inventory records structure, never values: control names and ids,
  labels, types, ownership, constraints, conditions. Screenshots, if any, are
  cropped to controls and kept outside the repository.

### Scope to confirm first

| Workflow | Route to confirm (from the sources) | Page in scope |
| --- | --- | --- |
| `nsp-2026-27-basic-general` | Students → Apply For Scholarship → Login (Aadhaar / APAAR / OTR) → **Basic Information → General Information** (N2 Q1–2) | the General Information step only; Academic Details, Application Specific Details, Apply Fresh, schemes, uploads and Final Submit are out of scope |
| `eci-form6-new-voter` | voters.eci.gov.in → new voter registration (Form 6), the online form's personal, gender, date-of-birth/age-proof and address sections (E1 items 1, 6–8) | those sections only; relatives, Aadhaar, uploads, family EPIC, disability, declaration and submission are out of scope |

Record the URL pattern (without query values), the page title, the breadcrumb
or step indicator, and the date, as the identifying evidence of scope.

### Console snippet: the read-only inventory

Paste into DevTools on the in-scope page. It reads the top frame only, lists
controls the way the reader groups them, and prints a table; it writes
nothing, submits nothing and does not read values.

```js
(() => {
  const forms = [...document.forms];
  const label = (c) => (c.labels && [...c.labels].map((l) => l.textContent.trim()).join(' | ')) || c.getAttribute('aria-label') || c.getAttribute('aria-labelledby') || c.getAttribute('title') || c.getAttribute('placeholder') || '';
  const rows = [...document.querySelectorAll('input, select, textarea')].map((c) => ({
    tag: c.tagName.toLowerCase(), type: c.type || '', name: c.name || '', id: c.id || '',
    form: c.form ? forms.indexOf(c.form) : -1, label: label(c),
    legend: c.closest('fieldset')?.querySelector(':scope > legend')?.textContent.trim() || '',
    required: c.required, readOnly: !!c.readOnly, disabled: c.matches(':disabled'),
    hidden: !c.checkVisibility({ checkVisibilityCSS: true }), pattern: c.pattern || '', min: c.min || '', max: c.max || '',
    describedBy: c.getAttribute('aria-describedby') || '', autocomplete: c.getAttribute('autocomplete') || '',
  }));
  const widgets = [...document.querySelectorAll('[contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="listbox"], [role="spinbutton"]')]
    .filter((w) => !(w instanceof HTMLInputElement || w instanceof HTMLSelectElement || w instanceof HTMLTextAreaElement))
    .map((w) => ({ role: w.getAttribute('role') || 'contenteditable', id: w.id, label: w.getAttribute('aria-label') || '' }));
  const frames = [...document.querySelectorAll('iframe, frame')].map((f) => ({ title: f.title, src: (f.src || 'srcdoc').replace(/\?.*$/, '?…') }));
  console.table(rows); console.table(widgets); console.table(frames);
  console.log(JSON.stringify({ url: location.pathname, title: document.title, forms: forms.length, rows, widgets, frames }, null, 1));
})();
```

### Inventory checklist, per control

| Column | Record |
| --- | --- |
| Key | `name`, else `id` — the value the reader uses as the pack key |
| Label source | `<label>`, `aria-label`, `aria-labelledby`, `title`, placeholder, or none; the exact Hindi/English text |
| Control | text, select, radio group (members and values), checkbox, textarea, native date, file, custom widget |
| Form ownership | which `<form>` (index), or none; note id-less forms and controls outside any form |
| Constraints | required marker, `pattern`, `maxlength`, `min`/`max`, `inputmode`, `readonly`, `disabled` |
| Conditional | which control and value shows or enables it; whether it uses `hidden`, `disabled`, CSS or removal |
| Instructions | `aria-describedby` text or adjacent help text, verbatim |
| Coverage limits | frames, custom widgets, uploads, CAPTCHA/OTP fields, anything the reader would report as a gap |
| Meaning | which `FieldMeaning` a reviewed source supports, with the source id; `unknown` when none does |
| Behaviour under the extension | field listed, focus lands, value follows edits, conditional turns inactive, review result shown — observed, not assumed |

### Turning the inventory into a pack

A live pack is a **new** pack (`nsp-2026-27-basic-general-live` and
`eci-form6-new-voter-live`, or a version bump with new keys) whose `fields`
use the live keys, whose `signature` uses live keys that identify the page,
whose `hosts` stay as they are, and whose `reviewed` date is the inventory
date. The practice packs and their fixture ids remain for the practice pages;
portal rules and practice assumptions are never merged. `liveTesting` becomes
`verified` only for the exact page and coverage recorded, after the
extension was observed on it, and the [support matrix](support-matrix.md)
gains one row per verified page naming what was and was not covered. A
successful inventory alone establishes neither live support nor NVDA
usability.
