# Usability protocol 1.0

Status: **designed, not run**. No participant session has taken place, no
result exists, and nothing in this repository may be presented as one.

## Purpose

Compare how blind and low-vision Hindi speakers using NVDA correct seeded
mistakes in the fictional practice forms under three conditions, and measure
what each condition costs and misses. The forms are practice representations
([support matrix](support-matrix.md)); nothing here is a live portal test.

## Conditions

| Condition | Tools on the test machine |
| --- | --- |
| A | NVDA + Gemini in Chrome, **only if Gemini in Chrome is actually available and enabled on the test machine**; record the exact version. If it is not available, record A as not run rather than substituting another assistant. |
| B | NVDA + full Form Saathi: reading, navigation, local checks, cloud speech and suggestions with a configured service and credential. |
| C | NVDA + Form Saathi with the cloud feature left off: reading, navigation and local checks only. |

The same Windows machine, Chrome, NVDA and Hindi voice are used for all three,
and their versions are recorded once per participant.

## Equivalent variants

Each workflow has structurally matched A/B profiles
([expected results](../fixtures/expected-results.md)): identical field order,
requirements, conditional branches and five seeded tasks — four corrections and
one name confirmation — differing only in values. NSP and ECI Form 6 are **not**
equivalent to each other; a comparison is made within one workflow only.
Difficulty equivalence between profile A and B has not been measured.

## Counterbalancing

Each participant does one workflow under all three conditions, one profile
scenario per condition, with condition order assigned from the six
permutations and profiles alternating so each condition meets each profile:

| Participant | Order | Profiles by task |
| --- | --- | --- |
| P01 | A B C | a b a |
| P02 | B C A | b a b |
| P03 | C A B | a b a |
| P04 | A C B | b a b |
| P05 | B A C | a b a |
| P06 | C B A | b a b |

Continue the cycle for P07 onward. The report groups sessions by condition and
by order position so learning effects stay visible.

## Tasks

For each session the participant opens the assigned `case=issues` profile and
is asked to find and correct what is wrong, then decide whether they would be
ready to submit. Tasks are defined before testing from the oracle: the four
corrections and the one confirmation. Read-only NSP fields are explained as
needing an upstream correction, and identifying that counts as completing the
task for that field. A session has a time limit of 25 minutes.

## Measures

| Measure | Definition |
| --- | --- |
| Remaining errors | Seeded issues still present when the session ends, counted against the oracle by the tester, not by the tool |
| False warnings | Warnings the tool showed for values that were correct |
| Missed errors | Seeded issues the tool never flagged (B and C only; null for A) |
| Task completion | The participant ended the session believing the corrections were done, with all seeded issues actually resolved or correctly identified as upstream |
| Time | Seconds from opening the profile to ending the session |
| Human assistance | Each time the tester helped: navigation help, an explanation, or physical help; counted, with the type in the session log |
| Unclear wording | Panel sentences, button names or messages the participant reported unclear or misleading, counted and listed in the session log by identifier only |
| CAPTCHA blockers | Recorded separately and never folded into the counts above. The practice forms contain no CAPTCHA; this column exists so any future live-like step reports blockage honestly |

## Hindi wording review

After each session the tester asks which panel sentences, button names or
messages were unclear or misleading, and records them in the session log by
message identifier — the rule id, the button name or the section heading —
never by the value that was on screen. The wording is revised before the next
participant only if the change does not alter what a message claims; claims are
never strengthened from participant feedback.

## Data handling

Participants are identified only by pseudonym (`P01`, `P02`, …) assigned by the
study; the key is kept by the study lead outside this repository. Session
records hold counts, durations and categories only — the schema in
`studies/report.ts` rejects any other key, so no name, field value, transcript
or recording can be filed. Observations go in the paper or off-repository
session log (`studies/session-log-template.md`) and must not quote values.
Recordings made through Form Saathi go to the configured service for
transcription only and are not retained by the study; the participant is told
this before condition B and may stop at any time. Session files live in
`studies/results/`, committed empty until a study exists.

## Reporting

`npm run report -- studies/results/*.json` validates every record and prints
per-condition sessions, completion, mean duration, mean remaining errors, mean
false warnings, mean missed errors, assistance events and CAPTCHA blockers,
plus counterbalancing and outcome counts. With no records it prints that
nothing is recorded. Small samples support no general claim; results are
reported as observations, without invented participants, scores or impact
numbers.
