# Independently authored practice expectations

Oracle **1.0**, authored **2026-09-12** from task design and
[sources](../docs/source-register.md), without importing/running validators.
`packages/rules` has no validators yet. Neither the page nor its loader imports
this document. Future validator tests must compare against these expectations,
not regenerate them from implementation output. F1–F9 are in the
[support matrix](../docs/support-matrix.md).

`packages/rules/src/validate.test.ts` compares the engine against this document:
its fixtures are written by hand from the tables below, and the counts asserted
there are the ones stated here. This document is never regenerated from engine
output, and a disagreement means the engine is re-examined first.

“Needs correction” is a determinable problem in this scope. “Needs confirmation”
asks the user to resolve a reference discrepancy. “Not checked” means evidence
or coverage is missing. Matching text or format never proves eligibility,
identity, issuance, document acceptance or readiness to submit.

## NSP issues scenario

Each variant has **four correction tasks and one confirmation task**, plus the
persistent not-checked outcomes below.

| Field | A | B | Expected finding | Exercise correction/reference |
| --- | --- | --- | --- | --- |
| `nsp-name` | `KAVYA SAI` | `NEHA DAS` | Needs confirmation: one final letter differs from reference. Synthetic F2. | A `KAVYA SAIN`; B `NEHA DASS`. Read-only: identify discrepancy, do not edit. Real OTR correction is outside this exercise. |
| `nsp-dob` | `31/02/2004` | `31/02/2005` | Needs correction: February never has 31 days. F2, not a claimed live state. | Filled samples use A `15/08/2004`, B `16/08/2005`. Read-only; no simulated extension correction. |
| `nsp-district` | Empty | Empty | Needs correction: applicable required field under F1 only. | A Lucknow; B Kanpur Nagar. |
| `nsp-locality-other` | Empty, Other selected | Empty, Other selected | Needs correction: required detail under F4 only. | A `अभ्यास क्षेत्र एक`; B `अभ्यास क्षेत्र दो`. |
| `nsp-otr` | `9000000000001` (13 digits) | `9000000000002` (13 digits) | Needs correction: N1 defines 14 digits; F5 supplies the synthetic field. No Aadhaar checksum. | A `90000000000001`; B `90000000000002`, format samples only. |

State, gender, house/street, PIN format and locality choice are populated
correctly for the exercise: no missing-value finding on them.

## ECI Form 6 issues scenario

Each variant has **four correction tasks and one confirmation task**, plus the
persistent not-checked outcomes below.

| Field | A | B | Expected finding | Exercise correction/reference |
| --- | --- | --- | --- | --- |
| `eci-name-en` | `ARUN DE` | `AMAN RO` | Needs confirmation: one final letter differs from supplied reference. | A `ARUN DEV`; B `AMAN ROY`, after user confirmation. |
| `eci-dob` | `31/02/2000` | `31/02/2001` | Needs correction: impossible calendar date, no eligibility decision. | A `15/08/2000`; B `16/08/2001`. |
| `eci-district` | Empty | Empty | Needs correction: incomplete address, E1 item 8/E2 section 7. | A `लखनऊ`; B `कानपुर नगर`. |
| `eci-age-proof-other` | Empty, Other selected | Empty, Other selected | Needs correction: missing conditional document name, E1 item 7(ii)/E2 section 6(b). | A `काल्पनिक आयु अभिलेख एक`; B `काल्पनिक आयु अभिलेख दो`. Acceptance is not established. |
| `eci-pin` | `22601` (5 digits) | `20801` (5 digits) | Needs correction under six-digit fixture convention F3 only; no directory claim. | A `226001`; B `208001`. |

Hindi name, gender, house/street and state are populated correctly. Empty email
is optional, with **no missing-required finding**. Clearing English while Hindi
remains must not create a missing-English error; comparison becomes not checked.

## Filled examples (`case=complete`)

All correction/reference values above are loaded. Other stays selected and its
detail is filled. All A/B cases have **zero seeded correction/name-discrepancy
tasks**, but are not validated applications. Email stays empty; references remain
fictional. “Not checked” outcomes still apply:

| Applies to all eight initial states | Expected result |
| --- | --- |
| `nsp-detail` / `eci-detail`, label “विवरण 2” | Meaning unknown. Their 12-digit strings must not be classified as Aadhaar, OTR or EPIC. |
| `unsupported-frame`, inner `mock` control | Coverage not checked. Never silently include its value or claim all fields reviewed. |
| PIN/district and address | Geographic agreement, postal existence and residence not checked. Only fixture shape/presence is assessable. |
| OTR | Issuance/ownership not checked even with 14 digits. |
| Age-document name | Authenticity, evidence completeness and official acceptance not checked. |
| Reference missing/changed in a later harness | Without a reference, comparison is not checked; never infer spelling from speech. Changes require a new comparison. Built-in profiles always supply references. |
| Eligibility, identity, omitted fields, live behavior and review completion | Not checked; no reassurance or submission action. |

## Interaction cases (both workflows, both variants)

1. **Conditional requirement:** in issues, choose Urban (NSP) or birth certificate
   (ECI). Other detail is hidden and disabled, so its missing task is inapplicable.
   Choose Other again: the empty detail becomes applicable again. A radio group
   is one choice, not one error per unselected radio.
2. **Hidden value:** type into Other, choose an alternative and return. The typed
   value remains in memory; ignore it while inactive.
3. **Dynamic field:** the note does not exist before activation. Enter/Space on
   the button inserts it once, preserves focus, and next Tab reaches the optional
   input. An empty note is not a missing-required issue.
4. **Correction:** editable fields accept keyboard edits. NSP demographics stay
   read-only; identify upstream corrections. Use ECI for an editable name/date task.
5. **Reset/selection:** reset restores the chosen profile/scenario and removes
   notes. Loading a different profile discards edits. Typed values must never
   appear in URLs/storage or be sent to a backend.
6. **No submission:** Enter cannot submit/navigate an application. No Submit or
   review-complete button exists. Source links are explicit navigation without
   form contents or referrers.

## A/B equivalence for later comparisons

Within each workflow A/B have identical IDs, order, read-only boundaries, required
rules, initial branches, five issue tasks, a one-letter name discrepancy, an
impossible February date, a one-short identifier and two empty applicable fields.
Dynamic/coverage tasks are identical. Names, dates, addresses and numbers differ.
Filled scenarios mirror the same controls. This is **structural/task equivalence**,
not measured equality of difficulty. NSP and ECI are not equivalent to each other.

For later trials use the same workflow/scenario across conditions, counterbalance
A/B and condition order, define tasks before testing, and keep this oracle out
of the participant view. Separate correction, confirmation, uncheckable outcomes
and human assistance. No timing, scores, participant feedback or impact evidence
has been collected in this stage.
