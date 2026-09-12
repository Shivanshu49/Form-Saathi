# Five-minute demonstration

Reproducible on the practice forms with the packaged extension. Everything
shown is fictional data; nothing is submitted anywhere. Step 4 needs a
configured service and a pilot credential; without them, say so and skip it —
every other step works with no server at all.

## Setup (before the clock starts)

```bash
nvm use && npm ci
npm run build                                  # all four artifacts
npm run package:pilot                          # the zip
npm run preview:fixtures                       # practice pages on 127.0.0.1:4173
# optional, for step 4, in a second terminal with .env configured:
npm run start --workspace @form-saathi/api
```

Load `apps/extension/.output/chrome-mv3` with **Load unpacked** in
`chrome://extensions` and pin it. Have NVDA running if demonstrating with a
screen reader; the script works identically without one.

## Script

**1. A fictional form with known mistakes (0:00–0:40).**
Open `http://127.0.0.1:4173/eci-form6.html?variant=a&case=issues`. Read the
notice aloud: "केवल प्रदर्शन। यह सरकारी पोर्टल नहीं है।" Point out the reference
name in the sidebar, `ARUN DEV`. The page carries five seeded problems from the
independent oracle: an English name one letter short, an impossible date
31/02/2000, an empty district, an empty conditional document name, and a
five-digit PIN.

**2. Keyboard navigation and Hindi field guidance (0:40–1:40).**
Press **Alt+Shift+F**. The panel opens for this tab and reads it: "14 फ़ील्ड
पढ़े गए। 1 जगह नहीं पढ़ी जा सकीं।" Tab to **अगला फ़ील्ड** and press Enter twice;
the current-field card moves to the date field and shows its label, value,
the page's own instruction and format rule. Tab to **मूल फ़ील्ड पर जाएँ**, press
Enter: focus lands in the page's date input. Press **F6** to return to the panel.
Under **जाँचा नहीं गया** in the review, show the sandboxed frame's line,
"अलग फ़्रेम — इसकी सामग्री नहीं पढ़ी गई": coverage that could not be read is
named, never hidden.

**3. Deterministic issue detection (1:40–2:30).**
Tab to the reference input and type `ARUN DEV`. The review now reads
**सुधार चाहिए (4)** and **पुष्टि चाहिए (1)**. Read one of each: the date error
names the month's real length; the name result shows both spellings and says
spelling is not decided by speech. Point at the source line (`E1 मद 7`) and
the pack line: "नियम पैक eci-form6-new-voter 1.0 … का लाइव परीक्षण बाकी है."
Note what is listed under **जाँचा नहीं गया** — PIN/district agreement, the frame,
and "जन्म तारीख से आयु या पात्रता नहीं जाँची गई" — and say plainly that this is
not approval: the date is checked for validity only, never for eligibility.

**4. One optional Hindi speech suggestion (2:30–3:20).**
*Only if the service is configured.* In **क्लाउड सुविधा**, read the consent
text — it says raw audio cannot be redacted — enable, and paste the credential.
Make the district field current, press **रिकॉर्डिंग शुरू करें**, say "लखनऊ",
press **रोकें और भेजें**. Show the transcript in its editable box, press
**इस पाठ को समझें**, and show the suggestion with its local check. Say: the
panel copies it to the clipboard on request; it never types into the page.
*If not configured:* press the button anyway and show the honest 503 message,
then continue — navigation and checks are unaffected. *If the service is slow:*
press **रद्द करें** after sending; the panel says the request was cancelled, the
server stops its own request to the provider, and what the provider had already
received is not recalled.

**5. Manual correction on the original form (3:20–4:00).**
From the district result press **फ़ील्ड पर जाएँ**, type `लखनऊ` in the page
yourself, then fix the PIN to `226001`. Return with F6. The review has
already updated: **सुधार चाहिए (2)**. Nothing in the panel wrote anything.

**6. Updated review and acknowledgment (4:00–4:40).**
Press **मैंने दिखाई गई समीक्षा पढ़ ली है**. The panel re-reads the form first,
then records "समीक्षा पढ़ी गई, पर 2 सुधार बाकी हैं" with a revision label. Now
change the date in the page to `15/08/2000`; the status turns to
"स्वीकृति अमान्य" — the acknowledgment was for data that no longer exists.
Read the submission line: the panel has no evidence of submission and never
presses Submit.

**7. Results (4:40–5:00).**
Open `http://127.0.0.1:3100/results` (with `npm run start --workspace
@form-saathi/web` running). It reads: "अभी कोई सत्र दर्ज नहीं." State it as it
is: **participant evaluation is pending; no measured result exists.** The
protocol, checklist and empty results template are ready; no number in this
project is a result.

## What the demo must not say

That the extension works on the live NSP or ECI portal (unverified), that a
review means acceptance or verified identity (it never does), that the
extension is on the Web Store or deployed publicly (it is not), or that users
have tested it (none have).
