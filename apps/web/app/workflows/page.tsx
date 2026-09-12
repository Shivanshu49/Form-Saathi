import type { Metadata } from 'next';
import { livePortalSupport, packs, supportText, workflowTitle } from '../../lib/content';

export const metadata: Metadata = { title: 'समर्थित कार्यप्रवाह' };

const requirementText = { required: 'आवश्यक', optional: 'वैकल्पिक', conditional: 'शर्त पर', 'read-only': 'केवल पढ़ें' } as const;

export default function Workflows() {
  return (
    <article className="space-y-8">
      <h1 className="text-3xl font-bold">समर्थित कार्यप्रवाह</h1>
      <p className="max-w-[75ch]">
        यह तालिका सीधे एक्सटेंशन के नियम पैक से बनी है, इसलिए वेबसाइट और पैनल एक ही बात कहते हैं। “समर्थित”
        का अर्थ है कि उस कार्यप्रवाह के लिए समीक्षित नियम पैक मौजूद है — यह नहीं कि वास्तविक पोर्टल पर परीक्षण
        हुआ है। किसी और वेबसाइट पर पैनल फ़ील्ड पढ़ता है पर कोई नियम नहीं लगाता।
      </p>
      <table className="w-full border-collapse">
        <caption className="text-left font-bold">नियम पैक और उनकी स्थिति</caption>
        <thead>
          <tr className="border-b-2 border-line text-left">
            <th scope="col" className="py-2 pr-4">कार्यप्रवाह</th><th scope="col" className="py-2 pr-4">होस्ट</th>
            <th scope="col" className="py-2 pr-4">पैक</th><th scope="col" className="py-2 pr-4">समीक्षा</th><th scope="col" className="py-2">लाइव परीक्षण</th>
          </tr>
        </thead>
        <tbody>
          {packs.map((pack) => (
            <tr key={pack.id} className="border-b border-line align-top">
              <th scope="row" className="py-2 pr-4 text-left font-bold" lang="en">{workflowTitle[pack.workflow]}</th>
              <td className="py-2 pr-4" lang="en">{pack.hosts.join(', ')}</td>
              <td className="py-2 pr-4" lang="en">{pack.id} {pack.version}</td>
              <td className="py-2 pr-4">{pack.reviewed}</td>
              <td className="py-2">{supportText[livePortalSupport[pack.workflow]]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {packs.map((pack) => (
        <section key={pack.id} aria-labelledby={`${pack.id}-fields`} className="space-y-3">
          <h2 id={`${pack.id}-fields`} className="text-2xl font-bold" lang="en">{workflowTitle[pack.workflow]}</h2>
          <p className="text-sm">
            फ़ील्ड-नाम अभ्यास पेज के हैं; लाइव पोर्टल के नियंत्रण-नाम अभी अज्ञात हैं। स्रोत-क्रमांक repository के source register के हैं।
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="text-left font-bold">{pack.fields.length} फ़ील्ड</caption>
              <thead>
                <tr className="border-b-2 border-line text-left">
                  <th scope="col" className="py-2 pr-3">फ़ील्ड</th><th scope="col" className="py-2 pr-3">अर्थ</th>
                  <th scope="col" className="py-2 pr-3">आवश्यकता</th><th scope="col" className="py-2">स्रोत</th>
                </tr>
              </thead>
              <tbody>
                {pack.fields.map((field) => (
                  <tr key={field.key} className="border-b border-line align-top">
                    <th scope="row" className="py-2 pr-3 text-left font-bold" lang="en">{field.key}</th>
                    <td className="py-2 pr-3" lang="en">{field.meaning}</td>
                    <td className="py-2 pr-3">{requirementText[field.requirement]}{field.when ? ` (${field.when.key} = ${field.when.value})` : ''}</td>
                    <td className="py-2" lang="en">{field.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </article>
  );
}
