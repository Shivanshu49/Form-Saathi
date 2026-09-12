import type { Metadata } from 'next';
import { PRACTICE_ORIGIN, practiceForms, practiceUrl, profiles } from '../../lib/content';

export const metadata: Metadata = { title: 'अभ्यास फ़ॉर्म' };

export default function Practice() {
  return (
    <article className="space-y-8">
      <h1 className="text-3xl font-bold">काल्पनिक अभ्यास फ़ॉर्म</h1>
      <div className="bordered space-y-2 border-l-4 border-amber bg-[#eee7d7] p-4">
        <p className="font-bold">केवल प्रदर्शन। ये सरकारी पोर्टल नहीं हैं।</p>
        <p>
          सभी प्रोफ़ाइल काल्पनिक हैं। अपनी निजी जानकारी, Aadhaar या कोई असली दस्तावेज़ यहाँ न डालें और न अपलोड
          करें — यह वेबसाइट कुछ भी अपलोड करने को नहीं कहती। कोई आवेदन नहीं भेजा जाता; पेज दोबारा खोलने पर बदलाव
          मिट जाते हैं।
        </p>
      </div>
      <p className="max-w-[75ch]">
        हर फ़ॉर्म में A और B के समान अभ्यास कार्य हैं: चार सुधार और एक नाम-पुष्टि। अभ्यास पेज खोलकर उस टैब पर
        फ़ॉर्म साथी का बटन दबाएँ; पैनल उसी पेज के फ़ील्ड पढ़ता और जाँचता है। अभ्यास पेज <span lang="en">{PRACTICE_ORIGIN}</span> पर
        अलग से चलते हैं, इसलिए एक्सटेंशन उन्हें किसी भी दूसरी वेबसाइट की तरह ही पढ़ता है।
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {practiceForms.map((form) => {
          const references = profiles[form.profile];
          return (
            <section key={form.workflow} aria-labelledby={`${form.workflow}-heading`} className="bordered space-y-3 rounded border border-line bg-card p-5">
              <h2 id={`${form.workflow}-heading`} className="text-2xl font-bold">{form.heading}</h2>
              <p>{form.summary}</p>
              <p className="text-sm">काल्पनिक अंग्रेज़ी संदर्भ: A <span lang="en">{references.a.reference}</span>, B <span lang="en">{references.b.reference}</span>।</p>
              <ul className="space-y-2">
                {(['a', 'b'] as const).map((variant) => (
                  <li key={variant} className="flex flex-wrap gap-4">
                    <a href={practiceUrl(form.page, variant, 'issues')} className="text-teal">प्रोफ़ाइल {variant.toUpperCase()} — सुधार का अभ्यास</a>
                    <a href={practiceUrl(form.page, variant, 'complete')} className="text-teal">प्रोफ़ाइल {variant.toUpperCase()} — भरा हुआ उदाहरण</a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="max-w-[75ch]">
        अभ्यास फ़ॉर्म चलाने के लिए repository में <code lang="en">npm run dev:fixtures</code> चलाएँ। इन पेजों में एक
        जानबूझकर असमर्थित फ़्रेम और एक अस्पष्ट लेबल है, ताकि “जाँचा नहीं गया” का अर्थ सीखा जा सके।
      </p>
    </article>
  );
}
