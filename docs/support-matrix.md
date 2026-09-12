# Support matrix and field inventory

Inventory **1.0**, reviewed **2026-09-12**. Source IDs refer to the
[source register](source-register.md). “Published” means documented, not observed
authenticated HTML. Both `packages/rules` live-support flags remain **unverified**.

| Target | Intended workflow | Practice representation | Verification and boundary |
| --- | --- | --- | --- |
| `nsp-2026-27-basic-general` | AY 2026–27: Apply For Scholarship login → Basic Information → General Information | `fixtures/nsp.html`, personal/address subset plus synthetic OTR exercise | Public route/FAQ reviewed; historical field inventory only. Current authenticated fields, requirements and Chrome/NVDA behavior unverified. |
| `eci-form6-new-voter` | New-voter Form 6: selected personal, age-proof and address fields | `fixtures/eci-form6.html`, bounded PDF-based practice | Printed requirements reviewed. Live controls, conditions, focus and Chrome/NVDA behavior unverified. |
| Local demonstrations | A/B × issues/complete per workflow | Native controls, conditional fieldset, inserted note, excluded frame | Automated evidence in [testing.md](testing.md). The extension reads these fields when activated on their tab; validators, findings and rule packs are not implemented yet. |
| Other workflows/pages | None | None | Unsupported. No domain-wide inference or generic validator runs. |

## NSP inventory

IDs below are **fixture IDs**, not live selectors. N3 supports historical field
presence; N2 supports inherited demographics. Editable required attributes are
F1 exercise conventions, not confirmed 2026–27 portal rules.

| Field/group ID | Control and behavior | Evidence / limitation |
| --- | --- | --- |
| `nsp-name` | Read-only English text | N2/N3. Compare to supplied reference; cannot edit here. |
| `nsp-dob` | Read-only date text | N2/N3; impossible inherited values are synthetic F2 corruption. |
| `nsp-gender` | Read-only text | N2/N3. No inferred gender conditions. |
| `nsp-state` | Read-only text | N3; fixture display choice F1. |
| `nsp-district` | Required select | N3; two-option list and requiredness F1. |
| `nsp-address` | Required combined house/street text | N3; simplification/requiredness F1. |
| `nsp-pin` | Required numeric text, six-digit pattern | N3 field; F1 requiredness/F3 format. Directory not checked. |
| `nsp-locality` | Required native Rural/Urban/Other radio group | N3 options; F1 requiredness. IDs end in `rural`, `urban`, `other-choice`. |
| `nsp-locality-other` | Required text shown/enabled for Other only | F4 synthetic conditional rule; no published requirement. |
| `nsp-otr` | Required editable numeric text | N1 confirms 14 digits; placement/editability/requiredness F5. Not Aadhaar. |
| `nsp-detail` | Optional “विवरण 2”, 12-digit string | F6, intentionally unknown meaning; never classify by length. |
| `nsp-note` | Optional text inserted by button | F7; initially absent. |
| `unsupported-frame` | Opaque-origin sandbox iframe | F8; inner `mock` control excluded from supported coverage. |

Omitted: category/year, family/income/community fields, full address hierarchy,
academic/application-specific details, schemes, uploads, OTR/eKYC/login, CAPTCHA,
submission, review locks and eligibility. N3's historical requiredness colors
are not imported as current rules.

## ECI Form 6 inventory

| Field/group ID | Control and behavior | Evidence / limitation |
| --- | --- | --- |
| `eci-name-hi` | Required combined name text | E1 item 1; Hindi required for this exercise only, F9. |
| `eci-name-en` | Optional combined English name | E1 item 1/E2 section 2. Compare if supplied; blank English is not missing-required. No auto-transliteration. |
| `eci-gender` | Required Male/Female/Third Gender radios | E2 section 5. IDs end in `male`, `female`, `third`. |
| `eci-dob` | Required text with dd/mm/yyyy hint | E1 item 7; required metadata/text input F9. No age/eligibility decision. |
| `eci-age-proof` | Required birth-certificate/Other radios | E1 item 7; deliberately reduced list F9, not every permitted document. |
| `eci-age-proof-other` | Required when Other selected | E1 item 7(ii)/E2 section 6(b) supports naming. Web show/hide F9. Acceptance not checked. |
| `eci-address` | Required combined house/street text | E1 item 8/E2 section 7; simplified row F9. |
| `eci-district`, `eci-state` | Required text | E1 item 8/E2 section 7. Geographic accuracy not checked. |
| `eci-pin` | Required numeric text, six-digit pattern | E2 supports presence; F3 supplies fixture format, not Aadhaar/EPIC. |
| `eci-email` | Optional email input, empty | E1 item 4: if available. No missing-required finding. |
| `eci-detail` | Optional unclear-label numeric text | F6, meaning unknown. |
| `eci-note` | Optional inserted text | F7. |
| `unsupported-frame` | Local opaque-origin sandbox iframe | F8, inner control excluded. |

Omitted: constituency, photo, relatives, Aadhaar, town/post office/tehsil, full
age/residence-proof choices and uploads, optional disability information,
family-member/EPIC, declarations, signature and receipt. Populating this subset
cannot complete a real Form 6. No Aadhaar mandate or EPIC format is invented.

## Fixture assumptions

| ID | Deliberate practice convention, not a confirmed live rule |
| --- | --- |
| F1 | Required editable NSP address fields, limited choices and read-only state. |
| F2 | Invalid inherited NSP DOB/name test corruption; no claim OTR produces it. |
| F3 | PIN is six ASCII digits. Existence/geographic matching remains not checked. |
| F4 | NSP Other locality reveals a required description. |
| F5 | Separate synthetic OTR check input, editable and required, without login. |
| F6 | Accessible but unclear label tests unknown meaning; 12 digits do not identify Aadhaar. |
| F7 | Button inserts one optional note while preserving focus; no analogous live control claimed. |
| F8 | Scriptless local `srcdoc` frame has an opaque origin and excluded field coverage. It may be accessible to a screen reader; “unsupported” describes Form Saathi coverage. |
| F9 | ECI row merging, Hindi task language, required metadata where noted, reduced choices, date text input and conditional DOM layout. |

Text dates preserve impossible test values that a date picker would sanitize.
IDs stay stable across profiles. Radio changes preserve native focus and toggle
the conditional fieldset's `hidden`/`disabled` states. Hidden values are retained
in this page's memory but are not applicable; future readers must exclude them.
The inserted note is absent before activation; next Tab reaches it. Reload/reset
restores the selected scenario and removes inserted notes.

Passwords, OTPs, CAPTCHA, uploads and cloud processing are absent. Fictional
page preloading is not an extension autofill feature. No extension writes into
these pages and no application is submitted.

## Status vocabulary

| Term | Meaning here |
| --- | --- |
| Practice-form support | Established by automated checks on the two fictional forms. This is the only support this release has. |
| Manually verified live support | A recorded session by a named tester on the real workflow with Windows Chrome and NVDA. **None exists.** |
| Unverified | Everything else: both packs on their portals, all manual NVDA rows, all live provider calls. |

## Rule packs 1.0

Both packs live in `packages/rules/src/packs.ts`, version **1.0**, reviewed
**2026-09-12**, `liveTesting: 'unverified'`. Every review the panel shows starts
with that status, so a clean result never reads as portal approval.

| Pack | Hosts it claims to describe | Practice signature | Field keys mapped |
| --- | --- | --- | --- |
| `nsp-2026-27-basic-general` | `scholarships.gov.in` | `nsp-otr`, `nsp-locality` | 12, from the NSP inventory above |
| `eci-form6-new-voter` | `voters.eci.gov.in` | `eci-name-hi`, `eci-age-proof` | 13, from the ECI inventory above |

A portal host selects its pack; a loopback page selects one only when it carries
that workflow's practice field keys. Any other page gets **no pack and no field
checks**. Field keys are the practice inventory's own control names: the live
portals' control names are still unknown, so a host match selects a pack whose
mappings remain unverified there.

| Rule | Severity it can produce | Evidence |
| --- | --- | --- |
| `required-value` | error | The pack's requirement, or the page's own `required` marker for a field the pack does not map |
| `conditional-unknown` | unchecked | The controlling field could not be read |
| `date-format`, `date-calendar` | error | Strict calendar arithmetic with leap years. No age or eligibility decision |
| `pin-format` | error | Fixture convention F3, named as such in the message |
| `otr-format` | error | N1, and only for a field mapped as an OTR |
| `ifsc-format` | error | B1 |
| `name-reference` | needs confirmation, or unchecked | The person's own supplied spelling; never speech, never the page |
| `aadhaar-unchecked`, `aadhaar-eid-unchecked` | unchecked | No verified specification on file (U1) |
| `unknown-meaning` | unchecked | F6: digits never imply an identifier type |
| `devanagari-digits` | unchecked | Digits are normalized for checking; portal acceptance is unknown |
| `pin-district-unchecked`, `otr-issuance-unchecked`, `ifsc-branch-unchecked` | unchecked | No reviewed directory, issuance record or bank confirmation |
| `unmapped-fields`, `coverage-gap`, `no-rule-pack`, `live-testing-unverified` | unchecked | Stated limits of this stage |

Aadhaar, EID and OTR stay distinct concepts: only a field a pack maps as an OTR
gets the 14-digit rule, an Aadhaar-mapped field is never required (Form 6 allows
declaring that no Aadhaar can be furnished, E1) and is never format-checked or
checksum-checked here. Neither practice page contains an Aadhaar, EID or IFSC
field; those rules are exercised by `packages/rules/src/validate.test.ts`.

## Live verification still required

An authorized session must establish exact URLs/stages, current controls,
labels/descriptions, required/conditional rules, visibility, editability,
stable mappings, dynamic updates, unsupported frames/widgets, focus behavior
and review boundaries. Test the installed extension with ordinary Chrome and
Windows/NVDA, recording versions, evidence and unresolved gaps. Public sources
and A/B practice tests do not close this work.
