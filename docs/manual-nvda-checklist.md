# Manual Windows Chrome / NVDA checklist

Every row below is **NOT RUN**. Automated scans in [testing.md](testing.md)
establish technical facts about the panel document; they are not evidence that
a screen-reader user can use it. Mark a row passed only after it was actually
performed, and record the exact versions, tester, date and what was observed.
A row that fails goes to the repository as a defect, not a note.

Setup to record first: Windows version, Chrome version, NVDA version, Hindi
voice (name and whether it runs locally), zoom level, high-contrast mode,
extension build (`git` commit) and whether the API was configured.

| ID | Area | Check | Expected | Result | Tester / date / notes |
| --- | --- | --- | --- | --- | --- |
| F1 | Focus | Activate the toolbar button on a practice tab, then press Alt+Shift+F on another tab | Panel opens for the activated tab; the other tab shows the unbound panel | NOT RUN | |
| F2 | Focus | Tab through the panel from the top | Order: re-read, previous, next, focus page field, read aloud, stop, reference input, review controls, field list, cloud setup, service check | NOT RUN | |
| F3 | Focus | Activate “मूल फ़ील्ड पर जाएँ” and a list item | Focus lands on the page control and NVDA reads its label | NOT RUN | |
| F4 | Focus | Press F6 from the page | Focus returns to the docked panel; if it does not, record what does and fix the panel's instruction | NOT RUN | |
| F5 | Focus | Correct a value in the page and return | Panel shows the new value; the current field and the panel's focus are unchanged | NOT RUN | |
| F6 | Focus | Insert the practice note; change the locality radio | Panel updates without moving focus; the conditional field is announced as inactive | NOT RUN | |
| F7 | Focus | With the PIN field current, have the page replace that control with an identical one (from the console: `const c=document.querySelector('#eci-pin');c.replaceWith(c.cloneNode(true))`), then activate “मूल फ़ील्ड पर जाएँ” | Focus lands on the replacement; the current field and its number are unchanged; nothing is announced about a change | NOT RUN | |
| P1 | Hindi | Read the whole panel in browse mode with the Hindi voice | Wording is understood; no sentence sounds like approval, submission or identity verification | NOT RUN | |
| P2 | Hindi | Read an English name value and the portal names | Voice switches on `lang="en"` and English is intelligible | NOT RUN | |
| P3 | Hindi | Read each validation message, action and source | Each is understood; sources (N1, E1, F3) are recognisable as references | NOT RUN | |
| P4 | Hindi | Read masked values and the reveal control | “मान छिपा है” is understood; the full value is read only after revealing | NOT RUN | |
| P5 | Hindi | Enter a future date, year 0000 and, on a page with a native date control, a date outside its bounds; read the “आयु या पात्रता नहीं जाँची गई” note | Each message is understood as a date validity message; none is taken as an eligibility decision | NOT RUN | |
| E1 | Announcements | Press next field ten times | Exactly one announcement per press, nothing repeated | NOT RUN | |
| E2 | Announcements | Type in a page field while the panel is open | No announcement for a value change; a new field announces once | NOT RUN | |
| E3 | Announcements | Acknowledge the review, then change a value | The stale notice is heard once; the status shows the acknowledgment is no longer valid | NOT RUN | |
| E4 | Announcements | Trigger a denied microphone, a stopped API and a stalled API | Each Hindi explanation is heard once; navigation continues | NOT RUN | |
| E5 | Announcements | Remove the current control from the page (console: `document.querySelector('#eci-pin').remove()`) | One announcement says the field is gone and to choose from the list; no page control receives focus; previous/next still work | NOT RUN | |
| E6 | Announcements | Type a reference, acknowledge, then navigate the same tab to the other practice form and re-read | The reference input is empty, the acknowledgment reads “दर्ज नहीं”, and no value of the earlier form is read anywhere | NOT RUN | |
| Z1 | Zoom | 200% and 400% browser zoom | No content or control is lost; no horizontal scrolling of the panel body | NOT RUN | |
| Z2 | Zoom | Narrow and wide docked panel widths | Buttons wrap; the review table scrolls within itself only | NOT RUN | |
| Z3 | Zoom | Windows high contrast | Focus ring, borders and severity groups remain distinguishable | NOT RUN | |
| K1 | Keyboard | Complete one Form 6 issues profile with the keyboard alone | All five seeded tasks reachable and correctable without a mouse | NOT RUN | |
| K2 | Keyboard | Use “अगली समस्या” through every issue | Each moves the current field; the count reads “समस्या n / 5” | NOT RUN | |
| K3 | Keyboard | Enter the reference spelling, reveal a value, copy a suggestion | All work from the keyboard; the reference is never read back unasked | NOT RUN | |
| K4 | Keyboard | Try to find any way the panel changes a page value or submits | None exists; the page's own status never changes | NOT RUN | |
| S1 | Speech | Read aloud a field, then press Stop midway | Speech stops immediately; NVDA is not talked over | NOT RUN | |
| S2 | Speech | Read aloud with only a remote Hindi voice installed | Panel refuses and says why; nothing is spoken | NOT RUN | |
| S3 | Speech | Play the spoken review and interrupt with navigation | Speech stops on Stop; navigation announcements are not lost | NOT RUN | |
| S4 | Speech | Record a value on a real microphone, Stop, Cancel | Prompt appears in the docked panel; status and seconds perceivable; Cancel sends nothing | NOT RUN | |
| S5 | Speech | Speak an unambiguous date; then one without a year | First gives DD/MM/YYYY to confirm; second asks for clarification with no value | NOT RUN | |
| S6 | Speech | Play cloud help audio | Native player operable; content is generic | NOT RUN | |
| S7 | Speech | Press “रद्द करें” after “रोकें और भेजें” while the service is slow | The cancellation is announced once, with the statement that what was sent is not recalled; the field stays current and navigation continues | NOT RUN | |
| S8 | Speech | Withdraw consent (“क्लाउड सुविधा बंद करें”) while a recording or request is in progress, then re-enable | Recording and request stop at once; nothing arrives later; re-enabling requires the credential again and works | NOT RUN | |
| M1 | Microphone | First “रिकॉर्डिंग शुरू करें” in the docked panel on a machine that has never granted the extension the microphone | Chrome's permission prompt is reachable and announced; denying it yields the Hindi explanation and keyboard entry remains possible | NOT RUN | |
| R1 | Review | Read the review table with table navigation | Rows, headers and statuses are navigable and understood | NOT RUN | |
| R2 | Review | Acknowledge on a filled profile | Status reads partial coverage because of the frame, never all-clear | NOT RUN | |
| R3 | Review | Read the submission line | Understood that the panel never submits and holds no evidence of submission | NOT RUN | |
