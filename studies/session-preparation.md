# Session preparation — prepared, no session held

Status: no participant has been contacted or recruited; recruitment needs
the owner's authorization. Everything below is ready to use once that exists.
Results stay empty (`studies/results/`) until a session is actually observed.

## Before inviting anyone

- [ ] Authorization to recruit, and the channel to use, recorded by the owner.
- [ ] A Windows machine with ordinary desktop Chrome, NVDA, a local Hindi
  voice and a microphone; versions written on the session log.
- [ ] Baseline tool for condition A actually available and enabled on that
  machine (Gemini in Chrome, exact version); if not, condition A is recorded
  as not run, never substituted.
- [ ] The packaged extension installed from the recorded ZIP (SHA-256 in
  `docs/release.md`), the practice pages served, the API configured for
  condition B with a per-participant credential, and the cloud feature left
  off for condition C.
- [ ] The manual checklist rows relevant to the session machine performed
  (`docs/manual-nvda-checklist.md`), so a session never doubles as the first
  NVDA test.

## Briefing — read aloud, in Hindi, then in English if asked

“यह एक अभ्यास है, असली आवेदन नहीं। आप दो काल्पनिक सरकारी फ़ॉर्म देखेंगे जिनमें
जान-बूझकर कुछ गलतियाँ रखी गई हैं। आपका काम है उन्हें ढूँढना और ठीक करना, जैसे
आप अपने लिए करते। कुछ नहीं भेजा जाएगा; कोई असली नाम, Aadhaar या दस्तावेज़ यहाँ
नहीं है और आप अपना कोई निजी विवरण नहीं डालेंगे।

फ़ॉर्म साथी नाम का एक पैनल आपके स्क्रीन रीडर के साथ चलता है। यह फ़ॉर्म पढ़ता है,
फ़ील्ड बताता है और जाँच के नतीजे दिखाता है। यह कभी अपने आप कुछ नहीं भरता।

एक स्थिति में ‘क्लाउड सुविधा’ चालू होगी। तब, केवल आपके ‘रोकें और भेजें’ दबाने पर,
आपकी रिकॉर्डिंग एक बाहरी भाषा-सेवा को जाती है; रिकॉर्डिंग में जो बोला गया वह पूरा
जाता है और उसमें से कुछ हटाया नहीं जा सकता। आपके कहने पर चुने हुए फ़ील्ड का लेबल
और निर्देश भी जाते हैं — फ़ॉर्म में लिखे मान नहीं, आपका संदर्भ नहीं। अध्ययन
रिकॉर्डिंग नहीं रखता। आप किसी भी समय रुक सकते हैं, बिना कारण बताए।

हम केवल गिनतियाँ और समय लिखेंगे — कोई नाम, कोई मान, कोई आवाज़ नहीं। आपकी पहचान
एक छद्मनाम से होगी। क्या आप आगे बढ़ना चाहते हैं?”

English summary: practice only, fictional data, nothing is submitted; the
panel never fills anything in; in one condition your recording goes to an
external language service only when you press send and cannot be redacted;
the study records counts and durations under a pseudonym, no audio or video
unless you separately agree in writing; you may stop at any time.

## Consent to record, per participant

| Item | Recorded as |
| --- | --- |
| Verbal consent to take part after the briefing | yes/no, on the session log |
| Consent to condition B (cloud speech) specifically | yes/no; if no, B is recorded as not run |
| Audio or video recording of the session | **only with separate written authorization**; default is none |
| Pseudonym assigned | `P##`; the key stays with the study lead outside the repository |

## Assigning variants and conditions

Use the counterbalancing table in `docs/usability-protocol.md` in participant
order. Both practice variants are structurally equivalent; A/B alternates so
each condition meets each profile. Write the assignment on the log before the
session starts, never after.

## During the session

- Read the task once: “find and correct what is wrong; tell me when you would
  be ready to submit.” Time starts when the profile page is open.
- Count assistance by type; count seeded issues remaining against the oracle
  (`fixtures/expected-results.md`), never against the tool's own report.
- Note each panel sentence, button or message the participant calls unclear
  or misleading, by identifier only, for the `unclearWording` count.
- Record accessibility blockers (a control NVDA could not reach, a prompt that
  did not appear, focus lost) separately from task errors.

## After the session

- Transfer counts to `studies/results/<file>.json`; `npm run report` refuses
  any key that could hold a value or a name.
- Keep the paper log outside the repository. Report only what was observed,
  with the participant count; a handful of sessions supports no population
  claim.
