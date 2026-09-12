# Workflow source register

Reviewed/retrieved **2026-09-12**. This register is not a portal rule pack.
Recheck sources before releasing rules. No authorized student/voter session or
personal records were available.

| ID | Official source URL | Retrieved | Relevant instruction/information | Workflow scope and verification |
| --- | --- | --- | --- | --- |
| N1 | [NSP Students](https://scholarships.gov.in/Students) | 2026-09-12 | Current student entry for AY 2026–27. OTR is a distinct 14-digit number. | Public HTML read; establishes format, not issuance, identity or authenticated field behavior. |
| N2 | [NSP Application FAQ v2.2](https://scholarships.gov.in/public/FAQ/NSP_FAQsORApplicationUsermanul_V2.2.pdf), Q1–2 p1; Q12 p6–7 | 2026-09-12 | After login, Basic Information includes General Information, Academic Details and Application Specific Details; Apply Fresh follows. Name, gender and DOB are updated through OTR and refreshed into the application. | Current published route authority. Text reviewed; authenticated screens/DOM unverified. Does not establish every field or required attribute. |
| N3 | [NSP application manual v1.0](https://scholarships.gov.in/public/FAQ/NSP_User_Manual_v1.0.pdf), p25 Fig 2.3.2.2(a) | 2026-09-12 | General Information screenshot shows demographics, personal categories and address fields, including Rural/Urban/Other locality choices. | Downloaded; screenshot visually inspected. It says AY 2024–25. Historical inventory only, not current requiredness or routing authority. |
| N4 | [NSP application entry](https://scholarships.gov.in/ApplicationForm/) | 2026-09-12 | Redirects to `/ApplicationForm/login`; public login offers Aadhaar, APAAR and OTR methods. | Read-only Chromium visit, HTTP 200. Stopped at login; no credentials, OTP, CAPTCHA or authenticated workflow tested. Login excluded. |
| E1 | [ECI Form 6 English PDF](https://voters.eci.gov.in/formspdf/Form_6_English.pdf), items 1, 3–9 | 2026-09-12 | New-voter form with name, gender, DOB, age-document and address sections. Contact information depends on availability; other age-document naming is conditional; disability information is optional. | Two-page PDF read; first-page layout inspected. Published content confirmed, online layout/validation/accessibility unverified. |
| E2 | [ECI Form 6 guidelines](https://voters.eci.gov.in/guidelines/Form-6_en.pdf), general 1(b), sections 2, 5–7 | 2026-09-12 | One-language applications are allowed; English spelling needs care. Gender and complete address including PIN are requested. Alternative age-document names are needed when listed documents are unavailable. | Published instructions reviewed. No evidence of PIN/district matching, document acceptance, eligibility or live DOM behavior. |
| E3 | [ECI Citizen Service Portal](https://voters.eci.gov.in/) | 2026-09-12 | Public homepage links new-voter Form 6, download and guidelines. | Read-only Chromium visit, HTTP 200. No authenticated Form 6 session tested. |
| B1 | [RBI NEFT FAQ](https://www.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=274) | 2026-09-12 | “It is a 11-digit code with the first 4 alpha characters representing the bank, and the last 6 characters representing the branch. The 5th character is 0 (zero).” | Supports the IFSC **format rule only**. It establishes nothing about whether a branch, account or account holder exists. |
| S1 | [Sarvam speech-to-text reference](https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe) | 2026-09-12 | `POST /speech-to-text`, `api-subscription-key` header, multipart `file`, `model`, `language_code`; models `saaras:v3` (default) and `saaras:v4`; reply `{request_id, transcript, language_code, …}`. | Request shape for the provider adapter. No live call has been made from this repository. |
| S2 | [Sarvam chat completions reference](https://docs.sarvam.ai/api-reference/chat/chat-completions.md) | 2026-09-12 | `POST /v1/chat/completions`, `api-subscription-key` and `Authorization: Bearer`; models `sarvam-105b` and `sarvam-105b-conversations`; `response_format` supports `json_object` and `json_schema`. | Request shape only. Model behaviour and JSON-schema support are unverified here. |
| S3 | [Sarvam text-to-speech reference](https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert) | 2026-09-12 | `POST /text-to-speech`, JSON `text`, `language_code`, `model`, `speaker`, `output_audio_codec`; models `bulbul:v3` (default) and `bulbul:v2`; reply `{request_id, audios:[base64]}`. | Request shape only. Voice quality and Hindi suitability are untested. |
| U1 | [UIDAI circular on Virtual ID, UID Token and Limited KYC](https://uidai.gov.in/images/46Circular_for_Implementation_of_Virtual_ID_UID_Token_and_Limited_KYC_0001_compressed.pdf) | 2026-09-12 | “Last digit of the VID is the checksum using Verhoeff algorithm as in Aadhaar number.” | Establishes that an Aadhaar number carries a Verhoeff checksum. It does **not** give the algorithm's tables or the number's length, so no Aadhaar check is implemented. |

N2 was found through the [current NSP FAQ index](https://scholarships.gov.in/studentFAQs)
on the same date. Its version comes from the filename; no independent publication
date was established. ECI PDF revision dates were not established either.
Retrieval dates must not be presented as publication dates.

## Selected scope and conflicting evidence

**`nsp-2026-27-basic-general`:** after authorized login through Students → Apply
For Scholarship, at Basic Information → General Information, before Academic
Details and Apply Fresh. This prepares for a fresh scholarship application; it
does not cover OTR registration, a specific scheme, eligibility, renewal,
withdrawal, submission or payment.

N2 determines the route. N3 depicts an older order with Apply Fresh earlier;
do not copy that into a 2026–27 compatibility claim. The fixture uses a small
historical personal/address subset plus synthetic stress cases. Its OTR reference
input, exact address requirements, conditional locality detail and corrupt
inherited DOB are **fixture assumptions**, not observed live states.

**`eci-form6-new-voter`:** the practice subset covers selected fields from items
1, 6, 7 and 8, plus optional email from item 4. It is not a complete Form 6.
Names/address rows are combined. Aadhaar, photo, relative details, full document
lists/uploads, family EPIC, disability details, declarations, signatures and
receipt are omitted. No eligibility or legal declaration is inferred.

## Identifier evidence retrieved for the rule packs

Searched and retrieved on 2026-09-12 while building the validation engine:

- **IFSC (B1).** The RBI FAQ states the structure quoted above, so the engine
  checks four letters, a `0`, then six alphanumeric characters, and says in the
  same breath that branch and account existence are not checked.
- **Aadhaar and EID (U1).** UIDAI's circular confirms a Verhoeff checksum
  exists. The retrieved document does not contain the algorithm's tables, and
  the UIDAI pages that state the 12-digit length returned HTTP 404 on this date
  (`/en/about-uidai/...`, `/en/contact-support/.../faqs/your-aadhaar/`). Writing
  those tables from memory would be inventing a specification, so an
  Aadhaar-mapped or EID-mapped field produces an explicit **not checked**
  result. Implementing the check needs a retrieved, reviewed algorithm source.
- **Postal PIN.** No India Post page stating the six-digit structure was
  retrieved: `indiapost.gov.in/VAS/Pages/FindPinCode.aspx` and
  `indiapost.gov.in/MBE/Pages/Content/Pincode.aspx` returned HTTP 404, and the
  DIGIPIN technical document (Department of Posts, March 2025) describes only
  the new 10-character DIGIPIN grid. The six-digit rule therefore stays a
  **fixture convention (F3)** and says so in its own message. PIN-to-district
  agreement stays unchecked: no reviewed directory exists here, and none is
  invented.
- **NSP OTR.** N1 remains the only identifier length this project asserts from a
  portal's own page, and it applies only to a field a pack maps as an OTR.

## Provider models selected for the AI service

Checked on 2026-09-12 against S1–S3. The three models the brief asked to
evaluate all exist: `saaras:v3` is the speech-to-text default (`saaras:v4` is
newer), `sarvam-105b` is a current chat model, and `bulbul:v3` is the
text-to-speech default. They are configuration values
(`SARVAM_TRANSCRIBE_MODEL`, `SARVAM_INTERPRET_MODEL`, `SARVAM_SPEECH_MODEL`),
not literals in request code, so a change needs no code edit.

Availability here means “named in the current published reference”. No request
has been sent to Sarvam from this repository: there is no account, no key and
no live result. Latency, Hindi quality, JSON-schema adherence, pricing and rate
limits are all **unverified**; see [testing.md](testing.md) for what the
controlled mocks do and do not establish.

## Interpretation boundaries

- Published instructions do not establish live selectors, focus, required flags,
  dynamic controls or screen-reader announcements.
- N1's OTR length applies only to identified OTR fields. Aadhaar, APAAR, OTR,
  application IDs, EPIC and unknown numeric strings are distinct concepts.
- Six-digit PIN syntax is a fixture convention here. No postal directory was
  reviewed; address validity and PIN/district agreement remain not checked.
  E2 supports PIN presence, not this fixture format rule.
- A reference mismatch asks for confirmation; it does not establish identity.
  Hindi explanations are project-authored practice paraphrases. Human Hindi
  and NVDA review is pending; these are not production-approved rule packs.

## Content fingerprints

SHA-256 of downloaded PDFs inspected during this stage:

| Source | SHA-256 |
| --- | --- |
| N3 | `5850a08d3d83f547687cd5c290e01a03866a3ef816c67ea7be229451398e32e1` |
| E1 | `2d89e57e2e530989e628872a19c1334a0d968e081ffb542c55e9336ca714a179` |
| U1 | `976666aa39e2f0479342c1bb2170d22e7b9dbe6505421cbd2713d1131e3e1772` |

No personal screenshots or authenticated records are included. Re-fetch and
reassess the inventory when sources change. A document or login-page review is
not end-to-end portal verification.
